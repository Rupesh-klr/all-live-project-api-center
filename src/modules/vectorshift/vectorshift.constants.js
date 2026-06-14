/**
 * VectorShift — module-owned constants & demo knowledge base.
 *
 * The "RAG" is simulated locally (keyword-overlap retrieval + templated synthesis) so the
 * demo runs with zero external infra. Wire PYTHON_SERVICE_URL to a real FastAPI + vector DB
 * to make it production. Same 3-file shape as telecom: constants / service / app.
 */

// Pipeline building blocks (the DAG node options shown in the builder UI).
const SOURCES    = ['PDF Upload', 'Web URL', 'S3 Bucket', 'Notion']
const CHUNKERS   = ['Recursive', 'Semantic', 'Fixed-size']
const VECTOR_DBS = ['Chroma', 'Pinecone', 'Weaviate']
const LLM_MODELS = ['claude-opus-4-8', 'claude-fable-5', 'gpt-4o', 'mistral-large']

// Seed pipelines (recruiters see these immediately).
const DEMO_PIPELINES = [
  { id: 'pl_faq',   name: 'Customer FAQ RAG',     source: 'Notion',     chunker: 'Semantic',  vectorDb: 'Pinecone', llm: 'claude-opus-4-8', topK: 4, status: 'running', queries: 1284, createdAt: '2026-05-02' },
  { id: 'pl_docs',  name: 'Product Docs Search',  source: 'Web URL',    chunker: 'Recursive', vectorDb: 'Chroma',   llm: 'gpt-4o',          topK: 5, status: 'running', queries: 4810, createdAt: '2026-04-18' },
  { id: 'pl_legal', name: 'Contract Analyzer',    source: 'PDF Upload', chunker: 'Fixed-size', vectorDb: 'Weaviate', llm: 'claude-fable-5',  topK: 3, status: 'stopped', queries: 342,  createdAt: '2026-05-21' },
]

/**
 * Demo knowledge base — chunks the retriever searches. Built around a fictional
 * product ("Acme Cloud") so natural-language queries return sensible passages.
 */
const KNOWLEDGE = [
  { id: 'k1',  source: 'billing.md',   page: 2,  text: 'Acme Cloud billing is usage-based and charged monthly. Invoices are generated on the 1st and auto-charged to the default payment method after a 3-day grace period.' },
  { id: 'k2',  source: 'billing.md',   page: 3,  text: 'You can set spending limits per project. When a project reaches 90% of its limit, owners receive an email alert; at 100% new workloads are paused until the next cycle.' },
  { id: 'k3',  source: 'security.md',  page: 1,  text: 'All data at rest is encrypted with AES-256. Data in transit uses TLS 1.3. Acme Cloud is SOC 2 Type II certified and supports customer-managed encryption keys (CMEK).' },
  { id: 'k4',  source: 'security.md',  page: 4,  text: 'Role-based access control supports owner, admin, developer, and viewer roles. SSO via SAML and SCIM provisioning are available on Enterprise plans.' },
  { id: 'k5',  source: 'scaling.md',   page: 2,  text: 'Autoscaling adjusts replicas based on CPU and request latency. The default target is 65% CPU; scale-up is immediate while scale-down has a 5-minute cooldown to avoid flapping.' },
  { id: 'k6',  source: 'scaling.md',   page: 5,  text: 'Regional failover replicates state across three availability zones. RPO is under 30 seconds and RTO is under 2 minutes for managed databases.' },
  { id: 'k7',  source: 'api.md',       page: 1,  text: 'The REST API is rate limited to 200 requests per minute per token by default. Exceeding the limit returns HTTP 429 with a Retry-After header.' },
  { id: 'k8',  source: 'api.md',       page: 6,  text: 'Webhooks are signed with HMAC-SHA256. Verify the X-Acme-Signature header against your endpoint secret before trusting any payload.' },
  { id: 'k9',  source: 'support.md',   page: 1,  text: 'Support tiers are community, standard, and premium. Premium includes a 1-hour response SLA for severity-1 incidents and a dedicated technical account manager.' },
  { id: 'k10', source: 'support.md',   page: 2,  text: 'To open a ticket, use the in-app help widget or email support@acme.example. Include your project ID and a request trace ID for the fastest resolution.' },
]

const PYTHON_SERVICE_URL = process.env.VECTORSHIFT_PYTHON_URL || ''
const PUBLIC_ENDPOINTS = ['/info', '/health', '/demo/pipelines', '/options']

module.exports = {
  SOURCES, CHUNKERS, VECTOR_DBS, LLM_MODELS,
  DEMO_PIPELINES, KNOWLEDGE, PYTHON_SERVICE_URL, PUBLIC_ENDPOINTS,
}
