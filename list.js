/**
 * list.js — 自訂清單管理
 */

function renderCustomLists() {
  const container = document.getElementById('custom-lists');
  container.innerHTML = '';
  const view = Store.data.settings.currentView;

  Store.data.lists.forEach(list => {
    const count = Store.data.tasks.filter(t => !t.completed && t.listId === list.id).length;
    const wrapper = document.createElement('div');
    wrapper.className = 'list-item-wrapper';
    wrapper.innerHTML = `
      <button class="nav-item ${view === list.id ? 'active' : ''}" data-view="${list.id}">
        <span class="nav-icon"><span class="list-color-dot" style="background:${list.color || 'var(--accent)'}"></span></span>
        <span class="nav-label">${escHtml(list.name)}</span>
        <span class="nav-count">${count || ''}</span>
      </button>
      <div class="list-actions">
        <button class="list-action-btn" data-edit="${list.id}" title="重新命名">✏️</button>
        <button class="list-action-btn" data-delete="${list.id}" title="刪除清單">🗑️</button>
      </div>
    `;

    wrapper.querySelector('.nav-item').addEventListener('click', () => switchView(list.id));
    wrapper.querySelector('[data-edit]').addEventListener('click', (e) => {
      e.stopPropagation();
      renameList(list.id);
    });
    wrapper.querySelector('[data-delete]').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteList(list.id);
    });

    container.appendChild(wrapper);
  });
}

function addNewList() {
  const name = prompt('清單名稱：');
  if (!name || !name.trim()) return;

  const colors = ['#4A90D9', '#E74C3C', '#F39C12', '#27AE60', '#8E44AD'];
  const color = colors[Store.data.lists.length % colors.length];

  const list = {
    id: generateId(),
    name: name.trim(),
    color,
    createdAt: new Date().toISOString(),
  };
  Store.addList(list);
  switchView(list.id);
  renderAll();
}

function renameList(id) {
  const list = Store.data.lists.find(l => l.id === id);
  if (!list) return;
  const name = prompt('重新命名清單：', list.name);
  if (name && name.trim()) {
    Store.updateList(id, { name: name.trim() });
    renderAll();
  }
}

function deleteList(id) {
  const list = Store.data.lists.find(l => l.id === id);
  if (!list) return;
  if (!confirm(`確定要刪除「${list.name}」清單嗎？\n清單中的所有任務也會被刪除。`)) return;
  Store.deleteList(id);
  if (Store.data.settings.currentView === id) switchView('myday');
  renderAll();
  showToast(`清單「${list.name}」已刪除`);
}
