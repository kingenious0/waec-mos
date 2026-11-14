import { describe, expect, it } from 'vitest'
import {
  parseCsvText,
  parseRawText,
  parseDuration,
  parseClockRange,
  to24h,
} from '@/lib/timetable/parse'

describe('to24h', () => {
  it('parses 12-hour times', () => {
    expect(to24h('9.00 a.m.')).toBe('09:00')
    expect(to24h('1.00 p.m.')).toBe('13:00')
    expect(to24h('12.00 p.m.')).toBe('12:00')
    expect(to24h('12.30 a.m.')).toBe('00:30')
  })
  it('parses 24-hour times written with hrs.', () => {
    expect(to24h('08:30 hrs.')).toBe('08:30')
    expect(to24h('13:00 hrs.')).toBe('13:00')
    expect(to24h('16:20 hrs.')).toBe('16:20')
  })
  it('returns null for junk', () => {
    expect(to24h('abc')).toBeNull()
    expect(to24h('25:00')).toBeNull()
  })
})

describe('parseClockRange', () => {
  it('extracts start and end times from a line', () => {
    expect(parseClockRange('1hr 08:30 hrs. – 09:30 hrs.')).toEqual({ startTime: '08:30', endTime: '09:30' })
    expect(parseClockRange('2hrs 30mins 08:30 hrs. – 11:00 hrs.')).toEqual({ startTime: '08:30', endTime: '11:00' })
    expect(parseClockRange('1 hour 10 minutes 9.00 a.m. – 10.10 a.m.')).toEqual({ startTime: '09:00', endTime: '10:10' })
  })
  it('returns null when there is no clock range', () => {
    expect(parseClockRange('Basketry 3 (Project Work)*')).toBeNull()
  })
})

describe('parseDuration', () => {
  it('extracts hour and minute phrases', () => {
    expect(parseDuration('2hrs 08:30 hrs. – 10:30 hrs.')).toBe('2 hrs')
    expect(parseDuration('2hrs 30mins 08:30 hrs. – 11:00 hrs.')).toBe('2 hrs 30 mins')
    expect(parseDuration('1 hour 10 minutes 9.00 a.m. – 10.10 a.m.')).toBe('1 hr 10 mins')
    expect(parseDuration('50mins 10.10 a.m. – 11.00 a.m.')).toBe('50 mins')
  })
  it('does not mistake a clock time for a duration', () => {
    expect(parseDuration('08:30 hrs. – 10:30 hrs.')).toBeNull()
    expect(parseDuration('13:00 hrs. – 14:40 hrs.')).toBeNull()
  })
})

describe('parseRawText — BECE 2026 (exact official layout)', () => {
  const BECE = [
    'THE WEST AFRICAN EXAMINATIONS COUNCIL, ACCRA',
    'BASIC EDUCATION CERTIFICATE EXAMINATION FOR',
    'SCHOOL AND PRIVATE CANDIDATES, 2026',
    '',
    'Monday,',
    '4th May, 2026',
    '001/2 English Language 2',
    '(Essay) 1 hour 10 minutes 9.00 a.m. – 10.10 a.m.',
    '001/1 English Language 1',
    '(Objective) 50 minutes 10.10 a.m. – 11.00 a.m.',
    '022/2 Religious and Moral Education 2',
    '(Essay) 1 hour 1.00 p.m. - 2.00 p.m.',
    '022/1 Religious and Moral Education 1',
    '(Objective) 45 minutes 2.00 p.m. – 2.45 p.m.',
    '',
    'Tuesday,',
    '5th May, 2026',
    '020/2 Social Studies 2',
    '(Essay) 1 hour 9.00 a.m. - 10.00 a.m.',
    '020/1 Social Studies 1',
    '(Objective) 45 minutes 10.00 a.m. – 10.45 a.m.',
    '',
    'NOTES',
    '1. Both papers for each Subject are to be taken at one sitting without break.',
  ].join('\n')

  const rows = parseRawText(BECE)

  it('parses every paper with its date, code, name, times', () => {
    expect(rows).toHaveLength(6)
    expect(rows[0]).toMatchObject({
      examDate: '2026-05-04',
      sessionSlot: 'MORNING',
      paperCode: '001/2',
      startTime: '09:00',
      endTime: '10:10',
      needsCouncilTime: false,
    })
    expect(rows[0].paperName).toContain('English Language 2')
    expect(rows[0].paperName).toContain('(Essay)')
    expect(rows[1]).toMatchObject({ paperCode: '001/1', examDate: '2026-05-04', startTime: '10:10', endTime: '11:00' })
    expect(rows[2]).toMatchObject({ paperCode: '022/2', examDate: '2026-05-04', startTime: '13:00', endTime: '14:00', sessionSlot: 'AFTERNOON' })
    expect(rows[3]).toMatchObject({ paperCode: '022/1', startTime: '14:00', endTime: '14:45' })
    expect(rows[4]).toMatchObject({ paperCode: '020/2', examDate: '2026-05-05', startTime: '09:00', endTime: '10:00' })
    expect(rows[5]).toMatchObject({ paperCode: '020/1', examDate: '2026-05-05', startTime: '10:00', endTime: '10:45' })
  })

  it('stops at the NOTES section', () => {
    expect(rows.find((r) => /sitting/.test(r.paperName))).toBeUndefined()
  })
})

describe('parseRawText — Council-arranged papers (no fixed time)', () => {
  const text = [
    'Monday, 7th',
    'April, 2026 to',
    'Saturday, 26th',
    'April, 2026',
    'SC7073',
    'SC7083',
    'Basketry 3 (Project Work)*',
    'Ceramics 3 (Project Work)*',
    '6 hours a day',
    'Date and time for each paper will be arranged by the Council.',
  ].join('\n')
  const rows = parseRawText(text)
  it('returns the papers without dates and flagged for Council time', () => {
    expect(rows.length).toBe(2)
    expect(rows.every((r) => r.examDate === null || r.examDate === '')).toBe(true)
    expect(rows.every((r) => r.needsCouncilTime)).toBe(true)
  })
})

describe('parseCsvText', () => {
  it('parses the documented template columns', () => {
    const csv = [
      'date,session,paper_code,paper_name,duration,start,end',
      '2026-05-04,MORNING,001/2,English Language 2 (Essay),1 hour 10 minutes,09:00,10:10',
      '2026-05-04,AFTERNOON,022/2,Religious and Moral Education 2 (Essay),1 hour,13:00,14:00',
    ].join('\n')
    const rows = parseCsvText(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ examDate: '2026-05-04', sessionSlot: 'MORNING', paperCode: '001/2', startTime: '09:00', endTime: '10:10' })
    expect(rows[1]).toMatchObject({ examDate: '2026-05-04', sessionSlot: 'AFTERNOON', paperCode: '022/2', startTime: '13:00', endTime: '14:00' })
  })
  it('accepts DD/MM/YYYY dates', () => {
    const csv = ['date,session,paper_code,paper_name,start,end', '04/05/2026,MORNING,001/2,English,09:00,10:10'].join('\n')
    expect(parseCsvText(csv)[0].examDate).toBe('2026-05-04')
  })
  it('throws a clear error when required columns are missing', () => {
    expect(() => parseCsvText('foo,bar\n1,2')).toThrow(/columns/i)
  })
})
