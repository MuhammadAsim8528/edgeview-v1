import type { TradeEntityFingerprint, DiscriminatingResearchAction } from './entity_proof_search';

export type { DiscriminatingResearchAction };

export type DtfFeatureKind =
  | 'counterparty'
  | 'product'
  | 'brand_token'
  | 'product_code'
  | 'strength'
  | 'dosage_form'
  | 'city'
  | 'address'
  | 'country'
  | 'role'
  | 'joint';

export interface DtfFeature {
  kind: DtfFeatureKind;
  value: string;
  recurrence: number;
  entity_frequency: number;
  specificity: number;
  searchability: number;
  generic_penalty: number;
  utility: number;
}

const normalize = (v: unknown) =>
  String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const GENERIC_WORDS = new Set([
  'pharmaceutical', 'pharmaceuticals', 'pharma',
  'medicine', 'medicines', 'medical', 'products', 'product',
  'tablet', 'tablets', 'injection', 'injections',
  'ltd', 'limited', 'corp', 'corporation', 'inc', 'incorporated',
  'general', 'pharma', 'goods', 'supplies', 'supplier',
  'dosage', 'form', 'forms', 'strength', 'mg', 'ml', 'mcg', 'g', 'iu',
  'tablet', 'tablets', 'capsule', 'capsules', 'injection', 'injections',
  'syrup', 'drops', 'cream', 'ointment', 'solution', 'suspension', 'gel',
  'infusion', 'vial', 'ampoule', 'powder', 'inhaler', 'suppository',
]);

const isGeneric = (value: string): boolean => {
  const tokens = normalize(value).split(' ').filter(Boolean);
  if (tokens.length === 0) return false;
  // Flag as generic only if ALL tokens are generic words
  // This allows "Getz Pharma" (one generic token + one proper noun) but flags "pharmaceutical tablets" (all generic)
  return tokens.every(token => GENERIC_WORDS.has(token));
};

const DOSAGE_FORMS = new Set([
  'tablet', 'tablets', 'capsule', 'capsules', 'injection', 'injections',
  'syrup', 'drops', 'cream', 'ointment', 'solution', 'suspension', 'gel',
  'infusion', 'vial', 'ampoule', 'powder', 'inhaler', 'suppository'
]);

const OCR_CONTAINER_NOISE = /^(?:[a-z]{4}\d{7}|[a-z]{3}\d{6,}|[0-9]{8,}|[bcdfghjklmnpqrstvwxyz]{5,})$/i;

export function decomposeProductSearchFeatures(
  product: string,
  parentRecurrence = 1
): Array<{ kind: DtfFeatureKind; value: string; recurrence: number }> {
  const tokens = String(product || '').match(/[A-Za-z][A-Za-z0-9-]{2,}|\d+(?:\.\d+)?\s*(?:mg|ml|mcg|g|iu)/gi) || [];
  const result: Array<{ kind: DtfFeatureKind; value: string; recurrence: number }> = [];

  for (const raw of tokens) {
    const value = raw.trim();
    const lower = value.toLowerCase();

    if (OCR_CONTAINER_NOISE.test(value)) continue;

    if (/^\d+(?:\.\d+)?\s*(?:mg|ml|mcg|g|iu)$/i.test(value)) {
      result.push({ kind: 'strength', value, recurrence: parentRecurrence });
    } else if (DOSAGE_FORMS.has(lower)) {
      result.push({ kind: 'dosage_form', value, recurrence: parentRecurrence });
    } else if ((/^(?=.*[a-z])(?=.*\d)|-|^[A-Z0-9]{4,}$/i.test(value)) && !isGeneric(value)) {
      result.push({
        kind: /\d/.test(value) ? 'product_code' : 'brand_token',
        value,
        recurrence: parentRecurrence,
      });
    } else if (value.length >= 4 && !isGeneric(value)) {
      result.push({ kind: 'brand_token', value, recurrence: parentRecurrence });
    }
  }

  return Array.from(new Map(result.map((item) => [`${item.kind}:${normalize(item.value)}`, item])).values()).slice(0, 6);
}

/**
 * Deterministic DTF V3 rarity/specificity scoring with sublinear recurrence scaling and OCR noise filtering.
 */
export function scoreDiscriminativeTransactionFeatures(
  target: TradeEntityFingerprint,
  comparison: TradeEntityFingerprint[] = []
): DtfFeature[] {
  const raw: Array<{ kind: DtfFeatureKind; value: string; recurrence: number }> = [
    ...target.trade_partners.map((value) => ({
      kind: 'counterparty' as const,
      value,
      recurrence: Number(target.feature_recurrence?.[normalize(value)] || 1),
    })),
    ...target.products.map((value) => ({
      kind: 'product' as const,
      value,
      recurrence: Number(target.feature_recurrence?.[normalize(value)] || 1),
    })),
    ...target.products.flatMap((value) => {
      const parentRec = Number(target.feature_recurrence?.[normalize(value)] || 1);
      return decomposeProductSearchFeatures(value, parentRec);
    }),
    ...(target.city ? [{ kind: 'city' as const, value: target.city, recurrence: 1 }] : []),
    ...target.address_fragments.map((value) => ({ kind: 'address' as const, value, recurrence: 1 })),
    ...(target.country ? [{ kind: 'country' as const, value: target.country, recurrence: 1 }] : []),
    ...(target.role ? [{ kind: 'role' as const, value: target.role, recurrence: 1 }] : []),
  ];

  const unique = new Map<string, { kind: DtfFeatureKind; value: string; recurrence: number }>();
  for (const item of raw) {
    if (OCR_CONTAINER_NOISE.test(item.value)) continue;
    const key = `${item.kind}:${normalize(item.value)}`;
    const existing = unique.get(key);
    if (existing) {
      existing.recurrence = Math.max(existing.recurrence, item.recurrence) + 1;
    } else if (normalize(item.value)) {
      unique.set(key, { ...item });
    }
  }

  return Array.from(unique.values())
    .map((item): DtfFeature => {
      const tokenCount = normalize(item.value).split(' ').filter(Boolean).length;
      const observedFrequency = Number(target.feature_entity_frequency?.[normalize(item.value)] || 0);
      const frequency =
        observedFrequency ||
        (comparison.filter((entity) => {
          const values = [
            ...entity.trade_partners,
            ...entity.products,
            entity.city,
            ...entity.address_fragments,
            entity.country,
            entity.role,
          ].map(normalize);
          return values.includes(normalize(item.value));
        }).length + 1);

      // Sublinear rarity (log-damped)
      const rarity = Math.max(0.1, 1 - Math.log10(frequency + 1) / 3);

      // Sublinear recurrence (log2-scaled)
      const recurrenceScore = Math.min(1.5, Math.log2(1 + item.recurrence));

      const specificity = Math.min(1, normalize(item.value).length / 28 + (tokenCount > 1 ? 0.2 : 0));
      const searchability = /[a-z]{3}/i.test(item.value) && item.value.length <= 100 ? 1 : 0.3;

      const isNoise = OCR_CONTAINER_NOISE.test(item.value);
      const genericPenalty = isNoise
        ? 1.5
        : isGeneric(item.value.trim())
          ? 1.0
          : item.kind === 'dosage_form' || item.kind === 'strength'
            ? 0.75
            : /\b(?:tablet|pharma|medical|trading)\b/i.test(item.value)
              ? 0.35
              : 0;

      // DTF V3 Utility formula: balances recurrence stability with cross-entity uniqueness
      const utility = Number(
        (rarity * 0.8 + recurrenceScore * 0.7 + specificity * 0.6 + searchability * 0.4 - genericPenalty).toFixed(3)
      );

      return {
        ...item,
        entity_frequency: frequency,
        specificity,
        searchability,
        generic_penalty: genericPenalty,
        utility,
      };
    })
    .sort((a, b) => b.utility - a.utility || a.kind.localeCompare(b.kind) || a.value.localeCompare(b.value));
}

export function planJointTransactionQueries(
  target: TradeEntityFingerprint,
  features: DtfFeature[],
  max = 2
): Array<{ query: string; utility: number; features: string[] }> {
  const partner = features.find((f) => f.kind === 'counterparty' && f.generic_penalty < 0.5);
  const product = features.find(
    (f) => ['brand_token', 'product_code', 'product'].includes(f.kind) && f.generic_penalty < 0.5
  );

  const rows: Array<{ query: string; utility: number; features: string[] }> = [];

  if (partner && product) {
    rows.push({
      query: `"${target.company_name}" "${partner.value}" "${product.value}"`,
      utility: Number(((partner.utility + product.utility) / 2 + 0.5).toFixed(3)),
      features: [partner.value, product.value],
    });
  }

  if (partner && target.country) {
    rows.push({
      query: `"${target.company_name}" "${partner.value}" "${target.country}"`,
      utility: Number((partner.utility + 0.25).toFixed(3)),
      features: [partner.value, target.country],
    });
  }

  return rows.sort((a, b) => b.utility - a.utility).slice(0, max);
}

export function planRelationalWitnessActions(
  target: TradeEntityFingerprint,
  features: DtfFeature[],
  max = 2
): DiscriminatingResearchAction[] {
  const partners = features.filter((f) => f.kind === 'counterparty' && f.generic_penalty < 0.5).slice(0, max);

  return partners.flatMap((feature) => {
    const domain = target.verified_partner_domains?.[normalize(feature.value)];
    const queries = [
      `"${feature.value.replace(/"/g, '')}" "${target.company_name.replace(/"/g, '')}" ${target.country ? `"${target.country.replace(/"/g, '')}"` : ''} distributor customer partner supplier filetype:pdf`,
      ...(domain
        ? [
            `site:${domain} "${target.company_name.replace(/"/g, '')}" ${target.country ? `"${target.country.replace(/"/g, '')}"` : ''} filetype:pdf`,
          ]
        : []),
    ];

    return queries.map((query) => ({
      query: query.trim().slice(0, 240),
      target_type: 'company' as const,
      provider_id: 'serper' as const,
      discriminator: `relational witness: ${feature.value}`,
      candidate_ids: [],
      utility: feature.utility,
      reason:
        'Relational Witness Mining: seek a public counterparty reference proving relationship/identity only; never transfer counterparty contacts',
    }));
  }).slice(0, max + 1);
}
