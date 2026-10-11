import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, listServerSnapshots, restoreServerSnapshot, saveDatabase } from '@/lib/server/db'
import { ValidationError, cleanText, errorResponse } from '@/lib/validate'

export async function GET() {
  try {
    const snapshots = await listServerSnapshots()
    return NextResponse.json(snapshots)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = cleanText(body?.action, 30)

    if (action === 'create') {
      const db = await getDatabase()
      await saveDatabase(db, true)
      return NextResponse.json({ ok: true, message: 'Snapshot created' })
    }

    if (action === 'restore') {
      const fileName = cleanText(body?.fileName, 100, true)
      const current = await getDatabase()
      // Preserve a pre-restore backup
      await saveDatabase(current, true)
      const restored = await restoreServerSnapshot(fileName)
      return NextResponse.json({
        ok: true,
        message: 'Snapshot restored',
        shopName: restored.shopName,
      })
    }

    throw new ValidationError('Invalid action. Use "create" or "restore"')
  } catch (err) {
    return errorResponse(err)
  }
}
