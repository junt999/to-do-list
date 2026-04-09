/**
 * app.js — 主程式入口
 */

document.addEventListener('DOMContentLoaded', () => {
  Store.load();
  applyTheme();
  initSidebar();
  initSearch();
  initAddTaskBar();
  initSortMenu();
  initKeyboardShortcuts();
  switchView(Store.data.settings.currentView || 'myday');
  initReminders();
});

// ===== 新增任務欄 =====
function initAddTaskBar() {
  const input = document.getElementById('add-task-input');
  let pendingMyDay = false;
  let pendingImportant = false;
  let pendingDue = '';

  const mydayBtn = document.getElementById('shortcut-myday');
  const importantBtn = document.getElementById('shortcut-important');
  const dueBtn = document.getElementById('shortcut-due');

  const view = () => Store.data.settings.currentView;

  // 我的一天快捷鍵預設
  const updateShortcuts = () => {
    pendingMyDay = view() === 'myday';
    pendingImportant = view() === 'important';
    pendingDue = '';
    mydayBtn.classList.toggle('active', pendingMyDay);
    importantBtn.classList.toggle('active', pendingImportant);
    dueBtn.classList.remove('active');
  };
  updateShortcuts();

  // 監聽 view 切換後重新設定
  const origSwitch = window.switchView;
  window.switchView = (v) => { origSwitch(v); updateShortcuts(); };

  mydayBtn.onclick = () => {
    pendingMyDay = !pendingMyDay;
    mydayBtn.classList.toggle('active', pendingMyDay);
  };
  importantBtn.onclick = () => {
    pendingImportant = !pendingImportant;
    importantBtn.classList.toggle('active', pendingImportant);
  };
  dueBtn.onclick = () => {
    const today = formatDate(new Date());
    if (pendingDue) {
      pendingDue = '';
      dueBtn.classList.remove('active');
    } else {
      pendingDue = today;
      dueBtn.classList.add('active');
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const todayStr = formatDate(new Date());
      const task = createNewTask(input.value, {
        myDay: pendingMyDay ? todayStr : '',
        important: pendingImportant,
        dueDate: pendingDue,
      });
      input.value = '';
      renderAll();
      showToast('✅ 任務已新增');
      updateShortcuts();

      // 提醒排程
      scheduleReminder(task);
    }
  });

  // 點擊加號按鈕也能聚焦
  document.getElementById('add-task-circle-btn').onclick = () => input.focus();
}

// ===== 排序 =====
function initSortMenu() {
  const btn = document.getElementById('sort-btn');
  const menu = document.getElementById('sort-menu');

  btn.onclick = () => menu.classList.toggle('hidden');

  menu.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      Store.data.settings.sort = b.dataset.sort;
      Store.save();
      menu.classList.add('hidden');
      renderTaskList();
      showToast(`排序方式：${b.textContent}`);
    });
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hidden');
  });
}

// ===== 鍵盤快捷鍵 =====
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+N or Cmd+N — 新增任務
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      document.getElementById('add-task-input').focus();
    }
    // Escape — 關閉詳情
    if (e.key === 'Escape') {
      if (currentTaskId) closeDetail();
      document.getElementById('date-quick-menu').classList.add('hidden');
    }
    // Ctrl+/ — 搜尋
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      document.getElementById('search-input').focus();
    }
  });
}

// ===== 主題 =====
function applyTheme() {
  document.documentElement.setAttribute('data-theme', Store.data.settings.theme || 'light');
}
function toggleTheme() {
  const current = Store.data.settings.theme || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  Store.data.settings.theme = next;
  Store.save();
  applyTheme();
  showToast(next === 'dark' ? '🌙 深色模式' : '☀️ 淺色模式');
}

// ===== 匯出 / 匯入 =====
function exportAllData() {
  const json = Store.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mytodo_backup_${formatDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 資料已匯出');
}
function importAllData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (Store.importJSON(ev.target.result)) {
        renderAll();
        switchView('myday');
        showToast('📥 資料已匯入');
      } else {
        showToast('❌ 匯入失敗');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== Toast =====
function showToast(message, actionText = '', actionFn = null) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;
  if (actionText && actionFn) {
    const btn = document.createElement('button');
    btn.textContent = actionText;
    btn.onclick = () => { actionFn(); toast.remove(); };
    toast.appendChild(btn);
  }
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== 提醒初始化 =====
function initReminders() {
  Store.data.tasks.forEach(t => {
    if (t.reminder && !t.completed) scheduleReminder(t);
  });
}

// ===== 全局渲染 =====
function renderAll() {
  renderTaskList();
  renderCustomLists();
  updateCounts();
}
