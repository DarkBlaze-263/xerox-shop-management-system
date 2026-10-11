import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, saveDatabase } from '@/lib/server/db'
import type { Database } from '@/lib/types'
import { ValidationError, errorResponse } from '@/lib/validate'

export async function GET() {
  try {
    const db = await getDatabase()
    const json = JSON.stringify(db, null, 2)
    const today = new Date().toISOString().slice(0, 10)

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="xerox-shop-backup-${today}.json"`,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<Database>

    if (
      !body ||
      typeof body !== 'object' ||
      !Array.isArray(body.priceList) ||
      typeof body.days !== 'object' ||
      body.days === null
    ) {
      throw new ValidationError('Uploaded file is not a valid Xerox Shop backup.')
    }

    const currentDb = await getDatabase()
    // Make a snapshot of the current state before replacing it
    await saveDatabase(currentDb, true)

    const restoredDb: Database = {
      shopName: typeof body.shopName === 'string' && body.shopName.trim() ? body.shopName.trim() : 'My Xerox Shop',
      priceList: body.priceList,
      days: body.days,
    }

    await saveDatabase(restoredDb, true)

    return NextResponse.json({
      ok: true,
      message: 'Backup restored successfully',
      shopName: restoredDb.shopName,
      daysCount: Object.keys(restoredDb.days).length,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
