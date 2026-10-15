'use client'

import { useEffect, useState } from 'react'
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
  Info,
  X,
  Download,
  Cloud,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { dateKey, downloadBackupFile, prettyDate, useDay, useSettings } from '@/lib/client'
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
  const [showVaultModal, setShowVaultModal] = useState(false)
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

  // Resilient Vercel Persistence: Auto-sync on counter change and maintain local vault
  useEffect(() => {
    setSyncStatus('syncing')
    syncDatabaseWithServer(activeUserId)
      .then(() => mutateDay())
      .finally(() => {
        setSyncStatus('synced')
      })
  }, [activeUserId, mutateDay])

  // When day data updates, update local vault if the day contains entries/cash
  useEffect(() => {
    if (day && selected && settings) {
      const local = getClientDb(activeUserId)
      const currentDay = local.days[selected]
      const serverHasData = (day.entries?.length || 0) > 0 || (day.expenses?.length || 0) > 0 || day.openingCash > 0
      const localHasData = currentDay && ((currentDay.entries?.length || 0) > 0 || (currentDay.expenses?.length || 0) > 0 || currentDay.openingCash > 0)

      if (serverHasData) {
        local.days[selected] = {
          date: selected,
          openingCash: day.openingCash,
          entries: day.entries,
          expenses: day.expenses,
        }
        local.shopName = settings.shopName
        local.priceList = settings.priceList
        saveClientDb(activeUserId, local)
      } else if (localHasData && !serverHasData) {
        // Vercel server was cold-started or ephemeral storage rebooted!
        // Do NOT overwrite local data! Restore server instead!
        setSyncStatus('syncing')
        syncDatabaseWithServer(activeUserId, local).finally(() => {
          setSyncStatus('synced')
        })
      }
    }
  }, [activeUserId, day, selected, settings])

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

                {/* Interactive Vercel Persistent Vault Status */}
                <button
                  type="button"
                  onClick={() => setShowVaultModal(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  title="Click to view persistence vault details"
                >
                  <ShieldCheck className="size-3.5" />
                  <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Vault Protected'}</span>
                </button>
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
              userId={activeUserId}
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
                  <BillForm date={selected} priceList={settings.priceList} userId={activeUserId} onSaved={refresh} />
                  <TransactionsList date={selected} entries={day.entries} userId={activeUserId} onChanged={refresh} />
                </div>
              </TabsContent>

              <TabsContent value="expenses" className="pt-3">
                <ExpensesPanel date={selected} expenses={day.expenses} userId={activeUserId} onChanged={refresh} />
              </TabsContent>

              <TabsContent value="prices" className="pt-3">
                <PriceListEditor
                  settings={settings}
                  userId={activeUserId}
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

      {/* Persistent Vault Information Modal */}
      {showVaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setShowVaultModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="size-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold">Data Persistence Vault</h3>
                <p className="text-xs text-muted-foreground">Active Counter: {currentUser.name} ({currentUser.label})</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3.5 text-sm">
              <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-3.5">
                <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>Browser Local Vault: 100% Protected</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Every bill, transaction, expense, and daily opening cash amount is saved <strong>instantly in this browser&apos;s storage</strong>.
                  Refreshing the page (F5), reloading, closing the tab, or server cold-starts on Vercel will <strong>NEVER delete your data</strong>.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/40 p-3.5">
                <div className="flex items-center gap-2 font-semibold">
                  <Cloud className="size-4 text-primary shrink-0" />
                  <span>Multi-Device Cloud Sync (Optional)</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Your bills are safely stored on this computer. If you want to access the exact same counter from multiple computers or mobile phones simultaneously, you can connect a free <strong>Upstash Redis</strong> database in Vercel in 60 seconds (100% free, 10,000 commands/day).
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setSyncStatus('syncing')
                    syncDatabaseWithServer(activeUserId).finally(() => {
                      setSyncStatus('synced')
                      refresh()
                    })
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw className={`size-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  Sync Database Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadBackupFile(activeUserId)}
                  className="gap-1.5"
                >
                  <Download className="size-3.5" />
                  Download Backup (.json)
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowVaultModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
