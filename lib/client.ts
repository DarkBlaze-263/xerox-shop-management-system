import useSWR from 'swr'
import type { DayRecord, DaySummary, Settings } from './types'
import { getClientActiveUser } from './auth'
import {
  getClientDay,
  mergeServerDayWithClient,
  getClientDb,
  getClientHistory,
  getClientSnapshots,
} from './storage-sync'

export async function fetcher<T>(url: string): Promise<T> {
  const activeUser = getClientActiveUser() || 'user1'
  let res: Response | null = null

  try {
    res = await fetch(url, {
      headers: {
        'x-user-id': activeUser,
      },
    })
  } catch (err) {
    console.warn(`[client-fetcher] Network request failed for ${url}, using offline cache:`, err)
    return getOfflineFallback<T>(url, activeUser)
  }

  if (!res.ok) {
    let errorMsg = `Request failed: ${res.statusText}`
    try {
      const data = await res.json()
      if (data?.error) errorMsg = data.error
    } catch {
      // Non-JSON error
    }
    try {
      return getOfflineFallback<T>(url, activeUser)
    } catch {
      throw new Error(errorMsg)
    }
  }

  const json = (await res.json()) as T

  // Apply intelligent merge for day queries: never let empty server response wipe client entries
  if (url.startsWith('/api/day')) {
    try {
      const urlObj = new URL(url, 'http://localhost')
      const dateParam = urlObj.searchParams.get('date')
      const userParam = urlObj.searchParams.get('userId') || activeUser
      if (dateParam && json) {
        return mergeServerDayWithClient(
          userParam,
          dateParam,
          json as unknown as DayRecord & { suggestedOpening: number }
        ) as unknown as T
      }
    } catch {
      // Return json as is
    }
  }

  // Fallback for history if server is cold / empty
  if (url.startsWith('/api/history') && Array.isArray(json) && json.length === 0) {
    const localHistory = getClientHistory(activeUser)
    if (localHistory.length > 0) return localHistory as unknown as T
  }

  // Fallback for snapshots if server is cold / empty
  if (url.startsWith('/api/backup/snapshots') && Array.isArray(json) && json.length === 0) {
    const localSnaps = getClientSnapshots(activeUser)
    if (localSnaps.length > 0) return localSnaps as unknown as T
  }

  return json
}

function getOfflineFallback<T>(url: string, user: string): T {
  if (url.startsWith('/api/day')) {
    const urlObj = new URL(url, 'http://localhost')
    const dateParam = urlObj.searchParams.get('date')
    if (dateParam) {
      return getClientDay(user, dateParam) as unknown as T
    }
  }
  if (url.startsWith('/api/settings')) {
    const db = getClientDb(user)
    return { shopName: db.shopName, priceList: db.priceList } as unknown as T
  }
  if (url.startsWith('/api/history')) {
    return getClientHistory(user) as unknown as T
  }
  if (url.startsWith('/api/backup/snapshots')) {
    return getClientSnapshots(user) as unknown as T
  }
  throw new Error('Offline fallback not available')
}

export async function sendJson<T = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  customUserId?: string
): Promise<T> {
  const activeUser = customUserId || getClientActiveUser() || 'user1'
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': activeUser,
    },
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  const res = await fetch(url, options)
  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) errorMsg = data.error
    } catch {
      // Non-JSON error
    }
    throw new Error(errorMsg)
  }
  return res.json() as Promise<T>
}

export type DayResponse = DayRecord & { suggestedOpening: number }

export function useDay(date: string | null, userId?: string) {
  const user = userId || getClientActiveUser() || 'user1'
  return useSWR<DayResponse>(
    date ? `/api/day?date=${date}&userId=${user}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      fallbackData: typeof window !== 'undefined' && date ? getClientDay(user, date) : undefined,
    }
  )
}

export function useSettings(userId?: string) {
  const user = userId || getClientActiveUser() || 'user1'
  return useSWR<Settings>(`/api/settings?userId=${user}`, fetcher, {
    revalidateOnFocus: true,
    fallbackData:
      typeof window !== 'undefined'
        ? {
            shopName: getClientDb(user).shopName,
            priceList: getClientDb(user).priceList,
          }
        : undefined,
  })
}

export function useHistory(userId?: string) {
  const user = userId || getClientActiveUser() || 'user1'
  return useSWR<DaySummary[]>(`/api/history?userId=${user}`, fetcher, {
    revalidateOnFocus: true,
    fallbackData: typeof window !== 'undefined' ? getClientHistory(user) : undefined,
  })
}

export type SnapshotInfo = {
  id: string
  fileName: string
  timestamp: string
  date: string
  bills: number
  expenses: number
  sales: number
  sizeBytes: number
}

export function useSnapshots(userId?: string) {
  const user = userId || getClientActiveUser() || 'user1'
  return useSWR<SnapshotInfo[]>(`/api/backup/snapshots?userId=${user}`, fetcher, {
    fallbackData: typeof window !== 'undefined' ? (getClientSnapshots(user) as SnapshotInfo[]) : undefined,
  })
}

export const inr = (n: number) =>
  '\u20B9' + (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

export function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // Fallback
    }
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)
}

export function dateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function prettyDate(key: string) {
  if (!key) return ''
  const parts = key.split('-').map(Number)
  if (parts.length === 3 && !parts.some(isNaN)) {
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
  return key
}

export function timeOf(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export async function downloadBackupFile(userId?: string) {
  const user = userId || getClientActiveUser() || 'user1'
  const localDb = getClientDb(user)
  const json = JSON.stringify(localDb, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `xerox-shop-${user}-backup-${dateKey()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}
