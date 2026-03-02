'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi, type TaskTemplate, type TemplateFormData, type ChecklistItemData } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';

const DEPARTMENTS = ['HOUSEKEEPING', 'MAINTENANCE', 'FOOD_AND_BEVERAGE', 'FRONT_OFFICE', 'SECURITY', 'MANAGEMENT'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const DEPT_ICON: Record<string, string> = {
  HOUSEKEEPING: '🛏',
  MAINTENANCE: '🔧',
  FOOD_AND_BEVERAGE: '🍽',
  FRONT_OFFICE: '🏨',
  SECURITY: '🛡',
  MANAGEMENT: '⚙️',
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: '#64748B',
  NORMAL: '#3B82F6',
  HIGH: '#F59E0B',
  URGENT: '#F43F5E',
};

function emptyForm(): TemplateFormData {
  return {
    name: '',
    department: 'HOUSEKEEPING',
    defaultPriority: 'NORMAL',
    slaMinutes: undefined,
    isActive: true,
    checklistItems: [],
  };
}

export default function TemplatesPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<TaskTemplate | null>(null);
  const [form, setForm] = useState<TemplateFormData>(emptyForm());
  const [newItemText, setNewItemText] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates-dashboard', hotelId],
    queryFn: () => dashboardApi.getTemplates(hotelId, token!),
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: (data: TemplateFormData) => dashboardApi.createTemplate(hotelId, token!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates-dashboard', hotelId] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TemplateFormData> }) =>
      dashboardApi.updateTemplate(hotelId, id, token!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates-dashboard', hotelId] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (templateId: string) => dashboardApi.deleteTemplate(hotelId, templateId, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates-dashboard', hotelId] }),
  });

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setNewItemText('');
    setShowModal(true);
  }

  function openEdit(t: TaskTemplate) {
    setEditTarget(t);
    setForm({
      name: t.name,
      department: t.department,
      defaultPriority: t.defaultPriority,
      slaMinutes: t.slaMinutes ?? undefined,
      isActive: t.isActive,
      checklistItems: t.checklistItems.map(i => ({
        text: i.text,
        isRequired: i.isRequired,
        sortOrder: i.sortOrder,
      })),
    });
    setNewItemText('');
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditTarget(null); setForm(emptyForm()); setNewItemText(''); }

  function addChecklistItem() {
    const text = newItemText.trim();
    if (!text) return;
    setForm(f => ({
      ...f,
      checklistItems: [
        ...f.checklistItems,
        { text, isRequired: true, sortOrder: f.checklistItems.length },
      ],
    }));
    setNewItemText('');
  }

  function removeChecklistItem(idx: number) {
    setForm(f => ({
      ...f,
      checklistItems: f.checklistItems.filter((_, i) => i !== idx).map((item, i) => ({ ...item, sortOrder: i })),
    }));
  }

  function toggleRequired(idx: number) {
    setForm(f => ({
      ...f,
      checklistItems: f.checklistItems.map((item, i) =>
        i === idx ? { ...item, isRequired: !item.isRequired } : item,
      ),
    }));
  }

  function submit() {
    const data = { ...form, slaMinutes: form.slaMinutes || undefined };
    if (editTarget) {
      updateMut.mutate({ id: editTarget.id, data });
    } else {
      createMut.mutate(data);
    }
  }

  const filtered = templates.filter(t => !filterDept || t.department === filterDept);
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title="Task Templates"
        subtitle="Pre-configured task templates with checklists for common hotel operations"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 font-display transition-all"
            style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.2)' }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            New Template
          </button>
        }
      />

      {/* Dept filter */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setFilterDept('')}
          className="px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
          style={{
            background: !filterDept ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
            color: !filterDept ? '#F0A500' : '#64748B',
            border: `1px solid ${!filterDept ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
          }}
        >
          All
        </button>
        {DEPARTMENTS.map(d => (
          <button
            key={d}
            onClick={() => setFilterDept(d)}
            className="px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
            style={{
              background: filterDept === d ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
              color: filterDept === d ? '#F0A500' : '#64748B',
              border: `1px solid ${filterDept === d ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
            }}
          >
            {DEPT_ICON[d]} {d.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 shimmer rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-3">
          <span style={{ fontSize: 40 }}>📋</span>
          <p className="text-sm text-ink-400">No templates yet. Create one to speed up task creation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div
              key={t.id}
              className="card p-4 flex flex-col gap-3"
              style={{ opacity: t.isActive ? 1 : 0.5 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 20 }}>{DEPT_ICON[t.department] ?? '📋'}</span>
                  <div>
                    <p className="text-sm font-600 text-white">{t.name}</p>
                    <p className="text-xs text-ink-400">{t.department.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                {!t.isActive && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(100,116,139,0.15)', color: '#64748B' }}>
                    Inactive
                  </span>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3">
                <span
                  className="text-xs px-2 py-0.5 rounded font-600"
                  style={{ background: `${PRIORITY_COLOR[t.defaultPriority]}15`, color: PRIORITY_COLOR[t.defaultPriority] }}
                >
                  {t.defaultPriority}
                </span>
                {t.slaMinutes && (
                  <span className="text-xs text-ink-400">⏱ {t.slaMinutes}m SLA</span>
                )}
                {t.checklistItems.length > 0 && (
                  <span className="text-xs text-ink-400">☑ {t.checklistItems.length} steps</span>
                )}
              </div>

              {/* Checklist preview */}
              {t.checklistItems.length > 0 && (
                <div className="space-y-1 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {t.checklistItems.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded shrink-0"
                        style={{ border: '1.5px solid rgba(255,255,255,0.2)' }}
                      />
                      <p className="text-xs text-ink-300 truncate">{item.text}</p>
                      {item.isRequired && (
                        <span className="text-xs shrink-0" style={{ color: '#F43F5E' }}>*</span>
                      )}
                    </div>
                  ))}
                  {t.checklistItems.length > 3 && (
                    <p className="text-xs text-ink-500">+{t.checklistItems.length - 3} more</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  onClick={() => openEdit(t)}
                  className="flex-1 py-1.5 rounded text-xs font-600 text-ink-300 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete template "${t.name}"?`)) deleteMut.mutate(t.id);
                  }}
                  className="px-3 py-1.5 rounded text-xs font-600 transition-colors"
                  style={{ background: 'rgba(244,63,94,0.08)', color: '#F43F5E' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-700 font-display text-white">
                {editTarget ? 'Edit Template' : 'New Template'}
              </h2>
              <button onClick={closeModal} className="text-ink-400 hover:text-white text-xl leading-none">×</button>
            </div>

            <div>
              <label className="text-xs text-ink-400 mb-1 block">Template Name *</label>
              <input
                className="w-full text-sm"
                style={inputStyle}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Room Deep Clean"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="text-xs text-ink-400 mb-1 block">Default Priority</label>
                <select
                  className="w-full text-sm"
                  style={inputStyle}
                  value={form.defaultPriority}
                  onChange={e => setForm(f => ({ ...f, defaultPriority: e.target.value }))}
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-400 mb-1 block">SLA (minutes)</label>
                <input
                  type="number"
                  className="w-full text-sm"
                  style={inputStyle}
                  value={form.slaMinutes ?? ''}
                  onChange={e => setForm(f => ({ ...f, slaMinutes: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="60"
                  min={1}
                />
              </div>
              {editTarget && (
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">Status</label>
                  <select
                    className="w-full text-sm"
                    style={inputStyle}
                    value={form.isActive ? 'active' : 'inactive'}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'active' }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
            </div>

            {/* Checklist items */}
            <div>
              <label className="text-xs text-ink-400 mb-2 block">
                Checklist Steps <span className="text-ink-500">({form.checklistItems.length})</span>
              </label>

              {form.checklistItems.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {form.checklistItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <span className="text-xs text-ink-500 w-4 shrink-0">{idx + 1}.</span>
                      <p className="text-sm text-ink-200 flex-1 truncate">{item.text}</p>
                      <button
                        onClick={() => toggleRequired(idx)}
                        className="text-xs shrink-0 px-1.5 py-0.5 rounded transition-colors"
                        style={{
                          background: item.isRequired ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.05)',
                          color: item.isRequired ? '#F43F5E' : '#64748B',
                        }}
                        title={item.isRequired ? 'Required' : 'Optional'}
                      >
                        {item.isRequired ? 'Required' : 'Optional'}
                      </button>
                      <button
                        onClick={() => removeChecklistItem(idx)}
                        className="text-ink-500 hover:text-red-400 transition-colors text-base leading-none shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  className="flex-1 text-sm"
                  style={inputStyle}
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
                  placeholder="Add checklist step…"
                />
                <button
                  onClick={addChecklistItem}
                  disabled={!newItemText.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-600 transition-all"
                  style={{
                    background: newItemText.trim() ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
                    color: newItemText.trim() ? '#F0A500' : '#475569',
                  }}
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-ink-500 mt-1">Press Enter or click Add. Click Required/Optional to toggle.</p>
            </div>

            {(createMut.isError || updateMut.isError) && (
              <p className="text-xs" style={{ color: '#F43F5E' }}>Failed to save template</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={closeModal}
                className="flex-1 py-2 rounded-lg text-sm text-ink-300"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={isPending || !form.name}
                className="flex-1 py-2 rounded-lg text-sm font-600"
                style={{ background: '#F0A500', color: '#0D1117', opacity: isPending || !form.name ? 0.6 : 1 }}
              >
                {isPending ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Template'}
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
