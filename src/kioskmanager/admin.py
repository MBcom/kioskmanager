# player/admin.py
from django.contrib import admin
from django.contrib.auth.models import Group as AuthGroup # Avoid naming conflict
from .models import Browser, DisplayGroup, ContentItem, PlaylistEntry
from unfold.admin import ModelAdmin, TabularInline

from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.models import User as AuthUser

from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm
from unfold.admin import ModelAdmin


admin.site.unregister(AuthUser)
admin.site.unregister(AuthGroup)


@admin.register(AuthUser)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    # Forms loaded from `unfold.forms`
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm


@admin.register(AuthGroup)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass

@admin.register(Browser)
class BrowserAdmin(ModelAdmin):
    list_display = ('identifier', 'name', 'group', 'last_seen')
    list_filter = ('group',)
    search_fields = ('identifier', 'name')
    readonly_fields = ('identifier', 'last_seen',) # Identifier generated by frontend, last_seen automatic
    autocomplete_fields = ['group'] # Easier group selection

    # Browsers are registered automatically by the frontend, usually no need to add them here.
    def has_add_permission(self, request):
        return request.user.is_superuser # Only superusers add manually if needed

    def has_delete_permission(self, request, obj=None):
         return request.user.is_superuser # Only superusers delete browser records

class PlaylistEntryInline(TabularInline): # Or StackedInline
    model = PlaylistEntry
    extra = 1
    autocomplete_fields = ['content_item'] # Easier content selection
    fields = ('order', 'content_item')
    ordering = ('order',)
    fk_name = "group"

    # Permission Check: Limit ContentItem choices based on user's managed groups?
    # This is complex here. Easier to handle via DisplayGroupAdmin permissions.
    # def formfield_for_foreignkey(self, db_field, request, **kwargs):
    #     if db_field.name == "content_item" and not request.user.is_superuser:
    #         # Potentially filter ContentItems available for selection.
    #         # However, ContentItems are global. The restriction is on *which* group
    #         # they can be added *to*. So filtering here might not be the right place.
    #         pass
    #     return super().formfield_for_foreignkey(db_field, request, **kwargs)


class BrowserInline(TabularInline): # Read-only view of browsers in this group
    model = Browser
    extra = 0
    can_delete = False
    readonly_fields = ('identifier', 'name', 'last_seen')
    fields = ('identifier', 'name', 'last_seen')
    verbose_name = "Assigned Browser"
    verbose_name_plural = "Assigned Browsers"

    def has_add_permission(self, request, obj=None):
        return False # Don't allow adding browsers from group admin

    def has_change_permission(self, request, obj=None):
        return False # Read-only inline


@admin.register(DisplayGroup)
class DisplayGroupAdmin(ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)
    inlines = [PlaylistEntryInline, BrowserInline]
    filter_horizontal = ('managers',) # Use a nice widget for selecting users

    # --- Permission Overrides ---
    def get_queryset(self, request):
        """Limit list view to groups the user manages (or all for superuser)."""
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        # Return groups where the logged-in user is listed in the 'managers' field
        return qs.filter(managers=request.user)

    def has_view_or_change_permission(self, request, obj=None):
        """Allow viewing/changing only if superuser or manager of the specific group."""
        if request.user.is_superuser:
            return True
        if obj is not None: # Check for specific object
            return obj.managers.filter(pk=request.user.pk).exists()
        # Allow access to the list view (filtered by get_queryset)
        return self.has_module_permission(request) # Check model-level permission

    def has_delete_permission(self, request, obj=None):
        """Allow deletion only if superuser or manager of the specific group."""
        if request.user.is_superuser:
            return True
        if obj is not None:
            return obj.managers.filter(pk=request.user.pk).exists()
        return False # Don't allow deleting from list view without object context for non-superusers

    def has_add_permission(self, request):
        """Allow adding new groups only for superusers (or specific permission)."""
        # Adjust if non-superusers should create groups
        return request.user.is_superuser

    def save_model(self, request, obj, form, change):
        """Optionally auto-assign the creator as a manager if adding a new group."""
        super().save_model(request, obj, form, change)
        if not change and not request.user.is_superuser: # If adding and not superuser
            # obj.managers.add(request.user) # Uncomment if non-admins can add groups and should manage them
            pass

    def save_formset(self, request, form, formset, change):
        """Ensure playlist entries are saved correctly, permissions checked implicitly by group access."""
        # Check permissions on the parent DisplayGroup object before allowing formset save
        group_instance = form.instance
        if not self.has_view_or_change_permission(request, group_instance):
             from django.core.exceptions import PermissionDenied
             raise PermissionDenied("You do not have permission to modify this group's playlist.")
        super().save_formset(request, form, formset, change)


@admin.register(ContentItem)
class ContentItemAdmin(ModelAdmin):
    list_display = ('title', 'content_type', 'uploaded_at')
    list_filter = ('content_type',) # Removed 'groups' filter as it's now indirect
    search_fields = ('title', 'url')
    fieldsets = (
        (None, {
            'fields': ('title', 'content_type')
        }),
        ('Video Details (Type: Video)', {
            'classes': ('content-type-section', 'content-type-video'),
            'fields': ('video_file',),
        }),
        ('Website Details (Type: Website)', {
            'classes': ('content-type-section', 'content-type-website'),
            'fields': ('url', 'duration'),
        }),
    )

    class Media:
        # Add CSS and JS for dynamic field visibility
        css = {
            'all': ('admin/css/content_item_admin.css',)
        }
        js = ('admin/js/content_item_admin.js',)


    # --- Permission Overrides ---
    # ContentItems are global, but actions might be restricted based on usage.
    # Simplest approach: Allow users with basic ContentItem permissions (add/change/delete)
    # to manage *all* ContentItems, but they can only *assign* them to groups they manage (handled in DisplayGroupAdmin).
    # More complex: Only allow editing/deleting items if they are part of a group the user manages.

    def get_queryset(self, request):
        """Show all items to users with permission, or implement stricter filtering if needed."""
        # Basic: If user has model-level permission, show all.
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs

        # Stricter (Optional): Show only items used in groups the user manages.
        # managed_group_ids = DisplayGroup.objects.filter(managers=request.user).values_list('id', flat=True)
        # used_content_ids = PlaylistEntry.objects.filter(group_id__in=managed_group_ids).values_list('content_item_id', flat=True).distinct()
        # return qs.filter(id__in=used_content_ids)

        # Let's stick to simpler model-level permission for now, as content is potentially reusable.
        return qs

    def has_change_permission(self, request, obj=None):
        """Allow change if user has model permission. Add object-level check if needed."""
        has_perm = super().has_change_permission(request, obj)
        if not has_perm:
             return False
        if request.user.is_superuser:
             return True

        # Stricter (Optional): Check if item is used in a managed group.
        # if obj is not None:
        #     managed_group_ids = DisplayGroup.objects.filter(managers=request.user).values_list('id', flat=True)
        #     return PlaylistEntry.objects.filter(content_item=obj, group_id__in=managed_group_ids).exists()
        # return True # Allow access to list/add views if model perm exists

        return True # Assume basic model permission is sufficient

    def has_delete_permission(self, request, obj=None):
        """Allow delete if user has model permission. Add object-level check if needed (be careful!)."""
        # Deleting a ContentItem removes it from ALL groups. This might be too powerful.
        # Often better to only allow superusers to delete ContentItems directly.
        # Non-admins should remove items from their group's playlist via PlaylistEntry.
        if request.user.is_superuser:
             return True # Superusers can always delete

        # Restrict deletion for non-superusers?
        # Option 1: Never allow non-superusers to delete ContentItems directly
        # return False

        # Option 2: Allow if they have model perm (might be dangerous if content is shared)
        has_perm = super().has_delete_permission(request, obj)
        return has_perm and False # Example: Disable direct deletion for non-superusers

    # Ensure non-superusers *can* add content if they have the permission
    def has_add_permission(self, request):
        return super().has_add_permission(request)
