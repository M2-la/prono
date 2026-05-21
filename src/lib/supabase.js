// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── Constants ───────────────────────────────────────────────────────────────

export const HOMMES = ['Romain', 'Antoine', 'JB', 'Yannick', 'Benoît', 'Mickaël']
export const FEMMES = ['Amandine', 'Chloé', 'Marion']
export const ALL_ATHLETES = [...HOMMES, ...FEMMES]
export const DISCIPLINES = ['Natation', 'Vélo', 'Course à pied']
export const DISC_REAL_KEY = { 'Natation': 'natation', 'Vélo': 'velo', 'Course à pied': 'course' }
export const TRANSITIONS = ['T1', 'T2']

// ─── Bet helpers ─────────────────────────────────────────────────────────────

export async function saveBet(bet) {
  // Upsert: one bet per user per category per target
  const { error } = await supabase
    .from('bets')
    .upsert(bet, { onConflict: 'user_name,category,target' })
  if (error) throw error
}

export async function getAllBets() {
  const { data, error } = await supabase.from('bets').select('*').order('created_at')
  if (error) throw error
  return data
}

// ─── Results helpers ──────────────────────────────────────────────────────────

export async function getResults() {
  const { data, error } = await supabase.from('results').select('*')
  if (error) throw error
  // Returns array of { athlete, natation, t1, velo, t2, course }
  return data
}

export async function upsertResult(row) {
  const { error } = await supabase
    .from('results')
    .upsert(row, { onConflict: 'athlete' })
  if (error) throw error
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function parseTime(str) {
  if (!str) return 0
  const p = str.split(':')
  if (p.length === 2) return (+p[0]) * 60 + (+p[1])
  if (p.length === 3) return (+p[0]) * 3600 + (+p[1]) * 60 + (+p[2])
  return 0
}

export function formatTime(sec) {
  if (!sec || sec <= 0) return '--:--:--'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export function computeScores(bets, results) {
  // Build totals map: { athleteName: totalSeconds }
  const totals = {}
  const resultMap = {}
  results.forEach(r => {
    resultMap[r.athlete] = r
    const sum = parseTime(r.natation) + parseTime(r.t1) + parseTime(r.velo) + parseTime(r.t2) + parseTime(r.course)
    if (sum > 0) totals[r.athlete] = sum
  })

  const ranking = Object.entries(totals).sort((a, b) => a[1] - b[1])
  const scores = {}
  const breakdown = {} // per user: list of scoring events
  const add = (user, pts, reason) => {
    scores[user] = (scores[user] || 0) + pts
    if (!breakdown[user]) breakdown[user] = []
    breakdown[user].push({ pts, reason })
  }

  // 1. Juste Prix: closest per athlete → 3/2/1 pts
  const jpDetails = {} // athleteName → [{user, diff, sec}]
  ALL_ATHLETES.forEach(name => {
    if (!totals[name]) return
    const arr = bets
      .filter(b => b.category === 'juste_prix' && b.target === name)
      .map(b => ({ user: b.user_name, sec: +b.value, diff: Math.abs(+b.value - totals[name]) }))
      .sort((a, b) => a.diff - b.diff)
    jpDetails[name] = arr
    if (arr[0]) add(arr[0].user, 3, `Juste Prix ${name} (le + proche, écart ${formatDiff(arr[0].diff)})`)
    if (arr[1]) add(arr[1].user, 2, `Juste Prix ${name} (2e plus proche, écart ${formatDiff(arr[1].diff)})`)
    if (arr[2]) add(arr[2].user, 1, `Juste Prix ${name} (3e plus proche, écart ${formatDiff(arr[2].diff)})`)
  })

  // 2. Spécialiste: meilleur par discipline → 3 pts
  DISCIPLINES.forEach(disc => {
    const key = DISC_REAL_KEY[disc]
    let best = null, bestTime = Infinity
    ALL_ATHLETES.forEach(n => {
      const r = resultMap[n]
      if (r && r[key]) {
        const t = parseTime(r[key])
        if (t < bestTime) { bestTime = t; best = n }
      }
    })
    if (best) {
      bets.filter(b => b.category === 'specialiste' && b.target === disc && b.value === best)
        .forEach(b => add(b.user_name, 3, `Spécialiste ${disc} → ${best} ✓`))
    }
  })

  // 3. Transition: le plus rapide par T → 2 pts
  TRANSITIONS.forEach(t => {
    let best = null, bestTime = Infinity
    ALL_ATHLETES.forEach(n => {
      const r = resultMap[n]
      if (r && r[t.toLowerCase()]) {
        const ti = parseTime(r[t.toLowerCase()])
        if (ti < bestTime) { bestTime = ti; best = n }
      }
    })
    if (best) {
      bets.filter(b => b.category === 'transition' && b.target === t && b.value === best)
        .forEach(b => add(b.user_name, 2, `Transition ${t} → ${best} ✓`))
    }
  })

  // 4. Tiercé: ordre exact = 3pts, bons 3 noms désordre = 1pt
  if (ranking.length >= 3) {
    const top3 = ranking.slice(0, 3).map(r => r[0])
    bets.filter(b => b.category === 'tierce').forEach(b => {
      const p = b.value.split(',')
      if (p[0] === top3[0] && p[1] === top3[1] && p[2] === top3[2]) {
        add(b.user_name, 3, `Tiercé ordre exact ✓`)
      } else if (p.filter(x => top3.includes(x)).length === 3) {
        add(b.user_name, 1, `Tiercé bons noms désordre ✓`)
      }
    })
  }

  // 5. Premier homme/femme: 2pts chacun
  if (ranking.length > 0) {
    const firstH = ranking.find(r => HOMMES.includes(r[0]))
    const firstF = ranking.find(r => FEMMES.includes(r[0]))
    if (firstH) bets.filter(b => b.category === 'premier_homme' && b.value === firstH[0])
      .forEach(b => add(b.user_name, 2, `1er homme → ${firstH[0]} ✓`))
    if (firstF) bets.filter(b => b.category === 'premier_femme' && b.value === firstF[0])
      .forEach(b => add(b.user_name, 2, `1ère femme → ${firstF[0]} ✓`))
  }

  return { scores, breakdown, ranking, totals, resultMap, jpDetails }
}

function formatDiff(sec) {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60), s = sec % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}
