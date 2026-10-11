import { NextRequest, NextResponse } from 'next/server'
import { addExpenseToDay, deleteExpenseFromDay } from '@/lib/server/db'
import type { Expense } from '@/lib/types'
import { ValidationError, assertDate, cleanMoney, cleanText, errorResponse, newId } from '@/lib/validate'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const date = assertDate(body?.date)
    const amount = cleanMoney(body?.amount)

    if (amount <= 0) {
      throw new ValidationError('Amount must be greater than 0')
    }

    const expense: Expense = {
      id: newId(),
      createdAt: new Date().toISOString(),
      description: cleanText(body?.description, 80, true),
      amount,
      mode: body?.mode === 'upi' ? 'upi' : 'cash',
    }

    const saved = await addExpenseToDay(date, expense)
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

    const success = await deleteExpenseFromDay(date, id)
    if (!success) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
