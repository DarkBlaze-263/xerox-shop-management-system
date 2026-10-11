import fs from 'node:fs'
import path from 'node:path'
import type { Database, DayRecord, Entry, Expense, PriceItem, Settings } from '../types'
import { summarizeDay } from '../summary'

const DEFAULT_DB: Database = {
  shopName: 'My Xerox Shop',
  priceList: [
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
  ],
  days: {},
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

function getDbFilePath(): string {
  if (process.env.DATABASE_FILE) {
    return path.resolve(process.env.DATABASE_FILE)
  }
  return path.join(getDataDir(), 'shop-db.json')
}

function getBackupDir(): string {
  const dir = path.join(getDataDir(), 'backups')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// In-memory cache & write queue to ensure atomicity
let cachedDb: Database | null = null
let writeQueue: Promise<void> = Promise.resolve()

export async function getDatabase(): Promise<Database> {
  if (cachedDb) return cachedDb

  const filePath = getDbFilePath()
  try {
    if (fs.existsSync(/* turbopackIgnore: true */ filePath)) {
      const raw = await fs.promises.readFile(/* turbopackIgnore: true */ filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Database
      cachedDb = {
        shopName: parsed.shopName || DEFAULT_DB.shopName,
        priceList: Array.isArray(parsed.priceList) && parsed.priceList.length > 0 ? parsed.priceList : DEFAULT_DB.priceList,
        days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
      }
      return cachedDb
    }
  } catch (err) {
    console.error('Error reading database file, using fallback:', err)
  }

  // Initialize with default
  cachedDb = structuredClone(DEFAULT_DB)
  await saveDatabase(cachedDb, false)
  return cachedDb
}

export async function saveDatabase(db: Database, createSnapshot = true): Promise<void> {
  cachedDb = db

  writeQueue = writeQueue.then(async () => {
    const filePath = getDbFilePath()
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
    }

    const json = JSON.stringify(db, null, 2)
    const tempFile = `${filePath}.tmp.${Date.now()}`

    // Atomic write: write to temp file then rename
    await fs.promises.writeFile(tempFile, json, 'utf-8')
    await fs.promises.rename(tempFile, filePath)

    if (createSnapshot) {
      await triggerSnapshot(db)
    }
  }).catch((err) => {
    console.error('Failed to write database to disk:', err)
    throw err
  })

  await writeQueue
}

async function triggerSnapshot(db: Database) {
  try {
    const backupDir = getBackupDir()
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
    console.warn('Failed to save snapshot:', err)
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

export async function listServerSnapshots(): Promise<SnapshotMeta[]> {
  const backupDir = getBackupDir()
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

export async function restoreServerSnapshot(fileName: string): Promise<Database> {
  const backupDir = getBackupDir()
  const safeName = path.basename(fileName)
  const snapPath = path.join(backupDir, safeName)

  if (!fs.existsSync(snapPath)) {
    throw new Error('Snapshot file not found')
  }

  const raw = await fs.promises.readFile(snapPath, 'utf-8')
  const parsed = JSON.parse(raw) as Database
  await saveDatabase(parsed, true)
  return parsed
}

export async function getDayData(date: string): Promise<DayRecord & { suggestedOpening: number }> {
  const db = await getDatabase()
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

export async function updateOpeningCash(date: string, amount: number): Promise<DayRecord> {
  const db = await getDatabase()
  if (!db.days[date]) {
    db.days[date] = { date, openingCash: amount, entries: [], expenses: [] }
  } else {
    db.days[date].openingCash = amount
  }
  await saveDatabase(db)
  return db.days[date]
}

export async function addEntryToDay(date: string, entry: Entry): Promise<Entry> {
  const db = await getDatabase()
  if (!db.days[date]) {
    db.days[date] = { date, openingCash: 0, entries: [], expenses: [] }
  }
  db.days[date].entries.unshift(entry)
  await saveDatabase(db)
  return entry
}

export async function deleteEntryFromDay(date: string, entryId: string): Promise<boolean> {
  const db = await getDatabase()
  if (!db.days[date]) return false
  const prevCount = db.days[date].entries.length
  db.days[date].entries = db.days[date].entries.filter((e) => e.id !== entryId)
  if (db.days[date].entries.length !== prevCount) {
    await saveDatabase(db)
    return true
  }
  return false
}

export async function addExpenseToDay(date: string, expense: Expense): Promise<Expense> {
  const db = await getDatabase()
  if (!db.days[date]) {
    db.days[date] = { date, openingCash: 0, entries: [], expenses: [] }
  }
  db.days[date].expenses.unshift(expense)
  await saveDatabase(db)
  return expense
}

export async function deleteExpenseFromDay(date: string, expenseId: string): Promise<boolean> {
  const db = await getDatabase()
  if (!db.days[date]) return false
  const prevCount = db.days[date].expenses.length
  db.days[date].expenses = db.days[date].expenses.filter((e) => e.id !== expenseId)
  if (db.days[date].expenses.length !== prevCount) {
    await saveDatabase(db)
    return true
  }
  return false
}

export async function getSettings(): Promise<Settings> {
  const db = await getDatabase()
  return { shopName: db.shopName, priceList: db.priceList }
}

export async function updateSettings(shopName: string, priceList: PriceItem[]): Promise<Settings> {
  const db = await getDatabase()
  db.shopName = shopName
  db.priceList = priceList
  await saveDatabase(db)
  return { shopName, priceList }
}

export async function getHistoryData() {
  const db = await getDatabase()
  return Object.values(db.days)
    .filter((d) => (d.entries?.length || 0) > 0 || (d.expenses?.length || 0) > 0 || d.openingCash > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(summarizeDay)
}
