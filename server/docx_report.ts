import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
} from 'docx';
import { buildContactReport, getReportColumnLabels, getReportTitle, type NormalizedImporterReport, type TradeIndex, type ContactReport } from './contact_report_model';

export interface ReportCompanyContact {
  id: string;
  company_name: string;
  type?: string;
  ceo?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  linkedin?: string;
  website?: string;
  address?: string;
  industry?: string;
  country?: string;
  fax_numbers?: string[];
  emails_list?: string[];
  phones_list?: string[];
  linkedin_urls?: string[];
  addresses?: Array<{ address: string; type?: string; source_url?: string }>;
  contact_persons?: Array<{ name: string; designation?: string; email?: string; phone?: string; department?: string; source_url?: string }>;
  decision_makers?: Array<{ id?: string; name: string; designation?: string; department?: string; emails?: any[]; phones?: any[]; whatsapp?: any; socials?: any[] }>;
  socials?: Array<{ platform: string; url: string; verified?: boolean }>;
  whatsapp_details?: { value: string; status: string };
  company_contacts?: any[];
  sources?: Array<{ url: string; title?: string; source_type?: string }>;
  evidence?: Array<{ field: string; value: string; source_url: string; confidence?: number; evidence_text?: string }>;
}

export function cleanMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  let s = String(text).trim();
  // 1. Clean markdown links: [label](url) -> label (or raw URL if it's identical or email)
  s = s.replace(/\[([^\]]+)\]\((?:mailto:)?(?:https?:\/\/[^\)]+|[^\)]+)\)/gi, '$1');
  // 2. Clean bold, italics, underline, and backticks markers
  s = s.replace(/[\*_`~]/g, '');
  return s.trim();
}

const thinBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: 'CBD5E1',
};

const borders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

const COL_WIDTHS = {
  sNo: 600,
  companyName: 2000,
  tradeHistory: 2200,
  leadership: 2280,
  contactInfo: 2280,
};

function cellParagraphs(children: TextRun[], opts: { spacingAfter?: number } = {}): Paragraph[] {
  return [
    new Paragraph({
      spacing: { after: opts.spacingAfter ?? 40 },
      children,
    }),
  ];
}

function cellText(text: string, opts: { size?: number; bold?: boolean; color?: string; italics?: boolean } = {}): TextRun {
  return new TextRun({
    text: cleanMarkdown(text) || 'Not found',
    font: 'Arial',
    size: opts.size ?? 14,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? '334155',
  });
}

function buildLeadershipCell(imp: NormalizedImporterReport): TableCell {
  const paragraphs: Paragraph[] = [];
  if (imp.leadership.length === 0) {
    paragraphs.push(...cellParagraphs([cellText('Not found', { color: '94A3B8' })], { spacingAfter: 0 }));
  } else {
    imp.leadership.forEach((p, pIdx) => {
      const titleRuns: TextRun[] = [
        cellText(p.name, { size: 16, bold: true, color: '1E293B' }),
      ];
      if (p.designation) {
        titleRuns.push(new TextRun({ text: ` (${cleanMarkdown(p.designation)})`, font: 'Arial', size: 14, color: '475569' }));
      }
      if (p.department) {
        titleRuns.push(new TextRun({ text: ` [${cleanMarkdown(p.department)}]`, font: 'Arial', size: 13, italics: true, color: '64748B' }));
      }
      paragraphs.push(...cellParagraphs(titleRuns, { spacingAfter: 20 }));

      if (p.emails.length > 0 || p.phones.length > 0) {
        const pieces: string[] = [];
        if (p.emails.length > 0) pieces.push(`Email: ${p.emails.join(', ')}`);
        if (p.phones.length > 0) pieces.push(`Tel: ${p.phones.join(', ')}`);
        paragraphs.push(...cellParagraphs(
          [new TextRun({ text: pieces.join(' | '), font: 'Arial', size: 12, italics: true, color: '64748B' })],
          { spacingAfter: 20 }
        ));
      }
      if (p.sources.length > 0) {
        paragraphs.push(...cellParagraphs(
          [new TextRun({ text: `Source: ${p.sources.join('; ')}`, font: 'Arial', size: 11, color: '94A3B8' })],
          { spacingAfter: pIdx === imp.leadership.length - 1 ? 0 : 40 }
        ));
      }
    });
  }
  return new TableCell({
    width: { size: COL_WIDTHS.leadership, type: WidthType.DXA },
    borders,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 100, bottom: 100, left: 80, right: 80 },
    children: paragraphs,
  });
}

function buildContactCell(imp: NormalizedImporterReport): TableCell {
  const paragraphs: Paragraph[] = [];
  const ci = imp.contactInfo;

  if (ci.addresses.length === 0) {
    paragraphs.push(...cellParagraphs([
      new TextRun({ text: 'Addr: ', font: 'Arial', size: 14, bold: true, color: '475569' }),
      cellText('Not found'),
    ]));
  } else {
    ci.addresses.forEach((a) => {
      const runs: TextRun[] = [
        new TextRun({ text: 'Addr: ', font: 'Arial', size: 14, bold: true, color: '475569' }),
        cellText(a.address),
      ];
      if (a.type) runs.push(new TextRun({ text: ` (${a.type})`, font: 'Arial', size: 12, italics: true, color: '64748B' }));
      paragraphs.push(...cellParagraphs(runs));
    });
  }

  if (ci.website) {
    paragraphs.push(...cellParagraphs([
      new TextRun({ text: 'Website: ', font: 'Arial', size: 14, bold: true, color: '475569' }),
      cellText(ci.website, { color: '0284C7' }),
    ]));
  }
  if (ci.emails.length > 0) {
    paragraphs.push(...cellParagraphs([
      new TextRun({ text: 'Email: ', font: 'Arial', size: 14, bold: true, color: '475569' }),
      cellText(ci.emails.join(', ')),
    ]));
  }
  if (ci.phones.length > 0) {
    paragraphs.push(...cellParagraphs([
      new TextRun({ text: 'Tel: ', font: 'Arial', size: 14, bold: true, color: '475569' }),
      cellText(ci.phones.join(', ')),
    ]));
  }
  if (ci.fax_numbers.length > 0) {
    paragraphs.push(...cellParagraphs([
      new TextRun({ text: 'Fax: ', font: 'Arial', size: 14, bold: true, color: '475569' }),
      cellText(ci.fax_numbers.join(', ')),
    ]));
  }
  if (ci.whatsapp) {
    paragraphs.push(...cellParagraphs([
      new TextRun({ text: 'WhatsApp: ', font: 'Arial', size: 14, bold: true, color: '059669' }),
      cellText(ci.whatsapp, { color: '059669' }),
    ]));
  }
  const socials = (ci.socials || []).filter((s) => s && s.url);
  if (socials.length > 0) {
    paragraphs.push(...cellParagraphs([
      new TextRun({ text: 'Socials: ', font: 'Arial', size: 14, bold: true, color: '475569' }),
      cellText(socials.map((s) => `${s.platform}: ${s.url}`).join(' | ')),
    ]));
  }
  if (ci.sources.length > 0) {
    paragraphs.push(...cellParagraphs([
      new TextRun({ text: 'Sources: ', font: 'Arial', size: 14, bold: true, color: '475569' }),
      cellText(ci.sources.map((s) => s.url).join('; '), { size: 13, color: '64748B' }),
    ]));
  }

  return new TableCell({
    width: { size: COL_WIDTHS.contactInfo, type: WidthType.DXA },
    borders,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 100, bottom: 100, left: 80, right: 80 },
    children: paragraphs,
  });
}

function buildTradeCell(imp: NormalizedImporterReport): TableCell {
  const paragraphs: Paragraph[] = [];
  if (imp.tradeHistory.length === 0) {
    paragraphs.push(...cellParagraphs([cellText('Not found', { color: '94A3B8' })], { spacingAfter: 0 }));
  } else {
    imp.tradeHistory.forEach((r, rIdx) => {
      const runs: TextRun[] = [
        new TextRun({ text: `â€¢ ${cleanMarkdown(r.partnerName)}`, font: 'Arial', size: 14, bold: true, color: '334155' }),
        new TextRun({ text: ` (${cleanMarkdown(r.country || 'Unknown')})`, font: 'Arial', size: 12, color: '64748B' }),
        new TextRun({ text: ` [${r.shipmentCount || 0} shp]`, font: 'Arial', size: 12, italics: true, color: '0284C7' }),
      ];
      paragraphs.push(...cellParagraphs(runs, { spacingAfter: rIdx === imp.tradeHistory.length - 1 ? 0 : 40 }));
      if (r.itemDescription && cleanMarkdown(r.itemDescription)) {
        paragraphs.push(...cellParagraphs(
          [new TextRun({ text: cleanMarkdown(r.itemDescription), font: 'Arial', size: 11, italics: true, color: '94A3B8' })],
          { spacingAfter: rIdx === imp.tradeHistory.length - 1 ? 0 : 40 }
        ));
      }
    });
  }
  return new TableCell({
    width: { size: COL_WIDTHS.tradeHistory, type: WidthType.DXA },
    borders,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 100, bottom: 100, left: 80, right: 80 },
    children: paragraphs,
  });
}

function buildCompanyCell(imp: NormalizedImporterReport, label: string): TableCell {
  return new TableCell({
    width: { size: COL_WIDTHS.companyName, type: WidthType.DXA },
    borders,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 100, bottom: 100, left: 80, right: 80 },
    children: [
      new Paragraph({
        spacing: { after: 60 },
        children: [cellText(cleanMarkdown(imp.companyName).toUpperCase(), { size: 16, bold: true, color: '0F172A' })],
      }),
      new Paragraph({
        spacing: { after: 0 },
        children: [
          new TextRun({ text: `[${label}]`, font: 'Arial', size: 14, italics: true, color: '64748B' }),
        ],
      }),
    ],
  });
}

function buildSNOCell(sNo: number): TableCell {
  return new TableCell({
    width: { size: COL_WIDTHS.sNo, type: WidthType.DXA },
    borders,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 100, bottom: 100, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: String(sNo), font: 'Arial', size: 16, bold: true, color: '334155' })],
      }),
    ],
  });
}

export async function generateDocxReport(
  contacts: ReportCompanyContact[],
  reportType: 'importer' | 'exporter' = 'importer',
  tradeIndex?: TradeIndex,
  prebuiltReport?: ContactReport
): Promise<Buffer> {
  const report = prebuiltReport ?? (await buildContactReport(contacts, reportType, tradeIndex));
  const labels = getReportColumnLabels(reportType);
  const reportTitle = getReportTitle(reportType);

  const docChildren: any[] = [];

  const titleBannerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'F0F9FF' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 12, color: '0284C7' },
              bottom: { style: BorderStyle.SINGLE, size: 12, color: '0284C7' },
              left: { style: BorderStyle.SINGLE, size: 12, color: '0284C7' },
              right: { style: BorderStyle.SINGLE, size: 12, color: '0284C7' },
            },
            margins: { top: 180, bottom: 180, left: 240, right: 240 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: reportTitle,
                    font: 'Arial',
                    size: 28,
                    bold: true,
                    color: '0284C7',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  docChildren.push(titleBannerTable);
  docChildren.push(new Paragraph({ spacing: { after: 300 }, children: [] }));

  for (const section of report.countrySections) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 400, after: 160 },
        children: [
          new TextRun({
            text: section.country.toUpperCase(),
            font: 'Arial',
            size: 20,
            bold: true,
            color: '0F172A',
          }),
        ],
      })
    );

    const tableRows: TableRow[] = [];

    // Header row (repeats across pages via tableHeader)
    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: COL_WIDTHS.sNo, type: WidthType.DXA },
            shading: { fill: 'F1F5F9' },
            borders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'S.No', font: 'Arial', size: 16, bold: true, color: '1E293B' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: COL_WIDTHS.companyName, type: WidthType.DXA },
            shading: { fill: 'F1F5F9' },
            borders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: labels.nameHeader, font: 'Arial', size: 16, bold: true, color: '1E293B' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: COL_WIDTHS.tradeHistory, type: WidthType.DXA },
            shading: { fill: 'F1F5F9' },
            borders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: labels.historyHeader, font: 'Arial', size: 16, bold: true, color: '1E293B' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: COL_WIDTHS.leadership, type: WidthType.DXA },
            shading: { fill: 'F1F5F9' },
            borders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'CEO / Leadership / Decision Makers', font: 'Arial', size: 16, bold: true, color: '1E293B' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: COL_WIDTHS.contactInfo, type: WidthType.DXA },
            shading: { fill: 'F1F5F9' },
            borders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Contact Information & Address', font: 'Arial', size: 16, bold: true, color: '1E293B' })],
              }),
            ],
          }),
        ],
      })
    );

    for (const imp of section.importers) {
      tableRows.push(
        new TableRow({
          children: [
            buildSNOCell(imp.sNo),
            buildCompanyCell(imp, labels.entityLabel),
            buildTradeCell(imp),
            buildLeadershipCell(imp),
            buildContactCell(imp),
          ],
        })
      );
    }

    docChildren.push(
      new Table({
        width: {
          size: COL_WIDTHS.sNo + COL_WIDTHS.companyName + COL_WIDTHS.tradeHistory + COL_WIDTHS.leadership + COL_WIDTHS.contactInfo,
          type: WidthType.DXA,
        },
        rows: tableRows,
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080,
              bottom: 1080,
              left: 1080,
              right: 1080,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
