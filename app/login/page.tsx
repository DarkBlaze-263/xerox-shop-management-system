'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, ShieldCheck, ArrowRight, Delete, CheckCircle2, AlertCircle, Sparkles, Store, Lock, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { USERS, VALID_USER_IDS, type UserId, setClientActiveUser, getClientActiveUser } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [selectedUser, setSelectedUser] = useState<UserId>('user1')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const existing = getClientActiveUser()
    if (existing && VALID_USER_IDS.includes(existing)) {
      setSelectedUser(existing)
    }
  }, [])

  // Listen for physical keyboard numeric input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          const next = pin + e.key
          setPin(next)
          setError(null)
          if (next.length === 4) {
            handleLogin(selectedUser, next)
          }
        }
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1))
        setError(null)
      } else if (e.key === 'Enter' && pin.length > 0) {
        handleLogin(selectedUser, pin)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pin, selectedUser])

  function handleKeyPress(digit: string) {
    if (pin.length < 4) {
      const next = pin + digit
      setPin(next)
      setError(null)
      if (next.length === 4) {
        handleLogin(selectedUser, next)
      }
    }
  }

  function handleBackspace() {
    setPin((prev) => prev.slice(0, -1))
    setError(null)
  }

  function handleClear() {
    setPin('')
    setError(null)
  }

  async function handleLogin(userToLogin: UserId, pinToVerify: string) {
    if (!pinToVerify) {
      setError('Please enter a 4-digit PIN')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userToLogin, pin: pinToVerify }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Authentication failed. Please check your PIN.')
      }

      // Store in client storage
      setClientActiveUser(userToLogin)

      // Authenticator redirects accordingly to the destined user
      const targetPath = USERS[userToLogin]?.destinedPath || `/dashboard/${userToLogin}`
      router.push(targetPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const currentUserData = USERS[selectedUser]

  if (!mounted) return null

  return (
    <div className="relative min-h-dvh flex flex-col justify-between bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/40 p-4 md:p-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Background ambient decorative glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 right-10 size-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      {/* Header Branding */}
      <header className="relative mx-auto w-full max-w-4xl flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Printer className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Xerox Shop Management
              <span className="hidden sm:inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                Multi-User POS
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Daily Billing, Expense Accounts & Isolated Databases
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm shadow-xs">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span>Vercel Persistent Storage Active</span>
        </div>
      </header>

      {/* Main Login Authenticator Box */}
      <main className="relative mx-auto w-full max-w-4xl py-6 my-auto">
        <div className="grid gap-8 lg:grid-cols-12 items-center">
          
          {/* Left Column: User Selection Cards */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
                <Store className="size-3.5" />
                Step 1: Select User Account
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-balance text-foreground mt-1">
                Choose Destined Counter
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Each operator accesses an independent dashboard with their own database.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-1">
              {VALID_USER_IDS.map((uid) => {
                const u = USERS[uid]
                const isSelected = selectedUser === uid
                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => {
                      setSelectedUser(uid)
                      setPin('')
                      setError(null)
                    }}
                    className={`group relative flex items-start justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-primary bg-card ring-2 ring-primary/20 shadow-lg shadow-primary/5'
                        : 'border-border/80 bg-card/60 hover:border-border hover:bg-card hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`mt-0.5 flex size-10 items-center justify-center rounded-xl font-bold text-sm transition-transform duration-200 group-hover:scale-105 ${
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {uid.replace('user', 'U')}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-base">
                            {u.name}
                          </span>
                          <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${u.badgeColor}`}>
                            {u.role}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground/80 mt-0.5">
                          {u.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {u.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
                      <span className="text-[11px] font-mono text-muted-foreground/80 rounded bg-muted/60 px-1.5 py-0.5">
                        PIN: {u.defaultPin}
                      </span>
                      {isSelected && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <CheckCircle2 className="size-3.5" />
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="rounded-xl border bg-card/60 p-3.5 text-xs text-muted-foreground flex items-center gap-2.5">
              <Sparkles className="size-4 text-amber-500 shrink-0" />
              <span>
                <strong>Zero Data Reset Guarantee:</strong> All entries, bills, and settings for each user remain securely stored even across page refreshes and multi-day browser sessions.
              </span>
            </div>
          </div>

          {/* Right Column: Authenticator Keypad */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border bg-card/95 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-md dark:shadow-none flex flex-col gap-5">
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-primary/10 text-primary mb-3">
                  <Lock className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Authenticate {currentUserData?.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter 4-digit PIN for {currentUserData?.label}
                </p>
              </div>

              {/* PIN Dots Display */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center justify-center gap-3 py-2">
                  {[0, 1, 2, 3].map((index) => {
                    const isFilled = index < pin.length
                    return (
                      <div
                        key={index}
                        className={`size-4 rounded-full transition-all duration-200 ${
                          isFilled
                            ? 'bg-primary scale-110 shadow-xs shadow-primary/50 ring-4 ring-primary/20'
                            : 'bg-muted-foreground/20'
                        }`}
                      />
                    )
                  })}
                </div>

                {error && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-destructive animate-shake text-center px-2">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Quick Preset PIN Auto-Fill Helper */}
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPin(currentUserData.defaultPin)
                    handleLogin(selectedUser, currentUserData.defaultPin)
                  }}
                  className="h-8 text-xs font-mono rounded-full gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <KeyRound className="size-3.5 text-primary" />
                  Quick Fill Default PIN ({currentUserData.defaultPin})
                </Button>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeyPress(digit)}
                    disabled={loading}
                    className="flex h-13 items-center justify-center rounded-xl border bg-background text-lg font-semibold text-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:opacity-50"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={loading || pin.length === 0}
                  className="flex h-13 items-center justify-center rounded-xl border bg-background/50 text-xs font-semibold text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleKeyPress('0')}
                  disabled={loading}
                  className="flex h-13 items-center justify-center rounded-xl border bg-background text-lg font-semibold text-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  disabled={loading || pin.length === 0}
                  className="flex h-13 items-center justify-center rounded-xl border bg-background/50 text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:opacity-40"
                  aria-label="Backspace"
                >
                  <Delete className="size-5" />
                </button>
              </div>

              {/* Submit Button */}
              <Button
                type="button"
                onClick={() => handleLogin(selectedUser, pin)}
                disabled={loading || pin.length !== 4}
                className="w-full h-11 text-sm font-semibold rounded-xl gap-2 shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Authenticating...
                  </span>
                ) : (
                  <>
                    Enter {currentUserData?.name} Dashboard
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

        </div>
      </main>

      {/* Footer info */}
      <footer className="mx-auto w-full max-w-4xl text-center text-xs text-muted-foreground py-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-4">
        <span>Xerox Shop Management System v2.0 • Multi-Tenant Architecture</span>
        <div className="flex items-center gap-4">
          <span>User 1: Counter 1</span>
          <span>•</span>
          <span>User 2: Counter 2</span>
          <span>•</span>
          <span>User 3: Manager</span>
        </div>
      </footer>
    </div>
  )
}
