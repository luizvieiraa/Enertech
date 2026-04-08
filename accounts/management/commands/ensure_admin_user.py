import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Creates or updates an admin user from environment variables."

    def handle(self, *args, **options):
        username = os.getenv("ADMIN_USERNAME")
        email = os.getenv("ADMIN_EMAIL")
        password = os.getenv("ADMIN_PASSWORD")

        if not username or not email or not password:
            self.stdout.write(
                self.style.WARNING(
                    "Skipping admin bootstrap: set ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD."
                )
            )
            return

        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "is_staff": True,
                "is_superuser": True,
            },
        )

        updated = False

        if user.email != email:
            user.email = email
            updated = True

        if not user.is_staff:
            user.is_staff = True
            updated = True

        if not user.is_superuser:
            user.is_superuser = True
            updated = True

        if created or not user.check_password(password):
            user.set_password(password)
            updated = True

        if created or updated:
            user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Admin user '{username}' created."))
        elif updated:
            self.stdout.write(self.style.SUCCESS(f"Admin user '{username}' updated."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Admin user '{username}' already up to date."))
