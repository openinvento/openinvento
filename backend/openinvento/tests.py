import io
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime, time, timedelta, timezone as datetime_timezone
from pathlib import Path
from unittest.mock import patch

from django.db import connection
from django.test import Client, SimpleTestCase, TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from account_auth.models import CustomUser

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


class InstanceBackupTests(TransactionTestCase):
	def setUp(self):
		self.data_dir = Path(tempfile.mkdtemp())
		self.addCleanup(shutil.rmtree, self.data_dir)
		self.admin = CustomUser.objects.create_superuser(username="admin", password="StrongPassword!123")
		self.client = APIClient()
		self.client.force_login(self.admin)

	def download(self):
		with override_settings(DATA_DIR=self.data_dir):
			response = self.client.get("/api/instance-settings/backup/")
		self.assertEqual(response.status_code, 200)
		return zipfile.ZipFile(io.BytesIO(b"".join(response.streaming_content)))

	def read_database(self, archive):
		with tempfile.TemporaryDirectory() as temp_dir:
			path = Path(temp_dir) / "db.sqlite3"
			path.write_bytes(archive.read("db.sqlite3"))
			database = sqlite3.connect(path)
			try:
				integrity = database.execute("PRAGMA integrity_check").fetchone()[0]
				usernames = [row[0] for row in database.execute("SELECT username FROM account_auth_customuser")]
			finally:
				database.close()
		return integrity, usernames

	def test_contains_a_consistent_copy_of_the_database(self):
		integrity, usernames = self.read_database(self.download())

		self.assertEqual(integrity, "ok")
		self.assertIn("admin", usernames)

	def test_contains_the_other_files_of_the_data_directory(self):
		(self.data_dir / "media").mkdir()
		(self.data_dir / "media" / "photo.jpg").write_bytes(b"jpeg")
		(self.data_dir / "outside.txt").symlink_to(__file__)

		names = self.download().namelist()

		self.assertIn("media/photo.jpg", names)
		self.assertNotIn("outside.txt", names)

	def test_live_database_files_are_replaced_by_the_copy(self):
		# A database in the data directory, as in a default installation, with a leftover sidecar file.
		live_database = self.data_dir / "db.sqlite3"
		database = sqlite3.connect(live_database)
		database.execute("CREATE TABLE account_auth_customuser (username TEXT)")
		database.execute("INSERT INTO account_auth_customuser VALUES ('live')")
		database.commit()
		database.close()
		(self.data_dir / "db.sqlite3-wal").write_bytes(b"wal")
		with patch.dict(connection.settings_dict, {"NAME": str(live_database)}):
			archive = self.download()

		self.assertEqual(archive.namelist().count("db.sqlite3"), 1)
		self.assertNotIn("db.sqlite3-wal", archive.namelist())
		self.assertEqual(self.read_database(archive), ("ok", ["live"]))

	def test_copy_has_the_committed_state_while_another_connection_writes(self):
		live_database = self.data_dir / "db.sqlite3"
		writer = sqlite3.connect(live_database)
		self.addCleanup(writer.close)
		writer.execute("CREATE TABLE account_auth_customuser (username TEXT)")
		writer.execute("INSERT INTO account_auth_customuser VALUES ('committed')")
		writer.commit()
		writer.execute("INSERT INTO account_auth_customuser VALUES ('uncommitted')")
		with patch.dict(connection.settings_dict, {"NAME": str(live_database)}):
			archive = self.download()

		self.assertEqual(self.read_database(archive), ("ok", ["committed"]))

	def test_only_instance_admins_can_download_it(self):
		member = CustomUser.objects.create_user(username="member", password="StrongPassword!123")
		self.client.force_login(member)

		with override_settings(DATA_DIR=self.data_dir):
			response = self.client.get("/api/instance-settings/backup/")

		self.assertEqual(response.status_code, 403)
