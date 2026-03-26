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
