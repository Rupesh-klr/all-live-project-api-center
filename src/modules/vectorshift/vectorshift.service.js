/**
 * VectorShift — business logic.
 *
 * Keyword-overlap RAG (no external vector DB needed for the demo). Knowledge chunks and
 * pipelines live in memory; queryLog tracks live session queries for the Metrics tab.
 */
const {
  SOURCES, CHUNKERS, VECTOR_DBS, LLM_MODELS,
  DEMO_PIPELINES, KNOWLEDGE, DEMO_MODELS,
} = require('./vectorshift.constants')

const STOPWORDS = new Set(['a','an','the','is','it','in','on','of','to','and','or','for','with','at','be','this','that','are','was','by','from','has','had','not','have'])

let pipelines = DEMO_PIPELINES.map(p => ({ ...p }))
let knowledge = [...KNOWLEDGE]
let pseq = 10
const queryLog = [] // { pipelineId, query, topScore, ts }

function options() {
  return { sources: SOURCES, chunkers: CHUNKERS, vectorDbs: VECTOR_DBS, llmModels: LLM_MODELS }
}

function listPipelines() { return pipelines }

function createPipeline({ name, source, chunker, vectorDb, llm, topK = 4 }) {
  if (!name?.trim()) throw withCode(new Error('Pipeline name is required'), 'BAD_INPUT')
  if (!SOURCES.includes(source)) throw withCode(new Error(`source must be one of: ${SOURCES.join(', ')}`), 'BAD_INPUT')
  if (!CHUNKERS.includes(chunker)) throw withCode(new Error(`chunker must be one of: ${CHUNKERS.join(', ')}`), 'BAD_INPUT')
  if (!VECTOR_DBS.includes(vectorDb)) throw withCode(new Error(`vectorDb must be one of: ${VECTOR_DBS.join(', ')}`), 'BAD_INPUT')
  if (!LLM_MODELS.includes(llm)) throw withCode(new Error(`llm must be one of: ${LLM_MODELS.join(', ')}`), 'BAD_INPUT')

  const p = {
    id: `pl_${pseq++}`, name: name.trim(), source, chunker, vectorDb, llm,
    topK: Math.min(Math.max(parseInt(topK, 10) || 4, 1), 10),
    status: 'running', queries: 0, createdAt: new Date().toISOString().slice(0, 10),
  }
  pipelines.push(p)
  return p
}

function deletePipeline(id) {
  const idx = pipelines.findIndex(p => p.id === id)
  if (idx === -1) throw withCode(new Error('Pipeline not found'), 'NOT_FOUND')
  const [removed] = pipelines.splice(idx, 1)
  return { id: removed.id, deleted: true }
}

function tokenize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
}

// Jaccard similarity over two term sets (used by MMR re-ranking).
function jaccard(a, b) {
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const union = a.size + b.size - inter
  return union ? inter / union : 0
}

/**
 * Maximal Marginal Relevance — re-rank candidates to balance relevance against
 * diversity, so the top-K aren't near-duplicate passages. λ tunes the trade-off:
 * 1.0 = pure relevance, 0.0 = pure diversity.
 */
function mmrSelect(candidates, k, lambda = 0.7) {
  const selected = []
  const pool = [...candidates]
  while (selected.length < k && pool.length) {
    let bestIdx = 0, bestVal = -Infinity
    for (let i = 0; i < pool.length; i++) {
      let maxSim = 0
      for (const s of selected) maxSim = Math.max(maxSim, jaccard(pool[i]._terms, s._terms))
      const val = lambda * pool[i].score - (1 - lambda) * maxSim
      if (val > bestVal) { bestVal = val; bestIdx = i }
    }
    selected.push(pool.splice(bestIdx, 1)[0])
  }
  return selected
}

function runQuery({ pipelineId, query, mmr = false, lambda = 0.7 }) {
  const pipeline = pipelines.find(p => p.id === pipelineId)
  if (!pipeline) throw withCode(new Error('Pipeline not found'), 'NOT_FOUND')
  if (!query || !query.trim()) throw withCode(new Error('Query text is required'), 'BAD_INPUT')

  const qTerms = tokenize(query).filter(t => !STOPWORDS.has(t))
  const qSet = new Set(qTerms)

  const scored = knowledge.map(chunk => {
    const cTerms = tokenize(chunk.text)
    const cSet = new Set(cTerms)
    let overlap = 0
    for (const t of qSet) if (cSet.has(t)) overlap++
    const denom = Math.sqrt(qSet.size || 1) * Math.sqrt(cSet.size || 1)
    const sim = denom ? overlap / denom : 0
    return { ...chunk, _terms: cSet, score: Math.min(0.98, Math.round((0.35 + sim * 3.2) * 100) / 100), overlap }
  })

  const candidates = scored.filter(c => c.overlap > 0).sort((a, b) => b.score - a.score)
  const reranked = !!(mmr && candidates.length > 1)

  const top = reranked
    ? mmrSelect(candidates, pipeline.topK, Math.min(Math.max(Number(lambda) || 0.7, 0), 1))
    : candidates.slice(0, pipeline.topK)

  const sources = top.length ? top : [{ ...scored[0], score: 0.32 }]
  const answer = synthesize(query, sources)
  pipeline.queries += 1

  // Track for Metrics tab (ring buffer of 100)
  queryLog.push({ pipelineId, query: query.trim(), topScore: sources[0]?.score || 0, ts: Date.now() })
  if (queryLog.length > 100) queryLog.shift()

  return {
    pipelineId,
    pipeline: pipeline.name,
    model: pipeline.llm,
    vectorDb: pipeline.vectorDb,
    answer,
    reranked,
    retrieval: reranked ? `MMR (λ=${Math.min(Math.max(Number(lambda) || 0.7, 0), 1)})` : 'top-K cosine',
    sources: sources.map(s => ({ id: s.id, source: s.source, page: s.page, score: s.score, text: s.text })),
    tokens: Math.round((answer.length + sources.reduce((n, s) => n + s.text.length, 0)) / 4),
    grounded: top.length > 0,
  }
}

function synthesize(query, sources) {
  const lead = sources[0]
  if (!sources.length || lead.score < 0.34) {
    return `I couldn't find a confident match for "${query.trim()}" in the indexed documents. Try rephrasing, or index more sources into this pipeline.`
  }
  const cite = sources.slice(0, 2).map(s => `${s.source} p.${s.page}`).join(' and ')
  return `${lead.text} (Source: ${cite}.)`
}

// ── Knowledge Base ─────────────────────────────────────────────────────────────

function listKnowledge({ search } = {}) {
  if (!search) return knowledge
  const q = search.toLowerCase()
  return knowledge.filter(k =>
    k.text.toLowerCase().includes(q) || k.source.toLowerCase().includes(q)
  )
}

function addKnowledge({ source, text, page = 1 }) {
  if (!text?.trim()) throw withCode(new Error('text is required'), 'BAD_INPUT')
  const chunk = {
    id: `k${Date.now()}`,
    source: source?.trim() || 'custom.md',
    page: parseInt(page, 10) || 1,
    text: text.trim(),
  }
  knowledge.push(chunk)
  return chunk
}

// ── Models ────────────────────────────────────────────────────────────────────

function listModels() { return DEMO_MODELS }

// ── Metrics ───────────────────────────────────────────────────────────────────

function getMetrics() {
  const live = queryLog.length
  const avgTop = live ? queryLog.reduce((s, q) => s + q.topScore, 0) / live : 0

  const freq = {}
  for (const q of queryLog) freq[q.query] = (freq[q.query] || 0) + 1
  const topQueries = live
    ? Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([query, count]) => ({ query, count }))
    : [
        { query: 'How does billing work?',       count: 42 },
        { query: 'What is the rate limit?',      count: 31 },
        { query: 'How to set up SSO?',           count: 28 },
        { query: 'What security certifications?',count: 19 },
        { query: 'How to handle webhooks?',      count: 15 },
      ]

  const pipelineUsage = {}
  for (const q of queryLog) pipelineUsage[q.pipelineId] = (pipelineUsage[q.pipelineId] || 0) + 1

  return {
    totalQueries: pipelines.reduce((s, p) => s + p.queries, 0) + live,
    liveSessionQueries: live,
    avgTopSimilarity: Math.round(avgTop * 100) / 100,
    knowledgeChunks: knowledge.length,
    topQueries,
    pipelineStats: pipelines.map(p => ({
      id: p.id, name: p.name,
      totalQueries: p.queries + (pipelineUsage[p.id] || 0),
      status: p.status,
    })),
  }
}

function withCode(err, code) { err.code = code; return err }

module.exports = {
  options, listPipelines, createPipeline, deletePipeline, runQuery,
  listKnowledge, addKnowledge, listModels, getMetrics,
}
