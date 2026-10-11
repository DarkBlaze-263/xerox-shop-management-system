'use client'

import { useEffect, useState } from 'react'
import { useSWRConfig } from 'swr'
import { Printer, CalendarDays, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { dateKey, prettyDate, useDay, useSettings } from '@/lib/client'
import { summarizeDay } from '@/lib/summary'
import { SummaryCards } from './summary-cards'
import { BillForm } from './bill-form'
import { TransactionsList } from './transactions-list'
import { ExpensesPanel } from './expenses-panel'
import { PriceListEditor } from './price-list-editor'
import { HistoryPanel } from './history-panel'
import { OpeningCash } from './opening-cash'

export function ShopApp() {
  const [today, setToday] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState('billing')
  const [refreshing, setRefreshing] = useState(false)
  const { mutate: globalMutate } = useSWRConfig()

  useEffect(() => {
    const now = dateKey()
    setToday(now)
    setSelected(now)

    // Roll over to a fresh day automatically after midnight
    const timer = setInterval(() => {
      const current = dateKey()
      setToday((prev) => {
        if (prev !== current) {
          setSelected((sel) => (sel === prev ? current : sel))
        }
        return current
      })
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  const { data: day, mutate: mutateDay, isLoading: isDayLoading, error: dayError } = useDay(selected)
  const { data: settings, mutate: mutateSettings, isLoading: isSettingsLoading } = useSettings()

  async function refresh() {
    setRefreshing(true)
    try {
      await Promise.all([
        mutateDay(),
        mutateSettings(),
        globalMutate('/api/history'),
        globalMutate('/api/backup/snapshots'),
      ])
    } finally {
      setTimeout(() => setRefreshing(false), 400)
    }
  }

  const isToday = selected === today
  const summary = day ? summarizeDay(day) : null

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Printer className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold leading-tight tracking-tight text-balance">
                  {settings?.shopName ?? 'Xerox Shop Management'}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-cash/10 px-2 py-0.5 text-[11px] font-medium text-cash">
                  <CheckCircle2 className="size-3" />
                  Database Connected
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {selected ? prettyDate(selected) : 'Loading date...'}
                {selected && !isToday && (
                  <span className="ml-2 rounded bg-expense/15 px-1.5 py-0.5 text-xs font-medium text-expense">
                    Past Day Record
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="day-picker" className="sr-only">Choose day</label>
            <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-sm">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="day-picker"
                type="date"
                value={selected ?? ''}
                max={today ?? undefined}
                onChange={(e) => e.target.value && setSelected(e.target.value)}
                className="h-7 border-0 p-0 text-sm focus-visible:ring-0"
              />
            </div>
            {!isToday && today && (
              <Button variant="outline" size="sm" onClick={() => setSelected(today)}>
                Go to Today
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh database data"
              onClick={refresh}
              disabled={refreshing}
              title="Refresh database data"
            >
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5">
        {dayError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Could not connect to database: {dayError.message}. Please refresh or ensure the server is running.
          </div>
        )}

        {!selected || isDayLoading || isSettingsLoading || !day || !settings || !summary ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            <SummaryCards summary={summary} />
            <OpeningCash
              key={selected}
              date={selected}
              openingCash={day.openingCash}
              suggested={day.suggestedOpening}
              onSaved={refresh}
            />

            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList className="w-full md:w-fit">
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="prices">Prices</TabsTrigger>
                <TabsTrigger value="history">History & Backup</TabsTrigger>
              </TabsList>

              <TabsContent value="billing" className="pt-3">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                  <BillForm date={selected} priceList={settings.priceList} onSaved={refresh} />
                  <TransactionsList date={selected} entries={day.entries} onChanged={refresh} />
                </div>
              </TabsContent>

              <TabsContent value="expenses" className="pt-3">
                <ExpensesPanel date={selected} expenses={day.expenses} onChanged={refresh} />
              </TabsContent>

              <TabsContent value="prices" className="pt-3">
                <PriceListEditor settings={settings} onSaved={(s) => mutateSettings(s, false)} />
              </TabsContent>

              <TabsContent value="history" className="pt-3">
                <HistoryPanel
                  onOpenDay={(d) => {
                    setSelected(d)
                    setTab('billing')
                  }}
                  onRestored={refresh}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  )
}
