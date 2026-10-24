import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  Archive, ArrowDownCircle, ArrowUpCircle, Bell, BookOpen, CalendarDays, CheckSquare,
  ChevronDown, CircleCheck, CircleUserRound, Clock3, Columns3, Download, Edit3, ExternalLink, Gauge, LayoutDashboard,
  List, LogOut, Menu, Package, Pin, Plus, Search, ShieldAlert, Sparkles, Trash2, X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api, { apiError } from './services/api';

const navItems = [
  { name: 'Dashboard', to: '/', icon: Gauge },
  { name: 'Study Assistant', to: '/study', icon: Sparkles },
  { name: 'Tasks', to: '/tasks', icon: CheckSquare },
  { name: 'Knowledge Base', to: '/knowledge', icon: BookOpen },
  { name: 'Inventory', to: '/inventory', icon: Package, inventory: true },
];
const chartColors = ['#4f46e5', '#0ea5e9', '#10b981'];
const emptyTask = { title: '', description: '', category: '', priority: 'medium', status: 'todo', dueDate: '', tags: '' };
const emptyNote = { title: '', content: '', category: '', tags: '', sourceUrl: '' };
const emptyProduct = { name: '', sku: '', category: '', categoryId: '', description: '', quantity: 0, minStock: 0, costPrice: 0, salePrice: 0, supplier: '', supplierId: '' };
const inventoryId = (value) => /^\d+$/.test(String(value)) ? Number(value) : value;

function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-soft ${className}`}>{children}</section>;
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Notice({ message, kind = 'error', onClose }) {
  if (!message) return null;
  const style = kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800';
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${style}`} role="status">
      <span>{message}</span>
      {onClose && <button aria-label="Dismiss message" onClick={onClose}><X className="h-4 w-4" /></button>}
    </div>
  );
}

function AuthPage({ onAuthenticated }) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('student@unisphere.ai');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const endpoint = register ? '/auth/register' : '/auth/login';
      const payload = register ? { name, email, password } : { email, password };
      const { data } = await api.post(endpoint, payload);
      onAuthenticated(data.user);
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1fr_1fr]">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-600 p-12 text-white lg:flex">
        <div className="flex items-center gap-3 text-xl font-bold"><div className="rounded-xl bg-white/15 p-2"><LayoutDashboard /></div>UniSphere AI</div>
        <div className="max-w-xl">
          <Sparkles className="mb-5 h-10 w-10 text-indigo-100" />
          <h1 className="text-4xl font-bold leading-tight">Study smarter. Organize knowledge. Manage resources.</h1>
          <p className="mt-5 text-indigo-100">One calm workspace for study plans, useful notes, and the resources you manage.</p>
        </div>
        <p className="text-sm text-indigo-100">A connected workspace for focused progress.</p>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3 text-xl font-bold text-slate-900"><div className="rounded-xl bg-indigo-600 p-2 text-white"><LayoutDashboard /></div>UniSphere AI</div>
          </div>
          <Card className="p-7 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">{register ? 'Create your account' : 'Welcome back'}</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{register ? 'Join your workspace' : 'Sign in to UniSphere'}</h2>
            <p className="mt-2 text-sm text-slate-500">{register ? 'Create a student account to get started.' : 'Use your account or one of the demo accounts.'}</p>
            <Notice message={error} onClose={() => setError('')} />
            <form className="mt-6 space-y-4" onSubmit={submit}>
              {register && <label className="field-label">Full name<input required minLength="2" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="field-input" /></label>}
              <label className="field-label">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field-input" /></label>
              <label className="field-label">Password<input required minLength="8" type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="field-input" /></label>
              <button disabled={busy} className="primary-button w-full">{busy ? 'Please wait...' : register ? 'Create account' : 'Sign in'}</button>
            </form>
            {!register && (
              <div className="mt-5 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Demo accounts</p>
                <button className="text-left hover:text-indigo-700" onClick={() => { setEmail('student@unisphere.ai'); setPassword('Password123!'); }}>Student: student@unisphere.ai</button>
                <button className="text-left hover:text-indigo-700" onClick={() => { setEmail('admin@unisphere.ai'); setPassword('Password123!'); }}>Admin: admin@unisphere.ai (inventory access)</button>
              </div>
            )}
            <p className="mt-6 text-center text-sm text-slate-500">
              {register ? 'Already registered?' : "Don't have an account?"}{' '}
              <button className="font-semibold text-indigo-600 hover:text-indigo-800" onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Sign in' : 'Create account'}</button>
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}

function DashboardPage({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboard');
      setData(response.data.dashboard);
      setError('');
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <div className="skeleton h-64" />;
  if (error) return <Notice message={error} />;
  const metrics = [
    ['Total tasks', data.totalTasks, '/tasks'],
    ['Completed', data.completedTasks, '/tasks'],
    ['Upcoming deadlines', data.upcomingDeadlines, '/tasks'],
    ['Study time this week', `${Math.floor(data.studyMinutesWeek / 60)}h ${data.studyMinutesWeek % 60}m`, '/study'],
    ['Saved resources', data.savedResources, '/knowledge'],
  ];
  if (data.inventory) {
    metrics.push(['Inventory products', data.inventory.totalProducts, '/inventory']);
    metrics.push(['Low-stock alerts', data.inventory.lowStock + data.inventory.outOfStock, '/inventory']);
  }
  const chartData = data.taskCompletionByDay || [];
  const sessionData = data.studySessions.reduce((accumulator, session) => {
    const current = accumulator.find((item) => item.day === session.day);
    if (current) current.minutes += session.minutes;
    else accumulator.push({ day: session.day, minutes: session.minutes });
    return accumulator;
  }, []);
  return (
    <div>
      <PageHeading eyebrow="Your workspace" title={`Good to see you, ${user.name.split(' ')[0]}`} description="A live overview of your tasks, learning time, saved resources, and inventory access." action={<button onClick={load} className="secondary-button"><CircleCheck className="h-4 w-4" /> Refresh</button>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, to]) => <Link key={label} to={to} className="metric-card"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value}</p></Link>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Tasks completed this week</h2><span className="text-xs text-slate-500">{data.completionPercent}% overall</span></div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="completed" fill="#4f46e5" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold text-slate-900">Tasks by status</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={data.taskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label>{data.taskDistribution.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold text-slate-900">Study time by session</h2>
          {sessionData.length ? <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={sessionData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" /><YAxis /><Tooltip /><Bar dataKey="minutes" fill="#0ea5e9" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState icon={Clock3} title="No study sessions this week" text="Record a session from the Study Assistant to see your weekly study time." />}
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold text-slate-900">Things to follow up</h2>
          <div className="space-y-3">
            <Link to="/tasks" className="alert-row"><Clock3 className="h-4 w-4 text-amber-600" /><span>{data.overdueTasks} overdue tasks</span><ChevronDown className="ml-auto h-4 w-4 -rotate-90" /></Link>
            {data.inventory && <Link to="/inventory" className="alert-row"><ShieldAlert className="h-4 w-4 text-rose-600" /><span>{data.inventory.lowStock} low-stock and {data.inventory.outOfStock} out-of-stock items</span><ChevronDown className="ml-auto h-4 w-4 -rotate-90" /></Link>}
            <Link to="/study" className="alert-row"><Sparkles className="h-4 w-4 text-indigo-600" /><span>Ask a question about your study materials</span><ChevronDown className="ml-auto h-4 w-4 -rotate-90" /></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center"><Icon className="mb-2 h-6 w-6 text-slate-400" /><p className="font-medium text-slate-700">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>;
}

function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(emptyTask);
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sessionForm, setSessionForm] = useState({ subject: '', durationMinutes: 25 });

  const load = useCallback(async () => {
    try {
      const response = await api.get('/tasks', { params: { search, status: status || undefined } });
      setTasks(response.data.tasks);
      setError('');
    } catch (requestError) { setError(apiError(requestError)); }
  }, [search, status]);
  useEffect(() => { load(); }, [load]);

  function beginEdit(task) {
    setEditing(task.id);
    setForm({ ...task, dueDate: task.due_date ? String(task.due_date).slice(0, 10) : '', tags: (task.tags || []).join(', ') });
    setShowForm(true);
  }

  async function saveTask(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const payload = { ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), dueDate: form.dueDate || null };
    try {
      if (editing) await api.patch(`/tasks/${editing}`, payload);
      else await api.post('/tasks', payload);
      setForm(emptyTask); setEditing(null); setShowForm(false); await load();
    } catch (requestError) { setError(apiError(requestError)); }
    finally { setBusy(false); }
  }

  async function removeTask(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try { await api.delete(`/tasks/${task.id}`); await load(); }
    catch (requestError) { setError(apiError(requestError)); }
  }

  async function changeStatus(task, nextStatus) {
    try { await api.patch(`/tasks/${task.id}`, { status: nextStatus }); await load(); }
    catch (requestError) { setError(apiError(requestError)); }
  }

  async function logSession(event) {
    event.preventDefault();
    try {
      await api.post('/study/sessions', { subject: sessionForm.subject, durationMinutes: Number(sessionForm.durationMinutes) });
      setSessionForm({ subject: '', durationMinutes: 25 });
      setError('');
      window.alert('Study session recorded.');
    } catch (requestError) { setError(apiError(requestError)); }
  }
  const grouped = useMemo(() => ({
    todo: tasks.filter((task) => task.status === 'todo'),
    in_progress: tasks.filter((task) => task.status === 'in_progress'),
    completed: tasks.filter((task) => task.status === 'completed'),
  }), [tasks]);

  const taskCard = (task) => (
    <article key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className={`font-semibold ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</h3><p className="mt-1 text-sm text-slate-500">{task.description || 'No description'}</p></div><span className={`status-pill priority-${task.priority}`}>{task.priority}</span></div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">{task.category && <span className="tag">{task.category}</span>}{task.due_date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(task.due_date).toLocaleDateString()}</span>}{(task.tags || []).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select aria-label={`Status for ${task.title}`} className="select-small" value={task.status} onChange={(event) => changeStatus(task, event.target.value)}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select>
        <button className="icon-button" title="Edit task" onClick={() => beginEdit(task)}><Edit3 className="h-4 w-4" /></button>
        <button className="icon-button text-rose-600" title="Delete task" onClick={() => removeTask(task)}><Trash2 className="h-4 w-4" /></button>
      </div>
    </article>
  );

  return (
    <div>
      <PageHeading eyebrow="Plan your week" title="Task Manager" description="Create, prioritize, search, and track your tasks alongside focused study sessions." action={<button className="primary-button" onClick={() => { setEditing(null); setForm(emptyTask); setShowForm(true); }}><Plus className="h-4 w-4" />New task</button>} />
      <Notice message={error} onClose={() => setError('')} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="search-box"><Search className="h-4 w-4" /><input placeholder="Search tasks..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <select className="field-input" aria-label="Filter tasks by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[['list', List, 'List'], ['kanban', Columns3, 'Kanban'], ['calendar', CalendarDays, 'Calendar']].map(([key, Icon, label]) => <button key={key} onClick={() => setView(key)} className={`view-button ${view === key ? 'view-button-active' : ''}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
      {showForm && <Card className="mb-5"><form onSubmit={saveTask} className="grid gap-3 md:grid-cols-2"><div className="md:col-span-2"><h2 className="mb-3 font-semibold">{editing ? 'Edit task' : 'Create task'}</h2></div><label className="field-label">Title<input required maxLength="200" className="field-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field-label">Subject/category<input className="field-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label><label className="field-label">Due date<input type="date" className="field-input" value={form.dueDate || ''} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label><label className="field-label">Priority<select className="field-input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="field-label md:col-span-2">Description<textarea rows="2" className="field-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="field-label md:col-span-2">Tags (comma separated)<input className="field-input" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label><div className="flex gap-2 md:col-span-2"><button className="primary-button" disabled={busy}>{busy ? 'Saving...' : 'Save task'}</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button></div></form></Card>}
      {view === 'list' && <div className="space-y-3">{tasks.map(taskCard)}{!tasks.length && <EmptyState icon={CheckSquare} title="No tasks found" text="Add a task or change the search filters." />}</div>}
      {view === 'kanban' && <div className="grid gap-4 lg:grid-cols-3">{[['todo', 'To do'], ['in_progress', 'In progress'], ['completed', 'Completed']].map(([key, label]) => <Card key={key}><h2 className="mb-3 font-semibold">{label} <span className="text-xs text-slate-400">({grouped[key].length})</span></h2><div className="space-y-3">{grouped[key].map(taskCard)}</div></Card>)}</div>}
      {view === 'calendar' && <Card><div className="space-y-2">{tasks.filter((task) => task.due_date).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map((task) => <div key={task.id} className="flex items-center gap-3 border-b border-slate-100 py-3"><span className="w-24 text-sm font-medium text-indigo-600">{new Date(task.due_date).toLocaleDateString()}</span><span className="flex-1 font-medium">{task.title}</span><span className="tag">{task.status.replace('_', ' ')}</span></div>)}{!tasks.some((task) => task.due_date) && <EmptyState icon={CalendarDays} title="No dated tasks" text="Set due dates to view your schedule." />}</div></Card>}
      <Card className="mt-5"><h2 className="mb-3 font-semibold text-slate-900">Log a study session</h2><form onSubmit={logSession} className="grid gap-3 sm:grid-cols-[1fr_160px_auto]"><label className="field-label">Subject<input className="field-input" required value={sessionForm.subject} onChange={(event) => setSessionForm({ ...sessionForm, subject: event.target.value })} /></label><label className="field-label">Minutes<input type="number" min="1" max="1440" className="field-input" value={sessionForm.durationMinutes} onChange={(event) => setSessionForm({ ...sessionForm, durationMinutes: event.target.value })} /></label><button className="primary-button self-end"><Clock3 className="h-4 w-4" />Record</button></form></Card>
    </div>
  );
}

function KnowledgePage() {
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState(emptyNote);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/knowledge/notes', { params: { search, archived: includeArchived } });
      setNotes(data.notes);
    } catch (requestError) { setError(apiError(requestError)); }
  }, [search, includeArchived]);
  useEffect(() => { load(); }, [load]);
  function editNote(note) {
    setEditing(note.$id || note.id);
    setForm({ title: note.title, content: note.content, category: note.category || '', tags: (note.tags || []).join(', '), sourceUrl: note.sourceUrl || note.source_url || '' });
    setShowForm(true); setPreview(false);
  }
  async function saveNote(event) {
    event.preventDefault();
    const payload = { ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), sourceUrl: form.sourceUrl || null };
    try {
      if (editing) await api.patch(`/knowledge/notes/${editing}`, payload);
      else await api.post('/knowledge/notes', payload);
      setForm(emptyNote); setEditing(null); setShowForm(false); await load();
    } catch (requestError) { setError(apiError(requestError)); }
  }
  async function toggleNote(note, change) {
    try { await api.patch(`/knowledge/notes/${note.$id || note.id}`, change); await load(); }
    catch (requestError) { setError(apiError(requestError)); }
  }
  async function remove(note) {
    if (!window.confirm(`Delete "${note.title}"?`)) return;
    try { await api.delete(`/knowledge/notes/${note.$id || note.id}`); await load(); }
    catch (requestError) { setError(apiError(requestError)); }
  }
  return (
    <div>
      <PageHeading eyebrow="Keep what matters" title="Knowledge Base" description="Write Markdown notes, save documentation links, pin important resources, and archive old material." action={<button className="primary-button" onClick={() => { setEditing(null); setForm(emptyNote); setShowForm(true); }}><Plus className="h-4 w-4" />New note</button>} />
      <Notice message={error} onClose={() => setError('')} />
      <div className="mb-4 flex flex-wrap gap-3"><div className="search-box flex-1"><Search className="h-4 w-4" /><input placeholder="Search notes and resources..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />Show archived</label></div>
      {showForm && <Card className="mb-5"><form onSubmit={saveNote} className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">{editing ? 'Edit note' : 'Create note'}</h2><button type="button" className="view-button" onClick={() => setPreview(!preview)}>{preview ? 'Edit Markdown' : 'Preview'}</button></div>{preview ? <div className="markdown-preview prose prose-sm max-w-none">{form.content ? <ReactMarkdown>{form.content}</ReactMarkdown> : 'Nothing to preview yet.'}</div> : <><label className="field-label">Title<input required maxLength="200" className="field-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field-label">Content<textarea required rows="8" className="field-input font-mono text-sm" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label></>}<div className="grid gap-3 sm:grid-cols-2"><label className="field-label">Category<input className="field-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label><label className="field-label">Tags (comma separated)<input className="field-input" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label></div><label className="field-label">Resource URL (optional)<input type="url" className="field-input" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} /></label><div className="flex gap-2"><button className="primary-button">Save note</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button></div></form></Card>}
      {notes.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{notes.map((note) => <Card key={note.$id || note.id}><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{note.title}</h2><p className="mt-1 text-xs text-slate-500">{note.category || 'Uncategorized'}{note.createdAt || note.created_at ? ` · ${new Date(note.createdAt || note.created_at).toLocaleDateString()}` : ''}</p></div><button className={`icon-button ${note.pinned ? 'text-indigo-600' : ''}`} title={note.pinned ? 'Unpin note' : 'Pin note'} onClick={() => toggleNote(note, { pinned: !note.pinned })}><Pin className="h-4 w-4" /></button></div><p className="markdown-preview mt-3 line-clamp-5 whitespace-pre-wrap">{note.content}</p><div className="mt-3 flex flex-wrap gap-1">{(note.tags || []).map((tag) => <span key={tag} className="tag">{tag}</span>)}</div>{(note.sourceUrl || note.source_url) && <a className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline" href={note.sourceUrl || note.source_url} target="_blank" rel="noreferrer">Open resource <ExternalLink className="h-3 w-3" /></a>}<div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3"><button className="secondary-button !px-2.5 !py-1.5" onClick={() => editNote(note)}><Edit3 className="h-3.5 w-3.5" />Edit</button><button className="secondary-button !px-2.5 !py-1.5" onClick={() => toggleNote(note, { archived: !note.archived })}><Archive className="h-3.5 w-3.5" />{note.archived ? 'Restore' : 'Archive'}</button><button className="icon-button ml-auto text-rose-600" title="Delete note" onClick={() => remove(note)}><Trash2 className="h-4 w-4" /></button></div></Card>)}</div> : <EmptyState icon={BookOpen} title="Your knowledge base is empty" text="Create a note or save a documentation resource to get started." />}
    </div>
  );
}

function StudyPage() {
  const [materials, setMaterials] = useState([]);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [materialTags, setMaterialTags] = useState('');
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [savedAnswers, setSavedAnswers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState('');
  const [session, setSession] = useState({ subject: '', durationMinutes: 25 });
  const [goals, setGoals] = useState({ dailyMinutes: 30, weeklyMinutes: 300, todayMinutes: 0, weekMinutes: 0 });
  const [goalForm, setGoalForm] = useState({ dailyMinutes: 30, weeklyMinutes: 300 });
  const load = useCallback(async () => {
    try {
      const [materialsResponse, historyResponse, answersResponse, goalsResponse] = await Promise.all([
        api.get('/study/materials'), api.get('/study/history'), api.get('/study/answers'), api.get('/study/goals'),
      ]);
      setMaterials(materialsResponse.data.materials);
      setHistory(historyResponse.data.queries);
      setSavedAnswers(answersResponse.data.answers);
      setGoals(goalsResponse.data.goals);
      setGoalForm({
        dailyMinutes: goalsResponse.data.goals.dailyMinutes,
        weeklyMinutes: goalsResponse.data.goals.weeklyMinutes,
      });
    } catch (requestError) { setError(apiError(requestError)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function addMaterial(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('subject', subject);
        formData.append('tags', JSON.stringify(materialTags.split(',').map((tag) => tag.trim()).filter(Boolean)));
        await api.post('/study/materials/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/study/materials', { title, subject, content, tags: materialTags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      }
      setTitle(''); setSubject(''); setContent(''); setMaterialTags(''); setFile(null); await load();
    } catch (requestError) { setError(apiError(requestError)); }
    finally { setBusy(false); }
  }
  async function ask(event) {
    event.preventDefault(); setBusy(true); setError(''); setAnswer(null);
    try {
      const { data } = await api.post('/study/ask', { question });
      setAnswer(data);
      await load();
    } catch (requestError) { setError(apiError(requestError)); }
    finally { setBusy(false); }
  }
  async function semanticSearch(event) {
    event.preventDefault(); setBusy(true);
    try {
      const { data } = await api.post('/study/search', { query: searchQuery });
      setSearchResults(data.results);
    } catch (requestError) { setError(apiError(requestError)); }
    finally { setBusy(false); }
  }
  async function generate(action, materialId) {
    setGeneration(action); setError('');
    try {
      const { data } = await api.post('/study/generate', { action, materialId });
      setAnswer({ answer: data.result, sources: data.sources, grounded: true });
    } catch (requestError) { setError(apiError(requestError)); }
    finally { setGeneration(''); }
  }
  async function saveAnswer() {
    try {
      await api.post('/study/answers', { question, answer: answer.answer, sources: answer.sources || [] });
      await load();
    } catch (requestError) { setError(apiError(requestError)); }
  }
  async function recordSession(event) {
    event.preventDefault();
    try {
      await api.post('/study/sessions', { subject: session.subject, durationMinutes: Number(session.durationMinutes) });
      setSession({ subject: '', durationMinutes: 25 });
      await load();
    } catch (requestError) { setError(apiError(requestError)); }
  }
  async function saveGoals(event) {
    event.preventDefault();
    try {
      await api.put('/study/goals', {
        dailyMinutes: Number(goalForm.dailyMinutes),
        weeklyMinutes: Number(goalForm.weeklyMinutes),
      });
      await load();
    } catch (requestError) { setError(apiError(requestError)); }
  }
  return (
    <div>
      <PageHeading eyebrow="Learn with your own sources" title="AI Study Assistant" description="Save study material, find relevant excerpts, and ask questions grounded in the content you provide." />
      <Notice message={error} onClose={() => setError('')} />
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Study goals</h2>
          <form onSubmit={saveGoals} className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">Daily goal (minutes)<input required type="number" min="1" max="1440" className="field-input" value={goalForm.dailyMinutes} onChange={(event) => setGoalForm({ ...goalForm, dailyMinutes: event.target.value })} /></label>
            <label className="field-label">Weekly goal (minutes)<input required type="number" min="1" max="10080" className="field-input" value={goalForm.weeklyMinutes} onChange={(event) => setGoalForm({ ...goalForm, weeklyMinutes: event.target.value })} /></label>
            <button className="secondary-button sm:col-span-2">Save goals</button>
          </form>
          <div className="mt-4 space-y-3">
            {[['Today', goals.todayMinutes, goals.dailyMinutes], ['Last 7 days', goals.weekMinutes, goals.weeklyMinutes]].map(([label, actual, target]) => <div key={label}><div className="mb-1 flex justify-between text-xs text-slate-600"><span>{label}</span><span>{actual} / {target} min</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(100, Math.round(actual / target * 100))}%` }} /></div></div>)}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Add study material</h2>
          <form onSubmit={addMaterial} className="space-y-3"><label className="field-label">Title<input required className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field-label">Subject<input className="field-input" value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label className="field-label">Tags (comma separated)<input className="field-input" value={materialTags} onChange={(event) => setMaterialTags(event.target.value)} /></label><label className="field-label">Text content<textarea required={!file} minLength={file ? undefined : 20} rows="6" className="field-input" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste your notes or documentation here..." /></label><label className="field-label">Or upload a text/Markdown file<input type="file" accept=".txt,.md,text/plain,text/markdown" className="field-input" onChange={(event) => setFile(event.target.files?.[0] || null)} /><span className="text-xs font-normal text-slate-500">Maximum 1 MiB. Only .txt and .md files are accepted.</span></label><p className="text-xs text-slate-500">Configure Appwrite and the AI provider for cloud document/vector storage and generated answers.</p><button disabled={busy} className="primary-button"><Plus className="h-4 w-4" />{busy ? 'Saving...' : 'Save material'}</button></form>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Ask your materials</h2>
          <form onSubmit={ask} className="space-y-3"><label className="field-label">Question<textarea required minLength="5" rows="3" className="field-input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What does my material say about..." /></label><button disabled={busy} className="primary-button"><Sparkles className="h-4 w-4" />{busy ? 'Working...' : 'Ask with sources'}</button></form>
          {answer && <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">{answer.grounded ? 'Grounded response' : 'Not enough source content'}</p>{answer.grounded && <button className="text-xs font-semibold text-indigo-700 underline" onClick={saveAnswer}>Save answer</button>}</div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{answer.answer}</p>{answer.sources?.length > 0 && <div className="mt-3 space-y-2">{answer.sources.map((source, index) => <div key={`${source.title}-${index}`} className="rounded-lg bg-white p-3 text-xs text-slate-600"><strong className="text-slate-800">[{index + 1}] {source.title}</strong><p className="mt-1">{source.content}</p></div>)}</div>}</div>}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Search across study materials</h2>
          <form onSubmit={semanticSearch} className="flex gap-2"><input required minLength="2" className="field-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search your study sources..." /><button className="primary-button"><Search className="h-4 w-4" />Search</button></form>
          {searchResults.map((result, index) => <div key={`${result.title}-${index}`} className="mt-3 rounded-xl bg-slate-50 p-3"><p className="font-medium text-slate-800">{result.title} {result.subject && <span className="tag ml-1">{result.subject}</span>}</p><p className="mt-1 text-sm text-slate-600">{result.content}</p></div>)}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Record a study session</h2>
          <form onSubmit={recordSession} className="grid gap-3 sm:grid-cols-[1fr_140px_auto]"><label className="field-label">Subject<input required className="field-input" value={session.subject} onChange={(event) => setSession({ ...session, subject: event.target.value })} /></label><label className="field-label">Minutes<input type="number" min="1" max="1440" required className="field-input" value={session.durationMinutes} onChange={(event) => setSession({ ...session, durationMinutes: event.target.value })} /></label><button className="primary-button self-end"><Clock3 className="h-4 w-4" />Log time</button></form>
        </Card>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Your materials ({materials.length})</h2></div>{materials.length ? <div className="space-y-3">{materials.map((material) => <div key={material.$id || material.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-medium">{material.title}</p><p className="text-xs text-slate-500">{material.subject || material.category || 'General'} · {String(material.content || '').length} characters</p></div><button disabled={Boolean(generation)} className="secondary-button" onClick={() => generate('summary', material.$id || material.id)}>Summarize</button><button disabled={Boolean(generation)} className="secondary-button" onClick={() => generate('practice', material.$id || material.id)}>Practice questions</button></div>)}</div> : <EmptyState icon={BookOpen} title="No study materials yet" text="Add notes or source text to enable retrieval." />}{generation && <p className="mt-3 text-sm text-indigo-600">Generating {generation}...</p>}</Card>
        <Card><h2 className="mb-3 font-semibold text-slate-900">Recent queries and saved answers</h2>{history.length || savedAnswers.length ? <div className="space-y-3">{history.slice(0, 5).map((item, index) => <div key={`q-${index}`} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Recent question</p><p className="font-medium">{item.question}</p></div>)}{savedAnswers.slice(0, 4).map((item) => <div key={item.id} className="rounded-lg border border-indigo-100 p-3"><p className="text-xs text-indigo-600">Saved answer</p><p className="font-medium">{item.question}</p><p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.answer}</p></div>)}</div> : <EmptyState icon={Sparkles} title="No activity yet" text="Ask a question or save a useful response." />}</Card>
      </div>
    </div>
  );
}

function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [movements, setMovements] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [movement, setMovement] = useState(null);
  const [movementForm, setMovementForm] = useState({ type: 'in', quantity: 1, note: '' });
  const [supplierForm, setSupplierForm] = useState({ name: '', email: '', phone: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [showSupplier, setShowSupplier] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const load = useCallback(async () => {
    try {
      const [productResponse, analyticsResponse, movementResponse, supplierResponse, categoryResponse] = await Promise.all([
        api.get('/inventory/products', { params: { search } }), api.get('/inventory/analytics'),
        api.get('/inventory/movements'), api.get('/inventory/suppliers'), api.get('/inventory/categories'),
      ]);
      setProducts(productResponse.data.products); setAnalytics(analyticsResponse.data.analytics);
      setMovements(movementResponse.data.movements); setSuppliers(supplierResponse.data.suppliers);
      setCategories(categoryResponse.data.categories);
      setError('');
    } catch (requestError) { setError(apiError(requestError)); }
  }, [search]);
  useEffect(() => { load(); }, [load]);
  async function saveProduct(event) {
    event.preventDefault();
    const selectedSupplier = suppliers.find((supplier) => String(supplier.id) === String(form.supplierId));
    const payload = {
      ...form,
      quantity: Number(form.quantity),
      minStock: Number(form.minStock),
      costPrice: Number(form.costPrice),
      salePrice: Number(form.salePrice),
      categoryId: form.categoryId ? inventoryId(form.categoryId) : null,
      supplierId: form.supplierId ? inventoryId(form.supplierId) : null,
      supplier: selectedSupplier?.name || form.supplier,
    };
    if (editing) delete payload.quantity;
    try {
      if (editing) await api.patch(`/inventory/products/${editing}`, payload);
      else await api.post('/inventory/products', payload);
      setForm(emptyProduct); setEditing(null); setShowForm(false); await load();
    } catch (requestError) { setError(apiError(requestError)); }
  }
  async function editProduct(product) {
    setEditing(product.id);
    setForm({
      name: product.name, sku: product.sku, category: product.category,
      categoryId: product.category_id || categories.find((category) => category.name === product.category)?.id || '',
      description: product.description || '', quantity: product.quantity,
      minStock: product.min_stock, costPrice: product.cost_price, salePrice: product.sale_price,
      supplier: product.supplier || '',
      supplierId: product.supplier_id || suppliers.find((supplier) => supplier.name === product.supplier)?.id || '',
    });
    setShowForm(true);
  }
  async function archiveProduct(product) {
    if (!window.confirm(`Archive ${product.name}?`)) return;
    try { await api.delete(`/inventory/products/${product.id}`); await load(); }
    catch (requestError) { setError(apiError(requestError)); }
  }
  async function submitMovement(event) {
    event.preventDefault();
    try {
      await api.post(`/inventory/products/${movement.id}/movements`, { ...movementForm, quantity: Number(movementForm.quantity) });
      setMovement(null); await load();
    } catch (requestError) { setError(apiError(requestError)); }
  }
  async function createSupplier(event) {
    event.preventDefault();
    try {
      await api.post('/inventory/suppliers', supplierForm);
      setSupplierForm({ name: '', email: '', phone: '' }); setShowSupplier(false); await load();
    } catch (requestError) { setError(apiError(requestError)); }
  }
  async function createCategory(event) {
    event.preventDefault();
    try {
      await api.post('/inventory/categories', categoryForm);
      setCategoryForm({ name: '' }); await load();
    } catch (requestError) { setError(apiError(requestError)); }
  }
  async function exportCsv() {
    try {
      const response = await api.get('/inventory/export.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = url; link.download = 'inventory.csv'; link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) { setError(apiError(requestError)); }
  }
  return (
    <div>
      <PageHeading eyebrow="Track stock and movements" title="Inventory Management" description="Role-protected product records, low-stock alerts, valuation, and transaction history." action={<div className="flex flex-wrap gap-2"><button className="secondary-button" onClick={exportCsv}><Download className="h-4 w-4" />CSV</button><button className="secondary-button" onClick={() => setShowCategories(!showCategories)}>Categories</button><button className="secondary-button" onClick={() => setShowSupplier(!showSupplier)}>Suppliers</button><button className="primary-button" onClick={() => { setEditing(null); setForm(emptyProduct); setShowForm(!showForm); }}><Plus className="h-4 w-4" />Product</button></div>} />
      <Notice message={error} onClose={() => setError('')} />
      {analytics && <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Products', analytics.total_products], ['Inventory value', `$${Number(analytics.inventory_value).toFixed(2)}`], ['Low stock', analytics.low_stock], ['Out of stock', analytics.out_of_stock]].map(([label, value]) => <div key={label} className="metric-card"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>}
      {showSupplier && <Card className="mb-4"><h2 className="mb-3 font-semibold">Add a supplier</h2><form onSubmit={createSupplier} className="grid gap-3 sm:grid-cols-3"><label className="field-label">Name<input required className="field-input" value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} /></label><label className="field-label">Email<input type="email" className="field-input" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} /></label><label className="field-label">Phone<input className="field-input" value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></label><div className="sm:col-span-3"><button className="primary-button"><Plus className="h-4 w-4" />Save supplier</button></div></form><p className="mt-3 text-xs text-slate-500">{suppliers.length} supplier records available.</p></Card>}
      {showCategories && <Card className="mb-4"><h2 className="mb-3 font-semibold">Manage inventory categories</h2><form onSubmit={createCategory} className="flex flex-col gap-3 sm:flex-row"><label className="field-label flex-1">New category<input required maxLength="100" className="field-input" value={categoryForm.name} onChange={(event) => setCategoryForm({ name: event.target.value })} /></label><button className="primary-button self-end"><Plus className="h-4 w-4" />Add category</button></form><div className="mt-3 flex flex-wrap gap-2">{categories.map((category) => <span className="tag" key={category.id}>{category.name}</span>)}</div></Card>}
      {showForm && <Card className="mb-4"><form onSubmit={saveProduct} className="grid gap-3 md:grid-cols-3"><h2 className="font-semibold md:col-span-3">{editing ? 'Edit product' : 'Add product'}</h2><label className="field-label">Product name<input required className="field-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field-label">SKU<input required className="field-input" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label><label className="field-label">Category<select required className="field-input" value={form.categoryId} onChange={(event) => { const selected = categories.find((item) => String(item.id) === event.target.value); setForm({ ...form, categoryId: event.target.value, category: selected?.name || '' }); }}><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="field-label">Quantity<input type="number" min="0" required disabled={Boolean(editing)} className="field-input" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />{editing && <span className="mt-1 block text-xs text-slate-500">Use stock movement actions to change quantity.</span>}</label><label className="field-label">Minimum stock<input type="number" min="0" required className="field-input" value={form.minStock} onChange={(event) => setForm({ ...form, minStock: event.target.value })} /></label><label className="field-label">Cost price<input type="number" min="0" step="0.01" className="field-input" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} /></label><label className="field-label">Selling price<input type="number" min="0" step="0.01" className="field-input" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value })} /></label><label className="field-label">Supplier<select className="field-input" value={form.supplierId} onChange={(event) => { const selected = suppliers.find((item) => String(item.id) === event.target.value); setForm({ ...form, supplierId: event.target.value, supplier: selected?.name || '' }); }}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label className="field-label md:col-span-3">Description<textarea rows="2" className="field-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="flex gap-2 md:col-span-3"><button className="primary-button">Save product</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button></div></form></Card>}
      {movement && <Card className="mb-4"><form onSubmit={submitMovement} className="grid gap-3 sm:grid-cols-[1fr_120px_1fr_auto]"><div className="self-center"><p className="text-sm text-slate-500">Record movement for</p><p className="font-semibold">{movement.name}</p></div><label className="field-label">Type<select className="field-input" value={movementForm.type} onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value })}><option value="in">Stock in</option><option value="out">Stock out</option><option value="adjustment">Set quantity</option></select></label><label className="field-label">Quantity<input type="number" min="1" required className="field-input" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} /></label><button className="primary-button self-end">Record</button><label className="field-label sm:col-span-4">Note<input className="field-input" value={movementForm.note} onChange={(event) => setMovementForm({ ...movementForm, note: event.target.value })} /></label></form></Card>}
      <div className="search-box mb-4"><Search className="h-4 w-4" /><input placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <Card className="overflow-x-auto !p-0"><table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Stock</th><th>Valuation</th><th>Supplier</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><span className="font-medium text-slate-900">{product.name}</span><span className="block text-xs text-slate-500">{product.description}</span></td><td>{product.sku}</td><td>{product.category}</td><td><span className={product.quantity <= product.min_stock ? 'text-rose-600 font-semibold' : ''}>{product.quantity}</span><span className="block text-xs text-slate-500">minimum {product.min_stock}</span></td><td>${(Number(product.quantity) * Number(product.cost_price)).toFixed(2)}</td><td>{product.supplier || '-'}</td><td><div className="flex gap-1"><button title="Stock in" className="icon-button text-emerald-700" onClick={() => { setMovement(product); setMovementForm({ type: 'in', quantity: 1, note: '' }); }}><ArrowUpCircle className="h-4 w-4" /></button><button title="Stock out" className="icon-button text-amber-700" onClick={() => { setMovement(product); setMovementForm({ type: 'out', quantity: 1, note: '' }); }}><ArrowDownCircle className="h-4 w-4" /></button><button title="Edit product" className="icon-button" onClick={() => editProduct(product)}><Edit3 className="h-4 w-4" /></button><button title="Archive product" className="icon-button text-rose-600" onClick={() => archiveProduct(product)}><Archive className="h-4 w-4" /></button></div></td></tr>)}</tbody></table>{!products.length && <div className="p-5"><EmptyState icon={Package} title="No products found" text="Add a product or change the search." /></div>}</Card>
      <Card className="mt-5"><h2 className="mb-3 font-semibold text-slate-900">Recent stock movements</h2>{movements.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>When</th><th>Product</th><th>Movement</th><th>Quantity</th><th>Note</th></tr></thead><tbody>{movements.slice(0, 12).map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.product_name}</td><td className="capitalize">{item.movement_type}</td><td>{item.quantity}</td><td>{item.note}</td></tr>)}</tbody></table></div> : <EmptyState icon={Clock3} title="No stock movements" text="Movements are recorded when new stock is added or adjusted." />}</Card>
    </div>
  );
}

function AppShell({ user, onLogout, onUserChange }) {
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(user.name);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [profileError, setProfileError] = useState('');
  useEffect(() => {
    if (!searchOpen || search.trim().length < 2) { setResults([]); return undefined; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/dashboard/search', { params: { q: search } });
        setResults(data.results); setSearchError('');
      } catch (error) { setSearchError(apiError(error)); }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, searchOpen]);
  async function openNotifications() {
    const open = !notificationsOpen;
    setNotificationsOpen(open);
    if (open) {
      try { const { data } = await api.get('/dashboard/notifications'); setNotifications(data.notifications); }
      catch (error) { setSearchError(apiError(error)); }
    }
  }
  async function readNotification(item) {
    try {
      await api.patch(`/dashboard/notifications/${encodeURIComponent(item.id)}/read`);
      setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, read: true } : notification));
    } catch (error) { setSearchError(apiError(error)); }
  }
  function openResult(result) {
    const target = result.type === 'task' ? '/tasks' : result.type === 'product' ? '/inventory' : result.type === 'study' ? '/study' : '/knowledge';
    setSearchOpen(false); setSearch(''); navigate(target);
  }
  async function saveProfile(event) {
    event.preventDefault();
    try {
      const { data } = await api.patch('/auth/me', { name: profileName });
      onUserChange(data.user);
      setProfileError('');
    } catch (error) { setProfileError(apiError(error)); }
  }
  async function changePassword(event) {
    event.preventDefault();
    try {
      await api.post('/auth/change-password', passwordForm);
      setProfileOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      onUserChange(null);
    } catch (error) { setProfileError(apiError(error)); }
  }
  const inventoryAllowed = ['admin', 'inventory_manager'].includes(user.role);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {mobileNav && <button aria-label="Close navigation overlay" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMobileNav(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white p-5 transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 flex items-center justify-between gap-3"><Link to="/" onClick={() => setMobileNav(false)} className="flex items-center gap-3"><div className="rounded-xl bg-indigo-600 p-2 text-white"><LayoutDashboard className="h-5 w-5" /></div><div><p className="font-bold text-slate-900">UniSphere AI</p><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Productivity platform</p></div></Link><button className="icon-button lg:hidden" aria-label="Close menu" onClick={() => setMobileNav(false)}><X className="h-4 w-4" /></button></div>
        <nav className="space-y-1">{navItems.filter((item) => !item.inventory || inventoryAllowed).map(({ name, to, icon: Icon }) => <Link key={to} onClick={() => setMobileNav(false)} to={to} className="nav-link"><Icon className="h-4 w-4" />{name}</Link>)}</nav>
        <div className="mt-auto rounded-xl border border-indigo-100 bg-indigo-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-indigo-800"><ShieldAlert className="h-4 w-4" />Private workspace</p><p className="mt-2 text-xs text-indigo-700">Tasks and knowledge resources are scoped to your account. Inventory is limited to authorized roles.</p></div>
      </aside>
      <main className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-7">
          <div className="flex items-center gap-3">
            <button aria-label="Open navigation" className="icon-button lg:hidden" onClick={() => setMobileNav(true)}><Menu className="h-5 w-5" /></button>
            <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Workspace</p><p className="truncate font-semibold text-slate-900">Study Smarter. Organize Knowledge. Manage Resources.</p></div>
            <button className="icon-button" title="Global search" aria-label="Global search" onClick={() => { setSearchOpen(true); setNotificationsOpen(false); }}><Search className="h-5 w-5" /></button>
            <div className="relative"><button className="icon-button" title="Notifications" aria-label="Notifications" onClick={openNotifications}><Bell className="h-5 w-5" /></button>{notificationsOpen && <div className="absolute right-0 top-12 z-40 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Notifications</h3><button className="text-xs text-indigo-600" onClick={() => setNotificationsOpen(false)}>Close</button></div>{notifications.length ? notifications.map((item) => <button key={item.id} onClick={() => readNotification(item)} className={`mb-2 block w-full rounded-lg p-3 text-left ${item.read ? 'bg-slate-50' : 'bg-indigo-50'}`}><span className="flex items-center gap-2 text-sm font-medium">{item.read ? <CircleCheck className="h-4 w-4 text-slate-400" /> : <Bell className="h-4 w-4 text-indigo-600" />}{item.title}</span><span className="mt-1 block text-xs text-slate-600">{item.message}</span></button>) : <p className="py-5 text-center text-sm text-slate-500">You're all caught up.</p>}</div>}</div>
            <button className="hidden items-center gap-2 border-l border-slate-200 pl-3 text-left sm:flex" title="Account settings" onClick={() => { setProfileOpen(true); setProfileError(''); }}><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">{user.name.slice(0, 1).toUpperCase()}</div><div className="hidden md:block"><p className="max-w-32 truncate text-sm font-semibold">{user.name}</p><p className="text-xs capitalize text-slate-500">{user.role.replace('_', ' ')}</p></div></button>
            <button className="icon-button sm:hidden" title="Account settings" aria-label="Account settings" onClick={() => { setProfileOpen(true); setProfileError(''); }}><CircleUserRound className="h-4 w-4" /></button>
            <button className="icon-button text-slate-500" title="Sign out" aria-label="Sign out" onClick={onLogout}><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="mx-auto max-w-7xl p-4 md:p-7">
          <Routes>
            <Route path="/" element={<DashboardPage user={user} />} />
            <Route path="/study" element={<StudyPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/inventory" element={inventoryAllowed ? <InventoryPage /> : <div><PageHeading title="Inventory access restricted" description="Your account does not have the Inventory Manager or Administrator role." /><EmptyState icon={ShieldAlert} title="Permission required" text="Ask an administrator to update your assigned role." /></div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        {searchOpen && <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 p-4 pt-[10vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center gap-3 border-b border-slate-200 px-4"><Search className="h-5 w-5 text-slate-400" /><input autoFocus className="h-14 flex-1 outline-none" placeholder="Search tasks, notes, study materials, products..." value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && setSearchOpen(false)} /><button className="icon-button" onClick={() => setSearchOpen(false)}><X className="h-4 w-4" /></button></div><div className="max-h-[60vh] overflow-y-auto p-3">{searchError && <p className="p-3 text-sm text-rose-600">{searchError}</p>}{results.map((result, index) => <button key={`${result.type}-${result.id}-${index}`} onClick={() => openResult(result)} className="block w-full rounded-lg px-3 py-3 text-left hover:bg-slate-50"><span className="flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="tag capitalize">{result.type}</span>{result.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{result.excerpt}</span></button>)}{search.length >= 2 && !results.length && !searchError && <p className="p-6 text-center text-sm text-slate-500">No results found.</p>}{search.length < 2 && <p className="p-6 text-center text-sm text-slate-500">Type at least two characters to search.</p>}</div></div></div>}
        {profileOpen && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 pt-[8vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}><div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Account settings</p><h2 className="mt-1 text-xl font-bold">Profile and security</h2><p className="mt-1 text-sm text-slate-500">{user.email} · {user.role.replace('_', ' ')}</p></div><button className="icon-button" aria-label="Close settings" onClick={() => setProfileOpen(false)}><X className="h-4 w-4" /></button></div><Notice message={profileError} onClose={() => setProfileError('')} /><form onSubmit={saveProfile} className="space-y-3 border-b border-slate-200 pb-5"><h3 className="font-semibold">Profile</h3><label className="field-label">Display name<input required minLength="2" className="field-input" value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label><button className="primary-button">Save profile</button></form><form onSubmit={changePassword} className="mt-5 space-y-3"><h3 className="font-semibold">Change password</h3><label className="field-label">Current password<input required minLength="8" type="password" autoComplete="current-password" className="field-input" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} /></label><label className="field-label">New password<input required minLength="8" type="password" autoComplete="new-password" className="field-input" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} /></label><button className="secondary-button">Update password and sign out</button></form></div></div>}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get('/auth/me').then(({ data }) => { if (active) setUser(data.user); }).catch(() => {
      if (active) setUser(null);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function logout() {
    try { await api.post('/auth/logout'); }
    finally { setUser(null); }
  }
  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="skeleton h-24 w-64" /></div>;
  return user ? <AppShell user={user} onLogout={logout} onUserChange={setUser} /> : <AuthPage onAuthenticated={setUser} />;
}
