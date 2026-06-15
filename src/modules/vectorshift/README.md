# Module: vectorshift

> **🔗 Live API:** https://all-live-project-api-center-rupesh-klr.holistichealervedika.com/api/vectorshift/v1/info (public)

> Node.js · Express · FastAPI bridge · Vector DBs (Chroma / Pinecone / Weaviate)

VectorShift Enterprise RAG Pipeline Builder — REST API for creating, managing, and executing Retrieval-Augmented Generation pipelines. Each pipeline is a DAG (directed acyclic graph) connecting a document source, a vector store, and an LLM inference endpoint.

**Portfolio story:** Demonstrates enterprise AI workflow orchestration. Users define pipelines declaratively (source type → chunking strategy → vector DB → LLM), then execute queries through them. Backend bridges to a Python FastAPI service for the actual vector operations.

---

## Endpoints

Base path: `/api/vectorshift/v1/`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/info` | Public | Module metadata |
| `GET`  | `/pipelines` | Bearer | List all pipelines owned by / accessible to the current user |
| `POST` | `/pipelines` | admin / manager | Create a new pipeline |
| `PATCH`| `/pipelines/:id` | admin / manager | Update pipeline definition |
| `DELETE`| `/pipelines/:id` | admin | Delete a pipeline |
| `POST` | `/pipelines/:id/run` | Bearer | Execute a query through the pipeline |

---

## GET `/pipelines`

```http
GET /api/vectorshift/v1/pipelines
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

```json
{
  "success": true,
  "data": {
    "pipelines": [
      {
        "id":          "pip_abc123",
        "name":        "Support FAQ",
        "sourceType":  "pdf",
        "vectorDb":    "chroma",
        "llm":         "claude-sonnet-4-6",
        "chunkSize":   512,
        "topK":        5,
        "status":      "ready",
        "createdAt":   "2026-06-10T12:00:00.000Z",
        "lastRunAt":   "2026-06-14T07:30:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

## POST `/pipelines`

```http
POST /api/vectorshift/v1/pipelines
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{
  "name":       "Support FAQ",
  "sourceType": "pdf",
  "vectorDb":   "chroma",
  "llm":        "claude-sonnet-4-6",
  "chunkSize":  512,
  "topK":       5
}
```

| Field | Required | Values |
|---|---|---|
| `name` | Yes | Unique pipeline name |
| `sourceType` | Yes | `pdf` `url` `s3` `text` |
| `vectorDb` | Yes | `chroma` `pinecone` `weaviate` |
| `llm` | Yes | Any LLM identifier your FastAPI service supports |
| `chunkSize` | No | Default: 512 |
| `topK` | No | Default: 5 |

**Response (201):**

```json
{
  "success": true,
  "data": { "pipelineId": "pip_abc123", "status": "created" }
}
```

---

## POST `/pipelines/:id/run`

```http
POST /api/vectorshift/v1/pipelines/pip_abc123/run
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{ "query": "How do I reset my password?" }
```

**Response (FastAPI bridge active):**

```json
{
  "success": true,
  "data": {
    "answer": "To reset your password, go to Settings → Security → Reset Password...",
    "sources": [
      { "chunk": "...password reset requires email verification...", "score": 0.92, "page": 3 }
    ],
    "latencyMs": 340,
    "pipeline":  "pip_abc123",
    "source":    "fastapi-service"
  }
}
```

**Response (stub mode — no FastAPI URL configured):**

```json
{
  "success": true,
  "data": {
    "answer":    "Demo response — connect VECTORSHIFT_FASTAPI_URL for live inference.",
    "sources":   [],
    "latencyMs": 0,
    "source":    "stub"
  }
}
```

---

## FastAPI bridge configuration

```env
VECTORSHIFT_FASTAPI_URL=http://localhost:8002
```

The Python FastAPI service should expose:

```
POST /run
{ "pipeline_id": "pip_abc123", "query": "..." }
→ { "answer": "...", "sources": [...], "latency_ms": 340 }
```

---

## Error responses

| Scenario | Status | message |
|---|---|---|
| Pipeline not found | 404 | `Pipeline 'pip_abc123' not found` |
| Insufficient role | 403 | `Role 'viewer' cannot access this resource` |
| Missing `query` | 400 | `query is required` |
| FastAPI timeout | 503 | `Inference service unavailable` |

---

## Default users

| username | role | Access |
|---|---|---|
| `ml_engineer` | admin | Create, update, delete, run pipelines |
| `data_analyst` | viewer | List and run pipelines — no create/delete |

---

## Files

| File | What it does |
|---|---|
| `app.js` | Router + `meta` export. `meta.active = false` to disable. |
| `vectorshift.routes.js` | Route definitions — `requireRole(['admin','manager'])` on mutating routes |
| `vectorshift.controller.js` | Request parsing + response formatting |
| `vectorshift.service.js` | Pipeline CRUD + FastAPI HTTP bridge with fallback stub |
