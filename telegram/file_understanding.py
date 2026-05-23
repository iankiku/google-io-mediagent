from __future__ import annotations

import base64
import mimetypes
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

from google import genai

MAX_TEXT_CHARS = 120_000
MAX_BINARY_PREVIEW_BYTES = 8_192
MEDIA_TEXT_MAX_OUTPUT_TOKENS = 4_096
CHAT_TEXT_MAX_OUTPUT_TOKENS = 2_048
DEFAULT_GEMMA_MODEL = "gemma-4-26b-a4b-it"
MODEL_ALIASES = {
    "gemma-4": DEFAULT_GEMMA_MODEL,
}
PREFERRED_MODELS = [
    "gemma-4-26b-a4b-it",
    "gemma-4-31b-it",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]

TEXT_SUFFIXES = {
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".yaml",
    ".yml",
    ".ini",
    ".toml",
    ".py",
    ".js",
    ".ts",
    ".html",
    ".css",
    ".xml",
    ".log",
}


def detect_mime_type(file_path: str, explicit_mime: str | None = None) -> str:
    if explicit_mime:
        return explicit_mime

    guessed, _ = mimetypes.guess_type(file_path)
    if guessed:
        return guessed

    suffix = Path(file_path).suffix.lower()
    if suffix == ".json":
        return "application/json"
    if suffix == ".csv":
        return "text/csv"
    if suffix in {".md", ".txt", ".log", ".yaml", ".yml", ".ini", ".toml"}:
        return "text/plain"
    return "application/octet-stream"


def read_text_file(path: Path) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="replace")


def extract_pdf_text(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except Exception:
        return ""

    reader = PdfReader(str(path))
    pages: list[str] = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    return "\n".join(page_text for page_text in pages if page_text).strip()


def is_text_like(mime_type: str, suffix: str) -> bool:
    return mime_type.startswith("text/") or suffix in TEXT_SUFFIXES or mime_type in {
        "application/json",
        "application/xml",
        "application/yaml",
        "application/x-yaml",
        "application/csv",
    }


def make_text_prompt(text: str, filename: str | None = None) -> str:
    intro = (
        "You are a helpful Telegram assistant. Answer the user directly and naturally. "
        "Keep it concise unless the user asks for more detail."
    )
    if filename:
        return f"{intro}\n\nUser message attached to {filename}:\n{text}"
    return f"{intro}\n\nUser message:\n{text}"


def media_prompt(filename: str, mime_type: str, caption: str | None = None) -> str:
    base = (
        "You are verifying a user-uploaded file inside a Telegram bot. "
        "Give a clear, accurate, and not-too-short understanding of what the file is, what it contains, "
        "any notable details, and whether it looks valid or suspicious. "
        "If the file is a document, summarize the important points and preserve structure when useful. "
        "If the file is an image or video, describe the visible content and any text you can infer. "
        "If the file is audio, summarize or transcribe what you can."
    )
    parts = [base, f"Filename: {filename}.", f"MIME type: {mime_type}."]
    if caption and caption.strip():
        parts.append(f"User caption or instruction: {caption.strip()}")
    return "\n".join(parts)


def binary_preview(path: Path, mime_type: str, filename: str) -> str:
    raw = path.read_bytes()[:MAX_BINARY_PREVIEW_BYTES]
    preview = base64.b64encode(raw).decode("utf-8")
    return (
        f"Binary fallback for {filename}.\n"
        f"mime={mime_type}\n"
        f"size={path.stat().st_size} bytes\n"
        f"Base64 preview of first {len(raw)} bytes:\n{preview}"
    )


@lru_cache(maxsize=8)
def list_generate_content_models(api_key: str) -> list[str]:
    client = genai.Client(api_key=api_key)
    models = []
    for model in client.models.list():
        name = str(getattr(model, "name", ""))
        supported = (
            getattr(model, "supported_generation_methods", None)
            or getattr(model, "supportedGenerationMethods", None)
            or getattr(model, "supported_actions", None)
            or getattr(model, "supportedActions", None)
            or []
        )
        if "generateContent" in supported and name:
            models.append(name.removeprefix("models/"))
    return models


def resolve_model(api_key: str, requested_model: str) -> str:
    requested_model = MODEL_ALIASES.get(requested_model, requested_model)
    available = set(list_generate_content_models(api_key))
    if requested_model in available:
        return requested_model

    for candidate in [requested_model, *PREFERRED_MODELS]:
        if candidate in available:
            return candidate

    if available:
        return sorted(available)[0]

    raise RuntimeError(
        "No Gemini models with generateContent support were returned by the official models.list endpoint."
    )


def wait_for_file_ready(client: genai.Client, file_obj: Any, timeout_seconds: int = 120) -> Any:
    file_name = getattr(file_obj, "name", None)
    if not file_name:
        return file_obj

    deadline = time.monotonic() + timeout_seconds
    current = file_obj
    while True:
        state = str(getattr(current, "state", "")).upper()
        if "ACTIVE" in state:
            return current
        if "FAILED" in state:
            raise RuntimeError(f"Gemini file processing failed for {file_name}: {current}")
        if time.monotonic() >= deadline:
            raise RuntimeError(f"Timed out waiting for Gemini to finish processing {file_name}.")
        time.sleep(1.5)
        current = client.files.get(name=file_name)


def build_generation_config(system_instruction: str, max_output_tokens: int) -> dict[str, Any]:
    return {
        "system_instruction": system_instruction,
        "temperature": 0.2,
        "top_p": 0.95,
        "max_output_tokens": max_output_tokens,
    }


def call_gemini_text(api_key: str, model: str, user_text: str, system_instruction: str) -> str:
    client = genai.Client(api_key=api_key)
    resolved_model = resolve_model(api_key, model)
    response = client.models.generate_content(
        model=resolved_model,
        contents=user_text,
        config=build_generation_config(system_instruction, CHAT_TEXT_MAX_OUTPUT_TOKENS),
    )
    text = getattr(response, "text", "") or ""
    return text.strip() or "Gemini returned an empty response."


def call_gemini_media(api_key: str, model: str, file_path: str, mime_type: str, filename: str, caption: str | None = None) -> str:
    path = Path(file_path)
    client = genai.Client(api_key=api_key)
    resolved_model = resolve_model(api_key, model)
    file_obj = None

    try:
        file_obj = client.files.upload(file=str(path))
        file_obj = wait_for_file_ready(client, file_obj)

        response = client.models.generate_content(
            model=resolved_model,
            contents=[file_obj, media_prompt(filename=filename, mime_type=mime_type, caption=caption)],
            config=build_generation_config(
                system_instruction=(
                    "You are a careful file-analysis assistant. "
                    "Be precise, helpful, and do not invent details not present in the file."
                ),
                max_output_tokens=MEDIA_TEXT_MAX_OUTPUT_TOKENS,
            ),
        )
        text = getattr(response, "text", "") or ""
        if text.strip():
            return text.strip()
        raise RuntimeError("Gemini returned an empty response for the uploaded file.")
    except Exception:
        if mime_type == "application/pdf" or path.suffix.lower() == ".pdf":
            try:
                pdf_text = extract_pdf_text(path)
                if pdf_text:
                    response = client.models.generate_content(
                        model=resolved_model,
                        contents=[
                            media_prompt(filename=filename, mime_type=mime_type, caption=caption),
                            pdf_text[:MAX_TEXT_CHARS],
                        ],
                        config=build_generation_config(
                            system_instruction=(
                                "You are a careful file-analysis assistant. "
                                "The main PDF upload path failed, so analyze the extracted PDF text carefully."
                            ),
                            max_output_tokens=MEDIA_TEXT_MAX_OUTPUT_TOKENS,
                        ),
                    )
                    text = getattr(response, "text", "") or ""
                    if text.strip():
                        return text.strip()
            except Exception:
                pass

        if is_text_like(mime_type, path.suffix.lower()):
            try:
                preview_text = read_text_file(path)
                response = client.models.generate_content(
                    model=resolved_model,
                    contents=[
                        binary_preview(path, mime_type, filename),
                        preview_text[:MAX_TEXT_CHARS],
                    ],
                    config=build_generation_config(
                        system_instruction=(
                            "You are a careful file-analysis assistant. "
                            "The main file upload path failed, so analyze the provided text or preview carefully."
                        ),
                        max_output_tokens=MEDIA_TEXT_MAX_OUTPUT_TOKENS,
                    ),
                )
                text = getattr(response, "text", "") or ""
                if text.strip():
                    return text.strip()
            except Exception:
                pass

        preview = binary_preview(path, mime_type, filename)
        response = client.models.generate_content(
            model=resolved_model,
            contents=[preview],
            config=build_generation_config(
                system_instruction=(
                    "You are a careful file-analysis assistant. "
                    "Analyze the binary preview and be explicit about uncertainty."
                ),
                max_output_tokens=MEDIA_TEXT_MAX_OUTPUT_TOKENS,
            ),
        )
        text = getattr(response, "text", "") or ""
        return text.strip() or "Gemini returned an empty response for the file preview."
    finally:
        if file_obj is not None:
            file_name = getattr(file_obj, "name", None)
            if file_name:
                try:
                    client.files.delete(name=file_name)
                except Exception:
                    pass


def understand_uploaded_file(
    file_path: str,
    api_key: str,
    model: str = DEFAULT_GEMMA_MODEL,
    filename: str | None = None,
    mime_type: str | None = None,
    caption: str | None = None,
) -> str:
    path = Path(file_path)
    filename = filename or path.name
    detected_mime = detect_mime_type(file_path, mime_type)
    suffix = path.suffix.lower()

    if is_text_like(detected_mime, suffix):
        text = read_text_file(path)[:MAX_TEXT_CHARS]
        if detected_mime == "application/pdf" or suffix == ".pdf":
            extracted_text = extract_pdf_text(path)
            if extracted_text:
                text = extracted_text[:MAX_TEXT_CHARS]
        prompt = make_text_prompt(text, filename=filename)
        return call_gemini_text(
            api_key=api_key,
            model=model,
            user_text=prompt,
            system_instruction=(
                "You are a helpful Telegram assistant. "
                "Summarize documents clearly, preserve important details, and answer directly."
            ),
        )

    return call_gemini_media(
        api_key=api_key,
        model=model,
        file_path=str(path),
        mime_type=detected_mime,
        filename=filename,
        caption=caption,
    )


def understand_user_text(
    user_text: str,
    api_key: str,
    model: str = DEFAULT_GEMMA_MODEL,
) -> str:
    return call_gemini_text(
        api_key=api_key,
        model=model,
        user_text=text,
        system_instruction=(
            "You are a helpful Telegram assistant. "
            "Reply naturally, answer the user directly, and keep responses concise unless asked for detail."
        ),
    )
