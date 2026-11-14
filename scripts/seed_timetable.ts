/**
 * Seeds the three official 2026 timetables into the database through the SAME
 * parse + validate + atomic-replace path the admin UI uses — no separate logic.
 *
 *   npx tsx scripts/seed_timetable.ts           # dry run: parse + write preview JSON, nothing written
 *   npx tsx scripts/seed_timetable.ts --commit  # validate + replace the three series' timetable rows
 *
 * Rows with no fixed examination date in the official files (project work and orals
 * "arranged by the Council" over multi-day windows) are reported and skipped on
 * commit — they cannot be dated honestly from the source. HQ completes them from
 * the Timetable screen once the Council announces the actual dates.
 */
import fs from 'fs'
import path from 'path'

// Load .env BEFORE importing app modules.
for (const line of fs.readFileSync('.env', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const COMMIT = process.argv.includes('--commit')

const FILES = [
  { file: 'timetable-sources/WASSCE-SC-2026-GHANA.pdf', operationId: 'op-wassce-2026', label: 'WASSCE SC 2026 (Ghana only)' },
  { file: 'timetable-sources/BECE-2026-FINAL-TIMETABLE.pdf', operationId: 'op-bece-2026', label: '2026 BECE SC & PC' },
  { file: 'timetable-sources/WASSCE-PC2-2026-GHANA.pdf', operationId: 'op-wassce-pc2-2026', label: '2026 WASSCE PC (Second Series)' },
]

async function main() {
  const { parseTimetableFile } = await import('../lib/timetable/import')
  const { replaceTimetable, validateRows, TimetableValidationError } = await import('../lib/timetable/commit')

  for (const target of FILES) {
    const abs = path.resolve(process.cwd(), target.file)
    if (!fs.existsSync(abs)) {
      console.error(`MISSING FILE: ${target.file}`)
      process.exitCode = 1
      continue
    }
    const buffer = fs.readFileSync(abs)
    const result = await parseTimetableFile(path.basename(abs), buffer)
    const undated = result.rows.filter((r) => !r.examDate)
    const dated = result.rows.filter((r) => r.examDate)

    const previewPath = abs.replace(/\.pdf$/i, '.preview.json')
    fs.writeFileSync(previewPath, JSON.stringify(result, null, 2))

    console.log('='.repeat(72))
    console.log(`${target.label}  ←  ${target.file}`)
    console.log(`parsed ${result.rows.length} rows → preview written to ${path.relative(process.cwd(), previewPath)}`)
    console.log(`  dated rows: ${dated.length}   needs-council-time rows: ${result.stats.needsTime}   undated (skipped): ${undated.length}`)
    if (undated.length) {
      for (const r of undated.slice(0, 12)) {
        console.log(`   · skipped: [${r.paperCode || '—'}] ${r.paperName} (${r.durationText || 'no duration'}) — ${r.warnings[0] || ''}`)
      }
      if (undated.length > 12) console.log(`   · …and ${undated.length - 12} more undated rows`)
    }
    const needsTime = dated.filter((r) => r.needsCouncilTime)
    if (needsTime.length) {
      console.log(`  dated but time pending: ${needsTime.length} (e.g. ${needsTime.slice(0, 3).map((r) => r.paperCode || r.paperName).join(', ')})`)
    }

    if (COMMIT) {
      try {
        const clean = validateRows(dated)
        const out = await replaceTimetable({
          operationId: target.operationId,
          fileName: path.basename(abs),
          sourceFormat: result.sourceFormat,
          actorId: 'seed-script',
          actorName: 'Seed script (official WAEC files)',
          rows: clean,
        })
        console.log(`  COMMITTED: removed ${out.removed}, imported ${out.imported}, importId ${out.importId}`)
      } catch (err) {
        if (err instanceof TimetableValidationError) {
          console.error(`  VALIDATION FAILED — nothing written:\n   - ${err.problems.join('\n   - ')}`)
          process.exitCode = 1
        } else {
          throw err
        }
      }
    }
  }
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
