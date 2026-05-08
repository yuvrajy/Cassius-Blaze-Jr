import type { ReactNode } from 'react'
import { Cormorant_Garamond, Montserrat } from 'next/font/google'

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-personal-serif',
  display: 'swap',
})

const sans = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-personal-sans',
  display: 'swap',
})

// The personal-site lane runs on a black canvas with its own typography. We
// scope the dark theme to this subtree (rather than touching <html>/<body>
// in the root layout) so the rest of the app keeps its neutral light theme.
// Custom .pn-serif / .pn-sans classes avoid colliding with Tailwind's
// font-sans / font-serif utilities, which already have their own families.
export default function PersonalLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${serif.variable} ${sans.variable} pn-root min-h-screen bg-[#060608] text-[#f5f3ee] antialiased`}
    >
      <style>{`
.pn-root { font-family: var(--font-personal-sans), system-ui, -apple-system, Segoe UI, sans-serif; }
.pn-root .pn-serif { font-family: var(--font-personal-serif), Georgia, "Times New Roman", serif; }
.pn-root .pn-sans { font-family: var(--font-personal-sans), system-ui, -apple-system, Segoe UI, sans-serif; }
.pn-root ::selection { background: #c9a84c; color: #060608; }
      `}</style>
      {children}
    </div>
  )
}
