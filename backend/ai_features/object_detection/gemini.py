
import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel, Field

from .main import PROMPT, BaseObjectDetection

load_dotenv()

class GeminiObjectDetection(BaseObjectDetection):
    def __init__(self, model_path: str, api_key: str, api_url: str | None = None):
        super().__init__(model_path, api_key, api_url)

    def detect_objects(self, image):
        return analyze_image_to_json_objects(image_path=image, api_key=self.api_key, model=self.model_path)

class DetectedObject(BaseModel):
    name: str = Field(description="Name or designation of the object")
    quantity: int = Field(description="Number of instances of the object")
    description: str = Field(description="Color, texture, or important characteristics")
    icon: str = Field(description="A small icon or emoji representing the object")

class ImageAnalysisResult(BaseModel):
    objects: list[DetectedObject] = Field(description="A list of all objects found in the image")

def analyze_image_to_json_objects(image_path: str, api_key: str | None = None, model: str = 'gemini-3.5-flash-lite'):
    if not os.path.exists(image_path):
        print(f"Error: The file '{image_path}' was not found.")
        return
    
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        print("Error: GEMINI_API_KEY not found.")
        return

    client = genai.Client()

    try:
        pil_image = Image.open(image_path)
    except Exception as e:
        print(f"Error loading image: {e}")
        return

    prompt = PROMPT

    try:
        response = client.models.generate_content(
            model=model,
            contents=[pil_image, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ImageAnalysisResult,
                temperature=0.1
            ),
        )

        print("\n--- JSON Result ---")
        print(response.text)

        data = json.loads(response.text)
        print("\nNumber of objects found:", len(data.get("objects", [])))

    except Exception as e:
        print(f"An error occurred during the API request: {e}")

if __name__ == "__main__":
    image_file = "toolbox.png" 
    if not os.path.exists(image_file):
        img = Image.new('RGB', (300, 300), color = 'blue')
        img.save(image_file)

    analyze_image_to_json_objects(image_file)