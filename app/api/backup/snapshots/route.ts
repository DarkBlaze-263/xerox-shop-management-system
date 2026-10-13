import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, getUserIdFromRequest, listServerSnapshots, restoreServerSnapshot, saveDatabase } from '@/lib/server/db'
import { ValidationError, cleanText, errorResponse } from '@/lib/validate'

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const snapshots = await listServerSnapshots(userId)
    return NextResponse.json(snapshots)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const body = await request.json()
    const action = cleanText(body?.action, 30)

    if (action === 'create') {
      const db = await getDatabase(userId)
      await saveDatabase(userId, db, true)
      return NextResponse.json({ ok: true, message: `Snapshot created for ${userId}` })
    }

    if (action === 'restore') {
      const fileName = cleanText(body?.fileName, 100, true)
      const current = await getDatabase(userId)
      // Preserve a pre-restore backup
      await saveDatabase(userId, current, true)
      const restored = await restoreServerSnapshot(userId, fileName)
      return NextResponse.json({
        ok: true,
        message: `Snapshot restored for ${userId}`,
        shopName: restored.shopName,
      })
    }

    throw new ValidationError('Invalid action. Use "create" or "restore"')
  } catch (err) {
    return errorResponse(err)
  }
}
