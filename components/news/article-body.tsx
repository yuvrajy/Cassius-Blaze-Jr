// Article body splitter. The body field is *plain text* from agent 6 — no
// markdown, no HTML. We split on blank lines and emit <p> tags. The first
// paragraph gets a drop-cap via the .norm-prose CSS rule.
//
// We optionally splice the "More about {name}" callout in roughly a third
// of the way through the body. If the article is short (< 4 paragraphs)
// we render the callout after the body instead.

import type { ReactNode } from 'react'

export function ArticleBody({
  body,
  callout,
}: {
  body: string
  callout: ReactNode
}) {
  const paragraphs = splitParagraphs(body)
  if (paragraphs.length === 0) {
    return <div className="norm-prose">{callout}</div>
  }

  const insertAt =
    paragraphs.length >= 4 ? Math.max(2, Math.floor(paragraphs.length / 3)) : -1

  return (
    <div className="norm-prose">
      {paragraphs.map((p, i) => (
        <Paragraph key={i} text={p} insertAfter={i === insertAt ? callout : null} />
      ))}
      {insertAt === -1 ? callout : null}
    </div>
  )
}

function Paragraph({
  text,
  insertAfter,
}: {
  text: string
  insertAfter: ReactNode
}) {
  return (
    <>
      <p>{text}</p>
      {insertAfter}
    </>
  )
}

function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
}
