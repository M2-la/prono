// src/pages/bets.js
import { supabase, saveBet, HOMMES, FEMMES, ALL_ATHLETES, DISCIPLINES, TRANSITIONS } from '../lib/supabase.js'

// ── Utils ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)
const toSec = (h, m, s) => (+h || 0) * 3600 + (+m || 0) * 60 + (+s || 0)

function toast(msg, type = 'ok') {
  const el = $('toast')
  el.textContent = msg
  el.style.background = type === 'warn' ? '#f5a623' : type === 'err' ? '#f03e3e' : '#b5f23d'
  el.style.color = type === 'ok' ? '#0d1117' : '#fff'
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2500)
}

function getBettor(inputId) {
  const v = $(inputId)?.value.trim()
  if (!v) { toast('Entre ton prénom !', 'warn'); return null }
  return v
}

function opts(pool) {
  return '<option value="">— Sélectionner —</option>' + pool.map(a => `<option value="${a}">${a}</option>`).join('')
}

// ── Tab navigation ─────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === `sec-${tab}`))
  })
})

// Sync bettor name across tabs
const bettorInputs = ['bettor', 'bettor-spec', 'bettor-trans', 'bettor-tierce', 'bettor-prem']
bettorInputs.forEach(id => {
  $(id)?.addEventListener('input', e => {
    bettorInputs.forEach(other => { if (other !== id && $(other)) $(other).value = e.target.value })
  })
})

// ── Build Juste Prix ───────────────────────────────────────────────────────
function buildJP() {
  $('jp-list').innerHTML = ALL_ATHLETES.map((n, i) => {
    const k = n.replace(/\s/g, '')
    const g = FEMMES.includes(n) ? '👩' : '👨'
    return `<div class="ath-row">
      <div class="ath-inner">
        <div class="ath-info">
          <div class="ath-idx">${i + 1}</div>
          <div><div class="ath-name">${g} ${n}</div><div class="ath-cat">${FEMMES.includes(n) ? 'Femmes' : 'Hommes'}</div></div>
        </div>
        <div class="time-row">
          <div class="tc"><span>HH</span><input type="number" id="jh-${k}" min="0" max="9" placeholder="0"></div>
          <div class="tsep">:</div>
          <div class="tc"><span>MM</span><input type="number" id="jm-${k}" min="0" max="59" placeholder="00"></div>
          <div class="tsep">:</div>
          <div class="tc"><span>SS</span><input type="number" id="js-${k}" min="0" max="59" placeholder="00"></div>
        </div>
      </div>
    </div>`
  }).join('')
}

// ── Build Spécialiste ──────────────────────────────────────────────────────
function buildSpec() {
  const icons = { 'Natation': '🏊', 'Vélo': '🚴', 'Course à pied': '🏃' }
  $('spec-list').innerHTML = DISCIPLINES.map(d => `
    <div class="mkt-hd">${icons[d]} ${d}</div>
    <div class="card card-body">
      <label class="mkt-label">Qui sera le plus rapide ?</label>
      <select id="sp-${d.replace(/\s/g, '')}" class="mkt-select">${opts(ALL_ATHLETES)}</select>
    </div>`).join('')
}

// ── Build Transitions, Tiercé, Premier ────────────────────────────────────
function buildOthers() {
  ;['T1', 'T2'].forEach(t => { const s = $(`tr-${t}`); if (s) s.innerHTML = opts(ALL_ATHLETES) })
  ;['tc1', 'tc2', 'tc3'].forEach(id => { const s = $(id); if (s) s.innerHTML = opts(ALL_ATHLETES) })
  const ph = $('ph'); if (ph) ph.innerHTML = opts(HOMMES)
  const pf = $('pf'); if (pf) pf.innerHTML = opts(FEMMES)
}

// ── Submit handlers ────────────────────────────────────────────────────────
$('btn-jp')?.addEventListener('click', async () => {
  const user = getBettor('bettor'); if (!user) return
  let n = 0
  const errors = []
  for (const name of ALL_ATHLETES) {
    const k = name.replace(/\s/g, '')
    const s = toSec($(`jh-${k}`)?.value, $(`jm-${k}`)?.value, $(`js-${k}`)?.value)
    if (s > 0) {
      try {
        await saveBet({ user_name: user, category: 'juste_prix', target: name, value: String(s), created_at: new Date().toISOString() })
        n++
      } catch (e) { errors.push(name) }
    }
  }
  if (errors.length) toast(`Erreur sur: ${errors.join(', ')}`, 'err')
  else if (n > 0) toast(`✓ ${n} estimation${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''} !`)
  else toast('Aucune durée saisie', 'warn')
})

$('btn-spec')?.addEventListener('click', async () => {
  const user = getBettor('bettor-spec'); if (!user) return
  let ok = 0
  for (const d of DISCIPLINES) {
    const v = $(`sp-${d.replace(/\s/g, '')}`)?.value
    if (v) {
      try { await saveBet({ user_name: user, category: 'specialiste', target: d, value: v, created_at: new Date().toISOString() }); ok++ }
      catch (e) { toast('Erreur de sauvegarde', 'err'); return }
    }
  }
  if (ok) toast('✓ Spécialiste enregistré !')
})

$('btn-trans')?.addEventListener('click', async () => {
  const user = getBettor('bettor-trans'); if (!user) return
  let ok = 0
  for (const t of TRANSITIONS) {
    const v = $(`tr-${t}`)?.value
    if (v) {
      try { await saveBet({ user_name: user, category: 'transition', target: t, value: v, created_at: new Date().toISOString() }); ok++ }
      catch (e) { toast('Erreur de sauvegarde', 'err'); return }
    }
  }
  if (ok) toast('✓ Transitions enregistrées !')
})

$('btn-tierce')?.addEventListener('click', async () => {
  const user = getBettor('bettor-tierce'); if (!user) return
  const v = [$('tc1')?.value, $('tc2')?.value, $('tc3')?.value]
  if (v.some(x => !x)) { toast('Choisis les 3 !', 'warn'); return }
  if (new Set(v).size < 3) { toast('Pas le même deux fois !', 'warn'); return }
  try {
    await saveBet({ user_name: user, category: 'tierce', target: 'podium', value: v.join(','), created_at: new Date().toISOString() })
    toast('✓ Tiercé enregistré !')
  } catch (e) { toast('Erreur de sauvegarde', 'err') }
})

$('btn-prem')?.addEventListener('click', async () => {
  const user = getBettor('bettor-prem'); if (!user) return
  const h = $('ph')?.value, f = $('pf')?.value
  try {
    if (h) await saveBet({ user_name: user, category: 'premier_homme', target: 'homme', value: h, created_at: new Date().toISOString() })
    if (f) await saveBet({ user_name: user, category: 'premier_femme', target: 'femme', value: f, created_at: new Date().toISOString() })
    if (h || f) toast('✓ Paris enregistrés !')
  } catch (e) { toast('Erreur de sauvegarde', 'err') }
})

// ── Init ───────────────────────────────────────────────────────────────────
buildJP()
buildSpec()
buildOthers()
