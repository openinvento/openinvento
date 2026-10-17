import logging
import os
import time

from django.core.management.base import BaseCommand

from openinvento.instance_notifications import create_update_notifications

logger = logging.getLogger(__name__)


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
