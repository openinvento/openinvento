"""Provider configurations supported by the application."""

PROVIDER_CONFIGURATIONS = (
    {
        "provider": "gemini",
        "type": "object_detection_llm",
        "display_name": "Google Gemini",
        "type_label": "Object detection LLM",
        "requires_api_key": True,
    },
    {
        "provider": "gemini",
        "type": "llm",
        "display_name": "Google Gemini",
        "type_label": "LLM",
        "requires_api_key": True,
    },
    {
        "provider": "openfoodfacts",
        "type": "barcode_lookup",
        "display_name": "Open Food Facts",
        "type_label": "Barcode lookup",
        "requires_api_key": False,
    },
)


def get_provider_configuration(provider, provider_type):
    return next(
        (item for item in PROVIDER_CONFIGURATIONS
         if item["provider"] == provider and item["type"] == provider_type),
        None,
    )
