import React from 'react'

export default function StatCards({ offense, defense }) {
  return (
    <div className="stat-grid">
      <StatCard label="Canada Goals" value={offense.goals} sub={`${offense.conversionRate}% conversion`} accent="#22c55e" />
      <StatCard label="Total Shots" value={offense.total} sub={`${offense.out} out of bounds`} accent="#3b82f6" />
      <StatCard label="Goals Against" value={defense.goalsAgainst} sub={`from ${defense.total} opp shots`} accent="#ef4444" />
      <StatCard label="Canada Saves" value={defense.saves} sub={`+${defense.opponentOut} opp out | ${defense.saveRate}% stop rate`} accent="#3b82f6" />
    </div>
  )
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card" style={{ borderTopColor: accent }}>
      <div className="stat-value" style={{ color: accent }}>{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  )
}
