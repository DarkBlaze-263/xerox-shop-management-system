'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inr, safeUUID, sendJson, timeOf } from '@/lib/client'
import { getClientActiveUser } from '@/lib/auth'
import { saveLocalExpense, deleteLocalExpense } from '@/lib/storage-sync'
import type { Expense } from '@/lib/types'

type Props = {
  date: string
  expenses: Expense[]
  userId?: string
  onChanged: () => void
}

const QUICK = ['Paper bundle', 'Toner / Ink', 'Tea / Snacks', 'Electricity', 'Rent', 'Machine repair']

export function ExpensesPanel({ date, expenses, userId, onChanged }: Props) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<'cash' | 'upi'>('cash')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeUser = userId || getClientActiveUser() || 'user1'
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const optExpense: Expense = {
      id: safeUUID(),
      createdAt: new Date().toISOString(),
      description: description.trim(),
      amount: Number(amount),
      mode,
    }

    // 1. Immediately save into client database
    saveLocalExpense(activeUser, date, optExpense)

    try {
      await sendJson('/api/expenses', 'POST', { date, description: description.trim(), amount: Number(amount), mode }, activeUser)
      setDescription('')
      setAmount('')
      onChanged()
    } catch {
      setDescription('')
      setAmount('')
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function remove(expense: Expense) {
    if (!window.confirm(`Delete expense "${expense.description}"?`)) return
    deleteLocalExpense(activeUser, date, expense.id)
    try {
      await sendJson(`/api/expenses?date=${date}&id=${expense.id}`, 'DELETE', undefined, activeUser)
    } finally {
      onChanged()
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form onSubmit={add} className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5">
        <h2 className="text-lg font-semibold">Add Expense</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exp-desc">What was it for?</Label>
          <Input
            id="exp-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Paper bundle"
            required
          />
          <div className="flex flex-wrap gap-1">
            {QUICK.map((q) => (
              <Button key={q} type="button" variant="outline" size="xs" onClick={() => setDescription(q)}>
                {q}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="exp-amount">Amount</Label>
            <Input
              id="exp-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" id="exp-mode">Paid by</span>
            <div role="radiogroup" aria-labelledby="exp-mode" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(['cash', 'upi'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-2 py-1 text-sm font-medium ${
                    mode === m ? 'bg-background shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  {m === 'cash' ? 'Cash' : 'UPI'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving || !description.trim() || !amount}>
          <Plus aria-hidden="true" />
          {saving ? 'Saving...' : 'Add Expense'}
        </Button>
      </form>

      <section aria-labelledby="exp-list" className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-5">
        <div className="flex items-center justify-between">
          <h2 id="exp-list" className="text-lg font-semibold">Expenses</h2>
          <span className="font-mono text-sm font-semibold text-expense">{inr(total)}</span>
        </div>
        {expenses.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No expenses recorded for this day.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center gap-3 p-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{expense.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {timeOf(expense.createdAt)} · {expense.mode === 'cash' ? 'Cash' : 'UPI'}
                  </span>
                </div>
                <span className="font-mono text-sm font-semibold tabular-nums">{inr(expense.amount)}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${expense.description}`}
                  onClick={() => remove(expense)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
