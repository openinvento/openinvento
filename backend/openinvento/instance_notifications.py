"""Create instance-wide notifications for OpenInvento releases."""

import logging
import os
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as package_version

from account_auth.models import CustomUser
from account_auth.services import create_notification

from .version_fetching import VersionFetcher

logger = logging.getLogger(__name__)


def get_current_version():
    version = os.environ.get("APP_VERSION")
    if version:
        return version.strip()
    try:
        return package_version("openinvento")
    except PackageNotFoundError:
        return "0.1.0"


def create_update_notifications():
    """Check GitHub for a newer release and notify every instance admin once."""
    current_version = get_current_version()
    try:
        release = VersionFetcher(current_version=current_version).fetch_latest_release()
    except Exception:
        logger.exception("Could not check for OpenInvento updates")
        return []

    if not release or not release.get("tag_name"):
        return []

    latest_version = release["tag_name"]
    if not release.get("newer_version_available"):
        return []

    release_name = release.get("name") or latest_version
    title = f"OpenInvento update available: {release_name}"
    notifications = []
    admins = CustomUser.objects.filter(is_superuser=True).iterator()
    for admin in admins:
        notifications.append(create_notification(
            admin,
            kind="update_available",
            title=title,
            message=f"OpenInvento {latest_version} is available.",
            link="/app/settings?tab=admin",
            metadata={
                "current_version": current_version,
                "latest_version": latest_version,
                "published_at": release.get("published_at"),
                "release_url": release.get("html_url"),
            },
            source_key=f"openinvento-release:{latest_version}",
        ))
    return notifications
