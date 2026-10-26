import base64
import json

import requests
from django.conf import settings
from PIL import Image

from .main import LUCIDE_ARTICLE_ICONS, PROMPT, BaseObjectDetection


def _image_as_base64(image_path: str) -> str:
    with Image.open(image_path) as image:
        image = image.convert("RGB")
        from io import BytesIO

        buffer = BytesIO()
        image.save(buffer, format="JPEG")
        return base64.b64encode(buffer.getvalue()).decode("ascii")


class OllamaObjectDetection(BaseObjectDetection):
    def __init__(self, model_path: str, api_key: str = "", api_url: str | None = None):
        super().__init__(model_path, api_key, api_url)

    def load_model(self):
        return settings.OLLAMA_API_URL

    def detect_objects(self, image_path: str):
        icon_names = ", ".join(LUCIDE_ARTICLE_ICONS)
        schema = {
            "type": "object",
            "properties": {
                "objects": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "quantity": {"type": "integer"},
                            "description": {"type": "string"},
                            "icon": {"type": "string", "enum": list(LUCIDE_ARTICLE_ICONS)},
                        },
                        "required": ["name", "quantity", "description", "icon"],
                    },
                }
            },
            "required": ["objects"],
        }
        prompt = f"{PROMPT} Return only JSON matching the supplied schema. Choose icon from: {icon_names}."
        try:
            response = requests.post(
                f"{self.model.rstrip('/')}/api/chat",
                json={
                    "model": self.model_path,
                    "messages": [{"role": "user", "content": prompt, "images": [_image_as_base64(image_path)]}],
                    "format": schema,
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
                headers={"Authorization": f"Bearer {self.api_key}"} if self.api_key else {},
                timeout=180,
                allow_redirects=False,
            )
            if 300 <= response.status_code < 400:
                raise RuntimeError("Ollama server returned a redirect, which is not allowed.")
            response.raise_for_status()
            content = response.json()["message"]["content"]
            result = json.loads(content)
            if not isinstance(result, dict) or not isinstance(result.get("objects"), list):
                raise ValueError("Ollama returned an invalid object list.")
            return result
        except Exception as error:
            raise RuntimeError(f"Ollama image analysis failed: {error}") from error
