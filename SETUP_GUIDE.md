# 📖 The Zoie Bible: Zero to Running in 60 Seconds

This is the definitive guide to getting the Zoie platform (google-io-mediagent) up and running on a fresh machine. Follow these steps in order.

---

## ⚡ Quick Start (The "I just want it to work" path)

1. **Clone and Enter**:
   ```bash
   git clone <repo-url>
   cd google-io-mediagent
   ```

2. **Secrets (CRITICAL)**:
   ```bash
   cp .env.example .env
   ```
   **Open `.env` in your editor** and paste your `GEMINI_API_KEY`. Get one [here](https://aistudio.google.dev/apikey).

3. **Infrastructure**:
   ```bash
   docker compose up db -d
   ```

4. **Install & Seed**:
   ```bash
   make install
   make seed
   ```

5. **Verify (Run the Agent Tests)**:
   ```bash
   PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests -p "test_*.py"
   ```

---

## 🛠 Detailed Setup

### 1. Prerequisites
- **Python 3.11 or 3.12** (Avoid 3.14+ for now if possible).
- **Node.js 18+** & npm.
- **Docker Desktop** (Must be running).
- **Gemini API Key**.

### 2. The `.env` File (The Heart of the App)
The app **will not start** without a `.env` file in the **root directory**.
```env
GEMINI_API_KEY=your_key_here
POSTGRES_HOST=localhost
POSTGRES_DB=health_assistant
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5432
```

### 3. Database & pgvector
We use `pgvector` for medical record search.
- **Start**: `docker compose up db -d`
- **Reset**: `docker compose down -v && docker compose up db -d` (Wipes all data!)
- **Check**: `docker ps` should show a container running on port `5432`.

### 4. Backend & Frontend
- **Install Everything**: `make install`
- **Run Everything**: `make dev`
  - Frontend: http://localhost:3000
  - Backend: http://localhost:8000

---

## 🧪 Testing the 4 Agents
We have 4 specialized agents. You can test them all at once with:
```bash
PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests -p "test_*.py"
```

### Manual Agent Execution (CLI)
If you want to talk to a specific agent via terminal:

**Research Agent** (Public medical data):
```bash
cd backend && PYTHONPATH=. venv/bin/python -c "from app.domains.agents.research_agent.agent import run_research_agent; print(run_research_agent('metformin warnings'))"
```

**Deep Insights Agent** (Full patient history):
```bash
cd backend && PYTHONPATH=. venv/bin/python -c "from app.domains.agents.deep_insights_agent.agent import run_deep_insights_agent; print(run_deep_insights_agent('what is my LDL?', user_id='<uuid>'))"
```

**Scans Agent** (Imaging/X-rays only):
```bash
cd backend && PYTHONPATH=. venv/bin/python -c "from app.domains.agents.scans_agent.agent import run_scans_agent; print(run_scans_agent('scan results?', user_id='<uuid>'))"
```

**Reports Agent** (Lab PDFs only):
```bash
cd backend && PYTHONPATH=. venv/bin/python -c "from app.domains.agents.reports_agent.agent import run_reports_agent; print(run_reports_agent('explain my lab report', user_id='<uuid>'))"
```

---

## 🆘 Troubleshooting (The "Bible" of fixes)

### `ModuleNotFoundError: No module named 'psycopg2'`
You are likely running python outside the virtual environment. Always use `backend/venv/bin/python` or run `source backend/venv/bin/activate` first.

### `connection to server at "localhost" failed: Connection refused`
Your Docker database is not running. Run `docker compose up db -d`.

### `ValueError: No API key was provided`
You forgot to create the `.env` file in the **root** directory, or you didn't paste your key into it.

### `ModuleNotFoundError: No module named 'app'`
You must set `PYTHONPATH=backend` when running tests or scripts from the root directory.

### `Error: Command ... ensurepip ... returned non-zero exit status 1`
This happens on some macOS versions with Python 3.14. Try using `python3.12 -m venv venv` instead.
