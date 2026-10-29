import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';

export interface LectureMetadata {
  courseTitle: string;
  courseCode: string;
  lecturer: string;
  date: string;
  lectureTopic: string;
}

export interface TopicSection {
  id: string;
  heading: string;
  keywords: string[];
  bullets: string[];
  sentences?: string[];
}

export interface GlossaryItem {
  term: string;
  count: number;
  example: string;
}

/**
 * Generates an academic DOCX document adhering to:
 * - Font: Times New Roman
 * - Body: 12pt, double-spaced (line spacing 480 dxa)
 * - Topic headings: 13pt bold (size 26)
 * - Metadata header block with 5 fields
 * - Italic "Keywords:" line per topic
 * - Bulleted summaries
 * - Alphabetical keyword glossary at the end
 */
export async function generateDocx(
  metadata: LectureMetadata,
  sections: TopicSection[],
  glossary: GlossaryItem[]
): Promise<Blob> {
  const fontName = 'Times New Roman';
  const doubleSpacing = { line: 480, lineRule: 'auto' as const };
  const singleSpacing = { line: 240, lineRule: 'auto' as const };

  const children: Paragraph[] = [];

  // Document Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: metadata.lectureTopic || 'Lecture Notes',
          font: fontName,
          size: 32, // 16pt
          bold: true,
        }),
      ],
    })
  );

  // Metadata Header Block
  const metaRows = [
    { label: 'Course Title', val: metadata.courseTitle || 'Untitled Course' },
    { label: 'Course Code', val: metadata.courseCode || 'N/A' },
    { label: 'Lecturer', val: metadata.lecturer || 'N/A' },
    { label: 'Date', val: metadata.date || new Date().toISOString().split('T')[0] },
    { label: 'Lecture Topic', val: metadata.lectureTopic || 'General Lecture' },
  ];

  metaRows.forEach((row) => {
    children.push(
      new Paragraph({
        spacing: singleSpacing,
        children: [
          new TextRun({
            text: `${row.label}: `,
            font: fontName,
            size: 24, // 12pt
            bold: true,
          }),
          new TextRun({
            text: row.val,
            font: fontName,
            size: 24,
          }),
        ],
      })
    );
  });

  // Divider spacing
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      border: {
        bottom: {
          color: 'CCCCCC',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      children: [new TextRun('')],
    })
  );

  // Topic Sections
  sections.forEach((sec, idx) => {
    // 13pt Bold Topic Heading (size 26)
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: `${idx + 1}. ${sec.heading}`,
            font: fontName,
            size: 26, // 13pt
            bold: true,
            color: '113C3C',
          }),
        ],
      })
    );

    // Italic Keywords line
    children.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: 'Keywords: ',
            font: fontName,
            size: 22, // 11pt
            bold: true,
            italics: true,
          }),
          new TextRun({
            text: sec.keywords.join(', '),
            font: fontName,
            size: 22,
            italics: true,
          }),
        ],
      })
    );

    // Bulleted summaries with double spacing (12pt body)
    sec.bullets.forEach((bullet) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: doubleSpacing,
          children: [
            new TextRun({
              text: bullet,
              font: fontName,
              size: 24, // 12pt
            }),
          ],
        })
      );
    });

    // Spacing between sections
    children.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [new TextRun('')],
      })
    );
  });

  // Alphabetical Keyword Glossary at the end
  if (glossary && glossary.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        border: {
          top: {
            color: 'CCCCCC',
            space: 4,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        children: [
          new TextRun({
            text: 'Keyword Glossary',
            font: fontName,
            size: 26, // 13pt
            bold: true,
            color: '113C3C',
          }),
        ],
      })
    );

    glossary.forEach((item) => {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 80, ...doubleSpacing },
          children: [
            new TextRun({
              text: `• ${item.term}: `,
              font: fontName,
              size: 24, // 12pt
              bold: true,
            }),
            new TextRun({
              text: item.example
                ? item.example
                : `Key concept emphasized in the lecture (occurrences: ${item.count}).`,
              font: fontName,
              size: 24,
            }),
          ],
        })
      );
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch (1440 dxa)
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Triggers in-browser download of generated DOCX file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
