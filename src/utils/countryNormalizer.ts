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
  null: 'Unknown',
  nan: 'Unknown',
  none: 'Unknown',
  nil: 'Unknown',
  'not available': 'Unknown',
  'not applicable': 'Unknown',
  kazakistan: 'Kazakhstan',
  turkemanistan: 'Turkmenistan',
  kampuchea: 'Cambodia',
  'upper volta': 'Burkina Faso',
  'british virgin islands': 'British Virgin Islands',
};

// The historical SPELLINGS table uses human-readable keys. Index the collapsed
// form as well so punctuation/spacing variants and multi-word aliases actually
// follow the same exact-match path as their documented representation.
const SPELLING_KEY_TO_NAME: Record<string, string> = {};
for (const [spelling, name] of Object.entries(SPELLINGS)) SPELLING_KEY_TO_NAME[collapse(spelling)] = name;
const COLLAPSED_SPELLING_FRAGMENTS = Object.keys(SPELLING_KEY_TO_NAME)
  .filter(key => key.length >= 4)
  .sort((a, b) => b.length - a.length);
const MISSING_COUNTRY_KEYS = new Set(['na', 'unknown', 'notspecified', 'unspecified', 'null', 'nan', 'none', 'nil',
  'notavailable', 'notapplicable']);

function collapse(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9']/g, '');
}

function missingCountryValue(raw: string): string {
  const key = collapse(raw);
  if (!MISSING_COUNTRY_KEYS.has(key)) return '';
  return key === 'notspecified' || key === 'unspecified' ? 'Not Specified' : 'Unknown';
}

/**
 * Normalizes an explicit ISO alpha-2 or alpha-3 code ONLY when input is 2-3 characters.
 */
export function interpretExplicitCountryCode(code: string | null | undefined): string | '' {
  if (!code) return '';
  const upper = String(code).trim().toUpperCase();
  // NA is overwhelmingly a missing-data marker in trade files. Namibia remains
  // unambiguous through NAM or its full name; never guess from this collision.
  if (upper === 'NA') return '';
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
  const missing = missingCountryValue(s);
  if (missing) return missing;

  // 1. If it is exactly a 2-3 letter code:
  if (s.length >= 2 && s.length <= 3) {
    const explicit = interpretExplicitCountryCode(s);
    if (explicit) return explicit;
  }

  // 2. Common spelling / exact alias match
  const key = collapse(s);
  if (SPELLING_KEY_TO_NAME[key]) return SPELLING_KEY_TO_NAME[key];
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
  const missing = missingCountryValue(s);
  if (missing) return missing;

  // 1. Exact ISO alpha-2 / alpha-3 code match (when input is short).
  if (s.length >= 2 && s.length <= 3) {
    const explicit = interpretExplicitCountryCode(s);
    if (explicit) return explicit;
  }

  // 2. Common spelling / compound match, followed by all exact ISO names.
  const key = collapse(s);
  if (SPELLING_KEY_TO_NAME[key]) return SPELLING_KEY_TO_NAME[key];
  if (NAME_KEY_TO_NAME[key]) return NAME_KEY_TO_NAME[key];

  // A sentence containing several countries, a conflicting country/code pair,
  // or a negated country is not a country value. Preserve the unresolved input
  // verbatim; strict identity callers convert that ambiguity to unknown.
  const mentioned = detectExplicitCountryNames(s);
  if (mentioned.length > 1 || detectNegatedCountryNames(s).length
    || (mentioned.length && /\b(?:n\/?a|unknown|not[\s-]+specified|not[\s-]+available)\b/i.test(s))) return s;

  // 3. Check for an explicit trailing parenthetical ISO code. A contradictory
  // name and code must not silently select whichever happened to come last.
  const trailingIso = s.match(/\(\s*([A-Za-z]{2,3})\s*\)$/);
  if (trailingIso) {
    const coded = interpretExplicitCountryCode(trailingIso[1]);
    if (coded && mentioned.length && mentioned[0].toLowerCase() !== coded.toLowerCase()) return s;
    if (coded) return coded;
  }

  // 4. One affirmed country mention in a labelled sentence is unambiguous.
  if (mentioned.length === 1) return mentioned[0];

  // 5. Retain support for common misspellings in free text without substring-
  // matching one real country inside another (Niger/Nigeria, Sudan/South Sudan).
  for (const fragment of COLLAPSED_SPELLING_FRAGMENTS) {
    if (key.includes(fragment)) return SPELLING_KEY_TO_NAME[fragment];
  }

  return s;
}

/**
 * Conservative country mentions for validating country-scoped address merges.
 */
export function detectCountriesInFreeText(raw: string | null | undefined): string[] {
  const text = String(raw || '');
  if (!text.trim()) return [];
  const found = new Set(detectExplicitCountryNames(text));

  // Uppercase ISO codes remain explicit; lowercase prose such as "us" or
  // "in" is never reinterpreted as a country code.
  for (const [alpha2, , name] of ISO_3166_1) {
    if (new RegExp(`\\b${alpha2}\\b`).test(text)) found.add(name);
  }

  const safeAliases: Array<[RegExp, string]> = [
    [/\b(?:u\.?s\.?a\b|united states of america)\b/i, 'United States'],
    [/\b(?:united kingdom|great britain|england|scotland|wales)\b/i, 'United Kingdom'],
    [/\b(?:united arab emirates|u\.?a\.?e\b)\b/i, 'United Arab Emirates'],
    [/\b(?:czech republic|czechia)\b/i, 'Czechia'],
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

// Country-scope evidence must not interpret prose such as "contact us" or
// "made in" as ISO codes. Longest non-overlapping names also keep South Sudan
// distinct from Sudan (and Papua New Guinea distinct from Guinea).
const explicitCountryNames = new Map(ISO_3166_1.map(([, , name]) => [name.toLowerCase(), name]));
for (const [alias, name] of [
  ['united states of america', 'United States'], ['great britain', 'United Kingdom'],
  ['england', 'United Kingdom'], ['scotland', 'United Kingdom'], ['wales', 'United Kingdom'],
  ['united arab emirates', 'United Arab Emirates'], ['czech republic', 'Czechia'],
  ['ivory coast', "Côte d'Ivoire"], ["cote d'ivoire", "Côte d'Ivoire"], ['cote divoire', "Côte d'Ivoire"],
  ['democratic republic of the congo', 'Congo (Democratic Republic of the)'],
  ['congo-kinshasa', 'Congo (Democratic Republic of the)'], ['republic of the congo', 'Congo'],
  ['congo-brazzaville', 'Congo'], ['russian federation', 'Russia'],
] as const) explicitCountryNames.set(alias, name);
const explicitCountryPattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...explicitCountryNames.keys()]
  .sort((a, b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
// These uppercase office abbreviations are explicit labels, not arbitrary ISO
// codes. Preserve case: "us", "in" and the Spanish verb "usa" are prose.
const explicitCountryAbbreviations = new Map([
  ['UAE', 'United Arab Emirates'], ['UK', 'United Kingdom'], ['USA', 'United States'],
]);
const explicitAbbreviationPattern = /(?<![\p{L}\p{N}])(?:UAE|UK|USA|U\.A\.E\.?|U\.K\.?|U\.S\.A\.?)(?![\p{L}\p{N}])/gu;
type CountryMention = { at: number; name: string; negated: boolean };
function countryMentionIsNegated(text: string, at: number): boolean {
  const prefix = text.slice(Math.max(0, at - 140), at);
  // Limit negation to its own clause. "Not only Kenya" is affirmative; a new
  // sentence or contrast starts a new claim and must not inherit the negation.
  const clause = prefix.split(/[.!?;:\r\n]|\b(?:but|however|yet)\b/iu).at(-1) || '';
  return /(?:\bnot\s+(?!only\b|just\b)|\b(?:no|never|without|outside|excluding|except|non)\b)[\s\S]{0,120}$/iu.test(clause);
}
function explicitCountryMentions(raw: string): CountryMention[] {
  const text = String(raw || '');
  return [
    ...[...text.matchAll(explicitCountryPattern)].map(match => ({ at: match.index!, name: explicitCountryNames.get(match[0].toLowerCase())! })),
    ...[...text.matchAll(explicitAbbreviationPattern)].map(match => ({ at: match.index!, name: explicitCountryAbbreviations.get(match[0].replace(/\./g, ''))! })),
  ].filter(match => Boolean(match.name)).sort((a, b) => a.at - b.at)
    .map(match => ({ ...match, negated: countryMentionIsNegated(text, match.at) }));
}
export function detectExplicitCountryNames(raw: string): string[] {
  return [...new Set(explicitCountryMentions(raw).map(match => match.name))];
}
/** Only affirmative statements are positive country-scope evidence. */
export function detectAffirmedCountryNames(raw: string): string[] {
  return [...new Set(explicitCountryMentions(raw).filter(match => !match.negated).map(match => match.name))];
}
/** Explicit denials are contradiction evidence, never positive location proof. */
export function detectNegatedCountryNames(raw: string): string[] {
  return [...new Set(explicitCountryMentions(raw).filter(match => match.negated).map(match => match.name))];
}

/** A canonical country only when the entire value is one affirmed known country.
 * Missing markers, negation, mixtures and unresolved labels all abstain. */
export function normalizeCountryNameStrict(raw: string | null | undefined): string {
  const normalized = normalizeCountryName(raw);
  if (!normalized || normalized === 'Unknown' || normalized === 'Not Specified') return '';
  const mentions = explicitCountryMentions(normalized);
  const countries = [...new Set(mentions.map(match => match.name))];
  return countries.length === 1 && countries[0].toLowerCase() === normalized.toLowerCase()
    && mentions.every(match => !match.negated) ? countries[0] : '';
}

const COUNTRY_NAME_TO_ALPHA2 = new Map(ISO_3166_1.map(([alpha2, , name]) => [name.toLowerCase(), alpha2]));
/** ISO alpha-2 for a fully resolved country, never for mixed/unknown text. */
export function countryAlpha2Code(raw: string | null | undefined): string {
  const canonical = normalizeCountryNameStrict(raw);
  return canonical ? COUNTRY_NAME_TO_ALPHA2.get(canonical.toLowerCase()) || '' : '';
}

/** Country-code top-level domains associated with a resolved country. GB/UK are
 * both recognized for the United Kingdom; XK is retained for existing Kosovo data. */
export function countryCcTlds(raw: string | null | undefined): string[] {
  const alpha2 = countryAlpha2Code(raw).toLowerCase();
  if (!alpha2) return [];
  return alpha2 === 'gb' ? ['gb', 'uk'] : [alpha2];
}

/** Compares two country names for semantic equivalence */
export function compareCountryOwnership(countryA?: string, countryB?: string): boolean {
  const normA = normalizeCountryNameStrict(countryA).toLowerCase();
  const normB = normalizeCountryNameStrict(countryB).toLowerCase();
  return normA.length > 0 && normA === normB;
}

/** True when the given raw value normalizes to Pakistan. */
export function isPakistanCountry(raw: string | null | undefined): boolean {
  return normalizeCountryNameStrict(raw).toLowerCase() === 'pakistan';
}
