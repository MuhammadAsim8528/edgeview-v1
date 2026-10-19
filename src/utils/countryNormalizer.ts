// Deterministic, dependency-free country name normalization shared by the
// server-side canonical projection (getInternationalImporterDirectory) and the
// Contacts UI. Maps ISO 3166-1 alpha-2 / alpha-3 codes and common spellings to a
// single canonical English country name. Values that cannot be resolved are
// preserved verbatim (never fabricated).

type IsoEntry = readonly [string, string, string];

// [alpha-2, alpha-3, canonical English name] for every ISO 3166-1 entry.
const ISO_3166_1: IsoEntry[] = [
  ['AF', 'AFG', 'Afghanistan'],
  ['AX', 'ALA', 'Åland Islands'],
  ['AL', 'ALB', 'Albania'],
  ['DZ', 'DZA', 'Algeria'],
  ['AS', 'ASM', 'American Samoa'],
  ['AD', 'AND', 'Andorra'],
  ['AO', 'AGO', 'Angola'],
  ['AI', 'AIA', 'Anguilla'],
  ['AQ', 'ATA', 'Antarctica'],
  ['AG', 'ATG', 'Antigua and Barbuda'],
  ['AR', 'ARG', 'Argentina'],
  ['AM', 'ARM', 'Armenia'],
  ['AW', 'ABW', 'Aruba'],
  ['AU', 'AUS', 'Australia'],
  ['AT', 'AUT', 'Austria'],
  ['AZ', 'AZE', 'Azerbaijan'],
  ['BS', 'BHS', 'Bahamas'],
  ['BH', 'BHR', 'Bahrain'],
  ['BD', 'BGD', 'Bangladesh'],
  ['BB', 'BRB', 'Barbados'],
  ['BY', 'BLR', 'Belarus'],
  ['BE', 'BEL', 'Belgium'],
  ['BZ', 'BLZ', 'Belize'],
  ['BJ', 'BEN', 'Benin'],
  ['BM', 'BMU', 'Bermuda'],
  ['BT', 'BTN', 'Bhutan'],
  ['BO', 'BOL', 'Bolivia'],
  ['BQ', 'BES', 'Bonaire, Sint Eustatius and Saba'],
  ['BA', 'BIH', 'Bosnia and Herzegovina'],
  ['BW', 'BWA', 'Botswana'],
  ['BV', 'BVT', 'Bouvet Island'],
  ['BR', 'BRA', 'Brazil'],
  ['IO', 'IOT', 'British Indian Ocean Territory'],
  ['BN', 'BRN', 'Brunei'],
  ['BG', 'BGR', 'Bulgaria'],
  ['BF', 'BFA', 'Burkina Faso'],
  ['BI', 'BDI', 'Burundi'],
  ['CV', 'CPV', 'Cabo Verde'],
  ['KH', 'KHM', 'Cambodia'],
  ['CM', 'CMR', 'Cameroon'],
  ['CA', 'CAN', 'Canada'],
  ['KY', 'CYM', 'Cayman Islands'],
  ['CF', 'CAF', 'Central African Republic'],
  ['TD', 'TCD', 'Chad'],
  ['CL', 'CHL', 'Chile'],
  ['CN', 'CHN', 'China'],
  ['CX', 'CXR', 'Christmas Island'],
  ['CC', 'CCK', 'Cocos (Keeling) Islands'],
  ['CO', 'COL', 'Colombia'],
  ['KM', 'COM', 'Comoros'],
  ['CG', 'COG', 'Congo'],
  ['CD', 'COD', 'Congo (Democratic Republic of the)'],
  ['CK', 'COK', 'Cook Islands'],
  ['CR', 'CRI', 'Costa Rica'],
  ['CI', 'CIV', "Côte d'Ivoire"],
  ['HR', 'HRV', 'Croatia'],
  ['CU', 'CUB', 'Cuba'],
  ['CW', 'CUW', 'Curaçao'],
  ['CY', 'CYP', 'Cyprus'],
  ['CZ', 'CZE', 'Czechia'],
  ['DK', 'DNK', 'Denmark'],
  ['DJ', 'DJI', 'Djibouti'],
  ['DM', 'DMA', 'Dominica'],
  ['DO', 'DOM', 'Dominican Republic'],
  ['EC', 'ECU', 'Ecuador'],
  ['EG', 'EGY', 'Egypt'],
  ['SV', 'SLV', 'El Salvador'],
  ['GQ', 'GNQ', 'Equatorial Guinea'],
  ['ER', 'ERI', 'Eritrea'],
  ['EE', 'EST', 'Estonia'],
  ['SZ', 'SWZ', 'Eswatini'],
  ['ET', 'ETH', 'Ethiopia'],
  ['FK', 'FLK', 'Falkland Islands'],
  ['FO', 'FRO', 'Faroe Islands'],
  ['FJ', 'FJI', 'Fiji'],
  ['FI', 'FIN', 'Finland'],
  ['FR', 'FRA', 'France'],
  ['GF', 'GUF', 'French Guiana'],
  ['PF', 'PYF', 'French Polynesia'],
  ['TF', 'ATF', 'French Southern Territories'],
  ['GA', 'GAB', 'Gabon'],
  ['GM', 'GMB', 'Gambia'],
  ['GE', 'GEO', 'Georgia'],
  ['DE', 'DEU', 'Germany'],
  ['GH', 'GHA', 'Ghana'],
  ['GI', 'GIB', 'Gibraltar'],
  ['GR', 'GRC', 'Greece'],
  ['GL', 'GRL', 'Greenland'],
  ['GD', 'GRD', 'Grenada'],
  ['GP', 'GLP', 'Guadeloupe'],
  ['GU', 'GUM', 'Guam'],
  ['GT', 'GTM', 'Guatemala'],
  ['GG', 'GGY', 'Guernsey'],
  ['GN', 'GIN', 'Guinea'],
  ['GW', 'GNB', 'Guinea-Bissau'],
  ['GY', 'GUY', 'Guyana'],
  ['HT', 'HTI', 'Haiti'],
  ['HM', 'HMD', 'Heard Island and McDonald Islands'],
  ['VA', 'VAT', 'Vatican City'],
  ['HN', 'HND', 'Honduras'],
  ['HK', 'HKG', 'Hong Kong'],
  ['HU', 'HUN', 'Hungary'],
  ['IS', 'ISL', 'Iceland'],
  ['IN', 'IND', 'India'],
  ['ID', 'IDN', 'Indonesia'],
  ['IR', 'IRN', 'Iran'],
  ['IQ', 'IRQ', 'Iraq'],
  ['IE', 'IRL', 'Ireland'],
  ['IM', 'IMN', 'Isle of Man'],
  ['IL', 'ISR', 'Israel'],
  ['IT', 'ITA', 'Italy'],
  ['JM', 'JAM', 'Jamaica'],
  ['JP', 'JPN', 'Japan'],
  ['JE', 'JEY', 'Jersey'],
  ['JO', 'JOR', 'Jordan'],
  ['KZ', 'KAZ', 'Kazakhstan'],
  ['KE', 'KEN', 'Kenya'],
  ['KI', 'KIR', 'Kiribati'],
  ['KP', 'PRK', 'North Korea'],
  ['KR', 'KOR', 'South Korea'],
  ['XK', 'XKX', 'Kosovo'],
  ['KW', 'KWT', 'Kuwait'],
  ['KG', 'KGZ', 'Kyrgyzstan'],
  ['LA', 'LAO', 'Laos'],
  ['LV', 'LVA', 'Latvia'],
  ['LB', 'LBN', 'Lebanon'],
  ['LS', 'LSO', 'Lesotho'],
  ['LR', 'LBR', 'Liberia'],
  ['LY', 'LBY', 'Libya'],
  ['LI', 'LIE', 'Liechtenstein'],
  ['LT', 'LTU', 'Lithuania'],
  ['LU', 'LUX', 'Luxembourg'],
  ['MO', 'MAC', 'Macao'],
  ['MG', 'MDG', 'Madagascar'],
  ['MW', 'MWI', 'Malawi'],
  ['MY', 'MYS', 'Malaysia'],
  ['MV', 'MDV', 'Maldives'],
  ['ML', 'MLI', 'Mali'],
  ['MT', 'MLT', 'Malta'],
  ['MH', 'MHL', 'Marshall Islands'],
  ['MQ', 'MTQ', 'Martinique'],
  ['MR', 'MRT', 'Mauritania'],
  ['MU', 'MUS', 'Mauritius'],
  ['YT', 'MYT', 'Mayotte'],
  ['MX', 'MEX', 'Mexico'],
  ['FM', 'FSM', 'Micronesia'],
  ['MD', 'MDA', 'Moldova'],
  ['MC', 'MCO', 'Monaco'],
  ['MN', 'MNG', 'Mongolia'],
  ['ME', 'MNE', 'Montenegro'],
  ['MS', 'MSR', 'Montserrat'],
  ['MA', 'MAR', 'Morocco'],
  ['MZ', 'MOZ', 'Mozambique'],
  ['MM', 'MMR', 'Myanmar'],
  ['NA', 'NAM', 'Namibia'],
  ['NR', 'NRU', 'Nauru'],
  ['NP', 'NPL', 'Nepal'],
  ['NL', 'NLD', 'Netherlands'],
  ['NC', 'NCL', 'New Caledonia'],
  ['NZ', 'NZL', 'New Zealand'],
  ['NI', 'NIC', 'Nicaragua'],
  ['NE', 'NER', 'Niger'],
  ['NG', 'NGA', 'Nigeria'],
  ['NU', 'NIU', 'Niue'],
  ['NF', 'NFK', 'Norfolk Island'],
  ['MK', 'MKD', 'North Macedonia'],
  ['MP', 'MNP', 'Northern Mariana Islands'],
  ['NO', 'NOR', 'Norway'],
  ['OM', 'OMN', 'Oman'],
  ['PK', 'PAK', 'Pakistan'],
  ['PW', 'PLW', 'Palau'],
  ['PS', 'PSE', 'Palestine'],
  ['PA', 'PAN', 'Panama'],
  ['PG', 'PNG', 'Papua New Guinea'],
  ['PY', 'PRY', 'Paraguay'],
  ['PE', 'PER', 'Peru'],
  ['PH', 'PHL', 'Philippines'],
  ['PN', 'PCN', 'Pitcairn'],
  ['PL', 'POL', 'Poland'],
  ['PT', 'PRT', 'Portugal'],
  ['PR', 'PRI', 'Puerto Rico'],
  ['QA', 'QAT', 'Qatar'],
  ['RE', 'REU', 'Réunion'],
  ['RO', 'ROU', 'Romania'],
  ['RU', 'RUS', 'Russia'],
  ['RW', 'RWA', 'Rwanda'],
  ['BL', 'BLM', 'Saint Barthélemy'],
  ['SH', 'SHN', 'Saint Helena, Ascension and Tristan da Cunha'],
  ['KN', 'KNA', 'Saint Kitts and Nevis'],
  ['LC', 'LCA', 'Saint Lucia'],
  ['MF', 'MAF', 'Saint Martin'],
  ['PM', 'SPM', 'Saint Pierre and Miquelon'],
  ['VC', 'VCT', 'Saint Vincent and the Grenadines'],
  ['WS', 'WSM', 'Samoa'],
  ['SM', 'SMR', 'San Marino'],
  ['ST', 'STP', 'Sao Tome and Principe'],
  ['SA', 'SAU', 'Saudi Arabia'],
  ['SN', 'SEN', 'Senegal'],
  ['RS', 'SRB', 'Serbia'],
  ['SC', 'SYC', 'Seychelles'],
  ['SL', 'SLE', 'Sierra Leone'],
  ['SG', 'SGP', 'Singapore'],
  ['SX', 'SXM', 'Sint Maarten'],
  ['SK', 'SVK', 'Slovakia'],
  ['SI', 'SVN', 'Slovenia'],
  ['SB', 'SLB', 'Solomon Islands'],
  ['SO', 'SOM', 'Somalia'],
  ['ZA', 'ZAF', 'South Africa'],
  ['GS', 'SGS', 'South Georgia and the South Sandwich Islands'],
  ['SS', 'SSD', 'South Sudan'],
  ['ES', 'ESP', 'Spain'],
  ['LK', 'LKA', 'Sri Lanka'],
  ['SD', 'SDN', 'Sudan'],
  ['SR', 'SUR', 'Suriname'],
  ['SJ', 'SJM', 'Svalbard and Jan Mayen'],
  ['SE', 'SWE', 'Sweden'],
  ['CH', 'CHE', 'Switzerland'],
  ['SY', 'SYR', 'Syria'],
  ['TW', 'TWN', 'Taiwan'],
  ['TJ', 'TJK', 'Tajikistan'],
  ['TZ', 'TZA', 'Tanzania'],
  ['TH', 'THA', 'Thailand'],
  ['TL', 'TLS', 'Timor-Leste'],
  ['TG', 'TGO', 'Togo'],
  ['TK', 'TKL', 'Tokelau'],
  ['TO', 'TON', 'Tonga'],
  ['TT', 'TTO', 'Trinidad and Tobago'],
  ['TN', 'TUN', 'Tunisia'],
  ['TR', 'TUR', 'Turkey'],
  ['TM', 'TKM', 'Turkmenistan'],
  ['TC', 'TCA', 'Turks and Caicos Islands'],
  ['TV', 'TUV', 'Tuvalu'],
  ['UG', 'UGA', 'Uganda'],
  ['UA', 'UKR', 'Ukraine'],
  ['AE', 'ARE', 'United Arab Emirates'],
  ['GB', 'GBR', 'United Kingdom'],
  ['US', 'USA', 'United States'],
  ['UM', 'UMI', 'United States Minor Outlying Islands'],
  ['UY', 'URY', 'Uruguay'],
  ['UZ', 'UZB', 'Uzbekistan'],
  ['VU', 'VUT', 'Vanuatu'],
  ['VE', 'VEN', 'Venezuela'],
  ['VN', 'VNM', 'Vietnam'],
  ['VG', 'VGB', 'British Virgin Islands'],
  ['VI', 'VIR', 'US Virgin Islands'],
  ['WF', 'WLF', 'Wallis and Futuna'],
  ['EH', 'ESH', 'Western Sahara'],
  ['YE', 'YEM', 'Yemen'],
  ['ZM', 'ZMB', 'Zambia'],
  ['ZW', 'ZWE', 'Zimbabwe'],
];

const CODE_TO_NAME: Record<string, string> = {};
for (const [a2, a3, name] of ISO_3166_1) {
  CODE_TO_NAME[a2] = name;
  CODE_TO_NAME[a3] = name;
}

// Collapsed canonical ISO names (e.g. 'china' → 'China', 'india' → 'India') so
// exact official names resolve even when they are absent from SPELLINGS.
const NAME_KEY_TO_NAME: Record<string, string> = {};
for (const [, , name] of ISO_3166_1) {
  NAME_KEY_TO_NAME[collapse(name)] = name;
}

// Common spellings / compound values (e.g. "Pakistan, PK", "AFG (Afghanistan)",
// "U.S.A.", "England"). Keys are lowercase, punctuation-and-space-collapsed.
const SPELLINGS: Record<string, string> = {
  afghanistan: 'Afghanistan',
  'pakistan': 'Pakistan',
  'islamic republic of pakistan': 'Pakistan',
  'united states': 'United States',
  'united states of america': 'United States',
  usa: 'United States',
  'u.s.a.': 'United States',
  'u.s.': 'United States',
  'united kingdom': 'United Kingdom',
  'u.k.': 'United Kingdom',
  uk: 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  britain: 'United Kingdom',
  uae: 'United Arab Emirates',
  'united arab emirates': 'United Arab Emirates',
  'russian federation': 'Russia',
  russia: 'Russia',
  'south korea': 'South Korea',
  'republic of korea': 'South Korea',
  'north korea': 'North Korea',
  "cote d'ivoire": "Côte d'Ivoire",
  'ivory coast': "Côte d'Ivoire",
  'czech republic': 'Czechia',
  'czechia': 'Czechia',
  'kyrzyghistan': 'Kyrgyzstan',
  'kyrghyzstan': 'Kyrgyzstan',
  'viet nam': 'Vietnam',
  'vietnam': 'Vietnam',
  'hong kong': 'Hong Kong',
  'macau': 'Macao',
  'the netherlands': 'Netherlands',
  holland: 'Netherlands',
  'the gambia': 'Gambia',
  'democratic republic of the congo': 'Congo (Democratic Republic of the)',
  'republic of the congo': 'Congo',
  'taiwan, province of china': 'Taiwan',
  'taiwan': 'Taiwan',
  'syrian arab republic': 'Syria',
  'bolivia, plurinational state of': 'Bolivia',
  'iran, islamic republic of': 'Iran',
  'iran': 'Iran',
  "lao people's democratic republic": 'Laos',
  'united republic of tanzania': 'Tanzania',
  'tanzania, united republic of': 'Tanzania',
  'tanzania': 'Tanzania',
  'trinidad': 'Trinidad and Tobago',
  'saint helena': 'Saint Helena, Ascension and Tristan da Cunha',
  'vatican': 'Vatican City',
  'palestinian territory': 'Palestine',
  'west bank': 'Palestine',
  'not specified': 'Not Specified',
  'not-specified': 'Not Specified',
  unspecified: 'Not Specified',
  unknown: 'Unknown',
  'n/a': 'Unknown',
  'na': 'Unknown',
};

function collapse(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9']/g, '');
}

/**
 * Normalizes an explicit ISO alpha-2 or alpha-3 code ONLY when input is 2-3 characters.
 */
export function interpretExplicitCountryCode(code: string | null | undefined): string | '' {
  if (!code) return '';
  const upper = String(code).trim().toUpperCase();
  if (upper.length >= 2 && upper.length <= 3 && CODE_TO_NAME[upper]) {
    return CODE_TO_NAME[upper];
  }
  return '';
}

/**
 * Normalizes an exact country name or alias without free-text fuzziness.
 */
export function normalizeCountryExact(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';

  // 1. If it is exactly a 2-3 letter code:
  if (s.length >= 2 && s.length <= 3) {
    const explicit = interpretExplicitCountryCode(s);
    if (explicit) return explicit;
  }

  // 2. Common spelling / exact alias match
  const key = collapse(s);
  if (SPELLINGS[key]) return SPELLINGS[key];
  if (NAME_KEY_TO_NAME[key]) return NAME_KEY_TO_NAME[key];

  return s;
}

/**
 * Normalizes a raw country value to a canonical English name.
 * Prioritizes exact matches, common spellings, and unambiguous fragments.
 * Never matches 2-letter tokens inside free text to avoid state code collisions.
 */
export function normalizeCountryName(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (!s) return '';

  // 1. Exact ISO alpha-2 / alpha-3 code match (when input is short).
  if (s.length >= 2 && s.length <= 3) {
    const explicit = interpretExplicitCountryCode(s);
    if (explicit) return explicit;
  }

  // 2. Common spelling / compound match.
  const key = collapse(s);
  if (SPELLINGS[key]) return SPELLINGS[key];

  // 3. Collapsed official ISO name (covers all 249 countries exactly).
  if (NAME_KEY_TO_NAME[key]) return NAME_KEY_TO_NAME[key];

  // 4. Check for explicit trailing parenthetical ISO code (e.g. "Afghanistan (AFG)" or "Pakistan (PK)")
  const trailingIso = s.match(/\(\s*([A-Z]{2,3})\s*\)$/);
  if (trailingIso && CODE_TO_NAME[trailingIso[1]]) {
    return CODE_TO_NAME[trailingIso[1]];
  }

  // 5. Fall back to longest spelling fragment when the value is a sentence (e.g. "Country: Pakistan")
  const fragmentKeys = Object.keys(SPELLINGS).sort((a, b) => b.length - a.length);
  for (const frag of fragmentKeys) {
    if (frag.length < 4) continue;
    if (key.includes(frag)) return SPELLINGS[frag];
  }

  return s;
}

/**
 * Conservative country mentions for validating country-scoped address merges.
 */
export function detectCountriesInFreeText(raw: string | null | undefined): string[] {
  const text = String(raw || '').toLowerCase();
  if (!text.trim()) return [];
  const found = new Set<string>();

  for (const [, , name] of ISO_3166_1) {
    const candidate = name.toLowerCase();
    if (candidate.length >= 4 && new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      found.add(name);
    }
  }

  // Also match ISO alpha-2 codes (e.g., "US" -> United States)
  for (const [alpha2, , name] of ISO_3166_1) {
    if (alpha2.length === 2) {
      const code = alpha2.toLowerCase();
      if (new RegExp(`\\b${code}\\b`, 'i').test(text)) {
        found.add(name);
      }
    }
  }

  const safeAliases: Array<[RegExp, string]> = [
    [/\b(?:u\.?s\.?a\b|united states of america)\b/i, 'United States'],
    [/\b(?:united kingdom|great britain|england|scotland|wales)\b/i, 'United Kingdom'],
    [/\b(?:united arab emirates|u\.?a\.?e\b)\b/i, 'United Arab Emirates'],
    [/\b(?:czech republic|czechia)\b/i, 'Czech Republic'],
    [/\b(?:ivory coast|cote d'ivoire)\b/i, "Côte d'Ivoire"],
    [/\b(?:democratic republic of the congo|drc|congo-kinshasa)\b/i, 'Congo (Democratic Republic of the)'],
    [/\b(?:republic of the congo|congo-brazzaville)\b/i, 'Congo'],
    [/\b(?:south sudan)\b/i, 'South Sudan'],
    [/\b(?:equatorial guinea)\b/i, 'Equatorial Guinea'],
    [/\b(?:papua new guinea)\b/i, 'Papua New Guinea'],
  ];

  for (const [pattern, name] of safeAliases) {
    if (pattern.test(text)) found.add(name);
  }

  return Array.from(found);
}

/** Backward compatibility alias */
export const detectCountryNamesInText = detectCountriesInFreeText;

/** Compares two country names for semantic equivalence */
export function compareCountryOwnership(countryA?: string, countryB?: string): boolean {
  if (!countryA || !countryB) return false;
  const normA = normalizeCountryName(countryA).toLowerCase();
  const normB = normalizeCountryName(countryB).toLowerCase();
  return normA.length > 0 && normA === normB;
}

/** True when the given raw value normalizes to Pakistan. */
export function isPakistanCountry(raw: string | null | undefined): boolean {
  return normalizeCountryName(raw).toLowerCase() === 'pakistan';
}
