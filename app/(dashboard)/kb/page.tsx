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
    const data = (await fetch('/api/kb').then((r) => r.json())) as KBArticle[]
    setArticles(data)
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return loadAll()
    setSearching(true)
    try {
      const data = (await fetch(`/api/kb/search?q=${encodeURIComponent(q)}`).then((r) => r.json())) as KBSearchResult[]
      setArticles(data)
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
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the knowledge base…"
          className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm"
        />
        <Button type="submit" size="sm" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
        {query && (
          <Button type="button" size="sm" variant="secondary" onClick={clear}>
            Clear
          </Button>
        )}
      </form>

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
