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
    return `${parts[1]}-07-31`
  }
  return `${parts[0]}-12-31`
}

/**
 * Derive the season start date from a season string.
 *
 * "2024-2025" → "2024-07-01"  (European club season starts in July)
 * "2026"      → "2026-01-01"  (single-year tournament starts in January)
 *
 * @param {string} season
 * @returns {string} ISO date "YYYY-MM-DD"
 */
export const seasonToStartDate = (season) => {
  if (!season) return ''
  const parts = season.trim().split('-')
  if (parts.length === 2 && parts[0].length === 4 && parts[1].length === 4) {
    return `${parts[0]}-07-01`
  }
  return `${parts[0]}-01-01`
}
