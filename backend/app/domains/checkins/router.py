import logging
from fastapi import APIRouter, HTTPException

from app.domains.checkins.services import force_trigger

router = APIRouter(prefix="/api/checkins", tags=["Check-ins"])
logger = logging.getLogger("health_assistant.checkins.router")


@router.post("/force_trigger")
async def trigger_checkin(user_id: str):
    """
    Force-triggers a proactive check-in message for the given user.
    Composes a Hindi-English message using Gemini 2.5 Flash based on recent check-in data.
    If Telegram bot is available, also sends via Telegram.
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id query parameter is required.")

    message = force_trigger(user_id)

    # Attempt to send via Telegram if bot is available
    telegram_sent = False
    try:
        from app.domains.telegram.bot import bot
        from app.domains.telegram.services import get_user_by_telegram_id
        from app.core.db import get_db_connection

        if bot:
            conn = get_db_connection()
            cur = conn.cursor()
            try:
                cur.execute("SELECT telegram_id FROM users WHERE id = %s::uuid;", (user_id,))
                user = cur.fetchone()
                if user and user.get("telegram_id"):
                    try:
                        bot.send_message(user["telegram_id"], message)
                        telegram_sent = True
                        logger.info(f"Sent force_trigger message to Telegram user {user['telegram_id']}")
                    except Exception as tg_err:
                        logger.warning(f"Telegram send failed: {tg_err}")
            finally:
                cur.close()
                conn.close()
    except ImportError:
        logger.info("Telegram bot not available, skipping Telegram delivery.")

    return {
        "user_id": user_id,
        "message": message,
        "telegram_sent": telegram_sent
    }
