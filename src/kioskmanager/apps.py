from django.apps import AppConfig
from django.db.utils import OperationalError, ProgrammingError
import os
import logging

# Get a logger instance
logger = logging.getLogger(__name__)

class KioskmanagerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'kioskmanager'

    def ready(self):
        """
        This method is called when Django starts.
        We use it to ensure the admin user and required groups/permissions exist.
        """
        # Prevent execution during manage.py commands that don't need app setup yet
        # or when tables might not exist (e.g., during migrations).
        # A common check is related to running the actual server process,
        # but a simple try-except for database errors is often sufficient here.
        try:
            self.setup_defaults()
        except (OperationalError, ProgrammingError) as e:
            # This commonly happens during the first migration run when tables don't exist yet.
            # Log the situation and proceed; the setup will run on the next proper startup.
            logger.warning(f"Database tables might not exist yet ({e}). Skipping default setup.")
        except Exception as e:
            # Catch other potential errors during setup
            logger.error(f"An unexpected error occurred during default setup: {e}", exc_info=True)


    def setup_defaults(self):
        """
        Contains the logic to create the group and admin user.
        Separated for clarity and testability.
        """
        # Import models only when needed, inside the methods,
        # to avoid AppRegistryNotReady errors in some scenarios.
        from django.contrib.auth.models import Group, Permission
        from django.contrib.contenttypes.models import ContentType
        # Use AUTH_USER_MODEL for flexibility
        from django.contrib.auth import get_user_model
        User = get_user_model()

        logger.info("Running default setup: Ensuring 'Content Managers' group and admin user...")

        # === Setup 'Content Managers' Group ===
        group_name = "Content Managers"
        # Define permissions needed for this group (app_label, model_codename)
        # Use the model's _meta.app_label and _meta.model_name for accuracy
        # Ensure these models are defined within the 'kioskmanager' app or adjust app_label accordingly.
        try:
            from .models import DisplayGroup, PlaylistEntry, ContentItem # Import here

            permissions_codenames = [
                ('change_displaygroup', DisplayGroup), # To edit groups they manage (incl. playlist)
                ('view_displaygroup', DisplayGroup),   # To see groups they manage in admin lists
                ('add_playlistentry', PlaylistEntry),
                ('change_playlistentry', PlaylistEntry),
                ('delete_playlistentry', PlaylistEntry),
                ('view_playlistentry', PlaylistEntry), # Needed for inline display
                ('add_contentitem', ContentItem),
                ('change_contentitem', ContentItem),
                ('view_contentitem', ContentItem),
                # ('delete_contentitem', ContentItem), # Decide if they can delete shared content
            ]

            group, created = Group.objects.get_or_create(name=group_name)
            if created:
                logger.info(f"Created group '{group_name}'.")

            target_permissions = []
            for codename, model_cls in permissions_codenames:
                try:
                    # Find the content type for the model
                    content_type = ContentType.objects.get_for_model(model_cls)
                    # Get the permission object
                    permission = Permission.objects.get(content_type=content_type, codename=codename)
                    target_permissions.append(permission)
                except ContentType.DoesNotExist:
                     logger.warning(f"ContentType for model {model_cls.__name__} not found. Skipping permission '{codename}'. Was makemigrations run?")
                except Permission.DoesNotExist:
                    logger.warning(f"Permission '{codename}' for model {model_cls.__name__} not found. Skipping. Was makemigrations run?")

            if target_permissions:
                 group.permissions.set(target_permissions)
                 logger.info(f"Set/updated permissions for group '{group_name}'.")

        except ImportError:
             logger.error("Could not import models from .models in apps.py. Ensure models are defined.")
             # Cannot proceed with group permission setup if models aren't importable
             pass # Allow admin user setup to proceed if possible


        # === Setup Admin User ===
        admin_username = os.environ.get('ADMIN_USERNAME', 'admin')
        admin_password = os.environ.get('ADMIN_PASSWORD')

        if not admin_password:
            logger.warning("ADMIN_PASSWORD environment variable not set. Cannot create/update admin user.")
            return # Stop if password is not set

        try:
            user, created = User.objects.get_or_create(
                username=admin_username,
                defaults={ # Fields to set only if creating the user
                     'is_staff': True,
                     'is_superuser': True
                     }
            )

            if created:
                logger.info(f"Created admin user '{admin_username}'.")
                user.set_password(admin_password)
                user.save()
                logger.info(f"Set initial password for admin user '{admin_username}'.")
            else:
                # If user already exists, ensure flags are set and update password
                # This ensures the password always matches the environment variable
                needs_save = False
                if not user.is_staff:
                    user.is_staff = True
                    needs_save = True
                if not user.is_superuser:
                    user.is_superuser = True
                    needs_save = True

                # Check if the current password hash matches the env var password.
                # This avoids unnecessary saves/password resets if it hasn't changed.
                if not user.check_password(admin_password):
                    user.set_password(admin_password)
                    needs_save = True
                    logger.info(f"Password for admin user '{admin_username}' updated from environment variable.")
                elif not created and not needs_save:
                     logger.debug(f"Admin user '{admin_username}' already exists with correct flags and password.")


                if needs_save:
                    user.save()
                    logger.info(f"Updated flags/password for admin user '{admin_username}'.")

        except Exception as e:
            logger.error(f"Error creating/updating admin user '{admin_username}': {e}", exc_info=True)