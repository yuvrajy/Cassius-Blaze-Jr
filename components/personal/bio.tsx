export function Bio({ text, displayName }: { text: string; displayName: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (!paragraphs.length) return null

  const eyebrow = pickEyebrow(displayName)

  return (
    <section className="bg-[#0d0d10] px-6 py-24 sm:px-12 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-[65ch]">
        <p className="pn-sans text-[0.62rem] font-medium uppercase tracking-[0.4em] text-[#c9a84c]">
          {eyebrow}
        </p>
        <h2 className="pn-serif mt-4 text-[clamp(2rem,4vw,3.4rem)] font-light leading-[1.1] text-[#f5f3ee]">
          About {firstName(displayName)}
        </h2>
        <div className="mt-8 h-px w-12 bg-[#c9a84c]" aria-hidden />
        <div className="mt-10 space-y-6">
          {paragraphs.map((para, i) => (
            <p
              key={i}
              className="pn-serif text-[1.05rem] font-light leading-[1.85] text-[#d8d6cf] sm:text-[1.12rem]"
            >
              {para}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name
}

function pickEyebrow(name: string) {
  // Stable per-name eyebrow so two visits show the same label.
  const labels = ['The Story', 'The Profile', 'In Their Words', 'Background']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return labels[Math.abs(h) % labels.length]
}
