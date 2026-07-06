'use client'

import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { KBArticle, KBSearchResult, KBSource } from '@/types'
import { ingestUrlAction } from '@/app/actions/ingest-url'
import type { IngestUrlResult } from '@/app/actions/ingest-url'

type Article = KBArticle | KBSearchResult

function hasScore(a: Article): a is KBSearchResult {
  return 'score' in a
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileTypeIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    pdf: 'text-red-500',
    docx: 'text-blue-500',
    md: 'text-gray-600',
    txt: 'text-gray-500',
    csv: 'text-green-600',
  }
  return (
    <span className={`text-xs font-bold uppercase tabular-nums ${colors[type] ?? 'text-gray-500'}`}>
      {type}
    </span>
  )
}

function SourcesList({ onDeleted }: { onDeleted: () => void }) {
  const [sources, setSources] = useState<KBSource[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(false)

  async function load() {
    const res = await fetch('/api/kb/sources')
    if (res.ok) {
      const data = (await res.json()) as KBSource[]
      setSources(data)
      setSelected(new Set())
    }
  }

  useEffect(() => { load() }, [])

  const allChecked = sources.length > 0 && selected.size === sources.length
  const someChecked = selected.size > 0

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(sources.map(s => s.id)))
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleDeleteSelected() {
    setBulkDeleting(true)
    await Promise.all([...selected].map(id => fetch(`/api/kb/sources/${id}`, { method: 'DELETE' })))
    setBulkDeleting(false)
    setConfirmBulk(false)
    await load()
    onDeleted()
  }

  if (sources.length === 0) return null

  const selectedChunks = sources.filter(s => selected.has(s.id)).reduce((n, s) => n + s.chunk_count, 0)

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
            onChange={toggleAll}
            className="h-3.5 w-3.5 rounded border-gray-300 accent-brand-600 cursor-pointer"
          />
          <h2 className="text-sm font-semibold text-gray-900">
            Sources {someChecked && <span className="font-normal text-gray-500">({selected.size} selected)</span>}
          </h2>
        </div>
        {someChecked && (
          confirmBulk ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Delete {selectedChunks} chunks?</span>
              <button
                onClick={handleDeleteSelected}
                disabled={bulkDeleting}
                className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmBulk(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmBulk(true)}
              className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
            >
              Delete selected
            </button>
          )
        )}
      </div>
      <ul className="divide-y divide-gray-100">
        {sources.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggleOne(s.id)}
              className="h-3.5 w-3.5 rounded border-gray-300 accent-brand-600 cursor-pointer shrink-0"
            />
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <FileTypeIcon type={s.file_type} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s.filename}</p>
                <p className="text-xs text-gray-400">
                  {s.chunk_count} chunk{s.chunk_count !== 1 ? 's' : ''} · {formatBytes(s.size_bytes)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FileUploadSection({ onImported }: { onImported: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ error?: string; created?: number; filename?: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/kb/upload', { method: 'POST', body: fd })
      const data = await res.json() as { error?: string; created?: number; filename?: string }
      setResult(data)
      if (!data.error) onImported()
    } catch {
      setResult({ error: 'Upload failed. Try again.' })
    } finally {
      setUploading(false)
    }
  }, [onImported])

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Upload file</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          PDF, DOCX, MD, TXT, CSV — up to 50 MB. Each file is chunked and embedded into the knowledge base.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer transition-colors
          ${dragging ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30'}
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.md,.txt,.csv"
          className="hidden"
          onChange={onFileChange}
        />
        {uploading ? (
          <>
            <svg className="h-6 w-6 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-sm text-brand-700 font-medium">Parsing and embedding…</p>
            <p className="text-xs text-brand-500">This can take 15–60 seconds for large files.</p>
          </>
        ) : (
          <>
            <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 16V8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-brand-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-400">PDF · DOCX · MD · TXT · CSV</p>
          </>
        )}
      </div>

      {result?.error && (
        <p className="text-xs text-red-500">{result.error}</p>
      )}
      {result?.created != null && !result.error && (
        <p className="text-xs text-green-600">
          Ingested {result.created} chunk{result.created !== 1 ? 's' : ''} from {result.filename}.
        </p>
      )}
    </div>
  )
}

const INGEST_PHASES = [
  { after: 0,  msg: 'Connecting to Firecrawl…',         sub: 'Starting the crawl.' },
  { after: 5,  msg: 'Crawling pages…',                  sub: 'Fetching content from each page.' },
  { after: 20, msg: 'Embedding content…',               sub: 'Running AI embeddings on each chunk.' },
  { after: 45, msg: 'Saving to knowledge base…',        sub: 'Writing articles to the database.' },
  { after: 75, msg: 'Almost done, hang tight…',         sub: 'Large sites can take up to 2 minutes.' },
  { after: 110, msg: 'Still working…',                  sub: 'Nearly there.' },
]

function useIngestProgress(pending: boolean) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!pending) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [pending])
  const phase = [...INGEST_PHASES].reverse().find(p => elapsed >= p.after) ?? INGEST_PHASES[0]
  return { elapsed, phase }
}

function UrlIngestSection({ onImported }: { onImported: () => void }) {
  const [result, action, pending] = useActionState<IngestUrlResult, FormData>(
    async (prev, fd) => {
      const r = await ingestUrlAction(prev, fd)
      if (!r.error) onImported()
      return r
    },
    {}
  )
  const [mode, setMode] = useState<'page' | 'site'>('page')
  const { elapsed, phase } = useIngestProgress(pending)

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Import from URL</h2>
        <p className="text-xs text-gray-500 mt-0.5">Crawl a page or entire site and add the content to the knowledge base.</p>
      </div>

      <form action={action} className="space-y-3">
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
            <input type="radio" name="mode" value="page" checked={mode === 'page'} onChange={() => setMode('page')} />
            Single page
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
            <input type="radio" name="mode" value="site" checked={mode === 'site'} onChange={() => setMode('site')} />
            Entire site <span className="text-gray-400">(up to 25 pages)</span>
          </label>
        </div>

        <div className="flex gap-2">
          <input
            name="url"
            type="url"
            required
            disabled={pending}
            placeholder="https://docs.example.com"
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
          />
          <Button type="submit" size="sm" disabled={pending} className="flex items-center gap-1.5 min-w-[90px] justify-center">
            {pending && (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {pending ? 'Importing…' : 'Import'}
          </Button>
        </div>

        {pending && (
          <div className="flex items-start gap-2.5 rounded-md border border-brand-100 bg-brand-50 px-3 py-2.5">
            <svg className="h-4 w-4 animate-spin text-brand-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-brand-700">{phase.msg}</p>
                <span className="text-xs text-brand-400 tabular-nums shrink-0">{elapsed}s</span>
              </div>
              <p className="text-xs text-brand-500 mt-0.5">{phase.sub}</p>
            </div>
          </div>
        )}

        {result.error && (
          <p className="text-xs text-red-500">{result.error}</p>
        )}
        {result.created != null && !result.error && (
          <p className="text-xs text-green-600">
            {result.pages != null
              ? `Imported ${result.created} articles from ${result.pages} pages${result.skipped ? ` (${result.skipped} already in KB, skipped)` : ''}.`
              : `Imported ${result.created} articles${result.skipped ? ` (${result.skipped} already in KB, skipped)` : ''}.`}
          </p>
        )}
      </form>
    </div>
  )
}

function ArticlesList({ articles, onDeleted }: { articles: (Article | KBSearchResult)[]; onDeleted: () => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(false)

  const allChecked = articles.length > 0 && selected.size === articles.length
  const someChecked = selected.size > 0

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(articles.map(a => a.id)))
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleDeleteSelected() {
    setBulkDeleting(true)
    await Promise.all([...selected].map(id => fetch(`/api/kb/articles/${id}`, { method: 'DELETE' })))
    setBulkDeleting(false)
    setConfirmBulk(false)
    setSelected(new Set())
    onDeleted()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
            onChange={toggleAll}
            className="h-3.5 w-3.5 rounded border-gray-300 accent-brand-600"
          />
          <span className="text-xs text-gray-500">
            {someChecked ? `${selected.size} of ${articles.length} selected` : `${articles.length} article${articles.length !== 1 ? 's' : ''}`}
          </span>
        </label>
        {someChecked && (
          confirmBulk ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Delete {selected.size} article{selected.size !== 1 ? 's' : ''}?</span>
              <button onClick={handleDeleteSelected} disabled={bulkDeleting} className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50">
                {bulkDeleting ? 'Deleting…' : 'Confirm'}
              </button>
              <button onClick={() => setConfirmBulk(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmBulk(true)} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">
              Delete selected
            </button>
          )
        )}
      </div>
      <ul className="space-y-2">
        {articles.map((a) => (
          <li key={a.id} className="flex items-start gap-3 bg-white rounded-lg border border-gray-200 p-4">
            <input
              type="checkbox"
              checked={selected.has(a.id)}
              onChange={() => toggleOne(a.id)}
              className="h-3.5 w-3.5 rounded border-gray-300 accent-brand-600 shrink-0 mt-1 cursor-pointer"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-sm font-semibold text-gray-900">{a.question}</h2>
                {hasScore(a) && (
                  <span className="shrink-0 text-xs text-gray-400">{(a.score * 100).toFixed(0)}% match</span>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.answer}</p>
              {a.source_ticket_id && (
                <Link href={`/tickets/${a.source_ticket_id}`} className="mt-2 inline-block text-xs text-brand-600 hover:underline">
                  From ticket #{a.source_ticket_id} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function KBPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sourcesKey, setSourcesKey] = useState(0)

  async function loadAll() {
    setLoading(true)
    try {
      const res = await fetch('/api/kb')
      const data = await res.json()
      setArticles(Array.isArray(data) ? (data as KBArticle[]) : [])
    } finally {
      setLoading(false)
    }
  }

  function refreshSources() {
    setSourcesKey((k) => k + 1)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchDegraded, setSearchDegraded] = useState(false)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return loadAll()
    setSearching(true)
    setSearchError(null)
    setSearchDegraded(false)
    try {
      const res = await fetch(`/api/kb/search?q=${encodeURIComponent(q)}`)
      const data = await res.json() as { results?: KBSearchResult[]; degraded?: boolean; error?: string }
      if (!res.ok || data.error) {
        setSearchError(data.error ?? 'Search failed')
        setArticles([])
      } else {
        setArticles(data.results ?? [])
        setSearchDegraded(data.degraded ?? false)
      }
    } catch {
      setSearchError('Search failed — check your AI config and API key.')
      setArticles([])
    } finally {
      setSearching(false)
    }
  }

  function clear() {
    setQuery('')
    setSearchError(null)
    setSearchDegraded(false)
    loadAll()
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Knowledge Base</h1>
        <p className="text-sm text-gray-500">Resolved answers, uploaded docs, and crawled pages — all semantically searchable</p>
      </div>

      <FileUploadSection onImported={() => { loadAll(); refreshSources() }} />
      <UrlIngestSection onImported={loadAll} />
      <SourcesList key={sourcesKey} onDeleted={() => { loadAll(); refreshSources() }} />

      <form onSubmit={search} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the knowledge base…"
            className="w-full rounded-md border border-gray-200 px-3 py-2 pr-8 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        <Button type="submit" size="sm" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
        {query && (
          <Button type="button" size="sm" variant="secondary" onClick={clear}>
            Clear
          </Button>
        )}
      </form>

      {searchError && (
        <p className="text-xs text-red-500">{searchError}</p>
      )}
      {searchDegraded && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <svg className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div>
            <p className="text-xs font-medium text-amber-800">Keyword search only — semantic search unavailable</p>
            <p className="text-xs text-amber-700 mt-0.5">
              AI embedding failed (invalid or missing API key). Results are exact text matches only, not natural language.{' '}
              <a href="/settings" className="underline font-medium">Fix in Settings →</a>
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : articles.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No articles yet. Upload a file, import from a URL, or promote a resolved ticket from its detail page.
        </p>
      ) : (
        <ArticlesList articles={articles} onDeleted={loadAll} />
      )}
    </div>
  )
}
