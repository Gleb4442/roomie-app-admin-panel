'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi, type Room, type RoomsBoardData, type HousekeepingStatus } from '@/lib/api/dashboard';

// ── Status config ─────────────────────────────────────────────

const HK_STATUS: Record<HousekeepingStatus, { label: string; color: string; bg: string; border: string }> = {
  DIRTY:           { label: 'Dirty',       color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  CLEANING:        { label: 'Cleaning',    color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  CLEANED:         { label: 'Cleaned',     color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)' },
  INSPECTED:       { label: 'Inspected',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)' },
  READY:           { label: 'Ready',       color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  OUT_OF_ORDER:    { label: 'OOO',         color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
  DO_NOT_DISTURB:  { label: 'DND',         color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
};

const STATUS_ORDER: HousekeepingStatus[] = ['DIRTY', 'CLEANING', 'CLEANED', 'INSPECTED', 'READY', 'DO_NOT_DISTURB', 'OUT_OF_ORDER'];

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Stat Card ─────────────────────────────────────────────────

function StatBadge({ label, value, status }: { label: string; value: number; status: HousekeepingStatus }) {
  const cfg = HK_STATUS[status];
  return (
    <div className="flex flex-col items-center px-4 py-2.5 rounded-lg" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <span className="text-xl font-700 font-display" style={{ color: cfg.color }}>{value}</span>
      <span className="text-xs text-ink-400 mt-0.5">{label}</span>
    </div>
  );
}

// ── Room Card ─────────────────────────────────────────────────

function RoomCard({ room, onClick }: { room: Room; onClick: () => void }) {
  const cfg = HK_STATUS[room.housekeepingStatus];
  const cleanerName = room.assignedCleaner
    ? `${room.assignedCleaner.firstName} ${room.assignedCleaner.lastName ?? ''}`.trim()
    : null;

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-start p-3 rounded-xl text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, minWidth: 100 }}
    >
      {/* Rush pulse ring */}
      {room.isRush && (
        <span className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: '0 0 0 2px #EF4444, 0 0 8px rgba(239,68,68,0.5)', animation: 'pulse 1.5s infinite' }} />
      )}

      <div className="flex items-center justify-between w-full mb-1.5">
        <span className="text-sm font-700 text-white font-display">{room.roomNumber}</span>
        <div className="flex gap-1">
          {room.isRush && <span className="text-[9px] font-700 px-1 rounded" style={{ background: '#EF4444', color: '#fff' }}>RUSH</span>}
          {room.dndActive && <span className="text-[9px] font-700 px-1 rounded" style={{ background: '#F97316', color: '#fff' }}>DND</span>}
        </div>
      </div>

      <span className="text-[11px] font-600" style={{ color: cfg.color }}>{cfg.label}</span>

      {cleanerName && (
        <span className="text-[10px] text-ink-400 mt-1 truncate max-w-full">{cleanerName}</span>
      )}

      <span className="text-[10px] text-ink-500 mt-0.5">{timeAgo(room.lastStatusChangedAt)}</span>
    </button>
  );
}

// ── Side Panel ────────────────────────────────────────────────

function RoomPanel({
  room,
  hotelId,
  staffList,
  onClose,
  onUpdate,
}: {
  room: Room;
  hotelId: string;
  staffList: { id: string; firstName: string; lastName?: string }[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { token } = useDashboardAuth();
  const cfg = HK_STATUS[room.housekeepingStatus];

  const statusMutation = useMutation({
    mutationFn: (status: string) => dashboardApi.updateRoomHKStatus(hotelId, room.id, token!, status),
    onSuccess: onUpdate,
  });
  const assignMutation = useMutation({
    mutationFn: (data: { staffId?: string | null; inspectorId?: string | null }) =>
      dashboardApi.assignRoomStaff(hotelId, room.id, token!, data),
    onSuccess: onUpdate,
  });
  const rushMutation = useMutation({
    mutationFn: () => dashboardApi.toggleRoomRush(hotelId, room.id, token!),
    onSuccess: onUpdate,
  });
  const dndMutation = useMutation({
    mutationFn: () => dashboardApi.toggleRoomDND(hotelId, room.id, token!, !room.dndActive),
    onSuccess: onUpdate,
  });

  return (
    <div className="flex flex-col h-full p-5 overflow-y-auto" style={{ minWidth: 280 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-700 text-white font-display">Room {room.roomNumber}</h3>
          <p className="text-xs text-ink-400">Floor {room.floor}{room.roomType ? ` · ${room.roomType}` : ''}</p>
        </div>
        <button onClick={onClose} className="text-ink-400 hover:text-white transition-colors p-1">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-sm font-700 px-3 py-1 rounded-lg" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          {cfg.label}
        </span>
        {room.isRush && <span className="text-xs font-700 px-2 py-1 rounded" style={{ background: '#EF4444', color: '#fff' }}>RUSH</span>}
        {room.dndActive && <span className="text-xs font-700 px-2 py-1 rounded" style={{ background: '#F97316', color: '#fff' }}>DND</span>}
      </div>

      {/* Quick actions */}
      <div className="mb-5">
        <p className="text-xs text-ink-400 uppercase tracking-wider mb-2 font-display">Set Status</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              disabled={s === room.housekeepingStatus || statusMutation.isPending}
              onClick={() => statusMutation.mutate(s)}
              className="text-xs px-2.5 py-1 rounded-lg font-600 transition-all"
              style={{
                background: s === room.housekeepingStatus ? HK_STATUS[s].bg : 'rgba(255,255,255,0.04)',
                color: s === room.housekeepingStatus ? HK_STATUS[s].color : '#94A3B8',
                border: `1px solid ${s === room.housekeepingStatus ? HK_STATUS[s].border : 'rgba(255,255,255,0.06)'}`,
                opacity: s === room.housekeepingStatus ? 1 : 0.8,
              }}
            >
              {HK_STATUS[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle buttons */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => rushMutation.mutate()}
          className="flex-1 text-xs py-2 rounded-lg font-600 transition-all"
          style={{
            background: room.isRush ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
            color: room.isRush ? '#EF4444' : '#94A3B8',
            border: `1px solid ${room.isRush ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          {room.isRush ? '🔴 Rush ON' : 'Rush OFF'}
        </button>
        <button
          onClick={() => dndMutation.mutate()}
          className="flex-1 text-xs py-2 rounded-lg font-600 transition-all"
          style={{
            background: room.dndActive ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
            color: room.dndActive ? '#F97316' : '#94A3B8',
            border: `1px solid ${room.dndActive ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          {room.dndActive ? '🔴 DND ON' : 'DND OFF'}
        </button>
      </div>

      {/* Assign cleaner */}
      <div className="mb-4">
        <p className="text-xs text-ink-400 uppercase tracking-wider mb-2 font-display">Assign Cleaner</p>
        <select
          className="w-full text-sm py-2 px-3 rounded-lg"
          style={{ background: '#1C2230', border: '1px solid rgba(255,255,255,0.08)', color: '#E2E8F0' }}
          value={room.assignedCleanerId ?? ''}
          onChange={e => assignMutation.mutate({ staffId: e.target.value || null })}
        >
          <option value="">— Unassigned —</option>
          {staffList.map(s => (
            <option key={s.id} value={s.id}>{s.firstName} {s.lastName ?? ''}</option>
          ))}
        </select>
      </div>

      {/* Assign inspector */}
      <div className="mb-5">
        <p className="text-xs text-ink-400 uppercase tracking-wider mb-2 font-display">Assign Inspector</p>
        <select
          className="w-full text-sm py-2 px-3 rounded-lg"
          style={{ background: '#1C2230', border: '1px solid rgba(255,255,255,0.08)', color: '#E2E8F0' }}
          value={room.assignedInspectorId ?? ''}
          onChange={e => assignMutation.mutate({ inspectorId: e.target.value || null })}
        >
          <option value="">— Unassigned —</option>
          {staffList.map(s => (
            <option key={s.id} value={s.id}>{s.firstName} {s.lastName ?? ''}</option>
          ))}
        </select>
      </div>

      {/* Info */}
      <div className="rounded-lg p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <InfoRow label="Last cleaned" value={timeAgo(room.lastCleanedAt)} />
        <InfoRow label="Last inspected" value={timeAgo(room.lastInspectedAt)} />
        <InfoRow label="Status changed" value={timeAgo(room.lastStatusChangedAt)} />
        <InfoRow label="Occupancy" value={room.occupancyStatus} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-ink-400">{label}</span>
      <span className="text-xs text-ink-200 font-500">{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function HousekeepingPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const queryClient = useQueryClient();

  const [view, setView] = useState<'board' | 'list'>('board');
  const [floorFilter, setFloorFilter] = useState<number | undefined>(undefined);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [statusFilter, setStatusFilter] = useState<HousekeepingStatus | ''>('');

  const { data, isLoading } = useQuery<RoomsBoardData>({
    queryKey: ['rooms-board', hotelId],
    queryFn: () => dashboardApi.getRoomsBoard(hotelId, token!),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff-list', hotelId],
    queryFn: () => dashboardApi.getStaffList(hotelId, token!),
    enabled: !!token,
  });

  const staffList = staffData ?? [];

  // Real-time SSE
  useEffect(() => {
    if (!token) return;
    const url = dashboardApi.getRoomsSSEUrl(hotelId, token);
    const es = new EventSource(url);
    es.addEventListener('task_update', (e: any) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.event === 'room_updated' && parsed.room) {
          queryClient.setQueryData(['rooms-board', hotelId], (old: RoomsBoardData | undefined) => {
            if (!old) return old;
            const updated = parsed.room as Room;
            const newFloors = { ...old.floors };
            for (const floor of Object.keys(newFloors)) {
              const f = Number(floor);
              newFloors[f] = newFloors[f].map(r => r.id === updated.id ? { ...r, ...updated } : r);
            }
            // Recalculate stats
            const allRooms = Object.values(newFloors).flat();
            return {
              floors: newFloors,
              stats: {
                total: allRooms.length,
                dirty: allRooms.filter(r => r.housekeepingStatus === 'DIRTY').length,
                cleaning: allRooms.filter(r => r.housekeepingStatus === 'CLEANING').length,
                cleaned: allRooms.filter(r => r.housekeepingStatus === 'CLEANED').length,
                inspected: allRooms.filter(r => r.housekeepingStatus === 'INSPECTED').length,
                ready: allRooms.filter(r => r.housekeepingStatus === 'READY').length,
                outOfOrder: allRooms.filter(r => r.housekeepingStatus === 'OUT_OF_ORDER').length,
                dnd: allRooms.filter(r => r.housekeepingStatus === 'DO_NOT_DISTURB').length,
              },
            };
          });
          // Update selected room if it matches
          setSelectedRoom(prev => prev?.id === parsed.room.id ? { ...prev, ...parsed.room } : prev);
        }
      } catch {}
    });
    return () => es.close();
  }, [token, hotelId, queryClient]);

  const floors = data ? Object.keys(data.floors).map(Number).sort((a, b) => a - b) : [];
  const stats = data?.stats;

  // Flatten for list view
  const allRooms: Room[] = data
    ? Object.values(data.floors)
        .flat()
        .filter(r => !statusFilter || r.housekeepingStatus === statusFilter)
        .filter(r => floorFilter === undefined || r.floor === floorFilter)
    : [];

  const handleRoomUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['rooms-board', hotelId] });
    if (selectedRoom) {
      dashboardApi.getRoomDetail(hotelId, selectedRoom.id, token!).then(d => setSelectedRoom(d.room)).catch(() => {});
    }
  }, [hotelId, token, queryClient, selectedRoom]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-ink-400 text-sm">Loading rooms...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <h1 className="text-xl font-700 text-white font-display mb-4">Housekeeping Board</h1>

          {/* Stats bar */}
          {stats && (
            <div className="flex gap-3 flex-wrap mb-4">
              <StatBadge label="Dirty" value={stats.dirty} status="DIRTY" />
              <StatBadge label="Cleaning" value={stats.cleaning} status="CLEANING" />
              <StatBadge label="Cleaned" value={stats.cleaned} status="CLEANED" />
              <StatBadge label="Inspected" value={stats.inspected} status="INSPECTED" />
              <StatBadge label="Ready" value={stats.ready} status="READY" />
              {stats.dnd > 0 && <StatBadge label="DND" value={stats.dnd} status="DO_NOT_DISTURB" />}
              {stats.outOfOrder > 0 && <StatBadge label="OOO" value={stats.outOfOrder} status="OUT_OF_ORDER" />}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {(['board', 'list'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-3 py-1.5 text-xs font-600 capitalize transition-all"
                  style={{
                    background: view === v ? '#F0A500' : 'transparent',
                    color: view === v ? '#000' : '#94A3B8',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Floor filter */}
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFloorFilter(undefined)}
                className="text-xs px-3 py-1.5 rounded-lg font-600 transition-all"
                style={{
                  background: floorFilter === undefined ? 'rgba(240,165,0,0.15)' : 'rgba(255,255,255,0.04)',
                  color: floorFilter === undefined ? '#F0A500' : '#64748B',
                  border: `1px solid ${floorFilter === undefined ? 'rgba(240,165,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                All floors
              </button>
              {floors.map(f => (
                <button
                  key={f}
                  onClick={() => setFloorFilter(f)}
                  className="text-xs px-3 py-1.5 rounded-lg font-600 transition-all"
                  style={{
                    background: floorFilter === f ? 'rgba(240,165,0,0.15)' : 'rgba(255,255,255,0.04)',
                    color: floorFilter === f ? '#F0A500' : '#64748B',
                    border: `1px solid ${floorFilter === f ? 'rgba(240,165,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  F{f}
                </button>
              ))}
            </div>

            {/* Status filter (list view only) */}
            {view === 'list' && (
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as HousekeepingStatus | '')}
                className="text-xs py-1.5 px-2 rounded-lg"
                style={{ background: '#1C2230', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}
              >
                <option value="">All statuses</option>
                {STATUS_ORDER.map(s => (
                  <option key={s} value={s}>{HK_STATUS[s].label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {view === 'board' ? (
            /* Board view: grouped by floor */
            <div className="space-y-6">
              {data && floors
                .filter(f => floorFilter === undefined || f === floorFilter)
                .map(floor => {
                  const rooms = data.floors[floor] ?? [];
                  return (
                    <div key={floor}>
                      <div className="flex items-center gap-3 mb-3">
                        <h2 className="text-sm font-700 text-white font-display">Floor {floor}</h2>
                        <span className="text-xs text-ink-500">{rooms.length} rooms</span>
                        {/* Floor status summary */}
                        <div className="flex gap-1.5">
                          {STATUS_ORDER.map(s => {
                            const count = rooms.filter(r => r.housekeepingStatus === s).length;
                            if (!count) return null;
                            return (
                              <span key={s} className="text-[10px] font-600 px-1.5 py-0.5 rounded"
                                style={{ background: HK_STATUS[s].bg, color: HK_STATUS[s].color, border: `1px solid ${HK_STATUS[s].border}` }}>
                                {count} {HK_STATUS[s].label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {rooms.map(room => (
                          <RoomCard
                            key={room.id}
                            room={room}
                            onClick={() => setSelectedRoom(room)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              }
              {floors.length === 0 && (
                <EmptyState />
              )}
            </div>
          ) : (
            /* List view */
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Th>Room</Th>
                    <Th>Floor</Th>
                    <Th>Status</Th>
                    <Th>Occupancy</Th>
                    <Th>Cleaner</Th>
                    <Th>Last Cleaned</Th>
                    <Th>Changed</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {allRooms.map(room => {
                    const cfg = HK_STATUS[room.housekeepingStatus];
                    return (
                      <tr key={room.id}
                        className="border-b cursor-pointer hover:bg-white/[0.02] transition-colors"
                        style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                        onClick={() => setSelectedRoom(room)}
                      >
                        <Td>
                          <span className="font-700 text-white">{room.roomNumber}</span>
                          {room.isRush && <span className="ml-1.5 text-[10px] font-700 px-1 rounded" style={{ background: '#EF4444', color: '#fff' }}>R</span>}
                          {room.dndActive && <span className="ml-1 text-[10px] font-700 px-1 rounded" style={{ background: '#F97316', color: '#fff' }}>D</span>}
                        </Td>
                        <Td className="text-ink-400">F{room.floor}</Td>
                        <Td>
                          <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>
                            {cfg.label}
                          </span>
                        </Td>
                        <Td className="text-ink-400 text-xs">{room.occupancyStatus}</Td>
                        <Td className="text-ink-300 text-xs">
                          {room.assignedCleaner ? `${room.assignedCleaner.firstName} ${room.assignedCleaner.lastName ?? ''}`.trim() : '—'}
                        </Td>
                        <Td className="text-ink-400 text-xs">{timeAgo(room.lastCleanedAt)}</Td>
                        <Td className="text-ink-400 text-xs">{timeAgo(room.lastStatusChangedAt)}</Td>
                        <Td>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#64748B" strokeWidth="2">
                            <path d="M9 18l6-6-6-6"/>
                          </svg>
                        </Td>
                      </tr>
                    );
                  })}
                  {allRooms.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-ink-500 text-sm py-12">No rooms found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      {selectedRoom && (
        <div className="w-72 shrink-0 border-l overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0F141A' }}>
          <RoomPanel
            room={selectedRoom}
            hotelId={hotelId}
            staffList={staffList}
            onClose={() => setSelectedRoom(null)}
            onUpdate={handleRoomUpdate}
          />
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-xs font-600 text-ink-400 font-display uppercase tracking-wider whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ''}`}>{children}</td>;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.15)' }}>
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#F0A500" strokeWidth="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
      </div>
      <p className="text-sm font-600 text-white mb-1">No rooms configured</p>
      <p className="text-xs text-ink-400 max-w-48">Use the API to bulk-create rooms for this hotel.</p>
    </div>
  );
}
