'use client'

import type { Database, DayRecord, DaySummary, Entry, Expense, PriceItem } from './types'
import { summarizeDay } from './summary'
import { USERS, type UserId } from './auth'

const DB_PREFIX = 'xerox_db_v2_'
const SNAPSHOTS_PREFIX = 'xerox_snapshots_v2_'

const DEFAULT_PRICE_LIST: PriceItem[] = [
  { id: 'x1', name: 'B/W Xerox (single side)', price: 2, category: 'xerox' },
  { id: 'x2', name: 'B/W Xerox (both sides)', price: 3, category: 'xerox' },
  { id: 'x3', name: 'Colour Xerox', price: 10, category: 'xerox' },
  { id: 'x4', name: 'Print Out', price: 5, category: 'xerox' },
  { id: 'x5', name: 'Scan', price: 10, category: 'xerox' },
  { id: 'x6', name: 'Lamination', price: 20, category: 'xerox' },
  { id: 'x7', name: 'Spiral Binding', price: 40, category: 'xerox' },
  { id: 's1', name: 'Pen', price: 10, category: 'stationery' },
  { id: 's2', name: 'Pencil', price: 5, category: 'stationery' },
  { id: 's3', name: 'Notebook', price: 40, category: 'stationery' },
  { id: 's4', name: 'File Folder', price: 15, category: 'stationery' },
  { id: 's5', name: 'A4 Sheet', price: 1, category: 'stationery' },
  { id: 's6', name: 'Envelope', price: 5, category: 'stationery' },
]

export function getInitialClientDb(userId: string): Database {
  const account = USERS[userId as UserId]
  const shopName = account ? `${account.name} - ${account.label}` : `Xerox Shop - ${userId}`
  return {
    shopName,
    priceList: structuredClone(DEFAULT_PRICE_LIST),
    days: {},
  }
}

/**
 * Retrieve the client-side database from browser localStorage.
 * Guarantees non-null valid Database object.
 */
export function getClientDb(userId: string): Database {
  if (typeof window === 'undefined') return getInitialClientDb(userId)
  try {
    const raw = localStorage.getItem(`${DB_PREFIX}${userId}`)
    if (raw) {
      const parsed = JSON.parse(raw) as Database
      if (parsed && typeof parsed === 'object' && parsed.days) {
        return {
          shopName: parsed.shopName || getInitialClientDb(userId).shopName,
          priceList: Array.isArray(parsed.priceList) && parsed.priceList.length > 0 ? parsed.priceList : DEFAULT_PRICE_LIST,
          days: parsed.days || {},
        }
      }
    }

    // Migration fallback from older storage keys if present
    const legacy = localStorage.getItem('xerox-shop-db-v1')
    if (legacy) {
      const parsed = JSON.parse(legacy) as Database
      if (parsed && parsed.days) {
        const migrated: Database = {
          shopName: parsed.shopName || getInitialClientDb(userId).shopName,
          priceList: parsed.priceList || DEFAULT_PRICE_LIST,
          days: parsed.days || {},
        }
        localStorage.setItem(`${DB_PREFIX}${userId}`, JSON.stringify(migrated))
        return migrated
      }
    }
  } catch (err) {
    console.warn(`[storage-sync] Failed to read client DB for ${userId}:`, err)
  }
  return getInitialClientDb(userId)
}

/**
 * Persist the database to localStorage and create a rolling daily snapshot.
 */
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
    // Keep up to 30 daily snapshots per user in local storage
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 30)))
  } catch {
    // Ignore snapshot storage quota errors
  }
}

/**
 * Retrieve a single day's record directly from local browser storage.
 * Instant response (0ms) so the UI never starts empty on page reload.
 */
export function getClientDay(userId: string, date: string): DayRecord & { suggestedOpening: number } {
  const db = getClientDb(userId)
  const day = db.days[date] ?? { date, openingCash: 0, entries: [], expenses: [] }

  let suggestedOpening = 0
  if (!db.days[date]) {
    const previous = Object.keys(db.days).filter((d) => d < date).sort().pop()
    if (previous && db.days[previous]) {
      suggestedOpening = summarizeDay(db.days[previous]).cashInHand
    }
  }

  return { ...day, suggestedOpening }
}

/**
 * Intelligently merge server day response with local day record.
 * CRITICAL RULE: If serverless container on Vercel is fresh / cold and returns 0 entries,
 * but local storage has entries, DO NOT OVERWRITE LOCAL ENTRIES!
 * Keep local entries and trigger background server sync.
 */
export function mergeServerDayWithClient(
  userId: string,
  date: string,
  serverDay: DayRecord & { suggestedOpening: number }
): DayRecord & { suggestedOpening: number } {
  const db = getClientDb(userId)
  const localDay = db.days[date]

  if (!localDay) {
    // Local has no record for this day: accept server day and save locally
    db.days[date] = {
      date,
      openingCash: serverDay.openingCash || 0,
      entries: serverDay.entries || [],
      expenses: serverDay.expenses || [],
    }
    saveClientDb(userId, db)
    return serverDay
  }

  const localEntriesCount = localDay.entries?.length || 0
  const localExpensesCount = localDay.expenses?.length || 0
  const serverEntriesCount = serverDay.entries?.length || 0
  const serverExpensesCount = serverDay.expenses?.length || 0

  // Case 1: Server has 0 entries/expenses (Vercel cold start or wiped /tmp), but local has data!
  if ((localEntriesCount > 0 || localExpensesCount > 0 || localDay.openingCash > 0) &&
      serverEntriesCount === 0 && serverExpensesCount === 0 && serverDay.openingCash === 0) {
    console.log(`[storage-sync] Preserved local records for ${date} against empty server response. Initiating server restoration...`)
    // Trigger background server restore
    syncDatabaseWithServer(userId, db).catch((e) => console.warn('[storage-sync] Background sync error:', e))
    return {
      ...localDay,
      suggestedOpening: serverDay.suggestedOpening || 0,
    }
  }

  // Case 2: Deep merge both sides (combine and de-duplicate by ID, newest first)
  const entriesMap = new Map<string, Entry>()
  // Load local entries first
  for (const e of localDay.entries || []) entriesMap.set(e.id, e)
  // Server entries take precedence or add new ones
  for (const e of serverDay.entries || []) entriesMap.set(e.id, e)

  const expensesMap = new Map<string, Expense>()
  for (const exp of localDay.expenses || []) expensesMap.set(exp.id, exp)
  for (const exp of serverDay.expenses || []) expensesMap.set(exp.id, exp)

  const mergedEntries = Array.from(entriesMap.values()).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  )
  const mergedExpenses = Array.from(expensesMap.values()).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  )
  const mergedOpeningCash = serverDay.openingCash > 0 ? serverDay.openingCash : localDay.openingCash

  const mergedDay: DayRecord & { suggestedOpening: number } = {
    date,
    openingCash: mergedOpeningCash,
    entries: mergedEntries,
    expenses: mergedExpenses,
    suggestedOpening: serverDay.suggestedOpening,
  }

  // Update local DB
  db.days[date] = {
    date,
    openingCash: mergedOpeningCash,
    entries: mergedEntries,
    expenses: mergedExpenses,
  }
  saveClientDb(userId, db)

  return mergedDay
}

/**
 * Optimistically save an entry locally so it is immediately safe before/during server call.
 */
export function saveLocalEntry(userId: string, date: string, entry: Entry): void {
  const db = getClientDb(userId)
  if (!db.days[date]) {
    db.days[date] = { date, openingCash: 0, entries: [], expenses: [] }
  }
  // Check if entry already exists
  const existingIdx = db.days[date].entries.findIndex((e) => e.id === entry.id)
  if (existingIdx >= 0) {
    db.days[date].entries[existingIdx] = entry
  } else {
    db.days[date].entries.unshift(entry)
  }
  saveClientDb(userId, db)
}

/**
 * Replace a temporary local entry ID with the server-assigned entry
 */
export function replaceLocalEntry(userId: string, date: string, oldId: string, newEntry: Entry): void {
  const db = getClientDb(userId)
  if (!db.days[date]) return
  db.days[date].entries = db.days[date].entries.map((e) => (e.id === oldId ? newEntry : e))
  saveClientDb(userId, db)
}

/**
 * Delete an entry from local browser database.
 */
export function deleteLocalEntry(userId: string, date: string, entryId: string): void {
  const db = getClientDb(userId)
  if (!db.days[date]) return
  db.days[date].entries = db.days[date].entries.filter((e) => e.id !== entryId)
  saveClientDb(userId, db)
}

/**
 * Optimistically save an expense locally.
 */
export function saveLocalExpense(userId: string, date: string, expense: Expense): void {
  const db = getClientDb(userId)
  if (!db.days[date]) {
    db.days[date] = { date, openingCash: 0, entries: [], expenses: [] }
  }
  const existingIdx = db.days[date].expenses.findIndex((e) => e.id === expense.id)
  if (existingIdx >= 0) {
    db.days[date].expenses[existingIdx] = expense
  } else {
    db.days[date].expenses.unshift(expense)
  }
  saveClientDb(userId, db)
}

/**
 * Delete an expense from local browser database.
 */
export function deleteLocalExpense(userId: string, date: string, expenseId: string): void {
  const db = getClientDb(userId)
  if (!db.days[date]) return
  db.days[date].expenses = db.days[date].expenses.filter((e) => e.id !== expenseId)
  saveClientDb(userId, db)
}

/**
 * Save opening cash amount locally.
 */
export function saveLocalOpeningCash(userId: string, date: string, amount: number): void {
  const db = getClientDb(userId)
  if (!db.days[date]) {
    db.days[date] = { date, openingCash: amount, entries: [], expenses: [] }
  } else {
    db.days[date].openingCash = amount
  }
  saveClientDb(userId, db)
}

/**
 * Save shop settings locally.
 */
export function saveLocalSettings(userId: string, shopName: string, priceList: PriceItem[]): void {
  const db = getClientDb(userId)
  db.shopName = shopName
  db.priceList = priceList
  saveClientDb(userId, db)
}

/**
 * Compute history records from local storage.
 * Used as fallback if serverless API returns empty array on cold-start.
 */
export function getClientHistory(userId: string): DaySummary[] {
  const db = getClientDb(userId)
  return Object.values(db.days)
    .filter((d) => (d.entries?.length || 0) > 0 || (d.expenses?.length || 0) > 0 || d.openingCash > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(summarizeDay)
}

export type LocalSnapshotMeta = {
  id: string
  fileName: string
  timestamp: string
  date: string
  bills: number
  expenses: number
  sales: number
  sizeBytes: number
}

/**
 * Get snapshots stored in client localStorage.
 */
export function getClientSnapshots(userId: string): LocalSnapshotMeta[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${SNAPSHOTS_PREFIX}${userId}`)
    if (!raw) return []
    const list = JSON.parse(raw) as Array<{ date: string; savedAt: string; data: Database }>
    return list.map((s) => {
      const days = Object.values(s.data?.days || {})
      const bills = days.reduce((sum, d) => sum + (d.entries?.length || 0), 0)
      const expenses = days.reduce((sum, d) => sum + (d.expenses?.length || 0), 0)
      const sales = days.reduce(
        (sum, d) => sum + (d.entries?.reduce((sub, e) => sub + e.total, 0) || 0),
        0
      )
      return {
        id: s.date,
        fileName: `local-snapshot-${s.date}.json`,
        timestamp: s.savedAt,
        date: s.date,
        bills,
        expenses,
        sales: Math.round(sales * 100) / 100,
        sizeBytes: JSON.stringify(s.data).length,
      }
    })
  } catch {
    return []
  }
}

/**
 * Restore a snapshot from local storage.
 */
export function restoreClientSnapshot(userId: string, date: string): Database {
  const raw = localStorage.getItem(`${SNAPSHOTS_PREFIX}${userId}`)
  if (!raw) throw new Error('No local snapshots available')
  const list = JSON.parse(raw) as Array<{ date: string; savedAt: string; data: Database }>
  const target = list.find((s) => s.date === date)
  if (!target || !target.data) throw new Error(`Snapshot for ${date} not found`)
  saveClientDb(userId, target.data)
  // Sync restored database with server
  syncDatabaseWithServer(userId, target.data).catch(() => {})
  return target.data
}

/**
 * Synchronize full client database with server.
 * Merges both sides so no data is lost.
 */
export async function syncDatabaseWithServer(userId: string, dbToSync?: Database): Promise<Database> {
  const local = dbToSync || getClientDb(userId)
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
      const data = (await res.json()) as { ok: boolean; database: Database }
      if (data?.database) {
        saveClientDb(userId, data.database)
        return data.database
      }
    }
  } catch (err) {
    console.warn('[storage-sync] Sync with server failed (running offline):', err)
  }
  return local
}
