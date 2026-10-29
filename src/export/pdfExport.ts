import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import { LectureMetadata, TopicSection, GlossaryItem, downloadBlob } from './docxExport';

/**
 * Wraps text into lines that do not exceed maxWidth given a font and size.
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generates an academic PDF document adhering to:
 * - Font: TimesRoman
 * - Body: 12pt, double line-spacing (24pt line height)
 * - Topic headings: 13pt bold
 * - Metadata header block with 5 fields
 * - Italic "Keywords:" line per topic
 * - Bulleted summaries
 * - Alphabetical keyword glossary at the end
 * - Manual pagination with page numbers
 */
export async function generatePdf(
  metadata: LectureMetadata,
  sections: TopicSection[],
  glossary: GlossaryItem[]
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const pageWidth = 612; // Letter size
  const pageHeight = 792;
  const margin = 54;
  const contentWidth = pageWidth - margin * 2;
  const bottomThreshold = margin + 36;

  // Double line spacing: line height for 12pt font is 24pt
  const bodyFontSize = 12;
  const bodyLineHeight = 22; // academic double-spaced appearance
  const headingFontSize = 13;
  const titleFontSize = 16;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < bottomThreshold) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // 1. Title
  const titleText = metadata.lectureTopic || 'Lecture Notes';
  const titleWidth = fontBold.widthOfTextAtSize(titleText, titleFontSize);
  currentPage.drawText(titleText, {
    x: margin + (contentWidth - titleWidth) / 2,
    y: y,
    size: titleFontSize,
    font: fontBold,
    color: rgb(0.07, 0.24, 0.24), // #113C3C
  });
  y -= 30;

  // 2. Metadata Header Box
  const metaRows = [
    { label: 'Course Title', val: metadata.courseTitle || 'Untitled Course' },
    { label: 'Course Code', val: metadata.courseCode || 'N/A' },
    { label: 'Lecturer', val: metadata.lecturer || 'N/A' },
    { label: 'Date', val: metadata.date || new Date().toISOString().split('T')[0] },
    { label: 'Lecture Topic', val: metadata.lectureTopic || 'General Lecture' },
  ];

  metaRows.forEach((row) => {
    ensureSpace(18);
    currentPage.drawText(`${row.label}: `, {
      x: margin,
      y: y,
      size: 11,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.25),
    });
    const labelWidth = fontBold.widthOfTextAtSize(`${row.label}: `, 11);
    currentPage.drawText(row.val, {
      x: margin + labelWidth,
      y: y,
      size: 11,
      font: fontRegular,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 16;
  });

  // Divider rule
  y -= 6;
  currentPage.drawLine({
    start: { x: margin, y: y },
    end: { x: pageWidth - margin, y: y },
    thickness: 0.75,
    color: rgb(0.78, 0.82, 0.85),
  });
  y -= 22;

  // 3. Topic Sections
  sections.forEach((sec, idx) => {
    // Topic Heading (13pt Bold)
    ensureSpace(40);
    const headingText = `${idx + 1}. ${sec.heading}`;
    currentPage.drawText(headingText, {
      x: margin,
      y: y,
      size: headingFontSize,
      font: fontBold,
      color: rgb(0.06, 0.46, 0.43), // #0F766E
    });
    y -= 20;

    // Keywords Line (11pt Italic)
    ensureSpace(20);
    const kwPrefix = 'Keywords: ';
    const kwText = sec.keywords.join(', ');
    const kwLines = wrapText(`${kwPrefix}${kwText}`, fontItalic, 11, contentWidth);
    kwLines.forEach((kwLine) => {
      ensureSpace(16);
      currentPage.drawText(kwLine, {
        x: margin,
        y: y,
        size: 11,
        font: fontItalic,
        color: rgb(0.3, 0.35, 0.4),
      });
      y -= 15;
    });
    y -= 6;

    // Bullet Points (12pt Body, double-spaced)
    sec.bullets.forEach((bullet) => {
      const bulletLines = wrapText(bullet, fontRegular, bodyFontSize, contentWidth - 16);
      bulletLines.forEach((line, lineIdx) => {
        ensureSpace(bodyLineHeight);
        if (lineIdx === 0) {
          // Bullet dot
          currentPage.drawText('•', {
            x: margin + 2,
            y: y,
            size: bodyFontSize,
            font: fontRegular,
            color: rgb(0.15, 0.2, 0.2),
          });
        }
        currentPage.drawText(line, {
          x: margin + 16,
          y: y,
          size: bodyFontSize,
          font: fontRegular,
          color: rgb(0.1, 0.12, 0.15),
        });
        y -= bodyLineHeight;
      });
    });

    y -= 10;
  });

  // 4. Alphabetical Keyword Glossary
  if (glossary && glossary.length > 0) {
    ensureSpace(60);
    y -= 10;
    currentPage.drawLine({
      start: { x: margin, y: y },
      end: { x: pageWidth - margin, y: y },
      thickness: 0.75,
      color: rgb(0.78, 0.82, 0.85),
    });
    y -= 22;

    currentPage.drawText('Alphabetical Keyword Glossary', {
      x: margin,
      y: y,
      size: headingFontSize,
      font: fontBold,
      color: rgb(0.07, 0.24, 0.24),
    });
    y -= 22;

    glossary.forEach((item) => {
      const termHeader = `• ${item.term}: `;
      const termWidth = fontBold.widthOfTextAtSize(termHeader, bodyFontSize);
      const defText = item.example || `Key lecture concept (occurrences: ${item.count}).`;
      const defLines = wrapText(defText, fontRegular, bodyFontSize, contentWidth - termWidth - 8);

      ensureSpace(bodyLineHeight);
      currentPage.drawText(termHeader, {
        x: margin,
        y: y,
        size: bodyFontSize,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      if (defLines.length > 0) {
        currentPage.drawText(defLines[0], {
          x: margin + termWidth,
          y: y,
          size: bodyFontSize,
          font: fontRegular,
          color: rgb(0.15, 0.15, 0.15),
        });
        y -= bodyLineHeight;

        for (let i = 1; i < defLines.length; i++) {
          ensureSpace(bodyLineHeight);
          currentPage.drawText(defLines[i], {
            x: margin + 16,
            y: y,
            size: bodyFontSize,
            font: fontRegular,
            color: rgb(0.15, 0.15, 0.15),
          });
          y -= bodyLineHeight;
        }
      } else {
        y -= bodyLineHeight;
      }
    });
  }

  // 5. Draw page numbers on all pages
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    const footerText = `Page ${i + 1} of ${totalPages}`;
    const footerWidth = fontRegular.widthOfTextAtSize(footerText, 10);
    p.drawText(footerText, {
      x: (pageWidth - footerWidth) / 2,
      y: margin - 20,
      size: 10,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export { downloadBlob };
