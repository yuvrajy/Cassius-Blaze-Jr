'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProfileStatus } from '@/lib/types/db'

const STATUSES: { value: ProfileStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_moderation', label: 'Pending' },
  { value: 'live', label: 'Live' },
  { value: 'taken_down', label: 'Taken down' },
  { value: 'rejected', label: 'Rejected' },
]

// Debounced query/status sync to the URL — server-rendered list re-runs
// the DB filter via search params. Keeps the address bar shareable and
// lets back/forward work as expected.
export function CustomerSearch() {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const status = useMemo(
    () => (params.get('status') as ProfileStatus | null) ?? 'all',
    [params],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (q) next.set('q', q)
      else next.delete('q')
      router.replace(`/admin/customers?${next.toString()}`)
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function setStatus(s: string | null) {
    const next = new URLSearchParams(params.toString())
    if (!s || s === 'all') next.delete('status')
    else next.set('status', s)
    router.replace(`/admin/customers?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-64">
        <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, subdomain, or email"
          className="pl-7"
        />
      </div>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
