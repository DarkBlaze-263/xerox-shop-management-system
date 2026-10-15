'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { inr, sendJson } from '@/lib/client'
import { getClientActiveUser } from '@/lib/auth'
import { saveLocalOpeningCash } from '@/lib/storage-sync'

type Props = {
  date: string
  openingCash: number
  suggested: number
  userId?: string
  onSaved: () => void
}

export function OpeningCash({ date, openingCash, suggested, userId, onSaved }: Props) {
  const [value, setValue] = useState(String(openingCash))
  const [saving, setSaving] = useState(false)
  const activeUser = userId || getClientActiveUser() || 'user1'
  const changed = Number(value) !== openingCash

  async function save(amount: number) {
    setSaving(true)
    saveLocalOpeningCash(activeUser, date, amount)
    try {
      await sendJson('/api/day', 'PATCH', { date, openingCash: amount }, activeUser)
      setValue(String(amount))
      onSaved()
    } catch {
      setValue(String(amount))
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        save(Math.max(0, Number(value) || 0))
      }}
    >
      <label htmlFor="opening-cash" className="font-medium">Opening cash in drawer</label>
      <Input
        id="opening-cash"
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-28 font-mono"
      />
      <Button type="submit" size="sm" disabled={!changed || saving}>
        {saving ? 'Saving...' : 'Save'}
      </Button>
      {suggested > 0 && openingCash === 0 && (
        <Button type="button" size="sm" variant="outline" onClick={() => save(suggested)} disabled={saving}>
          {`Use yesterday's closing (${inr(suggested)})`}
        </Button>
      )}
    </form>
  )
}
