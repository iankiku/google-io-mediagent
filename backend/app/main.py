from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.domains.agent_registry.router import router as agent_registry_router
from app.domains.orchestration.router import router as orchestration_router

app = FastAPI(
    title="Gemini Managed Agents Orchestrator",
    description="FastAPI + LangGraph backend for managing and executing Gemini Custom Agents (Domain Driven Design)",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register domain routers
app.include_router(agent_registry_router)
app.include_router(orchestration_router)

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Gemini Managed Agents API (DDD Structure)"}
