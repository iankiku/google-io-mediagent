import os
from dotenv import load_dotenv
from google import genai

# Load environment variables from .env if present
load_dotenv()

# Verify that the Gemini API Key is present
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize the GenAI Client
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = genai.Client()

# Base model configurations
DEFAULT_BASE_AGENT = "antigravity-preview-05-2026"
