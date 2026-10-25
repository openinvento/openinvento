from .models import ThirdPartyProvider


def get_inventory_provider_api_key(inventory_uuid, provider=None, provider_type=None):
    if not provider:
        # use first provider with the given type
        provider = ThirdPartyProvider.objects.filter(inventory__uuid=inventory_uuid, type=provider_type).order_by("-updated_at").first()
    configured_provider = (
        ThirdPartyProvider.objects.filter(inventory__uuid=inventory_uuid, provider=provider, type=provider_type)
        .order_by("-updated_at")
        .first()
    )
    return configured_provider.api_key if configured_provider else None
