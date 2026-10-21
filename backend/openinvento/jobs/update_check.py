from openinvento.instance_notifications import create_update_notifications


def check_for_updates():
    """Create update notifications when a newer release is available."""
    create_update_notifications()
