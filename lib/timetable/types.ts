/** Shared types for the examination timetable feature. */

export type SessionSlot = 'MORNING' | 'AFTERNOON' | 'FULL_DAY'

export interface TimetableRowInput {
  examDate: string | null // YYYY-MM-DD
  sessionSlot: SessionSlot
  paperCode: string | null
  paperName: string
  durationText: string | null
  startTime: string | null // 24h HH:MM, null while the Council has not arranged the time
  endTime: string | null // 24h HH:MM
  needsCouncilTime: boolean
  isNewCurriculum: boolean // official PDFs mark new-curriculum papers with '*'
  sortOrder: number
  warnings: string[]
}

export interface TimetableImportResult {
  fileName: string
  sourceFormat: 'PDF' | 'DOCX' | 'CSV' | 'XLSX'
  rows: TimetableRowInput[]
  stats: {
    total: number
    dated: number
    undated: number
    needsTime: number
    withWarnings: number
  }
}
