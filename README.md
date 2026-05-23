# google-io-mediagent

A Domain-Driven Design (DDD) platform for managed agents leveraging FastAPI, LangGraph, and Next.js.

## Architecture

- **Backend (FastAPI + LangGraph)**: Exposes agent registry and chat endpoints orchestrating routing, managed agent execution in remote sandboxes, and verification loops.
- **Frontend (Next.js)**: A dark-themed chat interface built with Tailwind CSS v4 and shadcn/ui.

## Getting Started

1. Set your `GEMINI_API_KEY` environment variable.
2. Run `make install` to install dependencies.
3. Run `make dev` to launch the backend and frontend dev servers concurrently.
