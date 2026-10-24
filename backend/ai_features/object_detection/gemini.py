
import json
import os
from enum import Enum

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel, Field

from .main import LUCIDE_ARTICLE_ICONS, PROMPT, BaseObjectDetection

load_dotenv()

class GeminiObjectDetection(BaseObjectDetection):
    def __init__(self, model_path: str, api_key: str, api_url: str | None = None):
        super().__init__(model_path, api_key, api_url)

    def load_model(self):
        api_key = self.api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required for Gemini image analysis.")
        self.api_key = api_key
        return genai.Client(api_key=api_key)

    def detect_objects(self, image):
        return analyze_image_to_json_objects(
            image_path=image,
            api_key=self.api_key,
            model=self.model_path,
            client=self.model,
        )

LucideArticleIcon = Enum(
    "LucideArticleIcon",
    {icon_name: icon_name for icon_name in LUCIDE_ARTICLE_ICONS},
    type=str,
)


class DetectedObject(BaseModel):
    name: str = Field(description="Name or designation of the object")
    quantity: int = Field(description="Number of instances of the object")
    description: str = Field(description="Color, texture, or important characteristics")
    icon: LucideArticleIcon = Field(description="Choose the Lucide icon that best represents the object. Return one of the listed icon names, never an emoji.")

class ImageAnalysisResult(BaseModel):
    objects: list[DetectedObject] = Field(description="A list of all objects found in the image")

def analyze_image_to_json_objects(image_path: str, api_key: str | None = None, model: str = 'gemini-3.5-flash-lite', client=None):
    if not os.path.exists(image_path):
        print(f"Error: The file '{image_path}' was not found.")
        return
    
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        print("Error: GEMINI_API_KEY not found.")
        return

    client = client or genai.Client(api_key=api_key)

    try:
        with Image.open(image_path) as pil_image:
            response = client.models.generate_content(
                model=model,
                contents=[pil_image, PROMPT],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ImageAnalysisResult,
                    temperature=0.1
                ),
            )
            return json.loads(response.text)
    except Exception as e:
        raise RuntimeError(f"Gemini image analysis failed: {e}") from e

if __name__ == "__main__":
    image_file = "toolbox.png" 
    if not os.path.exists(image_file):
        img = Image.new('RGB', (300, 300), color = 'blue')
        img.save(image_file)

    analyze_image_to_json_objects(image_file)
