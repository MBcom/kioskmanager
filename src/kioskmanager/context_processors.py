from django.conf import settings

def oidc_settings_processor(request):
    return {
        'OIDC_ENABLED': getattr(settings, 'OIDC_ENABLED', False),
        # You can add other OIDC related settings you might want in templates
        # For example, the OIDC provider name for the login button label.
        'OIDC_PROVIDER_NAME': getattr(settings, 'OIDC_PROVIDER_NAME', 'SSO'),
    }