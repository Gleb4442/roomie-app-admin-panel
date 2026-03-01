import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { QRCodeWithHotel } from './types';
import { logger } from '../../shared/utils/logger';

const A6_WIDTH = 297.64;   // 105mm in points
const A6_HEIGHT = 419.53;  // 148mm in points

const FONTS_DIR = path.join(__dirname, '../../../assets/fonts');
const ROBOTO_REGULAR = path.join(FONTS_DIR, 'Roboto-Regular.ttf');
const ROBOTO_BOLD = path.join(FONTS_DIR, 'Roboto-Bold.ttf');

function hasCustomFont(): boolean {
  return fs.existsSync(ROBOTO_REGULAR) && fs.existsSync(ROBOTO_BOLD);
}

export class QRPdfGenerator {
  /**
   * Generate a single A6 PDF for one QR code.
   * Returns a Buffer with the PDF content.
   */
  async generate(params: {
    qrImagePath: string;
    roomNumber: string;
    hotelName: string;
    hotelLogo?: string | null;
    accentColor?: string | null;
    label?: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [A6_WIDTH, A6_HEIGHT],
        margin: 0,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderPage(doc, params);
      doc.end();
    });
  }

  /**
   * Generate a single PDF with all QR codes (one per page).
   */
  async generateBulkPdf(qrCodes: QRCodeWithHotel[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [A6_WIDTH, A6_HEIGHT],
        margin: 0,
        autoFirstPage: false,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      for (const qr of qrCodes) {
        doc.addPage({ size: [A6_WIDTH, A6_HEIGHT], margin: 0 });
        this.renderPage(doc, {
          qrImagePath: qr.qrImagePath || '',
          roomNumber: qr.roomNumber || '',
          hotelName: qr.hotelName,
          hotelLogo: qr.hotelLogo,
          accentColor: qr.accentColor,
          label: qr.label,
        });
      }

      doc.end();
    });
  }

  private registerFonts(doc: InstanceType<typeof PDFDocument>): void {
    if (hasCustomFont()) {
      try {
        doc.registerFont('Roboto', ROBOTO_REGULAR);
        doc.registerFont('Roboto-Bold', ROBOTO_BOLD);
      } catch (err) {
        logger.warn({ err }, 'Failed to register Roboto font, falling back to Helvetica');
      }
    }
  }

  private fontName(bold = false): string {
    if (hasCustomFont()) {
      return bold ? 'Roboto-Bold' : 'Roboto';
    }
    return bold ? 'Helvetica-Bold' : 'Helvetica';
  }

  private renderPage(
    doc: InstanceType<typeof PDFDocument>,
    params: {
      qrImagePath: string;
      roomNumber: string;
      hotelName: string;
      hotelLogo?: string | null;
      accentColor?: string | null;
      label?: string;
    },
  ): void {
    this.registerFonts(doc);

    const accent = params.accentColor || '#1152d4';
    const padding = 20;

    // Header strip with accent color
    doc.rect(0, 0, A6_WIDTH, 50).fill(accent);

    // Hotel name in header
    doc
      .font(this.fontName(true))
      .fontSize(14)
      .fillColor('#ffffff')
      .text(params.hotelName, padding, 17, { width: A6_WIDTH - padding * 2, align: 'center' });

    // Hotel logo (if exists and file accessible)
    if (params.hotelLogo && fs.existsSync(params.hotelLogo)) {
      try {
        doc.image(params.hotelLogo, A6_WIDTH / 2 - 20, 5, { width: 40, height: 40 });
      } catch {
        // Ignore logo errors
      }
    }

    // QR code image
    const qrSize = 160;
    const qrX = (A6_WIDTH - qrSize) / 2;
    const qrY = 65;

    if (params.qrImagePath && fs.existsSync(params.qrImagePath)) {
      try {
        doc.image(params.qrImagePath, qrX, qrY, { width: qrSize, height: qrSize });
      } catch (err) {
        logger.warn({ err, path: params.qrImagePath }, 'Failed to embed QR image in PDF');
        // Draw placeholder
        doc.rect(qrX, qrY, qrSize, qrSize).stroke('#cccccc');
      }
    } else {
      doc.rect(qrX, qrY, qrSize, qrSize).stroke('#cccccc');
    }

    // Instruction text
    const textY = qrY + qrSize + 18;
    doc
      .font(this.fontName(false))
      .fontSize(10)
      .fillColor('#444444')
      .text('Наведіть камеру для доступу', padding, textY, {
        width: A6_WIDTH - padding * 2,
        align: 'center',
      })
      .text('до послуг готелю', {
        width: A6_WIDTH - padding * 2,
        align: 'center',
      });

    // Room label
    const labelY = textY + 36;
    const displayLabel = params.label || `Кімната ${params.roomNumber}`;
    doc
      .font(this.fontName(true))
      .fontSize(13)
      .fillColor(accent)
      .text(displayLabel, padding, labelY, {
        width: A6_WIDTH - padding * 2,
        align: 'center',
      });

    // Bottom accent strip
    doc.rect(0, A6_HEIGHT - 20, A6_WIDTH, 20).fill(accent);

    // Reset fill color
    doc.fillColor('#000000');
  }
}

export const qrPdfGenerator = new QRPdfGenerator();
