from datetime import datetime, time, timedelta, timezone as datetime_timezone

from django.test import Client, SimpleTestCase, TestCase
from django.utils import timezone

from .daily_scheduler import DailyScheduler


class DailySchedulerTests(SimpleTestCase):
	@timezone.override("UTC")
	def test_runs_job_once_when_due_and_again_on_next_day(self):
		runs = []
		scheduler = DailyScheduler()
		scheduler.register_daily_job("date reminders", lambda: runs.append("run"), time(9, 0))
		first_day_before_due = datetime(2026, 10, 20, 8, 59, tzinfo=datetime_timezone.utc)
		first_day_due = datetime(2026, 10, 20, 9, 0, tzinfo=datetime_timezone.utc)
		first_day_later = datetime(2026, 10, 20, 12, 0, tzinfo=datetime_timezone.utc)
		next_day_due = datetime(2026, 10, 21, 9, 0, tzinfo=datetime_timezone.utc)

		scheduler._run_due_jobs(first_day_before_due)
		self.assertEqual(runs, [])

		scheduler._run_due_jobs(first_day_due)
		scheduler._run_due_jobs(first_day_later)
		self.assertEqual(runs, ["run"])

		scheduler._run_due_jobs(next_day_due)
		self.assertEqual(runs, ["run", "run"])

	@timezone.override("UTC")
	def test_seconds_until_next_job_uses_supplied_scheduler_time(self):
		scheduler = DailyScheduler()
		scheduler.register_daily_job("date reminders", lambda: None, time(13, 0))
		now = datetime(2026, 10, 20, 12, 0, tzinfo=datetime_timezone.utc)

		self.assertEqual(scheduler._seconds_until_next_job(now), 3600)

		scheduler.jobs[0]["last_run_date"] = now.date()
		self.assertEqual(
			scheduler._seconds_until_next_job(now),
			int(timedelta(days=1, hours=1).total_seconds()),
		)


class HealthViewTests(TestCase):
	def test_answers_without_login(self):
		response = Client().get("/api/health")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {"status": "healthy"})
