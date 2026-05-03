import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  parseRows, computeStats, getUniqueTeams, getTeamPlayers,
  getUniqueValues, preferredOrigin, playerDisplayName,
} from './utils.js'
import CourtMap from './components/CourtMap.jsx'
import GoalFaceMap from './components/GoalFaceMap.jsx'
import ShotFlowMap from './components/ShotFlowMap.jsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

export default function App() {
  const [rawRows, setRawRows]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [viewMode, setViewMode]         = useState('team')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [filters, setFilters]           = useState({ tournament: [], game: [] })
  const [activeOrigin, setActiveOrigin] = useState('All')
  const [activeLocation, setActiveLocation] = useState('All')

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data.tsv')
      .then(r => r.text())
      .then(text => { setRawRows(parseRows(text)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const allTeams       = useMemo(() => getUniqueTeams(rawRows), [rawRows])
  const allTournaments = useMemo(() => getUniqueValues(rawRows, 'tournament'), [rawRows])
  const allGames       = useMemo(() => getUniqueValues(rawRows, 'game'), [rawRows])

  // Rows for the selected team, with secondary filters applied
  const teamRows = useMemo(() => {
    if (!selectedTeam) return []
    return rawRows.filter(row => {
      if (row.team !== selectedTeam) return false
      if (filters.tournament.length > 0 && !filters.tournament.includes(row.tournament)) return false
      if (filters.game.length > 0 && !filters.game.includes(row.game)) return false
      return true
    })
  }, [rawRows, selectedTeam, filters])

  // Apply origin/location drill-down filters
  const filteredRows = useMemo(() => teamRows.filter(row => {
    if (activeOrigin   !== 'All' && row.shotOrigin   !== activeOrigin)   return false
    if (activeLocation !== 'All' && row.shotLocation !== activeLocation) return false
    return true
  }), [teamRows, activeOrigin, activeLocation])

  const shots     = useMemo(() => filteredRows.filter(r => !r.isPenalty), [filteredRows])
  const penalties = useMemo(() => filteredRows.filter(r =>  r.isPenalty), [filteredRows])

  const players = useMemo(() => getTeamPlayers(teamRows, selectedTeam), [teamRows, selectedTeam])

  // Reset dependent state on team change
  useEffect(() => { setSelectedPlayer(''); setActiveOrigin('All'); setActiveLocation('All') }, [selectedTeam])

  const playerShots = useMemo(() =>
    selectedPlayer ? shots.filter(r => r.attackingPlayer === selectedPlayer) : [],
    [shots, selectedPlayer]
  )

  const teamStats   = useMemo(() => computeStats(shots), [shots])
  const playerStats = useMemo(() => computeStats(playerShots), [playerShots])

  // Shots fired against the selected team (they are defending)
  const defRows = useMemo(() => {
    if (!selectedTeam) return []
    return rawRows.filter(r => {
      if (r.team === selectedTeam) return false
      if (r.isPenalty) return false
      if (filters.tournament.length > 0 && !filters.tournament.includes(r.tournament)) return false
      if (filters.game.length > 0 && !filters.game.includes(r.game)) return false
      return r.game.split(' vs ').includes(selectedTeam)
    })
  }, [rawRows, selectedTeam, filters])
  const defStats = useMemo(() => computeStats(defRows), [defRows])

  const hasSecondaryFilters =
    filters.tournament.length > 0 || filters.game.length > 0 ||
    activeOrigin !== 'All' || activeLocation !== 'All'

  function clearFilters() {
    setFilters({ tournament: [], game: [] })
    setActiveOrigin('All')
    setActiveLocation('All')
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p>Loading scouting data…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logo">
          <div className="maple-leaf">🎯</div>
          <div>
            <h1>Opponents Scouting Dashboard</h1>
            <p>Shooting Trends &amp; Player Analysis</p>
          </div>
        </div>
        <div className="header-meta">
          {selectedTeam && shots.length > 0 && (
            <span className="badge-info">{shots.length} shots tracked for {selectedTeam}</span>
          )}
        </div>
      </header>

      {/* Filter Bar */}
      <div className="filter-container">
        <div className="filter-bar">
          <div className="filter-group">
            <span className="filter-label">Country</span>
            <select
              className="ms-btn"
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="">Select a team…</option>
              {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <MultiSelect
            label="Tournament"
            options={allTournaments}
            value={filters.tournament}
            onChange={v => setFilters(f => ({ ...f, tournament: v }))}
          />

          <MultiSelect
            label="Game"
            options={allGames}
            value={filters.game}
            onChange={v => setFilters(f => ({ ...f, game: v }))}
          />
        </div>

        {hasSecondaryFilters && (
          <button className="clear-filters" onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      {!selectedTeam ? (
        <EmptyState teams={allTeams} />
      ) : (
        <>
          {/* View toggle */}
          <div className="tab-nav">
            <button
              className={`tab-btn ${viewMode === 'team' ? 'active' : ''}`}
              onClick={() => setViewMode('team')}
            >
              Team View
            </button>
            <button
              className={`tab-btn ${viewMode === 'defense' ? 'active' : ''}`}
              onClick={() => setViewMode('defense')}
            >
              Defense
            </button>
            <button
              className={`tab-btn ${viewMode === 'player' ? 'active' : ''}`}
              onClick={() => setViewMode('player')}
            >
              Player View
            </button>
          </div>

          {viewMode === 'defense' ? (
            defRows.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
                No defensive data found for <strong style={{ color: '#f1f5f9' }}>{selectedTeam}</strong> with the current filters.
              </div>
            ) : (
              <DefenseView shots={defRows} stats={defStats} teamName={selectedTeam} />
            )
          ) : shots.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
              No shot data found for <strong style={{ color: '#f1f5f9' }}>{selectedTeam}</strong> with the current filters.
            </div>
          ) : viewMode === 'team' ? (
            <TeamView
              shots={shots}
              penalties={penalties}
              stats={teamStats}
              teamName={selectedTeam}
              players={players}
              teamRows={teamRows}
              activeOrigin={activeOrigin}
              onPositionClick={pos => setActiveOrigin(o => o === pos ? 'All' : pos)}
              activeLocation={activeLocation}
              onLocationClick={loc => setActiveLocation(l => l === loc ? 'All' : loc)}
              selectedPlayer={selectedPlayer}
              onSelectPlayer={p => { setSelectedPlayer(p); setActiveOrigin('All'); setActiveLocation('All') }}
            />
          ) : (
            <PlayerView
              shots={shots}
              teamName={selectedTeam}
              players={players}
              selectedPlayer={selectedPlayer}
              onSelectPlayer={p => { setSelectedPlayer(p); setActiveOrigin('All'); setActiveLocation('All') }}
              playerShots={playerShots}
              playerStats={playerStats}
              activeOrigin={activeOrigin}
              onPositionClick={pos => setActiveOrigin(o => o === pos ? 'All' : pos)}
              activeLocation={activeLocation}
              onLocationClick={loc => setActiveLocation(l => l === loc ? 'All' : loc)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Team View ─────────────────────────────────────────────────────────────────

function TeamView({ shots, penalties, stats, teamName, players, teamRows, activeOrigin, onPositionClick, activeLocation, onLocationClick, selectedPlayer, onSelectPlayer }) {
  const mapShots    = useMemo(() =>
    selectedPlayer ? shots.filter(r => r.attackingPlayer === selectedPlayer) : shots,
    [shots, selectedPlayer]
  )
  const displayStats = useMemo(() => selectedPlayer ? computeStats(mapShots) : stats, [mapShots, selectedPlayer, stats])
  const prefOrigin   = useMemo(() => selectedPlayer ? preferredOrigin(mapShots) : null, [mapShots, selectedPlayer])

  const mapTitle = label => selectedPlayer
    ? `${playerDisplayName(selectedPlayer)} — ${label}`
    : `${teamName} — ${label}`

  const [goalsOnly, setGoalsOnly] = useState(false)
  const goalShots = useMemo(() => mapShots.filter(r => r.shotOutcome === 'Goal'), [mapShots])
  const courtShots = goalsOnly ? goalShots : mapShots

  return (
    <div>
      <StatGrid cards={selectedPlayer ? [
        { label: 'Shots',               value: displayStats.total,             color: '#3b82f6', sub: playerDisplayName(selectedPlayer) },
        { label: 'Goals',               value: displayStats.goals,             color: '#22c55e', sub: `${displayStats.goalRate}% conversion` },
        { label: 'Off. Efficiency',     value: `${displayStats.goalRate}%`,    color: '#22c55e', sub: `${displayStats.goals} of ${displayStats.total}` },
        { label: 'Pref. Origin',        value: prefOrigin ?? '—',              color: '#f59e0b', sub: 'most used position' },
      ] : [
        { label: 'Total Shots',         value: stats.total,          color: '#3b82f6', sub: 'regular play' },
        { label: 'Goals',               value: stats.goals,          color: '#22c55e', sub: `${stats.goalRate}% conversion` },
        { label: 'Off. Efficiency',     value: `${stats.goalRate}%`, color: '#22c55e', sub: `${stats.goals} of ${stats.total}` },
        { label: 'Def. Efficiency',     value: `${stats.saveRate}%`, color: '#3b82f6', sub: `Canada save rate` },
      ]} />

      <ShotFlowMap shots={courtShots} title={mapTitle(goalsOnly ? 'Shot Flow — Goals Only' : 'Shot Flow — Origin to Landing')} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          className={`ms-btn${goalsOnly ? ' ms-btn--active' : ''}`}
          onClick={() => setGoalsOnly(v => !v)}
        >
          {goalsOnly ? 'Goals only' : 'All shots'}
        </button>
      </div>

      <div className="grid-2">
        <CourtMap
          shots={courtShots}
          title={mapTitle(goalsOnly ? 'Goal Origin Map' : 'Shot Origin Map')}
          teamName={teamName}
          activeOrigin={activeOrigin}
          onPositionClick={onPositionClick}
        />
        <GoalFaceMap
          shots={courtShots}
          title={mapTitle(goalsOnly ? 'Goal Location Map' : 'Shot Location Map')}
          activeLocation={activeLocation}
          onLocationClick={onLocationClick}
        />
      </div>

      <TrendChart shots={teamRows.filter(r => !r.isPenalty)} teamName={teamName} />

      <PlayerSummaryTable
        players={players}
        shots={shots}
        teamName={teamName}
        selectedPlayer={selectedPlayer}
        onSelectPlayer={onSelectPlayer}
      />

      {penalties.length > 0 && (
        <PenaltySection penalties={penalties} teamName={teamName} />
      )}
    </div>
  )
}

// ── Player View ───────────────────────────────────────────────────────────────

function PlayerView({ shots, teamName, players, selectedPlayer, onSelectPlayer, playerShots, playerStats, activeOrigin, onPositionClick, activeLocation, onLocationClick }) {
  const prefOrigin = useMemo(() => preferredOrigin(playerShots), [playerShots])

  return (
    <div>
      {/* Player selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="filter-group">
            <span className="filter-label">Player</span>
            <select
              className="ms-btn"
              value={selectedPlayer}
              onChange={e => onSelectPlayer(e.target.value)}
              style={{ minWidth: 200 }}
            >
              <option value="">Select a player…</option>
              {players.map(p => (
                <option key={p} value={p}>{playerDisplayName(p)}</option>
              ))}
            </select>
          </div>
          {selectedPlayer && (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>
              {playerDisplayName(selectedPlayer)} · {teamName}
            </div>
          )}
        </div>
      </div>

      {!selectedPlayer ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '48px 24px' }}>
          Select a player above to see their shooting profile.
        </div>
      ) : playerShots.length === 0 ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '48px 24px' }}>
          No shot data found for {playerDisplayName(selectedPlayer)} with current filters.
        </div>
      ) : (
        <>
          <StatGrid cards={[
            { label: 'Shots',          value: playerStats.total,             color: '#3b82f6', sub: `${teamName}` },
            { label: 'Goals',          value: playerStats.goals,             color: '#22c55e', sub: `${playerStats.goalRate}% rate` },
            { label: 'Goal Rate',      value: `${playerStats.goalRate}%`,    color: '#22c55e', sub: `${playerStats.goals} goals` },
            { label: 'Preferred Pos',  value: prefOrigin ?? '—',             color: '#f59e0b', sub: 'most used origin' },
          ]} />

          <div className="grid-2">
            <CourtMap
              shots={playerShots}
              title={`${playerDisplayName(selectedPlayer)} — Shot Origins`}
              teamName={teamName}
              activeOrigin={activeOrigin}
              onPositionClick={onPositionClick}
            />
            <GoalFaceMap
              shots={playerShots}
              title={`${playerDisplayName(selectedPlayer)} — Shot Locations`}
              activeLocation={activeLocation}
              onLocationClick={onLocationClick}
            />
          </div>

          <PlayerGameTable player={selectedPlayer} shots={shots} />
        </>
      )}
    </div>
  )
}

// ── Defense View ──────────────────────────────────────────────────────────────

function DefenseView({ shots, stats, teamName }) {
  const [goalsOnly, setGoalsOnly] = useState(false)
  const goalShots    = useMemo(() => shots.filter(r => r.shotOutcome === 'Goal'), [shots])
  const displayShots = goalsOnly ? goalShots : shots

  return (
    <div>
      <StatGrid cards={[
        { label: 'Shots Against', value: stats.total,          color: '#3b82f6', sub: 'regular play' },
        { label: 'Goals Against', value: stats.goals,          color: '#ef4444', sub: `${stats.goalRate}% conversion rate` },
        { label: 'Stop Rate',     value: `${stats.saveRate}%`, color: '#22c55e', sub: `${stats.total - stats.goals} shots stopped` },
      ]} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          className={`ms-btn${goalsOnly ? ' ms-btn--active' : ''}`}
          onClick={() => setGoalsOnly(v => !v)}
        >
          {goalsOnly ? 'Goals only' : 'All shots'}
        </button>
      </div>

      <ShotFlowMap
        shots={displayShots}
        title={`${teamName} — ${goalsOnly ? 'Goals Against Flow' : 'Shots Against Flow'}`}
      />

      <div className="grid-2">
        <CourtMap
          shots={displayShots}
          title={`${teamName} — ${goalsOnly ? 'Goal' : 'Shot'} Origin Against`}
          teamName={teamName}
          activeOrigin="All"
          onPositionClick={null}
        />
        <GoalFaceMap
          shots={displayShots}
          title={`${teamName} — ${goalsOnly ? 'Goal' : 'Shot'} Location Against`}
          activeLocation="All"
          onLocationClick={null}
        />
      </div>

      <TrendChart shots={shots} teamName={teamName} />
    </div>
  )
}

// ── Trend Chart ───────────────────────────────────────────────────────────────

function TrendChart({ shots, teamName }) {
  const data = useMemo(() => {
    const byGame = {}
    for (const shot of shots) {
      const key = shot.tournament || shot.game || 'Unknown'
      if (!byGame[key]) byGame[key] = { game: key, shots: 0, goals: 0 }
      byGame[key].shots++
      if (shot.shotOutcome === 'Goal') byGame[key].goals++
    }
    return Object.values(byGame).sort((a, b) => a.game.localeCompare(b.game))
  }, [shots])

  if (data.length < 2) return null

  return (
    <div className="card">
      <h3 className="card-title">{teamName} — Shots &amp; Goals by Game</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="game"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            labelStyle={{ color: '#f1f5f9' }}
            itemStyle={{ color: '#94a3b8' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="shots" name="Shots" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="goals" name="Goals" fill="#22c55e" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Player Summary Table (Team View) ─────────────────────────────────────────

function PlayerSummaryTable({ players, shots, teamName, selectedPlayer, onSelectPlayer }) {
  const rows = useMemo(() => players.map(player => {
    const ps      = shots.filter(s => s.attackingPlayer === player)
    const stats   = computeStats(ps)
    const origin  = preferredOrigin(ps)
    return { player, stats, origin }
  }).filter(r => r.stats.total > 0), [players, shots])

  if (rows.length === 0) return null

  return (
    <div className="card">
      <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {teamName} — Player Breakdown
        {selectedPlayer && (
          <span style={{ fontSize: 12, fontWeight: 400, color: '#f59e0b' }}>
            filtering: {playerDisplayName(selectedPlayer)}
            <button
              onClick={() => onSelectPlayer('')}
              style={{ marginLeft: 6, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
              title="Clear player filter"
            >×</button>
          </span>
        )}
      </h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Shots</th>
              <th>Goals</th>
              <th>Off. Eff.</th>
              <th>Def. Eff.</th>
              <th>Saves vs</th>
              <th>BC Saves vs</th>
              <th>Out</th>
              <th>Pref. Origin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, stats, origin }) => {
              const isActive = player === selectedPlayer
              return (
                <tr
                  key={player}
                  onClick={() => onSelectPlayer(isActive ? '' : player)}
                  style={{
                    cursor: 'pointer',
                    background: isActive ? 'rgba(245,158,11,0.1)' : undefined,
                    outline: isActive ? '1px solid rgba(245,158,11,0.4)' : undefined,
                  }}
                >
                  <td className="player-name" style={{ color: isActive ? '#f59e0b' : undefined }}>
                    {playerDisplayName(player)}
                  </td>
                  <td>{stats.total}</td>
                  <td style={{ color: '#22c55e' }}>{stats.goals}</td>
                  <td style={{ color: stats.goals > 0 ? '#22c55e' : '#9ca3af' }}>{stats.goalRate}%</td>
                  <td style={{ color: '#3b82f6' }}>{stats.saveRate}%</td>
                  <td style={{ color: '#60a5fa' }}>{stats.saves}</td>
                  <td style={{ color: '#3b82f6' }}>{stats.bcSaves}</td>
                  <td className="cell-muted">{stats.out}</td>
                  <td style={{ color: origin ? '#f59e0b' : '#374151', fontWeight: origin ? 600 : 400 }}>
                    {origin ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Player Game Table (Player View) ──────────────────────────────────────────

function PlayerGameTable({ player, shots }) {
  const rows = useMemo(() => {
    const byGame = {}
    const ps = shots.filter(s => s.attackingPlayer === player)
    for (const shot of ps) {
      const key = shot.tournament || shot.game || 'Unknown'
      if (!byGame[key]) byGame[key] = { game: shot.game, tournament: shot.tournament || key, shots: [] }
      byGame[key].shots.push(shot)
    }
    return Object.values(byGame)
      .sort((a, b) => a.tournament.localeCompare(b.tournament))
      .map(g => ({ ...g, stats: computeStats(g.shots) }))
  }, [player, shots])

  if (rows.length === 0) return null

  return (
    <div className="card">
      <h3 className="card-title">{playerDisplayName(player)} — Game History</h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Game</th>
              <th>Tournament</th>
              <th>Shots</th>
              <th>Goals</th>
              <th>Goal %</th>
              <th>Saves vs</th>
              <th>BC Saves vs</th>
              <th>Out</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="cell-muted">{r.game}</td>
                <td className="cell-muted">{r.tournament}</td>
                <td>{r.stats.total}</td>
                <td style={{ color: '#22c55e' }}>{r.stats.goals}</td>
                <td style={{ color: r.stats.goals > 0 ? '#22c55e' : '#9ca3af' }}>{r.stats.goalRate}%</td>
                <td style={{ color: '#60a5fa' }}>{r.stats.saves}</td>
                <td style={{ color: '#3b82f6' }}>{r.stats.bcSaves}</td>
                <td className="cell-muted">{r.stats.out}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Penalty Section ───────────────────────────────────────────────────────────

function PenaltySection({ penalties, teamName }) {
  const stats = computeStats(penalties)
  return (
    <div className="card">
      <h3 className="card-title">{teamName} — Penalty Shots</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <StatItem label="Penalty Shots" value={stats.total} />
        <StatItem label="Goals" value={stats.goals} color="#22c55e" />
        <StatItem label="Goal Rate" value={`${stats.goalRate}%`} color="#22c55e" />
        <StatItem label="Stopped" value={stats.saves + stats.bcSaves} color="#3b82f6" />
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th><th>Attacker</th><th>Defender</th>
              <th>Origin</th><th>Location</th><th>Outcome</th><th>Game</th>
            </tr>
          </thead>
          <tbody>
            {penalties.map((shot, i) => (
              <tr key={i}>
                <td className="cell-muted">{shot.start || '—'}</td>
                <td className="player-name">{playerDisplayName(shot.attackingPlayer) || '—'}</td>
                <td className="player-name">{playerDisplayName(shot.defendingPlayer) || '—'}</td>
                <td>{shot.shotOrigin ?? '—'}</td>
                <td>{shot.shotLocation ?? '—'}</td>
                <td style={{ color: outcomeColor(shot.shotOutcome) }}>{shot.shotOutcome || '—'}</td>
                <td className="cell-muted">{shot.tournament || shot.game}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function outcomeColor(o) {
  if (o === 'Goal') return '#22c55e'
  if (o === 'Ball Control Save') return '#3b82f6'
  if (o === 'Save') return '#60a5fa'
  return '#9ca3af'
}

// ── Shared UI components ──────────────────────────────────────────────────────

function StatGrid({ cards }) {
  return (
    <div className="stat-grid">
      {cards.map(({ label, value, color, sub }) => (
        <div key={label} className="stat-card" style={{ borderTopColor: color }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ color }}>{value}</div>
          {sub && <div className="stat-sub">{sub}</div>}
        </div>
      ))}
    </div>
  )
}

function StatItem({ label, value, color }) {
  return (
    <div style={{ background: '#0f172a', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#f1f5f9' }}>{value}</div>
    </div>
  )
}

function EmptyState({ teams }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Select a country to begin scouting</h2>
      {teams.length > 0 ? (
        <p style={{ color: '#6b7280' }}>
          {teams.length} team{teams.length !== 1 ? 's' : ''} available: {teams.join(', ')}
        </p>
      ) : (
        <p style={{ color: '#6b7280' }}>
          No game data loaded yet. Add XLSX files to <code style={{ color: '#a78bfa' }}>public/games/</code> and run <code style={{ color: '#a78bfa' }}>npm run aggregate</code>.
        </p>
      )}
    </div>
  )
}

// ── MultiSelect component ─────────────────────────────────────────────────────

function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allSelected    = value.length === options.length && options.length > 0
  const someSelected   = value.length > 0 && !allSelected
  const isActive       = value.length > 0

  function toggle(opt) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }

  function toggleAll() {
    onChange(allSelected ? [] : [...options])
  }

  const btnLabel = value.length === 0
    ? `All ${label}s`
    : value.length === 1
      ? value[0]
      : `${value.length} ${label}s`

  if (options.length === 0) return null

  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <div style={{ position: 'relative' }} ref={ref}>
        <button
          className={`ms-btn ${open ? 'ms-btn--open' : ''} ${isActive ? 'ms-btn--active' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          <span className="ms-btn-label">{btnLabel}</span>
          <span className="ms-btn-chevron">▾</span>
        </button>
        {open && (
          <div className="ms-dropdown">
            <div className="ms-header">
              <label className="ms-option ms-select-all">
                <input
                  type="checkbox"
                  className="ms-checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleAll}
                />
                Select all
              </label>
              {isActive && (
                <button className="ms-clear" onClick={() => { onChange([]); setOpen(false) }}>
                  Clear
                </button>
              )}
            </div>
            <div className="ms-divider" />
            <div className="ms-options">
              {options.map(opt => (
                <label key={opt} className={`ms-option ${value.includes(opt) ? 'ms-option--checked' : ''}`}>
                  <input
                    type="checkbox"
                    className="ms-checkbox"
                    checked={value.includes(opt)}
                    onChange={() => toggle(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
