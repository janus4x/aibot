# AgentMOD (aibot)

Multi-agent task orchestrator with a web UI.  
The server runs an LLM-driven pipeline (Coordinator -> Architect -> Decomposer/Reviewer -> Workers -> Composer/QA), stores task state/artifacts, and streams events to the client over WebSocket.

## Features

- Multi-stage orchestration pipeline for complex tasks
- Dynamic subtask graph with dependencies and parallel worker execution
- Role-based worker routing via config (`devWorker`, `textWorker`, etc.)
- React + React Flow UI for live pipeline visualization and task history
- Pluggable task store (`sqlite` or `mongo`)
- OpenAI-compatible LLM backend (LM Studio by default)

## Tech Stack

- **Server:** Node.js, TypeScript, Fastify, WebSocket
- **Client:** React, Vite, TypeScript, `@xyflow/react`
- **LLM API:** OpenAI-compatible endpoint (default: LM Studio)

## Repository Structure

- `server/` - API, orchestration pipeline, agents, storage
- `client/` - web interface and graph visualization
- `config/` - YAML configs (agents, roles, orchestrator, database)
- `prompts/` - prompt templates for each agent role

## Requirements

- Node.js `>=22.12.0`
- npm
- Running OpenAI-compatible model endpoint (or LM Studio local server)

## Quick Start

```bash
npm install
npm run dev
```

This starts:
- server on `http://127.0.0.1:3000` (default)
- client on `http://127.0.0.1:5173`

## Scripts

From repository root:

- `npm run dev` - run server + client in development mode
- `npm run build` - build client and server
- `npm start` - start server from `dist`
- `npm run smoke:llm` - quick LLM connectivity check

## Configuration

Main config files:

- `config/orchestrator.yaml` - concurrency/review limits
- `config/roles.yaml` - subtask role -> worker agent mapping
- `config/agents/*.yaml` - model and prompt settings per agent
- `config/database.yaml` - storage backend settings

Important environment variables:

- `LM_STUDIO_BASE_URL` (default: `http://127.0.0.1:1234/v1`)
- `LM_STUDIO_MODEL`
- `LM_STUDIO_API_KEY` (default often `lm-studio`)
- `LLM_TIMEOUT_MS`
- `TASK_STORE` (`sqlite` or `mongo`)
- `PORT` (default `3000`)

## API Overview

- `GET /api/health`
- `GET /api/health/llm`
- `GET /api/config/models`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `GET /api/tasks/:id/events`
- `GET /api/tasks/:id/export`
- `GET /api/tasks/:id/workspace`
- `POST /api/tasks` (multipart: `prompt` + files)
- `POST /api/tasks/:id/cancel`
- `GET /ws?taskId=<uuid>` (WebSocket event stream)

## Pipeline Summary

1. **Coordinator** formalizes user prompt
2. **Architect** creates architecture/doc plan
3. **Decomposer <-> Reviewer** loop until approved
4. **Workers** execute subtasks with dependency-aware scheduling
5. Optional **Composer** and **QA** tail steps

Workspace artifacts are written under:
- `data/tasks/<taskId>/workspace`

## Notes

- `data/`, `node_modules/`, build artifacts, and `.env` are excluded from git by default.
- The project is organized as npm workspaces (`server`, `client`).
