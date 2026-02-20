# player/views.py
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest, Http404
from django.utils import timezone
from django.db import transaction
from .models import Browser, DisplayGroup, PlaylistEntry, ContentItem, AutomationScript
import uuid # Ensure uuid is imported

@transaction.atomic # Ensure browser update/creation is atomic
def get_playlist_api(request):
    browser_id_str = request.GET.get('browser_id')
    if not browser_id_str:
        return HttpResponseBadRequest("Missing 'browser_id' parameter.")

    try:
        # Validate and convert the browser ID string to UUID
        browser_uuid = uuid.UUID(browser_id_str)
    except ValueError:
        return HttpResponseBadRequest("Invalid 'browser_id' format. Must be a UUID.")

    # Find or create the browser entry, update last_seen timestamp
    browser, created = Browser.objects.select_related('group').get_or_create(
        identifier=browser_uuid,
        defaults={'last_seen': timezone.now()} # Set initial last_seen on creation
    )

    if not created:
        # Update last_seen efficiently only if it's been a while (e.g., > 1 minute)
        # to reduce database writes if requests are very frequent.
        if timezone.now() - browser.last_seen > timezone.timedelta(minutes=1):
            browser.last_seen = timezone.now()
            browser.save(update_fields=['last_seen'])
    elif created:
         print(f"Registered new browser: {browser_uuid}") # Log registration

    playlist_items = []
    group_name = None
    if browser.group:
        group_name = browser.group.name
        # Fetch ordered playlist entries for the browser's group
        # Select related content_item to avoid N+1 queries
        entries = PlaylistEntry.objects.filter(group=browser.group)\
                                       .order_by('order')\
                                       .select_related('content_item')

        for entry in entries:
            item = entry.content_item
            data = {
                'id': item.id,
                'title': item.title,
                'type': item.content_type,
            }
            if item.content_type == 'video' and item.video_file:
                try:
                    data['url'] = request.build_absolute_uri(item.video_file.url)
                except ValueError:
                    print(f"Warning: Could not build URL for video file: {item.video_file}")
                    continue
            elif item.content_type == 'website' and item.url and item.duration:
                data['url'] = item.url
                data['duration'] = item.duration
            else:
                print(f"Warning: Skipping invalid playlist item: ID={item.id}")
                continue

            # Automation scripts linked to this content item (M2M)
            item_scripts = AutomationScript.objects.filter(
                content_items=item,
                enabled=True,
            ).order_by('order', 'name')
            data['scripts'] = [
                {'name': s.name, 'url_pattern': s.url_pattern or '', 'content': s.content}
                for s in item_scripts
            ]

            playlist_items.append(data)

    return JsonResponse({
        'browser_id': str(browser.identifier),
        'group_name': group_name,
        'playlist': playlist_items,
        'show_status': browser.group.show_status if browser.group else True,
    })


# Player view remains simple - just serves the HTML template
def video_player_view(request):
    response = render(request, 'kioskmanager/player.html')
    response['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
    return response