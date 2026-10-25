from .models import ThirdPartyProvider


def get_inventory_provider_api_key(inventory_uuid, provider=None, provider_type=None):
    if not provider:
        configured_provider = (
            ThirdPartyProvider.objects.filter(inventory__uuid=inventory_uuid, type=provider_type)
            .order_by("-updated_at")
            .first()
        )
    else:
        # If a provider string like "gemini" is provided, we filter by that specific provider
        configured_provider = (
            ThirdPartyProvider.objects.filter(inventory__uuid=inventory_uuid, provider=provider, type=provider_type)
            .order_by("-updated_at")
            .first()
        )
    
    if configured_provider:
        return (configured_provider.provider, configured_provider.api_key)
        
    return (None, None)
