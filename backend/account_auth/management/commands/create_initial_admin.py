""" Automatically create the initial administrator when the database has no users. """
""" This command has to be triggered after initial start (e.g. in the docker entrypoint) """

import os

from account_auth.models import CustomUser
from account_auth.services import create_user_inventory
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


def env_flag(name, default=True):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


class Command(BaseCommand):
    help = 'Create the initial administrator when the database has no users.'

    def handle(self, *args, **options):
        if not env_flag('CREATE_INIT_ADMIN'):
            self.stdout.write('Initial administrator creation is disabled.')
            return

        username = os.getenv('INIT_ADMIN_USERNAME')
        password = os.getenv('INIT_ADMIN_PASSWORD')
        if not username or not password:
            raise CommandError(
                'INIT_ADMIN_USERNAME and INIT_ADMIN_PASSWORD must be set when CREATE_INIT_ADMIN is enabled.'
            )

        with transaction.atomic():
            if CustomUser.objects.exists():
                self.stdout.write('Users already exist; no initial administrator was created.')
                return

            user = CustomUser.objects.create_superuser(
                username=username,
                password=password,
                name=username,
                require_reset=True,
            )
            create_user_inventory(user)

        self.stdout.write(self.style.SUCCESS(f'Created initial administrator "{user.username}".'))