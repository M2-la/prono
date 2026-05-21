// src/pages/admin.js
import { supabase, getResults, upsertResult, getAllBets, ALL_ATHLETES, HOMMES, FEMMES, parseTime, formatTime } from '../lib/supabase.js'

const $ = id => document.getElementById(id)

function toast(msg, type = 'ok') {
  const el = $('toast')
  el.textContent = msg
  el.style.background = type === 'warn' ? '#f5a623' : type === 'err' ? '#f03e3e' : '#b5f23d'
  el.style.color = type === 'ok' ? '#0d1117' : '#fff'
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2500)
}

function setStatus(state, text, count = '') {
  const dot = $('status-dot')
  dot.className = 'status-dot ' + state
  $('status-text').textContent = text
  $('status-count').textContent = count
}

// ── Build admin form ───────────────────────────────────────────────────────
function buildForm(existingResults = {}) {
  $('athletes-list').innerHTML = ALL_ATHLETES.map(name => {
    const k = name.replace(/\s/g, '')
    const g = FEMMES.includes(name) ? '👩' : '👨'
    const cat = FEMMES.includes(name) ? 'Femmes' : 'Hommes'
    const r = existingResults[name] || {}

    const fields = [
      { key: 'natation', label: 'NAT', placeholder: 'MM:SS' },
      { key: 't1',       label: 'T1',  placeholder: 'MM:SS' },
      { key: 'velo',     label: 'VÉLO', placeholder: 'HH:MM:SS' },
      { key: 't2',       label: 'T2',  placeholder: 'MM:SS' },
      { key: 'course',   label: 'COURSE', placeholder: 'HH:MM:SS' },
    ]

    return `<div class="athlete-block">
      <div class="athlete-block-header">
        <span class="ath-gender">${g}</span>
        <span class="ath-n">${name}</span>
        <span class="ath-cat-badge">${cat}</span>
        <span id="total-${k}" class="total-preview${r.natation ? ' has-value' : ''}">
          ${previewTotal(r)}
        </span>
      </div>
      <div class="time-grid">
        ${fields.map(f => `
          <div class="time-field">
            <label>${f.label}</label>
            <input type="text" 
              id="f-${k}-${f.key}" 
              placeholder="${f.placeholder}" 
              value="${r[f.key] || ''}"
              data-athlete="${name}"
              data-key="${f.key}"
              class="${r[f.key] ? 'saved' : ''}"
            >
          </div>`).join('')}
      </div>
    </div>`
  }).join('')

  // Live total preview
  document.querySelectorAll('.time-grid input').forEach(input => {
    input.addEventListener('input', () => updatePreview(input.dataset.athlete))
  })
}

function previewTotal(r) {
  if (!r || !r.natation) return '–'
  const sum = parseTime(r.natation) + parseTime(r.t1) + parseTime(r.velo) + parseTime(r.t2) + parseTime(r.course)
  return sum > 0 ? formatTime(sum) : '–'
}

function updatePreview(name) {
  const k = name.replace(/\s/g, '')
  const r = {
    natation: $(`f-${k}-natation`)?.value,
    t1: $(`f-${k}-t1`)?.value,
    velo: $(`f-${k}-velo`)?.value,
    t2: $(`f-${k}-t2`)?.value,
    course: $(`f-${k}-course`)?.value,
  }
  const el = $(`total-${k}`)
  if (el) {
    const preview = previewTotal(r)
    el.textContent = preview
    el.className = `total-preview${preview !== '–' ? ' has-value' : ''}`
  }
}

// ── Load existing results ──────────────────────────────────────────────────
async function loadData() {
  setStatus('warn', 'Chargement…', '')
  try {
    const [results, bets] = await Promise.all([getResults(), getAllBets()])
    const resultMap = {}
    results.forEach(r => { resultMap[r.athlete] = r })
    buildForm(resultMap)
    setStatus('ok', 'Connecté à la base', `${bets.length} pari${bets.length > 1 ? 's' : ''}`)
  } catch (e) {
    setStatus('off', 'Erreur de connexion', '')
    toast('Impossible de charger les données', 'err')
    buildForm({})
  }
}

// ── Save ───────────────────────────────────────────────────────────────────
$('btn-save')?.addEventListener('click', async () => {
  const btn = $('btn-save')
  btn.disabled = true
  btn.textContent = 'Sauvegarde…'

  let saved = 0, errors = 0

  for (const name of ALL_ATHLETES) {
    const k = name.replace(/\s/g, '')
    const row = {
      athlete: name,
      natation: $(`f-${k}-natation`)?.value?.trim() || null,
      t1: $(`f-${k}-t1`)?.value?.trim() || null,
      velo: $(`f-${k}-velo`)?.value?.trim() || null,
      t2: $(`f-${k}-t2`)?.value?.trim() || null,
      course: $(`f-${k}-course`)?.value?.trim() || null,
    }
    // Only save if at least one field filled
    const hasData = Object.values(row).slice(1).some(v => v)
    if (hasData) {
      try {
        await upsertResult(row)
        // Mark fields as saved
        ;['natation', 't1', 'velo', 't2', 'course'].forEach(key => {
          const input = $(`f-${k}-${key}`)
          if (input) input.className = input.value ? 'saved' : ''
        })
        saved++
      } catch (e) {
        console.error('Error saving', name, e)
        errors++
      }
    }
  }

  btn.disabled = false
  btn.innerHTML = '<i class="ti ti-device-floppy" style="font-size:15px;vertical-align:-2px;margin-right:6px"></i>Sauvegarder tous les temps'

  if (errors > 0) toast(`${errors} erreur(s) lors de la sauvegarde`, 'err')
  else if (saved > 0) toast(`✓ ${saved} athlète${saved > 1 ? 's' : ''} sauvegardé${saved > 1 ? 's' : ''} !`)
  else toast('Aucune donnée à sauvegarder', 'warn')
})

$('btn-recalc')?.addEventListener('click', () => loadData())

// ── Real-time ──────────────────────────────────────────────────────────────
supabase
  .channel('admin-live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, async () => {
    const bets = await getAllBets()
    setStatus('ok', 'Connecté', `${bets.length} pari${bets.length > 1 ? 's' : ''}`)
  })
  .subscribe()

// ── Init ───────────────────────────────────────────────────────────────────
loadData()
