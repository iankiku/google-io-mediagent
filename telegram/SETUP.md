# Telegram Bot Setup Guide

This guide shows how to turn this project into a real Telegram bot you can talk to.

## 1) Create the bot in Telegram

1. Open Telegram and message `@BotFather`.
2. Send `/newbot`.
3. Follow the prompts:
   - choose a display name
   - choose a username ending in `bot`
4. BotFather will give you a bot token.

That token is required for this project.

## 2) Put the token into `.env`

Open:

`/Users/gobus/Desktop/main/projects/Google-IO/telegram-bot/.env`

Add or replace:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemma-4-26b-a4b-it
EXTERNAL_API_TIMEOUT=30
MAX_UPLOAD_BYTES=20000000
```

If you already have the Gemini key in there, just add the Telegram token.

## 3) Install dependencies

From the project folder:

```bash
cd /Users/gobus/Desktop/main/projects/Google-IO/telegram-bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 4) Start the bot

Run:

```bash
python main.py
```

If the token is valid, the bot will connect using Telegram polling.

## 5) Start talking to it

1. Open Telegram.
2. Search for your bot by its username.
3. Press Start.
4. Send it:
   - an image
   - a PDF
   - a document
   - an audio or video file

The bot will download the upload, inspect it, send it to Gemini, and reply with an understanding of the file.

## 6) Call external APIs from the bot

Use the `/callapi` command in Telegram.

Examples:

```text
/callapi https://example.com/api/status
```

```text
/callapi POST https://example.com/api {"name":"Ada","role":"tester"}
```

If your friend hosts a FastAPI server, point the command at their URL.

## 7) Common problems

### Bot says it cannot connect
- Make sure `TELEGRAM_BOT_TOKEN` is correct.
- Make sure `python main.py` is still running.
- Make sure the bot was started in Telegram with `/start`.

### File upload fails
- Check that the file is not too large.
- Check that the bot has permission to receive messages from you.
- For PDFs, the bot tries text extraction first.

### Gemini errors
- Make sure `GEMINI_API_KEY` is set.
- Make sure the model name is valid.
- If needed, try a different Gemini model in `.env`.

## 8) What this bot currently does

- receives uploaded files
- extracts or encodes the file contents
- sends the result to Gemini for interpretation
- replies back in Telegram
- calls external HTTP APIs on command

## 9) Next upgrades you might want

- webhook deployment instead of polling
- file summaries stored in a database
- per-user memory
- better command parsing
- FastAPI tool integrations with auth headers
- inline buttons for common API calls
