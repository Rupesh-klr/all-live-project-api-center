/**
 * VectorShift — business logic.
 *
 * In-memory pipeline store + a keyword-overlap retriever that simulates RAG: it scores
 * knowledge chunks against the query, returns the top-K with similarity scores, and
 * synthesises a grounded answer that cites its sources. Deterministic, no external infra.
 */
const {
  DEMO_PIPELINES, KNOWLEDGE, SOURCES, CHUNKERS, VECTOR_DBS, LLM_MODELS,
} = require('./vectorshift.constants')

// Mutable in-memory store (resets on restart) seeded from the demo pipelines.
let pipelines = DEMO_PIPELINES.map(p => ({ ...p }))
let seq = 1

const STOPWORDS = new Set(['the','a','an','is','are','do','does','how','what','of','to','and','in','on','for','with','can','i','my','your','it','this'])

function tokenize(text) {
  return String(text).toLowerCase().match(/[a-z0-9]+/g) || []
}

function options() {
  return { sources: SOURCES, chunkers: CHUNKERS, vectorDbs: VECTOR_DBS, llmModels: LLM_MODELS }
}

function listPipelines() {
  return pipelines
}

function createPipeline(body = {}) {
  const { name, source, chunker, vectorDb, llm, topK } = body
  if (!name) throw withCode(new Error('Pipeline name is required'), 'BAD_INPUT')
  const pipeline = {
    id: `pl_${seq++}_${Date.now().toString(36)}`,
    name,
    source:   SOURCES.includes(source) ? source : SOURCES[0],
    chunker:  CHUNKERS.includes(chunker) ? chunker : CHUNKERS[0],
    vectorDb: VECTOR_DBS.includes(vectorDb) ? vectorDb : VECTOR_DBS[0],
    llm:      LLM_MODELS.includes(llm) ? llm : LLM_MODELS[0],
    topK:     Math.min(Math.max(parseInt(topK, 10) || 4, 1), 8),
    status:   'running',
    queries:  0,
    createdAt: new Date().toISOString().slice(0, 10),
  }
  pipelines = [pipeline, ...pipelines]
  return pipeline
}

function deletePipeline(id) {
  const before = pipelines.length
  pipelines = pipelines.filter(p => p.id !== id)
  if (pipelines.length === before) throw withCode(new Error('Pipeline not found'), 'NOT_FOUND')
  return { id }
}

/**
 * Retrieve + answer. Scores each chunk by query-term overlap (cosine-ish over term sets),
 * returns the top-K with similarity scores and a synthesised, source-grounded answer.
 */
function runQuery({ pipelineId, query }) {
  const pipeline = pipelines.find(p => p.id === pipelineId)
  if (!pipeline) throw withCode(new Error('Pipeline not found'), 'NOT_FOUND')
  if (!query || !query.trim()) throw withCode(new Error('Query text is required'), 'BAD_INPUT')

  const qTerms = tokenize(query).filter(t => !STOPWORDS.has(t))
  const qSet = new Set(qTerms)

  const scored = KNOWLEDGE.map(chunk => {
    const cTerms = tokenize(chunk.text)
    const cSet = new Set(cTerms)
    let overlap = 0
    for (const t of qSet) if (cSet.has(t)) overlap++
    // Cosine-like similarity over the query/chunk term sets, capped to a realistic range.
    const denom = Math.sqrt(qSet.size || 1) * Math.sqrt(cSet.size || 1)
    const sim = denom ? overlap / denom : 0
    return { ...chunk, score: Math.min(0.98, Math.round((0.35 + sim * 3.2) * 100) / 100), overlap }
  })

  const top = scored
    .filter(c => c.overlap > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, pipeline.topK)

  // Fallback when nothing overlaps — return the single most generic chunk at low confidence.
  const sources = top.length ? top : [{ ...scored[0], score: 0.32 }]

  const answer = synthesize(query, sources)
  pipeline.queries += 1

  return {
    pipelineId,
    pipeline: pipeline.name,
    model: pipeline.llm,
    vectorDb: pipeline.vectorDb,
    answer,
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

function withCode(err, code) { err.code = code; return err }

module.exports = { options, listPipelines, createPipeline, deletePipeline, runQuery }
