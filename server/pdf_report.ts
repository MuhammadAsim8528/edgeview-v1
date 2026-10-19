import PDFDocument from 'pdfkit';
import { cleanMarkdown, type ReportCompanyContact } from './docx_report';
import { buildContactReport, getReportColumnLabels, getReportTitle, type NormalizedImporterReport, type TradeIndex, type ContactReport } from './contact_report_model';
import { getInternationalImporterDirectory, type InternationalImporterDirectory, type InternationalImporterRow } from './international_importer_directory';

interface PDFCellLine {
  text: string;
  font: string;
  size: number;
  color: string;
  h: number;
  align?: 'left' | 'center' | 'right';
}

interface ColLines {
  lines: PDFCellLine[];
  x: number;
  w: number;
}

function stripMd(text: string | null | undefined): string {
  return cleanMarkdown(text);
}

export async function generatePdfReport(
  contacts: ReportCompanyContact[],
  reportType: 'importer' | 'exporter' = 'importer',
  tradeIndex?: TradeIndex,
  prebuiltReport?: ContactReport
): Promise<Buffer> {
  const report = prebuiltReport ?? (await buildContactReport(contacts, reportType, tradeIndex));
  const labels = getReportColumnLabels(reportType);
  const reportTitle = getReportTitle(reportType);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 54,
        size: 'LETTER',
        autoFirstPage: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const MARGIN = 54;
      const PAGE_WIDTH = doc.page.width; // 612
      const PAGE_HEIGHT = doc.page.height; // 792
      const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 504
      const BOTTOM = PAGE_HEIGHT - MARGIN - 8;
      const PADDING = 5;

      // 5-Column Specifications
      const COLS = {
        sNo: { x: MARGIN, w: 28 },
        companyName: { x: MARGIN + 28, w: 138 },
        tradeHistory: { x: MARGIN + 28 + 138, w: 112 },
        leadership: { x: MARGIN + 28 + 138 + 112, w: 112 },
        contactInfo: { x: MARGIN + 28 + 138 + 112 + 112, w: 114 },
      };

      let pageNum = 1;

      const addPageHeader = (isFirstPage: boolean) => {
        doc.fillColor('#F8FAFC')
           .rect(MARGIN, MARGIN - 18, CONTENT_WIDTH, 26)
           .fill();
        doc.lineWidth(0.5)
           .strokeColor('#CBD5E1')
           .rect(MARGIN, MARGIN - 18, CONTENT_WIDTH, 26)
           .stroke();
        doc.fillColor('#0F172A')
           .font('Helvetica-Bold')
           .fontSize(9)
           .text(reportTitle, MARGIN, MARGIN - 10, {
             width: CONTENT_WIDTH,
             align: 'center',
           });
        doc.y = MARGIN + 25;
      };

      const addPageFooter = () => {
        const savedY = doc.y;
        doc.fillColor('#64748B')
           .font('Helvetica')
           .fontSize(8)
           .text(`Page ${pageNum}`, MARGIN, PAGE_HEIGHT - MARGIN - 14, {
             width: CONTENT_WIDTH,
             align: 'right',
           });
        doc.y = savedY;
      };

      addPageHeader(true);
      addPageFooter();
      let currentY = doc.y;

      // Big document title on first page
      doc.fillColor('#0284C7')
         .font('Helvetica-Bold')
         .fontSize(14)
         .text(reportTitle, MARGIN, currentY, { align: 'center' });
      currentY += 28;

      // Word-wrap a string into single lines that fit the given width.
      const wrapLines = (text: string, width: number, font: string, size: number): string[] => {
        const words = String(text).split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let current = '';
        const measure = (t: string) => doc.font(font).fontSize(size).widthOfString(t);
        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          if (measure(candidate) <= width) {
            current = candidate;
          } else {
            if (current) lines.push(current);
            let remainder = word;
            while (measure(remainder) > width && remainder.length > 1) {
              let cut = remainder.length;
              while (cut > 1 && measure(remainder.slice(0, cut)) > width) cut--;
              lines.push(remainder.slice(0, cut));
              remainder = remainder.slice(cut);
            }
            current = remainder;
          }
        }
        if (current) lines.push(current);
        return lines;
      };

      const lineHeight = (font: string, size: number): number => {
        doc.font(font).fontSize(size);
        return doc.heightOfString('Ag', { width: 200 });
      };

      const toLines = (text: string, width: number, font: string, size: number, color: string, align?: 'left' | 'center' | 'right'): PDFCellLine[] => {
        const h = lineHeight(font, size);
        return wrapLines(text, width - PADDING * 2, font, size).map((t) => ({
          text: t,
          font,
          size,
          color,
          h,
          align,
        }));
      };

      const drawTableHeader = (startY: number) => {
        const headerHeight = 26;
        doc.fillColor('#F1F5F9')
           .rect(MARGIN, startY, CONTENT_WIDTH, headerHeight)
           .fill();
        doc.fillColor('#1E293B')
           .font('Helvetica-Bold')
           .fontSize(7);

        const headers: Array<[string, number, number, 'left' | 'center']> = [
          ['S.No', COLS.sNo.x, COLS.sNo.w, 'center'],
          [labels.nameHeader, COLS.companyName.x, COLS.companyName.w, 'left'],
          [labels.historyHeader, COLS.tradeHistory.x, COLS.tradeHistory.w, 'left'],
          ['CEO / Leadership / Decision Makers', COLS.leadership.x, COLS.leadership.w, 'left'],
          ['Contact Information & Address', COLS.contactInfo.x, COLS.contactInfo.w, 'left'],
        ];
        headers.forEach(([text, x, w, align]) => {
          doc.text(text, x + PADDING, startY + 6, { width: w - PADDING * 2, align });
        });

        doc.lineWidth(0.5)
           .strokeColor('#CBD5E1')
           .rect(MARGIN, startY, CONTENT_WIDTH, headerHeight)
           .stroke();
        return startY + headerHeight;
      };

      const drawLineAt = (line: PDFCellLine, x: number, w: number, y: number) => {
        doc.font(line.font)
           .fontSize(line.size)
           .fillColor(line.color)
           .text(line.text, x + PADDING, y, { width: w - PADDING * 2, align: line.align || 'left' });
      };

      // Build the five cell line-banks for one importer.
      const buildRowColumns = (imp: NormalizedImporterReport): ColLines[] => {
        const col0: PDFCellLine[] = [{
          text: String(imp.sNo),
          font: 'Helvetica-Bold',
          size: 8,
          color: '#475569',
          h: lineHeight('Helvetica-Bold', 8),
          align: 'center',
        }];

        const col1: PDFCellLine[] = [];
        col1.push(...toLines(stripMd(imp.companyName).toUpperCase(), COLS.companyName.w, 'Helvetica-Bold', 8.5, '#0F172A'));
        col1.push(...toLines(`[${labels.entityLabel}]`, COLS.companyName.w, 'Helvetica-Oblique', 7, '#64748B'));

        const col2: PDFCellLine[] = [];
        if (imp.tradeHistory.length > 0) {
          imp.tradeHistory.forEach((r) => {
            const partner = stripMd(r.partnerName);
            const country = stripMd(r.country || 'Unknown');
            const count = r.shipmentCount || 0;
            col2.push(...toLines(`• ${partner} (${country}) [${count} shp]`, COLS.tradeHistory.w, 'Helvetica', 7.5, '#334155'));
            if (r.itemDescription && stripMd(r.itemDescription)) {
              col2.push(...toLines(`   ${stripMd(r.itemDescription)}`, COLS.tradeHistory.w, 'Helvetica-Oblique', 6.5, '#64748B'));
            }
          });
        } else {
          col2.push(...toLines('Not found', COLS.tradeHistory.w, 'Helvetica', 7.5, '#94A3B8'));
        }

        const col3: PDFCellLine[] = [];
        if (imp.leadership.length > 0) {
          imp.leadership.forEach((p) => {
            let title = stripMd(p.name);
            if (p.designation) title += ` (${stripMd(p.designation)})`;
            if (p.department) title += ` [${stripMd(p.department)}]`;
            col3.push(...toLines(title, COLS.leadership.w, 'Helvetica-Bold', 8, '#1E293B'));
            if (p.emails.length > 0 || p.phones.length > 0) {
              const details = [...p.emails, ...p.phones].join(' | ');
              col3.push(...toLines(details, COLS.leadership.w, 'Helvetica-Oblique', 6.5, '#475569'));
            }
            if (p.sources.length > 0) {
              col3.push(...toLines(`Source: ${p.sources.join('; ')}`, COLS.leadership.w, 'Helvetica', 6, '#94A3B8'));
            }
          });
        } else {
          col3.push(...toLines('Not found', COLS.leadership.w, 'Helvetica', 7.5, '#94A3B8'));
        }

        const col4: PDFCellLine[] = [];
        const ci = imp.contactInfo;
        if (ci.addresses.length > 0) {
          ci.addresses.forEach((a) => {
            col4.push(...toLines(`Addr: ${stripMd(a.address)}`, COLS.contactInfo.w, 'Helvetica', 7, '#334155'));
          });
        } else {
          col4.push(...toLines('Addr: Not found', COLS.contactInfo.w, 'Helvetica', 7, '#334155'));
        }
        if (ci.website) {
          col4.push(...toLines(`Website: ${stripMd(ci.website)}`, COLS.contactInfo.w, 'Helvetica', 7, '#0284C7'));
        }
        if (ci.emails.length > 0) {
          col4.push(...toLines(`Email: ${ci.emails.join(', ')}`, COLS.contactInfo.w, 'Helvetica', 7, '#334155'));
        }
        if (ci.phones.length > 0) {
          col4.push(...toLines(`Tel: ${ci.phones.join(', ')}`, COLS.contactInfo.w, 'Helvetica', 7, '#334155'));
        }
        if (ci.fax_numbers.length > 0) {
          col4.push(...toLines(`Fax: ${ci.fax_numbers.join(', ')}`, COLS.contactInfo.w, 'Helvetica', 7, '#334155'));
        }
        if (ci.whatsapp) {
          col4.push(...toLines(`WhatsApp: ${stripMd(ci.whatsapp)}`, COLS.contactInfo.w, 'Helvetica', 7, '#10B981'));
        }
        const socials = (ci.socials || [])
          .filter((s) => s && s.url)
          .map((s) => `${s.platform}: ${stripMd(s.url)}`);
        if (socials.length > 0) {
          col4.push(...toLines(`Socials: ${socials.join(' | ')}`, COLS.contactInfo.w, 'Helvetica', 7, '#334155'));
        }
        if (ci.sources.length > 0) {
          col4.push(...toLines(`Sources: ${ci.sources.map((s) => stripMd(s.url)).join('; ')}`, COLS.contactInfo.w, 'Helvetica', 6, '#64748B'));
        }

        return [
          { lines: col0, x: COLS.sNo.x, w: COLS.sNo.w },
          { lines: col1, x: COLS.companyName.x, w: COLS.companyName.w },
          { lines: col2, x: COLS.tradeHistory.x, w: COLS.tradeHistory.w },
          { lines: col3, x: COLS.leadership.x, w: COLS.leadership.w },
          { lines: col4, x: COLS.contactInfo.x, w: COLS.contactInfo.w },
        ];
      };

      // Render one importer as a table row that may span multiple pages. No line is
      // ever dropped: content flows onto a new page and continues.
      const renderRow = (imp: NormalizedImporterReport, cols: ColLines[]) => {
        const cursors = [0, 0, 0, 0, 0];
        let firstSeg = true;
        const contName = stripMd(imp.companyName).toUpperCase();
        const contH = lineHeight('Helvetica-Bold', 7);

        const drawVerticalGrid = (y: number, h: number) => {
          doc.lineWidth(0.5).strokeColor('#CBD5E1');
          doc.lineCap('butt')
             .moveTo(COLS.sNo.x, y).lineTo(COLS.sNo.x, y + h)
             .moveTo(COLS.companyName.x, y).lineTo(COLS.companyName.x, y + h)
             .moveTo(COLS.tradeHistory.x, y).lineTo(COLS.tradeHistory.x, y + h)
             .moveTo(COLS.leadership.x, y).lineTo(COLS.leadership.x, y + h)
             .moveTo(COLS.contactInfo.x, y).lineTo(COLS.contactInfo.x, y + h)
             .moveTo(MARGIN + CONTENT_WIDTH, y).lineTo(MARGIN + CONTENT_WIDTH, y + h)
             .stroke();
          doc.moveTo(MARGIN, y + h).lineTo(MARGIN + CONTENT_WIDTH, y + h).stroke();
        };

        while (true) {
          const remaining = BOTTOM - currentY;
          if (remaining < 14) {
            doc.addPage();
            pageNum++;
            addPageHeader(false);
            addPageFooter();
            currentY = drawTableHeader(doc.y);
            firstSeg = false;
            continue;
          }

          const used = [0, 0, 0, 0, 0];

          // Column 0: S.No appears only on the first segment of the row.
          if (firstSeg && cursors[0] < cols[0].lines.length) {
            drawLineAt(cols[0].lines[0], cols[0].x, cols[0].w, currentY);
            used[0] = cols[0].lines[0].h;
            cursors[0]++;
          }

          for (let ci = 1; ci < 5; ci++) {
            let y = currentY;
            if (ci === 1 && !firstSeg) {
              const label = `${contName} (continued)`;
              doc.font('Helvetica-Bold').fontSize(7).fillColor('#0F172A')
                 .text(label, cols[1].x + PADDING, y, { width: cols[1].w - PADDING * 2 });
              used[1] += contH;
              y += contH;
            }
            while (
              cursors[ci] < cols[ci].lines.length &&
              used[ci] + cols[ci].lines[cursors[ci]].h <= remaining
            ) {
              const line = cols[ci].lines[cursors[ci]];
              drawLineAt(line, cols[ci].x, cols[ci].w, y);
              y += line.h;
              used[ci] += line.h;
              cursors[ci]++;
            }
          }

          const segH = Math.max(4, ...used);
          if (segH <= 0) {
            doc.addPage();
            pageNum++;
            addPageHeader(false);
            addPageFooter();
            currentY = drawTableHeader(doc.y);
            firstSeg = false;
            continue;
          }

          drawVerticalGrid(currentY, segH);

          const anyLeft = cursors.some((c, ci) => c < cols[ci].lines.length && (ci !== 0 || firstSeg));
          if (anyLeft) {
            doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#94A3B8')
               .text('— continued —', MARGIN + CONTENT_WIDTH - 64, currentY + segH - 9, { width: 60, align: 'right' });
            currentY = BOTTOM;
            doc.addPage();
            pageNum++;
            addPageHeader(false);
            addPageFooter();
            currentY = drawTableHeader(doc.y);
            firstSeg = false;
            continue;
          }

          currentY += segH;
          break;
        }
      };

      // Country sections
      for (const section of report.countrySections) {
        if (currentY + 24 + 26 + 16 > BOTTOM) {
          doc.addPage();
          pageNum++;
          addPageHeader(false);
          addPageFooter();
          currentY = drawTableHeader(doc.y);
        }

        doc.fillColor('#0F172A')
           .font('Helvetica-Bold')
           .fontSize(11)
           .text(section.country.toUpperCase(), MARGIN, currentY + 4);
        currentY += 24;

        currentY = drawTableHeader(currentY);

        for (const imp of section.importers) {
          const cols = buildRowColumns(imp);
          renderRow(imp, cols);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

interface IntlBlockLine {
  text: string;
  font: string;
  size: number;
  color: string;
  indent?: number;
  beforeSpace?: number;
}

/**
 * Renders the International Importer Directory to a LETTER PDF.
 *
 * Layout (compact, professional, no fabrication):
 *   - Every page carries the header "EDGEVIEW — INTERNATIONAL IMPORTER
 *     DIRECTORY / Country: <country>" so the country is always identifiable;
 *     continuation pages are marked "— Continued".
 *   - Countries appear A→Z as "INTERNATIONAL IMPORTERS — <COUNTRY>" headings,
 *     never orphaned from their first importer.
 *   - Each importer is a compact block: name, Traded With (unique partners),
 *     Top Products, Contact (only known fields), Leadership (only known
 *     people), and a concise Source line. No shipment-by-shipment history.
 *   - No blank pages and no overflow: lines are drawn one at a time with a
 *     page-break check, and long text wraps within the content width.
 */
export async function generateInternationalImporterDirectoryPdf(
  contacts: ReportCompanyContact[],
  tradeIndex?: TradeIndex,
  prebuiltDirectory?: InternationalImporterDirectory
): Promise<Buffer> {
  const directory = prebuiltDirectory ?? (await getInternationalImporterDirectory(contacts, tradeIndex));

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 54,
        size: 'LETTER',
        autoFirstPage: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const MARGIN = 54;
      const PAGE_WIDTH = doc.page.width; // 612
      const PAGE_HEIGHT = doc.page.height; // 792
      const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 504
      const BOTTOM = PAGE_HEIGHT - MARGIN - 18;
      const PADDING = 5;

      let pageNum = 1;
      let activeCountry = '';

      const addPageHeader = (continued: boolean) => {
        doc.fillColor('#F8FAFC')
           .rect(MARGIN, MARGIN - 18, CONTENT_WIDTH, 26)
           .fill();
        doc.lineWidth(0.5)
           .strokeColor('#CBD5E1')
           .rect(MARGIN, MARGIN - 18, CONTENT_WIDTH, 26)
           .stroke();
        doc.fillColor('#0F172A')
           .font('Helvetica-Bold')
           .fontSize(9)
           .text(
             `EDGEVIEW — INTERNATIONAL IMPORTER DIRECTORY / Country: ${activeCountry || ''}${continued ? ' — Continued' : ''}`,
             MARGIN,
             MARGIN - 10,
             { width: CONTENT_WIDTH, align: 'center' }
           );
        doc.y = MARGIN + 25;
      };

      const addPageFooter = () => {
        const savedY = doc.y;
        doc.fillColor('#64748B')
           .font('Helvetica')
           .fontSize(8)
           .text(`Page ${pageNum}`, MARGIN, PAGE_HEIGHT - MARGIN - 16, {
             width: CONTENT_WIDTH,
             align: 'right',
           });
        doc.y = savedY;
      };

      const wrapLines = (text: string, width: number, font: string, size: number): string[] => {
        const words = String(text).split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let current = '';
        const measure = (t: string) => doc.font(font).fontSize(size).widthOfString(t);
        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          if (measure(candidate) <= width) {
            current = candidate;
          } else {
            if (current) lines.push(current);
            let remainder = word;
            while (measure(remainder) > width && remainder.length > 1) {
              let cut = remainder.length;
              while (cut > 1 && measure(remainder.slice(0, cut)) > width) cut--;
              lines.push(remainder.slice(0, cut));
              remainder = remainder.slice(cut);
            }
            current = remainder;
          }
        }
        if (current) lines.push(current);
        return lines;
      };

      const lineHeight = (font: string, size: number): number => {
        doc.font(font).fontSize(size);
        return doc.heightOfString('Ag', { width: 200 });
      };

      addPageHeader(false);
      addPageFooter();
      let currentY = doc.y;

      // Big document title on first page.
      doc.fillColor('#0284C7')
         .font('Helvetica-Bold')
         .fontSize(13)
         .text(directory.title, MARGIN, currentY, { align: 'center' });
      currentY += 28;

      const ensureVerticalRoom = (needed: number, continued: boolean) => {
        if (currentY + needed > BOTTOM) {
          doc.addPage();
          pageNum++;
          addPageHeader(continued);
          addPageFooter();
          currentY = doc.y;
        }
      };

      for (const section of directory.countrySections) {
        activeCountry = section.country;

        // Reserve room for the heading + the first importer line so a heading
        // is never orphaned at the bottom of a page.
        const headingH = 20;
        ensureVerticalRoom(headingH + 24, true);

        doc.fillColor('#E0F2FE')
           .rect(MARGIN, currentY, CONTENT_WIDTH, 18)
           .fill();
        doc.lineWidth(0.5)
           .strokeColor('#0284C7')
           .rect(MARGIN, currentY, CONTENT_WIDTH, 18)
           .stroke();
        doc.fillColor('#0F172A')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text(`INTERNATIONAL IMPORTERS — ${section.country.toUpperCase()}`, MARGIN + 6, currentY + 4);
        currentY += headingH;

        for (const imp of section.importers) {
          const block: IntlBlockLine[] = [];
          block.push({
            text: cleanMarkdown(imp.importer),
            font: 'Helvetica-Bold',
            size: 9,
            color: '#0F172A',
            beforeSpace: 8,
          });

          const addLabeled = (label: string, body: string) => {
            if (!body) return;
            block.push({ text: label, font: 'Helvetica-Bold', size: 7.5, color: '#475569' });
            for (const b of String(body).split('\n')) {
              block.push({ text: b, font: 'Helvetica', size: 7.5, color: '#334155', indent: 12 });
            }
          };

          addLabeled('Traded With', imp.tradedWith);
          addLabeled('Top Products', imp.topProducts);

          const contactPieces: string[] = [];
          if (imp.email) contactPieces.push(`Email: ${cleanMarkdown(imp.email)}`);
          if (imp.phone) contactPieces.push(`Phone: ${cleanMarkdown(imp.phone)}`);
          if (imp.address) contactPieces.push(`Address: ${cleanMarkdown(imp.address)}`);
          if (imp.website) contactPieces.push(`Website: ${cleanMarkdown(imp.website)}`);
          if (contactPieces.length > 0) {
            addLabeled('Contact', contactPieces.join('  |  '));
          }

          if (imp.leadership) {
            addLabeled('Leadership', String(imp.leadership).replace(/\n/g, '; '));
          }
          if (imp.sources) {
            block.push({ text: cleanMarkdown(imp.sources), font: 'Helvetica-Oblique', size: 6.5, color: '#64748B' });
          }

          for (const line of block) {
            if (line.beforeSpace) currentY += line.beforeSpace;
            const indent = line.indent || 0;
            const wrapped = wrapLines(line.text, CONTENT_WIDTH - indent - PADDING * 2, line.font, line.size);
            const h = lineHeight(line.font, line.size);
            for (const w of wrapped) {
              if (currentY + h > BOTTOM) {
                doc.addPage();
                pageNum++;
                addPageHeader(true);
                addPageFooter();
                currentY = doc.y;
                doc.fillColor('#64748B')
                   .font('Helvetica-Oblique')
                   .fontSize(6.5)
                   .text(`${section.country.toUpperCase()} — continued`, MARGIN, currentY, {
                     width: CONTENT_WIDTH,
                     align: 'right',
                   });
                currentY += 10;
              }
              doc.font(line.font).fontSize(line.size).fillColor(line.color).text(w, MARGIN + indent + PADDING, currentY, {
                width: CONTENT_WIDTH - indent - PADDING * 2,
              });
              currentY += h;
            }
          }
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}