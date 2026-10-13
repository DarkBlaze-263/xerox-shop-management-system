import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import type { Database, DayRecord, Entry, Expense, PriceItem, Settings } from '../types'
import { summarizeDay } from '../summary'
import { isValidUserId, USERS, type UserId } from '../auth'

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

function getInitialDbForUser(userId: string): Database {
  const account = USERS[userId as UserId]
  const shopName = account ? `${account.name} - ${account.label}` : `Xerox Shop - ${userId}`
  return {
    shopName,
    priceList: structuredClone(DEFAULT_PRICE_LIST),
    days: {},
  }
}

const MAX_SNAPSHOTS = 30

/** Determine writable data folder */
function getDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR)
  }

  // Primary local directory
  const localDir = path.resolve(process.cwd(), '.data')
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true })
    }
    // Test write permission
    const testFile = path.join(localDir, '.write-test')
    fs.writeFileSync(testFile, 'ok')
    fs.unlinkSync(testFile)
    return localDir
  } catch {
    // Fallback to os tmp dir (e.g. serverless environments)
    const tmpDir = path.join(process.env.TMPDIR || process.env.TEMP || '/tmp', 'xerox-shop')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    return tmpDir
  }
}

function getDbFilePath(userId: string): string {
  const safeUserId = sanitizeUserId(userId)
  return path.join(getDataDir(), `shop-db-${safeUserId}.json`)
}

function getBackupDir(userId: string): string {
  const safeUserId = sanitizeUserId(userId)
  const dir = path.join(getDataDir(), 'backups', safeUserId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function sanitizeUserId(userId: string | null | undefined): string {
  if (isValidUserId(userId)) return userId
  return 'user1'
}

/**
 * Extract active userId from incoming Next.js API request
 * Priority: Header x-user-id -> Query param ?userId -> Cookie xerox_auth_user -> Default user1
 */
export function getUserIdFromRequest(request: NextRequest): string {
  const headerUser = request.headers.get('x-user-id')
  if (isValidUserId(headerUser)) return headerUser

  const paramUser = request.nextUrl.searchParams.get('userId')
  if (isValidUserId(paramUser)) return paramUser

  const cookieUser = request.cookies.get('xerox_auth_user')?.value
  if (isValidUserId(cookieUser)) return cookieUser

  return 'user1'
}

// In-memory caches & write queues per user
const cachedDbs = new Map<string, Database>()
const writeQueues = new Map<string, Promise<void>>()

// Helper for KV / Upstash Redis serverless persistence
function getKvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    return { url, token }
  }
  return null
}

async function getFromKv(userId: string): Promise<Database | null> {
  const kv = getKvConfig()
  if (!kv) return null

  try {
    const res = await fetch(`${kv.url}/get/xerox_db_${userId}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    if (!json?.result) return null
    const raw = typeof json.result === 'string' ? json.result : JSON.stringify(json.result)
    const parsed = JSON.parse(raw) as Database
    return parsed
  } catch (err) {
    console.warn('[KV] Error fetching database from Cloud KV:', err)
    return null
  }
}

async function saveToKv(userId: string, db: Database): Promise<boolean> {
  const kv = getKvConfig()
  if (!kv) return false

  try {
    const res = await fetch(`${kv.url}/set/xerox_db_${userId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(JSON.stringify(db)),
    })
    return res.ok
  } catch (err) {
    console.warn('[KV] Error saving database to Cloud KV:', err)
    return false
  }
}

export async function getDatabase(userId = 'user1'): Promise<Database> {
  const safeId = sanitizeUserId(userId)
  if (cachedDbs.has(safeId)) {
    return cachedDbs.get(safeId)!
  }

  // 1. Try Cloud KV if configured
  const kvDb = await getFromKv(safeId)
  if (kvDb && kvDb.days) {
    cachedDbs.set(safeId, kvDb)
    return kvDb
  }

  // 2. Try file system
  const filePath = getDbFilePath(safeId)
  try {
    if (fs.existsSync(filePath)) {
      const raw = await fs.promises.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Database
      const initial = getInitialDbForUser(safeId)
      const db: Database = {
        shopName: parsed.shopName || initial.shopName,
        priceList: Array.isArray(parsed.priceList) && parsed.priceList.length > 0 ? parsed.priceList : initial.priceList,
        days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
      }
      cachedDbs.set(safeId, db)
      return db
    }
  } catch (err) {
    console.error(`Error reading database file for ${safeId}, using fallback:`, err)
  }

  // 3. Initialize fresh default DB for this user
  const initial = getInitialDbForUser(safeId)
  cachedDbs.set(safeId, initial)
  await saveDatabase(safeId, initial, false)
  return initial
}

export async function saveDatabase(userId = 'user1', db: Database, createSnapshot = true): Promise<void> {
  const safeId = sanitizeUserId(userId)
  cachedDbs.set(safeId, db)

  // Asynchronously save to Cloud KV if available
  saveToKv(safeId, db).catch((err) => console.warn('[KV] Background KV save error:', err))

  let queue = writeQueues.get(safeId) || Promise.resolve()
  queue = queue
    .then(async () => {
      const filePath = getDbFilePath(safeId)
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true })
      }

      const json = JSON.stringify(db, null, 2)
      const tempFile = `${filePath}.tmp.${Date.now()}`

      await fs.promises.writeFile(tempFile, json, 'utf-8')
      await fs.promises.rename(tempFile, filePath)

      if (createSnapshot) {
        await triggerSnapshot(safeId, db)
      }
    })
    .catch((err) => {
      console.error(`Failed to write database to disk for ${safeId}:`, err)
      // In serverless environments, don't crash if disk write fails
    })

  writeQueues.set(safeId, queue)
  await queue
}

async function triggerSnapshot(userId: string, db: Database) {
  try {
    const backupDir = getBackupDir(userId)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
    const snapFile = path.join(backupDir, `snapshot-${timestamp}.json`)

    await fs.promises.writeFile(snapFile, JSON.stringify(db, null, 2), 'utf-8')

    // Prune old snapshots
    const files = await fs.promises.readdir(backupDir)
    const snapshots = files
      .filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()

    if (snapshots.length > MAX_SNAPSHOTS) {
      const toDelete = snapshots.slice(0, snapshots.length - MAX_SNAPSHOTS)
      for (const file of toDelete) {
        await fs.promises.unlink(path.join(backupDir, file)).catch(() => {})
      }
    }
  } catch (err) {
    console.warn(`Failed to save snapshot for ${userId}:`, err)
  }
}

export type SnapshotMeta = {
  id: string
  fileName: string
  timestamp: string
  date: string
  bills: number
  expenses: number
  sales: number
  sizeBytes: number
}

export async function listServerSnapshots(userId = 'user1'): Promise<SnapshotMeta[]> {
  const safeId = sanitizeUserId(userId)
  const backupDir = getBackupDir(safeId)
  if (!fs.existsSync(backupDir)) return []

  const files = await fs.promises.readdir(backupDir)
  const snapFiles = files.filter((f) => f.startsWith('snapshot-') && f.endsWith('.json')).sort().reverse()

  const list: SnapshotMeta[] = []
  for (const f of snapFiles) {
    try {
      const fullPath = path.join(backupDir, f)
      const stats = await fs.promises.stat(fullPath)
      const content = await fs.promises.readFile(fullPath, 'utf-8')
      const parsed = JSON.parse(content) as Database

      const days = Object.values(parsed.days || {})
      const bills = days.reduce((sum, d) => sum + (d.entries?.length || 0), 0)
      const expenses = days.reduce((sum, d) => sum + (d.expenses?.length || 0), 0)
      const sales = days.reduce((sum, d) => sum + (d.entries?.reduce((s, e) => s + e.total, 0) || 0), 0)

      const timePart = f.replace('snapshot-', '').replace('.json', '')

      list.push({
        id: f,
        fileName: f,
        timestamp: stats.mtime.toISOString(),
        date: timePart.split('_')[0],
        bills,
        expenses,
        sales: Math.round(sales * 100) / 100,
        sizeBytes: stats.size,
      })
    } catch {
      // Ignore corrupted snapshot
    }
  }
  return list
}

export async function restoreServerSnapshot(userId = 'user1', fileName: string): Promise<Database> {
  const safeId = sanitizeUserId(userId)
  const backupDir = getBackupDir(safeId)
  const safeName = path.basename(fileName)
  const snapPath = path.join(backupDir, safeName)

  if (!fs.existsSync(snapPath)) {
    throw new Error('Snapshot file not found')
  }

  const raw = await fs.promises.readFile(snapPath, 'utf-8')
  const parsed = JSON.parse(raw) as Database
  await saveDatabase(safeId, parsed, true)
  return parsed
}

export async function getDayData(userId = 'user1', date: string): Promise<DayRecord & { suggestedOpening: number }> {
  const safeId = sanitizeUserId(userId)
  const db = await getDatabase(safeId)
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

export async function updateOpeningCash(userId = 'user1', date: string, amount: number): Promise<DayRecord> {
  const safeId = sanitizeUserId(userId)
  const db = await getDatabase(safeId)
  if (!db.days[date]) {
    db.days[date] = { date, openingCash: amount, entries: [], expenses: [] }
  } else {
    db.days[date].openingCash = amount
  }
  await saveDatabase(safeId, db)
  return db.days[date]
}

export async function addEntryToDay(userId = 'user1', date: string, entry: Entry): Promise<Entry> {
  const safeId = sanitizeUserId(userId)
  const db = await getDatabase(safeId)
  if (!db.days[date]) {
    db.days[date] = { date, openingCash: 0, entries: [], expenses: [] }
  }
  db.days[date].entries.unshift(entry)
  await saveDatabase(safeId, db)
  return entry
}

export async function deleteEntryFromDay(userId = 'user1', date: string, entryId: string): Promise<boolean> {
  const safeId = sanitizeUserId(userId)
  const db = await getDatabase(safeId)
  if (!db.days[date]) return false
  const prevCount = db.days[date].entries.length
  db.days[date].entries = db.days[date].entries.filter((e) => e.id !== entryId)
  if (db.days[date].entries.length !== prevCount) {
    await saveDatabase(safeId, db)
    return true
  }
  return false
}

export async function addExpenseToDay(userId = 'user1', date: string, expense: Expense): Promise<Expense> {
  const safeId = sanitizeUserId(userId)
  const db = await getDatabase(safeId)
  if (!db.days[date]) {
    db.days[date] = { date, openingCash: 0, entries: [], expenses: [] }
  }
  db.days[date].expenses.unshift(expense)
  await saveDatabase(safeId, db)
  return expense
}

export async function deleteExpenseFromDay(userId = 'user1', date: string, expenseId: string): Promise<boolean> {
  const safeId = sanitizeUserId(userId)
  const db = await getDatabase(safeId)
  if (!db.days[date]) return false
  const prevCount = db.days[date].expenses.length
  db.days[date].expenses = db.days[date].expenses.filter((e) => e.id !== expenseId)
  if (db.days[date].expenses.length !== prevCount) {
    await saveDatabase(safeId, db)
    return true
  }
  return false
}

export async function getSettings(userId = 'user1'): Promise<Settings> {
  const safeId = sanitizeUserId(userId)
  const db = await getDatabase(safeId)
  return { shopName: db.shopName, priceList: db.priceList }
}

export async function updateSettings(userId = 'user1', shopName: string, priceList: PriceItem[]): Promise<Settings> {
  const safeId = sanitizeUserId(userId)
  const db = await getDatabase(safeId)
  db.shopName = shopName
  db.priceList = priceList
  await saveDatabase(safeId, db)
  return { shopName, priceList }
}

export async function getHistoryData(userId = 'user1') {
  const safeId = sanitizeUserId(userId)
  const db = await getDatabase(safeId)
  return Object.values(db.days)
    .filter((d) => (d.entries?.length || 0) > 0 || (d.expenses?.length || 0) > 0 || d.openingCash > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(summarizeDay)
}
