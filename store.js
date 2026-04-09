/**
 * store.js — 資料層：localStorage 存取
 */
const STORE_KEY = 'mytodo_data';

const defaultStore = () => ({
  lists: [],
  tasks: [],
  settings: {
    theme: 'light',
    sort: 'default',
    currentView: 'myday',
    sidebarCollapsed: false,
  },
});

const Store = {
  _data: null,

  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) { this._data = defaultStore(); return this._data; }
      const parsed = JSON.parse(raw);
      this._data = {
        ...defaultStore(),
        ...parsed,
        settings: { ...defaultStore().settings, ...parsed.settings },
      };
    } catch (e) {
      console.error('Store load failed:', e);
      this._data = defaultStore();
    }
    return this._data;
  },

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
    } catch (e) { console.error('Store save failed:', e); }
  },

  get data() {
    if (!this._data) this.load();
    return this._data;
  },

  // --- Tasks ---
  addTask(task) {
    this._data.tasks.push(task);
    this.save();
  },
  updateTask(id, updates) {
    const t = this._data.tasks.find(t => t.id === id);
    if (t) { Object.assign(t, updates); this.save(); }
    return t;
  },
  deleteTask(id) {
    this._data.tasks = this._data.tasks.filter(t => t.id !== id);
    this.save();
  },
  getTask(id) { return this._data.tasks.find(t => t.id === id); },
  getTasksByView(view) {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = formatDate(today);
    switch (view) {
      case 'myday':
        return this._data.tasks.filter(t => !t.completed && t.myDay === todayStr);
      case 'important':
        return this._data.tasks.filter(t => !t.completed && t.important);
      case 'planned':
        return this._data.tasks.filter(t => !t.completed && t.dueDate);
      case 'all':
        return this._data.tasks.filter(t => !t.completed);
      case 'completed':
        return this._data.tasks.filter(t => t.completed);
      default:
        // Custom list
        return this._data.tasks.filter(t => !t.completed && t.listId === view);
    }
  },
  getCompletedByView(view) {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = formatDate(today);
    if (view === 'completed') return [];
    switch (view) {
      case 'myday':
        return this._data.tasks.filter(t => t.completed && t.myDay === todayStr);
      case 'important':
        return this._data.tasks.filter(t => t.completed && t.important);
      case 'planned':
        return this._data.tasks.filter(t => t.completed && t.dueDate);
      case 'all':
        return this._data.tasks.filter(t => t.completed);
      default:
        return this._data.tasks.filter(t => t.completed && t.listId === view);
    }
  },

  // --- Lists ---
  addList(list) { this._data.lists.push(list); this.save(); },
  updateList(id, updates) {
    const l = this._data.lists.find(l => l.id === id);
    if (l) { Object.assign(l, updates); this.save(); }
    return l;
  },
  deleteList(id) {
    this._data.lists = this._data.lists.filter(l => l.id !== id);
    // Also delete tasks in this list
    this._data.tasks = this._data.tasks.filter(t => t.listId !== id);
    this.save();
  },

  // --- Export / Import ---
  exportJSON() { return JSON.stringify(this._data, null, 2); },
  importJSON(json) {
    try {
      const d = JSON.parse(json);
      if (d && Array.isArray(d.tasks)) {
        this._data = { ...defaultStore(), ...d, settings: { ...defaultStore().settings, ...d.settings } };
        this.save();
        return true;
      }
    } catch (e) {}
    return false;
  },
  reset() { this._data = defaultStore(); this.save(); }
};

// --- Helpers ---
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') d = new Date(d);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.getTime() === today.getTime()) return '今天';
  if (d.getTime() === tomorrow.getTime()) return '明天';
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === yesterday.getTime()) return '昨天';
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('zh-TW', opts);
}

function formatDatetimeDisplay(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T23:59:59');
  return d < new Date();
}
function isToday(dateStr) {
  if (!dateStr) return false;
  return dateStr === formatDate(new Date());
}

const CAT_COLORS = {
  blue: '#4A90D9',
  red: '#E74C3C',
  orange: '#F39C12',
  green: '#27AE60',
  purple: '#8E44AD',
  yellow: '#F1C40F',
};

