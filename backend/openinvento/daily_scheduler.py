import logging
import time
from datetime import datetime, timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)


class DailyScheduler:
    """Run each registered job daily at its configured local wall-clock time."""

    def __init__(self):
        self.jobs = []

    def register_daily_job(self, name, job, run_at):
        self.jobs.append({
            "name": name,
            "job": job,
            "run_at": run_at,
            "last_run_date": None,
        })

    def _scheduled_time(self, local_date, run_at):
        return datetime.combine(
            local_date,
            run_at,
            tzinfo=timezone.get_current_timezone(),
        )

    def _run_due_jobs(self, now):
        for job in self.jobs:
            if job["last_run_date"] == now.date():
                continue
            scheduled = self._scheduled_time(now.date(), job["run_at"])
            if scheduled > now:
                continue

            job["last_run_date"] = now.date()
            try:
                logger.info("Running daily job: %s", job["name"])
                job["job"]()
            except Exception:
                logger.exception("Daily job failed: %s", job["name"])

    def _seconds_until_next_job(self, now):
        next_times = []
        for job in self.jobs:
            run_date = now.date()
            if job["last_run_date"] == run_date:
                run_date += timedelta(days=1)
            scheduled = self._scheduled_time(run_date, job["run_at"])
            if scheduled <= now:
                scheduled = self._scheduled_time(run_date + timedelta(days=1), job["run_at"])
            next_times.append(scheduled.timestamp())

        if not next_times:
            return 3600
        return max(1, min(next_times) - timezone.now().timestamp())

    def run_forever(self):
        while True:
            now = timezone.localtime()
            self._run_due_jobs(now)
            now = timezone.localtime()
            time.sleep(self._seconds_until_next_job(now))
