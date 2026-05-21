// src/pages/results.js
import { getAllBets, getResults, computeScores, formatTime, parseTime, HOMMES, FEMMES, ALL_ATHLETES } from '../lib/supabase.js'

const $ = id => document.getElementById(id)

function toast(msg) {
  const el = $('toast')
  el.textContent = msg
  el.style.background = '#b5f23d'
  el.style.color = '#0d1117'
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2000)
}

// ── Tab nav ────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === `sec-${tab}`))
  })
})

// ── Drawers ────────────────────────────────────────────────────────────────
function openDrawer(id) {
  $(id).classList.add('open')
  document.body.style.overflow = 'hidden'
}
function closeDrawer(id) {
  $(id).classList.remove('open')
  document.body.style.overflow = ''
}

$('bettor-drawer').addEventListener('click', e => { if (e.target === $('bettor-drawer')) closeDrawer('bettor-drawer') })
$('athlete-drawer').addEventListener('click', e => { if (e.target === $('athlete-drawer')) closeDrawer('athlete-drawer') })

// ── Initials ───────────────────────────────────────────────────────────────
function initials(name) {
  const parts = name.split(' ')
  return parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
}

// ── Format diff ───────────────────────────────────────────────────────────
function fmtDiff(sec) {
  sec = Math.abs(sec)
  if (sec < 60) return `±${sec}s`
  const m = Math.floor(sec / 60), s = sec % 60
  return s > 0 ? `±${m}m${s}s` : `±${m}m`
}

function diffClass(sec) {
  sec = Math.abs(sec)
  if (sec <= 30) return 'adb-diff-good'
  if (sec <= 180) return 'adb-diff-ok'
  return 'adb-diff-far'
}

// ── Main render ────────────────────────────────────────────────────────────
let _bets = [], _results = [], _scores = {}, _breakdown = {}, _ranking = [], _totals = {}, _resultMap = {}, _jpDetails = {}

async function load() {
  try {
    [_bets, _results] = await Promise.all([getAllBets(), getResults()])
    const out = computeScores(_bets, _results)
    _scores = out.scores
    _breakdown = out.breakdown
    _ranking = out.ranking
    _totals = out.totals
    _resultMap = out.resultMap
    _jpDetails = out.jpDetails
    renderPronos()
    renderCourse()
  } catch (e) {
    $('pronos-content').innerHTML = `<div class="empty"><div class="e-big">!</div><p>Erreur de chargement.<br>Vérifie ta connexion.</p></div>`
    console.error(e)
  }
}

// ── Render classement pronos ───────────────────────────────────────────────
function renderPronos() {
  const sorted = Object.entries(_scores).sort((a, b) => b[1] - a[1])
  const maxPts = sorted[0]?.[1] || 1

  if (sorted.length === 0) {
    $('pronos-content').innerHTML = `<div class="empty"><div class="e-big">00:00</div><p>Les résultats apparaîtront après la course.<br>Demande à l'admin d'entrer les chronos.</p></div>`
    return
  }

  let html = ''

  // Podium animé — top 3
  const order = [
    { idx: 1, cls: 'p2', blkCls: 'blk2', medal: '🥈' },
    { idx: 0, cls: 'p1', blkCls: 'blk1', medal: '🥇' },
    { idx: 2, cls: 'p3', blkCls: 'blk3', medal: '🥉' },
  ]
  html += `<div class="podium-stage">`
  order.forEach(({ idx, cls, blkCls, medal }) => {
    const e = sorted[idx]
    if (!e) return
    const ptColor = idx === 0 ? 'var(--gold)' : idx === 1 ? 'var(--silver)' : 'var(--bronze)'
    html += `<div class="pod-col">
      <div class="pod-avatar ${cls}" data-user="${e[0]}" title="Voir les pronos de ${e[0]}">${initials(e[0])}</div>
      <div class="pod-name">${e[0]}</div>
      <div class="pod-pts" style="color:${ptColor}">${e[1]} pts</div>
      <div class="pod-blk ${blkCls}">${medal}</div>
    </div>`
  })
  html += `</div>`

  // Classement complet
  html += `<div class="sec-label">Classement complet</div><div class="lb-list">`
  sorted.forEach((e, i) => {
    const pct = Math.round((e[1] / maxPts) * 100)
    const medals = ['🥇', '🥈', '🥉']
    html += `<div class="lb-item${i === 0 ? ' top1' : ''}" data-user="${e[0]}">
      <div class="lb-pos">${medals[i] || i + 1}</div>
      <div class="lb-avatar">${initials(e[0])}</div>
      <div class="lb-name">${e[0]}</div>
      <div class="lb-track"><div class="lb-bar" data-pct="${pct}"></div></div>
      <div class="lb-pts">${e[1]} pts</div>
    </div>`
  })
  html += `</div>`

  $('pronos-content').innerHTML = html

  // Animate bars
  requestAnimationFrame(() => {
    document.querySelectorAll('.lb-bar').forEach((b, i) => {
      setTimeout(() => {
        b.style.transition = 'width .9s ease-out'
        b.style.width = b.dataset.pct + '%'
      }, 100 + i * 60)
    })
  })

  // Click handlers
  document.querySelectorAll('[data-user]').forEach(el => {
    el.addEventListener('click', () => openBettorDrawer(el.dataset.user))
  })
}

// ── Render classement course ───────────────────────────────────────────────
function renderCourse() {
  if (_ranking.length === 0) {
    $('course-content').innerHTML = `<div class="empty"><div class="e-big">🏁</div><p>Les temps seront affichés après la course.</p></div>`
    return
  }

  // Find best chrono per athlete (closest bettor)
  const closestPerAthlete = {}
  Object.entries(_jpDetails).forEach(([name, arr]) => {
    if (arr.length > 0) closestPerAthlete[name] = arr[0].user
  })

  let html = `<div class="sec-label">Temps officiels</div><div class="chrono-grid">`
  _ranking.forEach(([name, totalSec], i) => {
    const g = FEMMES.includes(name) ? '👩' : '👨'
    const medals = ['🥇', '🥈', '🥉']
    const closest = closestPerAthlete[name]
    html += `<div class="chrono-row" data-athlete="${name}">
      <div class="chrono-pos">${medals[i] || i + 1}</div>
      <div style="flex:1;min-width:0">
        <div class="chrono-name">${g} ${name}</div>
        ${closest ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">+ proche : <span style="color:#3dd68c;font-weight:600">${closest}</span></div>` : ''}
      </div>
      <div class="chrono-time">${formatTime(totalSec)}</div>
    </div>`
  })
  html += `</div>`

  // Split times breakdown header
  html += `<div class="sec-label" style="margin-top:20px">Temps par discipline</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-family:'Barlow Condensed',sans-serif">`
  html += `<thead><tr>
    <th style="text-align:left;padding:6px 10px;font-size:11px;letter-spacing:.8px;color:var(--muted);font-weight:700;border-bottom:1px solid #1f2937">Athlète</th>
    <th style="padding:6px 6px;font-size:11px;color:var(--muted);font-weight:700;border-bottom:1px solid #1f2937;text-align:center">NAT</th>
    <th style="padding:6px 6px;font-size:11px;color:var(--muted);font-weight:700;border-bottom:1px solid #1f2937;text-align:center">T1</th>
    <th style="padding:6px 6px;font-size:11px;color:var(--muted);font-weight:700;border-bottom:1px solid #1f2937;text-align:center">VÉLO</th>
    <th style="padding:6px 6px;font-size:11px;color:var(--muted);font-weight:700;border-bottom:1px solid #1f2937;text-align:center">T2</th>
    <th style="padding:6px 6px;font-size:11px;color:var(--muted);font-weight:700;border-bottom:1px solid #1f2937;text-align:center">COURSE</th>
  </tr></thead><tbody>`

  _ranking.forEach(([name], i) => {
    const r = _resultMap[name]
    if (!r) return
    const bg = i % 2 === 0 ? 'var(--ink3)' : 'var(--ink2)'
    html += `<tr style="background:${bg}">
      <td style="padding:7px 10px;font-weight:700;font-size:14px">${name}</td>
      <td style="padding:7px 6px;font-size:13px;color:var(--muted);text-align:center">${r.natation || '–'}</td>
      <td style="padding:7px 6px;font-size:13px;color:var(--muted);text-align:center">${r.t1 || '–'}</td>
      <td style="padding:7px 6px;font-size:13px;color:var(--muted);text-align:center">${r.velo || '–'}</td>
      <td style="padding:7px 6px;font-size:13px;color:var(--muted);text-align:center">${r.t2 || '–'}</td>
      <td style="padding:7px 6px;font-size:13px;color:var(--muted);text-align:center">${r.course || '–'}</td>
    </tr>`
  })
  html += `</tbody></table></div>`

  $('course-content').innerHTML = html

  document.querySelectorAll('.chrono-row').forEach(el => {
    el.addEventListener('click', () => openAthleteDrawer(el.dataset.athlete))
  })
}

// ── Bettor drawer ──────────────────────────────────────────────────────────
function openBettorDrawer(user) {
  const pts = _scores[user] || 0
  const bds = _breakdown[user] || []
  const userBets = _bets.filter(b => b.user_name === user)

  $('drawer-title').textContent = user
  $('drawer-sub').textContent = `Total : ${pts} point${pts > 1 ? 's' : ''}`

  const catLabel = {
    juste_prix: '⏱ Juste Prix',
    specialiste: '🏊 Spécialiste',
    transition: '🔄 Transition',
    tierce: '🏆 Tiercé',
    premier_homme: '🥇 Premier H',
    premier_femme: '🥇 Première F',
  }

  // Build scored set for quick lookup
  const scoredReasons = new Set(bds.map(b => b.reason))

  let html = `<div class="sec-label" style="margin-bottom:10px">Points marqués</div>`
  if (bds.length === 0) {
    html += `<div style="font-size:13px;color:var(--muted);padding:12px 0">Aucun point pour l'instant — la course n'a peut-être pas encore eu lieu.</div>`
  } else {
    bds.forEach(({ pts, reason }) => {
      html += `<div class="bet-item">
        <div class="bet-cat">${reason}</div>
        <div class="bet-pts win">+${pts}</div>
      </div>`
    })
  }

  html += `<div class="sec-label" style="margin-top:16px;margin-bottom:10px">Tous ses pronostics</div>`
  userBets.forEach(b => {
    let display = b.value
    if (b.category === 'juste_prix') {
      const sec = +b.value
      display = formatTime(sec)
      const real = _totals[b.target]
      if (real) {
        const diff = Math.abs(sec - real)
        const cls = diffClass(diff)
        display += ` <span class="${cls}">${fmtDiff(diff)}</span>`
      }
    }
    if (b.category === 'tierce') {
      display = b.value.replace(/,/g, ' → ')
    }

    html += `<div class="bet-item">
      <div>
        <div class="bet-cat">${catLabel[b.category] || b.category}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${b.target !== 'podium' && b.target !== 'homme' && b.target !== 'femme' ? b.target : ''}</div>
      </div>
      <div class="bet-val">${display}</div>
    </div>`
  })

  $('drawer-body').innerHTML = html
  openDrawer('bettor-drawer')
}

// ── Athlete drawer ─────────────────────────────────────────────────────────
function openAthleteDrawer(name) {
  const r = _resultMap[name]
  const total = _totals[name]
  const g = FEMMES.includes(name) ? '👩' : '👨'

  $('ath-drawer-title').textContent = `${g} ${name}`
  $('ath-drawer-sub').textContent = total ? `Temps final : ${formatTime(total)}` : 'Temps non encore saisi'

  let html = ''

  // Split times
  if (r) {
    html += `<div class="sec-label" style="margin-bottom:10px">Temps par discipline</div>`
    const fields = [
      ['Natation', r.natation],
      ['T1', r.t1],
      ['Vélo', r.velo],
      ['T2', r.t2],
      ['Course', r.course],
      ['Total', total ? formatTime(total) : null],
    ]
    fields.forEach(([label, val]) => {
      if (!val) return
      html += `<div class="ath-drawer-row">
        <div class="ath-drawer-label">${label}</div>
        <div class="ath-drawer-time" style="${label === 'Total' ? 'color:var(--lime)' : ''}">${val}</div>
      </div>`
    })
  }

  // All pronostics for this athlete (juste prix)
  const jpBets = (_jpDetails[name] || [])
  if (jpBets.length > 0) {
    html += `<div class="sec-label" style="margin-top:16px;margin-bottom:10px">Pronostics temps total</div>`
    html += `<div class="ath-drawer-bets">`
    jpBets.forEach(({ user, sec, diff }, i) => {
      const medals = ['🥇', '🥈', '🥉']
      const cls = diffClass(diff)
      html += `<div class="ath-drawer-bet-row">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:14px">${medals[i] || ''}</span>
          <div class="adb-user">${user}</div>
        </div>
        <div style="text-align:right">
          <div class="adb-prono">${formatTime(sec)}</div>
          <div class="${cls}">${fmtDiff(diff)}</div>
        </div>
      </div>`
    })
    html += `</div>`
  } else {
    html += `<div style="font-size:13px;color:var(--muted);padding:12px 0">Aucun pronostic de temps pour cet athlète.</div>`
  }

  $('ath-drawer-body').innerHTML = html
  openDrawer('athlete-drawer')
}

// ── Refresh button ─────────────────────────────────────────────────────────
$('btn-refresh')?.addEventListener('click', async () => {
  toast('Actualisation…')
  await load()
  toast('✓ Mis à jour !')
})

// ── Real-time subscription ─────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
supabase
  .channel('results-live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, () => load())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => load())
  .subscribe()

// ── Init ───────────────────────────────────────────────────────────────────
load()
