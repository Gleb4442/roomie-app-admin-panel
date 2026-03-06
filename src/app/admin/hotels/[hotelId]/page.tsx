'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { adminApi, type AdminStaffMember, type CreateAdminStaffData } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'branding', label: 'Branding' },
  { key: 'pms', label: 'PMS' },
  { key: 'sms', label: 'SMS' },
  { key: 'pos', label: 'POS' },
  { key: 'tms', label: 'Task Mgmt' },
  { key: 'qr', label: 'QR Codes' },
  { key: 'services', label: 'Services' },
  { key: 'staff', label: 'Staff' },
];

export default function HotelConfigPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useAdminAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);

  const { data: hotel, isLoading } = useQuery({
    queryKey: ['admin-hotel', hotelId],
    queryFn: () => adminApi.getHotel(token!, hotelId),
    enabled: !!token,
  });

  const [form, setForm] = useState<{ name: string; location: string; timezone: string }>({
    name: '', location: '', timezone: 'UTC',
  });

  // Sync form when hotel loads
  const [synced, setSynced] = useState(false);
  if (hotel && !synced) {
    setForm({ name: hotel.name, location: hotel.location ?? '', timezone: hotel.timezone });
    setSynced(true);
  }

  const saveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateHotel(token!, hotelId, form);
      qc.invalidateQueries({ queryKey: ['admin-hotel', hotelId] });
      toast.success('Hotel updated');
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-6"><div className="card h-32 shimmer" /></div>;
  if (!hotel) return <div className="p-6 text-rose">Hotel not found</div>;

  return (
    <div className="p-6 max-w-[900px] animate-fade-in">
      <div className="flex items-center gap-2 text-xs text-ink-500 mb-4">
        <Link href="/admin" className="hover:text-white transition-colors">Hotels</Link>
        <span>/</span>
        <span className="text-white">{hotel.name}</span>
      </div>
      <PageHeader title={hotel.name} subtitle={hotel.location ?? hotel.slug} />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-600 font-display border-b-2 transition-colors -mb-px"
            style={{
              color: tab === t.key ? '#F43F5E' : '#64748B',
              borderBottomColor: tab === t.key ? '#F43F5E' : 'transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === 'general' && (
        <form onSubmit={saveGeneral} className="card p-6 space-y-4 max-w-[500px]">
          <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
          <Field label="Location" value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="City, Country" />
          <div>
            <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Timezone</label>
            <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
              {['UTC', 'Europe/Kyiv', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'Asia/Dubai'].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <SaveBtn saving={saving} />
        </form>
      )}

      {/* Branding */}
      {tab === 'branding' && <BrandingTab hotelId={hotelId} hotel={hotel} token={token!} />}
      {tab === 'pms' && <PMSTab hotelId={hotelId} token={token!} />}
      {tab === 'sms' && <SMSTab hotelId={hotelId} token={token!} />}
      {tab === 'pos' && <POSTab hotelId={hotelId} token={token!} />}
      {tab === 'tms' && <TMSTab hotelId={hotelId} token={token!} />}
      {tab === 'qr' && <QRTab hotelId={hotelId} token={token!} />}
      {tab === 'services' && <ServicesTab hotelId={hotelId} token={token!} />}
      {tab === 'staff' && <StaffTab hotelId={hotelId} token={token!} />}
    </div>
  );
}

// ─── Branding ──────────────────────────────────────────────────────────────

function BrandingTab({ hotelId, hotel, token }: { hotelId: string; hotel: { accentColor: string | null; logoUrl: string | null }; token: string }) {
  const qc = useQueryClient();
  const [color, setColor] = useState(hotel.accentColor ?? '#F0A500');
  const [welcome, setWelcome] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const saveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateBranding(token, hotelId, { accentColor: color, welcomeMessage: welcome });
      toast.success('Branding saved');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await adminApi.uploadLogo(token, hotelId, file);
      qc.invalidateQueries({ queryKey: ['admin-hotel', hotelId] });
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-4 max-w-[500px]">
      <form onSubmit={saveBranding} className="card p-6 space-y-4">
        <div>
          <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Accent Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-12 h-10 rounded cursor-pointer p-1" style={{ background: 'transparent', border: 'none' }} />
            <input value={color} onChange={e => setColor(e.target.value)} placeholder="#F0A500" className="flex-1" />
            <div className="w-10 h-10 rounded-lg border" style={{ background: color, borderColor: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>
        <Field label="Welcome Message" value={welcome} onChange={setWelcome} placeholder="Welcome to our hotel!" />
        <SaveBtn saving={saving} />
      </form>

      <div className="card p-6">
        <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-3 font-display">Hotel Logo</label>
        {hotel.logoUrl && (
          <div className="mb-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-xs text-ink-400 break-all">{hotel.logoUrl}</p>
          </div>
        )}
        <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg cursor-pointer transition-colors text-sm"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', color: uploading ? '#64748B' : '#94A3B8' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          {uploading ? 'Uploading...' : 'Upload Logo (PNG/SVG)'}
          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}

// ─── PMS ───────────────────────────────────────────────────────────────────

function PMSTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: pms, isLoading } = useQuery({
    queryKey: ['admin-pms', hotelId],
    queryFn: () => adminApi.getPmsConfig(token, hotelId),
    enabled: !!token,
  });

  const [form, setForm] = useState({ pmsType: 'SERVIO', pmsHotelId: '', syncMode: 'POLLING', apiUrl: '', apiKey: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced2, setSynced2] = useState(false);

  if (pms && !synced2) {
    setForm({
      pmsType: pms.pmsType,
      pmsHotelId: pms.pmsHotelId,
      syncMode: pms.syncMode,
      apiUrl: (pms.credentials?.apiUrl as string) ?? '',
      apiKey: (pms.credentials?.apiKey as string) ?? '',
    });
    setSynced2(true);
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { apiUrl, apiKey, pmsType, pmsHotelId, syncMode } = form;
      await adminApi.upsertPmsConfig(token, hotelId, {
        pmsType: pmsType as 'SERVIO' | 'EASYMS' | 'MEWS' | 'OPERA' | 'CLOUDBEDS',
        pmsHotelId,
        syncMode: syncMode as 'WEBHOOK' | 'POLLING' | 'MANUAL' | 'DISABLED',
        credentials: { apiUrl, apiKey },
      });
      qc.invalidateQueries({ queryKey: ['admin-pms', hotelId] });
      toast.success('PMS config saved');
    } catch { toast.error('Failed to save PMS config'); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await adminApi.testPmsConnection(token, hotelId);
      toast.success(r.message || 'Connection successful');
    } catch { toast.error('Connection failed'); }
    finally { setTesting(false); }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await adminApi.syncPms(token, hotelId);
      toast.success('Sync triggered');
    } catch { toast.error('Sync failed'); }
    finally { setSyncing(false); }
  };

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <form onSubmit={save} className="card p-6 space-y-4 max-w-[520px]">
      <h3 className="font-display font-700 text-sm text-white">PMS Integration</h3>
      <div>
        <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">PMS Type</label>
        <select value={form.pmsType} onChange={e => setForm(f => ({ ...f, pmsType: e.target.value }))}>
          {['SERVIO', 'EASYMS', 'MEWS', 'OPERA', 'CLOUDBEDS'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <Field label="PMS Hotel ID" value={form.pmsHotelId} onChange={v => setForm(f => ({ ...f, pmsHotelId: v }))} placeholder="e.g. 42" required />
      <div>
        <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Sync Mode</label>
        <select value={form.syncMode} onChange={e => setForm(f => ({ ...f, syncMode: e.target.value }))}>
          {['WEBHOOK', 'POLLING', 'MANUAL', 'DISABLED'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <Field label="API URL" value={form.apiUrl} onChange={v => setForm(f => ({ ...f, apiUrl: v }))} placeholder="https://pms.hotel.com/api" />
      <Field label="API Key" value={form.apiKey} onChange={v => setForm(f => ({ ...f, apiKey: v }))} placeholder="Bearer token or key" />
      <div className="flex gap-2 pt-2">
        <SaveBtn saving={saving} />
        {pms && (
          <>
            <button type="button" onClick={test} disabled={testing}
              className="px-4 h-10 rounded-lg text-sm font-600 font-display shrink-0 transition-all"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
              {testing ? 'Testing...' : 'Test'}
            </button>
            <button type="button" onClick={syncNow} disabled={syncing}
              className="px-4 h-10 rounded-lg text-sm font-600 font-display shrink-0 transition-all"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </>
        )}
      </div>
      {pms?.lastSyncAt && (
        <p className="text-xs text-ink-500">Last sync: {pms.lastSyncAt}</p>
      )}
    </form>
  );
}

// ─── SMS ───────────────────────────────────────────────────────────────────

function SMSTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: sms } = useQuery({
    queryKey: ['admin-sms', hotelId],
    queryFn: () => adminApi.getSmsConfig(token, hotelId),
    enabled: !!token,
  });

  const [form, setForm] = useState({ provider: 'TWILIO', senderName: '', accountSid: '', authToken: '', from: '' });
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [synced2, setSynced2] = useState(false);

  if (sms && !synced2) {
    setForm({
      provider: sms.provider,
      senderName: sms.senderName ?? '',
      accountSid: (sms.credentials?.accountSid as string) ?? '',
      authToken: (sms.credentials?.authToken as string) ?? '',
      from: (sms.credentials?.from as string) ?? '',
    });
    setSynced2(true);
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { senderName, provider, accountSid, authToken, from } = form;
      await adminApi.upsertSmsConfig(token, hotelId, { provider: provider as 'TWILIO' | 'TURBOSMS', senderName, credentials: { accountSid, authToken, from } });
      qc.invalidateQueries({ queryKey: ['admin-sms', hotelId] });
      toast.success('SMS config saved');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const testSMS = async () => {
    if (!testPhone) return toast.error('Enter a phone number');
    setTesting(true);
    try {
      await adminApi.testSms(token, hotelId, testPhone);
      toast.success('Test SMS sent!');
    } catch { toast.error('SMS sending failed'); }
    finally { setTesting(false); }
  };

  return (
    <div className="space-y-4 max-w-[520px]">
      <form onSubmit={save} className="card p-6 space-y-4">
        <h3 className="font-display font-700 text-sm text-white">SMS Configuration</h3>
        <div>
          <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Provider</label>
          <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
            {['TWILIO', 'TURBOSMS', 'ESPUTNIK', 'LOG'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <Field label="Sender Name" value={form.senderName} onChange={v => setForm(f => ({ ...f, senderName: v }))} placeholder="HotelMol" />
        {form.provider === 'TWILIO' && (
          <>
            <Field label="Account SID" value={form.accountSid} onChange={v => setForm(f => ({ ...f, accountSid: v }))} placeholder="ACxxxxxxxxxx" />
            <Field label="Auth Token" value={form.authToken} onChange={v => setForm(f => ({ ...f, authToken: v }))} placeholder="••••••••" />
            <Field label="From Number" value={form.from} onChange={v => setForm(f => ({ ...f, from: v }))} placeholder="+1234567890" />
          </>
        )}
        {form.provider === 'TURBOSMS' && (
          <Field label="API Key" value={form.authToken} onChange={v => setForm(f => ({ ...f, authToken: v }))} placeholder="TurboSMS API key" />
        )}
        <SaveBtn saving={saving} />
      </form>

      <div className="card p-5">
        <h3 className="font-display font-700 text-sm text-white mb-4">Send Test SMS</h3>
        <div className="flex gap-2">
          <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+380501234567" className="flex-1" />
          <button type="button" onClick={testSMS} disabled={testing}
            className="px-4 h-[42px] rounded-lg text-sm font-600 font-display shrink-0"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
            {testing ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── POS ───────────────────────────────────────────────────────────────────

function POSTab({ hotelId, token }: { hotelId: string; token: string }) {
  const { data: pos } = useQuery({
    queryKey: ['admin-pos', hotelId],
    queryFn: () => adminApi.getPosConfig(token, hotelId),
    enabled: !!token,
  });

  const [form, setForm] = useState({ posType: 'POSTER', token: '', accountId: '' });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced2, setSynced2] = useState(false);

  if (pos && !synced2) {
    setForm({
      posType: pos.posType ?? 'POSTER',
      token: (pos.credentials?.token as string) ?? '',
      accountId: (pos.credentials?.accountId as string) ?? '',
    });
    setSynced2(true);
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.upsertPosConfig(token, hotelId, { posType: form.posType, credentials: { token: form.token, accountId: form.accountId } });
      toast.success('POS config saved');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const syncMenu = async () => {
    setSyncing(true);
    try {
      await adminApi.syncPosMenu(token, hotelId);
      toast.success('Menu sync triggered');
    } catch { toast.error('Sync failed'); }
    finally { setSyncing(false); }
  };

  return (
    <form onSubmit={save} className="card p-6 space-y-4 max-w-[520px]">
      <h3 className="font-display font-700 text-sm text-white">POS Integration</h3>
      <div>
        <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">POS Type</label>
        <select value={form.posType} onChange={e => setForm(f => ({ ...f, posType: e.target.value }))}>
          {['POSTER', 'SYRVE', 'RKEEPER'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <Field label="API Token" value={form.token} onChange={v => setForm(f => ({ ...f, token: v }))} placeholder="POS API token" />
      <Field label="Account ID" value={form.accountId} onChange={v => setForm(f => ({ ...f, accountId: v }))} placeholder="Account or tenant ID" />
      <div className="flex gap-2">
        <SaveBtn saving={saving} />
        {pos && (
          <button type="button" onClick={syncMenu} disabled={syncing}
            className="px-4 h-10 rounded-lg text-sm font-600 font-display shrink-0"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
            {syncing ? 'Syncing...' : 'Sync Menu'}
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Task Management (TMS) ─────────────────────────────────────────────────

const TMS_PROVIDERS = ['BUILT_IN', 'HOTELKIT', 'FLEXKEEPING', 'HOTSOS', 'GENERIC_WEBHOOK'];
const TMS_MODES = [
  { value: 'BUILT_IN', label: 'Built-in TMS', desc: 'Use HotelMol\'s own task management system' },
  { value: 'EXTERNAL', label: 'External TMS', desc: 'Route all tasks to an external system via API' },
  { value: 'HYBRID', label: 'Hybrid', desc: 'Some categories go to built-in, others to external TMS' },
];

function TMSTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useQuery({
    queryKey: ['admin-tms', hotelId],
    queryFn: () => adminApi.getTmsConfig(token, hotelId),
    enabled: !!token,
  });

  const [form, setForm] = useState({
    mode: 'BUILT_IN',
    provider: 'BUILT_IN',
    enabled: false,
    apiUrl: '',
    apiKey: '',
    webhookSecret: '',
    outgoingWebhookUrl: '',
    pollingEnabled: false,
    pollingIntervalMs: 30000,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [synced, setSynced] = useState(false);

  if (cfg && !synced) {
    setForm({
      mode: cfg.mode ?? 'BUILT_IN',
      provider: cfg.provider ?? 'BUILT_IN',
      enabled: cfg.enabled ?? false,
      apiUrl: (cfg.credentials?.apiUrl as string) ?? '',
      apiKey: (cfg.credentials?.apiKey as string) ?? '',
      webhookSecret: cfg.webhookSecret ?? '',
      outgoingWebhookUrl: cfg.outgoingWebhookUrl ?? '',
      pollingEnabled: cfg.pollingEnabled ?? false,
      pollingIntervalMs: cfg.pollingIntervalMs ?? 30000,
    });
    setSynced(true);
  }

  const isExternal = form.mode === 'EXTERNAL' || form.mode === 'HYBRID';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.upsertTmsConfig(token, hotelId, {
        mode: form.mode as 'BUILT_IN' | 'EXTERNAL' | 'HYBRID',
        provider: isExternal ? form.provider : 'BUILT_IN',
        enabled: form.enabled,
        credentials: { apiUrl: form.apiUrl, apiKey: form.apiKey },
        webhookSecret: form.webhookSecret || undefined,
        outgoingWebhookUrl: form.outgoingWebhookUrl || undefined,
        pollingEnabled: form.pollingEnabled,
        pollingIntervalMs: form.pollingIntervalMs,
      });
      qc.invalidateQueries({ queryKey: ['admin-tms', hotelId] });
      toast.success('TMS config saved');
    } catch { toast.error('Failed to save TMS config'); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await adminApi.testTmsConnection(token, hotelId);
      toast.success(r.message || 'Connection successful');
    } catch { toast.error('Connection test failed'); }
    finally { setTesting(false); }
  };

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <form onSubmit={save} className="space-y-4 max-w-[560px]">
      {/* Mode */}
      <div className="card p-5 space-y-3">
        <h3 className="font-display font-700 text-sm text-white">TMS Mode</h3>
        <div className="space-y-2">
          {TMS_MODES.map(m => (
            <label key={m.value}
              className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
              style={{
                background: form.mode === m.value ? 'rgba(240,165,0,0.07)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${form.mode === m.value ? 'rgba(240,165,0,0.25)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              <input
                type="radio"
                name="tms-mode"
                value={m.value}
                checked={form.mode === m.value}
                onChange={() => setForm(f => ({ ...f, mode: m.value, provider: m.value === 'BUILT_IN' ? 'BUILT_IN' : f.provider === 'BUILT_IN' ? 'HOTELKIT' : f.provider }))}
                className="mt-0.5 accent-gold"
              />
              <div>
                <p className="text-sm font-600 text-white">{m.label}</p>
                <p className="text-xs text-ink-400 mt-0.5">{m.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-sm font-600 text-white">Enable TMS</p>
            <p className="text-xs text-ink-400">Tasks will be routed according to the selected mode</p>
          </div>
          <button type="button" onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
            className="relative w-11 h-6 rounded-full transition-colors shrink-0"
            style={{ background: form.enabled ? '#F0A500' : 'rgba(255,255,255,0.1)' }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              style={{ left: form.enabled ? '22px' : '2px' }} />
          </button>
        </div>
      </div>

      {/* External settings */}
      {isExternal && (
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-700 text-sm text-white">External TMS Settings</h3>

          <div>
            <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Provider</label>
            <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
              {TMS_PROVIDERS.filter(p => p !== 'BUILT_IN').map(p => (
                <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <Field label="API URL" value={form.apiUrl} onChange={v => setForm(f => ({ ...f, apiUrl: v }))} placeholder="https://api.hotelkit.net/v1" />
          <Field label="API Key / Token" value={form.apiKey} onChange={v => setForm(f => ({ ...f, apiKey: v }))} placeholder="Bearer token or API key" />

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
            <p className="text-xs font-600 uppercase tracking-widest text-ink-300 mb-3 font-display">Webhook</p>
            <div className="space-y-3">
              <Field label="Webhook Secret (incoming)" value={form.webhookSecret} onChange={v => setForm(f => ({ ...f, webhookSecret: v }))} placeholder="Secret for verifying incoming webhooks" />
              <Field label="Outgoing Webhook URL" value={form.outgoingWebhookUrl} onChange={v => setForm(f => ({ ...f, outgoingWebhookUrl: v }))} placeholder="https://yourtms.com/webhook/hotelmol" />
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-600 text-white">Polling</p>
                <p className="text-xs text-ink-400">Poll external TMS for status updates</p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, pollingEnabled: !f.pollingEnabled }))}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                style={{ background: form.pollingEnabled ? '#3B82F6' : 'rgba(255,255,255,0.1)' }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: form.pollingEnabled ? '22px' : '2px' }} />
              </button>
            </div>
            {form.pollingEnabled && (
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Interval (ms)</label>
                <select value={form.pollingIntervalMs} onChange={e => setForm(f => ({ ...f, pollingIntervalMs: Number(e.target.value) }))}>
                  {[15000, 30000, 60000, 120000, 300000].map(v => (
                    <option key={v} value={v}>{v / 1000}s</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <SaveBtn saving={saving} />
        {cfg && isExternal && (
          <button type="button" onClick={test} disabled={testing}
            className="px-4 h-10 rounded-lg text-sm font-600 font-display shrink-0 transition-all"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        )}
      </div>

      {cfg && (
        <p className="text-xs text-ink-500">
          Current mode: <span className="text-ink-300">{cfg.mode}</span>
          {cfg.provider !== 'BUILT_IN' && <> · Provider: <span className="text-ink-300">{cfg.provider}</span></>}
          {cfg.enabled ? <span className="text-teal ml-2">● Enabled</span> : <span className="text-rose ml-2">○ Disabled</span>}
        </p>
      )}
    </form>
  );
}

// ─── QR ────────────────────────────────────────────────────────────────────

function QRTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: qrCodes, isLoading } = useQuery({
    queryKey: ['admin-qr', hotelId],
    queryFn: () => adminApi.listQR(token, hotelId),
    enabled: !!token,
  });

  const [genForm, setGenForm] = useState({ type: 'in_room', label: '', roomNumber: '' });
  const [bulkRooms, setBulkRooms] = useState('');
  const [generating, setGenerating] = useState(false);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await adminApi.generateQR(token, hotelId, genForm);
      qc.invalidateQueries({ queryKey: ['admin-qr', hotelId] });
      toast.success('QR code generated');
      setGenForm({ type: 'in_room', label: '', roomNumber: '' });
    } catch { toast.error('Generation failed'); }
    finally { setGenerating(false); }
  };

  const generateBulk = async () => {
    const rooms = bulkRooms.split(',').map(r => r.trim()).filter(Boolean);
    if (!rooms.length) return toast.error('Enter comma-separated room numbers');
    setGenerating(true);
    try {
      await adminApi.generateQRBulk(token, hotelId, rooms);
      qc.invalidateQueries({ queryKey: ['admin-qr', hotelId] });
      toast.success(`Generated ${rooms.length} QR codes`);
      setBulkRooms('');
    } catch { toast.error('Bulk generation failed'); }
    finally { setGenerating(false); }
  };

  const deleteQR = async (id: string) => {
    if (!confirm('Delete this QR code?')) return;
    try {
      await adminApi.deleteQR(token, hotelId, id);
      qc.invalidateQueries({ queryKey: ['admin-qr', hotelId] });
      toast.success('QR deleted');
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Single generate */}
        <form onSubmit={generate} className="card p-5 space-y-3">
          <h3 className="font-display font-700 text-sm text-white">Generate QR</h3>
          <div>
            <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Type</label>
            <select value={genForm.type} onChange={e => setGenForm(f => ({ ...f, type: e.target.value }))}>
              {['in_room', 'lobby', 'restaurant', 'spa', 'elevator'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Field label="Label" value={genForm.label} onChange={v => setGenForm(f => ({ ...f, label: v }))} placeholder="Room 301" required />
          <Field label="Room Number (optional)" value={genForm.roomNumber} onChange={v => setGenForm(f => ({ ...f, roomNumber: v }))} placeholder="301" />
          <SaveBtn saving={generating} label="Generate" />
        </form>

        {/* Bulk generate */}
        <div className="card p-5 space-y-3">
          <h3 className="font-display font-700 text-sm text-white">Bulk Generate (Rooms)</h3>
          <Field label="Room Numbers (comma-separated)" value={bulkRooms} onChange={setBulkRooms} placeholder="301, 302, 303, 304" />
          <button type="button" onClick={generateBulk} disabled={generating}
            className="w-full h-10 rounded-lg text-sm font-600 font-display transition-all"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
            {generating ? 'Generating...' : 'Generate Bulk'}
          </button>
        </div>
      </div>

      {/* QR list */}
      {!isLoading && qrCodes && qrCodes.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b text-xs font-600 text-ink-400 font-display uppercase tracking-widest" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {qrCodes.length} QR Codes
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Label</th><th>Type</th><th>Room</th><th>Scans</th><th>Active</th><th></th></tr>
            </thead>
            <tbody>
              {qrCodes.map(qr => (
                <tr key={qr.id}>
                  <td className="text-white font-600">{qr.label}</td>
                  <td className="text-ink-400 capitalize">{qr.type.replace('_', ' ')}</td>
                  <td className="num text-ink-300">{qr.roomNumber || '—'}</td>
                  <td className="num text-ink-300">{qr.scanCount}</td>
                  <td>{qr.isActive ? <span className="text-teal text-xs">✓</span> : <span className="text-rose text-xs">✗</span>}</td>
                  <td>
                    <button onClick={() => deleteQR(qr.id)} className="text-ink-500 hover:text-rose transition-colors">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Services ──────────────────────────────────────────────────────────────

function ServicesTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-services', hotelId],
    queryFn: () => adminApi.listServiceCategories(token, hotelId),
    enabled: !!token,
  });

  const [seeding, setSeeding] = useState(false);
  const [newItem, setNewItem] = useState<{ catId: string; name: string; price: string } | null>(null);

  const seed = async () => {
    setSeeding(true);
    try {
      await adminApi.seedServiceCategories(token, hotelId);
      qc.invalidateQueries({ queryKey: ['admin-services', hotelId] });
      toast.success('Default categories seeded');
    } catch { toast.error('Seed failed'); }
    finally { setSeeding(false); }
  };

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem) return;
    try {
      await adminApi.createServiceItem(token, hotelId, newItem.catId, { name: newItem.name, price: parseFloat(newItem.price), currency: 'USD', isAvailable: true });
      qc.invalidateQueries({ queryKey: ['admin-services', hotelId] });
      toast.success('Item added');
      setNewItem(null);
    } catch { toast.error('Failed to add item'); }
  };

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={seed} disabled={seeding}
          className="px-4 py-2 rounded-lg text-xs font-600 font-display"
          style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7', border: '1px solid rgba(168,85,247,0.2)' }}>
          {seeding ? 'Seeding...' : 'Seed Default Categories'}
        </button>
      </div>

      {!categories?.length ? (
        <div className="card flex items-center justify-center h-32 text-ink-500 text-sm">No categories yet</div>
      ) : (
        categories.map(cat => (
          <div key={cat.id} className="card overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <span className="text-lg">{cat.icon}</span>
              <span className="font-display font-700 text-sm text-white">{cat.name}</span>
              <span className="text-xs text-ink-500 ml-auto">{cat.items?.length ?? 0} items</span>
              <button onClick={() => setNewItem({ catId: cat.id, name: '', price: '' })}
                className="text-xs text-gold hover:text-gold-dim transition-colors ml-2">+ Add item</button>
            </div>
            {cat.items?.length > 0 && (
              <table className="data-table">
                <thead><tr><th>Name</th><th>Price</th><th>Available</th></tr></thead>
                <tbody>
                  {cat.items.map(item => (
                    <tr key={item.id}>
                      <td className="text-white">{item.name}</td>
                      <td className="num text-ink-300">${item.price}</td>
                      <td>{item.isAvailable ? <span className="text-teal text-xs">✓</span> : <span className="text-ink-500 text-xs">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {newItem?.catId === cat.id && (
              <form onSubmit={createItem} className="px-5 py-3 flex gap-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <input value={newItem.name} onChange={e => setNewItem(n => n ? { ...n, name: e.target.value } : n)} placeholder="Item name" className="flex-1" required />
                <input value={newItem.price} onChange={e => setNewItem(n => n ? { ...n, price: e.target.value } : n)} placeholder="Price" type="number" step="0.01" className="w-24" required />
                <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-600 font-display" style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500' }}>Add</button>
                <button type="button" onClick={() => setNewItem(null)} className="text-ink-500 text-xs">✕</button>
              </form>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Staff ─────────────────────────────────────────────────────────────────

const ROLES = ['LINE_STAFF', 'SUPERVISOR', 'HEAD_OF_DEPT', 'RECEPTIONIST', 'GENERAL_MANAGER'];
const DEPARTMENTS = ['HOUSEKEEPING', 'MAINTENANCE', 'FOOD_AND_BEVERAGE', 'FRONT_OFFICE', 'SECURITY', 'MANAGEMENT'];

const ROLE_COLOR: Record<string, string> = {
  LINE_STAFF: '#64748B', SUPERVISOR: '#3B82F6', HEAD_OF_DEPT: '#8B5CF6',
  RECEPTIONIST: '#10B981', GENERAL_MANAGER: '#F0A500',
};

const DEPT_SHORT: Record<string, string> = {
  HOUSEKEEPING: 'HK', MAINTENANCE: 'MNT', FOOD_AND_BEVERAGE: 'F&B',
  FRONT_OFFICE: 'FO', SECURITY: 'SEC', MANAGEMENT: 'MGT',
};

const EMPTY_STAFF: CreateAdminStaffData = {
  email: '', firstName: '', lastName: '', phone: '',
  role: 'LINE_STAFF', department: 'HOUSEKEEPING',
  password: '', assignedFloor: '',
};

function StaffTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminStaffMember | null>(null);
  const [form, setForm] = useState<CreateAdminStaffData>(EMPTY_STAFF);
  const [pinModal, setPinModal] = useState<{ staffId: string; name: string } | null>(null);
  const [newPin, setNewPin] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');
  const [filterDept, setFilterDept] = useState('');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['admin-staff', hotelId],
    queryFn: () => adminApi.listStaff(token, hotelId),
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateAdminStaffData) => adminApi.createStaff(token, hotelId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-staff', hotelId] }); closeModal(); toast.success('Staff member created'); },
    onError: () => toast.error('Failed to create staff member'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAdminStaffData> }) =>
      adminApi.updateStaff(token, hotelId, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-staff', hotelId] }); closeModal(); toast.success('Staff member updated'); },
    onError: () => toast.error('Failed to update staff member'),
  });

  const deactivateMut = useMutation({
    mutationFn: (staffId: string) => adminApi.deactivateStaff(token, hotelId, staffId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-staff', hotelId] }); toast.success('Staff member deactivated'); },
    onError: () => toast.error('Failed to deactivate'),
  });

  const pinMut = useMutation({
    mutationFn: ({ staffId, pin }: { staffId: string; pin: string }) =>
      adminApi.resetStaffPin(token, hotelId, staffId, pin),
    onSuccess: () => { setPinModal(null); setNewPin(''); toast.success('PIN updated'); },
    onError: () => toast.error('Failed to update PIN'),
  });

  function openCreate() { setEditTarget(null); setForm(EMPTY_STAFF); setShowModal(true); }

  function openEdit(s: AdminStaffMember) {
    setEditTarget(s);
    setForm({ email: s.email, firstName: s.firstName, lastName: s.lastName ?? '', phone: s.phone ?? '', role: s.role, department: s.department, password: '', assignedFloor: s.assignedFloor ?? '' });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditTarget(null); setForm(EMPTY_STAFF); }

  function submit() {
    if (editTarget) {
      const { password, ...rest } = form;
      const data: Partial<CreateAdminStaffData> = rest;
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

  const isOnShift = (s: AdminStaffMember) => s.shifts && s.shifts.some(sh => sh.isActive);
  const isPending = createMut.isPending || updateMut.isPending;

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border text-xs font-600 font-display" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {(['all', 'active', 'inactive'] as const).map(v => (
            <button key={v} onClick={() => setFilterActive(v)}
              className="px-3 py-1.5 capitalize transition-colors"
              style={{ background: filterActive === v ? 'rgba(244,63,94,0.15)' : 'transparent', color: filterActive === v ? '#F43F5E' : '#64748B' }}>
              {v}
            </button>
          ))}
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="text-xs h-8 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: filterDept ? '#fff' : '#64748B' }}>
          <option value="">All departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-ink-500">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={openCreate}
            className="h-8 px-4 rounded-lg text-xs font-600 font-display transition-all"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff', boxShadow: '0 0 12px rgba(244,63,94,0.2)' }}>
            + Add Staff
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card flex items-center justify-center h-32 text-ink-500 text-sm">No staff members</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Dept</th><th>Floor</th><th>Status</th><th>Shift</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="flex flex-col">
                      <span className="text-white font-600 text-sm">{s.firstName} {s.lastName ?? ''}</span>
                      <span className="text-ink-500 text-xs">{s.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className="text-xs font-600 px-2 py-0.5 rounded-full font-display"
                      style={{ background: `${ROLE_COLOR[s.role]}18`, color: ROLE_COLOR[s.role] ?? '#94A3B8' }}>
                      {s.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="text-ink-300 text-xs font-600">{DEPT_SHORT[s.department] ?? s.department}</td>
                  <td className="text-ink-400 text-xs">{s.assignedFloor ?? '—'}</td>
                  <td>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.isActive ? '#10B981' : '#475569' }} />
                      <span style={{ color: s.isActive ? '#10B981' : '#475569' }}>{s.isActive ? 'Active' : 'Inactive'}</span>
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: isOnShift(s) ? '#F0A500' : '#475569' }}>
                    {isOnShift(s) ? 'On Shift' : '—'}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} className="text-ink-400 hover:text-white transition-colors text-xs">Edit</button>
                      <button onClick={() => setPinModal({ staffId: s.id, name: `${s.firstName} ${s.lastName ?? ''}` })}
                        className="text-ink-400 hover:text-gold transition-colors text-xs">PIN</button>
                      {s.isActive && (
                        <button onClick={() => { if (confirm(`Deactivate ${s.firstName}?`)) deactivateMut.mutate(s.id); }}
                          className="text-ink-400 hover:text-rose transition-colors text-xs">Off</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md p-6 space-y-4" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-700 text-white">{editTarget ? 'Edit Staff Member' : 'Add Staff Member'}</h3>
              <button onClick={closeModal} className="text-ink-500 hover:text-white text-lg">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} required />
              <Field label="Last Name" value={form.lastName ?? ''} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
            </div>
            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required disabled={!!editTarget}
                style={editTarget ? { opacity: 0.5, cursor: 'not-allowed' } : {}} />
            </div>
            <Field label="Phone" value={form.phone ?? ''} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+380501234567" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Department</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <Field label="Assigned Floor" value={form.assignedFloor ?? ''} onChange={v => setForm(f => ({ ...f, assignedFloor: v }))} placeholder="e.g. 3" />
            <Field label={editTarget ? 'New Password (leave blank to keep)' : 'Password'} value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} required={!editTarget} />
            <div className="flex gap-2 pt-2">
              <button onClick={submit} disabled={isPending}
                className="flex-1 h-10 rounded-lg text-sm font-600 font-display transition-all"
                style={{ background: isPending ? 'rgba(244,63,94,0.4)' : 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff' }}>
                {isPending ? 'Saving...' : editTarget ? 'Save Changes' : 'Create'}
              </button>
              <button onClick={closeModal} className="px-4 h-10 rounded-lg text-sm font-600 font-display"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Reset Modal */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-700 text-white">Reset PIN</h3>
              <button onClick={() => { setPinModal(null); setNewPin(''); }} className="text-ink-500 hover:text-white text-lg">✕</button>
            </div>
            <p className="text-xs text-ink-400">{pinModal.name}</p>
            <Field label="New PIN (4–8 digits)" value={newPin} onChange={setNewPin} placeholder="1234" />
            <button onClick={() => pinMut.mutate({ staffId: pinModal.staffId, pin: newPin })}
              disabled={pinMut.isPending || newPin.length < 4}
              className="w-full h-10 rounded-lg text-sm font-600 font-display"
              style={{ background: newPin.length >= 4 ? 'rgba(240,165,0,0.15)' : 'rgba(255,255,255,0.04)', color: newPin.length >= 4 ? '#F0A500' : '#475569', border: `1px solid ${newPin.length >= 4 ? 'rgba(240,165,0,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
              {pinMut.isPending ? 'Updating...' : 'Set PIN'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}

function SaveBtn({ saving, label = 'Save Changes' }: { saving: boolean; label?: string }) {
  return (
    <button type="submit" disabled={saving}
      className="h-10 px-5 rounded-lg text-sm font-600 font-display transition-all"
      style={{ background: saving ? 'rgba(244,63,94,0.4)' : 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff', boxShadow: saving ? 'none' : '0 0 16px rgba(244,63,94,0.2)' }}>
      {saving ? 'Saving...' : label}
    </button>
  );
}
