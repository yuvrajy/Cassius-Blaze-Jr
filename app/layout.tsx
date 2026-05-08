import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'getknown',
  description: 'Get found on the internet for your own name.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  )
}
