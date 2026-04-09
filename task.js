/**
 * task.js — 任務建立、渲染、詳情面板
 */

let currentTaskId = null;

function createNewTask(title, extraProps = {}) {
  const todayStr = formatDate(new Date());
  const view = Store.data.settings.currentView;

  const task = {
    id: generateId(),
    title: title.trim(),
    notes: '',
    completed: false,
    important: extraProps.important || false,
    myDay: extraProps.myDay || (view === 'myday' ? todayStr : ''),
    dueDate: extraProps.dueDate || '',
    reminder: '',
    repeat: '',
    listId: (!['myday','important','planned','all','completed'].includes(view)) ? view : '',
    categories: [],
    steps: [],
    files: [],
    createdAt: new Date().toISOString(),
    completedAt: '',
  };

  Store.addTask(task);
  return task;
}

// ===== 渲染任務列表 =====
function renderTaskList() {
  const view = Store.data.settings.currentView;
  let tasks = Store.getTasksByView(view);
  let completed = Store.getCompletedByView(view);

  tasks = sortTasks(tasks, Store.data.settings.sort);
  completed = sortTasks(completed, Store.data.settings.sort);

  const taskListEl = document.getElementById('task-list');
  const completedSection = document.getElementById('completed-section');
  const completedList = document.getElementById('completed-list');
  const emptyState = document.getElementById('empty-state');

  taskListEl.innerHTML = '';
  completedList.innerHTML = '';

  if (tasks.length === 0 && completed.length === 0) {
    emptyState.classList.remove('hidden');
    completedSection.classList.add('hidden');
    updateEmptyState(view);
    return;
  }
  emptyState.classList.add('hidden');

  tasks.forEach(t => taskListEl.appendChild(createTaskCard(t)));

  if (completed.length > 0 && view !== 'completed') {
    completedSection.classList.remove('hidden');
    document.getElementById('completed-count-inline').textContent = completed.length;
    completed.forEach(t => completedList.appendChild(createTaskCard(t)));
  } else {
    completedSection.classList.add('hidden');
    if (view === 'completed') {
      completed = Store.getTasksByView('completed');
      completed = sortTasks(completed, Store.data.settings.sort);
      completed.forEach(t => taskListEl.appendChild(createTaskCard(t)));
    }
  }
}

function createTaskCard(task) {
  const div = document.createElement('div');
  div.className = `task-card ${task.completed ? 'done' : ''} ${currentTaskId === task.id ? 'selected' : ''}`;
  div.dataset.id = task.id;

  // 子任務完成度
  const totalSteps = task.steps ? task.steps.length : 0;
  const doneSteps = task.steps ? task.steps.filter(s => s.completed).length : 0;

  // Meta 資訊
  let metaHtml = '';
  const metas = [];

  if (task.myDay && task.myDay === formatDate(new Date())) {
    const view = Store.data.settings.currentView;
    if (view !== 'myday') metas.push('<span class="meta-item">☀️ 我的一天</span>');
  }
  if (task.dueDate) {
    const cls = task.completed ? '' : isOverdue(task.dueDate) ? 'overdue' : isToday(task.dueDate) ? 'today' : '';
    metas.push(`<span class="meta-item ${cls}">📅 ${formatDateDisplay(task.dueDate)}</span>`);
  }
  if (task.repeat) metas.push('<span class="meta-item">🔁</span>');
  if (task.reminder) metas.push(`<span class="meta-item">🔔 ${formatDatetimeDisplay(task.reminder)}</span>`);
  if (totalSteps > 0) metas.push(`<span class="meta-item">📝 ${doneSteps}/${totalSteps}</span>`);
  if (task.listId) {
    const list = Store.data.lists.find(l => l.id === task.listId);
    if (list) metas.push(`<span class="meta-item">📂 ${escHtml(list.name)}</span>`);
  }
  if (task.categories && task.categories.length > 0) {
    const dots = task.categories.map(c => `<span class="category-dot" style="background:${CAT_COLORS[c] || '#999'}"></span>`).join('');
    metas.push(`<span class="task-category-dots">${dots}</span>`);
  }

  if (metas.length > 0) metaHtml = `<div class="task-meta-row">${metas.join('')}</div>`;

  div.innerHTML = `
    <div class="task-check" data-action="check">${task.completed ? '✓' : ''}</div>
    <div class="task-body" data-action="open">
      <div class="task-title">${escHtml(task.title)}</div>
      ${metaHtml}
    </div>
    <button class="task-star ${task.important ? 'starred' : ''}" data-action="star">${task.important ? '★' : '☆'}</button>
  `;

  // Events
  div.querySelector('[data-action="check"]').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTaskComplete(task.id);
  });
  div.querySelector('[data-action="open"]').addEventListener('click', () => openDetail(task.id));
  div.querySelector('[data-action="star"]').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTaskImportant(task.id);
  });

  return div;
}

function toggleTaskComplete(id) {
  const task = Store.getTask(id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : '';

  // Handle repeat
  if (task.completed && task.repeat) {
    const nextDate = getNextRepeatDate(task.dueDate, task.repeat);
    if (nextDate) {
      // Create next occurrence
      const newTask = { ...task, id: generateId(), completed: false, completedAt: '', dueDate: nextDate, createdAt: new Date().toISOString() };
      newTask.steps = task.steps.map(s => ({ ...s, completed: false }));
      Store.addTask(newTask);
    }
  }

  Store.save();
  renderAll();
  if (currentTaskId === id) renderDetail(id);
}

function toggleTaskImportant(id) {
  const task = Store.getTask(id);
  if (!task) return;
  task.important = !task.important;
  Store.save();
  renderAll();
  if (currentTaskId === id) renderDetail(id);
}

function getNextRepeatDate(currentDue, repeat) {
  const base = currentDue ? new Date(currentDue + 'T00:00:00') : new Date();
  switch (repeat) {
    case 'daily': base.setDate(base.getDate() + 1); break;
    case 'weekdays':
      do { base.setDate(base.getDate() + 1); } while (base.getDay() === 0 || base.getDay() === 6);
      break;
    case 'weekly': base.setDate(base.getDate() + 7); break;
    case 'monthly': base.setMonth(base.getMonth() + 1); break;
    case 'yearly': base.setFullYear(base.getFullYear() + 1); break;
    default: return '';
  }
  return formatDate(base);
}

// ===== 詳情面板 =====
function openDetail(id) {
  currentTaskId = id;
  const panel = document.getElementById('detail-panel');
  panel.classList.remove('hidden');
  renderDetail(id);
  renderTaskList(); // update selected
}

function closeDetail() {
  currentTaskId = null;
  document.getElementById('detail-panel').classList.add('hidden');
  renderTaskList();
}

function renderDetail(id) {
  const task = Store.getTask(id);
  if (!task) { closeDetail(); return; }

  // Check
  const checkEl = document.getElementById('detail-check');
  checkEl.className = `task-check-detail ${task.completed ? 'checked' : ''}`;
  checkEl.textContent = task.completed ? '✓' : '';
  checkEl.onclick = () => { toggleTaskComplete(id); };

  // Title
  const titleEl = document.getElementById('detail-title');
  titleEl.value = task.title;
  titleEl.className = `detail-title-input ${task.completed ? 'done-title' : ''}`;
  titleEl.oninput = () => { Store.updateTask(id, { title: titleEl.value }); renderTaskList(); };

  // Star
  const starEl = document.getElementById('detail-star');
  starEl.className = `star-btn ${task.important ? 'starred' : ''}`;
  starEl.textContent = task.important ? '★' : '☆';
  starEl.onclick = () => toggleTaskImportant(id);

  // Steps
  renderSteps(task);

  // My Day
  const todayStr = formatDate(new Date());
  const mdBtn = document.getElementById('detail-myday-btn');
  const mdText = document.getElementById('detail-myday-text');
  const isMyDay = task.myDay === todayStr;
  mdBtn.className = `detail-action-btn ${isMyDay ? 'active-value' : ''}`;
  mdText.textContent = isMyDay ? '已加入「我的一天」' : '加入「我的一天」';
  mdBtn.onclick = () => {
    Store.updateTask(id, { myDay: isMyDay ? '' : todayStr });
    renderDetail(id);
    renderAll();
  };

  // Reminder
  const remText = document.getElementById('detail-reminder-text');
  const remInput = document.getElementById('detail-reminder-input');
  const remBtn = document.getElementById('detail-reminder-btn');
  const clearRem = document.getElementById('clear-reminder-btn');
  if (task.reminder) {
    remText.textContent = formatDatetimeDisplay(task.reminder);
    remBtn.classList.add('active-value');
    clearRem.classList.remove('hidden');
  } else {
    remText.textContent = '提醒我';
    remBtn.classList.remove('active-value');
    clearRem.classList.add('hidden');
  }
  remBtn.onclick = (e) => {
    if (e.target === clearRem || clearRem.contains(e.target)) return;
    remInput.classList.toggle('hidden');
    if (!remInput.classList.contains('hidden')) remInput.focus();
  };
  remInput.value = task.reminder ? task.reminder.slice(0, 16) : '';
  remInput.onchange = () => {
    Store.updateTask(id, { reminder: remInput.value ? new Date(remInput.value).toISOString() : '' });
    remInput.classList.add('hidden');
    renderDetail(id);
    renderTaskList();
    scheduleReminder(task);
  };
  clearRem.onclick = (e) => {
    e.stopPropagation();
    Store.updateTask(id, { reminder: '' });
    renderDetail(id);
    renderTaskList();
  };

  // Due Date
  const dueText = document.getElementById('detail-due-text');
  const dueInput = document.getElementById('detail-due-input');
  const dueBtn = document.getElementById('detail-due-btn');
  const clearDue = document.getElementById('clear-due-btn');
  if (task.dueDate) {
    dueText.textContent = formatDateDisplay(task.dueDate);
    dueBtn.classList.add('active-value');
    clearDue.classList.remove('hidden');
  } else {
    dueText.textContent = '新增到期日';
    dueBtn.classList.remove('active-value');
    clearDue.classList.add('hidden');
  }
  dueBtn.onclick = (e) => {
    if (e.target === clearDue || clearDue.contains(e.target)) return;
    showDateQuickMenu(dueBtn, (dateStr) => {
      Store.updateTask(id, { dueDate: dateStr });
      renderDetail(id);
      renderAll();
    }, () => {
      dueInput.classList.remove('hidden');
      dueInput.focus();
    });
  };
  dueInput.value = task.dueDate || '';
  dueInput.onchange = () => {
    Store.updateTask(id, { dueDate: dueInput.value });
    dueInput.classList.add('hidden');
    renderDetail(id);
    renderAll();
  };
  clearDue.onclick = (e) => {
    e.stopPropagation();
    Store.updateTask(id, { dueDate: '' });
    renderDetail(id);
    renderAll();
  };

  // Repeat
  const repText = document.getElementById('detail-repeat-text');
  const repSelect = document.getElementById('detail-repeat-select');
  const repBtn = document.getElementById('detail-repeat-btn');
  const repeatLabels = { '': '重複', daily: '每天', weekdays: '每個工作日', weekly: '每週', monthly: '每月', yearly: '每年' };
  repText.textContent = repeatLabels[task.repeat || ''] || '重複';
  repBtn.className = `detail-action-btn ${task.repeat ? 'active-value' : ''}`;
  repBtn.onclick = () => repSelect.classList.toggle('hidden');
  repSelect.value = task.repeat || '';
  repSelect.onchange = () => {
    Store.updateTask(id, { repeat: repSelect.value });
    repSelect.classList.add('hidden');
    renderDetail(id);
    renderTaskList();
  };

  // Categories
  renderCategories(task);

  // Files
  renderFiles(task);

  // Notes
  const notesEl = document.getElementById('detail-notes');
  notesEl.value = task.notes || '';
  notesEl.oninput = () => Store.updateTask(id, { notes: notesEl.value });

  // Delete
  document.getElementById('delete-task-btn').onclick = () => {
    if (confirm('確定要刪除這個任務嗎？')) {
      Store.deleteTask(id);
      closeDetail();
      renderAll();
      showToast('任務已刪除');
    }
  };

  // Created
  document.getElementById('detail-created').textContent = `建立於 ${new Date(task.createdAt).toLocaleString('zh-TW')}`;
}

// --- Steps ---
function renderSteps(task) {
  const container = document.getElementById('steps-list');
  container.innerHTML = '';
  if (!task.steps) task.steps = [];
  task.steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'step-item';
    div.innerHTML = `
      <button class="step-check ${step.completed ? 'checked' : ''}">${step.completed ? '✓' : ''}</button>
      <input type="text" class="step-title ${step.completed ? 'done-step' : ''}" value="${escHtml(step.title)}" />
      <button class="step-delete">✕</button>
    `;
    div.querySelector('.step-check').onclick = () => {
      task.steps[i].completed = !task.steps[i].completed;
      Store.save();
      renderDetail(task.id);
      renderTaskList();
    };
    div.querySelector('.step-title').oninput = (e) => {
      task.steps[i].title = e.target.value;
      Store.save();
    };
    div.querySelector('.step-delete').onclick = () => {
      task.steps.splice(i, 1);
      Store.save();
      renderDetail(task.id);
      renderTaskList();
    };
    container.appendChild(div);
  });

  const addInput = document.getElementById('add-step-input');
  addInput.value = '';
  addInput.onkeydown = (e) => {
    if (e.key === 'Enter' && addInput.value.trim()) {
      task.steps.push({ title: addInput.value.trim(), completed: false });
      Store.save();
      renderDetail(task.id);
      renderTaskList();
      setTimeout(() => document.getElementById('add-step-input').focus(), 50);
    }
  };
}

// --- Categories ---
function renderCategories(task) {
  const chipsContainer = document.getElementById('category-chips');
  const picker = document.getElementById('category-picker');
  chipsContainer.innerHTML = '';
  if (!task.categories) task.categories = [];
  task.categories.forEach(cat => {
    const chip = document.createElement('span');
    chip.className = 'category-chip';
    chip.style.background = CAT_COLORS[cat] || '#999';
    chip.innerHTML = `${cat} <button class="remove-cat">✕</button>`;
    chip.querySelector('.remove-cat').onclick = () => {
      task.categories = task.categories.filter(c => c !== cat);
      Store.save();
      renderDetail(task.id);
      renderTaskList();
    };
    chipsContainer.appendChild(chip);
  });

  document.getElementById('detail-category-btn').onclick = () => picker.classList.toggle('hidden');
  picker.querySelectorAll('.cat-chip').forEach(btn => {
    btn.onclick = () => {
      const color = btn.dataset.color;
      if (!task.categories.includes(color)) {
        task.categories.push(color);
        Store.save();
        renderDetail(task.id);
        renderTaskList();
      }
      picker.classList.add('hidden');
    };
  });
}

// --- Files ---
function renderFiles(task) {
  const container = document.getElementById('file-list');
  container.innerHTML = '';
  if (!task.files) task.files = [];
  task.files.forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `<span>📄 ${escHtml(f.name)}</span><button class="file-remove">✕</button>`;
    div.querySelector('.file-remove').onclick = () => {
      task.files.splice(i, 1);
      Store.save();
      renderDetail(task.id);
    };
    container.appendChild(div);
  });

  document.getElementById('detail-file-btn').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      for (const file of e.target.files) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          task.files.push({ name: file.name, data: ev.target.result.slice(0, 50000) }); // limit size
          Store.save();
          renderDetail(task.id);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };
}

// --- Date Quick Menu ---
function showDateQuickMenu(anchor, onSelect, onPick) {
  const menu = document.getElementById('date-quick-menu');
  const rect = anchor.getBoundingClientRect();
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.left = rect.left + 'px';
  menu.classList.remove('hidden');

  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + (8 - nextWeek.getDay()) % 7 || 7);

  menu.onclick = (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    menu.classList.add('hidden');
    switch (btn.dataset.date) {
      case 'today': onSelect(formatDate(today)); break;
      case 'tomorrow': onSelect(formatDate(tomorrow)); break;
      case 'next-week': onSelect(formatDate(nextWeek)); break;
      case 'pick': onPick(); break;
    }
  };

  const closeMenu = (e) => {
    if (!menu.contains(e.target) && !anchor.contains(e.target)) {
      menu.classList.add('hidden');
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

// --- Reminder (basic notification) ---
function scheduleReminder(task) {
  if (!task.reminder || task.completed) return;
  if (!('Notification' in window)) return;
  Notification.requestPermission();
  const diff = new Date(task.reminder) - new Date();
  if (diff > 0 && diff < 86400000) { // within 24h
    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('My Todo 提醒', { body: task.title, icon: '📋' });
      }
    }, diff);
  }
}

// --- Sort ---
function sortTasks(tasks, sortType) {
  const arr = [...tasks];
  switch (sortType) {
    case 'alpha': return arr.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));
    case 'alpha-desc': return arr.sort((a, b) => b.title.localeCompare(a.title, 'zh-Hant'));
    case 'due': return arr.sort((a, b) => (a.dueDate || '9999') .localeCompare(b.dueDate || '9999'));
    case 'created': return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'important': return arr.sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0));
    default: return arr;
  }
}

function updateEmptyState(view) {
  const icons = { myday: '☀️', important: '⭐', planned: '📅', all: '📋', completed: '✅' };
  const titles = { myday: '專注你的一天', important: '沒有重要任務', planned: '沒有已規劃的任務', all: '所有任務已完成', completed: '沒有已完成的任務' };
  const descs = { myday: '你今天想完成什麼？', important: '標記星號的任務會出現在這裡', planned: '設定到期日的任務會出現在這裡', all: '新增一些任務開始吧！', completed: '完成任務後會出現在這裡' };

  document.getElementById('empty-icon').textContent = icons[view] || '📂';
  document.getElementById('empty-title').textContent = titles[view] || '清單是空的';
  document.getElementById('empty-desc').textContent = descs[view] || '新增任務開始吧';
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
