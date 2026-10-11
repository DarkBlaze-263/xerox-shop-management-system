import { NextRequest, NextResponse } from 'next/server'
import { addEntryToDay, deleteEntryFromDay } from '@/lib/server/db'
import type { Category, Entry, LineItem, PaymentMode } from '@/lib/types'
import { ValidationError, assertDate, cleanMoney, cleanQty, cleanText, errorResponse, newId } from '@/lib/validate'

const CATEGORIES: Category[] = ['xerox', 'stationery', 'extra']
const MODES: PaymentMode[] = ['cash', 'upi', 'split']
const round = (n: number) => Math.round(n * 100) / 100

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const date = assertDate(body?.date)

    if (!Array.isArray(body?.items) || body.items.length === 0 || body.items.length > 100) {
      throw new ValidationError('Add at least one item')
    }

    const items: LineItem[] = body.items.map((raw: Record<string, unknown>) => ({
      id: newId(),
      name: cleanText(raw?.name, 60, true),
      qty: cleanQty(raw?.qty),
      price: cleanMoney(raw?.price, 100_000),
      category: CATEGORIES.includes(raw?.category as Category) ? (raw?.category as Category) : 'extra',
    }))

    const total = round(items.reduce((s, i) => s + i.qty * i.price, 0))
    const mode: PaymentMode = MODES.includes(body?.mode) ? body.mode : 'cash'

    let upiAmount = 0
    if (mode === 'upi') upiAmount = total
    if (mode === 'split') {
      upiAmount = cleanMoney(body?.upiAmount)
      if (upiAmount > total) throw new ValidationError('UPI amount cannot be more than the total bill')
    }
    const cashAmount = round(total - upiAmount)

    let cashGiven = 0
    if (cashAmount > 0) {
      cashGiven =
        body?.cashGiven === '' || body?.cashGiven == null ? cashAmount : cleanMoney(body.cashGiven)
      if (cashGiven < cashAmount) throw new ValidationError('Cash given is less than the cash amount')
    }

    const entry: Entry = {
      id: newId(),
      createdAt: new Date().toISOString(),
      customer: cleanText(body?.customer, 60),
      items,
      total,
      mode,
      cashAmount,
      upiAmount,
      cashGiven,
      balance: round(cashGiven - cashAmount),
    }

    const saved = await addEntryToDay(date, entry)
    return NextResponse.json(saved, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = assertDate(searchParams.get('date'))
    const id = cleanText(searchParams.get('id'), 100, true)

    const success = await deleteEntryFromDay(date, id)
    if (!success) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
