'use client'

import type { Database } from './types'

const DB_PREFIX = 'xerox_db_v2_'
const SNAPSHOTS_PREFIX = 'xerox_snapshots_v2_'

export function getClientDb(userId: string): Database | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${DB_PREFIX}${userId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Database
    if (parsed && typeof parsed === 'object' && parsed.days) {
      return parsed
    }
  } catch (err) {
    console.warn(`[storage-sync] Failed to read client DB for ${userId}:`, err)
  }
  return null
}

export function saveClientDb(userId: string, db: Database): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${DB_PREFIX}${userId}`, JSON.stringify(db))
    saveClientSnapshot(userId, db)
  } catch (err) {
    console.warn(`[storage-sync] Failed to save client DB for ${userId}:`, err)
  }
}

function saveClientSnapshot(userId: string, db: Database): void {
  try {
    const key = `${SNAPSHOTS_PREFIX}${userId}`
    const raw = localStorage.getItem(key)
    const list: Array<{ date: string; savedAt: string; data: Database }> = raw ? JSON.parse(raw) : []
    const today = new Date().toISOString().slice(0, 10)

    const filtered = list.filter((s) => s.date !== today)
    filtered.unshift({
      date: today,
      savedAt: new Date().toISOString(),
      data: db,
    })
    // Keep up to 14 daily snapshots per user in local storage
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 14)))
  } catch {
    // Ignore snapshot quota errors
  }
}

/**
 * Sync server and client DB.
 * If server DB has 0 day entries (e.g. Vercel serverless container rebooted)
 * but client has stored entries in localStorage, automatically restore server DB!
 */
export async function syncDatabaseWithServer(userId: string, serverDb: Database): Promise<Database> {
  const local = getClientDb(userId)
  if (!local) {
    // No local copy yet, save the server copy
    saveClientDb(userId, serverDb)
    return serverDb
  }

  const serverDaysCount = Object.keys(serverDb.days || {}).length
  const localDaysCount = Object.keys(local.days || {}).length

  // Check total entries count
  const serverEntriesCount = Object.values(serverDb.days || {}).reduce(
    (sum, d) => sum + (d.entries?.length || 0) + (d.expenses?.length || 0),
    0
  )
  const localEntriesCount = Object.values(local.days || {}).reduce(
    (sum, d) => sum + (d.entries?.length || 0) + (d.expenses?.length || 0),
    0
  )

  // If local has more data than server (e.g. Vercel cold-start cleared ephemeral /tmp)
  if (localEntriesCount > serverEntriesCount || (localDaysCount > 0 && serverDaysCount === 0)) {
    console.log(`[storage-sync] Restoring server database for ${userId} from client persistence...`)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ userId, database: local }),
      })
      if (res.ok) {
        const synced = (await res.json()) as { database: Database }
        if (synced?.database) {
          saveClientDb(userId, synced.database)
          return synced.database
        }
      }
    } catch (e) {
      console.warn('[storage-sync] Failed to restore server database:', e)
    }
    return local
  }

  // Otherwise, server has equal or more data, update local copy
  saveClientDb(userId, serverDb)
  return serverDb
}
