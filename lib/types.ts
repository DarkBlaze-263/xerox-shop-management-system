export type Category = 'xerox' | 'stationery' | 'extra'

export type PriceItem = {
  id: string
  name: string
  price: number
  category: 'xerox' | 'stationery'
}

export type LineItem = {
  id: string
  name: string
  qty: number
  price: number
  category: Category
}

export type PaymentMode = 'cash' | 'upi' | 'split'

export type Entry = {
  id: string
  createdAt: string
  customer: string
  items: LineItem[]
  total: number
  mode: PaymentMode
  cashAmount: number
  upiAmount: number
  cashGiven: number
  balance: number
}

export type Expense = {
  id: string
  createdAt: string
  description: string
  amount: number
  mode: 'cash' | 'upi'
}

export type DayRecord = {
  date: string
  openingCash: number
  entries: Entry[]
  expenses: Expense[]
}

export type Settings = {
  shopName: string
  priceList: PriceItem[]
}

export type Database = Settings & {
  days: Record<string, DayRecord>
}

export type DaySummary = {
  date: string
  bills: number
  sales: number
  cashIn: number
  upiIn: number
  xeroxSales: number
  stationerySales: number
  extraSales: number
  expenses: number
  cashExpenses: number
  upiExpenses: number
  openingCash: number
  cashInHand: number
  net: number
}
