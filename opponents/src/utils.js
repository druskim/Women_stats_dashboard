export function parseRows(text) {
  const lines = text.trim().split('\n')
  const rows = []
  let currentPeriod = 1

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(s => s.trim())
    if (cols.length < 2) continue

    const game     = cols[0] || ''
    const category = cols[1] || ''

    if (category === '@@@P1') { currentPeriod = 1; continue }
    if (category === '@@@P2') { currentPeriod = 2; continue }
    if (category === 'T-START' || category === 'T-END') continue

    const isPenalty = category.startsWith('Penalty Shot ')
    const isShot    = category.startsWith('Shot ') || isPenalty
    if (!isShot) continue

    // team = the attacking team, extracted from "Shot Korea" or "Penalty Shot Korea"
    const team = isPenalty
      ? category.slice('Penalty Shot '.length)
      : category.slice('Shot '.length)

    if (!team) continue

    const tournament        = cols[5] || ''
    const attackingPlayer   = cols[6] || ''
    const shotOriginRaw     = cols[7] || ''
    const shotOutcome       = cols[8] || ''
    const shotLocationRaw   = cols[9] || ''
    const defendingPlayer   = cols[10] || ''

    const shotOrigin   = shotOriginRaw   !== '' ? parseInt(shotOriginRaw)   : null
    const shotLocation = shotLocationRaw !== '' ? parseFloat(shotLocationRaw) : null

    rows.push({
      game,
      category,
      team,
      tournament,
      attackingPlayer,
      shotOrigin,
      shotOutcome,
      shotLocation,
      defendingPlayer,
      isPenalty,
      period: currentPeriod,
    })
  }

  return rows
}

// Returns the display name for a team-prefixed player string.
// "Korea - Player 10" → "Player 10"
export function playerDisplayName(prefixedName) {
  const idx = prefixedName.indexOf(' - ')
  return idx !== -1 ? prefixedName.slice(idx + 3) : prefixedName
}

export function getUniqueTeams(rows) {
  return [...new Set(rows.map(r => r.team).filter(t => t && t !== 'Canada'))].sort()
}

// Returns unique attacking players for a given team, sorted by shot count descending.
export function getTeamPlayers(rows, team) {
  const counts = {}
  for (const row of rows) {
    if (row.team !== team || !row.attackingPlayer) continue
    counts[row.attackingPlayer] = (counts[row.attackingPlayer] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
}

export function computeStats(shots) {
  const total      = shots.length
  const goals      = shots.filter(s => s.shotOutcome === 'Goal').length
  const bcSaves    = shots.filter(s => s.shotOutcome === 'Ball Control Save').length
  const saves      = shots.filter(s => s.shotOutcome === 'Save').length
  const out        = shots.filter(s => s.shotOutcome === 'Out').length
  const goalRate   = total > 0 ? ((goals / total) * 100).toFixed(1) : '0.0'
  const outRate    = total > 0 ? ((out   / total) * 100).toFixed(1) : '0.0'
  const stopRate   = total > 0 ? (((saves + bcSaves + out) / total) * 100).toFixed(1) : '0.0'
  const saveRate   = total > 0 ? (((total - goals) / total) * 100).toFixed(1) : '0.0'
  return { total, goals, saves, bcSaves, out, goalRate, outRate, stopRate, saveRate }
}

export function getOutcomeColor(outcome) {
  if (outcome === 'Goal')               return '#22c55e'
  if (outcome === 'Ball Control Save')  return '#3b82f6'
  if (outcome === 'Save')               return '#60a5fa'
  if (outcome === 'Out')                return '#6b7280'
  if (outcome === 'High Ball' || outcome === 'Long Ball') return '#f59e0b'
  return '#6b7280'
}

// Preferred origin (most common) for a set of shots
export function preferredOrigin(shots) {
  const counts = {}
  for (const s of shots) {
    if (s.shotOrigin) counts[s.shotOrigin] = (counts[s.shotOrigin] || 0) + 1
  }
  const entries = Object.entries(counts)
  if (!entries.length) return null
  return parseInt(entries.sort((a, b) => b[1] - a[1])[0][0])
}

const STAGE_ORDER = { PL: 1, QF: 2, SF: 3, BMG: 4, GMG: 5 }

const STAGE_LABELS = { QF: 'QF', SF: 'SF', BMG: 'Bronze', GMG: 'Final' }

function tournamentSortKey(t) {
  if (!t) return 0
  for (const word of t.split(' ')) {
    const u = word.toUpperCase()
    if (u in STAGE_ORDER) return STAGE_ORDER[u]
    if (/^G\d+$/i.test(word)) return 0
  }
  return 0
}

export function getUniqueValues(rows, field) {
  return [...new Set(rows.map(r => r[field]).filter(Boolean))]
    .sort((a, b) => tournamentSortKey(a) - tournamentSortKey(b) || a.localeCompare(b))
}

// Extracts just the event name from a tournament string, stripping stage codes and year.
// "Malmo QF 2026" → "Malmo",  "Scrimmage G1 2026" → "Scrimmage"
export function getTournamentName(t) {
  if (!t) return ''
  const words = t.split(' ')
  const nameWords = []
  for (const word of words) {
    if (/^(G\d+|QF|SF|BMG|GMG|PL|\d{4})$/i.test(word)) break
    nameWords.push(word)
  }
  return nameWords.join(' ') || t
}

// Returns display label for knockout stage (QF/SF/BMG/GMG), or null for regular games.
export function getStageLabel(t) {
  if (!t) return null
  for (const word of t.split(' ')) {
    const u = word.toUpperCase()
    if (u in STAGE_LABELS) return STAGE_LABELS[u]
  }
  return null
}

// Unique normalized tournament names (e.g. "Malmo", "Worlds").
export function getUniqueTournamentNames(rows) {
  return [...new Set(rows.map(r => getTournamentName(r.tournament)).filter(Boolean))].sort()
}

// Returns { value, label } game options for MultiSelect, filtered to games involving team.
// value is "game|tournament" composite key; label appends stage for knockout rounds.
export function getGameOptionsForTeam(rows, team) {
  const seen = new Set()
  const opts = []
  for (const row of rows) {
    if (team) {
      const participants = row.game.split(' vs ').map(s => s.trim())
      if (!participants.includes(team)) continue
    }
    const key = `${row.game}|${row.tournament}`
    if (!seen.has(key)) {
      seen.add(key)
      const stage = getStageLabel(row.tournament)
      opts.push({
        value: key,
        label: stage ? `${row.game} (${stage})` : row.game,
        sortKey: tournamentSortKey(row.tournament),
        gameName: row.game,
      })
    }
  }
  return opts.sort((a, b) => a.sortKey - b.sortKey || a.gameName.localeCompare(b.gameName))
}

export function groupByField(rows, field) {
  const map = {}
  for (const row of rows) {
    const key = row[field] || 'Unknown'
    if (!map[key]) map[key] = []
    map[key].push(row)
  }
  return map
}
