import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: { default: 'getknown', template: '%s | getknown' },
  description: 'Get found on the internet for your own name.',
}

export default function ServiceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      {children}
      <Toaster position="top-right" />
    </div>
  )
}
