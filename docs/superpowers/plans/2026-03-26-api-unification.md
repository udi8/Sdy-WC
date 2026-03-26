# API Unification & ESPN One-Click Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect all API identifiers (TheSportsDB, ESPN, football-data.org) into a single unified mapping in `leagues.js`, and wire the ESPN import to the POPULAR_LEAGUES rows in the admin UI so admins can import any league with one click.

**Architecture:** Add `fdCode` field to each entry in `POPULAR_LEAGUES`; create a `seasonToEndDate()` utility that derives the season end date from a season string; update `LeagueRow` in `AdminTournamentPage.jsx` to show an ESPN button (when `espnId` exists) that uses `fromDate` as start date and `seasonToEndDate(season)` as end date.

**Tech Stack:** React + Vite, Firebase Firestore, ESPN public API (no key), football-data.org (Cloudflare Worker), TheSportsDB (no key).

---

## File Map

| File | Change |
|------|--------|
| `src/data/leagues.js` | Add `fdCode` field to each league entry |
| `src/utils/season.js` | New file — `seasonToEndDate(season)` helper |
| `src/pages/AdminTournamentPage.jsx` | Add ESPN button in `LeagueRow`, import `seasonToEndDate`, add ESPN-per-row state |

---

## Task 1: Add `fdCode` to the unified leagues mapping

**Files:**
- Modify: `src/data/leagues.js`

This adds `fdCode` (football-data.org competition code) to each league entry that has one.
Leagues without a football-data.org equivalent get no `fdCode` field (omit it, don't set to null).

football-data.org free-tier codes (verified): `WC`, `CL`, `EL`, `EC`, `PL`, `ELC`, `BL1`, `SA`, `FL1`, `PD`, `DED`, `PPL`, `CLI`, `BSA`

- [ ] **Step 1: Update `src/data/leagues.js`**

Replace the entire file with the updated version below. Every row now has all three API identifiers inline — easy to read, easy to extend.

```js
// Unified cross-API league/competition mapping
// id          = TheSportsDB league ID
// espnSport   = ESPN sport slug  (e.g. 'soccer')
// espnId      = ESPN league slug (e.g. 'eng.1')
// fdCode      = football-data.org competition code (e.g. 'PL')
// defaultSeason = used for single-year tournaments; club leagues omit this
export const POPULAR_LEAGUES = [
  // ─── International ───────────────────────────────────
  { id: '4429', name: 'FIFA World Cup',               country: 'International', sport: 'Soccer', defaultSeason: '2026',  espnSport: 'soccer', espnId: 'fifa.world',         fdCode: 'WC'  },
  { id: '4480', name: 'UEFA Champions League',        country: 'Europe',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'uefa.champions',     fdCode: 'CL'  },
  { id: '4481', name: 'UEFA Europa League',           country: 'Europe',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'uefa.europa',        fdCode: 'EL'  },
  { id: '4882', name: 'UEFA Conference League',       country: 'Europe',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'uefa.europa.conf'                  },
  { id: '4421', name: 'UEFA European Championship',   country: 'Europe',        sport: 'Soccer', defaultSeason: '2028',  espnSport: 'soccer', espnId: 'uefa.euro',          fdCode: 'EC'  },
  { id: '4422', name: 'Copa América',                 country: 'South America', sport: 'Soccer', defaultSeason: '2028',  espnSport: 'soccer', espnId: 'conmebol.america'                  },
  { id: '4423', name: 'Africa Cup of Nations',        country: 'Africa',        sport: 'Soccer', defaultSeason: '2027'                                                                      },
  { id: '4415', name: 'Copa Libertadores',            country: 'South America', sport: 'Soccer', defaultSeason: '2026',  espnSport: 'soccer', espnId: 'conmebol.libertadores', fdCode: 'CLI' },
  // ─── Israel ──────────────────────────────────────────
  { id: '4355', name: 'Israeli Premier League',       country: 'Israel',        sport: 'Soccer', altName: 'ליגת העל',   espnSport: 'soccer', espnId: 'isr.1'                             },
  { id: '4356', name: 'Israeli National League',      country: 'Israel',        sport: 'Soccer', altName: 'ליגה לאומית'                                                                    },
  // ─── England ─────────────────────────────────────────
  { id: '4328', name: 'English Premier League',       country: 'England',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'eng.1',              fdCode: 'PL'  },
  { id: '4329', name: 'English Championship',         country: 'England',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'eng.2',              fdCode: 'ELC' },
  // ─── Top 5 European Leagues ──────────────────────────
  { id: '4335', name: 'Spanish La Liga',              country: 'Spain',         sport: 'Soccer',                          espnSport: 'soccer', espnId: 'esp.1',              fdCode: 'PD'  },
  { id: '4331', name: 'German Bundesliga',            country: 'Germany',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'ger.1',              fdCode: 'BL1' },
  { id: '4332', name: 'Italian Serie A',              country: 'Italy',         sport: 'Soccer',                          espnSport: 'soccer', espnId: 'ita.1',              fdCode: 'SA'  },
  { id: '4334', name: 'French Ligue 1',               country: 'France',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'fra.1',              fdCode: 'FL1' },
  // ─── Other European ──────────────────────────────────
  { id: '4339', name: 'Dutch Eredivisie',             country: 'Netherlands',   sport: 'Soccer',                          espnSport: 'soccer', espnId: 'ned.1',              fdCode: 'DED' },
  { id: '4337', name: 'Portuguese Primeira Liga',     country: 'Portugal',      sport: 'Soccer',                          espnSport: 'soccer', espnId: 'por.1',              fdCode: 'PPL' },
  { id: '4338', name: 'Turkish Süper Lig',            country: 'Turkey',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'tur.1'                             },
  { id: '4340', name: 'Belgian First Division A',     country: 'Belgium',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'bel.1'                             },
  { id: '4330', name: 'Scottish Premiership',         country: 'Scotland',      sport: 'Soccer',                          espnSport: 'soccer', espnId: 'sco.1'                             },
  { id: '4336', name: 'Greek Super League',           country: 'Greece',        sport: 'Soccer'                                                                                            },
  { id: '4344', name: 'Norwegian Tippeligaen',        country: 'Norway',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'nor.1'                             },
  { id: '4346', name: 'Swedish Allsvenskan',          country: 'Sweden',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'swe.1'                             },
  { id: '4347', name: 'Danish Superliga',             country: 'Denmark',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'den.1'                             },
  { id: '4351', name: 'Russian Premier League',       country: 'Russia',        sport: 'Soccer'                                                                                            },
  { id: '4354', name: 'Austrian Bundesliga',          country: 'Austria',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'aut.1'                             },
  { id: '4357', name: 'Swiss Super League',           country: 'Switzerland',   sport: 'Soccer',                          espnSport: 'soccer', espnId: 'sui.1'                             },
  { id: '4361', name: 'Polish Ekstraklasa',           country: 'Poland',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'pol.1'                             },
  { id: '4362', name: 'Ukrainian Premier League',     country: 'Ukraine',       sport: 'Soccer'                                                                                            },
  // ─── Americas ────────────────────────────────────────
  { id: '4367', name: 'MLS',                          country: 'USA',           sport: 'Soccer',                          espnSport: 'soccer', espnId: 'usa.1'                             },
  { id: '4368', name: 'Brazilian Série A',            country: 'Brazil',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'bra.1',              fdCode: 'BSA' },
  { id: '4370', name: 'Argentine Primera División',   country: 'Argentina',     sport: 'Soccer',                          espnSport: 'soccer', espnId: 'arg.1'                             },
  // ─── Asia / Pacific ──────────────────────────────────
  { id: '4374', name: 'J1 League',                    country: 'Japan',         sport: 'Soccer',                          espnSport: 'soccer', espnId: 'jpn.1'                             },
  { id: '4375', name: 'K League 1',                   country: 'South Korea',   sport: 'Soccer',                          espnSport: 'soccer', espnId: 'kor.1'                             },
  { id: '4379', name: 'Australian A-League',          country: 'Australia',     sport: 'Soccer',                          espnSport: 'soccer', espnId: 'aus.1'                             },
  { id: '4387', name: 'Chinese Super League',         country: 'China',         sport: 'Soccer',                          espnSport: 'soccer', espnId: 'chn.1'                             },
  { id: '4391', name: 'Saudi Pro League',             country: 'Saudi Arabia',  sport: 'Soccer',                          espnSport: 'soccer', espnId: 'ksa.1'                             },
  // ─── Africa ──────────────────────────────────────────
  { id: '4399', name: 'South African PSL',            country: 'South Africa',  sport: 'Soccer'                                                                                            },
  { id: '4403', name: 'Egyptian Premier League',      country: 'Egypt',         sport: 'Soccer'                                                                                            },
]
```

- [ ] **Step 2: Verify the file saved correctly**

Open `src/data/leagues.js` in the editor and confirm:
- Every row with a football-data.org equivalent has `fdCode`
- Rows without one have no `fdCode` property (not `fdCode: null`)
- No existing `espnSport`/`espnId` fields were accidentally removed

- [ ] **Step 3: Commit**

```bash
cd /c/Users/212515434/SDY-WC/Sdy-WC
git add src/data/leagues.js
git commit -m "feat: add fdCode to POPULAR_LEAGUES — unified cross-API mapping"
```

---

## Task 2: Season-to-end-date utility

**Files:**
- Create: `src/utils/season.js`

Converts a season string to a season-end ISO date. Used by the ESPN import button to auto-calculate the end date without admin input.

Rules:
- `"2024-2025"` → `"2025-07-31"` (July 31 of the second year — standard European season end)
- `"2025-2026"` → `"2026-07-31"`
- `"2026"` → `"2026-12-31"` (single-year tournaments end December 31)
- `"2025"` → `"2025-12-31"`

- [ ] **Step 1: Create `src/utils/season.js`**

```js
/**
 * Derive the season end date from a season string.
 *
 * "2024-2025" → "2025-07-31"  (European club season ends in July)
 * "2026"      → "2026-12-31"  (single-year tournament ends in December)
 *
 * @param {string} season
 * @returns {string} ISO date "YYYY-MM-DD"
 */
export const seasonToEndDate = (season) => {
  if (!season) return ''
  const parts = season.trim().split('-')
  if (parts.length === 2 && parts[0].length === 4 && parts[1].length === 4) {
    // "YYYY-YYYY" format — European club season
    return `${parts[1]}-07-31`
  }
  // Single year — tournament or calendar-year league
  return `${parts[0]}-12-31`
}
```

- [ ] **Step 2: Manually verify in browser console**

In the browser DevTools console (or a quick Node/Vite REPL), import and test:

```js
import { seasonToEndDate } from './src/utils/season.js'
console.log(seasonToEndDate('2024-2025'))  // "2025-07-31"
console.log(seasonToEndDate('2026'))        // "2026-12-31"
console.log(seasonToEndDate('2025-2026'))  // "2026-07-31"
console.log(seasonToEndDate(''))           // ""
```

Expected: all four lines match the comments above.

- [ ] **Step 3: Commit**

```bash
git add src/utils/season.js
git commit -m "feat: add seasonToEndDate utility for ESPN date auto-calculation"
```

---

## Task 3: Wire ESPN one-click import to POPULAR_LEAGUES rows

**Files:**
- Modify: `src/pages/AdminTournamentPage.jsx`

The `LeagueRow` component currently shows only a TheSportsDB import button. We add a second "ESPN" button that appears only when the league has `espnId`. When clicked:
1. Uses the existing `fromDate` input as the ESPN start date
2. Auto-calculates end date via `seasonToEndDate(season)`
3. Calls the already-implemented `importFromESPN(sport, league, startDate, endDate)`

**Important design notes:**
- `fromDate` is required for ESPN — show an error toast if empty
- Keep the TheSportsDB button as fallback for leagues without `espnId` or when admin prefers it
- Reuse the existing `importingId` state — ESPN import sets `importingId` to `league.id` so both buttons disable together
- Use a separate `espnImportingId` state to distinguish which button shows the spinner

- [ ] **Step 1: Add import for `seasonToEndDate` at the top of `AdminTournamentPage.jsx`**

Find line 6 (the tournaments.js import) and add after the existing imports:

```js
import { seasonToEndDate } from '../utils/season'
```

Add this after line 8 (`import './AdminTournamentPage.css'`):

```js
import { seasonToEndDate } from '../utils/season'
```

- [ ] **Step 2: Add `espnImportingId` state**

After line 35 (`const [espnImporting, setEspnImporting] = useState(false)`), add:

```js
const [espnImportingId, setEspnImportingId] = useState(null)
```

- [ ] **Step 3: Add `handleESPNImportForLeague` handler**

Add this handler after `handleImport` (after line 124). This is the per-row ESPN handler — distinct from `handleESPNImport` (the manual form handler which stays unchanged):

```js
const handleESPNImportForLeague = async (league) => {
  const season   = getSeason(league.id)
  const fromDate = getFromDate(league.id).trim()
  const endDate  = seasonToEndDate(season)

  if (!fromDate) { toast.error('יש להזין תאריך התחלה לייבוא ESPN'); return }
  if (!endDate)  { toast.error('יש להזין עונה'); return }
  if (!window.confirm(`לייבא "${league.name}" עונת ${season} מ-ESPN (${fromDate} → ${endDate})?`)) return

  setEspnImportingId(league.id)
  setImportingId(league.id)
  setImportProgress(`מייבא "${league.name}" מ-ESPN...`)
  try {
    const result = await importFromESPN(
      league.espnSport,
      league.espnId,
      fromDate,
      endDate,
    )
    setImportProgress('')
    toast.success(`✅ "${result.name}" יובא מ-ESPN (${result.matchCount} משחקים, ${result.playerCount} שחקנים)`)
  } catch (err) {
    console.error(err)
    toast.error('שגיאה בייבוא ESPN: ' + err.message)
    setImportProgress('')
  } finally {
    setEspnImportingId(null)
    setImportingId(null)
  }
}
```

- [ ] **Step 4: Update `LeagueRow` to show the ESPN button**

Replace the entire `LeagueRow` component (lines 209–246) with:

```jsx
const LeagueRow = ({ league }) => (
  <li className="competition-item">
    <div className="competition-info">
      {league.badge && <img src={league.badge} alt="" className="competition-emblem" />}
      <div>
        <strong>{league.name}{league.altName ? ` / ${league.altName}` : ''}</strong>
        <span className="text-muted competition-meta">
          {[league.country, league.sport !== 'Soccer' ? league.sport : null].filter(Boolean).join(' · ')}
          {league.espnId  && <span className="badge badge-muted" style={{ marginRight: '0.4rem' }}>ESPN</span>}
          {league.fdCode  && <span className="badge badge-muted" style={{ marginRight: '0.4rem' }}>FD:{league.fdCode}</span>}
        </span>
      </div>
    </div>
    <div className="competition-actions">
      <input
        type="text"
        className="form-control season-input"
        value={getSeason(league.id)}
        onChange={(e) => setSeason(league.id, e.target.value)}
        placeholder="עונה"
        disabled={!!importingId}
      />
      <input
        type="date"
        className="form-control season-input"
        value={getFromDate(league.id)}
        onChange={(e) => setFromDate(league.id, e.target.value)}
        title="תאריך התחלה — גם משמש כתאריך התחלה לייבוא ESPN"
        disabled={!!importingId}
      />
      {league.espnId ? (
        <button
          className="btn btn-primary"
          onClick={() => handleESPNImportForLeague(league)}
          disabled={!!importingId}
          title="ייבא מ-ESPN (מומלץ)"
        >
          {espnImportingId === league.id ? '⏳' : '⬇️ ESPN'}
        </button>
      ) : (
        <button
          className="btn btn-primary"
          onClick={() => handleImport(league)}
          disabled={!!importingId}
        >
          {importingId === league.id ? '⏳' : '⬇️ ייבא'}
        </button>
      )}
    </div>
  </li>
)
```

- [ ] **Step 5: Manual smoke test**

1. Run `npm run dev` in the terminal
2. Open the app in browser → go to Admin → Tournament page
3. Find "Israeli Premier League" in the list — it should show `ESPN` badge and `FD` badge in the meta
4. Set season to `"2024-2025"` and fromDate to `"2024-08-01"`
5. Click "⬇️ ESPN" — confirm dialog should say `2024-08-01 → 2025-07-31`
6. Click OK — import should run and succeed with a toast showing match/player count
7. Check Firestore emulator or console for `tournaments/espn_soccer_isr.1_2024`

For a league **without** `espnId` (e.g. "Greek Super League"):
- Should show the TheSportsDB "⬇️ ייבא" button instead

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminTournamentPage.jsx
git commit -m "feat: add ESPN one-click import button to POPULAR_LEAGUES rows"
```

---

## Final Integration Check

- [ ] Run `npm run build` — should compile with no errors
- [ ] Verify the manual ESPN form section still works (it's independent — untouched)
- [ ] Verify the football-data.org import section still works (untouched)
- [ ] Commit and push to trigger CI/CD deployment

```bash
git push origin main
```
