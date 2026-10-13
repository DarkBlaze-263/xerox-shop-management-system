'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSWRConfig } from 'swr'
import {
  Printer,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  LogOut,
  Users,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Database,
  Store,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { dateKey, prettyDate, useDay, useSettings } from '@/lib/client'
import { summarizeDay } from '@/lib/summary'
import { USERS, VALID_USER_IDS, type UserId, clearClientActiveUser, setClientActiveUser } from '@/lib/auth'
import { getClientDb, saveClientDb, syncDatabaseWithServer } from '@/lib/storage-sync'
import { SummaryCards } from './summary-cards'
import { BillForm } from './bill-form'
import { TransactionsList } from './transactions-list'
import { ExpensesPanel } from './expenses-panel'
import { PriceListEditor } from './price-list-editor'
import { HistoryPanel } from './history-panel'
import { OpeningCash } from './opening-cash'

type Props = {
  userId?: string
}

export function ShopApp({ userId: propUserId }: Props) {
  const router = useRouter()
  const activeUserId: UserId = (propUserId && VALID_USER_IDS.includes(propUserId as UserId) ? propUserId : 'user1') as UserId
  const currentUser = USERS[activeUserId]

  const [today, setToday] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState('billing')
  const [refreshing, setRefreshing] = useState(false)
  const [showSwitchMenu, setShowSwitchMenu] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'ready'>('ready')
  const { mutate: globalMutate } = useSWRConfig()

  // Ensure active user is registered in client storage/cookie
  useEffect(() => {
    setClientActiveUser(activeUserId)
  }, [activeUserId])

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

  const { data: day, mutate: mutateDay, isLoading: isDayLoading, error: dayError } = useDay(selected, activeUserId)
  const { data: settings, mutate: mutateSettings, isLoading: isSettingsLoading } = useSettings(activeUserId)

  // Resilient Vercel Persistence: Auto-sync server DB with browser persistent storage
  useEffect(() => {
    if (settings && day && selected) {
      const local = getClientDb(activeUserId)
      const currentDb = local || {
        shopName: settings.shopName,
        priceList: settings.priceList,
        days: { [selected]: day },
      }

      currentDb.shopName = settings.shopName
      currentDb.priceList = settings.priceList
      currentDb.days[selected] = day

      // Save to client storage immediately
      saveClientDb(activeUserId, currentDb)

      // Check if server needs restoration (e.g. after Vercel container cold-start)
      if (local && Object.keys(local.days || {}).length > 0) {
        setSyncStatus('syncing')
        syncDatabaseWithServer(activeUserId, currentDb).finally(() => {
          setSyncStatus('synced')
        })
      } else {
        setSyncStatus('synced')
      }
    }
  }, [activeUserId, settings, day, selected])

  async function refresh() {
    setRefreshing(true)
    try {
      await Promise.all([
        mutateDay(),
        mutateSettings(),
        globalMutate(`/api/history?userId=${activeUserId}`),
        globalMutate(`/api/backup/snapshots?userId=${activeUserId}`),
      ])
    } finally {
      setTimeout(() => setRefreshing(false), 400)
    }
  }

  function handleLogout() {
    clearClientActiveUser()
    fetch('/api/auth', { method: 'DELETE' }).finally(() => {
      router.push('/login')
    })
  }

  function handleSwitchUser(newUserId: UserId) {
    setShowSwitchMenu(false)
    if (newUserId === activeUserId) return
    setClientActiveUser(newUserId)
    router.push(`/dashboard/${newUserId}`)
  }

  const isToday = selected === today
  const summary = day ? summarizeDay(day) : null

  return (
    <div className="min-h-dvh bg-background">
      {/* Top Application Header */}
      <header className="border-b bg-card shadow-xs sticky top-0 z-40 backdrop-blur-md bg-card/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          
          {/* Shop & Active Counter Information */}
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs shrink-0">
              <Printer className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold leading-tight tracking-tight text-balance">
                  {settings?.shopName ?? currentUser?.label ?? 'Xerox Shop Management'}
                </h1>
                
                {/* Active User Badge */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSwitchMenu((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all hover:opacity-80 ${currentUser.badgeColor}`}
                    title="Click to switch user counter"
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    <span>{currentUser.name}</span>
                    <span className="text-[10px] opacity-75 hidden sm:inline">({currentUser.role})</span>
                    <ChevronDown className="size-3 opacity-60 ml-0.5" />
                  </button>

                  {/* Switch User Dropdown */}
                  {showSwitchMenu && (
                    <div className="absolute left-0 mt-2 w-64 rounded-2xl border bg-card p-2 shadow-xl ring-1 ring-border z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Switch Active Counter
                      </div>
                      <div className="flex flex-col gap-1">
                        {VALID_USER_IDS.map((uid) => {
                          const u = USERS[uid]
                          const isActive = uid === activeUserId
                          return (
                            <button
                              key={uid}
                              type="button"
                              onClick={() => handleSwitchUser(uid)}
                              className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                                isActive
                                  ? 'bg-primary/10 text-primary font-semibold'
                                  : 'hover:bg-muted text-foreground'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{u.name}</span>
                                <span className="text-[10px] text-muted-foreground">{u.label}</span>
                              </div>
                              {isActive && <CheckCircle2 className="size-3.5 text-primary shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Vercel Persistent Vault Status */}
                <span className="hidden lg:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-3" />
                  Persistent Vault
                </span>
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>{selected ? prettyDate(selected) : 'Loading date...'}</span>
                {selected && !isToday && (
                  <span className="rounded bg-expense/15 px-1.5 py-0.2 text-[11px] font-medium text-expense">
                    Past Day Record
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Controls: Date Picker, User Switch, Logout, Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="day-picker" className="sr-only">Choose day</label>
            <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-sm shadow-2xs">
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/login')}
              className="gap-1 text-xs"
              title="Switch user counter"
            >
              <Users className="size-3.5" />
              <span className="hidden sm:inline">Switch</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Sign out of counter"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5">
        {dayError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Could not connect to database for {currentUser?.name}: {dayError.message}. Using offline persistent vault.
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
              key={`${activeUserId}-${selected}`}
              date={selected}
              openingCash={day.openingCash}
              suggested={day.suggestedOpening}
              onSaved={refresh}
            />

            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList className="w-full md:w-fit">
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="prices">Prices ({currentUser.name})</TabsTrigger>
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
                <PriceListEditor
                  settings={settings}
                  onSaved={(s) => mutateSettings(s, false)}
                />
              </TabsContent>

              <TabsContent value="history" className="pt-3">
                <HistoryPanel
                  userId={activeUserId}
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
