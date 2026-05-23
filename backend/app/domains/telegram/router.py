import os
import threading
import logging
import telebot
from telebot.apihelper import ApiTelegramException
from fastapi import APIRouter
from app.domains.telegram.bot import bot

router = APIRouter(prefix="/api/telegram", tags=["Telegram Bot"])
logger = logging.getLogger("health_assistant.telegram.router")

polling_thread: threading.Thread | None = None
polling_disabled_reason: str | None = None


def _is_conflict_error(exc: BaseException) -> bool:
    text = str(exc)
    return (
        "Error code: 409" in text
        or "terminated by other getUpdates request" in text
        or "Conflict:" in text
    )


def _preflight_check() -> tuple[bool, str | None]:
    """
    Synchronously verify we can poll before spawning a thread.

    Returns (ok, reason). When ok is False, callers must NOT start polling, and
    `reason` contains a short human-readable explanation.
    """
    try:
        # offset=-1 and timeout=0 returns immediately; 409 still surfaces if
        # another instance is already polling this token.
        bot.get_updates(offset=-1, timeout=0, long_polling_timeout=0)
        return True, None
    except ApiTelegramException as exc:
        if _is_conflict_error(exc):
            return False, (
                "Another Telegram bot instance is already polling this token "
                "(409 Conflict). Skipping polling in this backend process."
            )
        return False, f"Telegram preflight failed: {exc}"
    except Exception as exc:
        return False, f"Telegram preflight failed: {exc}"


def start_bot_polling() -> None:
    """
    Launches the Telegram Bot long-polling in a background thread, but only if a
    preflight check confirms no other bot instance is already polling.

    Opt-out via env: TELEGRAM_DISABLE_POLLING=1.
    """
    global polling_thread, polling_disabled_reason

    if os.getenv("TELEGRAM_DISABLE_POLLING", "").lower() in {"1", "true", "yes"}:
        polling_disabled_reason = "TELEGRAM_DISABLE_POLLING is set."
        logger.info("Telegram polling skipped: TELEGRAM_DISABLE_POLLING is set.")
        return

    if not bot:
        polling_disabled_reason = "Bot not initialized (missing TELEGRAM_BOT_TOKEN?)."
        logger.warning("Bot not initialized. Polling cannot be started.")
        return

    if polling_thread and polling_thread.is_alive():
        logger.info("Bot polling thread is already running.")
        return

    ok, reason = _preflight_check()
    if not ok:
        polling_disabled_reason = reason
        logger.warning(reason)
        return

    # Silence telebot's internal ERROR-level traceback dumps; we already report
    # errors ourselves and we never want a polling 409 to spam stderr again.
    telebot.logger.setLevel(logging.CRITICAL)

    def run_polling() -> None:
        global polling_disabled_reason
        logger.info("Starting Telegram Bot polling loop...")
        try:
            # non_stop=False -> first network/API error stops the loop cleanly
            # instead of silently retrying forever.
            bot.polling(
                non_stop=False,
                timeout=20,
                long_polling_timeout=10,
                skip_pending=True,
            )
            logger.info("Telegram Bot polling loop exited cleanly.")
        except ApiTelegramException as e:
            if _is_conflict_error(e):
                polling_disabled_reason = (
                    "Another Telegram bot instance started polling after we did "
                    "(409 Conflict). Stopping polling in this process."
                )
                logger.warning(polling_disabled_reason)
                return
            polling_disabled_reason = f"Telegram polling error: {e}"
            logger.error(polling_disabled_reason)
        except Exception as e:
            polling_disabled_reason = f"Error in Telegram Bot polling: {e}"
            logger.error(polling_disabled_reason)

    polling_thread = threading.Thread(target=run_polling, daemon=True)
    polling_thread.start()
    logger.info("Telegram Bot polling thread started.")


@router.get("/status")
def get_bot_status() -> dict:
    """Checks if the Telegram Bot token is configured and if polling is active."""
    is_configured = bot is not None
    is_running = polling_thread is not None and polling_thread.is_alive()

    return {
        "bot_configured": is_configured,
        "bot_running": is_running,
        "status": "active" if is_running else "inactive",
        "disabled_reason": polling_disabled_reason,
    }
