import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/server/db'

export async function GET() {
  try {
    const db = await getDatabase()
    return NextResponse.json({
      status: 'ok',
      service: 'xerox-shop-management-system',
      timestamp: new Date().toISOString(),
      shopName: db.shopName,
      daysTracked: Object.keys(db.days).length,
      uptime: process.uptime(),
    })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', error: err instanceof Error ? err.message : 'Database unavailable' },
      { status: 500 }
    )
  }
}
