import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, getUserIdFromRequest, saveDatabase } from '@/lib/server/db'
import type { Database } from '@/lib/types'
import { ValidationError, errorResponse } from '@/lib/validate'

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

    // Merge strategy: incoming days + current days (incoming takes precedence if has more entries)
    const mergedDays = { ...currentDb.days, ...incomingDb.days }

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
