from __future__ import annotations

from dataclasses import dataclass
import os

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    telegram_bot_token: str
    gemini_api_key: str
    gemini_model: str
    external_api_timeout: int
    max_upload_bytes: int


settings = Settings(
    telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", "").strip(),
    gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
    gemini_model=os.getenv("GEMINI_MODEL", "gemma-4-26b-a4b-it").strip(),
    external_api_timeout=int(os.getenv("EXTERNAL_API_TIMEOUT", "30")),
    max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", "20000000")),
)


def require_settings() -> None:
    missing = []
    if not settings.telegram_bot_token:
        missing.append("TELEGRAM_BOT_TOKEN")
    if not settings.gemini_api_key:
        missing.append("GEMINI_API_KEY")
    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
        )
