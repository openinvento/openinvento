import os
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from inventory.jobs.date_field_sync import sync_all_date_field_notifications
from inventory.jobs.low_stock_sync import sync_all_low_stock_notifications

from openinvento.daily_scheduler import DailyScheduler
from openinvento.jobs.update_check import check_for_updates


class Command(BaseCommand):
    help = "Run registered daily jobs at their configured local times."

    def parse_schedule_time(self, env_name):
        value = os.environ.get(env_name, "00:00")
        try:
            return datetime.strptime(value, "%H:%M").time()
        except ValueError as exc:
            raise CommandError(f"{env_name} must use 24-hour HH:MM format.") from exc

    def handle(self, *args, **options):
        scheduler = DailyScheduler()
        date_field_time = self.parse_schedule_time("DATE_FIELD_NOTIFICATION_TIME")
        low_stock_time = self.parse_schedule_time("LOW_STOCK_NOTIFICATION_TIME")

        # Register date field notifications sync task
        scheduler.register_daily_job(
            "date field notifications",
            sync_all_date_field_notifications,
            date_field_time,
        )

        # Register low stock notifications sync task
        scheduler.register_daily_job(
            "low stock notifications",
            sync_all_low_stock_notifications,
            low_stock_time,
        )

        check_updates = os.environ.get("ENABLE_UPDATE_CHECKER", "true").lower() in {
            "1", "true", "yes", "on",
        }
        if check_updates:
            # Register update check task
            update_check_time = self.parse_schedule_time("UPDATE_CHECK_TIME")
            scheduler.register_daily_job(
                "OpenInvento update check",
                check_for_updates,
                update_check_time,
            )

        schedule = ", ".join(
            f"{job['name']} at {job['run_at'].strftime('%H:%M')}"
            for job in scheduler.jobs
        )
        self.stdout.write(f"Running daily jobs in local time: {schedule}.")
        scheduler.run_forever()
