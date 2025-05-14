"""
URL configuration for kioskmanager project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.shortcuts import redirect
from django.conf.urls.i18n import i18n_patterns
from . import views

admin.site.site_header = "Kiosk Manager Admin"
admin.site.site_title = "Kiosk Manager Admin Portal"
admin.site.index_title = "Welcome to Kiosk Manager Portal"

urlpatterns = [
    path('play/', views.video_player_view, name='video_player'),
    path('api/playlist/', views.get_playlist_api, name='get_playlist_api'),
    # Optional: redirect root URL to the player
    path('', lambda request: redirect('admin/', permanent=False)),
    path('favicon.ico', lambda _ : redirect('static/img/kioskmanager.ico', permanent=True)),
    path("i18n/", include("django.conf.urls.i18n")),
    path('healthz/', include('health_check.urls')),
] + i18n_patterns(
        path("admin/", admin.site.urls),
    ) + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.OIDC_ENABLED:
    urlpatterns.append(path('oidc/', include('mozilla_django_oidc.urls')))
