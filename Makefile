# Team Nebula — Zoie Hackathon Makefile
#
# All secrets and config live in .env (local) — never committed.
# `make infra-sync-env` pushes .env values into Pulumi ESC.
# `make docker-up` and `make dev` both read from .env automatically.

# Load .env if it exists
ifneq (,$(wildcard .env))
    include .env
    export
endif

PULUMI_BACKEND   := https://api.pulumi.com
STACK            := hackathon
GCP_PROJECT      ?= mediagent-hackathon
GCP_REGION       ?= us-central1
AR_URL           := $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT)/mediagent-$(STACK)
GCP_BILLING_ACCOUNT := 01CD06-46A866-231CB8

.PHONY: help dev install setup-backend setup-frontend \
        docker-up docker-down docker-build docker-push \
        infra-login infra-init infra-sync-env infra-secrets infra-up infra-down infra-outputs infra-preview \
        gcp-auth gcp-project seed

help:
	@echo ""
	@echo "  Zoie Hackathon — Available Commands"
	@echo "  ──────────────────────────────────────────"
	@echo ""
	@echo "  Setup (run once):"
	@echo "    make gcp-auth        Authenticate with Google Cloud"
	@echo "    make gcp-project     Create GCP project + link billing"
	@echo "    make infra-login     Login to Pulumi Cloud"
	@echo "    make infra-init      Initialize Pulumi stack + ESC environment"
	@echo "    make infra-sync-env  Push .env values into Pulumi ESC (run after editing .env)"
	@echo ""
	@echo "  Infrastructure:"
	@echo "    make infra-preview   Preview infra changes"
	@echo "    make infra-up        Deploy Cloud SQL, GCS, Cloud Run to GCP"
	@echo "    make infra-down      Tear down all GCP infrastructure"
	@echo "    make infra-outputs   Show deployed URLs and connection strings"
	@echo ""
	@echo "  Docker:"
	@echo "    make docker-up       Run full stack locally (pgvector + backend + frontend)"
	@echo "    make docker-down     Stop local Docker stack"
	@echo "    make docker-build    Build backend Docker image"
	@echo "    make docker-push     Push to Artifact Registry"
	@echo ""
	@echo "  Development:"
	@echo "    make dev             Start backend + frontend locally"
	@echo "    make install         Install all dependencies"
	@echo "    make seed            Seed demo data (Ravi Kumar)"
	@echo ""

# ─────────────────────────────────────────────────
# GCP Setup
# ─────────────────────────────────────────────────

gcp-auth:
	gcloud auth login
	gcloud auth application-default login

gcp-project:
	@echo "Creating GCP project $(GCP_PROJECT)..."
	gcloud projects create $(GCP_PROJECT) --name="Zoie Hackathon" 2>/dev/null || true
	gcloud config set project $(GCP_PROJECT)
	gcloud billing projects link $(GCP_PROJECT) --billing-account=$(GCP_BILLING_ACCOUNT)
	@echo "GCP project ready with billing enabled."

# ─────────────────────────────────────────────────
# Pulumi Infrastructure
# ─────────────────────────────────────────────────

infra-login:
	@echo "Logging into Pulumi Cloud..."
	PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi login

infra-init: infra-login
	@echo "Installing infra dependencies..."
	cd infra && npm install
	@echo "Initializing Pulumi stack '$(STACK)'..."
	cd infra && PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi stack init $(STACK) 2>/dev/null; \
		PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi stack select $(STACK) 2>/dev/null; \
		echo "Stack '$(STACK)' selected."
	@echo "Creating ESC environment..."
	PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi env init ctocopilot-workspace/mediagent/$(STACK) 2>/dev/null || \
		echo "ESC environment already exists."
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Next: edit .env with your secrets, then run:"
	@echo "    make infra-sync-env"
	@echo "    make infra-up"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

infra-sync-env:
	@echo "Syncing .env → Pulumi ESC (ctocopilot-workspace/mediagent/$(STACK))..."
	@test -f .env || (echo "ERROR: .env file not found. Copy .env.example to .env and fill in values." && exit 1)
	@echo 'values:' > /tmp/esc-env.yaml
	@echo '  geminiApiKey:' >> /tmp/esc-env.yaml
	@echo '    fn::secret: "$(GEMINI_API_KEY)"' >> /tmp/esc-env.yaml
	@echo '  postgresPassword:' >> /tmp/esc-env.yaml
	@echo '    fn::secret: "$(POSTGRES_PASSWORD)"' >> /tmp/esc-env.yaml
	@if [ -n "$(TELEGRAM_BOT_TOKEN)" ]; then \
		echo '  telegramBotToken:' >> /tmp/esc-env.yaml; \
		echo '    fn::secret: "$(TELEGRAM_BOT_TOKEN)"' >> /tmp/esc-env.yaml; \
	fi
	@echo '  gcpProject: "$(GCP_PROJECT)"' >> /tmp/esc-env.yaml
	@echo '  gcpRegion: "$(GCP_REGION)"' >> /tmp/esc-env.yaml
	@echo '  pulumiConfig:' >> /tmp/esc-env.yaml
	@echo '    gcp:project: $${gcpProject}' >> /tmp/esc-env.yaml
	@echo '    gcp:region: $${gcpRegion}' >> /tmp/esc-env.yaml
	@echo '    mediagent:geminiApiKey: $${geminiApiKey}' >> /tmp/esc-env.yaml
	@echo '    mediagent:postgresPassword: $${postgresPassword}' >> /tmp/esc-env.yaml
	@if [ -n "$(TELEGRAM_BOT_TOKEN)" ]; then \
		echo '    mediagent:telegramBotToken: $${telegramBotToken}' >> /tmp/esc-env.yaml; \
	fi
	@PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi env edit --file /tmp/esc-env.yaml ctocopilot-workspace/mediagent/$(STACK)
	@rm -f /tmp/esc-env.yaml
	@echo "  ✓ All secrets synced to Pulumi ESC (including pulumiConfig mappings)."
	@echo ""
	@echo "  Now run: make infra-up"

infra-secrets:
	@echo "Opening ESC environment editor..."
	PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi env edit ctocopilot-workspace/mediagent/$(STACK)

infra-preview:
	cd infra && PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi preview --stack $(STACK)

infra-up:
	cd infra && PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi up --stack $(STACK)

infra-down:
	cd infra && PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi destroy --stack $(STACK)

infra-outputs:
	cd infra && PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi stack output --stack $(STACK)

# ─────────────────────────────────────────────────
# Docker
# ─────────────────────────────────────────────────

docker-up:
	cd frontend && npm install
	docker compose up --build -d

docker-be:
	docker compose up --build -d db backend

docker-fe:
	cd frontend && npm install
	docker compose up --build -d frontend

docker-down:
	docker compose down

docker-build:
	@echo "Building backend image..."
	docker build --platform linux/amd64 -t $(AR_URL)/backend:latest ./backend

docker-push:
	gcloud auth configure-docker $(GCP_REGION)-docker.pkg.dev --quiet
	docker push $(AR_URL)/backend:latest

# ─────────────────────────────────────────────────
# Local Development
# ─────────────────────────────────────────────────

dev: install
	npx -y concurrently -k \
		-n "backend,frontend" \
		-c "blue.bold,magenta.bold" \
		"cd backend && venv/bin/uvicorn app.main:app --reload --port 8000" \
		"cd frontend && npm run dev"

install: setup-backend setup-frontend
	@echo "All dependencies installed successfully."

setup-backend:
	cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt

setup-frontend:
	cd frontend && npm install

seed:
	cd backend && venv/bin/python -m app.core.seed_demo
