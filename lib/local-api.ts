import { summarizeDay } from './summary'
import type {
  Category,
  Database,
  DayRecord,
  Entry,
  Expense,
  LineItem,
  PaymentMode,
  PriceItem,
} from './types'
import {
  ValidationError,
  assertDate,
  cleanMoney,
  cleanQty,
  cleanText,
} from './validate'

const STORAGE_KEY = 'xerox-shop-db-v1'
const BACKUP_KEY = 'xerox-shop-db-v1-backup'

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

const CATEGORIES: Category[] = ['xerox', 'stationery', 'extra']
const MODES: PaymentMode[] = ['cash', 'upi', 'split']
const round = (n: number) => Math.round(n * 100) / 100

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function readDb(): Database {
  for (const key of [STORAGE_KEY, BACKUP_KEY]) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Database
      return { ...DEFAULT_DB, ...parsed, days: parsed.days ?? {} }
    } catch {
      // Corrupt copy: try the backup, then defaults.
    }
  }
  return structuredClone(DEFAULT_DB)
}

function writeDb(db: Database) {
  const previous = localStorage.getItem(STORAGE_KEY)
  if (previous) localStorage.setItem(BACKUP_KEY, previous)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  saveSnapshot(db)
}

const SNAPSHOTS_KEY = 'xerox-shop-snapshots-v1'
const LAST_DOWNLOAD_KEY = 'xerox-shop-last-auto-download'
const AUTO_DOWNLOAD_KEY = 'xerox-shop-auto-download'
const MAX_SNAPSHOTS = 14

type Snapshot = { date: string; savedAt: string; data: Database }

function localDateKey(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function readSnapshots(): Snapshot[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveSnapshot(db: Database) {
  const today = localDateKey()
  let list = readSnapshots().filter((s) => s.date !== today)
  list.unshift({ date: today, savedAt: new Date().toISOString(), data: db })
  list = list.slice(0, MAX_SNAPSHOTS)
  // If the browser runs out of space, drop the oldest snapshots until it fits.
  while (list.length > 0) {
    try {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list))
      return
    } catch {
      if (list.length === 1) return
      list = list.slice(0, -1)
    }
  }
}

export type SnapshotInfo = { date: string; savedAt: string; bills: number; expenses: number }

export function listSnapshots(): SnapshotInfo[] {
  return readSnapshots().map((s) => {
    const days = Object.values(s.data.days ?? {})
    return {
      date: s.date,
      savedAt: s.savedAt,
      bills: days.reduce((n, d) => n + d.entries.length, 0),
      expenses: days.reduce((n, d) => n + d.expenses.length, 0),
    }
  })
}

export function restoreSnapshot(date: string) {
  const snap = readSnapshots().find((s) => s.date === date)
  if (!snap) throw new ValidationError('Snapshot not found')
  restoreBackup(snap.data)
}

export function getAutoDownload() {
  return localStorage.getItem(AUTO_DOWNLOAD_KEY) !== 'off'
}

export function setAutoDownload(on: boolean) {
  localStorage.setItem(AUTO_DOWNLOAD_KEY, on ? 'on' : 'off')
}

export function getLastAutoDownload() {
  return localStorage.getItem(LAST_DOWNLOAD_KEY)
}

/** Downloads a backup file once per day (on the first open of a new day) if there is data. */
export function runDailyAutoDownload() {
  if (!getAutoDownload()) return false
  const today = localDateKey()
  if (localStorage.getItem(LAST_DOWNLOAD_KEY) === today) return false
  const db = readDb()
  const hasData = Object.values(db.days).some((d) => d.entries.length > 0 || d.expenses.length > 0)
  if (!hasData) return false
  downloadBackup()
  return true
}

function update<T>(mutate: (db: Database) => T): T {
  const db = readDb()
  const result = mutate(db)
  writeDb(db)
  return result
}

function ensureDay(db: Database, date: string): DayRecord {
  if (!db.days[date]) {
    db.days[date] = { date, openingCash: 0, entries: [], expenses: [] }
  }
  return db.days[date]
}

function getDay(date: string) {
  const db = readDb()
  const day = db.days[date] ?? { date, openingCash: 0, entries: [], expenses: [] }
  let suggestedOpening = 0
  if (!db.days[date]) {
    const previous = Object.keys(db.days).filter((d) => d < date).sort().pop()
    if (previous) suggestedOpening = summarizeDay(db.days[previous]).cashInHand
  }
  return { ...day, suggestedOpening }
}

function addEntry(body: Record<string, any>): Entry {
  const date = assertDate(body.date)
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
    throw new ValidationError('Add at least one item')
  }
  const items: LineItem[] = body.items.map((raw: Record<string, unknown>) => ({
    id: newId(),
    name: cleanText(raw.name, 60, true),
    qty: cleanQty(raw.qty),
    price: cleanMoney(raw.price, 100_000),
    category: CATEGORIES.includes(raw.category as Category) ? (raw.category as Category) : 'extra',
  }))

  const total = round(items.reduce((s, i) => s + i.qty * i.price, 0))
  const mode: PaymentMode = MODES.includes(body.mode) ? body.mode : 'cash'

  let upiAmount = 0
  if (mode === 'upi') upiAmount = total
  if (mode === 'split') {
    upiAmount = cleanMoney(body.upiAmount)
    if (upiAmount > total) throw new ValidationError('UPI amount is more than the bill')
  }
  const cashAmount = round(total - upiAmount)

  let cashGiven = 0
  if (cashAmount > 0) {
    cashGiven =
      body.cashGiven === '' || body.cashGiven == null ? cashAmount : cleanMoney(body.cashGiven)
    if (cashGiven < cashAmount) throw new ValidationError('Cash given is less than the cash amount')
  }

  const entry: Entry = {
    id: newId(),
    createdAt: new Date().toISOString(),
    customer: cleanText(body.customer, 60),
    items,
    total,
    mode,
    cashAmount,
    upiAmount,
    cashGiven,
    balance: round(cashGiven - cashAmount),
  }
  update((db) => ensureDay(db, date).entries.unshift(entry))
  return entry
}

function addExpense(body: Record<string, any>): Expense {
  const date = assertDate(body.date)
  const amount = cleanMoney(body.amount)
  if (amount <= 0) throw new ValidationError('Amount must be above 0')
  const expense: Expense = {
    id: newId(),
    createdAt: new Date().toISOString(),
    description: cleanText(body.description, 80, true),
    amount,
    mode: body.mode === 'upi' ? 'upi' : 'cash',
  }
  update((db) => ensureDay(db, date).expenses.unshift(expense))
  return expense
}

function saveSettings(body: Record<string, any>) {
  if (!Array.isArray(body.priceList) || body.priceList.length > 300) {
    throw new ValidationError('Invalid price list')
  }
  const priceList: PriceItem[] = body.priceList.map((raw: Record<string, unknown>) => ({
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 100) : newId(),
    name: cleanText(raw.name, 60, true),
    price: cleanMoney(raw.price, 100_000),
    category: raw.category === 'stationery' ? 'stationery' : 'xerox',
  }))
  const shopName = cleanText(body.shopName, 60) || 'My Xerox Shop'
  update((db) => {
    db.shopName = shopName
    db.priceList = priceList
  })
  return { shopName, priceList }
}

function restoreBackup(body: Partial<Database>) {
  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray(body.priceList) ||
    typeof body.days !== 'object' ||
    body.days === null
  ) {
    throw new ValidationError('This does not look like a valid backup file')
  }
  writeDb({
    shopName: typeof body.shopName === 'string' ? body.shopName : 'My Xerox Shop',
    priceList: body.priceList,
    days: body.days,
  })
  return { ok: true }
}

function removeFrom(params: URLSearchParams, list: 'entries' | 'expenses') {
  const date = assertDate(params.get('date'))
  const id = cleanText(params.get('id'), 100, true)
  update((db) => {
    const day = db.days[date]
    if (!day) return
    if (list === 'entries') day.entries = day.entries.filter((e) => e.id !== id)
    else day.expenses = day.expenses.filter((e) => e.id !== id)
  })
  return { ok: true }
}

export function localRequest(url: string, method = 'GET', body?: any): unknown {
  const { pathname, searchParams } = new URL(url, 'http://local')
  const key = `${method} ${pathname}`
  switch (key) {
    case 'GET /api/day':
      return getDay(assertDate(searchParams.get('date')))
    case 'PATCH /api/day': {
      const date = assertDate(body?.date)
      const openingCash = cleanMoney(body?.openingCash)
      return update((db) => {
        const d = ensureDay(db, date)
        d.openingCash = openingCash
        return d
      })
    }
    case 'POST /api/entries':
      return addEntry(body ?? {})
    case 'DELETE /api/entries':
      return removeFrom(searchParams, 'entries')
    case 'POST /api/expenses':
      return addExpense(body ?? {})
    case 'DELETE /api/expenses':
      return removeFrom(searchParams, 'expenses')
    case 'GET /api/settings': {
      const db = readDb()
      return { shopName: db.shopName, priceList: db.priceList }
    }
    case 'PUT /api/settings':
      return saveSettings(body ?? {})
    case 'GET /api/history':
      return Object.values(readDb().days)
        .filter((d) => d.entries.length > 0 || d.expenses.length > 0)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(summarizeDay)
    case 'POST /api/backup':
      return restoreBackup(body)
    default:
      throw new Error(`Unknown request: ${key}`)
  }
}

export function downloadBackup() {
  const json = JSON.stringify(readDb(), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `xerox-shop-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  localStorage.setItem(LAST_DOWNLOAD_KEY, localDateKey())
}
