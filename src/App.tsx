import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, UsersRound, ClipboardList, Wallet, BellRing, Plus, Search,
  CalendarDays, X, Check, Settings2, ShieldCheck, Monitor, ChevronLeft,
  Activity, HeartPulse, CircleHelp, CloudOff, Sparkles, RefreshCw,
  Download, PencilLine, Stethoscope, Clock3, UserRoundCheck, ArrowUpLeft
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  snapshot, addPatient, addService, addVisit, addPayment,
  addFollowup, completeFollowup, setClinicName, desktopMode
} from './data';
import type { Snapshot, NewPatient, NewService, NewVisit, NewPayment, NewFollowup } from './types';
import { findUpdate, installUpdate, updatesEnabled } from './updater';
import type { AvailableUpdate } from './updater';

type Page = 'home' | 'patients' | 'services' | 'payments' | 'followups' | 'settings';
type FormType = 'visit' | 'patient' | 'service' | 'payment' | 'followup';
const empty: Snapshot = {
  patients: [], services: [], visits: [], payments: [], followups: [], clinicName: 'مطب من'
};
const menu: { id: Page; title: string; icon: LucideIcon }[] = [
  { id: 'home', title: 'داشبورد', icon: LayoutDashboard },
  { id: 'patients', title: 'مراجعین', icon: UsersRound },
  { id: 'services', title: 'خدمات', icon: ClipboardList },
  { id: 'payments', title: 'دریافتی‌ها', icon: Wallet },
  { id: 'followups', title: 'پیگیری‌ها', icon: BellRing }
];
const titles: Record<Page, string> = {
  home: 'داشبورد مدیریت', patients: 'مراجعین', services: 'خدمات',
  payments: 'دریافتی‌ها', followups: 'پیگیری‌ها', settings: 'تنظیمات مطب'
};
const formTitles: Record<FormType, string> = {
  visit: 'ثبت خدمات جدید', patient: 'افزودن مراجعه‌کننده',
  service: 'تعریف خدمت جدید', payment: 'ثبت دریافتی', followup: 'پیگیری جدید'
};
const currency = (n: number) => new Intl.NumberFormat('fa-IR').format(n) + ' تومان';
const number = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
const dateFa = (v: string) => {
  try { return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(v)); }
  catch { return v; }
};
const todayIso = () => new Date().toISOString().slice(0, 10);

function Empty({ icon: Icon = ClipboardList, title, caption }: { icon?: LucideIcon; title: string; caption: string }) {
  return <div className="empty">
    <div className="empty-icon"><Icon size={24} strokeWidth={1.8} /></div>
    <strong>{title}</strong>
    <span>{caption}</span>
  </div>;
}
function Stat({ icon: Icon, label, value, hint, tone }: {
  icon: LucideIcon; label: string; value: string; hint: string; tone: string
}) {
  return <div className="stat-card">
    <div className="stat-head"><span>{label}</span><div className={'stat-icon ' + tone}><Icon size={20} /></div></div>
    <strong className="stat-value">{value}</strong>
    <span className="stat-hint">{hint}</span>
  </div>;
}

function App() {
  const [data, setData] = useState<Snapshot>(empty);
  const [page, setPage] = useState<Page>('home');
  const [modal, setModal] = useState<FormType | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clinicDraft, setClinicDraft] = useState('مطب من');
  const [pendingUpdate, setPendingUpdate] = useState<AvailableUpdate | null>(null);
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);

  async function refresh() {
    const fresh = await snapshot();
    setData(fresh);
    setClinicDraft(fresh.clinicName);
  }
  useEffect(() => {
    refresh().catch(e => setError('خطا در باز کردن پایگاه داده: ' + String(e)))
      .finally(() => setReady(true));
    if (updatesEnabled) {
      findUpdate().then(setPendingUpdate).catch(() => {
        // Network errors never block local features.
      });
    }
  }, []);

  const names = useMemo(() => new Map(data.patients.map(p => [p.id, p.name])), [data.patients]);
  const serviceNames = useMemo(() => new Map(data.services.map(s => [s.id, s.title])), [data.services]);
  const pending = data.followups.filter(f => f.status === 'pending');
  const paymentsTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const recentVisits = data.visits.slice(0, 5);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const key = d.toLocaleDateString('en-CA');
    return {
      label: new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(d),
      value: data.visits.filter(v => new Date(v.date).toLocaleDateString('en-CA') === key).length
    };
  });
  const maxBar = Math.max(...week.map(item => item.value), 1);

  function navigate(next: Page) {
    setPage(next);
    setSearch('');
    setError('');
  }
  function openForm(next: FormType) {
    setForm(next === 'followup' ? { dueDate: todayIso() } : {});
    setError('');
    setModal(next);
  }
  const change = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));
  const required = (key: string) => (form[key] ?? '').trim();
  async function saveForm(event: React.FormEvent) {
    event.preventDefault();
    if (!modal || busy) return;
    setError('');
    setBusy(true);
    try {
      const amount = Number(required('amount'));
      if (modal === 'patient') {
        if (!required('name')) throw Error('نام مراجعه‌کننده الزامی است.');
        const patient: NewPatient = { name: required('name'), phone: required('phone'), note: required('note') };
        await addPatient(patient);
      } else if (modal === 'service') {
        const price = Number(required('price'));
        if (!required('title') || !required('price') || !Number.isSafeInteger(price) || price < 0) {
          throw Error('عنوان و مبلغ معتبر خدمت را وارد کنید.');
        }
        const service: NewService = { title: required('title'), price, description: required('description') };
        await addService(service);
      } else if (modal === 'visit') {
        if (!required('patientId') || !required('serviceId') || !required('amount') ||
          !Number.isSafeInteger(amount) || amount < 0) {
          throw Error('مراجعه‌کننده، خدمت و مبلغ معتبر را انتخاب کنید.');
        }
        const visit: NewVisit = { patientId: required('patientId'), serviceId: required('serviceId'), amount, note: required('note') };
        await addVisit(visit);
      } else if (modal === 'payment') {
        if (!required('patientId') || !required('amount') || !Number.isSafeInteger(amount) || amount <= 0) {
          throw Error('مراجعه‌کننده و مبلغ مثبت را وارد کنید.');
        }
        const payment: NewPayment = { patientId: required('patientId'), amount, method: required('method') || 'کارت‌خوان', note: required('note') };
        await addPayment(payment);
      } else if (modal === 'followup') {
        if (!required('patientId') || !required('title') || !required('dueDate')) {
          throw Error('مراجعه‌کننده، موضوع و تاریخ پیگیری الزامی‌اند.');
        }
        const followup: NewFollowup = { patientId: required('patientId'), title: required('title'), dueDate: required('dueDate') };
        await addFollowup(followup);
      }
      await refresh();
      setModal(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function markDone(id: string) {
    try { await completeFollowup(id); await refresh(); }
    catch (e) { setError('ثبت وضعیت انجام نشد: ' + String(e)); }
  }
  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!clinicDraft.trim()) { setError('نام مطب نمی‌تواند خالی باشد.'); return; }
    try {
      await setClinicName(clinicDraft.trim());
      await refresh();
      setError('');
    } catch (e) { setError('ذخیره تنظیمات انجام نشد: ' + String(e)); }
  }
  async function checkUpdates() {
    if (!updatesEnabled) return;
    setUpdateStatus('در حال بررسی نسخه جدید...');
    try {
      const update = await findUpdate();
      setPendingUpdate(update);
      setUpdateStatus(update ? 'نسخه جدید آماده است.' : 'شما آخرین نسخه را دارید.');
    } catch { setUpdateStatus('ارتباط با سرور بروزرسانی برقرار نشد.'); }
  }
  async function downloadUpdate() {
    if (!pendingUpdate) return;
    setBusy(true);
    try { await installUpdate(pendingUpdate, setUpdateProgress); }
    catch (e) { setUpdateStatus('بروزرسانی ناموفق بود: ' + String(e)); }
    finally { setBusy(false); }
  }

  const filtered = (value: string) => value.toLocaleLowerCase('fa-IR').includes(search.trim().toLocaleLowerCase('fa-IR'));
  const dateNow = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full' }).format(new Date());

  function homeContent() {
    return <>
      <div className="welcome">
        <div>
          <div className="welcome-overline"><HeartPulse size={17} /> مدیریت هوشمند مراکز خدماتی</div>
          <h2>به رساوین خوش آمدید <span>✳</span></h2>
          <p>تمام اطلاعات مطب، مراجعات و پیگیری‌ها در یک فضای منظم و ساده.</p>
          <button className="welcome-cta" onClick={() => openForm('visit')}>ثبت خدمت جدید <ArrowUpLeft size={17} /></button>
        </div>
        <div className="welcome-graphic" aria-hidden="true"><div className="graphic-ring"><HeartPulse size={66} strokeWidth={1.4} /></div></div>
      </div>
      <div className="stats">
        <Stat icon={UsersRound} label="کل مراجعین" value={number(data.patients.length)} hint="پرونده ثبت‌شده" tone="mint" />
        <Stat icon={ClipboardList} label="خدمات ثبت‌شده" value={number(data.visits.length)} hint="مجموع مراجعات" tone="purple" />
        <Stat icon={Wallet} label="کل دریافتی‌ها" value={currency(paymentsTotal)} hint="مجموع پرداخت‌های ثبت‌شده" tone="amber" />
        <Stat icon={BellRing} label="پیگیری‌های باز" value={number(pending.length)} hint="نیازمند رسیدگی" tone="blue" />
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-head"><div><h3>آمار خدمات هفته اخیر</h3><p>تعداد خدمات ثبت‌شده در هفت روز گذشته</p></div><Activity size={19} className="muted-icon" /></div>
          <div className="chart">
            {week.map((item, i) => <div className="chart-col" key={i}>
              <div className="chart-slot"><div className="chart-bar" style={{ height: (item.value ? Math.max(12, 100 * item.value / maxBar) : 3) + '%' }} title={number(item.value) + ' خدمت'} /></div>
              <span>{item.label}</span>
            </div>)}
          </div>
          <div className="chart-footer">جمع هفته: <strong>{number(week.reduce((sum, day) => sum + day.value, 0))} خدمت</strong></div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h3>پیگیری‌های نزدیک</h3><p>مراجعینی که نیاز به پیگیری دارند</p></div><button className="text-action" onClick={() => navigate('followups')}>مشاهده همه <ChevronLeft size={14} /></button></div>
          {pending.length ? <div className="mini-list">{pending.slice(0, 5).map(f => <div className="mini-item" key={f.id}>
            <div className="mini-avatar"><Clock3 size={17} /></div>
            <div className="mini-body"><strong>{names.get(f.patientId) ?? 'مراجعه‌کننده'}</strong><span>{f.title}</span></div>
            <small>{dateFa(f.dueDate)}</small>
          </div>)}</div> : <Empty icon={BellRing} title="پیگیری بازی وجود ندارد" caption="پیگیری‌های جدید اینجا نمایش داده می‌شوند." />}
        </section>
      </div>
      <section className="panel recent-panel">
        <div className="panel-head"><div><h3>آخرین خدمات ثبت‌شده</h3><p>آخرین مراجعات و خدمات ارائه‌شده</p></div><button className="text-action" onClick={() => openForm('visit')}>ثبت خدمت <Plus size={14} /></button></div>
        {recentVisits.length ? <div className="table-wrap"><table><thead><tr><th>مراجعه‌کننده</th><th>خدمت</th><th>تاریخ</th><th>مبلغ</th></tr></thead>
          <tbody>{recentVisits.map(v => <tr key={v.id}><td className="emphasis">{names.get(v.patientId) ?? '—'}</td><td>{serviceNames.get(v.serviceId) ?? '—'}</td><td>{dateFa(v.date)}</td><td>{currency(v.amount)}</td></tr>)}</tbody></table></div>
          : <Empty title="هنوز خدمتی ثبت نشده" caption="با دکمه + بالای صفحه اولین خدمت را ثبت کنید." />}
      </section>
    </>;
  }
  function listContent() {
    const info: Record<Exclude<Page, 'home' | 'settings'>, { caption: string; action: string; form: FormType }> = {
      patients: { caption: 'مدیریت پرونده‌ها و اطلاعات مراجعین', action: 'مراجعه‌کننده جدید', form: 'patient' },
      services: { caption: 'تعریف خدمات و تعرفه‌ها', action: 'تعریف خدمت', form: 'service' },
      payments: { caption: 'ثبت و مشاهده مبالغ دریافت‌شده', action: 'ثبت دریافتی', form: 'payment' },
      followups: { caption: 'یادآوری و پیگیری مراجعات', action: 'افزودن پیگیری', form: 'followup' }
    };
    if (page === 'home' || page === 'settings') return null;
    const item = info[page];
    return <section className="panel list-panel">
      <div className="list-top"><div><h3>{titles[page]}</h3><p>{item.caption}</p></div>
        <button className="primary-button" onClick={() => openForm(item.form)}><Plus size={18} /> {item.action}</button></div>
      <div className="search-input"><Search size={18} /><input aria-label="جست‌وجو" placeholder="جست‌وجو در فهرست..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      {page === 'patients' && (data.patients.filter(p => filtered(p.name + ' ' + p.phone)).length ?
        <div className="table-wrap"><table><thead><tr><th>نام مراجعه‌کننده</th><th>شماره تماس</th><th>تاریخ ثبت</th><th>یادداشت</th></tr></thead><tbody>
          {data.patients.filter(p => filtered(p.name + ' ' + p.phone)).map(p => <tr key={p.id}><td className="emphasis">{p.name}</td><td dir="ltr">{p.phone || '—'}</td><td>{dateFa(p.createdAt)}</td><td>{p.note || '—'}</td></tr>)}
        </tbody></table></div> : <Empty icon={UsersRound} title="مراجعه‌کننده‌ای پیدا نشد" caption="با دکمه افزودن، پرونده جدید ایجاد کنید." />)}
      {page === 'services' && (data.services.filter(s => filtered(s.title)).length ?
        <div className="table-wrap"><table><thead><tr><th>عنوان خدمت</th><th>تعرفه</th><th>توضیحات</th></tr></thead><tbody>
          {data.services.filter(s => filtered(s.title)).map(s => <tr key={s.id}><td className="emphasis">{s.title}</td><td>{currency(s.price)}</td><td>{s.description || '—'}</td></tr>)}
        </tbody></table></div> : <Empty title="خدمتی تعریف نشده" caption="خدمات مطب و تعرفه آن‌ها را ثبت کنید." />)}
      {page === 'payments' && (data.payments.filter(p => filtered((names.get(p.patientId) ?? '') + ' ' + p.method)).length ?
        <div className="table-wrap"><table><thead><tr><th>مراجعه‌کننده</th><th>مبلغ دریافتی</th><th>روش پرداخت</th><th>تاریخ</th></tr></thead><tbody>
          {data.payments.filter(p => filtered((names.get(p.patientId) ?? '') + ' ' + p.method)).map(p => <tr key={p.id}><td className="emphasis">{names.get(p.patientId) ?? '—'}</td><td>{currency(p.amount)}</td><td>{p.method}</td><td>{dateFa(p.date)}</td></tr>)}
        </tbody></table></div> : <Empty icon={Wallet} title="دریافتی‌ای پیدا نشد" caption="مبالغ دریافت‌شده را از همین قسمت ثبت کنید." />)}
      {page === 'followups' && (data.followups.filter(f => filtered((names.get(f.patientId) ?? '') + ' ' + f.title)).length ?
        <div className="table-wrap"><table><thead><tr><th>مراجعه‌کننده</th><th>موضوع</th><th>تاریخ پیگیری</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>
          {data.followups.filter(f => filtered((names.get(f.patientId) ?? '') + ' ' + f.title)).map(f => <tr key={f.id}>
            <td className="emphasis">{names.get(f.patientId) ?? '—'}</td><td>{f.title}</td><td>{dateFa(f.dueDate)}</td>
            <td><span className={'status ' + (f.status === 'done' ? 'done' : 'open')}>{f.status === 'done' ? 'انجام‌شده' : 'در انتظار'}</span></td>
            <td>{f.status === 'pending' ? <button className="row-action" onClick={() => markDone(f.id)}><Check size={15} /> انجام شد</button> : '—'}</td>
          </tr>)}</tbody></table></div> : <Empty icon={BellRing} title="پیگیری‌ای پیدا نشد" caption="پیگیری جدیدی برای مراجعین ایجاد کنید." />)}
    </section>;
  }
  function field(label: string, name: string, placeholder = '', type = 'text', requiredField = false) {
    return <label className="field" key={name}><span>{label}{requiredField && <b> *</b>}</span><input
      name={name} type={type} placeholder={placeholder} required={requiredField}
      value={form[name] ?? ''} min={type === 'number' ? '0' : undefined}
      onChange={e => change(name, e.target.value)} /></label>;
  }
  function patientSelect() {
    return <label className="field"><span>مراجعه‌کننده <b>*</b></span><select required value={form.patientId ?? ''} onChange={e => change('patientId', e.target.value)}>
      <option value="">انتخاب مراجعه‌کننده</option>
      {data.patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select></label>;
  }
  function formFields() {
    if (modal === 'patient') return <>
      {field('نام و نام خانوادگی', 'name', 'مثلاً ریحانه محمدی', 'text', true)}
      {field('شماره تماس', 'phone', '۰۹۱۲...', 'tel')}
      <label className="field"><span>یادداشت</span><textarea rows={3} value={form.note ?? ''} onChange={e => change('note', e.target.value)} placeholder="توضیحات اختیاری" /></label>
    </>;
    if (modal === 'service') return <>
      {field('عنوان خدمت', 'title', 'مثلاً مشاوره', 'text', true)}
      {field('تعرفه (تومان)', 'price', '0', 'number', true)}
      {field('توضیحات', 'description', 'توضیح اختیاری')}
    </>;
    if (modal === 'visit') return <>
      {patientSelect()}
      <label className="field"><span>خدمت <b>*</b></span><select required value={form.serviceId ?? ''} onChange={e => {
        const selected = data.services.find(s => s.id === e.target.value);
        setForm(current => ({ ...current, serviceId: e.target.value, amount: selected ? String(selected.price) : '' }));
      }}><option value="">انتخاب خدمت</option>{data.services.map(s => <option value={s.id} key={s.id}>{s.title}</option>)}</select></label>
      {field('مبلغ خدمت (تومان)', 'amount', '0', 'number', true)}
      {field('یادداشت', 'note', 'توضیحات اختیاری')}
    </>;
    if (modal === 'payment') return <>
      {patientSelect()}
      {field('مبلغ دریافتی (تومان)', 'amount', '0', 'number', true)}
      <label className="field"><span>روش پرداخت</span><select value={form.method ?? 'کارت‌خوان'} onChange={e => change('method', e.target.value)}>
        <option>کارت‌خوان</option><option>نقدی</option><option>انتقال بانکی</option>
      </select></label>
      {field('توضیحات', 'note')}
    </>;
    if (modal === 'followup') return <>
      {patientSelect()}
      {field('موضوع پیگیری', 'title', 'مثلاً تماس برای مراجعه بعدی', 'text', true)}
      {field('تاریخ پیگیری', 'dueDate', '', 'date', true)}
    </>;
    return null;
  }

  return <div className="app-shell" dir="rtl">
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo"><HeartPulse size={27} /></div>
        <div><h1>رساوین</h1><span>مدیریت هوشمند مطب</span></div>
      </div>
      <div className="sidebar-caption">منوی اصلی</div>
      <nav aria-label="منوی اصلی">{menu.map(item => <button
        key={item.id} className={'nav-item ' + (page === item.id ? 'active' : '')}
        onClick={() => navigate(item.id)}><item.icon size={20} /><span>{item.title}</span>
        {item.id === 'followups' && pending.length > 0 && <small>{number(pending.length)}</small>}
      </button>)}</nav>
      <div className="sidebar-bottom">
        <div className="local-card"><ShieldCheck size={20}/><div><strong>اطلاعات محلی</strong><span>بدون نیاز به اشتراک</span></div></div>
        <button className={'nav-item ' + (page === 'settings' ? 'active' : '')} onClick={() => navigate('settings')}><Settings2 size={20}/> تنظیمات</button>
        <div className="app-version"><span>Rasavin 0.1.0</span><span>نسخه آزمایشی</span></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="top-titles"><span className="breadcrumb">رساوین <ChevronLeft size={14}/> {titles[page]}</span><h2>{titles[page]}</h2><p>{data.clinicName} <span className="small-dot">•</span> {dateNow}</p></div>
        <div className="top-actions">
          <span className="connection-indicator"><CloudOff size={16}/>{desktopMode ? 'حالت آفلاین' : 'پیش‌نمایش مرورگر'}</span>
          <button aria-label="ثبت خدمات جدید" title="ثبت خدمات جدید" className="add-circle" onClick={() => openForm('visit')}><Plus size={31}/></button>
          <span className="add-label">ثبت خدمات</span>
        </div>
      </header>

      {!desktopMode && <div className="preview-notice"><CircleHelp size={17}/> این حالت پیش‌نمایش است؛ اطلاعات فقط تا زمان نوسازی صفحه در حافظه می‌مانند. برای ذخیره دائمی، نسخه ویندوز را اجرا کنید.</div>}
      {error && !modal && <div role="alert" className="error-notice"><span>{error}</span><button onClick={() => setError('')} aria-label="بستن پیام"><X size={16}/></button></div>}
      {!ready ? <div className="loading"><RefreshCw size={22} className="spin"/> در حال بارگذاری...</div> :
        <div className="content-inner">
          {page === 'home' ? homeContent() : page === 'settings' ?
          <div className="settings-grid">
            <section className="panel settings-card"><div className="panel-head"><div><h3>مشخصات مرکز</h3><p>این اطلاعات روی داشبورد نمایش داده می‌شوند</p></div><PencilLine size={18}/></div>
              <form onSubmit={saveSettings} className="settings-form"><label className="field"><span>نام مطب یا مرکز</span><input value={clinicDraft} onChange={e => setClinicDraft(e.target.value)} required /></label>
                <button className="primary-button" type="submit"><Check size={17}/> ذخیره تغییرات</button></form>
            </section>
            <section className="panel settings-card"><div className="panel-head"><div><h3>بروزرسانی نرم‌افزار</h3><p>اصلاحات امنیتی و رفع باگ همیشه رایگان هستند</p></div><RefreshCw size={18}/></div>
              <p className="settings-hint">{updatesEnabled ? 'دریافت بروزرسانی‌های امضاشده از سرور رسمی' : 'سامانه آپدیت پس از تنظیم کلید امضا و سرور انتشار فعال می‌شود.'}</p>
              <button className="secondary-button" disabled={!updatesEnabled} onClick={checkUpdates}><RefreshCw size={17}/> بررسی بروزرسانی</button>
              {updateStatus && <p className="settings-hint" role="status">{updateStatus}</p>}
            </section>
            <section className="panel settings-card"><div className="panel-head"><div><h3>خدمات آینده</h3><p>بدون تأثیر روی امکانات پایه</p></div><Sparkles size={18}/></div>
              <div className="future-tags"><span>فضای ابری</span><span>پیامک</span><span>هوش مصنوعی</span><span>پلن حرفه‌ای</span></div>
            </section>
          </div> : listContent()}
        </div>
      }
    </main>

    {modal && <div className="modal-layer" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) { setModal(null); setError(''); } }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="form-heading">
        <div className="modal-header"><div className="modal-icon">{modal === 'visit' ? <Stethoscope size={24}/> : modal === 'patient' ? <UsersRound size={24}/> : modal === 'service' ? <ClipboardList size={24}/> : modal === 'payment' ? <Wallet size={24}/> : <BellRing size={24}/>}</div>
          <div><h3 id="form-heading">{formTitles[modal]}</h3><p>اطلاعات لازم را وارد کنید.</p></div>
          <button className="close-modal" type="button" disabled={busy} onClick={() => { setModal(null); setError(''); }} aria-label="بستن"><X size={21}/></button>
        </div>
        {modal === 'visit' && (!data.patients.length || !data.services.length) && <div className="form-hint"><UserRoundCheck size={17}/> ابتدا حداقل یک مراجعه‌کننده و یک خدمت تعریف کنید.</div>}
        {(modal === 'payment' || modal === 'followup') && !data.patients.length && <div className="form-hint">ابتدا یک مراجعه‌کننده ثبت کنید.</div>}
        <form className="modal-form" onSubmit={saveForm}>
          {formFields()}
          {error && <div className="modal-error" role="alert">{error}</div>}
          <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => { setModal(null); setError(''); }}>انصراف</button>
            <button className="primary-button" type="submit" disabled={busy}><Check size={18}/>{busy ? 'در حال ثبت...' : 'ثبت و ذخیره'}</button></div>
        </form>
      </div>
    </div>}

    {pendingUpdate && <div className="update-toast" role="status"><Download size={20}/><div><strong>نسخه {pendingUpdate.version} رساوین آماده است</strong><span>{updateProgress === null ? 'بروزرسانی امضاشده' : number(updateProgress) + '٪ دریافت شده'}</span></div>
      <button className="primary-button" disabled={busy} onClick={downloadUpdate}>{busy ? 'در حال نصب...' : 'دانلود و نصب'}</button>
      <button className="icon-button" aria-label="بعداً" onClick={() => setPendingUpdate(null)} disabled={busy}><X size={17}/></button>
    </div>}
    <div className="footer-mobile"><Monitor size={14}/> رساوین — مدیریت ساده و امن</div>
  </div>;
}

export default App;
