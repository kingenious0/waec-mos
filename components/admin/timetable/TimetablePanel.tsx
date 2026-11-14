'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Upload,
  FileText,
  FileSpreadsheet,
  History,
  Trash2,
  Pencil,
  Check,
  X,
  Plus,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Info,
  UserCheck,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface SeriesInfo {
  id: string
  name: string
  seriesYear: number
  status: string
  startDate: string
  endDate: string
  papers: number
  firstPaper: string | null
  lastPaper: string | null
  needsCouncilTime: number
  lastImport: { fileName: string; sourceFormat: string; importedCount: number; createdAt: string } | null
}

interface PaperRow {
  id: string
  examDate: string
  sessionSlot: 'MORNING' | 'AFTERNOON' | 'FULL_DAY'
  paperCode: string | null
  paperName: string
  durationText: string | null
  startTime: string | null
  endTime: string | null
  needsCouncilTime: boolean
  isNewCurriculum: boolean
  sortOrder: number
}

interface TimetableRowInput {
  examDate: string | null
  sessionSlot: 'MORNING' | 'AFTERNOON' | 'FULL_DAY'
  paperCode: string | null
  paperName: string
  durationText: string | null
  startTime: string | null
  endTime: string | null
  needsCouncilTime: boolean
  isNewCurriculum: boolean
  sortOrder: number
  warnings: string[]
}

interface ImportPreview {
  fileName: string
  sourceFormat: 'PDF' | 'DOCX' | 'CSV' | 'XLSX'
  rows: TimetableRowInput[]
  stats: { total: number; dated: number; undated: number; needsTime: number; withWarnings: number }
}

/** The four official 2026 series WAEC lists — the cards in the timetable index screenshot. */
const KNOWN_SERIES: Array<{ match: RegExp; display: string; windowNote: string; isCreate?: boolean }> = [
  { match: /SC.*2026|wassce sc/i, display: 'WASSCE 2026 SC TIMETABLE', windowNote: 'School candidates' },
  { match: /bece/i, display: 'BECE 2026 SC & PC TIMETABLE', windowNote: 'School and private candidates' },
  { match: /pc.*first|pc1|first series/i, display: 'WASSCE PC 1 2026 TIMETABLE', windowNote: 'Private candidates — first series', isCreate: true },
  { match: /pc.*second|pc2|second series/i, display: 'WASSCE PC 2 2026 TIMETABLE', windowNote: 'Private candidates — second series', isCreate: true },
]

const SLOT_STYLE: Record<PaperRow['sessionSlot'], string> = {
  MORNING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  AFTERNOON: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  FULL_DAY: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function slotLabel(slot: PaperRow['sessionSlot']): string {
  return slot === 'MORNING' ? 'Morning' : slot === 'AFTERNOON' ? 'Afternoon' : 'Full day'
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function TimetablePanel() {
  const [series, setSeries] = useState<SeriesInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null)
  const [papers, setPapers] = useState<PaperRow[]>([])
  const [papersLoading, setPapersLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(null)

  // Import flow
  const fileRef = useRef<HTMLInputElement>(null)
  const [importFor, setImportFor] = useState<string | null>(null) // operationId being imported into
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importRows, setImportRows] = useState<TimetableRowInput[]>([])
  const [importBusy, setImportBusy] = useState(false)
  const [dropUndated, setDropUndated] = useState(true)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [importResult, setImportResult] = useState<{ removed: number; imported: number } | null>(null)
  const [newSeriesOpen, setNewSeriesOpen] = useState(false)
  const [newSeries, setNewSeries] = useState({ name: '2026 WASSCE PC First Series', seriesYear: 2026, startDate: '', endDate: '' })
  const [newSeriesBusy, setNewSeriesBusy] = useState(false)

  // Deployments
  const [deployments, setDeployments] = useState<any[]>([])
  const [deployOfficerId, setDeployOfficerId] = useState('')
  const [deployCenterId, setDeployCenterId] = useState('')
  const [deployScope, setDeployScope] = useState<'anchor' | 'day'>('anchor')
  const [deployDate, setDeployDate] = useState('')
  const [deployRole, setDeployRole] = useState('MONITOR')
  const [officers, setOfficers] = useState<Array<{ id: string; name: string; staffId?: string; assignedCenter?: string }>>([])
  const [centers, setCenters] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [deployBusy, setDeployBusy] = useState(false)

  // Delete-timetable flow
  const [clearOpen, setClearOpen] = useState(false)
  const [clearConfirmName, setClearConfirmName] = useState('')
  const [clearBusy, setClearBusy] = useState(false)

  const activeSeries = series.find((s) => s.id === activeSeriesId) || null

  const feedbackTimer = useRef<number | null>(null)
  const showFeedback = useCallback((tone: 'ok' | 'err' | 'info', text: string) => {
    setFeedback({ tone, text })
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 6000)
  }, [])

  const loadSeries = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/timetable/series', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load the exam series.')
      setSeries(data.series || [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the exam series.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPapers = useCallback(async (operationId: string) => {
    setPapersLoading(true)
    try {
      const res = await fetch(`/api/timetable?operationId=${encodeURIComponent(operationId)}`, { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setPapers(data.rows || [])
    } finally {
      setPapersLoading(false)
    }
  }, [])

  const loadDeployments = useCallback(async (operationId: string) => {
    try {
      const [depRes, offRes, ctrRes] = await Promise.all([
        fetch(`/api/deployments?operationId=${encodeURIComponent(operationId)}`, { credentials: 'include' }),
        fetch('/api/officers', { credentials: 'include' }),
        fetch('/api/centers', { credentials: 'include' }),
      ])
      const dep = await depRes.json()
      const off = await offRes.json()
      const ctr = await ctrRes.json()
      if (depRes.ok) setDeployments(dep.deployments || [])
      if (offRes.ok) setOfficers(off.officers || off || [])
      if (ctrRes.ok) setCenters(ctr.centers || [])
    } catch {
      /* deployment board is optional — don't block the timetable view */
    }
  }, [])

  useEffect(() => {
    loadSeries()
  }, [loadSeries])

  useEffect(() => {
    if (activeSeriesId) {
      loadPapers(activeSeriesId)
      loadDeployments(activeSeriesId)
    }
  }, [activeSeriesId, loadPapers, loadDeployments])

  /* ---------------- Import flow ---------------- */

  const openImport = (operationId: string | null) => {
    setImportFor(operationId)
    setImportPreview(null)
    setImportRows([])
    setImportResult(null)
    setConfirmReplace(false)
    setDropUndated(true)
    setNewSeriesOpen(false)
  }

  const parseFile = async (file: File) => {
    setImportBusy(true)
    setImportPreview(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/timetable/import/preview', { method: 'POST', body: form, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not read that file.')
      setImportPreview(data)
      setImportRows(data.rows)
      showFeedback('info', `${data.rows.length} rows found in ${data.fileName}. Review before importing.`)
    } catch (err) {
      showFeedback('err', err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setImportBusy(false)
    }
  }

  const patchRow = (index: number, patch: Partial<TimetableRowInput>) => {
    setImportRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const importableRows = useMemo(
    () => (dropUndated ? importRows.filter((r) => r.examDate) : importRows),
    [importRows, dropUndated]
  )
  const undatedCount = importRows.filter((r) => !r.examDate).length

  const commitImport = async () => {
    if (!importFor) return
    if (importableRows.length === 0) {
      showFeedback('err', 'Nothing to import — fix or remove the flagged rows first.')
      return
    }
    setImportBusy(true)
    try {
      const res = await fetch('/api/timetable/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          operationId: importFor,
          fileName: importPreview?.fileName,
          sourceFormat: importPreview?.sourceFormat,
          rows: importableRows,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'The timetable could not be saved.')
      setImportResult({ removed: data.removed, imported: data.imported })
      setConfirmReplace(false)
      showFeedback('ok', `Import complete — removed ${data.removed}, imported ${data.imported} papers.`)
      await loadSeries()
      await loadPapers(importFor)
    } catch (err) {
      showFeedback('err', err instanceof Error ? err.message : 'The timetable could not be saved.')
    } finally {
      setImportBusy(false)
    }
  }

  const createSeriesAndImport = async () => {
    setNewSeriesBusy(true)
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newSeries.name.trim(),
          seriesYear: newSeries.seriesYear,
          startDate: newSeries.startDate,
          endDate: newSeries.endDate,
          status: 'PLANNING',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create the series.')
      const created = data.operation
      await loadSeries()
      setActiveSeriesId(created.id)
      openImport(created.id)
    } catch (err) {
      showFeedback('err', err instanceof Error ? err.message : 'Could not create the series.')
    } finally {
      setNewSeriesBusy(false)
    }
  }

  /* ---------------- Paper editing ---------------- */

  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<PaperRow>>({})

  const startEdit = (row: PaperRow) => {
    setEditingRow(row.id)
    setDraft({ ...row })
  }

  const saveEdit = async () => {
    if (!editingRow) return
    try {
      const res = await fetch('/api/timetable', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...draft, id: editingRow }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save.')
      setPapers((prev) => prev.map((p) => (p.id === editingRow ? { ...p, ...draft } as PaperRow : p)))
      setEditingRow(null)
      showFeedback('ok', 'Paper updated.')
    } catch (err) {
      showFeedback('err', err instanceof Error ? err.message : 'Could not save the paper.')
    }
  }

  const deletePaper = async (row: PaperRow) => {
    if (!window.confirm(`Remove “${row.paperName}” from the timetable? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/timetable?id=${encodeURIComponent(row.id)}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error('Could not delete the paper.')
      setPapers((prev) => prev.filter((p) => p.id !== row.id))
      showFeedback('ok', 'Paper removed.')
    } catch (err) {
      showFeedback('err', err instanceof Error ? err.message : 'Could not delete the paper.')
    }
  }

  /* ---------------- Deployments ---------------- */

  const clearTimetable = async () => {
    if (!activeSeries) return
    setClearBusy(true)
    try {
      const res = await fetch(`/api/timetable?operationId=${encodeURIComponent(activeSeries.id)}&scope=papers`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not delete the timetable.')
      setPapers([])
      setClearOpen(false)
      setClearConfirmName('')
      showFeedback('ok', `Deleted ${data.removed ?? 0} papers from ${activeSeries.name}. The series itself is unchanged.`)
      await loadSeries()
    } catch (err) {
      showFeedback('err', err instanceof Error ? err.message : 'Could not delete the timetable.')
    } finally {
      setClearBusy(false)
    }
  }

  const deployOfficer = async () => {
    if (!activeSeriesId || !deployOfficerId || !deployCenterId) {
      showFeedback('err', 'Pick an officer and a centre first.')
      return
    }
    if (deployScope === 'day' && !deployDate) {
      showFeedback('err', 'Pick the day for the override.')
      return
    }
    setDeployBusy(true)
    try {
      const res = await fetch('/api/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          operationId: activeSeriesId,
          officerId: deployOfficerId,
          centerId: deployCenterId,
          deploymentDate: deployScope === 'day' ? deployDate : '',
          shiftRole: deployRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not deploy.')
      setDeployOfficerId('')
      setDeployDate('')
      showFeedback('ok', deployScope === 'day' ? 'One-day override saved.' : 'Officer anchored to the series.')
      await loadDeployments(activeSeriesId)
    } catch (err) {
      showFeedback('err', err instanceof Error ? err.message : 'Could not deploy the officer.')
    } finally {
      setDeployBusy(false)
    }
  }

  const removeDeployment = async (id: string) => {
    try {
      const res = await fetch(`/api/deployments?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error('Could not remove.')
      setDeployments((prev) => prev.filter((d) => d.id !== id))
      showFeedback('ok', 'Deployment removed.')
    } catch (err) {
      showFeedback('err', err instanceof Error ? err.message : 'Could not remove the deployment.')
    }
  }

  /* ---------------- Derived ---------------- */

  // Cards for the four published WAEC 2026 series — merge DB state onto the known labels
  const cards = useMemo(() => {
    const used = new Set<string>()
    const result: Array<{ display: string; windowNote: string; series?: SeriesInfo; isPlaceholder?: boolean }> = []
    for (const known of KNOWN_SERIES) {
      const match = series.find((s) => known.match.test(s.name) || known.match.test(s.id))
      if (match) {
        used.add(match.id)
        result.push({ display: known.display, windowNote: known.windowNote, series: match })
      } else if (known.isCreate) {
        result.push({ display: known.display, windowNote: known.windowNote, isPlaceholder: true })
      }
    }
    // Any other series in the DB (e.g. 2027 when it arrives) listed afterwards
    for (const s of series) {
      if (!used.has(s.id)) result.push({ display: s.name, windowNote: `${s.seriesYear} · ${s.status.toLowerCase()}`, series: s })
    }
    return result
  }, [series])

  const papersByDate = useMemo(() => {
    const map = new Map<string, PaperRow[]>()
    for (const p of papers) {
      const list = map.get(p.examDate) || []
      list.push(p)
      map.set(p.examDate, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [papers])

  const pendingCouncil = papers.filter((p) => p.needsCouncilTime).length

  const isFatal = Boolean(loadError)

  /* ---------------- Render ---------------- */

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="size-7 animate-spin text-indigo-400" />
        <p className="text-sm text-muted-foreground">Loading examination timetables…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 sm:p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="size-5 text-[#F6D300]" />
            Examination timetable
          </h2>
          <p className="text-[12px] text-muted-foreground mt-1">
            What each monitored centre is writing on every exam day. Import an official WAEC timetable and officers
            resolve their papers automatically on the day.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewSeriesOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#22263C] bg-[#0E1220] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-indigo-500/50 hover:text-white transition cursor-pointer"
        >
          <Plus className="size-4" /> Add a series
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs flex items-center gap-2 ${
            feedback.tone === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : feedback.tone === 'err'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
          }`}
          role="status"
        >
          {feedback.tone === 'err' ? <AlertTriangle className="size-4 shrink-0" /> : <Info className="size-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {isFatal && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{loadError}</div>
      )}

      {/* The four WAEC series cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(({ display, windowNote, series: s, isPlaceholder }) => (
          <div
            key={display}
            className="rounded-2xl border border-[#22263C] bg-[#0E1220] p-4 flex flex-col gap-3 hover:border-indigo-500/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{windowNote}</div>
                <h3 className="text-[13px] sm:text-sm font-bold text-white leading-snug mt-1">{display}</h3>
              </div>
              <BookOpen className="size-5 text-[#F6D300] shrink-0 mt-1" />
            </div>

            {s ? (
              <>
                <div className="text-[11px] text-slate-400">
                  {formatDate(s.startDate)} — {formatDate(s.endDate)}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                    {s.papers} papers
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300" title="WAEC hasn't published the date or time for these papers yet">
                    {s.needsCouncilTime} time TBC
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      s.status === 'ACTIVE'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : s.status === 'COMPLETED'
                          ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
                          : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                {s.lastImport && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                    <History className="size-3" />
                    <span className="truncate">
                      {s.lastImport.sourceFormat} · {s.lastImport.fileName} · {new Date(s.lastImport.createdAt).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSeriesId(activeSeriesId === s.id ? null : s.id)}
                    className="flex-1 rounded-lg border border-[#22263C] bg-[#0A0D17] px-2.5 py-2 text-[11px] font-semibold text-slate-200 hover:border-indigo-500/50 hover:text-white transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {activeSeriesId === s.id ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    {activeSeriesId === s.id ? 'Hide papers' : 'View papers'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openImport(s.id)}
                    className="flex-1 rounded-lg bg-[#1E2B7B] hover:bg-[#273a9c] px-2.5 py-2 text-[11px] font-semibold text-white transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Upload className="size-3.5" />
                    Import / Replace
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] text-slate-500">Not loaded yet — the official file was never imported into this system.</div>
                <div className="mt-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setNewSeries((n) => ({ ...n, name: '2026 WASSCE PC First Series' }))
                      setNewSeriesOpen(true)
                    }}
                    className="w-full rounded-lg border border-dashed border-[#2A2F4A] bg-[#0A0D17] px-2.5 py-2.5 text-[11px] font-semibold text-slate-300 hover:border-indigo-500/50 hover:text-white transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Upload className="size-3.5" />
                    Import official timetable…
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Papers view — only when a series is open */}
      {activeSeries && (
        <div className="rounded-2xl border border-[#22263C] bg-[#0E1220] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-4 border-b border-[#22263C]">
            <div>
              <h3 className="text-sm font-bold text-white">{activeSeries.name}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {papers.length} papers · {pendingCouncil} awaiting times from WAEC
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setClearConfirmName(''); setClearOpen(true) }}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-[11px] font-semibold text-rose-300 transition cursor-pointer inline-flex items-center gap-1.5"
                title="Delete every paper in this series — the series itself stays"
              >
                <Trash2 className="size-3.5" />
                Delete timetable
              </button>
              <button
                type="button"
                onClick={() => openImport(activeSeries.id)}
                className="rounded-lg bg-[#1E2B7B] hover:bg-[#273a9c] px-3 py-2 text-[11px] font-semibold text-white transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Upload className="size-3.5" />
                Import / Replace timetable
              </button>
            </div>
          </div>

          {papersLoading ? (
            <div className="py-14 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto divide-y divide-[#1A1E32]">
              {papersByDate.map(([date, rows]) => (
                <div key={date} className="px-4 sm:px-5 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#F6D300] mb-2">{formatDate(date)}</div>
                  <div className="space-y-1.5">
                    {rows.map((p) =>
                      editingRow === p.id ? (
                        <div key={p.id} className="rounded-xl border border-indigo-500/40 bg-[#0A0D17] p-2.5 grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
                          <input type="date" value={draft.examDate || ''} onChange={(e) => setDraft((d) => ({ ...d, examDate: e.target.value }))} className="rounded-lg border border-[#22263C] bg-[#0E1220] px-2 py-1.5 text-[11px] text-white" />
                          <select value={draft.sessionSlot || 'MORNING'} onChange={(e) => setDraft((d) => ({ ...d, sessionSlot: e.target.value as any }))} className="rounded-lg border border-[#22263C] bg-[#0E1220] px-2 py-1.5 text-[11px] text-white">
                            <option value="MORNING">Morning</option>
                            <option value="AFTERNOON">Afternoon</option>
                            <option value="FULL_DAY">Full day</option>
                          </select>
                          <input value={draft.paperCode || ''} onChange={(e) => setDraft((d) => ({ ...d, paperCode: e.target.value }))} placeholder="Code" className="rounded-lg border border-[#22263C] bg-[#0E1220] px-2 py-1.5 text-[11px] text-white" />
                          <input value={draft.startTime || ''} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))} placeholder="08:30" className="rounded-lg border border-[#22263C] bg-[#0E1220] px-2 py-1.5 text-[11px] text-white" />
                          <input value={draft.endTime || ''} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))} placeholder="11:00" className="rounded-lg border border-[#22263C] bg-[#0E1220] px-2 py-1.5 text-[11px] text-white" />
                          <div className="flex items-center gap-1.5 justify-end">
                            <button type="button" onClick={saveEdit} className="p-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30" aria-label="Save"><Check className="size-4" /></button>
                            <button type="button" onClick={() => setEditingRow(null)} className="p-1.5 rounded-lg border border-[#22263C] text-slate-400 hover:text-white" aria-label="Cancel"><X className="size-4" /></button>
                          </div>
                          <input value={draft.paperName || ''} onChange={(e) => setDraft((d) => ({ ...d, paperName: e.target.value }))} className="col-span-2 sm:col-span-6 rounded-lg border border-[#22263C] bg-[#0E1220] px-2 py-1.5 text-[11px] text-white" />
                        </div>
                      ) : (
                        <div key={p.id} className="flex items-center gap-2 sm:gap-3 rounded-xl border border-transparent hover:border-[#22263C] hover:bg-[#0A0D17] px-2 py-1.5 group transition">
                          <span className={`text-[9px] sm:text-[10px] font-mono border rounded-full px-2 py-0.5 shrink-0 ${SLOT_STYLE[p.sessionSlot]}`}>{slotLabel(p.sessionSlot)}</span>
                          <span className="font-mono text-[10px] sm:text-[11px] text-slate-500 w-16 sm:w-20 shrink-0 truncate">{p.paperCode || '—'}</span>
                          <span className="text-[11px] sm:text-xs text-slate-200 flex-1 min-w-0 truncate" title={p.paperName}>
                            {p.paperName}
                            {p.isNewCurriculum && <span className="text-[#F6D300]" title="New curriculum paper"> *</span>}
                          </span>
                          <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 shrink-0">
                            {p.needsCouncilTime ? <span className="text-amber-400">time TBC</span> : `${p.startTime || '—'}–${p.endTime || '—'}`}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button type="button" onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-slate-500 hover:text-white" aria-label="Edit paper"><Pencil className="size-3.5" /></button>
                            <button type="button" onClick={() => deletePaper(p)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400" aria-label="Delete paper"><Trash2 className="size-3.5" /></button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
              {papersByDate.length === 0 && <div className="py-12 text-center text-xs text-slate-500">No papers in this series yet — import the official timetable.</div>}
            </div>
          )}
        </div>
      )}

      {/* Officer deployment board for the open series */}
      {activeSeries && (
        <div className="rounded-2xl border border-[#22263C] bg-[#0E1220] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="size-4 text-[#F6D300]" />
                Who is deployed for this series
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Anchor an officer to a centre for the whole series, or assign a one-day override.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3">
            <select value={deployOfficerId} onChange={(e) => setDeployOfficerId(e.target.value)} className="sm:col-span-3 rounded-lg border border-[#22263C] bg-[#0A0D17] px-3 py-2 text-xs text-white">
              <option value="">Pick officer…</option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>{o.name}{o.staffId ? ` (${o.staffId})` : ''}</option>
              ))}
            </select>
            <select value={deployCenterId} onChange={(e) => setDeployCenterId(e.target.value)} className="sm:col-span-3 rounded-lg border border-[#22263C] bg-[#0A0D17] px-3 py-2 text-xs text-white">
              <option value="">Pick centre…</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
            <select value={deployScope} onChange={(e) => setDeployScope(e.target.value as any)} className="sm:col-span-2 rounded-lg border border-[#22263C] bg-[#0A0D17] px-3 py-2 text-xs text-white">
              <option value="anchor">Whole series</option>
              <option value="day">One day</option>
            </select>
            {deployScope === 'day' ? (
              <input type="date" value={deployDate} onChange={(e) => setDeployDate(e.target.value)} className="sm:col-span-2 rounded-lg border border-[#22263C] bg-[#0A0D17] px-3 py-2 text-xs text-white" />
            ) : (
              <select value={deployRole} onChange={(e) => setDeployRole(e.target.value)} className="sm:col-span-2 rounded-lg border border-[#22263C] bg-[#0A0D17] px-3 py-2 text-xs text-white">
                <option value="MONITOR">Monitor</option>
                <option value="GROUP_LEADER">Group leader</option>
                <option value="RELIEF">Relief</option>
              </select>
            )}
            <button type="button" onClick={deployOfficer} disabled={deployBusy} className="sm:col-span-2 rounded-lg bg-[#1E2B7B] hover:bg-[#273a9c] disabled:opacity-60 px-3 py-2 text-xs font-semibold text-white transition cursor-pointer">
              {deployBusy ? 'Saving…' : 'Deploy'}
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-[#1A1E32]">
            {deployments.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-slate-500">No deployments yet for this series.</div>
            ) : (
              deployments.map((d) => (
                <div key={d.id} className="flex items-center gap-3 py-2 px-1">
                  <span className="text-xs font-medium text-slate-200 flex-1 min-w-0 truncate">{d.officerName}</span>
                  <span className="text-[10px] font-mono text-slate-500 truncate max-w-[40%]">{d.centerName}</span>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0 w-24 text-right">
                    {d.deploymentDate ? formatDate(d.deploymentDate).replace(/,.*$/, '') : 'Whole series'} · {d.shiftRole === 'GROUP_LEADER' ? 'GL' : d.shiftRole === 'RELIEF' ? 'Relief' : 'Mon'}
                  </span>
                  <button type="button" onClick={() => removeDeployment(d.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400" aria-label="Remove deployment">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------- Delete timetable confirmation ---------------- */}
      {clearOpen && activeSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" role="dialog" aria-modal="true" aria-labelledby="clear-timetable-title">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0E1220] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5 text-rose-400" />
              </div>
              <div>
                <h3 id="clear-timetable-title" className="text-base font-bold text-white">Delete the timetable for “{activeSeries.name}”?</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  This permanently removes all <span className="text-white font-semibold">{papers.length} papers</span> in this
                  series. The series itself, officer deployments and check-in history are kept. You can import a fresh file anytime.
                </p>
              </div>
            </div>
            <label className="block text-[11px] font-semibold text-slate-300">
              Type <span className="text-rose-300">{activeSeries.name}</span> to confirm
              <input
                value={clearConfirmName}
                onChange={(e) => setClearConfirmName(e.target.value)}
                autoFocus
                placeholder={activeSeries.name}
                className="mt-1.5 w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white placeholder:text-slate-600"
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setClearOpen(false)} className="rounded-lg border border-[#22263C] px-4 py-2 text-xs text-slate-300 hover:text-white cursor-pointer">Cancel</button>
              <button
                type="button"
                onClick={clearTimetable}
                disabled={clearBusy || clearConfirmName.trim() !== activeSeries.name}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-xs font-bold text-white transition cursor-pointer inline-flex items-center gap-1.5"
              >
                {clearBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {clearBusy ? 'Deleting…' : `Delete ${papers.length} papers`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Add series modal ---------------- */}
      {newSeriesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-[#22263C] bg-[#0E1220] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">Add an examination series</h3>
                <p className="text-[11px] text-slate-500 mt-1">Name and window exactly as WAEC publishes them. Used for imports and deployments.</p>
              </div>
              <button type="button" onClick={() => setNewSeriesOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white" aria-label="Close"><X className="size-5" /></button>
            </div>
            <label className="block text-[11px] font-semibold text-slate-300">
              Series name
              <input value={newSeries.name} onChange={(e) => setNewSeries((n) => ({ ...n, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white" placeholder="e.g. 2026 WASSCE PC First Series" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[11px] font-semibold text-slate-300">
                Year
                <input type="number" value={newSeries.seriesYear} onChange={(e) => setNewSeries((n) => ({ ...n, seriesYear: Number(e.target.value) || newSeries.seriesYear }))} className="mt-1 w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-300">
                First day
                <input type="date" value={newSeries.startDate} onChange={(e) => setNewSeries((n) => ({ ...n, startDate: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-300">
                Last day
                <input type="date" value={newSeries.endDate} onChange={(e) => setNewSeries((n) => ({ ...n, endDate: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white" />
              </label>
            </div>
            <button type="button" onClick={createSeriesAndImport} disabled={newSeriesBusy || !newSeries.startDate || !newSeries.endDate || !newSeries.name.trim()} className="w-full rounded-xl bg-[#1E2B7B] hover:bg-[#273a9c] disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition cursor-pointer">
              {newSeriesBusy ? 'Creating…' : 'Create series & import its timetable →'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Import / replace modal ---------------- */}
      {importFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-[#22263C] bg-[#0E1220] overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#22263C]">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="size-4 text-[#F6D300]" /> Import timetable
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Official WAEC file in — PDF by default (also DOCX, CSV, Excel). Review the rows, fix anything flagged, then import.
                  Importing <span className="text-amber-300">replaces this series' entire timetable</span>.
                </p>
              </div>
              <button type="button" onClick={() => setImportFor(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white shrink-0" aria-label="Close"><X className="size-5" /></button>
            </div>

            {!importPreview && (
              <div className="p-6 flex flex-col items-center justify-center gap-4 text-center overflow-y-auto">
                <div className="rounded-2xl border border-dashed border-[#2A2F4A] bg-[#0A0D17] px-6 py-10 w-full max-w-md">
                  <FileSpreadsheet className="size-10 text-indigo-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-white">Choose the official timetable file</p>
                  <p className="text-[11px] text-slate-500 mt-1 mb-4">PDF (default), DOCX, CSV or Excel. The file is parsed first — nothing is saved until you confirm.</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) parseFile(f)
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    disabled={importBusy}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1E2B7B] hover:bg-[#273a9c] disabled:opacity-60 px-5 py-2.5 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    {importBusy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {importBusy ? 'Reading file…' : 'Choose file…'}
                  </button>
                  <div className="mt-4">
                    <a
                      href="data:text/csv;charset=utf-8,date,session,paper_code,paper_name,duration,start,end\n2026-05-04,MORNING,001/2,English Language 2 (Essay),1 hour 10 minutes,09:00,10:10\n2026-05-04,AFTERNOON,022/2,Religious and Moral Education 2 (Essay),1 hour,13:00,14:00\n"
                      download="waec-mos-timetable-template.csv"
                      className="text-[11px] text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
                    >
                      Download a CSV template (for manual entry)
                    </a>
                  </div>
                </div>
                <p className="text-[10px] text-slate-600">Official sources: waecgh.org/timetable · unified.ghanawaec.org</p>
              </div>
            )}

            {importPreview && (
              <>
                <div className="px-5 py-3 border-b border-[#22263C] flex flex-wrap items-center gap-2 text-[10px] font-mono">
                  <span className="px-2 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">{importPreview.sourceFormat} · {importPreview.fileName.slice(0, 40)}</span>
                  <span className="px-2 py-1 rounded-full border border-slate-500/30 bg-slate-500/10 text-slate-300">{importPreview.stats.dated} dated</span>
                  <span className="px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">{importRows.length - importPreview.stats.dated} undated</span>
                  <span className="px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">{importPreview.stats.needsTime} times TBC</span>
                  <span className="px-2 py-1 rounded-full border border-slate-500/30 bg-slate-500/10 text-slate-300">{importPreview.stats.withWarnings} flagged</span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[#1A1E32]">
                  {importRows.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500">No rows were found — nothing will be imported.</div>
                  ) : (
                    importRows.map((r, i) => (
                      <div key={i} className="px-4 py-2 grid grid-cols-12 gap-1.5 items-center text-[11px]">
                        <input type="date" value={r.examDate || ''} onChange={(e) => patchRow(i, { examDate: e.target.value })} className={`col-span-3 sm:col-span-2 rounded-md border px-1.5 py-1 bg-[#0A0D17] text-white ${r.examDate ? 'border-[#22263C]' : 'border-amber-500/60'}`} />
                        <select value={r.sessionSlot} onChange={(e) => patchRow(i, { sessionSlot: e.target.value as any })} className="col-span-2 sm:col-span-1 rounded-md border border-[#22263C] px-1.5 py-1 bg-[#0A0D17] text-white">
                          <option value="MORNING">AM</option>
                          <option value="AFTERNOON">PM</option>
                          <option value="FULL_DAY">ALL</option>
                        </select>
                        <input value={r.paperCode || ''} onChange={(e) => patchRow(i, { paperCode: e.target.value })} placeholder="code" className="col-span-2 rounded-md border border-[#22263C] px-1.5 py-1 bg-[#0A0D17] text-white font-mono" />
                        <input value={r.paperName} onChange={(e) => patchRow(i, { paperName: e.target.value })} className={`col-span-4 sm:col-span-4 rounded-md border px-1.5 py-1 bg-[#0A0D17] text-white ${r.warnings.length ? 'border-amber-500/60' : 'border-[#22263C]'}`} title={r.warnings.join(' ')} />
                        <input value={r.startTime || ''} onChange={(e) => patchRow(i, { startTime: e.target.value || null, needsCouncilTime: !e.target.value })} placeholder="08:30" className="col-span-2 sm:col-span-1 rounded-md border border-[#22263C] px-1.5 py-1 bg-[#0A0D17] text-white font-mono" />
                        <input value={r.endTime || ''} onChange={(e) => patchRow(i, { endTime: e.target.value || null, needsCouncilTime: !e.target.value })} placeholder="11:00" className="col-span-2 sm:col-span-1 rounded-md border border-[#22263C] px-1.5 py-1 bg-[#0A0D17] text-white font-mono" />
                        <button type="button" onClick={() => setImportRows((prev) => prev.filter((_, idx) => idx !== i))} className="col-span-1 sm:col-span-1 justify-self-end p-1 rounded text-slate-500 hover:text-rose-400" aria-label="Remove row"><Trash2 className="size-4" /></button>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-5 py-3.5 border-t border-[#22263C]">
                  {importResult ? (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="text-sm text-emerald-300 font-semibold">✓ Imported {importResult.imported} papers · replaced {importResult.removed}. Nothing was duplicated.</p>
                      <button type="button" onClick={() => setImportFor(null)} className="rounded-xl bg-[#1E2B7B] hover:bg-[#273a9c] px-4 py-2 text-xs font-semibold text-white">Done</button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
                        <input type="checkbox" checked={dropUndated} onChange={(e) => setDropUndated(e.target.checked)} className="accent-indigo-500" />
                        Drop {undatedCount} undated rows (WAEC hasn't published them yet)
                      </label>
                      {!confirmReplace ? (
                        <button type="button" onClick={() => setConfirmReplace(true)} disabled={importableRows.length === 0} className="rounded-xl bg-amber-500/90 hover:bg-amber-400 disabled:opacity-50 px-4 py-2 text-xs font-bold text-black transition cursor-pointer">
                          Import {importableRows.length} papers — replace timetable…
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-amber-300 max-w-[280px]">This wipes the current timetable for the series and writes the {importableRows.length} reviewed rows.</span>
                          <button type="button" onClick={() => setConfirmReplace(false)} className="rounded-lg border border-[#22263C] px-3 py-2 text-[11px] text-slate-300 hover:text-white">Cancel</button>
                          <button type="button" onClick={commitImport} disabled={importBusy} className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-2 text-[11px] font-bold text-black cursor-pointer">
                            {importBusy ? 'Importing…' : 'Replace now'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
