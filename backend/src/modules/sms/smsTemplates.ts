import { TemplateKey, TemplateContext } from './types';

type TemplateRenderer = (ctx: TemplateContext) => string;

const templates: Record<TemplateKey, Record<string, TemplateRenderer>> = {
  booking_confirmation: {
    uk: (ctx) =>
      `${ctx.guestName}, дякуємо за бронювання в ${ctx.hotelName}! Заїзд: ${ctx.checkIn}. Завантажте додаток для зручного перебування: ${ctx.appLink}`,
    en: (ctx) =>
      `${ctx.guestName}, thank you for booking at ${ctx.hotelName}! Check-in: ${ctx.checkIn}. Download our app for a better stay: ${ctx.appLink}`,
    de: (ctx) =>
      `${ctx.guestName}, vielen Dank für Ihre Buchung im ${ctx.hotelName}! Check-in: ${ctx.checkIn}. Laden Sie unsere App herunter: ${ctx.appLink}`,
  },

  precheckin_invite: {
    uk: (ctx) =>
      `${ctx.guestName}, пройдіть онлайн реєстрацію для ${ctx.hotelName} та заощадьте час при заїзді: ${ctx.preCheckinUrl}`,
    en: (ctx) =>
      `${ctx.guestName}, complete your online check-in for ${ctx.hotelName} and save time on arrival: ${ctx.preCheckinUrl}`,
    de: (ctx) =>
      `${ctx.guestName}, erledigen Sie Ihren Online-Check-in für ${ctx.hotelName} und sparen Sie Zeit: ${ctx.preCheckinUrl}`,
  },

  app_download: {
    uk: (ctx) =>
      `${ctx.guestName}, завантажте додаток ${ctx.hotelName} для замовлення послуг, чату з консьєржем та багато іншого: ${ctx.appLink}`,
    en: (ctx) =>
      `${ctx.guestName}, download the ${ctx.hotelName} app for room service, concierge chat and more: ${ctx.appLink}`,
    de: (ctx) =>
      `${ctx.guestName}, laden Sie die ${ctx.hotelName} App herunter für Zimmerservice, Concierge-Chat und mehr: ${ctx.appLink}`,
  },

  checkin_welcome: {
    uk: (ctx) =>
      `Ласкаво просимо до ${ctx.hotelName}, ${ctx.guestName}! Ваш номер: ${ctx.roomNumber}. Все послуги доступні в додатку: ${ctx.appLink}`,
    en: (ctx) =>
      `Welcome to ${ctx.hotelName}, ${ctx.guestName}! Your room: ${ctx.roomNumber}. All services available in the app: ${ctx.appLink}`,
    de: (ctx) =>
      `Willkommen im ${ctx.hotelName}, ${ctx.guestName}! Ihr Zimmer: ${ctx.roomNumber}. Alle Services in der App: ${ctx.appLink}`,
  },

  checkout_thanks: {
    uk: (ctx) =>
      `${ctx.guestName}, дякуємо за перебування в ${ctx.hotelName}! Будемо раді бачити вас знову.`,
    en: (ctx) =>
      `${ctx.guestName}, thank you for staying at ${ctx.hotelName}! We hope to welcome you again.`,
    de: (ctx) =>
      `${ctx.guestName}, vielen Dank für Ihren Aufenthalt im ${ctx.hotelName}! Wir hoffen, Sie bald wiederzusehen.`,
  },
};

export function renderTemplate(
  key: TemplateKey,
  language: string,
  context: TemplateContext,
): string {
  const langTemplates = templates[key];
  if (!langTemplates) {
    throw new Error(`Unknown SMS template: ${key}`);
  }

  const renderer = langTemplates[language] || langTemplates['en'];
  if (!renderer) {
    throw new Error(`No template found for ${key}/${language}`);
  }

  return renderer(context);
}
