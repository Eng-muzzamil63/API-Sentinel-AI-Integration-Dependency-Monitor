# API Sentinel — AI Integration Dependency Monitor

A portfolio-grade full-stack system for detecting SaaS/API changes, mapping downstream dependencies, calculating blast radius, and prioritizing remediation for AI agents and business workflows.

## Why it exists

Companies increasingly connect AI agents and automation workflows to CRMs, payment APIs, model gateways, messaging platforms, databases, and SaaS products. A small API contract or schema change can cascade into workflow failures.

API Sentinel treats the integration layer as a dependency graph and answers:

- What changed?
- Which services depend on it?
- Which AI agents/workflows are exposed?
- How large is the blast radius?
- What action should the team take first?

## Features

- Executive dependency dashboard
- Service health monitoring
- API / schema / runtime change feed
- Interactive dependency graph
- Impact / blast-radius analysis
- Incident timeline
- Change simulator
- Synthetic anomaly and risk scoring
- REST API with Swagger docs
- Dark enterprise UI

## Stack

### Backend
- Python 3.12+
- FastAPI
- Pydantic
- Uvicorn

### Frontend
- Next.js 15
- React 19
- TypeScript
- Lucide React
- Custom CSS / SVG visualization

## Run backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Backend docs: http://127.0.0.1:8000/docs

## Run frontend

Open a second PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

Open: http://localhost:3000

## Product positioning

Do not position this as “an API dashboard”. Position it as:

> **An AI Integration Dependency Monitor that helps technology teams detect API changes before they become production incidents.**

## Production roadmap

- Connect real SaaS OpenAPI specs and webhook catalogs
- Scheduled contract diffing
- OpenTelemetry traces
- Kafka / event-stream ingestion
- Neo4j dependency graph
- GitHub/Jira/Slack integrations
- Synthetic contract tests
- LLM-assisted change explanations
- Alert policies and ownership routing
- Historical blast-radius learning
