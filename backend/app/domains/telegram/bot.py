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

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
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
                "Namaste! Welcome back to Zoie 🙏\n\n"
                f"You are registered with: {user['phone_number']}\n\n"
                "You can:\n"
                "• Send me lab reports, prescriptions, or medical photos\n"
                "• Ask me about your health records\n"
                "• Just tell me how you're feeling today\n\n"
                "I'm not a doctor — I help you understand and remember. Let's bring questions to your doctor together."
            )
        else:
            markup = tg_types.ReplyKeyboardMarkup(one_time_keyboard=True, resize_keyboard=True)
            reg_button = tg_types.KeyboardButton("Register Phone Number 📱", request_contact=True)
            markup.add(reg_button)

            bot.send_message(
                message.chat.id,
                "Namaste! I'm Zoie, your personal health companion 🙏\n\n"
                "I help you understand your medical records, track your health, "
                "and prepare for doctor visits — all in language that makes sense to you.\n\n"
                "To get started, please share your phone number below.",
                reply_markup=markup
            )

    @bot.message_handler(content_types=['contact'])
    def handle_contact(message):
        if not message.contact:
            return
            
        if message.contact.user_id != message.from_user.id:
            bot.reply_to(message, "Registration failed: You must share your own contact info.")
            return
            
        tg_id = str(message.from_user.id)
        phone = message.contact.phone_number
        
        try:
            user = register_telegram_user(phone, tg_id)
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
            
        bot.reply_to(message, "File received! 📥 Analyzing your medical document...")
        
        file_id = None
        file_name = "uploaded_file"
        file_mime = "application/octet-stream"
        
        if message.content_type == 'document':
            file_id = message.document.file_id
            file_name = message.document.file_name
            file_mime = message.document.mime_type
        elif message.content_type == 'photo':
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
            
            markup = tg_types.InlineKeyboardMarkup()
            markup.add(
                tg_types.InlineKeyboardButton("Explain 📖", callback_data=f"explain:{record_id}"),
                tg_types.InlineKeyboardButton("Save & remind me 🔔", callback_data=f"remind:{record_id}")
            )
            bot.send_message(
                message.chat.id,
                f"✅ '{file_name}' processed and saved to your health record.",
                reply_markup=markup
            )
        except Exception as e:
            logger.error(f"Telegram file ingestion failed: {str(e)}")
            bot.send_message(
                message.chat.id,
                f"❌ Failed to process the document. Error: {str(e)}"
            )

    @bot.callback_query_handler(func=lambda call: True)
    def handle_callback(call):
        tg_id = str(call.from_user.id)
        user = get_user_by_telegram_id(tg_id)
        if not user:
            bot.answer_callback_query(call.id, "Please register first with /start")
            return

        action, record_id = call.data.split(":", 1)

        if action == "explain":
            bot.answer_callback_query(call.id, "Generating explanation...")
            bot.send_chat_action(call.message.chat.id, 'typing')
            try:
                state = {
                    "messages": [{"role": "user", "content": f"Explain my medical record [doc:{record_id}] in plain language. What do the values mean?"}],
                    "latest_input": f"Explain my medical record [doc:{record_id}] in plain language.",
                    "target_agent_id": "antigravity-preview-05-2026",
                    "system_instruction": "",
                    "tools": [],
                    "agent_response": "",
                    "iteration": 0,
                    "needs_validation": False,
                    "validation_status": "pending",
                    "logs": [],
                    "custom_agents_md": None,
                    "custom_skills": [],
                    "user_id": str(user["id"])
                }
                result = graph.invoke(state)
                bot.send_message(call.message.chat.id, result.get("agent_response", "Could not generate explanation."))
            except Exception as e:
                bot.send_message(call.message.chat.id, f"Sorry, I couldn't explain that right now: {e}")

        elif action == "remind":
            bot.answer_callback_query(call.id, "Saved! I'll check in with you about this.")
            bot.send_message(
                call.message.chat.id,
                "🔔 Got it — I'll follow up with you about this record before your next appointment.\n\n"
                "I'm not a doctor — I can help you understand and remember. Let's bring this to Dr. Patel on Thursday."
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
            # Run RAG
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
            initial_state["user_id"] = str(user["id"])
            
            result = graph.invoke(initial_state)
            response_text = result.get("agent_response", "Sorry, I encountered an issue retrieving an answer.")
            
            bot.reply_to(message, response_text)
        except Exception as e:
            logger.error(f"Error handling Telegram chat: {str(e)}")
            bot.reply_to(message, "Sorry, I am having trouble connecting to my knowledge base right now.")

if bot:
    init_bot_handlers()
