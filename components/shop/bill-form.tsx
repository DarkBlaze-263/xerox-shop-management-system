'use client'

import { useState } from 'react'
import { Minus, Plus, Trash2, PackagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inr, safeUUID, sendJson } from '@/lib/client'
import type { Category, PaymentMode, PriceItem } from '@/lib/types'

type DraftLine = {
  key: string
  name: string
  qty: number
  price: number
  category: Category
  sourceId?: string
}

type Props = {
  date: string
  priceList: PriceItem[]
  onSaved: () => void
}

const round = (n: number) => Math.round(n * 100) / 100

export function BillForm({ date, priceList, onSaved }: Props) {
  const [lines, setLines] = useState<DraftLine[]>([])
  const [customer, setCustomer] = useState('')
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [upiPart, setUpiPart] = useState('')
  const [extraName, setExtraName] = useState('')
  const [extraPrice, setExtraPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = round(lines.reduce((s, l) => s + l.qty * l.price, 0))
  const upiAmount = mode === 'upi' ? total : mode === 'split' ? Math.min(Number(upiPart) || 0, total) : 0
  const cashAmount = round(total - upiAmount)
  const given = cashGiven === '' ? cashAmount : Number(cashGiven) || 0
  const balance = round(given - cashAmount)

  function addFromList(item: PriceItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.sourceId === item.id)
      if (existing) {
        return prev.map((l) => (l.sourceId === item.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [
        ...prev,
        {
          key: safeUUID(),
          name: item.name,
          qty: 1,
          price: item.price,
          category: item.category,
          sourceId: item.id,
        },
      ]
    })
  }

  function addExtra() {
    const name = extraName.trim()
    const price = Number(extraPrice)
    if (!name || !Number.isFinite(price) || price < 0) return
    setLines((prev) => [
      ...prev,
      { key: safeUUID(), name, qty: 1, price, category: 'extra' },
    ])
    setExtraName('')
    setExtraPrice('')
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  function reset() {
    setLines([])
    setCustomer('')
    setMode('cash')
    setCashGiven('')
    setUpiPart('')
    setError(null)
  }

  async function save() {
    setError(null)
    if (lines.length === 0) return setError('Add at least one item to the bill.')
    if (cashAmount > 0 && balance < 0) return setError('Cash given is less than the amount to pay.')
    setSaving(true)
    try {
      await sendJson('/api/entries', 'POST', {
        date,
        customer,
        mode,
        upiAmount,
        cashGiven: cashGiven === '' ? '' : Number(cashGiven),
        items: lines.map(({ name, qty, price, category }) => ({ name, qty, price, category })),
      })
      reset()
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the bill')
    } finally {
      setSaving(false)
    }
  }

  const xerox = priceList.filter((p) => p.category === 'xerox')
  const stationery = priceList.filter((p) => p.category === 'stationery')

  return (
    <section aria-labelledby="new-bill" className="flex flex-col gap-5 rounded-xl border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h2 id="new-bill" className="text-lg font-semibold">New Bill</h2>
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>Clear</Button>
        )}
      </div>

      <QuickAdd title="Xerox & Printing" items={xerox} onAdd={addFromList} />
      <QuickAdd title="Stationery" items={stationery} onAdd={addFromList} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">Add extra item</span>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addExtra()
          }}
        >
          <Input
            aria-label="Extra item name"
            placeholder="Item name (e.g. Passport photo)"
            value={extraName}
            onChange={(e) => setExtraName(e.target.value)}
            className="flex-1"
          />
          <Input
            aria-label="Extra item price"
            placeholder="Price"
            type="number"
            inputMode="decimal"
            min={0}
            value={extraPrice}
            onChange={(e) => setExtraPrice(e.target.value)}
            className="w-24"
          />
          <Button type="submit" variant="outline" disabled={!extraName.trim() || extraPrice === ''}>
            <PackagePlus aria-hidden="true" />
            Add
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">Bill items</span>
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Tap an item above to add it to the bill.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {lines.map((line) => (
              <li key={line.key} className="flex flex-wrap items-center gap-2 p-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{line.name}</span>
                  <span className="text-xs capitalize text-muted-foreground">{line.category}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Decrease ${line.name}`}
                    onClick={() => updateLine(line.key, { qty: Math.max(1, line.qty - 1) })}
                  >
                    <Minus />
                  </Button>
                  <Input
                    aria-label={`${line.name} quantity`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={line.qty}
                    onChange={(e) =>
                      updateLine(line.key, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                    }
                    className="h-8 w-16 text-center font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Increase ${line.name}`}
                    onClick={() => updateLine(line.key, { qty: line.qty + 1 })}
                  >
                    <Plus />
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{'\u00D7 \u20B9'}</span>
                  <Input
                    aria-label={`${line.name} price`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={line.price}
                    onChange={(e) => updateLine(line.key, { price: Math.max(0, Number(e.target.value) || 0) })}
                    className="h-8 w-20 font-mono"
                  />
                </div>
                <span className="w-20 text-right font-mono text-sm font-semibold tabular-nums">
                  {inr(round(line.qty * line.price))}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${line.name}`}
                  onClick={() => removeLine(line.key)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground">
        <span className="font-medium">Total</span>
        <span className="font-mono text-2xl font-bold tabular-nums">{inr(total)}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="customer">Customer name (optional)</Label>
          <Input id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" id="pay-mode">Payment mode</span>
          <div role="radiogroup" aria-labelledby="pay-mode" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {(['cash', 'upi', 'split'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                  mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'cash' ? 'Cash' : m === 'upi' ? 'UPI' : 'Cash + UPI'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'split' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="upi-part">Amount paid by UPI</Label>
          <Input
            id="upi-part"
            type="number"
            inputMode="decimal"
            min={0}
            value={upiPart}
            onChange={(e) => setUpiPart(e.target.value)}
            placeholder="0"
            className="font-mono"
          />
          <span className="text-xs text-muted-foreground">
            Cash to collect: <span className="font-mono">{inr(cashAmount)}</span>
          </span>
        </div>
      )}

      {mode !== 'upi' && cashAmount > 0 && (
        <div className="grid items-end gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cash-given">Cash given by customer</Label>
            <Input
              id="cash-given"
              type="number"
              inputMode="decimal"
              min={0}
              value={cashGiven}
              onChange={(e) => setCashGiven(e.target.value)}
              placeholder={String(cashAmount)}
              className="font-mono text-lg"
            />
            <div className="flex flex-wrap gap-1">
              {[10, 20, 50, 100, 200, 500].filter((n) => n >= cashAmount).slice(0, 4).map((n) => (
                <Button key={n} type="button" variant="outline" size="xs" onClick={() => setCashGiven(String(n))}>
                  {inr(n)}
                </Button>
              ))}
            </div>
          </div>
          <div
            className={`flex flex-col gap-1 rounded-lg border p-3 ${
              balance < 0 ? 'border-destructive/40 bg-destructive/5' : 'border-cash/30 bg-cash/5'
            }`}
            aria-live="polite"
          >
            <span className="text-sm text-muted-foreground">
              {balance < 0 ? 'Short by' : 'Balance to return'}
            </span>
            <span
              className={`font-mono text-2xl font-bold tabular-nums ${balance < 0 ? 'text-destructive' : 'text-cash'}`}
            >
              {inr(Math.abs(balance))}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}

      <Button size="lg" onClick={save} disabled={saving || lines.length === 0} className="h-11 text-base">
        {saving ? 'Saving...' : `Save Bill · ${inr(total)}`}
      </Button>
    </section>
  )
}

function QuickAdd({
  title,
  items,
  onAdd,
}: {
  title: string
  items: PriceItem[]
  onAdd: (item: PriceItem) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">{title}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onAdd(item)}
            className="flex flex-col items-start gap-0.5 rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="line-clamp-1 text-sm font-medium">{item.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{inr(item.price)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
