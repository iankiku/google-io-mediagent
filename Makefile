# Team Nebula AI Workspace Makefile

.PHONY: dev install setup-backend setup-frontend help

help:
	@echo "Available commands:"
	@echo "  make dev      - Start the FastAPI backend and Next.js frontend concurrently"
	@echo "  make install  - Install all backend (python) and frontend (node) dependencies"

dev:
	@echo "Starting backend (FastAPI) and frontend (Next.js) concurrently..."
	npx -y concurrently -k \
		-n "backend,frontend" \
		-c "blue.bold,magenta.bold" \
		"cd backend && venv/bin/uvicorn app.main:app --reload --port 8000" \
		"cd frontend && npm run dev"

install: setup-backend setup-frontend
	@echo "All dependencies installed successfully."

setup-backend:
	@echo "Setting up Python virtual environment and dependencies for backend..."
	cd backend && \
		python3 -m venv venv && \
		venv/bin/pip install -r requirements.txt

setup-frontend:
	@echo "Installing npm dependencies for frontend..."
	cd frontend && \
		npm install
