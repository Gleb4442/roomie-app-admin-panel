'use client';
import { useI18n, type Lang } from '@/lib/i18n';

const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'uk', label: 'UK' },
];

export function LanguageSwitcher({ accent = '#F0A500' }: { accent?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex gap-0.5">
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className="text-[10px] font-700 px-2 py-1 rounded transition-all font-display tracking-wider"
          style={{
            background: lang === l.code ? `${accent}20` : 'transparent',
            color: lang === l.code ? accent : '#475569',
            border: lang === l.code ? `1px solid ${accent}33` : '1px solid transparent',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
