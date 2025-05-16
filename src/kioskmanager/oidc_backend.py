from mozilla_django_oidc.auth import OIDCAuthenticationBackend
from django.conf import settings
from django.contrib.auth.models import Group

class OIDCBackend(OIDCAuthenticationBackend):
    def create_user(self, claims):
        user = super(OIDCBackend, self).create_user(claims)

        return self.setUser(claims, user)

    def update_user(self, user, claims):
        return self.setUser(claims, user)

    def setUser(self, claims, user):
        user.first_name = claims.get(getattr(settings, 'OIDC_CLAIM_FIRST_NAME', 'given_name'), '')
        user.last_name = claims.get(getattr(settings, 'OIDC_CLAIM_LAST_NAME', 'family_name'), '')
        user.is_staff = True

        OIDC_SUPERUSER_CLAIM_NAME = getattr(settings, 'OIDC_SUPERUSER_CLAIM_NAME', False)
        OIDC_SUPERUSER_CLAIM_VALUE = getattr(settings, 'OIDC_SUPERUSER_CLAIM_VALUE', False)
        if OIDC_SUPERUSER_CLAIM_NAME and OIDC_SUPERUSER_CLAIM_VALUE:
            user.is_superuser = claims.get(OIDC_SUPERUSER_CLAIM_NAME, '') == OIDC_SUPERUSER_CLAIM_VALUE
        user.save()

        # Update groups
        self.updateGroups(user, claims)

        return user

    def updateGroups(self, user, claims):
        OIDC_GROUPS_CLAIM_NAME = getattr(settings, 'OIDC_GROUPS_CLAIM_NAME', False)
        if OIDC_GROUPS_CLAIM_NAME:
            groups = claims.get(OIDC_GROUPS_CLAIM_NAME, [])
            user.groups.clear()
            for group_name in groups:
                if getattr(settings, 'OIDC_RP_DJANGO_GROUPS_SYNC_ENABLED', False):
                    group, created = Group.objects.get_or_create(name=group_name)
                user.groups.add(group)

        OIDC_ASSIGN_CONTENT_MANAGER = getattr(settings, 'OIDC_ASSIGN_CONTENT_MANAGER', False)
        if OIDC_ASSIGN_CONTENT_MANAGER:
            group, created = Group.objects.get_or_create(name='Content Managers')
            user.groups.add(group)