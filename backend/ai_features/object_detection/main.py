


PROMPT = "Analyze this photo and capture all recognizable objects with their properties and positions."

class BaseObjectDetection:
    def __init__(self, model_path: str, api_key: str, api_url: str | None = None):
        self.model_path = model_path
        self.api_key = api_key
        self.api_url = api_url
        self.model = self.load_model()

    def load_model(self):
        raise NotImplementedError("Subclasses should implement this method.")

    def detect_objects(self, image):
        raise NotImplementedError("Subclasses should implement this method.")


# General function - used in the backend
def analyze_image_to_json_objects(ai_provider, image_path: str, api_key: str | None = None, model: str | None = None):
    if ai_provider == "gemini":
        from .gemini import GeminiObjectDetection
        return GeminiObjectDetection(model_path=model, api_key=api_key).detect_objects(image_path)