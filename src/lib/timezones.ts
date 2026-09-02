/**
 * Curated list of IANA timezone identifiers with human-readable labels.
 * Covers the most common clinic locations globally.
 */
export interface TimezoneOption {
  value: string   // IANA tz identifier (stored in DB, used by backend)
  label: string   // Human-readable display name
  region: string  // Group header in the dropdown
}

export const TIMEZONES: TimezoneOption[] = [
  // Americas
  { value: 'America/New_York',       label: 'Eastern Time (ET) — New York',         region: 'Americas' },
  { value: 'America/Chicago',        label: 'Central Time (CT) — Chicago',          region: 'Americas' },
  { value: 'America/Denver',         label: 'Mountain Time (MT) — Denver',          region: 'Americas' },
  { value: 'America/Phoenix',        label: 'Mountain Time (no DST) — Phoenix',     region: 'Americas' },
  { value: 'America/Los_Angeles',    label: 'Pacific Time (PT) — Los Angeles',      region: 'Americas' },
  { value: 'America/Anchorage',      label: 'Alaska Time — Anchorage',              region: 'Americas' },
  { value: 'Pacific/Honolulu',       label: 'Hawaii Time — Honolulu',               region: 'Americas' },
  { value: 'America/Toronto',        label: 'Eastern Time — Toronto',               region: 'Americas' },
  { value: 'America/Vancouver',      label: 'Pacific Time — Vancouver',             region: 'Americas' },
  { value: 'America/Sao_Paulo',      label: 'Brasília Time — São Paulo',            region: 'Americas' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina Time — Buenos Aires', region: 'Americas' },
  { value: 'America/Mexico_City',    label: 'Central Time — Mexico City',           region: 'Americas' },
  // Europe
  { value: 'Europe/London',          label: 'GMT/BST — London',                     region: 'Europe' },
  { value: 'Europe/Dublin',          label: 'IST/GMT — Dublin',                     region: 'Europe' },
  { value: 'Europe/Paris',           label: 'Central European Time — Paris',        region: 'Europe' },
  { value: 'Europe/Berlin',          label: 'Central European Time — Berlin',       region: 'Europe' },
  { value: 'Europe/Amsterdam',       label: 'Central European Time — Amsterdam',    region: 'Europe' },
  { value: 'Europe/Rome',            label: 'Central European Time — Rome',         region: 'Europe' },
  { value: 'Europe/Madrid',          label: 'Central European Time — Madrid',       region: 'Europe' },
  { value: 'Europe/Zurich',          label: 'Central European Time — Zurich',       region: 'Europe' },
  { value: 'Europe/Stockholm',       label: 'Central European Time — Stockholm',    region: 'Europe' },
  { value: 'Europe/Helsinki',        label: 'Eastern European Time — Helsinki',     region: 'Europe' },
  { value: 'Europe/Athens',          label: 'Eastern European Time — Athens',       region: 'Europe' },
  { value: 'Europe/Istanbul',        label: 'Turkey Time — Istanbul',               region: 'Europe' },
  { value: 'Europe/Moscow',          label: 'Moscow Time — Moscow',                 region: 'Europe' },
  // Middle East & Africa
  { value: 'Asia/Dubai',             label: 'Gulf Standard Time — Dubai',           region: 'Middle East & Africa' },
  { value: 'Asia/Riyadh',            label: 'Arabia Standard Time — Riyadh',        region: 'Middle East & Africa' },
  { value: 'Asia/Jerusalem',         label: 'Israel Time — Jerusalem',              region: 'Middle East & Africa' },
  { value: 'Africa/Cairo',           label: 'Eastern European Time — Cairo',        region: 'Middle East & Africa' },
  { value: 'Africa/Johannesburg',    label: 'South Africa Time — Johannesburg',     region: 'Middle East & Africa' },
  { value: 'Africa/Lagos',           label: 'West Africa Time — Lagos',             region: 'Middle East & Africa' },
  { value: 'Africa/Nairobi',         label: 'East Africa Time — Nairobi',           region: 'Middle East & Africa' },
  // Asia Pacific
  { value: 'Asia/Kolkata',           label: 'India Standard Time — Kolkata',        region: 'Asia Pacific' },
  { value: 'Asia/Colombo',           label: 'Sri Lanka Time — Colombo',             region: 'Asia Pacific' },
  { value: 'Asia/Dhaka',             label: 'Bangladesh Time — Dhaka',              region: 'Asia Pacific' },
  { value: 'Asia/Karachi',           label: 'Pakistan Standard Time — Karachi',     region: 'Asia Pacific' },
  { value: 'Asia/Tashkent',          label: 'Uzbekistan Time — Tashkent',           region: 'Asia Pacific' },
  { value: 'Asia/Bangkok',           label: 'Indochina Time — Bangkok',             region: 'Asia Pacific' },
  { value: 'Asia/Singapore',         label: 'Singapore Time — Singapore',           region: 'Asia Pacific' },
  { value: 'Asia/Kuala_Lumpur',      label: 'Malaysia Time — Kuala Lumpur',         region: 'Asia Pacific' },
  { value: 'Asia/Jakarta',           label: 'Western Indonesia Time — Jakarta',     region: 'Asia Pacific' },
  { value: 'Asia/Hong_Kong',         label: 'Hong Kong Time — Hong Kong',           region: 'Asia Pacific' },
  { value: 'Asia/Shanghai',          label: 'China Standard Time — Shanghai',       region: 'Asia Pacific' },
  { value: 'Asia/Taipei',            label: 'Taipei Standard Time — Taipei',        region: 'Asia Pacific' },
  { value: 'Asia/Seoul',             label: 'Korea Standard Time — Seoul',          region: 'Asia Pacific' },
  { value: 'Asia/Tokyo',             label: 'Japan Standard Time — Tokyo',          region: 'Asia Pacific' },
  { value: 'Australia/Sydney',       label: 'Australian Eastern Time — Sydney',     region: 'Asia Pacific' },
  { value: 'Australia/Melbourne',    label: 'Australian Eastern Time — Melbourne',  region: 'Asia Pacific' },
  { value: 'Australia/Brisbane',     label: 'Australian Eastern Time (no DST) — Brisbane', region: 'Asia Pacific' },
  { value: 'Australia/Adelaide',     label: 'Australian Central Time — Adelaide',   region: 'Asia Pacific' },
  { value: 'Australia/Perth',        label: 'Australian Western Time — Perth',      region: 'Asia Pacific' },
  { value: 'Pacific/Auckland',       label: 'New Zealand Time — Auckland',          region: 'Asia Pacific' },
  // UTC
  { value: 'UTC',                    label: 'UTC — Coordinated Universal Time',     region: 'UTC' },
]
