/**
 * Utilitaires pour filtrer et organiser les ligues par zone géographique
 */

export interface Zone {
  id: string;
  name: string;
  countries: string[];
}

// Ligues majeures affichées par défaut
export const MAJOR_LEAGUE_IDS = new Set([
  // UEFA
  2,    // Champions League
  3,    // Europa League
  848,  // Conference League
  // Top 5 championnats
  61,   // Ligue 1
  39,   // Premier League
  140,  // La Liga
  78,   // Bundesliga
  135,  // Serie A
  // Championnats secondaires majeurs
  94,   // Primeira Liga (Portugal)
  88,   // Eredivisie (Pays-Bas)
  144,  // Jupiler Pro League (Belgique)
]);

// Zones géographiques
export const ZONES: Zone[] = [
  {
    id: 'international',
    name: 'International',
    countries: ['World'],
  },
  {
    id: 'europe',
    name: 'Europe',
    countries: [
      'England', 'Spain', 'France', 'Germany', 'Italy', 'Portugal',
      'Netherlands', 'Belgium', 'Scotland', 'Turkey', 'Russia',
      'Ukraine', 'Greece', 'Austria', 'Switzerland', 'Denmark',
      'Sweden', 'Norway', 'Poland', 'Czech-Republic', 'Croatia',
      'Serbia', 'Romania', 'Bulgaria', 'Hungary', 'Slovakia',
      'Finland', 'Wales', 'Northern-Ireland', 'Republic-of-Ireland',
      'Iceland', 'Albania', 'Bosnia', 'Slovenia', 'Cyprus',
      'Luxembourg', 'Estonia', 'Latvia', 'Lithuania', 'Malta',
      'Armenia', 'Azerbaijan', 'Belarus', 'Georgia', 'Kazakhstan',
      'Moldova', 'Montenegro', 'North-Macedonia',
    ],
  },
  {
    id: 'south-america',
    name: 'Amérique du Sud',
    countries: [
      'Brazil', 'Argentina', 'Uruguay', 'Chile', 'Colombia',
      'Ecuador', 'Paraguay', 'Peru', 'Venezuela', 'Bolivia',
    ],
  },
  {
    id: 'north-america',
    name: 'Amérique du Nord',
    countries: [
      'USA', 'Mexico', 'Canada', 'Costa-Rica', 'Jamaica',
      'Honduras', 'Panama', 'Trinidad-And-Tobago', 'El-Salvador',
      'Guatemala', 'Nicaragua',
    ],
  },
  {
    id: 'asia',
    name: 'Asie',
    countries: [
      'Japan', 'South-Korea', 'China', 'Saudi-Arabia', 'UAE',
      'Qatar', 'Iran', 'Iraq', 'Thailand', 'Vietnam',
      'India', 'Indonesia', 'Australia', 'Uzbekistan', 'Jordan',
    ],
  },
  {
    id: 'africa',
    name: 'Afrique',
    countries: [
      'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'South-Africa',
      'Nigeria', 'Ghana', 'Senegal', 'Ivory-Coast', 'Cameroon',
      'Kenya', 'Tanzania', 'Uganda', 'Zimbabwe', 'Zambia',
    ],
  },
];

export function getZoneForCountry(country: string | null): Zone | null {
  if (!country) return null;
  return ZONES.find(zone => zone.countries.includes(country)) || null;
}

export function getZoneName(country: string | null): string {
  const zone = getZoneForCountry(country);
  return zone ? zone.name : 'Autres';
}

export function isMajorLeague(leagueId: number): boolean {
  return MAJOR_LEAGUE_IDS.has(leagueId);
}
