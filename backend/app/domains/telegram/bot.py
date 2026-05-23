import os
import logging
import uuid
import telebot
from telebot import types as tg_types
from app.domains.telegram.services import register_telegram_user, get_user_by_telegram_id
from app.domains.ingestion.services import ingest_medical_record
from app.core.storage import upload_file
from app.domains.orchestration.graph import graph

logger = logging.getLogger("health_assistant.telegram.bot")

# Get bot token from environment
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# Global bot instance
bot = None

if BOT_TOKEN:
    try:
        bot = telebot.TeleBot(BOT_TOKEN, threaded=True)
        logger.info("Telegram Bot initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Telegram Bot: {str(e)}")
else:
    logger.warning("TELEGRAM_BOT_TOKEN not set. Telegram Bot will not run.")

def init_bot_handlers():
    """
    Registers event handlers for the Telegram Bot.
    """
    if not bot:
        return
        
    @bot.message_handler(commands=['start', 'help'])
    def send_welcome(message):
        tg_id = str(message.from_user.id)
        user = get_user_by_telegram_id(tg_id)
        
        if user:
            bot.reply_to(
                message,
                f"Welcome back to Health Assistant! 🏥\n\n"
                f"You are registered with phone number: {user['phone_number']}.\n"
                f"You can send me medical documents (PDFs), notes, or photos of prescriptions/scans, "
                f"or simply ask me health-related questions."
            )
        else:
            # Onboarding: Request phone number contact sharing
            markup = tg_types.ReplyKeyboardMarkup(one_time_keyboard=True, resize_keyboard=True)
            reg_button = tg_types.KeyboardButton("Register Phone Number 📱", request_contact=True)
            markup.add(reg_button)
            
            bot.send_message(
                message.chat.id,
                "Welcome to Health Assistant! 🏥\n\n"
                "To get started, we need to register your account using your phone number. "
                "Please click the button below to share your contact securely.",
                reply_markup=markup
            )

    @bot.message_handler(content_types=['contact'])
    def handle_contact(message):
        if not message.contact:
            return
            
        tg_id = str(message.from_user.id)
        phone = message.contact.phone_number
        
        try:
            user = register_telegram_user(phone, tg_id)
            # Remove keyboard markup
            markup = tg_types.ReplyKeyboardRemove()
            bot.send_message(
                message.chat.id,
                f"Registration successful! 🎉\n\n"
                f"Your account is linked to phone number: {user['phone_number']}.\n"
                f"You can now upload medical reports or start a chat.",
                reply_markup=markup
            )
        except Exception as e:
            bot.reply_to(message, f"Sorry, registration failed. Please try again. Error: {str(e)}")

    @bot.message_handler(content_types=['document', 'photo'])
    def handle_medical_file(message):
        tg_id = str(message.from_user.id)
        user = get_user_by_telegram_id(tg_id)
        
        if not user:
            bot.reply_to(message, "Please register first by typing /start.")
            return
            
        bot.reply_to(message, "File received! 📥 Analyzing medical content via MedGemma...")
        
        file_id = None
        file_name = "uploaded_file"
        file_mime = "application/octet-stream"
        
        if message.content_type == 'document':
            file_id = message.document.file_id
            file_name = message.document.file_name
            file_mime = message.document.mime_type
        elif message.content_type == 'photo':
            # Get largest photo size
            file_id = message.photo[-1].file_id
            file_name = f"photo_{file_id[:8]}.jpg"
            file_mime = "image/jpeg"
            
        if not file_id:
            bot.reply_to(message, "Failed to retrieve the file identifier.")
            return
            
        try:
            file_info = bot.get_file(file_id)
            downloaded_file = bot.download_file(file_info.file_path)

            safe_filename = f"{uuid.uuid4()}{os.path.splitext(file_name)[1]}"
            save_path = upload_file(downloaded_file, safe_filename, file_mime)

            record_id = ingest_medical_record(
                user_id=str(user["id"]),
                file_name=file_name,
                file_bytes=downloaded_file,
                file_type=file_mime,
                file_save_path=save_path
            )
            
            bot.send_message(
                message.chat.id,
                f"Success! ✅ '{file_name}' has been processed and indexed into your private medical folder."
            )
        except Exception as e:
            logger.error(f"Telegram file ingestion failed: {str(e)}")
            bot.send_message(
                message.chat.id,
                f"❌ Failed to process the document. Error: {str(e)}"
            )

    @bot.message_handler(func=lambda message: True)
    def handle_chat_message(message):
        tg_id = str(message.from_user.id)
        user = get_user_by_telegram_id(tg_id)
        
        if not user:
            bot.reply_to(message, "Please register first by typing /start.")
            return
            
        bot.send_chat_action(message.chat.id, 'typing')
        
        try:
            # Invoke RAG orchestration via LangGraph
            # We pass the user_id context to retrieve private medical history
            initial_state = {
                "messages": [{"role": "user", "content": message.text}],
                "latest_input": message.text,
                "target_agent_id": "antigravity-preview-05-2026",
                "system_instruction": "",
                "tools": [],
                "agent_response": "",
                "iteration": 0,
                "needs_validation": False,
                "validation_status": "pending",
                "logs": ["[Graph] Telegram query initiated."],
                "custom_agents_md": None,
                "custom_skills": []
            }
            # We inject user_id context directly into the initial state so the graph retrieves private data
            initial_state["user_id"] = str(user["id"])
            
            result = graph.invoke(initial_state)
            response_text = result.get("agent_response", "Sorry, I encountered an issue retrieving an answer.")
            
            bot.reply_to(message, response_text)
        except Exception as e:
            logger.error(f"Error handling Telegram chat: {str(e)}")
            bot.reply_to(message, "Sorry, I am having trouble connecting to my knowledge base right now.")

# Register handlers immediately
if bot:
    init_bot_handlers()
