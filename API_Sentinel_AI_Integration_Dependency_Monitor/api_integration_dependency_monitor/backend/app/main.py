from __future__ import annotations

from datetime import datetime, timezone
import os
from typing import Any
import math

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="API Sentinel", version="1.0.0", description="AI Integration Dependency Monitor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',') if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


NOW = datetime(2026, 9, 21, 18, 30, tzinfo=timezone.utc)

SERVICES: list[dict[str, Any]] = [
    {"id": "svc-salesforce", "name": "Salesforce CRM", "kind": "SaaS", "owner": "Revenue Ops", "status": "healthy", "latency": 184, "error_rate": 0.2, "version": "v58", "vendor": "Salesforce"},
    {"id": "svc-hubspot", "name": "HubSpot", "kind": "SaaS", "owner": "Growth", "status": "degraded", "latency": 492, "error_rate": 2.8, "version": "2026.1", "vendor": "HubSpot"},
    {"id": "svc-openai", "name": "LLM Gateway", "kind": "AI", "owner": "AI Platform", "status": "healthy", "latency": 822, "error_rate": 0.7, "version": "responses-2026-08", "vendor": "Model Gateway"},
    {"id": "svc-slack", "name": "Slack Notifications", "kind": "SaaS", "owner": "Internal Tools", "status": "healthy", "latency": 201, "error_rate": 0.1, "version": "events-v2", "vendor": "Slack"},
    {"id": "svc-stripe", "name": "Stripe Billing", "kind": "SaaS", "owner": "Finance", "status": "healthy", "latency": 238, "error_rate": 0.3, "version": "2025-12", "vendor": "Stripe"},
    {"id": "svc-postgres", "name": "Customer DB", "kind": "Data", "owner": "Platform", "status": "healthy", "latency": 38, "error_rate": 0.0, "version": "16", "vendor": "PostgreSQL"},
    {"id": "svc-support", "name": "Support Agent", "kind": "AI Agent", "owner": "CX", "status": "healthy", "latency": 930, "error_rate": 1.2, "version": "agent-4.2", "vendor": "Internal"},
    {"id": "svc-leadbot", "name": "Lead Qualification Agent", "kind": "AI Agent", "owner": "Growth", "status": "at-risk", "latency": 1160, "error_rate": 4.4, "version": "agent-2.8", "vendor": "Internal"},
    {"id": "svc-invoice", "name": "Invoice Workflow", "kind": "Workflow", "owner": "Finance", "status": "healthy", "latency": 680, "error_rate": 0.5, "version": "workflow-1.7", "vendor": "Internal"},
    {"id": "svc-data", "name": "Revenue Warehouse", "kind": "Data", "owner": "Analytics", "status": "healthy", "latency": 65, "error_rate": 0.0, "version": "snowflake-9", "vendor": "Warehouse"},
]

DEPENDENCIES: list[dict[str, Any]] = [
    {"source": "svc-leadbot", "target": "svc-hubspot", "type": "API", "criticality": "critical", "sla": 99.9},
    {"source": "svc-leadbot", "target": "svc-openai", "type": "MODEL", "criticality": "critical", "sla": 99.9},
    {"source": "svc-leadbot", "target": "svc-slack", "type": "WEBHOOK", "criticality": "medium", "sla": 99.5},
    {"source": "svc-support", "target": "svc-openai", "type": "MODEL", "criticality": "critical", "sla": 99.9},
    {"source": "svc-support", "target": "svc-salesforce", "type": "API", "criticality": "high", "sla": 99.9},
    {"source": "svc-support", "target": "svc-slack", "type": "WEBHOOK", "criticality": "medium", "sla": 99.5},
    {"source": "svc-invoice", "target": "svc-stripe", "type": "API", "criticality": "critical", "sla": 99.99},
    {"source": "svc-invoice", "target": "svc-postgres", "type": "DB", "criticality": "high", "sla": 99.99},
    {"source": "svc-invoice", "target": "svc-slack", "type": "WEBHOOK", "criticality": "low", "sla": 99.0},
    {"source": "svc-hubspot", "target": "svc-data", "type": "SYNC", "criticality": "medium", "sla": 99.5},
    {"source": "svc-salesforce", "target": "svc-data", "type": "SYNC", "criticality": "medium", "sla": 99.5},
]

CHANGES: list[dict[str, Any]] = [
    {"id": "chg-1048", "service_id": "svc-hubspot", "title": "Contacts API pagination contract changed", "category": "API Contract", "severity": "critical", "detected": "18 min ago", "before": "offset + limit", "after": "cursor + limit", "confidence": 0.97},
    {"id": "chg-1047", "service_id": "svc-openai", "title": "Response metadata schema expanded", "category": "Schema", "severity": "low", "detected": "2 hr ago", "before": "usage.total_tokens", "after": "usage.input_tokens / output_tokens", "confidence": 0.91},
    {"id": "chg-1046", "service_id": "svc-stripe", "title": "New webhook signature header", "category": "Security", "severity": "medium", "detected": "5 hr ago", "before": "Stripe-Signature", "after": "Stripe-Signature + Stripe-Version", "confidence": 0.89},
    {"id": "chg-1045", "service_id": "svc-salesforce", "title": "Rate-limit bucket tightened for bulk queries", "category": "Runtime", "severity": "medium", "detected": "1 day ago", "before": "2,000 req/min", "after": "1,200 req/min", "confidence": 0.84},
]

INCIDENTS: list[dict[str, Any]] = [
    {"id": "INC-3021", "title": "Lead qualification failures", "status": "investigating", "severity": "critical", "service": "Lead Qualification Agent", "started": "24 min ago", "impact": "12 workflows / 418 lead records", "root_change": "chg-1048"},
    {"id": "INC-3017", "title": "Invoice webhook retries increased", "status": "resolved", "severity": "medium", "service": "Invoice Workflow", "started": "6 hr ago", "impact": "3 failed deliveries", "root_change": "chg-1046"},
    {"id": "INC-3011", "title": "Salesforce bulk sync throttling", "status": "monitoring", "severity": "medium", "service": "Support Agent", "started": "1 day ago", "impact": "6 sync jobs delayed", "root_change": "chg-1045"},
]

METRICS = {
    "services_monitored": 47,
    "active_dependencies": 126,
    "changes_24h": 14,
    "impacted_workflows": 12,
    "prevented_incidents": 38,
    "availability": 99.82,
}


def service_by_id(service_id: str) -> dict[str, Any]:
    for service in SERVICES:
        if service["id"] == service_id:
            return service
    raise HTTPException(status_code=404, detail="Service not found")


def impact_for_change(change_id: str) -> dict[str, Any]:
    change = next((c for c in CHANGES if c["id"] == change_id), None)
    if not change:
        raise HTTPException(status_code=404, detail="Change not found")

    direct = [d for d in DEPENDENCIES if d["target"] == change["service_id"]]
    impacted = []
    score = 0.0
    for dep in direct:
        svc = service_by_id(dep["source"])
        multiplier = {"critical": 1.0, "high": 0.82, "medium": 0.58, "low": 0.32}[dep["criticality"]]
        confidence = min(0.99, 0.68 + multiplier * 0.28)
        score += multiplier
        impacted.append({
            "service_id": svc["id"],
            "service": svc["name"],
            "type": svc["kind"],
            "criticality": dep["criticality"],
            "relationship": dep["type"],
            "confidence": confidence,
            "reason": f"Depends on {service_by_id(change['service_id'])['name']} via {dep['type']}",
        })
    affected_workflows = [
        "Lead qualification enrichment",
        "CRM contact sync",
        "Lifecycle scoring",
        "Outbound notification routing",
        "AI handoff queue",
        "Growth analytics refresh",
    ] if change_id == "chg-1048" else ["Dependency-specific workflows"]
    risk = min(99, round(42 + score * 21 + (12 if change["severity"] == "critical" else 0)))
    return {
        "change": change,
        "blast_radius": risk,
        "impacted_services": impacted,
        "affected_workflows": affected_workflows,
        "recommended_actions": [
            "Pause automated deployments touching the affected contract.",
            "Route the workflow to the last known-compatible API shape.",
            "Run synthetic contract tests before re-enabling traffic.",
            "Notify the owner and keep the change under observation for 60 minutes.",
        ],
    }


class SimulateRequest(BaseModel):
    service_id: str
    title: str = Field(min_length=3)
    severity: str = Field(default="medium")


@app.get("/")
def root():
    return {"name": "API Sentinel", "status": "online", "purpose": "AI Integration Dependency Monitor"}


@app.get("/api/health")
def health():
    return {"status": "healthy", "timestamp": NOW.isoformat()}


@app.get("/api/dashboard")
def dashboard():
    return {
        "metrics": METRICS,
        "service_health": {
            "healthy": sum(1 for s in SERVICES if s["status"] == "healthy"),
            "degraded": sum(1 for s in SERVICES if s["status"] == "degraded"),
            "at_risk": sum(1 for s in SERVICES if s["status"] == "at-risk"),
        },
        "latency_series": [
            {"label": "12:00", "value": 410}, {"label": "13:00", "value": 422}, {"label": "14:00", "value": 438},
            {"label": "15:00", "value": 452}, {"label": "16:00", "value": 465}, {"label": "17:00", "value": 511},
            {"label": "18:00", "value": 497},
        ],
        "change_categories": [
            {"name": "API Contract", "value": 6}, {"name": "Schema", "value": 3}, {"name": "Runtime", "value": 3}, {"name": "Security", "value": 2}
        ],
    }


@app.get("/api/services")
def services():
    return SERVICES


@app.get("/api/dependencies")
def dependencies():
    nodes = [{**s, "x": 0, "y": 0} for s in SERVICES]
    return {"nodes": nodes, "edges": DEPENDENCIES}


@app.get("/api/changes")
def changes():
    rows = []
    for change in CHANGES:
        svc = service_by_id(change["service_id"])
        item = {**change, "service": svc["name"], "vendor": svc["vendor"]}
        rows.append(item)
    return rows


@app.get("/api/incidents")
def incidents():
    return INCIDENTS


@app.get("/api/impact/{change_id}")
def impact(change_id: str):
    return impact_for_change(change_id)


@app.post("/api/simulate")
def simulate(payload: SimulateRequest):
    service_by_id(payload.service_id)
    change_id = f"sim-{len(CHANGES)+1:04d}"
    severity = payload.severity if payload.severity in {"low", "medium", "high", "critical"} else "medium"
    change = {
        "id": change_id,
        "service_id": payload.service_id,
        "title": payload.title,
        "category": "Simulated Contract Change",
        "severity": severity,
        "detected": "just now",
        "before": "existing contract",
        "after": "simulated change",
        "confidence": 0.93,
    }
    CHANGES.insert(0, change)
    return {"change": change, "analysis": impact_for_change(change_id)}
