import type { DayRecord, DaySummary } from './types'

const round = (n: number) => Math.round(n * 100) / 100

export function summarizeDay(day: DayRecord): DaySummary {
  let sales = 0
  let cashIn = 0
  let upiIn = 0
  let xeroxSales = 0
  let stationerySales = 0
  let extraSales = 0

  for (const entry of day.entries) {
    sales += entry.total
    cashIn += entry.cashAmount
    upiIn += entry.upiAmount
    for (const item of entry.items) {
      const amount = item.qty * item.price
      if (item.category === 'xerox') xeroxSales += amount
      else if (item.category === 'stationery') stationerySales += amount
      else extraSales += amount
    }
  }

  let cashExpenses = 0
  let upiExpenses = 0
  for (const expense of day.expenses) {
    if (expense.mode === 'cash') cashExpenses += expense.amount
    else upiExpenses += expense.amount
  }
  const expenses = cashExpenses + upiExpenses

  return {
    date: day.date,
    bills: day.entries.length,
    sales: round(sales),
    cashIn: round(cashIn),
    upiIn: round(upiIn),
    xeroxSales: round(xeroxSales),
    stationerySales: round(stationerySales),
    extraSales: round(extraSales),
    expenses: round(expenses),
    cashExpenses: round(cashExpenses),
    upiExpenses: round(upiExpenses),
    openingCash: round(day.openingCash),
    cashInHand: round(day.openingCash + cashIn - cashExpenses),
    net: round(sales - expenses),
  }
}
