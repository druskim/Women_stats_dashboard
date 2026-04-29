import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const gamesDir = join(__dirname, '../public/games')
const outputPath = join(__dirname, '../public/data.tsv')

const HEADER = 'Opponent/Game\tCategory\tStart\tClick\tEnd\tXY\tAttacking Player\tShot Origin\tShot Outcome\tShot Location\tDefending Player'

// Find the header row by looking for the "Opponent/Game" column
function findHeaderRowIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (row && row.length > 0 && String(row[0] ?? '').toLowerCase().includes('opponent')) {
      return i
    }
  }
  return 0
}

if (!existsSync(gamesDir)) {
  mkdirSync(gamesDir, { recursive: true })
  writeFileSync(outputPath, HEADER + '\n')
  console.log('No games folder — wrote empty data.tsv')
  process.exit(0)
}

const files = readdirSync(gamesDir)
  .filter(f => f.match(/\.(xlsx|xls)$/i))
  .sort()

if (files.length === 0) {
  writeFileSync(outputPath, HEADER + '\n')
  console.log('No game files found — wrote empty data.tsv')
  process.exit(0)
}

const allLines = [HEADER]

for (const file of files) {
  console.log(`Processing ${file}...`)
  try {
    const workbook = XLSX.readFile(join(gamesDir, file))
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    const headerIdx = findHeaderRowIndex(rows)
    const dataRows = rows.slice(headerIdx + 1)

    let count = 0
    for (const row of dataRows) {
      if (!row || row.length < 2) continue
      const line = row.slice(0, 11).map(v => (v === null || v === undefined) ? '' : String(v).trim()).join('\t')
      if (line.replace(/\t/g, '').trim() === '') continue
      allLines.push(line)
      count++
    }
    console.log(`  → ${count} rows`)
  } catch (err) {
    console.error(`  Error reading ${file}: ${err.message}`)
  }
}

writeFileSync(outputPath, allLines.join('\n') + '\n')
console.log(`\nDone — ${allLines.length - 1} total rows from ${files.length} file(s)`)
