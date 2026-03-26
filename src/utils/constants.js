export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  PENDING: '/pending',
  MY_BETS: '/my-bets',
  LEADERBOARD: '/leaderboard',
  STATS: '/stats',
  LIVE: '/live',
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_TOURNAMENT: '/admin/tournament',
  ADMIN_BETS: '/admin/bets',
  ADMIN_PRIZES: '/admin/prizes',
  ADMIN_STATUS: '/admin/status',
}

export const USER_STATUS = {
  PENDING_AGE: 'pending_age',
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  REJECTED_UNDERAGE: 'rejected_underage',
}

export const USER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
  PENDING: 'pending',
  NONE: 'none',
}

export const TOURNAMENT_STATUS = {
  SETUP: 'setup',
  ACTIVE: 'active',
  FINISHED: 'finished',
}

export const BET_RESULT = {
  DIRECTION_ONLY: 'direction_only',       // 3 pts
  DIRECTION_AND_DIFF: 'direction_and_diff', // 5 pts
  EXACT: 'exact',                          // 7 pts
  WRONG: 'wrong',                          // 0 pts
}

export const MIN_AGE = 12
export const MIN_BIRTH_YEAR = 1940
export const MAX_BIRTH_YEAR = new Date().getFullYear()

// Points for match bets
export const POINTS = {
  DIRECTION_ONLY: 3,
  DIRECTION_AND_DIFF: 5,
  EXACT: 7,
}

// Points for static bets
export const STATIC_POINTS = {
  CHAMPION_EXACT: 50,
  CHAMPION_FINALIST: 20,
  SECOND_EXACT: 35,
  SECOND_SEMI: 15,
  THIRD_EXACT: 25,
  THIRD_QUARTER: 10,
  FOURTH_EXACT: 25,
  FOURTH_QUARTER: 10,
  TOP_SCORER_EXACT: 40,
  TOP_SCORER_NEAR: 15,    // ±2 goals
  YELLOW_CARDS_EXACT: 20,
  YELLOW_CARDS_NEAR: 8,   // ±10
  RED_CARDS_EXACT: 20,
  RED_CARDS_NEAR: 8,      // ±3
}
