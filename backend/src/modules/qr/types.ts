export interface QRGenerateOptions {
  hotelId: string;
  roomNumber: string;
  label?: string;
}

export interface QRBulkGenerateOptions {
  hotelId: string;
  rooms: { number: string; label?: string }[];
}

export interface QRScanMeta {
  guestId?: string;
  userAgent?: string;
  ip?: string;
}

export interface QRCodeWithHotel {
  id: string;
  hotelId: string;
  hotelName: string;
  hotelLogo?: string | null;
  accentColor?: string | null;
  label: string;
  roomNumber?: string | null;
  deepLink: string;
  qrImagePath?: string | null;
  pdfPath?: string | null;
  scanCount: number;
}
