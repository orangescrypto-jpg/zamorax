"use client"
// app/(admin)/admin/cleanup/page.tsx
// Storage & Cleanup. The admin sets how long each kind of data is kept,
// can preview or run any job on its own, or run everything at once. The
// weekly cron applies the same saved windows automatically.
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, ArrowLeft, Eye, Trash2, Save, PlayCircle, CheckCircle2, XCircle, ShieldAlert } from "lucide-react"
import { adminFetch } from "@/lib/admin-fetch"

interface JobMeta {
  key: string
  label: string
  description: string
  unit: "days" | "months"
  defaultValue: number
  floor: number
  financial?: boolean
  offByDefault?: boolean
}

interface JobResult {
  key: string
  label: string
  deleted: number
  filesDeleted: number
  protectedSkipped: number
  complete: boolean
  disabled: boolean
  note: string | null
  dryRun: boolean
  // orphan-file extras
  scanned?: number
  orphaned?: number
  orphanedBytes?: number
  skippedTooRecent?: number
  sample?: string[]
}

interface CountRow {
  table: string
  label: string
  count: number | null
}

type Status = { kind: "success" | "error"; message: string; detail?: string }

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** Turns a job result into the plain-language line shown under the button. */
function describe(r: JobResult, preview: boolean): Status {
  if (r.disabled) return { kind: "success", message: "Turned off (0). Nothing was changed." }
  if (r.note && r.deleted === 0 && r.filesDeleted === 0 && !r.orphaned) {
    const isProblem = /refused|failed|could not|not found|missing/i.test(r.note)
    return { kind: isProblem ? "error" : "success", message: r.note }
  }
  const files = r.filesDeleted ? ` and ${r.filesDeleted.toLocaleString()} file${r.filesDeleted === 1 ? "" : "s"}` : ""
  const kept = r.protectedSkipped ? ` ${r.protectedSkipped.toLocaleString()} kept because something still depends on them.` : ""
  const more = r.complete ? "" : " More remains, run it again to continue."
  const note = r.note ? ` ${r.note}` : ""

  if (r.orphaned !== undefined) {
    const skipped = r.skippedTooRecent ? ` ${r.skippedTooRecent} skipped as too new.` : ""
    if (preview) {
      return {
        kind: "success",
        message:
          r.orphaned === 0
            ? `Preview complete. Checked ${(r.scanned ?? 0).toLocaleString()} files, none are unused. Nothing was deleted.${skipped}`
            : `Preview complete. ${r.orphaned.toLocaleString()} unused file${r.orphaned === 1 ? "" : "s"} (${formatBytes(r.orphanedBytes ?? 0)}). Nothing was deleted.${skipped}`,
        detail: r.sample?.length ? `e.g. ${r.sample.join(", ")}` : undefined,
      }
    }
    return {
      kind: r.note ? "error" : "success",
      message: r.note ?? `Done. Deleted ${r.deleted.toLocaleString()} unused file${r.deleted === 1 ? "" : "s"} (${formatBytes(r.orphanedBytes ?? 0)} found).${more}`,
    }
  }

  if (preview) {
    return {
      kind: "success",
      message:
        r.deleted === 0 && r.filesDeleted === 0
          ? `Preview complete. Nothing to remove.${kept}`
          : `Preview complete. Would remove ${r.deleted.toLocaleString()} row${r.deleted === 1 ? "" : "s"}${files}.${kept} Nothing was changed.${more}`,
    }
  }
  if (r.deleted === 0 && r.filesDeleted === 0) {
    return { kind: "success", message: `Done. Nothing to delete, everything is inside its time window.${kept}${note}` }
  }
  return { kind: "success", message: `Done. Removed ${r.deleted.toLocaleString()} row${r.deleted === 1 ? "" : "s"}${files}.${kept}${more}${note}` }
}

export default function AdminCleanupPage() {
  const [jobs, setJobs] = useState<JobMeta[]>([])
  const [values, setValues] = useState<Record<string, number>>({})
  const [saved, setSaved] = useState<Record<string, number>>({})
  const [counts, setCounts] = useState<CountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [allStatus, setAllStatus] = useState<Status | null>(null)
  const [allResults, setAllResults] = useState<JobResult[]>([])

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/cleanup")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Failed to load (${res.status})`)
      setJobs(json.jobs)
      setValues(json.settings)
      setSaved(json.settings)
      setCounts(json.counts)
      setLoadError(null)
    } catch (err: any) {
      setLoadError(err.message || "Could not load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const dirty = useMemo(() => jobs.some((j) => values[j.key] !== saved[j.key]), [jobs, values, saved])

  const save = async () => {
    setSaving(true)
    setSaveStatus(null)
    try {
      const res = await adminFetch("/api/admin/cleanup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not save")
      setValues(json.settings)
      setSaved(json.settings)
      const raised = jobs.filter((j) => Number(values[j.key]) > 0 && json.settings[j.key] !== values[j.key])
      setSaveStatus({
        kind: "success",
        message: raised.length
          ? `Saved. ${raised.map((j) => `${j.label} was raised to its minimum of ${j.floor}`).join("; ")}.`
          : "Saved. The weekly cleanup will use these settings.",
      })
    } catch (err: any) {
      setSaveStatus({ kind: "error", message: err.message || "Could not save" })
    } finally {
      setSaving(false)
    }
  }

  const run = async (job: JobMeta | "all", mode: "preview" | "delete") => {
    const name = job === "all" ? "all" : job.key
    if (mode === "delete") {
      const target = job === "all" ? "EVERY enabled cleanup" : `"${job.label}"`
      const extra = job !== "all" && job.financial ? "\n\nThis archives the records to a file first, then removes them." : ""
      if (!window.confirm(`Permanently delete data for ${target}? This cannot be undone.${extra}`)) return
    }
    setBusy(`${name}:${mode}`)
    if (job === "all") {
      setAllStatus(null)
      setAllResults([])
    } else {
      setStatus((s) => {
        const n = { ...s }
        delete n[job.key]
        return n
      })
    }
    try {
      const res = await adminFetch(
        "/api/admin/cleanup/run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job: name, mode, confirm: mode === "delete" }),
        },
        { retries: 0, timeoutMs: 120_000 },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Failed (error ${res.status}). Nothing further was changed.`)
      if (job === "all") {
        const results: JobResult[] = json.results
        setAllResults(results)
        const total = results.reduce((s, r) => s + r.deleted, 0)
        const files = results.reduce((s, r) => s + r.filesDeleted, 0)
        const failed = results.filter((r) => r.note && /failed|refused/i.test(r.note))
        const preview = mode === "preview"
        setAllStatus({
          kind: failed.length ? "error" : "success",
          message: preview
            ? `Preview complete. Would remove ${total.toLocaleString()} rows and ${files.toLocaleString()} files. Nothing was changed.`
            : `Done. Removed ${total.toLocaleString()} rows and ${files.toLocaleString()} files.${json.allComplete ? "" : " More remains, run it again to continue."}` +
              (failed.length ? ` ${failed.length} job(s) reported a problem, see below.` : ""),
        })
      } else {
        setStatus((s) => ({ ...s, [job.key]: describe(json.result, mode === "preview") }))
      }
      if (mode === "delete") load()
    } catch (err: any) {
      const s: Status = { kind: "error", message: err.message || "Something went wrong. Nothing was deleted." }
      if (job === "all") setAllStatus(s)
      else setStatus((x) => ({ ...x, [job.key]: s }))
    } finally {
      setBusy(null)
    }
  }

  const StatusBox = ({ s }: { s?: Status | null }) =>
    !s ? null : (
      <div
        role="status"
        className={`mt-2 flex gap-2 rounded-md px-3 py-2 text-xs ${s.kind === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
      >
        {s.kind === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
        <div className="min-w-0">
          <p>{s.message}</p>
          {s.detail && <p className="mt-1 break-all opacity-70">{s.detail}</p>}
        </div>
      </div>
    )

  if (loading)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="container py-8 max-w-3xl space-y-5 pb-32">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Admin
        </Link>
        <h1 className="text-2xl font-heading font-bold">Storage &amp; Cleanup</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Keeps the database and file storage from filling up. Set how long each kind of data is kept. A weekly job applies
          these settings on its own, and every button below does the same work on demand.
        </p>
      </div>

      {loadError && <StatusBox s={{ kind: "error", message: loadError }} />}

      {counts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What is stored now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {counts.map((c) => (
                <div key={c.table} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-medium tabular-nums">{c.count === null ? "n/a" : c.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Run everything</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Applies every enabled job below in a safe order. Use Preview first to see what would be removed.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => run("all", "preview")} disabled={busy !== null}>
              {busy === "all:preview" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              Preview all
            </Button>
            <Button variant="destructive" size="sm" onClick={() => run("all", "delete")} disabled={busy !== null}>
              {busy === "all:delete" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Delete all now
            </Button>
          </div>
          <StatusBox s={allStatus} />
          {allResults.length > 0 && (
            <div className="rounded-md border text-xs">
              {allResults.map((r) => (
                <div key={r.key} className="flex items-start justify-between gap-3 border-b px-3 py-2 last:border-b-0">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-right text-muted-foreground">
                    {r.disabled ? "off" : `${r.deleted.toLocaleString()} rows${r.filesDeleted ? `, ${r.filesDeleted.toLocaleString()} files` : ""}`}
                    {r.protectedSkipped ? ` · ${r.protectedSkipped} kept` : ""}
                    {r.note && !r.disabled ? <span className="block text-amber-700">{r.note}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {jobs.map((j) => (
        <Card key={j.key}>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {j.label}
                  {j.financial && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      <ShieldAlert className="h-3 w-3" /> archived first
                    </span>
                  )}
                  {j.offByDefault && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">off by default</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{j.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={3650}
                  value={values[j.key] ?? 0}
                  onChange={(e: { target: { value: string } }) => setValues((v) => ({ ...v, [j.key]: Math.max(0, Number(e.target.value) || 0) }))}
                  className="h-9 w-20 text-right"
                  aria-label={`${j.label} (${j.unit})`}
                />
                <span className="text-xs text-muted-foreground">{j.unit}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              0 = never delete. Minimum {j.floor} {j.unit}. Default {j.defaultValue === 0 ? "off" : `${j.defaultValue} ${j.unit}`}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => run(j, "preview")} disabled={busy !== null}>
                {busy === `${j.key}:preview` ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                Preview
              </Button>
              <Button variant="destructive" size="sm" onClick={() => run(j, "delete")} disabled={busy !== null || !(saved[j.key] > 0)}>
                {busy === `${j.key}:delete` ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete now
              </Button>
            </div>
            {dirty && values[j.key] !== saved[j.key] && (
              <p className="text-[11px] text-amber-700">Unsaved change. Save first, then Preview or Delete will use the new value.</p>
            )}
            <StatusBox s={status[j.key]} />
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 z-10 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{dirty ? "You have unsaved changes." : "All changes saved."}</p>
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save settings
          </Button>
        </div>
        <StatusBox s={saveStatus} />
      </div>
    </div>
  )
}
