""" Communicate with the Github Release API to fetch the latest version of OpenInvento. """
""" Used for notifications and the release API in the instance settings. """

import requests

owner = "openinvento"
repo = "openinvento"

url = f"https://api.github.com/repos/{owner}/{repo}/releases"

class VersionFetcher:
    def __init__(self, current_version=None):
        self.latest_release = None
        self.current_version = current_version

    def fetch_latest_release(self):
        """Fetch the latest release from the GitHub API."""
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # Throws an error if the request failed
        releases = response.json()

        if not releases:
            return None

        latest_release = releases[0]
        print(f"Latest Release Name: {latest_release.get('name')}")
        if self._normalize_version(latest_release.get("tag_name")) == self._normalize_version(self.current_version):
            print("You are already on the latest version.")
            return {
                "tag_name": latest_release.get("tag_name"),
                "name": latest_release.get("name"),
                "newer_version_available": False,
            }
        return {
            "tag_name": latest_release.get("tag_name"),
            "name": latest_release.get("name"),
            "body": latest_release.get("body"),
            "published_at": latest_release.get("published_at"),
            "html_url": latest_release.get("html_url"),
            "newer_version_available": True,
        }

    def fetch_changelog_since_version(self):
        """Fetch the changelog since a specific version."""
        version = self.current_version
        if not version:
            raise ValueError("Current version must be set to fetch changelog.")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        releases = response.json()

        changelog = []
        for release in releases:
            if self._normalize_version(release.get("tag_name")) == self._normalize_version(version):
                break
            changelog.append({
                "tag_name": release.get("tag_name"),
                "name": release.get("name"),
                "body": release.get("body"),
                "published_at": release.get("published_at"),
                "html_url": release.get("html_url"),
            })
        print(f"Changelog since version {version}: {changelog}")
        return changelog

    @staticmethod
    def _normalize_version(version):
        return version.strip().lstrip("vV") if version else ""


fetcher = VersionFetcher()
#fetcher.fetch_latest_release()
#fetcher.fetch_changelog_since_version("v1.1.0")
