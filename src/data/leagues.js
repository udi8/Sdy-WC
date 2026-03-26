// Popular leagues/competitions with their TheSportsDB IDs
// Optional espnSport + espnId fields enable one-click ESPN import (no API key needed)
export const POPULAR_LEAGUES = [
  // ─── International ───────────────────────────────────
  // single-year tournaments use defaultSeason (e.g. "2026"), club leagues use "YYYY-YYYY"
  { id: '4429', name: 'FIFA World Cup',               country: 'International', sport: 'Soccer', defaultSeason: '2026',  espnSport: 'soccer', espnId: 'fifa.world' },
  { id: '4480', name: 'UEFA Champions League',        country: 'Europe',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'uefa.champions' },
  { id: '4481', name: 'UEFA Europa League',           country: 'Europe',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'uefa.europa' },
  { id: '4882', name: 'UEFA Conference League',       country: 'Europe',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'uefa.europa.conf' },
  { id: '4421', name: 'UEFA European Championship',   country: 'Europe',        sport: 'Soccer', defaultSeason: '2028',  espnSport: 'soccer', espnId: 'uefa.euro' },
  { id: '4422', name: 'Copa América',                 country: 'South America', sport: 'Soccer', defaultSeason: '2028',  espnSport: 'soccer', espnId: 'conmebol.america' },
  { id: '4423', name: 'Africa Cup of Nations',        country: 'Africa',        sport: 'Soccer', defaultSeason: '2027' },
  { id: '4415', name: 'Copa Libertadores',            country: 'South America', sport: 'Soccer', defaultSeason: '2026',  espnSport: 'soccer', espnId: 'conmebol.libertadores' },
  // ─── Israel ──────────────────────────────────────────
  { id: '4355', name: 'Israeli Premier League',       country: 'Israel',        sport: 'Soccer', altName: 'ליגת העל',   espnSport: 'soccer', espnId: 'isr.1' },
  { id: '4356', name: 'Israeli National League',      country: 'Israel',        sport: 'Soccer', altName: 'ליגה לאומית' },
  // ─── England ─────────────────────────────────────────
  { id: '4328', name: 'English Premier League',       country: 'England',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'eng.1' },
  { id: '4329', name: 'English Championship',         country: 'England',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'eng.2' },
  // ─── Top 5 European Leagues ──────────────────────────
  { id: '4335', name: 'Spanish La Liga',              country: 'Spain',         sport: 'Soccer',                          espnSport: 'soccer', espnId: 'esp.1' },
  { id: '4331', name: 'German Bundesliga',            country: 'Germany',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'ger.1' },
  { id: '4332', name: 'Italian Serie A',              country: 'Italy',         sport: 'Soccer',                          espnSport: 'soccer', espnId: 'ita.1' },
  { id: '4334', name: 'French Ligue 1',               country: 'France',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'fra.1' },
  // ─── Other European ──────────────────────────────────
  { id: '4339', name: 'Dutch Eredivisie',             country: 'Netherlands',   sport: 'Soccer',                          espnSport: 'soccer', espnId: 'ned.1' },
  { id: '4337', name: 'Portuguese Primeira Liga',     country: 'Portugal',      sport: 'Soccer',                          espnSport: 'soccer', espnId: 'por.1' },
  { id: '4338', name: 'Turkish Süper Lig',            country: 'Turkey',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'tur.1' },
  { id: '4340', name: 'Belgian First Division A',     country: 'Belgium',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'bel.1' },
  { id: '4330', name: 'Scottish Premiership',         country: 'Scotland',      sport: 'Soccer',                          espnSport: 'soccer', espnId: 'sco.1' },
  { id: '4336', name: 'Greek Super League',           country: 'Greece',        sport: 'Soccer' },
  { id: '4344', name: 'Norwegian Tippeligaen',        country: 'Norway',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'nor.1' },
  { id: '4346', name: 'Swedish Allsvenskan',          country: 'Sweden',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'swe.1' },
  { id: '4347', name: 'Danish Superliga',             country: 'Denmark',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'den.1' },
  { id: '4351', name: 'Russian Premier League',       country: 'Russia',        sport: 'Soccer' },
  { id: '4354', name: 'Austrian Bundesliga',          country: 'Austria',       sport: 'Soccer',                          espnSport: 'soccer', espnId: 'aut.1' },
  { id: '4357', name: 'Swiss Super League',           country: 'Switzerland',   sport: 'Soccer',                          espnSport: 'soccer', espnId: 'sui.1' },
  { id: '4361', name: 'Polish Ekstraklasa',           country: 'Poland',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'pol.1' },
  { id: '4362', name: 'Ukrainian Premier League',     country: 'Ukraine',       sport: 'Soccer' },
  // ─── Americas ────────────────────────────────────────
  { id: '4367', name: 'MLS',                          country: 'USA',           sport: 'Soccer',                          espnSport: 'soccer', espnId: 'usa.1' },
  { id: '4368', name: 'Brazilian Série A',            country: 'Brazil',        sport: 'Soccer',                          espnSport: 'soccer', espnId: 'bra.1' },
  { id: '4370', name: 'Argentine Primera División',   country: 'Argentina',     sport: 'Soccer',                          espnSport: 'soccer', espnId: 'arg.1' },
  // ─── Asia / Pacific ──────────────────────────────────
  { id: '4374', name: 'J1 League',                    country: 'Japan',         sport: 'Soccer',                          espnSport: 'soccer', espnId: 'jpn.1' },
  { id: '4375', name: 'K League 1',                   country: 'South Korea',   sport: 'Soccer',                          espnSport: 'soccer', espnId: 'kor.1' },
  { id: '4379', name: 'Australian A-League',          country: 'Australia',     sport: 'Soccer',                          espnSport: 'soccer', espnId: 'aus.1' },
  { id: '4387', name: 'Chinese Super League',         country: 'China',         sport: 'Soccer',                          espnSport: 'soccer', espnId: 'chn.1' },
  { id: '4391', name: 'Saudi Pro League',             country: 'Saudi Arabia',  sport: 'Soccer',                          espnSport: 'soccer', espnId: 'ksa.1' },
  // ─── Africa ──────────────────────────────────────────
  { id: '4399', name: 'South African PSL',            country: 'South Africa',  sport: 'Soccer' },
  { id: '4403', name: 'Egyptian Premier League',      country: 'Egypt',         sport: 'Soccer' },
]
