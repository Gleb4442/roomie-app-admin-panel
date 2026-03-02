'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi, type StaffMember, type CreateStaffData } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';

const ROLES = ['LINE_STAFF', 'SUPERVISOR', 'HEAD_OF_DEPT', 'RECEPTIONIST', 'GENERAL_MANAGER'];
const DEPARTMENTS = ['HOUSEKEEPING', 'MAINTENANCE', 'FOOD_AND_BEVERAGE', 'FRONT_OFFICE', 'SECURITY', 'MANAGEMENT'];

const ROLE_COLOR: Record<string, string> = {
  LINE_STAFF: '#64748B',
  SUPERVISOR: '#3B82F6',
  HEAD_OF_DEPT: '#8B5CF6',
  RECEPTIONIST: '#10B981',
  GENERAL_MANAGER: '#F0A500',
};

const DEPT_SHORT: Record<string, string> = {
  HOUSEKEEPING: 'HK',
  MAINTENANCE: 'MNT',
  FOOD_AND_BEVERAGE: 'F&B',
  FRONT_OFFICE: 'FO',
  SECURITY: 'SEC',
  MANAGEMENT: 'MGT',
};

const EMPTY_FORM: CreateStaffData = {
  email: '', firstName: '', lastName: '', phone: '',
  role: 'LINE_STAFF', department: 'HOUSEKEEPING',
  password: '', assignedFloor: '',
};

export default function StaffPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<CreateStaffData>(EMPTY_FORM);
  const [pinModal, setPinModal] = useState<{ staffId: string; name: string } | null>(null);
  const [newPin, setNewPin] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');
  const [filterDept, setFilterDept] = useState('');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff', hotelId],
    queryFn: () => dashboardApi.getStaffList(hotelId, token!),
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateStaffData) => dashboardApi.createStaff(hotelId, token!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff', hotelId] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      dashboardApi.updateStaff(hotelId, id, token!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff', hotelId] }); closeModal(); },
  });

  const deactivateMut = useMutation({
    mutationFn: (staffId: string) => dashboardApi.deactivateStaff(hotelId, staffId, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', hotelId] }),
  });

  const pinMut = useMutation({
    mutationFn: ({ staffId, pin }: { staffId: string; pin: string }) =>
      dashboardApi.resetStaffPin(hotelId, staffId, token!, pin),
    onSuccess: () => { setPinModal(null); setNewPin(''); },
  });

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(s: StaffMember) {
    setEditTarget(s);
    setForm({
      email: s.email, firstName: s.firstName, lastName: s.lastName ?? '',
      phone: s.phone ?? '', role: s.role, department: s.department,
      password: '', assignedFloor: s.assignedFloor ?? '',
    });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditTarget(null); setForm(EMPTY_FORM); }

  function submit() {
    if (editTarget) {
      const { password, ...rest } = form;
      const data: any = rest;
      if (password) data.password = password;
      updateMut.mutate({ id: editTarget.id, data });
    } else {
      createMut.mutate(form);
    }
  }

  const filtered = staff.filter(s => {
    if (filterActive === 'active' && !s.isActive) return false;
    if (filterActive === 'inactive' && s.isActive) return false;
    if (filterDept && s.department !== filterDept) return false;
    return true;
  });

  const isOnShift = (s: StaffMember) => s.shifts && s.shifts.length > 0;
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title="Staff Management"
        subtitle="Manage hotel staff accounts, roles and PINs"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 font-display transition-all"
            style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.2)' }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            Add Staff
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterActive(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all capitalize"
            style={{
              background: filterActive === f ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
              color: filterActive === f ? '#F0A500' : '#64748B',
              border: `1px solid ${filterActive === f ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
            }}
          >
            {f}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="text-xs"
          style={{
            background: '#1C2230', color: filterDept ? '#F0A500' : '#64748B',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
            padding: '6px 10px',
          }}
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => (
            <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <span className="text-xs text-ink-400 ml-auto">{filtered.length} members</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 shimmer rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <p className="text-sm text-ink-400">No staff found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Dept</th>
                  <th>Floor</th>
                  <th>Status</th>
                  <th>Shift</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-700 font-display shrink-0"
                          style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500' }}
                        >
                          {s.firstName[0]?.toUpperCase()}{s.lastName?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-600 text-white">{s.firstName} {s.lastName}</p>
                          <p className="text-xs text-ink-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-600"
                        style={{
                          background: `${ROLE_COLOR[s.role]}20`,
                          color: ROLE_COLOR[s.role] ?? '#64748B',
                        }}
                      >
                        {s.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-ink-300 font-mono">{DEPT_SHORT[s.department] ?? s.department}</span>
                    </td>
                    <td>
                      <span className="text-xs text-ink-400">{s.assignedFloor ?? '—'}</span>
                    </td>
                    <td>
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: s.isActive ? '#10B981' : '#475569' }}
                      />
                      <span className="text-xs text-ink-400 ml-1.5">{s.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td>
                      {isOnShift(s) ? (
                        <span className="text-xs font-600" style={{ color: '#10B981' }}>● On Shift</span>
                      ) : (
                        <span className="text-xs text-ink-500">Off</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          className="px-2.5 py-1 rounded text-xs text-ink-300 hover:text-white transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { setPinModal({ staffId: s.id, name: `${s.firstName} ${s.lastName}` }); setNewPin(''); }}
                          className="px-2.5 py-1 rounded text-xs text-ink-300 hover:text-white transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                          PIN
                        </button>
                        {s.isActive && (
                          <button
                            onClick={() => {
                              if (confirm(`Deactivate ${s.firstName}?`)) {
                                deactivateMut.mutate(s.id);
                              }
                            }}
                            className="px-2.5 py-1 rounded text-xs hover:text-white transition-colors"
                            style={{ background: 'rgba(244,63,94,0.08)', color: '#F43F5E' }}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-700 font-display text-white">
                {editTarget ? 'Edit Staff Member' : 'Add Staff Member'}
              </h2>
              <button onClick={closeModal} className="text-ink-400 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-400 mb-1 block">First Name *</label>
                <input
                  className="w-full text-sm"
                  style={inputStyle}
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="text-xs text-ink-400 mb-1 block">Last Name</label>
                <input
                  className="w-full text-sm"
                  style={inputStyle}
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-ink-400 mb-1 block">Email *</label>
              <input
                className="w-full text-sm"
                style={inputStyle}
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@hotel.com"
                disabled={!!editTarget}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-400 mb-1 block">Role *</label>
                <select
                  className="w-full text-sm"
                  style={inputStyle}
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-400 mb-1 block">Department *</label>
                <select
                  className="w-full text-sm"
                  style={inputStyle}
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-400 mb-1 block">Phone</label>
                <input
                  className="w-full text-sm"
                  style={inputStyle}
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+380..."
                />
              </div>
              <div>
                <label className="text-xs text-ink-400 mb-1 block">Assigned Floor</label>
                <input
                  className="w-full text-sm"
                  style={inputStyle}
                  value={form.assignedFloor}
                  onChange={e => setForm(f => ({ ...f, assignedFloor: e.target.value }))}
                  placeholder="3"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-ink-400 mb-1 block">
                {editTarget ? 'New Password (leave blank to keep)' : 'Password *'}
              </label>
              <input
                type="password"
                className="w-full text-sm"
                style={inputStyle}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>

            {(createMut.isError || updateMut.isError) && (
              <p className="text-xs" style={{ color: '#F43F5E' }}>
                {(createMut.error as any)?.response?.data?.error ?? 'Failed to save'}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={closeModal}
                className="flex-1 py-2 rounded-lg text-sm text-ink-300 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={isPending || !form.firstName || !form.email || (!editTarget && !form.password)}
                className="flex-1 py-2 rounded-lg text-sm font-600 transition-all"
                style={{ background: '#F0A500', color: '#0D1117', opacity: isPending ? 0.6 : 1 }}
              >
                {isPending ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Reset Modal */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-700 font-display text-white">Reset PIN</h2>
              <button onClick={() => setPinModal(null)} className="text-ink-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-ink-300">Set new PIN for <span className="text-white font-600">{pinModal.name}</span></p>
            <div>
              <label className="text-xs text-ink-400 mb-1 block">New PIN (4-8 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                className="w-full text-sm tracking-widest"
                style={inputStyle}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPinModal(null)}
                className="flex-1 py-2 rounded-lg text-sm text-ink-300"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => pinMut.mutate({ staffId: pinModal.staffId, pin: newPin })}
                disabled={newPin.length < 4 || pinMut.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-600"
                style={{ background: '#F0A500', color: '#0D1117', opacity: newPin.length < 4 ? 0.5 : 1 }}
              >
                {pinMut.isPending ? 'Saving…' : 'Set PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#1C2230',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#E2E8F0',
  outline: 'none',
};
