'use client';
import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { StageBadge } from '@/components/ui/StageBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

const STAGES: { value: string; key: string }[] = [
  { value: '', key: 'guests.allStages' },
  { value: 'PRE_ARRIVAL', key: 'guests.preArrival' },
  { value: 'CHECKED_IN', key: 'guests.checkedIn' },
  { value: 'IN_STAY', key: 'guests.inStay' },
  { value: 'CHECKOUT', key: 'guests.checkout' },
  { value: 'POST_STAY', key: 'guests.postStay' },
  { value: 'BETWEEN_STAYS', key: 'guests.betweenStays' },
];

export default function GuestsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['guests', hotelId, stage, search, page],
    queryFn: () => dashboardApi.getGuests(hotelId, token!, { stage: stage || undefined, search: search || undefined, page, limit: LIMIT }),
    enabled: !!token,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader title={t('guests.title')} subtitle={t('guests.totalGuests', { n: data?.total ?? 0 })} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Stage pills */}
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map(s => (
            <button
              key={s.value}
              onClick={() => { setStage(s.value); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
              style={{
                background: stage === s.value ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
                color: stage === s.value ? '#F0A500' : '#64748B',
                border: `1px solid ${stage === s.value ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
              }}
            >
              {t(s.key)}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[200px]">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={t('guests.searchPlaceholder')}
              className="flex-1"
              style={{ padding: '8px 12px' }}
            />
            <button
              type="submit"
              className="px-4 h-9 rounded-lg text-xs font-600 font-display shrink-0 transition-colors"
              style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.2)' }}
            >
              {t('guests.search')}
            </button>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 shimmer rounded-lg" />
            ))}
          </div>
        ) : !data?.guests?.length ? (
          <div className="flex items-center justify-center h-40 text-ink-500 text-sm">
            {search || stage ? t('guests.noGuestsMatch') : t('guests.noGuests')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('guests.guest')}</th>
                  <th>{t('guests.contact')}</th>
                  <th>{t('guests.room')}</th>
                  <th>{t('guests.stage')}</th>
                  <th>{t('guests.checkIn')}</th>
                  <th>{t('guests.checkOut')}</th>
                  <th>{t('guests.source')}</th>
                  <th>{t('guests.preCheckin')}</th>
                </tr>
              </thead>
              <tbody>
                {data.guests.map(guest => (
                  <tr key={guest.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 shrink-0"
                          style={{ background: 'rgba(240,165,0,0.1)', color: '#F0A500', fontFamily: 'var(--font-syne)' }}>
                          {guest.guestName[0]}
                        </div>
                        <span className="font-600 text-white text-sm">{guest.guestName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="text-xs">
                        {guest.phone && <div className="text-ink-200 num">{guest.phone}</div>}
                        {guest.email && <div className="text-ink-400 truncate max-w-[160px]">{guest.email}</div>}
                      </div>
                    </td>
                    <td>
                      {guest.roomNumber
                        ? <span className="num font-600 text-white">#{guest.roomNumber}</span>
                        : <span className="text-ink-500">—</span>}
                    </td>
                    <td><StageBadge stage={guest.stage} /></td>
                    <td className="text-ink-300 num text-xs">{guest.checkIn ? formatDate(guest.checkIn) : '—'}</td>
                    <td className="text-ink-300 num text-xs">{guest.checkOut ? formatDate(guest.checkOut) : '—'}</td>
                    <td className="text-ink-400 text-xs capitalize">{guest.source}</td>
                    <td>
                      {guest.preCheckinCompleted
                        ? <span className="text-teal text-xs font-600">{t('guests.done')}</span>
                        : <span className="text-ink-500 text-xs">{t('guests.pending')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="px-5 pb-4">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={LIMIT}
              onPage={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
