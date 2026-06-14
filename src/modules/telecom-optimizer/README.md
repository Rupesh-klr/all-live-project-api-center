# Telecom Optimizer — Backend Module (reference pattern)

> Node.js · Express · Graph Theory (Dijkstra / A*) · optional Python (FastAPI) bridge

The **reference backend module**. Layered into data / logic / transport so any developer
can read it top-to-bottom. `config/moduleLoader.js` auto-mounts every `modules/*/app.js`
whose `meta.active === true` at `/api/<folder>/v1` — delete the folder or set
`active: false` and it stops mounting. No central registration.

---

## File layout (the 3-file pattern)

```
modules/telecom-optimizer/
├── telecom.constants.js  ← data: demo nodes + weighted edges, algorithms, env wiring
├── telecom.service.js    ← logic: getInfo, getNodes, shortestPath (real Dijkstra / A*)
├── app.js                ← transport: routes (public + protected), pagination, meta
└── README.md
```

| File | Responsibility |
|------|----------------|
| `telecom.constants.js` | Pure data + config (`PYTHON_SERVICE_URL`, `PUBLIC_ENDPOINTS`). |
| `telecom.service.js`   | Pure functions over the graph. No Express. |
| `app.js`               | Express router + `meta`. Thin controllers calling the service. |

---

## Endpoints — `/api/telecom-optimizer/v1`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET  | `/info`               | public | Module meta + graph stats |
| GET  | `/health`             | public | Liveness probe |
| GET  | `/demo/nodes`         | public | **Paginated** demo nodes (recruiter-safe) |
| GET  | `/nodes`              | Bearer | **Paginated** nodes |
| POST | `/graph/shortest-path`| Bearer | Body `{ source, target, algorithm }` → computed path |

Public vs protected is intentional: `PUBLIC_ENDPOINTS` in the constants documents which
routes are open. Everything else uses the shared `authMiddleware`.

### Shortest-path response
```json
{
  "success": true,
  "message": "Shortest path via dijkstra",
  "data": {
    "path": ["N1","N2","N5","N9","N12"],
    "hops": 4,
    "totalLatency": 54,
    "algorithm": "dijkstra",
    "nodesExplored": 9,
    "segments": [{ "from":"N1","to":"N2","latency":12 }, ...]
  }
}
```

`dijkstra` and `astar` return the same optimal path; A* explores fewer nodes
(`nodesExplored`) thanks to a straight-line distance heuristic over node coordinates.

---

## Shared infra it reuses (do not reinvent)

- `utils/response.js` — `ok`, `paginated`, `badRequest`, `notFound`.
- `utils/pagination.js` — `parsePagination(req)`, `buildPageMeta()`, `paginate()`.
- `middleware/auth.middleware.js` — `authMiddleware`, `requireRole`.
- `config/app.config.js` — env identity + pagination defaults.

### Pagination contract
```js
const { page, limit } = parsePagination(req, { defaultLimit: 5 })
const items = paginate(all, { page, limit })
return paginated(res, items, buildPageMeta({ page, limit, total: all.length }))
// → { success, message, data: [...], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }
```

---

## Clone this for a new module

```
1. mkdir modules/my-module
2. my.constants.js  → data + config
3. my.service.js    → pure logic
4. app.js           → router + meta:{ active:true, name:'my-module', ... }; module.exports = { router, meta }
5. Restart — moduleLoader mounts it at /api/my-module/v1 automatically.
```

Set `meta.active = false` to disable without deleting. The frontend mirror lives in
`all-live-project/src/modules/<slug>/module.config.jsx`.
