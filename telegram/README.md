# Google-IO Telegram Bot

A small Telegram bot built with `python-telegram-bot` that can:

- inspect uploaded images, PDFs, videos, audio, and other files
- answer normal text messages with Gemini
- call arbitrary HTTP APIs, including FastAPI backends

## Commands

- `/start` — intro message
- `/help` — usage help
- `/callapi` — call an external API

Example:

```text
/callapi POST https://example.com/api {"hello":"world"}
```

## Local setup

1. Put your Telegram bot token into `.env`.
2. Create a virtual environment.
3. Install dependencies from `requirements.txt`.
4. Run `python main.py`.

## File handling

- Images, PDFs, videos, and audio are uploaded to Gemini using the official Files API.
- Text files are read directly.
- If a file cannot be processed normally, the bot falls back to a binary preview.
