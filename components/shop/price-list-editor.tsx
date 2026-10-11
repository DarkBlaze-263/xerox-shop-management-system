'use client'

import { useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { safeUUID, sendJson } from '@/lib/client'
import type { PriceItem, Settings } from '@/lib/types'

type Props = {
  settings: Settings
  onSaved: (settings: Settings) => void
}

export function PriceListEditor({ settings, onSaved }: Props) {
  const [shopName, setShopName] = useState(settings.shopName)
  const [items, setItems] = useState<PriceItem[]>(settings.priceList)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function update(id: string, patch: Partial<PriceItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    setMessage(null)
  }

  function add(category: PriceItem['category']) {
    setItems((prev) => [...prev, { id: safeUUID(), name: '', price: 0, category }])
    setMessage(null)
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setMessage(null)
  }

  async function save() {
    const valid = items.filter((i) => i.name.trim())
    setSaving(true)
    try {
      const saved = await sendJson<Settings>('/api/settings', 'PUT', { shopName, priceList: valid })
      setItems(saved.priceList)
      onSaved(saved)
      setMessage({ ok: true, text: 'Prices saved.' })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not save' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:flex-row md:items-end md:p-5">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="shop-name">Shop name</Label>
          <Input id="shop-name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
        </div>
        <Button onClick={save} disabled={saving} size="lg">
          <Save aria-hidden="true" />
          {saving ? 'Saving...' : 'Save all changes'}
        </Button>
      </div>
      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-cash' : 'text-destructive'}`}>{message.text}</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Group
          title="Xerox & Printing prices"
          items={items.filter((i) => i.category === 'xerox')}
          onAdd={() => add('xerox')}
          onUpdate={update}
          onRemove={remove}
        />
        <Group
          title="Stationery items"
          items={items.filter((i) => i.category === 'stationery')}
          onAdd={() => add('stationery')}
          onUpdate={update}
          onRemove={remove}
        />
      </div>
    </div>
  )
}

function Group({
  title,
  items,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string
  items: PriceItem[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<PriceItem>) => void
  onRemove: (id: string) => void
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus aria-hidden="true" />
          Add item
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No items yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <Input
                aria-label="Item name"
                value={item.name}
                placeholder="Item name"
                onChange={(e) => onUpdate(item.id, { name: e.target.value })}
                className="flex-1"
              />
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">{'\u20B9'}</span>
                <Input
                  aria-label={`${item.name || 'Item'} price`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={item.price}
                  onChange={(e) => onUpdate(item.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-24 font-mono"
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.name || 'item'}`}
                onClick={() => onRemove(item.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
