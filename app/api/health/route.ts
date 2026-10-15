import { NextResponse } from 'next/server'
import { getDatabase, isKvConfigured } from '@/lib/server/db'

export async function GET() {
  try {
    const db = await getDatabase()
    const kvActive = isKvConfigured()
    return NextResponse.json({
      status: 'ok',
      service: 'xerox-shop-management-system',
      timestamp: new Date().toISOString(),
      shopName: db.shopName,
      daysTracked: Object.keys(db.days).length,
      storageMode: kvActive ? 'cloud-kv-redis' : 'local-vault-ephemeral-server',
      isKvConfigured: kvActive,
      uptime: process.uptime(),
    })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', error: err instanceof Error ? err.message : 'Database unavailable' },
      { status: 500 }
    )
  }
}
