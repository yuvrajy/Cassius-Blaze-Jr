import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Personal site',
}

export default function PersonalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen">{children}</div>
}
