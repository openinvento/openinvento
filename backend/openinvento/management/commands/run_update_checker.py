import logging
import os
import time

from django.core.management.base import BaseCommand

from openinvento.instance_notifications import create_update_notifications

logger = logging.getLogger(__name__)

# This command is called on startup - for example by the docker entrypoint (for docker installations)
# Run it manually with `python manage.py run_update_checker` to check for updates in a loop and notify instance admins.

class Command(BaseCommand):
    help = "Periodically check for OpenInvento releases and notify instance admins."

    def handle(self, *args, **options):
        try:
            interval = max(60, int(os.environ.get("UPDATE_CHECK_INTERVAL_SECONDS", "86400")))
        except ValueError:
            interval = 86400

        self.stdout.write(f"Checking for OpenInvento updates every {interval} seconds.")
        while True:
            try:
                create_update_notifications()
            except Exception:
                logger.exception("Unexpected error during the OpenInvento update check")
            time.sleep(interval)
