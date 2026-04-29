import React, { useState, useEffect, useMemo } from 'react'
import { parseRows, computeOffensiveStats, computeDefensiveStats, getUniqueValues, CANADA_PLAYERS } from './utils.js'
import FilterBar from './components/FilterBar.jsx'
import StatCards from './components/StatCards.jsx'
import GoalFaceMap from './components/GoalFaceMap.jsx'
import CourtMap from './components/CourtMap.jsx'
import {
  PlayerOffenseChart, PlayerDefenseChart,
  OriginEfficiencyChart, OutcomePieChart, GameScoreTable
} from './components/Charts.jsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const TABS = ['Overview', 'Offense', 'Defense', 'Penalties', 'Top Teams', 'Players']

const DEFAULT_FILTERS = {
  tournament: [],
  opponent: [],
  player: [],
  period: [],
  outcome: [],
  shotOrigin: 'All',
  shotLocation: 'All',
}

export default function App() {
  const [rawRows, setRawRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  useEffect(() => {
    fetch('/data.tsv')
      .then(r => r.text())
      .then(text => {
        setRawRows(parseRows(text))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const options = useMemo(() => ({
    tournaments: getUniqueValues(rawRows, 'tournament'),
    opponents: getUniqueValues(rawRows, 'opponent'),
    players: CANADA_PLAYERS,
    outcomes: getUniqueValues(rawRows, 'shotOutcome'),
  }), [rawRows])

  const filtered = useMemo(() => {
    return rawRows.filter(row => {
      if (filters.tournament.length > 0 && !filters.tournament.includes(row.tournament)) return false
      if (filters.opponent.length > 0 && !filters.opponent.includes(row.opponent)) return false
      if (filters.period.length > 0 && !filters.period.includes(String(row.period))) return false
      if (filters.player.length > 0) {
        const involved = filters.player.some(p => row.attackingPlayer === p || row.defendingPlayer === p)
        if (!involved) return false
      }
      if (filters.outcome.length > 0 && !filters.outcome.includes(row.shotOutcome)) return false
      if (filters.shotOrigin !== 'All' && row.shotOrigin !== filters.shotOrigin) return false
      if (filters.shotLocation !== 'All' && row.shotLocation !== filters.shotLocation) return false
      return true
    })
  }, [rawRows, filters])

  const offenseShots = useMemo(() => filtered.filter(r => r.isCanadaAttack && !r.isPenalty), [filtered])
  const defenseShots = useMemo(() => filtered.filter(r => !r.isCanadaAttack && !r.isPenalty), [filtered])
  const offensePenalties = useMemo(() => filtered.filter(r => r.isCanadaAttack && r.isPenalty), [filtered])
  const defensePenalties = useMemo(() => filtered.filter(r => !r.isCanadaAttack && r.isPenalty), [filtered])

  const offenseStats = useMemo(() => computeOffensiveStats(offenseShots), [offenseShots])
  const defenseStats = useMemo(() => computeDefensiveStats(defenseShots), [defenseShots])

  const hasActiveFilters =
    filters.tournament.length > 0 ||
    filters.opponent.length > 0 ||
    filters.player.length > 0 ||
    filters.period.length > 0 ||
    filters.outcome.length > 0 ||
    filters.shotOrigin !== 'All' ||
    filters.shotLocation !== 'All'

  function handlePositionClick(pos) {
    setFilters(f => ({ ...f, shotOrigin: f.shotOrigin === pos ? 'All' : pos }))
  }

  function handleLocationClick(loc) {
    setFilters(f => ({ ...f, shotLocation: f.shotLocation === loc ? 'All' : loc }))
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p>Loading match data…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logo">
          <div className="maple-leaf">🍁</div>
          <div>
            <h1>2025 Women's Goalball Stats Dashboard</h1>
            <p>Shot Map &amp; Efficiency Dashboard — Malmo / Guilford / IBSA Americas</p>
          </div>
        </div>
        <div className="header-meta">
          <span className="badge-info">{rawRows.length} shots tracked</span>
        </div>
      </header>

      <div className="filter-container">
        <FilterBar filters={filters} onChange={setFilters} options={options} />
        {hasActiveFilters && (
          <button className="clear-filters" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear all filters
          </button>
        )}
      </div>

      <StatCards offense={offenseStats} defense={defenseStats} />

      <div className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <main className="tab-content">
        {activeTab === 'Overview' && (
          <OverviewTab offenseShots={offenseShots} defenseShots={defenseShots} allRows={filtered} />
        )}
        {activeTab === 'Offense' && (
          <OffenseTab shots={offenseShots} activeOrigin={filters.shotOrigin} onPositionClick={handlePositionClick} activeLocation={filters.shotLocation} onLocationClick={handleLocationClick} />
        )}
        {activeTab === 'Defense' && (
          <DefenseTab shots={defenseShots} activeOrigin={filters.shotOrigin} onPositionClick={handlePositionClick} activeLocation={filters.shotLocation} onLocationClick={handleLocationClick} />
        )}
        {activeTab === 'Penalties' && (
          <PenaltiesTab offensePenalties={offensePenalties} defensePenalties={defensePenalties} activeLocation={filters.shotLocation} onLocationClick={handleLocationClick} />
        )}
        {activeTab === 'Top Teams' && (
          <TopTeamsTab allRows={filtered} />
        )}
        {activeTab === 'Players' && (
          <PlayersTab
            offenseShots={offenseShots}
            defenseShots={defenseShots}
            allShots={filtered.filter(r => !r.isPenalty)}
            offensePenalties={offensePenalties}
            defensePenalties={defensePenalties}
          />
        )}
      </main>
    </div>
  )
}

function OverviewTab({ offenseShots, defenseShots, allRows }) {
  return (
    <div className="grid-2">
      <GameScoreTable allRows={allRows} />
      <div>
        <OutcomePieChart shots={offenseShots} isOffense={true} />
        <OutcomePieChart shots={defenseShots} isOffense={false} />
      </div>
    </div>
  )
}

function OffenseTab({ shots, activeOrigin, onPositionClick, activeLocation, onLocationClick }) {
  return (
    <div>
      <div className="grid-2">
        <CourtMap shots={shots} title="Shot Origin Map (Canada Attack)" isOffense={true} activeOrigin={activeOrigin} onPositionClick={onPositionClick} />
        <GoalFaceMap shots={shots} title="Shot Location Map (Canada Shots)" activeLocation={activeLocation} onLocationClick={onLocationClick} />
      </div>
      <div className="grid-2">
        <OriginEfficiencyChart shots={shots} isOffense={true} />
        <GoalLocationChart shots={shots} isOffense={true} />
      </div>
    </div>
  )
}

function DefenseTab({ shots, activeOrigin, onPositionClick, activeLocation, onLocationClick }) {
  return (
    <div>
      <div className="grid-2">
        <CourtMap shots={shots} title="Opponent Shot Origin Map" isOffense={false} activeOrigin={activeOrigin} onPositionClick={onPositionClick} />
        <GoalFaceMap shots={shots} title="Shot Location Map (Shots Faced)" activeLocation={activeLocation} onLocationClick={onLocationClick} />
      </div>
      <div className="grid-2">
        <OriginEfficiencyChart shots={shots} isOffense={false} />
        <GoalLocationChart shots={shots} isOffense={false} />
      </div>
    </div>
  )
}

function PenaltiesTab({ offensePenalties, defensePenalties, activeLocation, onLocationClick }) {
  const offStats = computeOffensiveStats(offensePenalties)
  const defStats = computeDefensiveStats(defensePenalties)

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <h3 className="card-title">Canada Penalty Shots</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <StatItem label="Shots" value={offStats.total} />
            <StatItem label="Goals" value={offStats.goals} color="#22c55e" />
            <StatItem label="Conv%" value={`${offStats.conversionRate}%`} color="#22c55e" />
            <StatItem label="Saved" value={offStats.saved} />
            <StatItem label="Out" value={offStats.out} />
          </div>
          <GoalFaceMap shots={offensePenalties} title="Penalty Shot Locations (Canada)" activeLocation={activeLocation} onLocationClick={onLocationClick} />
        </div>
        <div className="card">
          <h3 className="card-title">Opponent Penalty Shots</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <StatItem label="Shots Faced" value={defStats.total} />
            <StatItem label="Goals Against" value={defStats.goalsAgainst} color="#ef4444" />
            <StatItem label="Stop%" value={`${defStats.saveRate}%`} color="#3b82f6" />
            <StatItem label="Saves" value={defStats.saves} color="#3b82f6" />
            <StatItem label="BC%" value={`${defStats.ballControlRate}%`} color="#60a5fa" />
            <StatItem label="Opp Out" value={defStats.opponentOut} />
          </div>
          <GoalFaceMap shots={defensePenalties} title="Penalty Shot Locations (Opponent)" activeLocation={activeLocation} onLocationClick={onLocationClick} />
        </div>
      </div>
      <PenaltyTable offensePenalties={offensePenalties} defensePenalties={defensePenalties} />
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

function PenaltyTable({ offensePenalties, defensePenalties }) {
  if (offensePenalties.length === 0 && defensePenalties.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Penalty Shot Log</h3>
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0' }}>No penalty shots match current filters.</p>
      </div>
    )
  }
  const allPenalties = [...offensePenalties, ...defensePenalties].sort((a, b) => a.start < b.start ? -1 : 1)
  return (
    <div className="card">
      <h3 className="card-title">Penalty Shot Log</h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th><th>Attacker</th><th>Defender</th>
              <th>Origin</th><th>Location</th><th>Outcome</th>
              <th>Opponent</th><th>Tournament</th>
            </tr>
          </thead>
          <tbody>
            {allPenalties.map((shot, i) => (
              <tr key={i}>
                <td className="cell-muted">{shot.start || '—'}</td>
                <td className="player-name">{shot.attackingPlayer || '—'}</td>
                <td className="player-name">{shot.defendingPlayer || '—'}</td>
                <td>{shot.shotOrigin ?? '—'}</td>
                <td>{shot.shotLocation ?? '—'}</td>
                <td style={{ color: outcomeColor(shot.shotOutcome) }}>{shot.shotOutcome || '—'}</td>
                <td className="cell-muted">{shot.opponent}</td>
                <td className="cell-muted">{shot.tournament}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function outcomeColor(outcome) {
  if (outcome === 'Goal Canada') return '#22c55e'
  if (outcome === 'Goal Opponent') return '#ef4444'
  if (outcome === 'Canada Save' || outcome === 'Canada Ball Control Save') return '#3b82f6'
  if (outcome === 'Opponent Save') return '#f59e0b'
  return '#9ca3af'
}

const TOP_TEAMS = [
  { name: 'Brazil', color: '#22c55e' },
  { name: 'USA',    color: '#3b82f6' },
  { name: 'Japan',  color: '#ef4444' },
]

function TopTeamsTab({ allRows }) {
  return (
    <div>
      {TOP_TEAMS.map(({ name, color }) => {
        const teamRows = allRows.filter(r => r.opponent === name)
        if (teamRows.length === 0) {
          return (
            <div key={name} className="card" style={{ marginBottom: 24 }}>
              <h3 className="card-title" style={{ color }}>{name}</h3>
              <p style={{ color: '#6b7280' }}>No data matches current filters.</p>
            </div>
          )
        }

        const offShots = teamRows.filter(r => r.isCanadaAttack && !r.isPenalty)
        const defShots = teamRows.filter(r => !r.isCanadaAttack && !r.isPenalty)
        const offStats = computeOffensiveStats(offShots)
        const defStats = computeDefensiveStats(defShots)

        // Build per-game records
        const gamesMap = {}
        for (const row of teamRows) {
          const key = row.tournament
          if (!gamesMap[key]) gamesMap[key] = { tournament: row.tournament, canadaGoals: 0, oppGoals: 0, shots: 0, oppShots: 0 }
          const g = gamesMap[key]
          if (row.isCanadaAttack) {
            g.shots++
            if (row.shotOutcome === 'Goal Canada') g.canadaGoals++
          } else {
            g.oppShots++
            if (row.shotOutcome === 'Goal Opponent') g.oppGoals++
          }
        }
        const gameList = Object.values(gamesMap).sort((a, b) => a.tournament.localeCompare(b.tournament))
        const wins   = gameList.filter(g => g.canadaGoals > g.oppGoals).length
        const losses = gameList.filter(g => g.canadaGoals < g.oppGoals).length
        const draws  = gameList.filter(g => g.canadaGoals === g.oppGoals).length
        const totalFor     = gameList.reduce((s, g) => s + g.canadaGoals, 0)
        const totalAgainst = gameList.reduce((s, g) => s + g.oppGoals, 0)

        return (
          <div key={name} style={{ marginBottom: 32 }}>
            {/* Team header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color }}>{name}</h2>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>
                {wins}W – {losses}L – {draws}D
              </span>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>
                Goals: {totalFor} – {totalAgainst}
              </span>
            </div>

            {/* Key stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 12, marginBottom: 16 }}>
              <StatItem label="CA Shots" value={offStats.total} />
              <StatItem label="CA Goals" value={offStats.goals} color="#22c55e" />
              <StatItem label="Conv%" value={`${offStats.conversionRate}%`} color="#22c55e" />
              <StatItem label="Opp Shots" value={defStats.total} />
              <StatItem label="Saves" value={defStats.saves} color="#3b82f6" />
              <StatItem label="BC Saves" value={defStats.ballControlSaves} color="#60a5fa" />
              <StatItem label="BC%" value={`${defStats.ballControlRate}%`} color="#60a5fa" />
              <StatItem label="Goals Against" value={defStats.goalsAgainst} color="#ef4444" />
            </div>

            {/* Game results table */}
            <div className="card">
              <h3 className="card-title">Game Results vs {name}</h3>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tournament</th>
                      <th>Score</th>
                      <th>Result</th>
                      <th>CA Shots</th>
                      <th>CA Goals</th>
                      <th>Conv%</th>
                      <th>Opp Shots</th>
                      <th>Saves</th>
                      <th>BC Saves</th>
                      <th>BC%</th>
                      <th>Goals Against</th>
                      <th>Stop%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameList.map((g, i) => {
                      const result = g.canadaGoals > g.oppGoals ? 'W' : g.canadaGoals < g.oppGoals ? 'L' : 'D'
                      const resultColor = result === 'W' ? '#22c55e' : result === 'L' ? '#ef4444' : '#f59e0b'
                      const gOff = computeOffensiveStats(offShots.filter(r => r.tournament === g.tournament))
                      const gDef = computeDefensiveStats(defShots.filter(r => r.tournament === g.tournament))
                      return (
                        <tr key={i}>
                          <td>{g.tournament}</td>
                          <td className="cell-score">{g.canadaGoals} – {g.oppGoals}</td>
                          <td><span className="badge" style={{ color: resultColor, borderColor: resultColor }}>{result}</span></td>
                          <td className="cell-muted">{gOff.total}</td>
                          <td style={{ color: '#22c55e' }}>{gOff.goals}</td>
                          <td>{gOff.conversionRate}%</td>
                          <td className="cell-muted">{gDef.total}</td>
                          <td style={{ color: '#3b82f6' }}>{gDef.saves}</td>
                          <td style={{ color: '#60a5fa' }}>{gDef.ballControlSaves}</td>
                          <td style={{ color: '#60a5fa' }}>{gDef.ballControlRate}%</td>
                          <td style={{ color: '#ef4444' }}>{gDef.goalsAgainst}</td>
                          <td>{gDef.saveRate}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PlayersTab({ offenseShots, defenseShots, allShots, offensePenalties, defensePenalties }) {
  return (
    <div>
      <div className="grid-2">
        <PlayerOffenseChart shots={offenseShots} />
        <PlayerDefenseChart shots={allShots} />
      </div>
      <PlayerDetailTable
        offenseShots={offenseShots}
        defenseShots={defenseShots}
        offensePenalties={offensePenalties}
        defensePenalties={defensePenalties}
      />
    </div>
  )
}

function GoalLocationChart({ shots, isOffense }) {
  const data = [0, 1, 2, 3, 4, 5, 6].map(loc => {
    const locShots = shots.filter(s => s.shotLocation === loc)
    const goals = locShots.filter(s => s.shotOutcome === 'Goal Canada' || s.shotOutcome === 'Goal Opponent').length
    const label = loc === 0 ? 'Out L' : loc === 6 ? 'Out R' : `Sec ${loc}`
    return { label, total: locShots.length, goals }
  })
  return (
    <div className="card">
      <h3 className="card-title">{isOffense ? 'Goals by Location (Canada)' : 'Goals Conceded by Location'}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            labelStyle={{ color: '#f1f5f9' }}
            itemStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="goals" name="Goals" fill={isOffense ? '#22c55e' : '#ef4444'} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function PlayerDetailTable({ offenseShots, defenseShots, offensePenalties, defensePenalties }) {
  const stats = CANADA_PLAYERS.map(player => {
    const pOff = offenseShots.filter(s => s.attackingPlayer === player)
    const pDef = defenseShots.filter(s => s.defendingPlayer === player)
    const pOffPen = offensePenalties.filter(s => s.attackingPlayer === player)
    const pDefPen = defensePenalties.filter(s => s.defendingPlayer === player)
    const offStats = computeOffensiveStats(pOff)
    const defStats = computeDefensiveStats(pDef)
    const offPenStats = computeOffensiveStats(pOffPen)
    const defPenStats = computeDefensiveStats(pDefPen)
    return { player, offStats, defStats, offPenStats, defPenStats }
  }).filter(s => s.offStats.total > 0 || s.defStats.total > 0 || s.offPenStats.total > 0 || s.defPenStats.total > 0)

  return (
    <div className="card">
      <h3 className="card-title">Full Player Statistics</h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th colSpan={4} style={{ textAlign: 'center', color: '#22c55e' }}>Offense</th>
              <th colSpan={5} style={{ textAlign: 'center', color: '#3b82f6' }}>Defense</th>
              <th colSpan={3} style={{ textAlign: 'center', color: '#a78bfa' }}>Pen. Offense</th>
              <th colSpan={4} style={{ textAlign: 'center', color: '#818cf8' }}>Pen. Defense</th>
            </tr>
            <tr>
              <th></th>
              <th>Shots</th><th>Goals</th><th>Saved</th><th>Conv%</th>
              <th>Faced</th><th>Saves</th><th title="Ball control saves as % of total saves">BC%</th><th>GA</th><th>Stop%</th>
              <th>Shots</th><th>Goals</th><th>Conv%</th>
              <th>Faced</th><th>Saves</th><th>GA</th><th>Stop%</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(({ player, offStats, defStats, offPenStats, defPenStats }) => (
              <tr key={player}>
                <td className="player-name">{player}</td>
                {/* Offense */}
                <td>{offStats.total}</td>
                <td style={{ color: '#22c55e' }}>{offStats.goals}</td>
                <td className="cell-muted">{offStats.saved}</td>
                <td>{offStats.conversionRate}%</td>
                {/* Defense */}
                <td>{defStats.total}</td>
                <td style={{ color: '#3b82f6' }}>{defStats.saves}</td>
                <td style={{ color: '#60a5fa' }}>{defStats.ballControlRate}%</td>
                <td style={{ color: '#ef4444' }}>{defStats.goalsAgainst}</td>
                <td>{defStats.saveRate}%</td>
                {/* Pen. Offense */}
                <td style={{ color: offPenStats.total > 0 ? '#f1f5f9' : '#374151' }}>{offPenStats.total}</td>
                <td style={{ color: offPenStats.goals > 0 ? '#a78bfa' : '#374151' }}>{offPenStats.goals}</td>
                <td style={{ color: offPenStats.total > 0 ? '#f1f5f9' : '#374151' }}>{offPenStats.total > 0 ? `${offPenStats.conversionRate}%` : '—'}</td>
                {/* Pen. Defense */}
                <td style={{ color: defPenStats.total > 0 ? '#f1f5f9' : '#374151' }}>{defPenStats.total}</td>
                <td style={{ color: defPenStats.saves > 0 ? '#818cf8' : '#374151' }}>{defPenStats.saves}</td>
                <td style={{ color: defPenStats.goalsAgainst > 0 ? '#ef4444' : '#374151' }}>{defPenStats.goalsAgainst}</td>
                <td style={{ color: defPenStats.total > 0 ? '#f1f5f9' : '#374151' }}>{defPenStats.total > 0 ? `${defPenStats.saveRate}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
