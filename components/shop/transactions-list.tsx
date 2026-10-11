'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { inr, sendJson, timeOf } from '@/lib/client'
import type { Entry } from '@/lib/types'

type Props = {
  date: string
  entries: Entry[]
  onChanged: () => void
}

const MODE_STYLE = {
  cash: 'bg-cash/10 text-cash',
  upi: 'bg-upi/10 text-upi',
  split: 'bg-primary/10 text-primary',
} as const

export function TransactionsList({ date, entries, onChanged }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)

  async function remove(entry: Entry) {
    if (!window.confirm(`Delete this bill of ${inr(entry.total)}?`)) return
    setDeleting(entry.id)
    try {
      await sendJson(`/api/entries?date=${date}&id=${entry.id}`, 'DELETE')
      onChanged()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section aria-labelledby="tx-heading" className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h2 id="tx-heading" className="text-lg font-semibold">Transactions</h2>
        <span className="text-sm text-muted-foreground">{entries.length} total</span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No bills yet for this day.
        </p>
      ) : (
        <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{entry.customer || 'Walk-in'}</span>
                  <span className="text-xs text-muted-foreground">{timeOf(entry.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${MODE_STYLE[entry.mode]}`}>
                    {entry.mode === 'split' ? 'Cash + UPI' : entry.mode}
                  </span>
                  <span className="font-mono text-base font-semibold tabular-nums">{inr(entry.total)}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete bill"
                    disabled={deleting === entry.id}
                    onClick={() => remove(entry)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {entry.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {item.name} <span className="font-mono">{`× ${item.qty} @ ${inr(item.price)}`}</span>
                    </span>
                    <span className="font-mono">{inr(item.qty * item.price)}</span>
                  </li>
                ))}
              </ul>
              {entry.cashAmount > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs">
                  {entry.mode === 'split' && (
                    <span>UPI: <span className="font-mono">{inr(entry.upiAmount)}</span></span>
                  )}
                  <span>Cash: <span className="font-mono">{inr(entry.cashAmount)}</span></span>
                  <span>Given: <span className="font-mono">{inr(entry.cashGiven)}</span></span>
                  <span className="font-medium text-cash">
                    Balance returned: <span className="font-mono">{inr(entry.balance)}</span>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
