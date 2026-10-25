"""Provider configurations supported by the application."""

PROVIDER_CONFIGURATIONS = (
    {
        "provider": "gemini",
        "type": "object_detection_llm",
        "display_name": "Google Gemini",
        "type_label": "Object detection LLM",
        "requires_api_key": True,
        "requires_model": True,
        "default_model": "gemini-3.5-flash-lite",
    },
    {
        "provider": "ollama",
        "type": "object_detection_llm",
        "display_name": "Ollama",
        "type_label": "Object detection LLM",
        "requires_api_key": False,
        "requires_model": True,
        "requires_api_url": True,
    },
    {
        "provider": "ollama",
        "type": "llm",
        "display_name": "Ollama",
        "type_label": "LLM",
        "requires_api_key": False,
        "requires_model": True,
        "requires_api_url": True,
    },
    {
        "provider": "gemini",
        "type": "llm",
        "display_name": "Google Gemini",
        "type_label": "LLM",
        "requires_api_key": True,
        "requires_model": True,
        "default_model": "gemini-3.5-flash-lite",
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
