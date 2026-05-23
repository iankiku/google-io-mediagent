# Custom Agents Customization & Workspace Manual

This file serves as the system documentation and guide for Team Nebula's custom agents setup. It details the file-based customization structure for the Gemini Managed Agents platform and the Domain-Driven Design (DDD) patterns implemented in our applications.

---

## 📂 File-Based Customization Structure

While you can pass configuration inline, the platform allows you to organize your agent's files in a structured `.agents/` directory which is automatically scanned and mounted by the Antigravity agent runtime:

```
my-agent/
├── AGENTS.md        # Persona definition & long-form system instructions
├── project-docs/    # Project PRDs and technical architecture documents
├── skills/          # Custom skills (subfolders containing SKILL.md files)
│   └── slide-maker/
│       └── SKILL.md
└── workspace/       # Initial knowledge files & data templates
```

### 1. AGENTS.md
The agent automatically loads `.agents/AGENTS.md` (or `/.agents/AGENTS.md`) from the environment as system instructions on startup. Use it for version-controlled guidelines, personas, and operating constraints.

#### Python Mounting Example:
```python
from google import genai

client = genai.Client()

interaction = client.interactions.create(
    agent="antigravity-preview-05-2026",
    input="Analyze Q1 data.",
    environment={
        "type": "remote",
        "sources": [
            {
                "type": "inline",
                "target": ".agents/AGENTS.md",
                "content": "Always use matplotlib for charts. Include a summary table.",
            },
        ],
    },
)
```

### 2. Project Documentation (project-docs/)
All project Product Requirement Documents (PRDs) and technical architecture pipeline designs must be saved inside the `project-docs/` folder for persistent storage and cross-agent context sharing.

### 3. Custom Skills (SKILL.md)
Skills are files that extend the agent's capabilities. Place them under `.agents/skills/<skill-name>/SKILL.md` for auto-discovery and registration:

```
.agents/
├── AGENTS.md
└── skills/
    └── slide-maker/
        └── SKILL.md
```

#### Python Skill Mounting Example:
```python
interaction = client.interactions.create(
    agent="antigravity-preview-05-2026",
    input="Create a presentation.",
    environment={
        "type": "remote",
        "sources": [
            {
                "type": "inline",
                "target": ".agents/skills/slide-maker/SKILL.md",
                "content": "---\nname: slide-maker\ndescription: Create HTML slide decks\n---\n# Slide Maker\nAnalyze input and save presentation to /workspace/output/slides.html",
            },
        ],
    },
)
```

### 4. Persistent Managed Agents (agents.create)
To avoid passing configurations inline, persist them using `agents.create`:

```python
agent = client.agents.create(
    id="data-analyst",
    base_agent="antigravity-preview-05-2026",
    system_instruction="You are a data analyst.",
    base_environment={
        "type": "remote",
        "sources": [
            {
                "type": "inline",
                "target": ".agents/AGENTS.md",
                "content": "Use pandas.",
            }
        ]
    }
)
```

---

## 🏛️ Domain-Driven Design (DDD) Code Layout

To ensure code maintainability, both the backend and frontend codebases have been refactored into a Domain/Feature-driven architecture.

### 1. Backend Structure (`backend/app/`)
Organized around business domains:
- **`app/main.py`**: Entry point which configures FastAPI, handles CORS, and registers API routers.
- **`app/core/`**: Houses shared infrastructure settings (`config.py`) and loads GenAI client context.
- **`app/domains/agent_registry/`**: Managed Agent domain:
  - `schemas.py`: Pydantic input/output validation models.
  - `services.py`: CRUD operations communicating with Gemini Client's `client.agents.*` API.
  - `router.py`: REST routes under `/api/agents`.
- **`app/domains/orchestration/`**: Stateful graph execution domain:
  - `graph.py`: LangGraph workflow building the router, execution, and validator nodes.
  - `router.py`: REST routes under `/api/chat`.

### 2. Frontend Structure (`frontend/src/`)
Organized by functional modules/features:
- **`src/features/chat/`**: Elements related to messaging thread (e.g., `MessageBubble.tsx`).
- **`src/features/agent-registry/`**: Elements related to agent list, creation forms (e.g., `CreateAgentDialog.tsx`).
- **`src/features/trace/`**: Elements related to drawing graph steps and logs (`TracePanel.tsx`).
- **`src/app/page.tsx`**: High-level orchestrator importing and laying out features into a premium grid structure.

---

## 🚀 Running the Apps

Use the root-level `Makefile` to quickly start and configure the platform:

- **Install dependencies**:
  ```bash
  make install
  ```
- **Launch concurrently**:
  ```bash
  export GEMINI_API_KEY="your_api_key_here"
  make dev
  ```
  This runs the FastAPI server on port 8000 and Next.js frontend on port 3000.
