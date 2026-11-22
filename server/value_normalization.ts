const TRADE_SUFFIX = /^(?:[$€£₹¥₨]|usd|aed|afn|all|amd|ang|aoa|ars|aud|awg|azn|bam|bbd|bdt|bgn|bhd|bif|bmd|bnd|bob|brl|bsd|btn|bwp|byn|bzd|cad|cdf|chf|clp|cny|cop|crc|cup|cve|czk|djf|dkk|dop|dzd|egp|ern|etb|eur|fjd|fkp|gbp|gel|ghs|gip|gmd|gnf|gtq|gyd|hkd|hnl|htg|huf|idr|ils|inr|iqd|irr|isk|jmd|jod|jpy|kes|kgs|khr|kmf|kpw|krw|kwd|kyd|kzt|lak|lbp|lkr|lrd|lsl|lyd|mad|mdl|mga|mkd|mmk|mnt|mop|mru|mur|mvr|mwk|mxn|myr|mzn|nad|ngn|nio|nok|npr|nzd|omr|pab|pen|pgk|php|pkr|pln|pyg|qar|ron|rsd|rub|rwf|sar|sbd|scr|sdg|sek|sgd|shp|sos|srd|ssp|stn|svc|syp|szl|thb|tjs|tmt|tnd|top|try|ttd|tvd|twd|tzs|uah|ugx|uyu|uzs|ves|vnd|vuv|wst|xaf|xcd|xof|xpf|yer|zar|zmw|zwl|kg|kgs|g|mg|ml|l|pcs|units?|cartons?|packs?|pack|boxes|box|tablets?|tabs|capsules?|caps|bottles?|btls|vials?|pieces?|pc|ctn|ltr|litres?|liters?|litre|liter|mt|tons?|tonnes?|ton)$/i;
const CURRENCY_CODES = 'usd aed afn all amd ang aoa ars aud awg azn bam bbd bdt bgn bhd bif bmd bnd bob brl bsd btn bwp byn bzd cad cdf chf clp cny cop crc cup cve czk djf dkk dop dzd egp ern etb eur fjd fkp gbp gel ghs gip gmd gnf gtq gyd hkd hnl htg huf idr ils inr iqd irr isk jmd jod jpy kes kgs khr kmf kpw krw kwd kyd kzt lak lbp lkr lrd lsl lyd mad mdl mga mkd mmk mnt mop mru mur mvr mwk mxn myr mzn nad ngn nio nok npr nzd omr pab pen pgk php pkr pln pyg qar ron rsd rub rwf sar sbd scr sdg sek sgd shp sos srd ssp stn svc syp szl thb tjs tmt tnd top try ttd tvd twd tzs uah ugx uyu uzs ves vnd vuv wst xaf xcd xof xpf yer zar zmw zwl';
const CURRENCY = String.raw`(?:[$€£₹¥₨]|${CURRENCY_CODES.replaceAll(' ', '|')})`;
const NUMBER = String.raw`(?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?`;
const TRADE_NUMBER = new RegExp(String.raw`^(?<signBefore>[+-]?)\s*(?:(?<currency>${CURRENCY})\s*)?(?<signAfter>[+-]?)\s*(?<number>${NUMBER})(?:\s*(?<suffix>.*))?$`, 'i');
const MISSING_VALUES = new Set(['', '-', '--', '—', 'n/a', 'na', 'null', 'undefined', 'unknown']);

/** Parse a complete trade amount/quantity without accepting partial numbers. */
export function parseTradeNumeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.trim().replace(/[−–]/g, '-');
  if (MISSING_VALUES.has(text.toLowerCase())) return null;

  let accounting = false;
  if (text.startsWith('(') || text.endsWith(')')) {
    if (!text.startsWith('(') || !text.endsWith(')')) return null;
    accounting = true;
    text = text.slice(1, -1).trim();
    if (!text) return null;
  }
  const match = TRADE_NUMBER.exec(text);
  const groups = match?.groups;
  if (!match || !groups || (groups.signBefore && groups.signAfter)
    || (accounting && (groups.signBefore || groups.signAfter))
    || (groups.suffix && !TRADE_SUFFIX.test(groups.suffix))) return null;
  const numeric = Number(groups.number.replaceAll(',', ''));
  if (!Number.isFinite(numeric)) return null;
  if (numeric === 0) return 0;
  return accounting || groups.signBefore === '-' || groups.signAfter === '-' ? -numeric : numeric;
}
