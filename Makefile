# Team Nebula AI Workspace Makefile

.PHONY: dev install setup-backend setup-frontend help docker-up docker-down deploy

help:
	@echo "Available commands:"
	@echo "  make dev           - Start backend + frontend locally (no Docker)"
	@echo "  make install       - Install all backend + frontend dependencies"
	@echo "  make docker-up     - Start full stack via Docker Compose (includes pgvector DB)"
	@echo "  make docker-down   - Stop Docker Compose stack"
	@echo "  make deploy        - Deploy to GCP via Pulumi"

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

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

deploy:
	cd infra && pulumi up --yes
