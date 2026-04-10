import { jsPDF } from 'jspdf';

import {
  HANDWRITING_TEMPLATE_CONFIG,
  TEMPLATE_PAGE_INSTRUCTIONS,
  getTemplateCells,
} from '../constants';

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;

const scaleX = (value: number): number =>
  (value / HANDWRITING_TEMPLATE_CONFIG.width) * PAGE_WIDTH_MM;

const scaleY = (value: number): number =>
  (value / HANDWRITING_TEMPLATE_CONFIG.height) * PAGE_HEIGHT_MM;

export const downloadHandwritingTemplate = async (): Promise<void> => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pdf.setFillColor(250, 248, 244);
  pdf.rect(0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM, 'F');

  pdf.setTextColor(21, 53, 86);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('My Handwriting Template', 16, 18);

  pdf.setTextColor(91, 105, 117);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.text('Print, write, photograph, then upload the page to generate your personal font.', 16, 24);

  TEMPLATE_PAGE_INSTRUCTIONS.forEach((instruction, index) => {
    pdf.text(instruction, 16, 32 + index * 5.5);
  });

  const printableInset = scaleX(HANDWRITING_TEMPLATE_CONFIG.printableInset);
  pdf.setDrawColor(212, 202, 188);
  pdf.roundedRect(
    printableInset,
    42,
    PAGE_WIDTH_MM - printableInset * 2,
    PAGE_HEIGHT_MM - 56,
    4,
    4,
    'S',
  );

  pdf.setFontSize(7.5);
  pdf.setTextColor(107, 114, 128);

  getTemplateCells().forEach((cell) => {
    const x = scaleX(cell.x);
    const y = scaleY(cell.y);
    const width = scaleX(cell.width);
    const height = scaleY(cell.height);

    pdf.setDrawColor(210, 221, 232);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(x, y, width, height, 1.8, 1.8, 'S');

    pdf.setDrawColor(180, 198, 218);
    pdf.line(
      x + 3,
      y + scaleY(HANDWRITING_TEMPLATE_CONFIG.baselineOffsetY),
      x + width - 3,
      y + scaleY(HANDWRITING_TEMPLATE_CONFIG.baselineOffsetY),
    );

    pdf.setTextColor(27, 83, 124);
    pdf.text(cell.character, x + 3, y + scaleY(HANDWRITING_TEMPLATE_CONFIG.labelOffsetY));
  });

  pdf.setTextColor(107, 114, 128);
  pdf.text('Tip: keep the phone parallel to the page so the boxes stay aligned.', 16, PAGE_HEIGHT_MM - 10);

  await pdf.save('my-handwriting-template.pdf', { returnPromise: true });
};
