import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector

# Database settings from environment
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_NAME = os.getenv("POSTGRES_DB", "health_assistant")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")

logger = logging.getLogger("health_assistant.db")

def get_db_connection():
    """
    Creates a new connection to the PostgreSQL database and registers the pgvector type adapter.
    """
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT,
            cursor_factory=RealDictCursor
        )
        # Register the vector adapter for the connection
        register_vector(conn)
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        raise e

def initialize_database():
    """
    Runs the initialization script db_init.sql to create tables if they do not exist.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Read db_init.sql
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sql_path = os.path.join(script_dir, "db_init.sql")
        
        if os.path.exists(sql_path):
            with open(sql_path, 'r') as f:
                sql_script = f.read()
            cur.execute(sql_script)
            conn.commit()
            logger.info("Database initialized successfully.")
        else:
            logger.warning(f"Database init script not found at {sql_path}")
            
        cur.close()
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()
