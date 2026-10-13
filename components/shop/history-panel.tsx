'use client'

import { useRef, useState } from 'react'
import { Download, Upload, Eye, FileSpreadsheet, RotateCcw, Clock, ShieldCheck, Database as DbIcon, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { inr, prettyDate, sendJson, useHistory, useSnapshots, downloadBackupFile, timeOf } from '@/lib/client'

type Props = {
  userId?: string
  onOpenDay: (date: string) => void
  onRestored: () => void
}

export function HistoryPanel({ userId, onOpenDay, onRestored }: Props) {
  const { data: days, mutate: mutateHistory } = useHistory(userId)
  const { data: snapshots, mutate: mutateSnapshots } = useSnapshots(userId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [processing, setProcessing] = useState(false)

  async function handleDownloadBackup() {
    try {
      setMessage(null)
      await downloadBackupFile(userId)
      setMessage({ ok: true, text: 'Backup downloaded successfully to your computer.' })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not download backup' })
    }
  }

  async function restoreFromFile(file: File) {
    if (!window.confirm('Restoring will merge/replace current shop data with this backup. Continue?')) return
    setProcessing(true)
    setMessage(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await sendJson<{ ok: boolean; message: string }>('/api/backup', 'POST', json)
      setMessage({ ok: true, text: res.message || 'Backup restored successfully!' })
      mutateHistory()
      mutateSnapshots()
      onRestored()
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Invalid backup file' })
    } finally {
      setProcessing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function restoreSnapshot(fileName: string, label: string) {
    if (!window.confirm(`Restore snapshot "${label}"? Your current data will be safely backed up first.`)) return
    setProcessing(true)
    setMessage(null)
    try {
      const res = await sendJson<{ ok: boolean; message: string }>('/api/backup/snapshots', 'POST', {
        action: 'restore',
        fileName,
      })
      setMessage({ ok: true, text: res.message || 'Snapshot restored successfully!' })
      mutateHistory()
      mutateSnapshots()
      onRestored()
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not restore snapshot' })
    } finally {
      setProcessing(false)
    }
  }

  async function createSnapshotNow() {
    setProcessing(true)
    try {
      await sendJson('/api/backup/snapshots', 'POST', { action: 'create' })
      mutateSnapshots()
      setMessage({ ok: true, text: 'Instant database snapshot saved successfully.' })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not create snapshot' })
    } finally {
      setProcessing(false)
    }
  }

  function downloadCsv() {
    if (!days || days.length === 0) return
    const headers = ['Date', 'Bills', 'Total Sales (INR)', 'Cash Received (INR)', 'UPI Received (INR)', 'Stationery Sales (INR)', 'Expenses (INR)', 'Net Profit (INR)']
    const rows = days.map((d) => [
      d.date,
      d.bills,
      d.sales,
      d.cashIn,
      d.upiIn,
      d.stationerySales,
      d.expenses,
      d.net,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `xerox-shop-sales-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Backup & Data Persistence Card */}
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-cash/10 text-cash">
                <ShieldCheck className="size-4" />
              </span>
              <h2 className="text-lg font-semibold">Database & Backup Vault</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              All shop data is stored permanently in the database. You can download offline backups, restore anytime, or revert to previous snapshots.
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 md:mt-0">
            <Button onClick={handleDownloadBackup} disabled={processing}>
              <Download className="size-4" aria-hidden="true" />
              Download Backup (JSON)
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={processing}>
              <Upload className="size-4" aria-hidden="true" />
              Restore from File
            </Button>
            <Button variant="secondary" onClick={createSnapshotNow} disabled={processing}>
              <Sparkles className="size-4" aria-hidden="true" />
              Snapshot Now
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Choose backup file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) restoreFromFile(file)
              }}
            />
          </div>
        </div>

        {message && (
          <div
            role="status"
            className={`rounded-lg p-3 text-sm font-medium ${
              message.ok ? 'border border-cash/30 bg-cash/10 text-cash' : 'border border-destructive/30 bg-destructive/10 text-destructive'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Automated Snapshots List */}
        {snapshots && snapshots.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Clock className="size-3.5" />
                Automatic Snapshots ({snapshots.length})
              </span>
              <span className="text-xs text-muted-foreground">Pre-change snapshots are auto-created</span>
            </div>
            <div className="flex max-h-48 flex-col divide-y overflow-y-auto rounded-md border bg-background">
              {snapshots.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-2 text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{prettyDate(s.date) || s.date}</span>
                    <span className="text-muted-foreground">
                      Saved {timeOf(s.timestamp)} · {s.bills} bills · {s.expenses} expenses · {inr(s.sales)}
                    </span>
                  </div>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => restoreSnapshot(s.fileName, `${s.date} (${timeOf(s.timestamp)})`)}
                    disabled={processing}
                  >
                    <RotateCcw className="size-3" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Day-wise History Table */}
      <section aria-labelledby="history-heading" className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DbIcon className="size-4" />
            </span>
            <h2 id="history-heading" className="text-lg font-semibold">Day-wise Accounts History</h2>
          </div>
          {days && days.length > 0 && (
            <Button variant="outline" size="sm" onClick={downloadCsv}>
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              Export to Excel (CSV)
            </Button>
          )}
        </div>

        {!days ? (
          <p className="text-sm text-muted-foreground">Loading accounts history...</p>
        ) : days.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No daily records saved yet. Bills and expenses added in the Billing tab will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2.5 pr-3 font-medium">Date</th>
                  <th className="py-2.5 pr-3 text-right font-medium">Bills</th>
                  <th className="py-2.5 pr-3 text-right font-medium">Total Sales</th>
                  <th className="py-2.5 pr-3 text-right font-medium">Cash</th>
                  <th className="py-2.5 pr-3 text-right font-medium">UPI</th>
                  <th className="py-2.5 pr-3 text-right font-medium">Stationery</th>
                  <th className="py-2.5 pr-3 text-right font-medium">Expenses</th>
                  <th className="py-2.5 pr-3 text-right font-medium">Net Profit</th>
                  <th className="py-2.5 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {days.map((d) => (
                  <tr key={d.date} className="border-b transition-colors hover:bg-muted/40 last:border-0">
                    <td className="py-2.5 pr-3 font-sans font-medium">{prettyDate(d.date)}</td>
                    <td className="py-2.5 pr-3 text-right">{d.bills}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold">{inr(d.sales)}</td>
                    <td className="py-2.5 pr-3 text-right text-cash">{inr(d.cashIn)}</td>
                    <td className="py-2.5 pr-3 text-right text-upi">{inr(d.upiIn)}</td>
                    <td className="py-2.5 pr-3 text-right">{inr(d.stationerySales)}</td>
                    <td className="py-2.5 pr-3 text-right text-expense">{inr(d.expenses)}</td>
                    <td className="py-2.5 pr-3 text-right font-bold">{inr(d.net)}</td>
                    <td className="py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => onOpenDay(d.date)}>
                        <Eye className="size-4" aria-hidden="true" />
                        Open Day
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
