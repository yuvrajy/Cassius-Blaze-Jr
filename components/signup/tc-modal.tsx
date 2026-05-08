'use client'

import { useEffect, useRef, useState } from 'react'

// TODO(legal): replace placeholder body with lawyer-reviewed terms before launch.
const TERMS_BODY = `
1. Acceptance of Terms
By using getknown ("the Service") you agree to these Terms of Service. If you do not agree, do not sign up.

2. Eligibility
You must be at least 18 years old to use the Service. You may publish content about yourself, or about another person only with their explicit written permission.

3. Your Content
You retain ownership of bios, photos, and other content you upload ("Your Content"). You grant getknown a non-exclusive license to publish, distribute, and modify Your Content for the purpose of operating the Service. You represent that you have the right to grant this license.

4. Editorial Policy
Articles published on thenorm.info are written by editorial staff using information you provide. We reserve the right to refuse, edit, or remove content that violates our editorial standards or applicable law.

5. Privacy
We strip GPS and device metadata from photos prior to upload. We do not sell your data. See the Privacy Policy for full details on what we collect, how long we retain it, and your rights.

6. Removal
You may request takedown of your article and personal site at any time from your dashboard. Takedown propagates within 24 hours. Some search-engine cached copies may persist beyond our control.

7. Refunds
A full refund is available within 7 days of payment provided that no public-facing assets have been published. After publication, refunds are evaluated case by case.

8. Bespoke Domains
If you elect the bespoke-domain tier, getknown will register a domain on your behalf. Renewal beyond the first year is your responsibility. Transfer requests are honored.

9. Prohibited Use
You may not use the Service to impersonate another person, publish defamatory or unlawful content, or attempt to manipulate search results in ways that violate Google's webmaster policies.

10. Limitation of Liability
The Service is provided "as is" without warranties. getknown is not liable for indirect, incidental, or consequential damages. Total liability is limited to the amount you paid in the preceding 12 months.

11. Changes
We may update these Terms with 30 days' notice for material changes. Continued use after the effective date constitutes acceptance.

12. Governing Law
These Terms are governed by the laws of the State of California, without regard to conflict-of-law principles.

End of placeholder Terms — replace before launch.
`

export function TCBox({
  onScrolledToBottom,
}: {
  onScrolledToBottom: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [reachedBottom, setReachedBottom] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    function check() {
      if (!el) return
      // Allow ~4px of slack so users on subpixel displays don't get stuck.
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
        if (!reachedBottom) {
          setReachedBottom(true)
          onScrolledToBottom()
        }
      }
    }
    check()
    el.addEventListener('scroll', check)
    return () => el.removeEventListener('scroll', check)
  }, [onScrolledToBottom, reachedBottom])

  return (
    <div
      ref={ref}
      className="h-64 overflow-y-auto whitespace-pre-line rounded-lg border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground"
    >
      {TERMS_BODY.trim()}
    </div>
  )
}
