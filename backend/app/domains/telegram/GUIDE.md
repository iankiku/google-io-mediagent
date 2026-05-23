# Google-IO / telegram-bot

This folder is a starter Telegram bot project inspired by python-telegram-bot.

## Folder map

- `main.py` — Telegram bot entrypoint
- `file_understanding.py` — uploaded-file extraction + Gemini understanding helper
- `api_client.py` — generic external API caller for FastAPI or any HTTP backend
- `config.py` — loads environment variables
- `.env` — local secrets/config
- `requirements.txt` — Python dependencies

## What it does

1. Accepts uploaded files from Telegram and sends them through a helper that:
   - detects file type
   - extracts text when possible
   - base64-encodes images or binary previews when appropriate
   - sends the result to Gemini for a readable understanding

2. Lets the bot call external APIs, including a friend's FastAPI backend, through the `/callapi` command.

## Run sequence

1. Add your Telegram bot token to `.env`.
2. Install dependencies:
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
3. Start the bot:
   - `python main.py`

## Notes

- The Gemini API key is already written into `.env` from the details you provided.
- Telegram still needs a bot token before the bot can connect.
- The upload handler is designed to be easy to extend for more file-specific logic later.
