/**
 * sidebar.js — 側邊欄導航 & 視圖切換
 */

function initSidebar() {
  // 智慧清單點擊
  document.querySelectorAll('#smart-lists .nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // 新增清單
  document.getElementById('add-list-btn').addEventListener('click', addNewList);

  // 側邊欄摺疊
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

  // 已完成折疊
  document.getElementById('completed-toggle').addEventListener('click', () => {
    const list = document.getElementById('completed-list');
    const arrow = document.querySelector('.toggle-arrow');
    list.classList.toggle('hidden');
    arrow.classList.toggle('open');
  });

  // 恢復狀態
  if (Store.data.settings.sidebarCollapsed) {
    document.getElementById('sidebar').classList.add('collapsed');
  }
}

function switchView(view) {
  Store.data.settings.currentView = view;
  Store.save();

  // 清除搜尋
  document.getElementById('search-input').value = '';

  // 更新導航 active
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`[data-view="${view}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // 更新標題
  updateHeader(view);

  // 關閉詳情面板
  closeDetail();

  // 建議面板隱藏
  document.getElementById('suggestions-panel').classList.add('hidden');

  // 渲染
  renderTaskList();
  updateCounts();

  // 手機版收合側邊欄
  if (window.innerWidth <= 700) {
    document.getElementById('sidebar').classList.add('collapsed');
  }
}

function updateHeader(view) {
  const titles = {
    myday: '☀️ 我的一天',
    important: '⭐ 重要',
    planned: '📅 已規劃',
    all: '📋 所有任務',
    completed: '✅ 已完成',
  };

  const list = Store.data.lists.find(l => l.id === view);
  const title = titles[view] || (list ? `📂 ${list.name}` : '📋 任務');
  document.getElementById('view-title').textContent = title;

  // 日期
  const dateEl = document.getElementById('view-date');
  if (view === 'myday') {
    const opts = { weekday: 'long', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('zh-TW', opts);
  } else {
    dateEl.textContent = '';
  }

  // 建議按鈕只在 "我的一天" 顯示
  document.getElementById('suggestions-btn').style.display = view === 'myday' ? '' : 'none';
}

function updateCounts() {
  const todayStr = formatDate(new Date());
  const tasks = Store.data.tasks;

  const countMyday = tasks.filter(t => !t.completed && t.myDay === todayStr).length;
  const countImportant = tasks.filter(t => !t.completed && t.important).length;
  const countPlanned = tasks.filter(t => !t.completed && t.dueDate).length;
  const countAll = tasks.filter(t => !t.completed).length;
  const countCompleted = tasks.filter(t => t.completed).length;

  document.getElementById('count-myday').textContent = countMyday || '';
  document.getElementById('count-important').textContent = countImportant || '';
  document.getElementById('count-planned').textContent = countPlanned || '';
  document.getElementById('count-all').textContent = countAll || '';
  document.getElementById('count-completed').textContent = countCompleted || '';
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  Store.data.settings.sidebarCollapsed = sidebar.classList.contains('collapsed');
  Store.save();
}

function toggleSuggestions() {
  const panel = document.getElementById('suggestions-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) renderSuggestions();
}

function renderSuggestions() {
  const container = document.getElementById('suggestions-list');
  container.innerHTML = '';
  const todayStr = formatDate(new Date());
  const suggestions = Store.data.tasks.filter(t =>
    !t.completed && t.myDay !== todayStr && (t.important || t.dueDate)
  ).slice(0, 10);

  if (suggestions.length === 0) {
    container.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;padding:8px;">目前沒有建議的任務</p>';
    return;
  }

  suggestions.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'suggestion-item';
    btn.innerHTML = `
      <span>${t.important ? '⭐' : '📋'}</span>
      <span style="flex:1">${escHtml(t.title)}</span>
      <span style="font-size:0.75rem;color:var(--text-dim)">${t.dueDate ? formatDateDisplay(t.dueDate) : ''}</span>
      <span style="color:var(--accent)">＋</span>
    `;
    btn.onclick = () => {
      Store.updateTask(t.id, { myDay: todayStr });
      renderSuggestions();
      renderAll();
      showToast(`已加入「我的一天」`);
    };
    container.appendChild(btn);
  });
}
