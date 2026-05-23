from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.domains.agent_registry.router import router as agent_registry_router
from app.domains.orchestration.router import router as orchestration_router
from app.domains.ingestion.router import router as ingestion_router
from app.domains.telegram.router import router as telegram_router, start_bot_polling
from app.domains.interpreter.router import router as interpreter_router
from app.domains.checkins.router import router as checkins_router, read_router, debug_router
from app.core.db import initialize_database

app = FastAPI(
    title="Health Assistant Orchestrator",
    description="FastAPI + LangGraph backend for Health Assistant (pgvector + MedGemma + Telegram Bot)",
    version="1.0.0"
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(agent_registry_router)
app.include_router(orchestration_router)
app.include_router(ingestion_router)
app.include_router(telegram_router)
app.include_router(interpreter_router)
app.include_router(checkins_router)
app.include_router(read_router)
app.include_router(debug_router)

@app.on_event("startup")
def on_startup():
    # Init DB
    initialize_database()
    # Start Bot
    start_bot_polling()

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Health Assistant Orchestrator API (pgvector + DDD)"}
