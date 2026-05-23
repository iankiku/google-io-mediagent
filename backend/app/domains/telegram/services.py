import logging
from app.core.db import get_db_connection

logger = logging.getLogger("health_assistant.telegram.services")

def get_user_by_telegram_id(telegram_id: str) -> dict:
    """
    Fetches user record from DB by Telegram ID.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, phone_number, telegram_id FROM users WHERE telegram_id = %s;", (str(telegram_id),))
        return cur.fetchone()
    except Exception as e:
        logger.error(f"Error fetching user by telegram_id: {str(e)}")
        return None
    finally:
        cur.close()
        conn.close()

def get_user_by_phone(phone_number: str) -> dict:
    """
    Fetches user record from DB by phone number.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, phone_number, telegram_id FROM users WHERE phone_number = %s;", (phone_number,))
        return cur.fetchone()
    except Exception as e:
        logger.error(f"Error fetching user by phone_number: {str(e)}")
        return None
    finally:
        cur.close()
        conn.close()

def register_telegram_user(phone_number: str, telegram_id: str) -> dict:
    """
    Registers or updates a user in the database.
    If a user exists with this phone number, updates their telegram_id.
    If a user exists with this telegram_id, returns it.
    Otherwise, creates a new user.
    """
    normalized_phone = phone_number.replace(" ", "").replace("-", "")
    if not normalized_phone.startswith("+"):
        normalized_phone = "+" + normalized_phone
        
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, phone_number, telegram_id FROM users WHERE phone_number = %s;", (normalized_phone,))
        user_by_phone = cur.fetchone()
        
        if user_by_phone:
            if user_by_phone["telegram_id"] != str(telegram_id):
                cur.execute(
                    "UPDATE users SET telegram_id = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING id, phone_number, telegram_id;",
                    (str(telegram_id), user_by_phone["id"])
                )
                user = cur.fetchone()
                conn.commit()
                logger.info(f"Updated telegram_id for user {user['id']}")
                return user
            return user_by_phone
            
        cur.execute("SELECT id, phone_number, telegram_id FROM users WHERE telegram_id = %s;", (str(telegram_id),))
        user_by_tg = cur.fetchone()
        if user_by_tg:
            return user_by_tg
            
        cur.execute(
            """
            INSERT INTO users (phone_number, telegram_id)
            VALUES (%s, %s)
            RETURNING id, phone_number, telegram_id;
            """,
            (normalized_phone, str(telegram_id))
        )
        new_user = cur.fetchone()
        conn.commit()
        logger.info(f"Registered new user: {new_user['id']}")
        return new_user
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error registering telegram user: {str(e)}")
        raise e
    finally:
        cur.close()
        conn.close()
