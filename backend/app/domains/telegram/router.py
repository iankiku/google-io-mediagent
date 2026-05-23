import threading
import logging
from fastapi import APIRouter
from app.domains.telegram.bot import bot

router = APIRouter(prefix="/api/telegram", tags=["Telegram Bot"])
logger = logging.getLogger("health_assistant.telegram.router")

# Track the polling thread
polling_thread = None

def start_bot_polling():
    """
    Launches the Telegram Bot long-polling in a background thread.
    """
    global polling_thread
    if not bot:
        logger.warning("Bot not initialized. Polling cannot be started.")
        return
        
    if polling_thread and polling_thread.is_alive():
        logger.info("Bot polling thread is already running.")
        return

    def run_polling():
        logger.info("Starting Telegram Bot polling loop...")
        try:
            bot.infinity_polling(timeout=20, long_polling_timeout=10)
        except Exception as e:
            logger.error(f"Error in Telegram Bot polling: {str(e)}")

    polling_thread = threading.Thread(target=run_polling, daemon=True)
    polling_thread.start()
    logger.info("Telegram Bot polling thread started.")

@router.get("/status")
def get_bot_status():
    """
    Checks if the Telegram Bot token is configured and if the polling thread is active.
    """
    is_configured = bot is not None
    is_running = polling_thread is not None and polling_thread.is_alive()
    
    return {
        "bot_configured": is_configured,
        "bot_running": is_running,
        "status": "active" if is_running else "inactive"
    }
