'use client'

export function LocalDate({
  iso,
  time = false,
}: {
  iso: string
  time?: boolean
}) {
  const d = new Date(iso)
  return (
    <time dateTime={iso}>
      {time ? d.toLocaleString() : d.toLocaleDateString()}
    </time>
  )
}
