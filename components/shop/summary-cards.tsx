'use client'

import { Banknote, Receipt, Smartphone, Wallet, TrendingDown } from 'lucide-react'
import { inr } from '@/lib/client'
import type { DaySummary } from '@/lib/types'

type Props = { summary: DaySummary }

export function SummaryCards({ summary }: Props) {
  const cards = [
    {
      label: 'Total Sales',
      value: summary.sales,
      hint: `${summary.bills} bill${summary.bills === 1 ? '' : 's'}`,
      icon: Receipt,
      tone: 'text-primary bg-primary/10',
    },
    {
      label: 'Cash Received',
      value: summary.cashIn,
      hint: 'From customers',
      icon: Banknote,
      tone: 'text-cash bg-cash/10',
    },
    {
      label: 'UPI Received',
      value: summary.upiIn,
      hint: 'GPay / PhonePe / Paytm',
      icon: Smartphone,
      tone: 'text-upi bg-upi/10',
    },
    {
      label: 'Expenses',
      value: summary.expenses,
      hint: `Cash ${inr(summary.cashExpenses)} · UPI ${inr(summary.upiExpenses)}`,
      icon: TrendingDown,
      tone: 'text-expense bg-expense/10',
    },
    {
      label: 'Cash in Drawer',
      value: summary.cashInHand,
      hint: `Opening ${inr(summary.openingCash)} + cash − cash expenses`,
      icon: Wallet,
      tone: 'text-foreground bg-muted',
    },
  ]

  return (
    <section aria-label="Today's summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{card.label}</span>
            <span className={`flex size-8 items-center justify-center rounded-lg ${card.tone}`}>
              <card.icon className="size-4" aria-hidden="true" />
            </span>
          </div>
          <span className="font-mono text-2xl font-semibold tabular-nums">{inr(card.value)}</span>
          <span className="truncate text-xs text-muted-foreground">{card.hint}</span>
        </div>
      ))}
    </section>
  )
}
