import { createHash } from 'node:crypto';

export type EvidenceBlockType =
  | 'TABLE_ROW'
  | 'TABLE_SECTION'
  | 'CARD'
  | 'LIST_ITEM'
  | 'HEADING_SECTION'
  | 'PARAGRAPH_GROUP'
  | 'CONTACT_BLOCK'
  | 'CONTACT_PANEL'
  | 'DIRECTORY_RECORD'
  | 'REGISTRY_RECORD'
  | 'DEFINITION_LIST'
  | 'CSV_LIKE_ROW'
  | 'PDF_ROW'
  | 'DOCUMENT_SECTION'
  | 'UNKNOWN_BLOCK';

export interface EvidenceBlock {
  block_id: string;
  block_type: EvidenceBlockType;
  text: string;
  nearby_heading: string;
  source_url: string;
  target_association: 'TARGET' | 'OTHER' | 'UNRESOLVED';
  country_association: string[];
  organization_signals: string[];
  structural_position: number;
}

export interface ScopedPageEvidence {
  full_content: string;
  blocks: EvidenceBlock[];
  extraction_content: string;
  mixed_entity_page: boolean;
}

const normalize = (value: string) =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const coreTokens = (name: string) =>
  normalize(name)
    .split(' ')
    .filter(
      (v) =>
        v.length > 2 &&
        !['company', 'limited', 'ltd', 'trading', 'pharma', 'pharmaceuticals', 'inc', 'corp', 'group', 'the'].includes(v)
    );

const ORG_REGEX = /\b[A-Z][A-Za-z&.'-]*(?:\s+[A-Z][A-Za-z&.'-]*){1,6}\s+(?:Ltd\.?|Limited|Company|Corporation|Corp\.?|LLC|PLC|Inc\.?|GmbH|S\.A\.|S\.R\.L\.|Co\.?)\b/g;

const FOOTER_REGEX = /^(?:privacy policy|terms of use|terms and conditions|copyright|all rights reserved|powered by|contact webmaster|regulator contact|ministry of health)/i;

interface RawBlock {
  type: EvidenceBlockType;
  text: string;
  heading: string;
  headingLevel: number;
}

function rawBlocksHierarchical(content: string): RawBlock[] {
  const lines = String(content || '').split(/\r?\n/);
  const out: RawBlock[] = [];
  let currentHeading = '';
  let currentHeadingLevel = 0;
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.join(' ').trim()) {
      out.push({
        type: 'PARAGRAPH_GROUP',
        text: paragraph.join('\n').trim(),
        heading: currentHeading,
        headingLevel: currentHeadingLevel,
      });
      paragraph = [];
    }
  };

  for (const line of lines) {
    const value = line.trim();
    if (!value) {
      flush();
      continue;
    }

    const headingMatch = value.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flush();
      currentHeadingLevel = headingMatch[1].length;
      currentHeading = headingMatch[2].trim();
      out.push({
        type: 'HEADING_SECTION',
        text: value,
        heading: currentHeading,
        headingLevel: currentHeadingLevel,
      });
      continue;
    }

    if (/^\|.*\|$/.test(value)) {
      flush();
      out.push({
        type: 'TABLE_ROW',
        text: value,
        heading: currentHeading,
        headingLevel: currentHeadingLevel,
      });
      continue;
    }

    if ((value.match(/,/g) || []).length >= 2) {
      flush();
      out.push({
        type: 'CSV_LIKE_ROW',
        text: value,
        heading: currentHeading,
        headingLevel: currentHeadingLevel,
      });
      continue;
    }

    if (/^[^:]{2,50}:\s+\S/.test(value)) {
      flush();
      out.push({
        type: 'DEFINITION_LIST',
        text: value,
        heading: currentHeading,
        headingLevel: currentHeadingLevel,
      });
      continue;
    }

    if (/^(?:page\s+\d+|\[page\s+\d+\])/i.test(value)) {
      flush();
      out.push({
        type: 'DOCUMENT_SECTION',
        text: value,
        heading: currentHeading,
        headingLevel: currentHeadingLevel,
      });
      continue;
    }

    if (/^(?:[-*+] |\d+[.)]\s+)/.test(value)) {
      flush();
      out.push({
        type: 'LIST_ITEM',
        text: value,
        heading: currentHeading,
        headingLevel: currentHeadingLevel,
      });
      continue;
    }

    paragraph.push(value);
  }
  flush();

  return out.length ? out : [{ type: 'UNKNOWN_BLOCK', text: String(content || ''), heading: '', headingLevel: 0 }];
}

export function buildEntityScopedEvidence(
  content: string,
  sourceUrl: string,
  companyName: string,
  country = '',
  forceMixed = false
): ScopedPageEvidence {
  const targetTokens = coreTokens(companyName);
  const rawList = rawBlocksHierarchical(content);

  // Maintain a hierarchical heading stack to propagate structural target ownership down to neutral child sections
  const headingStack: Array<{ level: number; heading: string; owner: 'TARGET' | 'OTHER' | 'UNRESOLVED' }> = [];

  const isTargetText = (text: string): boolean => {
    const local = normalize(text);
    return targetTokens.length > 0 && targetTokens.every((token) => local.includes(token));
  };

  const getOrganizations = (text: string): string[] => {
    return Array.from(new Set((text.match(ORG_REGEX) || []).map((v) => v.trim())));
  };

  const blocks: EvidenceBlock[] = rawList.map((block, index): EvidenceBlock => {
    // If this block is a heading, update the heading hierarchy stack
    if (block.type === 'HEADING_SECTION') {
      const headingLevel = block.headingLevel || 1;
      // Pop deeper or equal levels
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= headingLevel) {
        headingStack.pop();
      }

      const orgsInHeading = getOrganizations(block.heading);
      let headingOwner: 'TARGET' | 'OTHER' | 'UNRESOLVED' = 'UNRESOLVED';

      if (isTargetText(block.heading)) {
        headingOwner = 'TARGET';
      } else if (FOOTER_REGEX.test(block.heading)) {
        headingOwner = 'OTHER';
      } else if (orgsInHeading.length > 0) {
        headingOwner = 'OTHER';
      } else {
        // Neutral heading (e.g. "## Contact Information", "### Branches", "## About"):
        // Inherit owner from parent heading if present
        const parent = headingStack[headingStack.length - 1];
        headingOwner = parent ? parent.owner : 'UNRESOLVED';
      }

      headingStack.push({ level: headingLevel, heading: block.heading, owner: headingOwner });
    }

    const currentInheritedOwner = headingStack.length > 0 ? headingStack[headingStack.length - 1].owner : 'UNRESOLVED';

    const localText = `${block.heading} ${block.text}`;
    const directTarget = isTargetText(block.text);
    const orgSignals = getOrganizations(block.text);
    const hasCompetingOrg = orgSignals.length > 0 && !directTarget;
    const isFooter = FOOTER_REGEX.test(block.text) || FOOTER_REGEX.test(block.heading);

    let association: 'TARGET' | 'OTHER' | 'UNRESOLVED' = 'UNRESOLVED';
    if (directTarget) {
      association = 'TARGET';
    } else if (isFooter) {
      association = 'OTHER';
    } else if (hasCompetingOrg) {
      association = 'OTHER';
    } else if (currentInheritedOwner === 'TARGET') {
      // Inherited ownership from target parent heading!
      association = 'TARGET';
    } else if (currentInheritedOwner === 'OTHER') {
      association = 'OTHER';
    }

    return {
      block_id: `block_${createHash('sha256').update(`${sourceUrl}\0${index}\0${block.text}`).digest('hex').slice(0, 12)}`,
      block_type: /(?:email|phone|tel|fax|address|contact|headquarters|location)/i.test(block.text)
        ? 'CONTACT_BLOCK'
        : block.type,
      text: block.text,
      nearby_heading: block.heading,
      source_url: sourceUrl,
      target_association: association,
      country_association: (() => {
        const targetC = normalize(country);
        return targetC && ` ${normalize(localText)} `.includes(` ${targetC} `) ? [targetC] : [];
      })(),
      organization_signals: orgSignals,
      structural_position: index,
    };
  });

  const namedOrganizations = new Set(blocks.flatMap((b) => b.organization_signals.map(normalize)).filter(Boolean));
  const targetBlocks = blocks.filter((b) => b.target_association === 'TARGET');
  const otherBlocks = blocks.filter((b) => b.target_association === 'OTHER');
  const mixed = forceMixed || (targetBlocks.length > 0 && otherBlocks.length > 0) || namedOrganizations.size > 1;

  if (!mixed) {
    return { full_content: content, blocks, extraction_content: content, mixed_entity_page: false };
  }

  // On mixed pages, expose target-owned structural blocks (both direct and hierarchically inherited)
  const locallyOwned = targetBlocks.filter(
    (b) => !country || b.country_association.length === 0 || b.country_association.includes(normalize(country))
  );

  const extraction = locallyOwned
    .map((b) => {
      let ownedText = b.text;
      // In multi-org blocks, window around target entity preserving preceding fields without leaking competing orgs
      if (b.organization_signals.length > 1) {
        const lower = ownedText.toLowerCase();
        const targetAt = lower.indexOf(String(companyName).toLowerCase());
        if (targetAt >= 0) {
          const laterOrganizations = b.organization_signals
            .map((name) => ({ name, at: lower.indexOf(name.toLowerCase(), targetAt + companyName.length) }))
            .filter((item) => item.at > targetAt)
            .sort((a, c) => a.at - c.at);
          if (laterOrganizations[0]) {
            ownedText = ownedText.slice(0, laterOrganizations[0].at);
          }
        }
      }
      return `[Evidence block ${b.block_id} | ${b.block_type}]\n${b.nearby_heading ? `${b.nearby_heading}\n` : ''}${ownedText}`;
    })
    .join('\n\n');

  return { full_content: content, blocks, extraction_content: extraction, mixed_entity_page: true };
}

export function factHasTargetLocalOwnership(scoped: ScopedPageEvidence, fact: string): boolean {
  const needle = normalize(fact);
  if (!needle) return false;
  if (!scoped.mixed_entity_page) return normalize(scoped.extraction_content).includes(needle);
  return normalize(scoped.extraction_content).includes(needle);
}
