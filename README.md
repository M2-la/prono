# 🏁 Pronostics Chrono

App de pronostics triathlon entre collègues — multi-page, temps réel, déployée sur Vercel.

## Pages

| URL | Rôle |
|-----|------|
| `/` | Saisie des paris (collègues) |
| `/results` | Classement + résultats animés |
| `/admin` | Saisie des chronos officiels (toi) |

## Stack

- **Vite** — bundler, multi-page
- **Supabase** — base de données + temps réel (WebSocket)
- **Vercel** — hébergement

## Setup

### 1. Supabase

1. Crée un compte sur [supabase.com](https://supabase.com)
2. Nouveau projet → note l'URL et la clé `anon`
3. SQL Editor → colle le contenu de `schema.sql` → Run

### 2. Variables d'environnement

```bash
cp .env.example .env
# Édite .env avec tes vraies valeurs
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3. Dev local

```bash
npm install
npm run dev
# → http://localhost:5173
# → http://localhost:5173/admin.html
# → http://localhost:5173/results.html
```

### 4. Deploy Vercel

```bash
# Installe Vercel CLI
npm i -g vercel

# Depuis le dossier du projet
vercel

# Ajoute les env vars dans le dashboard Vercel :
# Settings → Environment Variables
# VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
```

Ou : connecte ton repo GitHub dans [vercel.com](https://vercel.com) → import → deploy automatique.

## Logique de scoring

| Catégorie | Points |
|-----------|--------|
| Juste Prix — plus proche | 3 pts |
| Juste Prix — 2e plus proche | 2 pts |
| Juste Prix — 3e plus proche | 1 pt |
| Spécialiste (bonne discipline) | 3 pts |
| Transition T1 ou T2 (bon athlète) | 2 pts |
| Tiercé ordre exact | 3 pts |
| Tiercé bons noms désordre | 1 pt |
| Premier homme ✓ | 2 pts |
| Première femme ✓ | 2 pts |

## Workflow le jour J

1. Les collègues remplissent leurs paris sur `/`
2. Après la course, tu vas sur `/admin` et tu entres les vrais chronos
3. Clique "Sauvegarder" → la page `/results` se met à jour **en temps réel** pour tout le monde
