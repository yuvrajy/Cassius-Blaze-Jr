import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'getknown', template: '%s | getknown' },
  description: 'Get found on the internet for your own name.',
}

export default function ServiceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen">{children}</div>
}
