import QRCode from 'qrcode';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/database';
import { logger } from '../../shared/utils/logger';
import { qrPdfGenerator } from './qrPdfGenerator';
import { QRScanMeta, QRCodeWithHotel } from './types';
import { env } from '../../config/environment';
import type { QRCode as QRCodeModel } from '@prisma/client';

function getUploadsBase(): string {
  return path.resolve(process.cwd(), env.uploadsDir);
}

function getHotelDir(hotelId: string): string {
  return path.join(getUploadsBase(), 'qr', hotelId);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

class QRService {
  /**
   * Generate QR for a single room.
   */
  async generateForRoom(hotelId: string, roomNumber: string, label?: string): Promise<QRCodeModel> {
    const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });

    const deepLink = `roomie://open?hotelId=${hotelId}&room=${encodeURIComponent(roomNumber)}`;

    // Upsert to handle re-generation
    const existing = await prisma.qRCode.findUnique({
      where: { hotelId_roomNumber: { hotelId, roomNumber } },
    });

    const qrRecord = existing
      ? await prisma.qRCode.update({
          where: { id: existing.id },
          data: { label: label || `Кімната ${roomNumber}`, deepLink, isActive: true, updatedAt: new Date() },
        })
      : await prisma.qRCode.create({
          data: {
            hotelId,
            type: 'in_room',
            label: label || `Кімната ${roomNumber}`,
            roomNumber,
            deepLink,
          },
        });

    const hotelDir = getHotelDir(hotelId);
    ensureDir(hotelDir);

    // Generate PNG (1024x1024, error correction H)
    const pngPath = path.join(hotelDir, `${qrRecord.id}.png`);
    await QRCode.toFile(pngPath, deepLink, {
      errorCorrectionLevel: 'H',
      width: 1024,
      margin: 2,
    });

    // Generate PDF
    const pdfBuffer = await qrPdfGenerator.generate({
      qrImagePath: pngPath,
      roomNumber,
      hotelName: hotel.name,
      hotelLogo: hotel.imageUrl,
      accentColor: hotel.accentColor,
      label: label || `Кімната ${roomNumber}`,
    });

    const pdfPath = path.join(hotelDir, `${qrRecord.id}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    const updated = await prisma.qRCode.update({
      where: { id: qrRecord.id },
      data: { qrImagePath: pngPath, pdfPath },
    });

    logger.debug({ hotelId, roomNumber, qrId: qrRecord.id }, 'QR generated for room');
    return updated;
  }

  /**
   * Bulk generation for multiple rooms.
   * Returns array of QR records + ZIP path with all PDFs.
   */
  async generateBulk(
    hotelId: string,
    rooms: { number: string; label?: string }[],
  ): Promise<{ qrCodes: QRCodeModel[]; zipPath: string }> {
    const qrCodes: QRCodeModel[] = [];

    for (const room of rooms) {
      const qr = await this.generateForRoom(hotelId, room.number, room.label);
      qrCodes.push(qr);
    }

    const zipPath = await this.createZip(hotelId, qrCodes);
    return { qrCodes, zipPath };
  }

  /**
   * Track a QR scan: increment counter + create QRScan record.
   */
  async trackScan(qrCodeId: string, meta?: QRScanMeta): Promise<void> {
    await prisma.$transaction([
      prisma.qRCode.update({
        where: { id: qrCodeId },
        data: { scanCount: { increment: 1 } },
      }),
      prisma.qRScan.create({
        data: {
          qrCodeId,
          guestId: meta?.guestId,
          userAgent: meta?.userAgent,
          ip: meta?.ip,
        },
      }),
    ]);

    logger.debug({ qrCodeId }, 'QR scan tracked');
  }

  /**
   * Regenerate all QR codes for a hotel (e.g., after branding change).
   */
  async regenerateForHotel(hotelId: string): Promise<void> {
    const qrCodes = await prisma.qRCode.findMany({ where: { hotelId, isActive: true } });

    for (const qr of qrCodes) {
      if (qr.roomNumber) {
        await this.generateForRoom(hotelId, qr.roomNumber, qr.label);
      }
    }

    logger.info({ hotelId, count: qrCodes.length }, 'QR regenerated for hotel');
  }

  /**
   * Get all QR codes for a hotel.
   */
  async getByHotel(hotelId: string): Promise<QRCodeModel[]> {
    return prisma.qRCode.findMany({
      where: { hotelId },
      orderBy: { roomNumber: 'asc' },
    });
  }

  /**
   * Delete a QR code and its files.
   */
  async delete(qrCodeId: string): Promise<void> {
    const qr = await prisma.qRCode.findUniqueOrThrow({ where: { id: qrCodeId } });

    if (qr.qrImagePath && fs.existsSync(qr.qrImagePath)) {
      fs.unlinkSync(qr.qrImagePath);
    }
    if (qr.pdfPath && fs.existsSync(qr.pdfPath)) {
      fs.unlinkSync(qr.pdfPath);
    }

    await prisma.qRScan.deleteMany({ where: { qrCodeId } });
    await prisma.qRCode.delete({ where: { id: qrCodeId } });

    logger.debug({ qrCodeId }, 'QR deleted');
  }

  /**
   * Build a bulk-download ZIP of all PDFs for a hotel.
   */
  async createZip(hotelId: string, qrCodes?: QRCodeModel[]): Promise<string> {
    const codes = qrCodes || (await this.getByHotel(hotelId));
    const hotelDir = getHotelDir(hotelId);
    ensureDir(hotelDir);

    const zipPath = path.join(hotelDir, `qr-bulk-${Date.now()}.zip`);

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      for (const qr of codes) {
        if (qr.pdfPath && fs.existsSync(qr.pdfPath)) {
          const filename = `${qr.label.replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄ ]/g, '_')}.pdf`;
          archive.file(qr.pdfPath, { name: filename });
        }
      }

      archive.finalize();
    });

    return zipPath;
  }

  /**
   * Build QRCodeWithHotel array for bulk PDF generation.
   */
  async getWithHotelInfo(hotelId: string): Promise<QRCodeWithHotel[]> {
    const [codes, hotel] = await Promise.all([
      this.getByHotel(hotelId),
      prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } }),
    ]);

    return codes.map((qr) => ({
      id: qr.id,
      hotelId: qr.hotelId,
      hotelName: hotel.name,
      hotelLogo: hotel.imageUrl,
      accentColor: hotel.accentColor,
      label: qr.label,
      roomNumber: qr.roomNumber,
      deepLink: qr.deepLink,
      qrImagePath: qr.qrImagePath,
      pdfPath: qr.pdfPath,
      scanCount: qr.scanCount,
    }));
  }
}

export const qrService = new QRService();
