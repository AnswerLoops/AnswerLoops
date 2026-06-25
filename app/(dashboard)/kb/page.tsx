'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { KBArticle, KBSearchResult } from '@/types'
import { ingestUrlAction } from '@/app/actions/ingest-url'
import type { IngestUrlResult } from '@/app/actions/ingest-url'

type Article = KBArticle | KBSearchResult

function hasScore(a: Article): a is KBSearchResult {
  return 'score' in a
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
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
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
          <div className="flex items-center gap-2 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2.5">
            <svg className="h-4 w-4 animate-spin text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <div>
              <p className="text-xs font-medium text-indigo-700">Crawling and embedding content…</p>
              <p className="text-xs text-indigo-500">This can take 15–60 seconds depending on site size.</p>
            </div>
          </div>
        )}

        {result.error && (
          <p className="text-xs text-red-500">{result.error}</p>
        )}
        {result.created != null && !result.error && (
          <p className="text-xs text-green-600">
            {result.pages != null
              ? `Imported ${result.created} articles from ${result.pages} pages.`
              : `Imported ${result.created} articles.`}
          </p>
        )}
      </form>
    </div>
  )
}

export default function KBPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    loadAll()
  }, [])

  const [searchError, setSearchError] = useState<string | null>(null)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return loadAll()
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/kb/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok || !Array.isArray(data)) {
        setSearchError((data as { error?: string }).error ?? 'Search failed')
        setArticles([])
      } else {
        setArticles(data as KBSearchResult[])
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
    loadAll()
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Knowledge Base</h1>
        <p className="text-sm text-gray-500">Resolved answers, promoted and semantically searchable</p>
      </div>

      <UrlIngestSection onImported={loadAll} />

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

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : articles.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No articles yet. Import from a URL above or promote a resolved ticket from its detail page.
        </p>
      ) : (
        <ul className="space-y-3">
          {articles.map((a) => (
            <li key={a.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-sm font-semibold text-gray-900">{a.question}</h2>
                {hasScore(a) && (
                  <span className="shrink-0 text-xs text-gray-400">{(a.score * 100).toFixed(0)}% match</span>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.answer}</p>
              {a.source_ticket_id && (
                <Link
                  href={`/tickets/${a.source_ticket_id}`}
                  className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
                >
                  From ticket #{a.source_ticket_id} →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
