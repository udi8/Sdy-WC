import { POINTS } from './constants'

/**
 * Calculate points for a single match bet.
 * @param {object} bet  { prediction: '1'|'X'|'2', score: '2:1' }
 * @param {object} result { outcome: '1'|'X'|'2', homeGoals: number, awayGoals: number }
 */
export const calcMatchPoints = (bet, result) => {
  if (!bet || !result) return 0

  const directionCorrect = bet.prediction === result.outcome

  if (!directionCorrect) return 0

  // Parse predicted score
  const [predHome, predAway] = (bet.score || '').split(':').map(Number)
  const { homeGoals, awayGoals } = result

  if (
    !isNaN(predHome) &&
    !isNaN(predAway) &&
    predHome === homeGoals &&
    predAway === awayGoals
  ) {
    return POINTS.EXACT
  }

  const predDiff = predHome - predAway
  const realDiff = homeGoals - awayGoals
  if (predDiff === realDiff) return POINTS.DIRECTION_AND_DIFF

  return POINTS.DIRECTION_ONLY
}

/**
 * Calculate points for static tournament bets.
 * @param {object} bets    User's static bets
 * @param {object} actuals Actual tournament results
 * @param {object} adminConfig  { favoritePlayerGoalPoints }
 */
export const calcStaticPoints = (bets, actuals, adminConfig) => {
  let total = 0

  // Champion
  if (bets.champion) {
    if (bets.champion === actuals.champion) total += 50
    else if (actuals.finalists?.includes(bets.champion)) total += 20
  }

  // Second place
  if (bets.second) {
    if (bets.second === actuals.second) total += 35
    else if (actuals.semis?.includes(bets.second)) total += 15
  }

  // Third place
  if (bets.third) {
    if (bets.third === actuals.third) total += 25
    else if (actuals.quarters?.includes(bets.third)) total += 10
  }

  // Fourth place
  if (bets.fourth) {
    if (bets.fourth === actuals.fourth) total += 25
    else if (actuals.quarters?.includes(bets.fourth)) total += 10
  }

  // Top scorer
  if (bets.topScorer && actuals.topScorer) {
    if (bets.topScorer === actuals.topScorer.playerId) {
      total += 40
    } else if (
      actuals.topScorer.goals !== undefined &&
      bets.topScorerGoals !== undefined &&
      Math.abs(bets.topScorerGoals - actuals.topScorer.goals) <= 2
    ) {
      total += 15
    }
  }

  // Yellow cards
  if (bets.yellowCards !== undefined && actuals.yellowCards !== undefined) {
    if (bets.yellowCards === actuals.yellowCards) total += 20
    else if (Math.abs(bets.yellowCards - actuals.yellowCards) <= 10) total += 8
  }

  // Red cards
  if (bets.redCards !== undefined && actuals.redCards !== undefined) {
    if (bets.redCards === actuals.redCards) total += 20
    else if (Math.abs(bets.redCards - actuals.redCards) <= 3) total += 8
  }

  return total
}
