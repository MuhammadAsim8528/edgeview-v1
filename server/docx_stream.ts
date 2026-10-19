// Streaming OpenXML DOCX generator.
//
// The `docx` library constructs a massive in-memory object graph (hundreds of
// thousands of Table/TableRow/TableCell/Paragraph/TextRun objects) and then
// `Packer.toBuffer` compiles it to XML, spiking RSS by multiple GB on real-world
// contact exports. This module instead renders the same report directly as
// OpenXML strings (an array of chunks, assembled once), then packs a valid DOCX
// package with the already-installed JSZip. Peak memory is bounded by the report
// model + the document.xml string (a few % of the old object graph).

import JSZip from 'jszip';
import { buildContactReport, getReportColumnLabels, getReportTitle, type ContactReport } from './contact_report_model';
import { getInternationalImporterDirectory, type InternationalImporterDirectory } from './international_importer_directory';
import { cleanMarkdown, type ReportCompanyContact } from './docx_report';

function escXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Half-point sizes (matches the previous docx-based rendering: size=14 -> 28).
const HPS = {
  title: 56,
  countryHeading: 40,
  header: 32,
  sn: 32,
  company: 32,
  companyLabel: 28,
  body: 28,
  small: 26,
  tiny: 24,
  micro: 22,
};

function run(text: string, opts: { size?: number; bold?: boolean; italics?: boolean; color?: string } = {}): string {
  const rPr: string[] = [];
  rPr.push('<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>');
  if (opts.bold) rPr.push('<w:b/>');
  if (opts.italics) rPr.push('<w:i/>');
  rPr.push(`<w:color w:val="${opts.color ?? '334155'}"/>`);
  rPr.push(`<w:sz w:val="${opts.size ?? HPS.body}"/>`);
  return `<w:r><w:rPr>${rPr.join('')}</w:rPr><w:t xml:space="preserve">${escXml(text || '')}</w:t></w:r>`;
}

function paragraph(runs: string, opts: { after?: number; before?: number; center?: boolean } = {}): string {
  const spacing: string[] = [];
  if (opts.before) spacing.push(`<w:before w:val="${opts.before}"/>`);
  if (opts.after !== undefined) spacing.push(`<w:after w:val="${opts.after}"/>`);
  const jc = opts.center ? '<w:jc w:val="center"/>' : '';
  return `<w:p><w:pPr><w:spacing${spacing.length ? ' ' + spacing.join(' ') : ''}/>${jc}</w:pPr>${runs}</w:p>`;
}

function borderAttrs(color = 'CBD5E1', size = 4): string {
  return ` w:val="single" w:sz="${size}" w:space="0" w:color="${color}"`;
}

function cell(
  children: string,
  opts: { width: number; fill?: string; valign?: 'top' | 'center'; margins?: [number, number, number, number]; header?: boolean }
): string {
  const fill = opts.fill
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.fill}"/>`
    : '';
  const valign = `<w:vAlign w:val="${opts.valign ?? 'top'}"/>`;
  const m = opts.margins ?? [100, 100, 80, 80];
  const tcMar = `<w:tcMar><w:top w:w="${m[0]}" w:type="dxa"/><w:bottom w:w="${m[1]}" w:type="dxa"/><w:left w:w="${m[2]}" w:type="dxa"/><w:right w:w="${m[3]}" w:type="dxa"/></w:tcMar>`;
  const tcBorders =
    `<w:tcBorders><w:top${borderAttrs()}/><w:bottom${borderAttrs()}/><w:left${borderAttrs()}/><w:right${borderAttrs()}/></w:tcBorders>`;
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${opts.width}" w:type="dxa"/>${tcBorders}${fill}${valign}${tcMar}</w:tcPr>${children}</w:tc>`
  );
}

const COL_WIDTHS = { sNo: 600, companyName: 2000, tradeHistory: 2200, leadership: 2280, contactInfo: 2280 };

function cellText(text: string, opts: { size?: number; bold?: boolean; italics?: boolean; color?: string } = {}): string {
  const clean = cleanMarkdown(text);
  return run(clean || 'Not found', opts);
}

function buildLeadershipCellHtml(imp: any): string {
  const paras: string[] = [];
  if (!imp.leadership.length) {
    paras.push(paragraph(run('Not found', { size: HPS.body, color: '94A3B8' }), { after: 0 }));
  } else {
    imp.leadership.forEach((p: any, pIdx: number) => {
      let title = cellText(p.name, { size: 32, bold: true, color: '1E293B' });
      if (p.designation) title += run(` (${cleanMarkdown(p.designation)})`, { size: HPS.body, color: '475569' });
      if (p.department) title += run(` [${cleanMarkdown(p.department)}]`, { size: 26, italics: true, color: '64748B' });
      paras.push(paragraph(title, { after: 20 }));
      if (p.emails.length || p.phones.length) {
        const pieces: string[] = [];
        if (p.emails.length) pieces.push(`Email: ${p.emails.join(', ')}`);
        if (p.phones.length) pieces.push(`Tel: ${p.phones.join(', ')}`);
        paras.push(paragraph(run(pieces.join(' | '), { size: HPS.tiny, italics: true, color: '64748B' }), { after: 20 }));
      }
      if (p.sources.length) {
        paras.push(paragraph(run(`Source: ${p.sources.join('; ')}`, { size: HPS.micro, color: '94A3B8' }), { after: pIdx === imp.leadership.length - 1 ? 0 : 40 }));
      }
    });
  }
  return cell(paras.join(''), { width: COL_WIDTHS.leadership, valign: 'top' });
}

function buildContactCellHtml(imp: any): string {
  const paras: string[] = [];
  const ci = imp.contactInfo;
  const label = (t: string) => run(t, { size: HPS.body, bold: true, color: '475569' });

  if (!ci.addresses.length) {
    paras.push(paragraph(label('Addr: ') + cellText('Not found')));
  } else {
    ci.addresses.forEach((a: any) => {
      let runs = label('Addr: ') + cellText(a.address);
      if (a.type) runs += run(` (${a.type})`, { size: HPS.tiny, italics: true, color: '64748B' });
      paras.push(paragraph(runs));
    });
  }
  if (ci.website) paras.push(paragraph(label('Website: ') + cellText(ci.website, { color: '0284C7' })));
  if (ci.emails.length) paras.push(paragraph(label('Email: ') + cellText(ci.emails.join(', '))));
  if (ci.phones.length) paras.push(paragraph(label('Tel: ') + cellText(ci.phones.join(', '))));
  if (ci.fax_numbers.length) paras.push(paragraph(label('Fax: ') + cellText(ci.fax_numbers.join(', '))));
  if (ci.whatsapp) paras.push(paragraph(label('WhatsApp: ') + cellText(ci.whatsapp, { color: '059669' })));
  const socials = (ci.socials || []).filter((s: any) => s && s.url);
  if (socials.length) paras.push(paragraph(label('Socials: ') + cellText(socials.map((s: any) => `${s.platform}: ${s.url}`).join(' | '))));
  if (ci.sources.length) paras.push(paragraph(label('Sources: ') + cellText(ci.sources.map((s: any) => s.url).join('; '), { size: 26, color: '64748B' })));

  return cell(paras.join(''), { width: COL_WIDTHS.contactInfo, valign: 'top' });
}

function buildTradeCellHtml(imp: any): string {
  const paras: string[] = [];
  if (!imp.tradeHistory.length) {
    paras.push(paragraph(run('Not found', { size: HPS.body, color: '94A3B8' }), { after: 0 }));
  } else {
    imp.tradeHistory.forEach((r: any, rIdx: number) => {
      let runs =
        run(`\u2022 ${cleanMarkdown(r.partnerName)}`, { size: HPS.body, bold: true, color: '334155' }) +
        run(` (${cleanMarkdown(r.country || 'Unknown')})`, { size: HPS.tiny, color: '64748B' }) +
        run(` [${r.shipmentCount || 0} shp]`, { size: HPS.tiny, italics: true, color: '0284C7' });
      const after = rIdx === imp.tradeHistory.length - 1 ? 0 : 40;
      paras.push(paragraph(runs, { after }));
      if (r.itemDescription && cleanMarkdown(r.itemDescription)) {
        paras.push(paragraph(run(cleanMarkdown(r.itemDescription), { size: HPS.micro, italics: true, color: '94A3B8' }), { after }));
      }
    });
  }
  return cell(paras.join(''), { width: COL_WIDTHS.tradeHistory, valign: 'top' });
}

function buildCompanyCellHtml(imp: any, labelText: string): string {
  const paras =
    paragraph(run(cleanMarkdown(imp.companyName).toUpperCase(), { size: 32, bold: true, color: '0F172A' }), { after: 60 }) +
    paragraph(run(`[${labelText}]`, { size: HPS.body, italics: true, color: '64748B' }), { after: 0 });
  return cell(paras, { width: COL_WIDTHS.companyName, valign: 'top' });
}

function buildSNOCellHtml(sNo: number): string {
  return cell(
    paragraph(run(String(sNo), { size: 32, bold: true, color: '334155' }), { after: 0, center: true }),
    { width: COL_WIDTHS.sNo, valign: 'center' }
  );
}

/**
 * Renders the ContactReport to a valid DOCX Buffer using direct OpenXML +
 * JSZip, keeping peak memory low. Produces the same layout as the previous
 * docx-library renderer: title banner, country headings, 5-column table with
 * repeating header row.
 */
export async function generateDocxReportStream(
  contacts: ReportCompanyContact[],
  reportType: 'importer' | 'exporter' = 'importer',
  tradeIndex?: any,
  prebuiltReport?: ContactReport
): Promise<Buffer> {
  const report = prebuiltReport ?? (await buildContactReport(contacts, reportType, tradeIndex));
  const labels = getReportColumnLabels(reportType);
  const reportTitle = getReportTitle(reportType);

  const parts: string[] = [];

  // Title banner (single-cell shaded table)
  const bannerCell =
    `<w:tc><w:tcPr><w:tcW w:w="100" w:type="pct"/>` +
    `<w:tcBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="0284C7"/><w:bottom w:val="single" w:sz="12" w:space="0" w:color="0284C7"/><w:left w:val="single" w:sz="12" w:space="0" w:color="0284C7"/><w:right w:val="single" w:sz="12" w:space="0" w:color="0284C7"/></w:tcBorders>` +
    `<w:shd w:val="clear" w:color="auto" w:fill="F0F9FF"/>` +
    `<w:tcMar><w:top w:w="180" w:type="dxa"/><w:bottom w:w="180" w:type="dxa"/><w:left w:w="240" w:type="dxa"/><w:right w:w="240" w:type="dxa"/></w:tcMar>` +
    `</w:tcPr>${paragraph(run(reportTitle, { size: HPS.title, bold: true, color: '0284C7' }), { after: 0, center: true })}</w:tc>`;
  parts.push(`<w:tbl><w:tblPr><w:tblW w:w="100" w:type="pct"/></w:tblPr><w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid><w:tr>${bannerCell}</w:tr></w:tbl>`);
  parts.push(paragraph('', { after: 300 }));

  // Header row (repeats across pages)
  const headerCells = [
    cell(paragraph(run('S.No', { size: HPS.header, bold: true, color: '1E293B' }), { after: 0, center: true }), {
      width: COL_WIDTHS.sNo,
      fill: 'F1F5F9',
      valign: 'center',
      margins: [120, 120, 100, 100],
    }),
    cell(paragraph(run(labels.nameHeader, { size: HPS.header, bold: true, color: '1E293B' }), { after: 0 }), {
      width: COL_WIDTHS.companyName,
      fill: 'F1F5F9',
      valign: 'center',
      margins: [120, 120, 100, 100],
    }),
    cell(paragraph(run(labels.historyHeader, { size: HPS.header, bold: true, color: '1E293B' }), { after: 0 }), {
      width: COL_WIDTHS.tradeHistory,
      fill: 'F1F5F9',
      valign: 'center',
      margins: [120, 120, 100, 100],
    }),
    cell(paragraph(run('CEO / Leadership / Decision Makers', { size: HPS.header, bold: true, color: '1E293B' }), { after: 0 }), {
      width: COL_WIDTHS.leadership,
      fill: 'F1F5F9',
      valign: 'center',
      margins: [120, 120, 100, 100],
    }),
    cell(paragraph(run('Contact Information & Address', { size: HPS.header, bold: true, color: '1E293B' }), { after: 0 }), {
      width: COL_WIDTHS.contactInfo,
      fill: 'F1F5F9',
      valign: 'center',
      margins: [120, 120, 100, 100],
    }),
  ].join('');
  const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headerCells}</w:tr>`;

  for (const section of report.countrySections) {
    parts.push(paragraph(run(section.country.toUpperCase(), { size: HPS.countryHeading, bold: true, color: '0F172A' }), { before: 400, after: 160 }));

    const rows: string[] = [headerRow];
    for (const imp of section.importers) {
      rows.push(
        `<w:tr>${buildSNOCellHtml(imp.sNo)}${buildCompanyCellHtml(imp, labels.entityLabel)}${buildTradeCellHtml(imp)}${buildLeadershipCellHtml(imp)}${buildContactCellHtml(imp)}</w:tr>`
      );
    }
    parts.push(
      `<w:tbl><w:tblPr><w:tblW w:w="${COL_WIDTHS.sNo + COL_WIDTHS.companyName + COL_WIDTHS.tradeHistory + COL_WIDTHS.leadership + COL_WIDTHS.contactInfo}" w:type="dxa"/></w:tblPr>` +
      `<w:tblGrid><w:gridCol w:w="${COL_WIDTHS.sNo}"/><w:gridCol w:w="${COL_WIDTHS.companyName}"/><w:gridCol w:w="${COL_WIDTHS.tradeHistory}"/><w:gridCol w:w="${COL_WIDTHS.leadership}"/><w:gridCol w:w="${COL_WIDTHS.contactInfo}"/></w:tblGrid>` +
      `${rows.join('')}</w:tbl>`
    );
  }

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${parts.join('')}` +
    `<w:sectPr><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>` +
    `</w:body></w:document>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;

  const docRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>` +
    `</Relationships>`;

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:rPrDefault></w:docDefaults>` +
    `</w:styles>`;

  const settingsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="708"/></w:settings>`;

  const coreXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${escXml(reportTitle)}</dc:title>` +
    `</cp:coreProperties>`;

  const appXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>EdgeView</Application>` +
    `</Properties>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rootRels);
  zip.file('word/document.xml', documentXml);
  zip.file('word/_rels/document.xml.rels', docRels);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/settings.xml', settingsXml);
  zip.file('docProps/core.xml', coreXml);
  zip.file('docProps/app.xml', appXml);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/**
 * Streaming DOCX renderer for the International Importer Directory. Produces a
 * compact landscape table (Importer, Traded With, Top Products, Contact &
 * Leadership, Sources) with per-country heading rows and a repeating header
 * row, all rendered directly as OpenXML to keep peak memory low. The projection
 * matches the PDF/CSV/XLSX exactly and never includes more info than the PDF.
 */
export async function generateInternationalImporterDirectoryDocx(
  contacts: ReportCompanyContact[],
  tradeIndex?: any,
  prebuiltDirectory?: InternationalImporterDirectory
): Promise<Buffer> {
  const directory = prebuiltDirectory ?? (await getInternationalImporterDirectory(contacts, tradeIndex));

  const TOTAL_DXA = 15840; // landscape usable width (11in @ 1440 DXA/in)
  const COLS = [
    { header: 'Importer', w: 2600 },
    { header: 'Traded With', w: 3400 },
    { header: 'Top Products', w: 3400 },
    { header: 'Contact & Leadership', w: 4240 },
    { header: 'Sources', w: 2200 },
  ];

  const parts: string[] = [];

  // Title banner.
  const bannerCell =
    `<w:tc><w:tcPr><w:tcW w:w="100" w:type="pct"/>` +
    `<w:tcBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="0284C7"/><w:bottom w:val="single" w:sz="12" w:space="0" w:color="0284C7"/><w:left w:val="single" w:sz="12" w:space="0" w:color="0284C7"/><w:right w:val="single" w:sz="12" w:space="0" w:color="0284C7"/></w:tcBorders>` +
    `<w:shd w:val="clear" w:color="auto" w:fill="F0F9FF"/>` +
    `<w:tcMar><w:top w:w="180" w:type="dxa"/><w:bottom w:w="180" w:type="dxa"/><w:left w:w="240" w:type="dxa"/><w:right w:w="240" w:type="dxa"/></w:tcMar>` +
    `</w:tcPr>${paragraph(run(directory.title, { size: HPS.title, bold: true, color: '0284C7' }), { after: 0, center: true })}</w:tc>`;
  parts.push(`<w:tbl><w:tblPr><w:tblW w:w="100" w:type="pct"/></w:tblPr><w:tblGrid><w:gridCol w:w="${TOTAL_DXA}"/></w:tblGrid><w:tr>${bannerCell}</w:tr></w:tbl>`);
  parts.push(paragraph('', { after: 200 }));

  const intlCellLines = (text: string): string => {
    const lines = String(text || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return '';
    return lines
      .map((l) => paragraph(run(cleanMarkdown(l), { size: HPS.body, color: '334155' }), { after: 20 }))
      .join('');
  };

  for (const section of directory.countrySections) {
    parts.push(
      paragraph(run(`INTERNATIONAL IMPORTERS — ${escXml(section.country.toUpperCase())}`, { size: HPS.countryHeading, bold: true, color: '0F172A' }), {
        before: 300,
        after: 120,
      })
    );

    const headerCells = COLS.map((col) =>
      cell(
        paragraph(run(col.header, { size: HPS.header, bold: true, color: '1E293B' }), { after: 0 }),
        {
          width: col.w,
          fill: 'F1F5F9',
          valign: 'center',
          margins: [100, 100, 80, 80],
        }
      )
    ).join('');
    const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headerCells}</w:tr>`;

    const rows: string[] = [headerRow];
    for (const row of section.importers) {
      const importerCell = cell(
        paragraph(run(cleanMarkdown(row.importer), { size: HPS.company, bold: true, color: '1E293B' }), { after: 0 }),
        { width: COLS[0].w, valign: 'top' }
      );

      const twCell = cell(intlCellLines(row.tradedWith) || paragraph(run('', { size: HPS.body }), { after: 0 }), {
        width: COLS[1].w,
        valign: 'top',
      });
      const tpCell = cell(intlCellLines(row.topProducts) || paragraph(run('', { size: HPS.body }), { after: 0 }), {
        width: COLS[2].w,
        valign: 'top',
      });

      const contactParas: string[] = [];
      if (row.email) contactParas.push(paragraph(run(`Email: ${cleanMarkdown(row.email)}`, { size: HPS.body, color: '334155' }), { after: 20 }));
      if (row.phone) contactParas.push(paragraph(run(`Phone: ${cleanMarkdown(row.phone)}`, { size: HPS.body, color: '334155' }), { after: 20 }));
      if (row.address) contactParas.push(paragraph(run(`Address: ${cleanMarkdown(row.address)}`, { size: HPS.body, color: '334155' }), { after: 20 }));
      if (row.website) contactParas.push(paragraph(run(`Website: ${cleanMarkdown(row.website)}`, { size: HPS.body, color: '0284C7' }), { after: 20 }));
      if (row.leadership) {
        row.leadership.split('\n').forEach((l) => {
          const cleanL = cleanMarkdown(l);
          if (cleanL) contactParas.push(paragraph(run(cleanL, { size: HPS.body, bold: true, color: '1E293B' }), { after: 20 }));
        });
      }
      if (contactParas.length === 0) contactParas.push(paragraph(run('', { size: HPS.body }), { after: 0 }));
      const contactCell = cell(contactParas.join(''), { width: COLS[3].w, valign: 'top' });

      const srcCell = cell(intlCellLines(row.sources) || paragraph(run('', { size: HPS.body }), { after: 0 }), {
        width: COLS[4].w,
        valign: 'top',
      });

      rows.push(`<w:tr>${importerCell}${twCell}${tpCell}${contactCell}${srcCell}</w:tr>`);
    }

    parts.push(
      `<w:tbl><w:tblPr><w:tblW w:w="${TOTAL_DXA}" w:type="dxa"/></w:tblPr>` +
      `<w:tblGrid>${COLS.map((c) => `<w:gridCol w:w="${c.w}"/>`).join('')}</w:tblGrid>` +
      `${rows.join('')}</w:tbl>`
    );
  }

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${parts.join('')}` +
    `<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>` +
    `</w:body></w:document>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;

  const docRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>` +
    `</Relationships>`;

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:rPrDefault></w:docDefaults>` +
    `</w:styles>`;

  const settingsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="708"/></w:settings>`;

  const coreXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${escXml(directory.title)}</dc:title>` +
    `</cp:coreProperties>`;

  const appXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>EdgeView</Application>` +
    `</Properties>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rootRels);
  zip.file('word/document.xml', documentXml);
  zip.file('word/_rels/document.xml.rels', docRels);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/settings.xml', settingsXml);
  zip.file('docProps/core.xml', coreXml);
  zip.file('docProps/app.xml', appXml);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
interface StreamColumnDef {
  key: string;
  header: string;
}

function sanitizeCellStr(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function blackBorderAttrs(size = 4): string {
  return ` w:val="single" w:sz="${size}" w:space="0" w:color="000000"`;
}

function borderCell(
  children: string,
  opts: { width: number; fill?: string; margins?: [number, number, number, number] }
): string {
  const fill = opts.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.fill}"/>` : '';
  const m = opts.margins ?? [100, 100, 100, 100];
  const tcMar = `<w:tcMar><w:top w:w="${m[0]}" w:type="dxa"/><w:bottom w:w="${m[1]}" w:type="dxa"/><w:left w:w="${m[2]}" w:type="dxa"/><w:right w:w="${m[3]}" w:type="dxa"/></w:tcMar>`;
  const tcBorders =
    `<w:tcBorders><w:top${blackBorderAttrs()}/><w:bottom${blackBorderAttrs()}/><w:left${blackBorderAttrs()}/><w:right${blackBorderAttrs()}/></w:tcBorders>`;
  return `<w:tc><w:tcPr><w:tcW w:w="${opts.width}" w:type="dxa"/>${tcBorders}${fill}${tcMar}</w:tcPr>${children}</w:tc>`;
}

/**
 * Streaming generic DOCX for tabular datasets (landscape, proportional columns).
 * Matches the layout of the previous docx-library renderer: blue title banner,
 * grey header row, thin black cell borders, 14400 DXA table width.
 */
export async function generateGenericDocxReportStream(
  title: string,
  columns: StreamColumnDef[],
  records: any[]
): Promise<Buffer> {
  const TOTAL_DXA = 14400;
  const colWidthMap: Record<string, number> = {
    'Date': 1200,
    'Importer': 2200,
    'Country': 1200,
    'Exporter': 2200,
    'Item': 3800,
    'Total FC': 1500,
    'NTN': 1150,
    'HS Code': 1150,
  };
  const getColDxa = (colHeader: string) =>
    colWidthMap[colHeader] ?? Math.floor(TOTAL_DXA / Math.max(columns.length, 1));

  const parts: string[] = [];

  // Blue title banner (single-cell table).
  const banner = borderCell(
    paragraph(run(`EdgeView — ${escXml(title)}`, { size: 52, bold: true, color: 'FFFFFF' }), { after: 0, center: true }),
    { width: TOTAL_DXA, fill: '0284C7', margins: [180, 180, 180, 180] }
  );
  parts.push(
    `<w:tbl><w:tblPr><w:tblW w:w="${TOTAL_DXA}" w:type="dxa"/></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="${TOTAL_DXA}"/></w:tblGrid><w:tr>${banner}</w:tr></w:tbl>`
  );
  parts.push(paragraph('', { after: 200 }));

  const headerCells = columns
    .map((col) =>
      borderCell(
        paragraph(run(escXml(col.header), { size: 32, bold: true, color: '111827' }), { after: 0 }),
        { width: getColDxa(col.header), fill: 'E5E7EB', margins: [120, 120, 100, 100] }
      )
    )
    .join('');
  const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headerCells}</w:tr>`;

  const dataRow = (rec: any) =>
    `<w:tr>${columns
      .map((col) => {
        const val = sanitizeCellStr(rec[col.key] ?? rec[col.header] ?? '');
        return borderCell(
          paragraph(run(escXml(val || '\u2014'), { size: 28, color: '374151' }), { after: 0 }),
          { width: getColDxa(col.header), margins: [100, 100, 100, 100] }
        );
      })
      .join('')}</w:tr>`;

  const rowChunks: string[] = [headerRow];
  for (const rec of records) {
    rowChunks.push(dataRow(rec));
  }
  parts.push(
    `<w:tbl><w:tblPr><w:tblW w:w="${TOTAL_DXA}" w:type="dxa"/></w:tblPr>` +
    `<w:tblGrid>${columns.map((c) => `<w:gridCol w:w="${getColDxa(c.header)}"/>`).join('')}</w:tblGrid>` +
    `${rowChunks.join('')}</w:tbl>`
  );

  // Landscape section with 720 twip margins.
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${parts.join('')}` +
    `<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>` +
    `</w:body></w:document>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;

  const docRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>` +
    `</Relationships>`;

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:rPrDefault></w:docDefaults>` +
    `</w:styles>`;

  const settingsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="708"/></w:settings>`;

  const coreXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${escXml(title)}</dc:title>` +
    `</cp:coreProperties>`;

  const appXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>EdgeView</Application>` +
    `</Properties>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rootRels);
  zip.file('word/document.xml', documentXml);
  zip.file('word/_rels/document.xml.rels', docRels);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/settings.xml', settingsXml);
  zip.file('docProps/core.xml', coreXml);
  zip.file('docProps/app.xml', appXml);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}