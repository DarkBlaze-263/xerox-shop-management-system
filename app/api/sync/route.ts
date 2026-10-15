import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, getUserIdFromRequest, saveDatabase } from '@/lib/server/db'
import type { Database, DayRecord, Entry, Expense } from '@/lib/types'
import { ValidationError, errorResponse } from '@/lib/validate'

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const db = await getDatabase(userId)
    return NextResponse.json({
      ok: true,
      database: db,
    })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const body = await request.json()
    const incomingDb = body?.database as Partial<Database>

    if (
      !incomingDb ||
      typeof incomingDb !== 'object' ||
      !Array.isArray(incomingDb.priceList) ||
      typeof incomingDb.days !== 'object' ||
      incomingDb.days === null
    ) {
      throw new ValidationError('Invalid sync database payload')
    }

    const currentDb = await getDatabase(userId)

    // Deep merge strategy: merge every day, preserve all entries and expenses
    const allDayKeys = new Set([
      ...Object.keys(currentDb.days || {}),
      ...Object.keys(incomingDb.days || {}),
    ])
    const mergedDays: Record<string, DayRecord> = {}

    for (const dKey of allDayKeys) {
      const currentDay = currentDb.days?.[dKey]
      const incomingDay = incomingDb.days?.[dKey]

      if (!currentDay && incomingDay) {
        mergedDays[dKey] = incomingDay
        continue
      }
      if (currentDay && !incomingDay) {
        mergedDays[dKey] = currentDay
        continue
      }
      if (currentDay && incomingDay) {
        // Deep merge entries
        const entriesMap = new Map<string, Entry>()
        for (const e of currentDay.entries || []) entriesMap.set(e.id, e)
        for (const e of incomingDay.entries || []) entriesMap.set(e.id, e)
        const mergedEntries = Array.from(entriesMap.values()).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        )

        // Deep merge expenses
        const expensesMap = new Map<string, Expense>()
        for (const exp of currentDay.expenses || []) expensesMap.set(exp.id, exp)
        for (const exp of incomingDay.expenses || []) expensesMap.set(exp.id, exp)
        const mergedExpenses = Array.from(expensesMap.values()).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        )

        mergedDays[dKey] = {
          date: dKey,
          openingCash:
            incomingDay.openingCash > 0 ? incomingDay.openingCash : currentDay.openingCash,
          entries: mergedEntries,
          expenses: mergedExpenses,
        }
      }
    }

    const updatedDb: Database = {
      shopName: incomingDb.shopName || currentDb.shopName,
      priceList: incomingDb.priceList.length > 0 ? incomingDb.priceList : currentDb.priceList,
      days: mergedDays,
    }

    await saveDatabase(userId, updatedDb, false)

    return NextResponse.json({
      ok: true,
      message: `Database synchronized successfully for ${userId}`,
      database: updatedDb,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
