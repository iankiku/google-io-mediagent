# Team Nebula — MediAgent Hackathon Makefile
#
# Usage:
#   make infra-login     — Login to Pulumi Cloud (one-time)
#   make infra-init      — Create GCP project, Pulumi stack, ESC environment
#   make infra-secrets   — Edit secrets in Pulumi ESC
#   make infra-up        — Deploy all GCP infrastructure
#   make infra-down      — Tear down all GCP infrastructure
#   make infra-outputs   — Show deployed resource URLs
#   make docker-build    — Build backend Docker image
#   make docker-push     — Push backend image to Artifact Registry
#   make docker-up       — Run full stack locally via Docker Compose
#   make dev             — Run backend + frontend locally (no Docker)

PULUMI_BACKEND   := https://api.pulumi.com
STACK            := hackathon
GCP_REGION       := us-central1
GCP_PROJECT      ?= $(shell gcloud config get-value project 2>/dev/null)
PULUMI_ORG       ?= $(shell cd infra && PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi whoami 2>/dev/null)
AR_URL           := $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT)/mediagent-$(STACK)

.PHONY: help dev install setup-backend setup-frontend \
        docker-up docker-down docker-build docker-push \
        infra-login infra-init infra-secrets infra-up infra-down infra-outputs infra-preview \
        gcp-auth gcp-project

help:
	@echo ""
	@echo "  MediAgent Hackathon — Available Commands"
	@echo "  ──────────────────────────────────────────"
	@echo ""
	@echo "  Setup (run once):"
	@echo "    make gcp-auth        Authenticate with Google Cloud"
	@echo "    make gcp-project     Create a new GCP project (or set existing)"
	@echo "    make infra-login     Login to Pulumi Cloud backend"
	@echo "    make infra-init      Initialize Pulumi stack + ESC environment"
	@echo "    make infra-secrets   Edit secrets (Gemini key, DB password, etc.)"
	@echo ""
	@echo "  Infrastructure:"
	@echo "    make infra-preview   Preview infra changes without deploying"
	@echo "    make infra-up        Deploy Cloud SQL, GCS, Cloud Run to GCP"
	@echo "    make infra-down      Tear down all GCP infrastructure"
	@echo "    make infra-outputs   Show deployed URLs and connection strings"
	@echo ""
	@echo "  Docker:"
	@echo "    make docker-up       Run full stack locally (pgvector + backend + frontend)"
	@echo "    make docker-down     Stop local Docker stack"
	@echo "    make docker-build    Build backend Docker image for GCP"
	@echo "    make docker-push     Push backend image to Artifact Registry"
	@echo ""
	@echo "  Development:"
	@echo "    make dev             Start backend + frontend locally (no Docker)"
	@echo "    make install         Install all Python + Node dependencies"
	@echo ""

# ─────────────────────────────────────────────────
# GCP Setup
# ─────────────────────────────────────────────────

gcp-auth:
	gcloud auth login
	gcloud auth application-default login

GCP_BILLING_ACCOUNT := 01CD06-46A866-231CB8

gcp-project:
	@echo "Creating GCP project mediagent-hackathon..."
	gcloud projects create mediagent-hackathon --name="MediAgent Hackathon" 2>/dev/null || true
	gcloud config set project mediagent-hackathon
	@echo "Linking billing account..."
	gcloud billing projects link mediagent-hackathon --billing-account=$(GCP_BILLING_ACCOUNT)
	@echo "GCP project ready with billing enabled."

# ─────────────────────────────────────────────────
# Pulumi Infrastructure (uses Pulumi Cloud backend)
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
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Next: run 'make infra-secrets' to set your"
	@echo "  Gemini API key, DB password, and GCP project"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

infra-secrets:
	@echo "Opening ESC environment editor..."
	@echo "Replace ALL placeholder values, then save and close."
	PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi env edit ctocopilot-workspace/mediagent/$(STACK)

infra-preview:
	cd infra && PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi preview

infra-up:
	cd infra && PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi up

infra-down:
	cd infra && PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi destroy

infra-outputs:
	cd infra && PULUMI_BACKEND_URL=$(PULUMI_BACKEND) pulumi stack output

# ─────────────────────────────────────────────────
# Docker
# ─────────────────────────────────────────────────

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-build:
	@echo "Building backend image..."
	docker build -t $(AR_URL)/backend:latest ./backend

docker-push:
	gcloud auth configure-docker $(GCP_REGION)-docker.pkg.dev --quiet
	docker push $(AR_URL)/backend:latest

# ─────────────────────────────────────────────────
# Local Development
# ─────────────────────────────────────────────────

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
	cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt

setup-frontend:
	cd frontend && npm install
