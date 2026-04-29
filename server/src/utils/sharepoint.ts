import { Migration } from '../types/index.js';

// ISO 3166-1 alpha-2 mappings for common country names. Extend as needed.
const COUNTRY_ABBR: Record<string, string> = {
  'united states': 'US',
  'united states of america': 'US',
  'usa': 'US',
  'canada': 'CA',
  'mexico': 'MX',
  'germany': 'DE',
  'switzerland': 'CH',
  'france': 'FR',
  'italy': 'IT',
  'spain': 'ES',
  'netherlands': 'NL',
  'belgium': 'BE',
  'austria': 'AT',
  'united kingdom': 'GB',
  'uk': 'GB',
  'great britain': 'GB',
  'ireland': 'IE',
  'denmark': 'DK',
  'sweden': 'SE',
  'norway': 'NO',
  'finland': 'FI',
  'poland': 'PL',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'slovakia': 'SK',
  'hungary': 'HU',
  'romania': 'RO',
  'bulgaria': 'BG',
  'greece': 'GR',
  'portugal': 'PT',
  'turkey': 'TR',
  'russia': 'RU',
  'china': 'CN',
  'japan': 'JP',
  'south korea': 'KR',
  'india': 'IN',
  'australia': 'AU',
  'new zealand': 'NZ',
  'brazil': 'BR',
  'argentina': 'AR',
  'chile': 'CL',
  'south africa': 'ZA',
  'liechtenstein': 'LI',
  'luxembourg': 'LU',
};

function countryAbbr(country: string | null | undefined): string {
  if (!country) return '';
  return COUNTRY_ABBR[country.toLowerCase().trim()] || country;
}

function carrierDisplay(carrier: string | null | undefined): string {
  const map: Record<string, string> = {
    verizon: 'Verizon',
    fusionconnect: 'FusionConnect',
    gtt: 'GTT',
  };
  return map[(carrier || '').toLowerCase()] || carrier || '';
}

export interface SharePointPayload {
  Title: string;
  'Location VOIP Name': string;
  'Customer Site Address': string;
  'Customer Legal Entity': string;
  'Local Contact': string;
  'Correct Billing Address': string;
  'Billing Contact': string;
  BAN: string;
  'Location ID': string;
  'Enterprise ID': string;
  'Design ID': string;
  'Customer Status': string;
  VEC: string;
  'Location VOIP Name (Original)': string;
  'Voice Provider': string;
}

export function buildSharePointPayload(migration: Migration): SharePointPayload {
  const q = (migration.site_questionnaire || {}) as Record<string, unknown>;
  const requestorEmail = String(q.email || '');
  const isVerizon = (migration.target_carrier || '').toLowerCase() === 'verizon';
  const country = migration.site_country || '';
  const city = migration.site_city || '';
  const address = migration.site_address || '';

  return {
    Title: country,
    'Location VOIP Name': city,
    'Customer Site Address': address,
    'Customer Legal Entity': address,
    'Local Contact': requestorEmail,
    'Correct Billing Address': requestorEmail,
    'Billing Contact': requestorEmail,
    BAN: '',
    'Location ID': '',
    'Enterprise ID': isVerizon ? '124613326' : '',
    'Design ID': isVerizon ? '120406' : '',
    'Customer Status': 'Completed',
    VEC: 'yes',
    'Location VOIP Name (Original)': `${countryAbbr(country)} / ${city}`.trim(),
    'Voice Provider': carrierDisplay(migration.target_carrier),
  };
}
