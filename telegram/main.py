from __future__ import annotations

import asyncio
import hashlib
import json
import re
import shlex
import tempfile
from pathlib import Path
from typing import Any

from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, MessageHandler, filters

from api_client import ApiCallError, call_api
from config import require_settings, settings
from file_understanding import understand_uploaded_file, understand_user_text

HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
TEMP_DIR = Path(tempfile.gettempdir()) / "google_io_telegram_bot_uploads"
TEMP_DIR.mkdir(parents=True, exist_ok=True)


def split_message(text: str, limit: int = 4000) -> list[str]:
    text = text.strip()
    if len(text) <= limit:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + limit, len(text))
        if end < len(text):
            newline = text.rfind("\n", start, end)
            if newline > start + 500:
                end = newline + 1
        chunks.append(text[start:end].strip())
        start = end
    return [chunk for chunk in chunks if chunk]


async def reply_long(update: Update, text: str) -> None:
    message = update.effective_message
    if message is None:
        return
    for chunk in split_message(text):
        await message.reply_text(chunk)


def extract_attachment(message) -> tuple[str, str, str] | None:
    if message.photo:
        photo = message.photo[-1]
        return photo.file_id, f"photo_{photo.file_unique_id}.jpg", "image/jpeg"

    if message.document:
        document = message.document
        return (
            document.file_id,
            document.file_name or f"document_{document.file_unique_id}",
            document.mime_type or "application/octet-stream",
        )

    if message.video:
        video = message.video
        return (
            video.file_id,
            video.file_name or f"video_{video.file_unique_id}.mp4",
            video.mime_type or "video/mp4",
        )

    if message.audio:
        audio = message.audio
        return (
            audio.file_id,
            audio.file_name or f"audio_{audio.file_unique_id}.mp3",
            audio.mime_type or "audio/mpeg",
        )

    if message.voice:
        voice = message.voice
        return (
            voice.file_id,
            f"voice_{voice.file_unique_id}.ogg",
            voice.mime_type or "audio/ogg",
        )

    if message.animation:
        animation = message.animation
        return (
            animation.file_id,
            animation.file_name or f"animation_{animation.file_unique_id}.mp4",
            animation.mime_type or "video/mp4",
        )

    return None


def parse_callapi_args(raw_args: str) -> tuple[str, str, Any]:
    tokens = shlex.split(raw_args)
    if not tokens:
        raise ValueError("No arguments supplied.")

    method = "GET"
    url_index = 0

    if tokens[0].upper() in HTTP_METHODS and len(tokens) >= 2 and re.match(r"^https?://", tokens[1], re.IGNORECASE):
        method = tokens[0].upper()
        url_index = 1

    url = tokens[url_index]
    body_text = " ".join(tokens[url_index + 1 :]).strip()
    if not body_text:
        return method, url, None

    try:
        return method, url, json.loads(body_text)
    except json.JSONDecodeError:
        return method, url, body_text


def format_api_result(result: dict[str, Any]) -> str:
    body = result.get("body")
    if isinstance(body, (dict, list)):
        body_text = json.dumps(body, indent=2, ensure_ascii=False)
    else:
        body_text = str(body)

    return (
        f"HTTP {result.get('status_code')} {result.get('reason')}\n"
        f"URL: {result.get('url')}\n"
        f"Content-Type: {result.get('content_type')}\n\n"
        f"{body_text}"
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await reply_long(
        update,
        "Hi. Send me a file and I’ll inspect it with Gemini, or send normal text and I’ll answer. You can also use /callapi to hit an external API.",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await reply_long(
        update,
        "Commands:\n"
        "/start - intro\n"
        "/help - this help\n"
        "/callapi [METHOD] URL [JSON-or-raw-body]\n\n"
        "Examples:\n"
        "/callapi https://example.com/status\n"
        "/callapi POST https://example.com/api {\"name\":\"Ada\"}\n\n"
        "You can also send images, PDFs, videos, audio, documents, and normal text directly.",
    )


async def callapi_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if message is None:
        return

    raw_args = message.text.partition(" ")[2].strip()
    if not raw_args:
        await message.reply_text("Usage: /callapi [METHOD] URL [JSON-or-raw-body]")
        return

    try:
        method, url, body = parse_callapi_args(raw_args)
    except ValueError as exc:
        await message.reply_text(f"Could not parse command: {exc}")
        return

    await context.bot.send_chat_action(chat_id=message.chat_id, action=ChatAction.TYPING)
    try:
        result = await asyncio.to_thread(
            call_api,
            url,
            method,
            body,
            None,
            None,
            settings.external_api_timeout,
        )
    except ApiCallError as exc:
        await message.reply_text(f"API call failed: {exc}")
        return
    except Exception as exc:
        await message.reply_text(f"Unexpected API error: {exc}")
        return

    await reply_long(update, format_api_result(result))


async def handle_upload(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if message is None:
        return

    attachment = extract_attachment(message)
    if attachment is None:
        return

    file_id, filename, mime_type = attachment
    await context.bot.send_chat_action(chat_id=message.chat_id, action=ChatAction.TYPING)

    telegram_file = await context.bot.get_file(file_id)
    suffix = Path(filename).suffix or ".bin"
    local_stem = hashlib.sha256(file_id.encode("utf-8")).hexdigest()[:16]
    local_path = TEMP_DIR / f"{local_stem}{suffix}"

    await telegram_file.download_to_drive(custom_path=str(local_path))

    try:
        analysis = await asyncio.to_thread(
            understand_uploaded_file,
            str(local_path),
            settings.gemini_api_key,
            settings.gemini_model,
            filename,
            mime_type,
            message.caption,
        )
        await reply_long(
            update,
            f"Received {filename} ({mime_type}).\n\nGemini says:\n{analysis}",
        )
    finally:
        try:
            local_path.unlink(missing_ok=True)
        except Exception:
            pass


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if message is None or not message.text:
        return

    user_text = message.text.strip()
    if not user_text:
        return

    await context.bot.send_chat_action(chat_id=message.chat_id, action=ChatAction.TYPING)
    try:
        response = await asyncio.to_thread(
            understand_user_text,
            user_text,
            settings.gemini_api_key,
            settings.gemini_model,
        )
    except Exception as exc:
        await message.reply_text(f"LLM error: {exc}")
        return

    await reply_long(update, response)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    print(f"Telegram bot error: {context.error}")


def main() -> None:
    require_settings()

    application = ApplicationBuilder().token(settings.telegram_bot_token).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("callapi", callapi_command))
    application.add_handler(
        MessageHandler(
            filters.Document.ALL
            | filters.PHOTO
            | filters.VIDEO
            | filters.AUDIO
            | filters.VOICE
            | filters.ANIMATION,
            handle_upload,
        )
    )
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    application.add_error_handler(error_handler)

    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
