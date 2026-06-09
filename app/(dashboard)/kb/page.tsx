'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { KBArticle, KBSearchResult } from '@/types'

type Article = KBArticle | KBSearchResult

function hasScore(a: Article): a is KBSearchResult {
  return 'score' in a
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
          No articles yet. Promote a resolved ticket from its detail page.
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
