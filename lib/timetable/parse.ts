/**
 * Parsers for the official WAEC timetable files (PDF default, plus DOCX / CSV / XLSX).
 *
 * WAEC PDFs extract as loosely-aligned text: dates appear on their own line (or as a
 * weekday line + date line, or as an April→April multi-day range for project work and
 * orals), paper codes on separate lines, and subject + duration + times sometimes on one
 * line. Auto-parsing therefore aims to recover the tables as best it can and puts the
 * result in front of HQ for review — the preview UI fixes anything flagged, and the
 * commit endpoint refuses to write rows that are not fully dated and named.
 *
 * Nothing from here reaches the database without going through the preview + commit flow.
 */
import { TimetableRowInput, SessionSlot } from './types'

export const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}
export const MONTH_RE = /(january|february|march|april|may|june|july|august|september|october|november|december)/i
export const WEEKDAY_RE = /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i

const pad = (n: number) => String(n).padStart(2, '0')

/** Convert a published clock token to 24h HH:MM. Handles '9.00 a.m.', '08:30 hrs.', '13:00'. */
export function to24h(raw: string): string | null {
  const m = String(raw).match(/(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?|hrs?\.?)?/i)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  const minute = parseInt(m[2], 10)
  if (minute > 59 || hour > 23) return null
  const suffix = (m[3] || '').toLowerCase().replace(/[.\s]/g, '')
  if (suffix.startsWith('a')) {
    // 12 a.m. = midnight
    if (hour === 12) hour = 0
  } else if (suffix.startsWith('p')) {
    if (hour !== 12) hour += 12
  }
  return `${pad(hour)}:${pad(minute)}`
}

/** Find a 'HH:MM – HH:MM' pattern anywhere in a line, tolerant of dashes and en-spaces. */
export function parseClockRange(line: string): { startTime: string; endTime: string } | null {
  const cleaned = String(line)
    .replace(/[–—−\uFFFD]/g, '-') // en/em dashes, minus signs, pdf mojibake
    .replace(/\s+/g, ' ')
  const times = [...cleaned.matchAll(/(\d{1,2})[:.](\d{2})\s*(?:a\.?m\.?|p\.?m\.?|hrs?\.?)?/gi)]
  if (times.length < 2) return null
  const start = to24h(times[0][0])
  const end = to24h(times[1][0])
  if (!start || !end) return null
  return { startTime: start, endTime: end }
}

function slotFromStart(startTime: string | null): SessionSlot {
  if (!startTime) return 'FULL_DAY'
  const hour = parseInt(startTime.slice(0, 2), 10)
  return hour < 12 ? 'MORNING' : 'AFTERNOON'
}

/** Extract a duration phrase like '2 hours 30 minutes' / '1hr 20mins' / '50mins'.
 *  Ignores matches glued to a clock time ('08:30 hrs.') so times are not mistaken for durations. */
export function parseDuration(line: string): string | null {
  const src = String(line)
  const matches = [...src.matchAll(/(?<![:\d])(\d+)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi)].filter((m) => {
    const idx = m.index ?? 0
    return idx === 0 || src[idx - 1] !== ':'
  })
  if (matches.length === 0) return null
  const parts = matches.map((m) => ({ n: m[1], unit: m[2].toLowerCase() }))
  const hours = parts.find((p) => p.unit.startsWith('h'))
  const mins = parts.find((p) => p.unit.startsWith('m'))
  const out: string[] = []
  if (hours) out.push(`${hours.n} hr${Number(hours.n) === 1 ? '' : 's'}`)
  if (mins) out.push(`${mins.n} mins`)
  return out.length ? out.join(' ') : null
}

/** Lines that are page furniture — headers, footers, notes sections. */
function isSkippableLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^the west african examinations council/i.test(t)) return true
  if (/^west african senior school certificate/i.test(t)) return true
  if (/^basic education certificate examination/i.test(t)) return true
  if (/^final (international )?timetable/i.test(t)) return true
  if (/^timetable for candidates/i.test(t)) return true
  if (/^date\s+paper\s+code\s+subject/i.test(t)) return true
  if (/^notes?$/i.test(t) || /^headquarters,\s*accra/i.test(t)) return true
  if (/^(august|february|march|april|may|june|september|october|november|december)\s*2026$/i.test(t)) return true
  if (/^date\s+paper$/i.test(t)) return true // repeated page header
  if (/^code$/i.test(t)) return true // repeated page header
  if (/^subject\s+paper\s+duration\s+time/i.test(t)) return true // repeated page header
  if (/^school and private candidates/i.test(t)) return true // BECE registration header
  if (/^date\s+subject/i.test(t)) return true // BECE table header
  if (/^code\s+subject\/paper\s+duration/i.test(t)) return true // BECE table header
  if (/^\d{1,2}$/.test(t)) return true // lone page number
  if (/^\d{4}$/.test(t)) return true // stray year fragment
  return false
}

function isoDate(year: number, monthIndex: number, day: number): string | null {
  const d = new Date(Date.UTC(year, monthIndex, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex || d.getUTCDate() !== day) return null
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`
}

interface DateDetection {
  /** ISO date when the line pins a single day */
  single: string | null
  /** ISO range when the line spans '<date> to <date>' */
  range: [string, string] | null
  /** how many source lines this detection consumed (0 = not a date) */
  consumedLines: number
}
const NONE: DateDetection = { single: null, range: null, consumedLines: 0 }

/**
 * Read the tail of a multi-day range starting at the line after the month line:
 *   'to Saturday, 26th' ⏎ 'September, 2026'   (2 lines)
 *   'to Saturday, 26th September, 2026'       (1 line)
 *   'Monday, 27th'      ⏎ 'April, 2026'       (2 lines — when 'to' trailed the month line)
 * Returns the end date and how many lines were consumed (after the usual 2-line head).
 */
function readRangeTail(lines: string[], startIndex: number): { date: string; used: number } | null {
  const WD = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)'
  const first = (lines[startIndex] || '').trim()

  const toForm = first.match(new RegExp(`^to\\s+${WD},?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:,?\\s*(.*))?$`, 'i'))
  if (toForm) {
    const rest = (toForm[2] || '').trim()
    if (rest) {
      const cont = rest.match(new RegExp(`^${MONTH_RE.source}\\s*,?\\s*(\\d{4})\\s*$`, 'i'))
      if (!cont) return null
      const date = isoDate(parseInt(cont[2], 10), MONTHS[cont[1].toLowerCase()], parseInt(toForm[1], 10))
      return date ? { date, used: 1 } : null
    }
    const monthLine = (lines[startIndex + 1] || '').trim()
    const cont = monthLine.match(new RegExp(`^${MONTH_RE.source}\\s*,?\\s*(\\d{4})\\s*$`, 'i'))
    if (!cont) return null
    const date = isoDate(parseInt(cont[2], 10), MONTHS[cont[1].toLowerCase()], parseInt(toForm[1], 10))
    return date ? { date, used: 2 } : null
  }

  const plain = first.match(new RegExp(`^${WD},?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*$`, 'i'))
  if (plain) {
    const monthLine = (lines[startIndex + 1] || '').trim()
    const cont = monthLine.match(new RegExp(`^${MONTH_RE.source}\\s*,?\\s*(\\d{4})\\s*$`, 'i'))
    if (!cont) return null
    const date = isoDate(parseInt(cont[2], 10), MONTHS[cont[1].toLowerCase()], parseInt(plain[1], 10))
    return date ? { date, used: 2 } : null
  }

  return null
}

export function detectDateLine(lines: string[], i: number): DateDetection {
  const line = lines[i].trim()
  if (!line) return NONE

  const tryFull = (text: string): DateDetection => {
    const m = text.match(
      new RegExp(
        `(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\\s*(\\d{1,2})(?:st|nd|rd|th)?,?\\s*${MONTH_RE.source}\\s*,?\\s*(\\d{4})`,
        'i'
      )
    )
    if (!m) return NONE
    const monthIndex = MONTHS[m[3].toLowerCase()]
    const single = isoDate(parseInt(m[4], 10), monthIndex, parseInt(m[2], 10))
    return single ? { single, range: null, consumedLines: 1 } : NONE
  }

  // Case 1: one line carries a complete date (e.g. BECE 'Monday, 4th May, 2026')
  const det = tryFull(line)
  if (det.consumedLines > 0) return det

  // Case 2: multi-day window on one line ('Tuesday, 7th April, 2026 to Monday, 27th April, 2026')
  if (/\bto\b/i.test(line)) {
    const both = [...line.matchAll(
      new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*${MONTH_RE.source}\\s*,?\\s*(\\d{4})`, 'gi')
    )]
    if (both.length >= 2) {
      const a = isoDate(parseInt(both[0][3], 10), MONTHS[both[0][2].toLowerCase()], parseInt(both[0][1], 10))
      const b = isoDate(parseInt(both[1][3], 10), MONTHS[both[1][2].toLowerCase()], parseInt(both[1][1], 10))
      if (a && b) return { single: null, range: [a, b], consumedLines: 1 }
    }
    const singleLine = tryFull(line)
    if (singleLine.consumedLines > 0) return singleLine
  }

  // Case 3: weekday + day on this line, month + year on the next line
  // ('Tuesday, 7th' ⏎ 'September, 2026'  and optional 'to' + next pair for ranges)
  const head = line.match(new RegExp(`^${WEEKDAY_RE.source.replace(/^\^/, '')},?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*$`, 'i'))
  if (head) {
    const next = (lines[i + 1] || '').trim()
    const cont = next.match(new RegExp(`^${MONTH_RE.source}\\s*,?\\s*(\\d{4})\\s*(to)?\\s*$`, 'i'))
    if (cont) {
      const single = isoDate(parseInt(cont[2], 10), MONTHS[cont[1].toLowerCase()], parseInt(head[1], 10))
      if (single) {
        if (cont[3] === 'to') {
          // Range tail is on the following lines: 'to Saturday, 26th' ⏎ 'September, 2026'
          const tail = readRangeTail(lines, i + 2)
          if (tail) return { single: null, range: [single, tail.date], consumedLines: 2 + tail.used }
        } else {
          // Range tail on its own line(s): 'to Saturday, 26th' ⏎ 'September, 2026'
          const toLine = (lines[i + 2] || '').trim()
          if (/^to\b/i.test(toLine)) {
            const tail = readRangeTail(lines, i + 2)
            if (tail) return { single: null, range: [single, tail.date], consumedLines: 2 + tail.used }
          }
        }
        return { single, range: null, consumedLines: 2 }
      }
    }
  }

  // Case 4: bare weekday ('Monday,') with the full date on the next line
  if (WEEKDAY_RE.test(line) && /,?\s*$/.test(line)) {
    const next = (lines[i + 1] || '').trim()
    const singleMatch = next.match(
      new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*${MONTH_RE.source}\\s*,?\\s*(\\d{4})`, 'i')
    )
    if (singleMatch) {
      const single = isoDate(parseInt(singleMatch[3], 10), MONTHS[singleMatch[2].toLowerCase()], parseInt(singleMatch[1], 10))
      if (single) return { single, range: null, consumedLines: 2 }
    }
  }

  return NONE
}

/** A token that looks like a paper code: SC4022, PC5363/B, 003/2-013/2, 034/2 */
function isPaperCode(token: string): boolean {
  const t = token.trim()
  if (!t) return false
  if (/^\d{3}\/\d(-\d{3}\/\d)?$/.test(t)) return true // BECE-style '034/2' and '003/2-013/2'
  if (/^0\d{2}\/\d(-0\d{2}\/\d)?$/.test(t)) return true
  if (/^[A-Za-z]{1,3}\d{3,4}[0-9A-Za-z]*([\/\-][0-9A-Za-z]{1,4}){0,3}$/.test(t)) return true // SC7073, PC5363/B, SC8142
  return false
}

function stripCodesFrom(line: string): { codes: string[]; rest: string } {
  const tokens = line.split(/\s+/)
  const codes = tokens.filter(isPaperCode)
  const rest = tokens.filter((t) => !isPaperCode(t)).join(' ').trim()
  return { codes, rest }
}

/** Lines that carry no paper information — WAEC 'arranged' boilerplate and set markers. */
function isNoiseLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/hours?\s+a\s+day/i.test(t)) return true
  if (/\bpublic\s+holiday\b/i.test(t)) return true
  if (/^-\s*\(?\d+\s*(st|nd|rd|th)\s*Set\)/i.test(t)) return true
  if (/^for\s+\d+\s+days?\b/i.test(t)) return true
  if (/^each\s+paper\b/i.test(t)) return true
  if (/^(date\s+and\s+time|be\s+arranged|will\s+be\s+arranged|time\s+for\s+paper|time\s*\(gmt\)|time\s*\(gmt\))/i.test(t)) return true
  if (/^\(?\d+\s*(st|nd|rd|th)?\s*Set\)?\.?,?$/i.test(t)) return true
  if (/^Set\)?$/i.test(t)) return true
  return false
}

/** A bare duration token line, e.g. '20mins', '1hr', '2hrs 30mins' — times announced later. */
function isBareDurationLine(line: string): boolean {
  return /^(\d+\s*(hours?|hrs?|h|minutes?|mins?|m)(\s+\d+\s*(minutes?|mins?))?)$/i.test(line.trim())
}

/**
 * WAEC tables often print all paper names in one run, glued on one line. A paper boundary
 * is a ')' or '*' immediately followed by a space and a capital letter — e.g.
 * 'Basketry 3 (Project Work)* Ceramics 3 (Project Work)*' splits after every paper.
 * Interior ')' inside a name ('(Practical) - Planning', '3) (Practical)') never split.
 */
function splitSubjectSegments(text: string): string[] {
  return String(text || '')
    .split(/(?<=[\)\*])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
}

/** Collapse whitespace and strip clock times, durations and council boilerplate from inline subject text. */
function cleanInlineText(text: string): string {
  return String(text || '')
    .replace(/^\(\s*continuation\s*\)\s*/i, ' ') // page-break marker glued to a name
    .replace(/\(\s*\d+\s*(st|nd|rd|th)?\s*Sets?\)/gi, ' ') // session set markers '(1 Set)' / '(2nd Set)'
    .replace(/date and time for each paper.*$/i, ' ') // everything from the council sentence is filler
    .replace(/\d{1,2}[:.]\d{2}\s*(a\.?m\.?|p\.?m\.?|hrs?\.?)?/gi, ' ')
    .replace(/\b\d+\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function makeRow(
  date: string | null,
  range: [string, string] | null,
  paperCode: string | null,
  paperName: string,
  durationText: string | null,
  startTime: string | null,
  endTime: string | null,
  isNewCurriculum: boolean,
  sortOrder: number,
  extraWarning?: string
): TimetableRowInput {
  const needsCouncilTime = !startTime || !endTime
  const warnings: string[] = []
  if (extraWarning) warnings.push(extraWarning)
  if (range) {
    warnings.push(`Published as a date range ${range[0]} → ${range[1]} (arranged by the Council) — set the actual date before committing, or delete the row.`)
  } else if (!date) {
    warnings.push('No date detected yet — set the examination date before committing.')
  }
  if (needsCouncilTime) {
    warnings.push('No fixed time published (arranged by the Council) — row is committed with time pending and must be completed before go-live.')
  }
  if (!paperName || paperName.length < 3) {
    warnings.push('Subject / paper name looks wrong — check the row.')
  }
  return {
    examDate: date,
    sessionSlot: slotFromStart(startTime),
    paperCode,
    paperName:
      (paperName || 'Unknown paper')
        .replace(/\*+\s*$/, '') // trailing new-curriculum asterisk
        .replace(/^\s*[-–—]+\s*/, '') // leading dash from PDF wrap
        .replace(/\s*[-–—]+\s*$/, '') // trailing dash from PDF wrap
        .trim() || 'Unknown paper',
    durationText,
    startTime,
    endTime,
    needsCouncilTime,
    isNewCurriculum,
    sortOrder,
    warnings,
  }
}

/** Parse the raw text body of a WAEC-style timetable document. */
export function parseRawText(rawText: string): TimetableRowInput[] {
  const rows: TimetableRowInput[] = []
  const lines = String(rawText || '')
    .replace(/[–—−\uFFFD]/g, '-')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\s{2,}/g, ' ').trimEnd())

  let currentDate: string | null = null
  let currentRange: [string, string] | null = null
  // WAEC prints papers in runs: all codes, then names, then durations, then times.
  // Keep each run as a queue and emit a row whenever position i aligns across all four.
  const queue = {
    codes: [] as (string | null)[],
    names: [] as string[],
    durations: [] as (string | null)[],
    times: [] as ({ startTime: string; endTime: string } | null)[],
  }
  let notesMode = false
  let sortOrder = 0

  // Append subject/name text. A single physical line may carry several glued papers
  // ('Basketry 3 (Project Work)* Ceramics 3 (Project Work)* …') — split those into
  // one entry per paper. Lines that continue a wrapped name are rejoined instead.
  const appendSubjectLine = (raw: string, single = false) => {
    const t = cleanInlineText(raw)
    if (!t) return
    if (!/[A-Za-z0-9]/.test(t)) return // pure punctuation fragments ('-', '—', …)
    // Inline rests from lines WITH codes carry at most one name per code — never split them.
    const segments = single || !t.includes(') ') ? [t] : splitSubjectSegments(t)
    for (const seg of segments) {
      if (!/[A-Za-z0-9]/.test(seg)) continue // drop punctuation-only fragments
      const lastIdx = queue.names.length - 1
      const last = lastIdx >= 0 ? queue.names[lastIdx] : ''
      // Rejoin wrapped names: 'English Language 2' + '(Essay)', or 'Twi (Akuapem)' + '3 (Oral)*'
      const continuePrevious = last && (/^\(/.test(seg) || (/[\)\*]$/.test(last) && /^\d/.test(seg)))
      if (continuePrevious) {
        queue.names[lastIdx] = `${last} ${seg}`
        continue
      }
      queue.names.push(seg)
    }
  }

  const emit = (
    code: string | null,
    name: string,
    duration: string | null,
    time: { startTime: string; endTime: string } | null,
    extraWarning?: string
  ) => {
    rows.push(
      makeRow(currentDate, currentRange, code, name, duration, time?.startTime ?? null, time?.endTime ?? null, /\*/.test(name), sortOrder++, extraWarning)
    )
  }

  // Emit fully-aligned runs — codes[i], names[i], durations[i], times[i].
  const flushAligned = () => {
    while (queue.codes.length && queue.names.length && queue.durations.length && queue.times.length) {
      const n = Math.min(queue.codes.length, queue.names.length, queue.durations.length, queue.times.length)
      for (let i = 0; i < n; i++) {
        emit(queue.codes[i] ?? null, queue.names[i], queue.durations[i] ?? null, queue.times[i] ?? null)
      }
      queue.codes.splice(0, n)
      queue.names.splice(0, n)
      queue.durations.splice(0, n)
      queue.times.splice(0, n)
    }
  }

  // Flush leftovers as 'arranged by the Council' rows (times announced later) or best-effort partial rows.
  const flushResidue = (reason?: string) => {
    const n = Math.max(queue.codes.length, queue.names.length)
    for (let i = 0; i < n; i++) {
      emit(queue.codes[i] ?? null, queue.names[i] ?? 'Unknown paper', queue.durations[i] ?? null, queue.times[i] ?? null, reason)
    }
    resetQueue()
  }

  const resetQueue = () => {
    queue.codes = []
    queue.names = []
    queue.durations = []
    queue.times = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^notes?\b/i.test(line)) {
      notesMode = true
      continue
    }
    if (notesMode) continue
    if (isSkippableLine(line)) continue
    if (isNoiseLine(line)) continue

    // 1) Date?
    const det = detectDateLine(lines, i)
    if (det.consumedLines > 0) {
      // Flush anything half-queued for the previous date before moving on.
      if (queue.codes.length || queue.names.length) flushResidue('Rows could not be aligned when the date changed — check this paper.')
      if (det.range) {
        currentRange = det.range
        currentDate = null
      } else {
        currentRange = null
        currentDate = det.single
      }
      // A date may carry inline papers ('Friday, 8th May, 2026 Arabic 3 (Oral)* …') — keep the rest.
      // Only when a full date sits BEFORE the papers at the start of the line (split layouts are left alone).
      const dateAtStart = line.match(
        new RegExp(`^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\\s*\\d{1,2}(?:st|nd|rd|th)?,?\\s*${MONTH_RE.source}\\s*,?\\s*\\d{4}`, 'i')
      )
      const remainder = dateAtStart ? line.slice(dateAtStart[0].length).trim() : ''
      if (remainder && /[A-Za-z]/.test(remainder)) appendSubjectLine(remainder)
      i += det.consumedLines - 1
      flushAligned()
      continue
    }

    // A lone duration run ('20mins' repeated per paper) — queue durations, but never orphan one.
    if (isBareDurationLine(line)) {
      if (queue.codes.length === 0 && queue.names.length === 0) continue
      if (parseDuration(line)) queue.durations.push(parseDuration(line))
      flushAligned()
      continue
    }

    // A value line (duration + clock range, or 'arranged by the Council')?
    const hasClock = parseClockRange(line) !== null
    const council = /arranged by the council/i.test(line) || /be\s+arranged/i.test(line) || /will\s+be\s+arranged/i.test(line)
    if (hasClock || council) {
      const times = hasClock ? parseClockRange(line)! : null
      const duration = parseDuration(line)
      const { codes, rest } = stripCodesFrom(line)
      if (codes.length) queue.codes.push(...codes)
      const subjectText = cleanInlineText(rest)
      if (subjectText) appendSubjectLine(subjectText, true)
      if (duration) queue.durations.push(duration)
      // A pure '(N Set) <times>' line with nothing else pending — the Council prints
      // multi-set papers as one row each; emit the second session from the previous paper.
      if (!codes.length && !subjectText && !duration && times && queue.codes.length === 0 && queue.names.length === 0 && queue.durations.length === 0 && rows.length > 0) {
        const last = rows[rows.length - 1]
        emit(last.paperCode, last.paperName, last.durationText, times, 'Second session of the previous paper.')
        continue
      }
      if (times) queue.times.push(times)
      if (council) flushResidue()
      else flushAligned()
      continue
    }

    // 3) Pure code line(s)?
    const { codes, rest } = stripCodesFrom(line)
    if (codes.length > 0 && rest === '') {
      queue.codes.push(...codes)
      flushAligned()
      continue
    }

    // 4) Mixed line: some codes and some subject text (common in the PDFs)
    if (codes.length > 0) {
      queue.codes.push(...codes)
      if (rest) appendSubjectLine(rest, true)
      flushAligned()
      continue
    }

    // 5) Otherwise it's subject text (a wrapped line of a paper's name)
    appendSubjectLine(line)
    flushAligned()
  }

  // End of document — flush anything left, flagged for review.
  if (queue.codes.length || queue.names.length) flushResidue('Rows could not be aligned — check this paper.')

  return rows
}

function csvEscapeSplit(text: string): string[][] {
  // Minimal RFC-4180-ish splitter: handles quoted fields with commas/newlines.
  const rows: string[][] = []
  let cur = ''
  let inQuotes = false
  let row: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 1 } else inQuotes = false
      } else cur += ch
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === ',') { row.push(cur); cur = ''; continue }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(cur); cur = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      continue
    }
    cur += ch
  }
  row.push(cur)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}

const COLUMN_ALIASES: Record<string, RegExp> = {
  date: /^(exam[_ ]?date|date|day|examination ?date)$/i,
  slot: /^(slot|session|session[_ ]?slot|period)$/i,
  code: /^(paper[_ ]?code|code|subject[_ ]?code|paper)$/i,
  name: /^(paper[_ ]?name|subject|paper name|subject[_ ]?paper|title|name)$/i,
  duration: /^(duration|time[_ ]?allocated|duration[_ ]?text)$/i,
  start: /^(start|start[_ ]?time|from|begins?)$/i,
  end: /^(end|end[_ ]?time|to|finish(?:es)?)$/i,
}

function normalizeName(s: string) {
  return String(s || '').trim()
}

/** Parse a CSV/TSV-like sheet into rows using the documented column aliases. */
export function parseTable(grid: string[][]): TimetableRowInput[] {
  if (grid.length < 2) return []
  const header = grid[0].map((h) => normalizeName(h).toLowerCase())
  const colIndex: Partial<Record<string, number>> = {}
  for (const [key, re] of Object.entries(COLUMN_ALIASES)) {
    const idx = header.findIndex((h) => re.test(h))
    if (idx >= 0) colIndex[key] = idx
  }
  // Need at least date + subject name for a sane table import.
  if (colIndex.date === undefined || colIndex.name === undefined) {
    throw new Error('Could not find the required columns (date and paper name). Use the import template columns: date, slot, paper_code, paper_name, duration, start, end.')
  }
  const rows: TimetableRowInput[] = []
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]
    const get = (key: string) => (colIndex[key] !== undefined ? normalizeName(cells[colIndex[key]!] || '') : '')
    const rawDate = get('date')
    const dateMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    const alt = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/) // DD/MM/YYYY
    let examDate: string | null = null
    if (dateMatch) examDate = rawDate
    else if (alt) examDate = `${alt[3]}-${pad(parseInt(alt[2], 10))}-${pad(parseInt(alt[1], 10))}`
    const startTime = to24h(get('start'))
    const endTime = to24h(get('end'))
    const slotRaw = (get('slot') || '').toUpperCase()
    let sessionSlot: SessionSlot = slotFromStart(startTime)
    if (slotRaw.startsWith('AFTER')) sessionSlot = 'AFTERNOON'
    else if (slotRaw.startsWith('MORN')) sessionSlot = 'MORNING'
    else if (slotRaw.startsWith('FULL') || slotRaw.startsWith('ALL')) sessionSlot = 'FULL_DAY'
    const name = get('name')
    if (!examDate && !name) continue // completely empty row
    rows.push(
      makeRow(
        examDate,
        null,
        get('code') || null,
        name,
        get('duration') || null,
        startTime,
        endTime,
        /\*/.test(name),
        r
      )
    )
  }
  return rows.map((row, i) => ({ ...row, sortOrder: i }))
}

/** Parse CSV text. */
export function parseCsvText(text: string): TimetableRowInput[] {
  return parseTable(csvEscapeSplit(String(text || '')))
}
