import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { qrService } from './qrService';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * GET /qr/:qrCodeId
 * QR fallback page — tries to open deep link, falls back to store links.
 */
router.get('/:qrCodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const qr = await prisma.qRCode.findUnique({
      where: { id: req.params.qrCodeId as string },
      include: { hotel: { select: { name: true, settings: true } } },
    });

    if (!qr || !qr.isActive) {
      return res.status(404).send('<h1>QR code not found or inactive</h1>');
    }

    // Track scan
    await qrService.trackScan(qr.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    logger.debug({ qrId: qr.id, hotelId: qr.hotelId }, 'QR fallback page served');

    const hotelSettings = (qr.hotel.settings as Record<string, string> | null) || {};
    const appStoreUrl = hotelSettings.appStoreUrl || '';
    const playStoreUrl = hotelSettings.playStoreUrl || '';
    const hotelName = qr.hotel.name;
    const deepLink = qr.deepLink;

    const storeLinksHtml = appStoreUrl || playStoreUrl
      ? `
        <div class="stores">
          ${appStoreUrl ? `<a href="${appStoreUrl}" class="store-btn">⬇ App Store</a>` : ''}
          ${playStoreUrl ? `<a href="${playStoreUrl}" class="store-btn">⬇ Google Play</a>` : ''}
        </div>
      `
      : `<p class="coming-soon">Додаток скоро буде доступний</p>`;

    const html = `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${hotelName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #f5f5f7; padding: 20px;
    }
    .card {
      background: white; border-radius: 20px; padding: 40px 30px;
      text-align: center; max-width: 360px; width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    h1 { font-size: 22px; color: #1d1d1f; margin-bottom: 8px; }
    .subtitle { color: #6e6e73; font-size: 15px; margin-bottom: 30px; }
    .spinner {
      width: 40px; height: 40px; border: 3px solid #e0e0e0;
      border-top-color: #1152d4; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin: 0 auto 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .opening-text { color: #6e6e73; font-size: 14px; margin-bottom: 24px; }
    .stores { display: flex; flex-direction: column; gap: 12px; }
    .store-btn {
      display: block; padding: 14px 20px; background: #1152d4;
      color: white; border-radius: 12px; text-decoration: none;
      font-weight: 600; font-size: 16px;
    }
    .store-btn:active { opacity: 0.8; }
    .coming-soon { color: #6e6e73; font-size: 14px; font-style: italic; }
    #fallback { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${hotelName}</h1>
    <p class="subtitle">Сервіси готелю у вашому телефоні</p>

    <div id="opening">
      <div class="spinner"></div>
      <p class="opening-text">Відкриваємо додаток…</p>
    </div>

    <div id="fallback">
      <p class="subtitle" style="margin-bottom:20px">Завантажте додаток ${hotelName}</p>
      ${storeLinksHtml}
    </div>
  </div>

  <script>
    (function() {
      var deepLink = "${deepLink}";
      var start = Date.now();
      window.location.href = deepLink;
      setTimeout(function() {
        if (Date.now() - start < 3000) {
          document.getElementById('opening').style.display = 'none';
          document.getElementById('fallback').style.display = 'block';
        }
      }, 2000);
    })();
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

export default router;
