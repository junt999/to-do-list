/**
 * search.js — 搜尋功能
 */

let searchTimeout = null;

function initSearch() {
  const input = document.getElementById('search-input');
  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = input.value.trim().toLowerCase();
      if (query) {
        renderSearchResults(query);
      } else {
        renderTaskList();
      }
    }, 200);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      renderTaskList();
    }
  });
}

function renderSearchResults(query) {
  const tasks = Store.data.tasks.filter(t => {
    const titleMatch = t.title.toLowerCase().includes(query);
    const noteMatch = (t.notes || '').toLowerCase().includes(query);
    const stepMatch = (t.steps || []).some(s => s.title.toLowerCase().includes(query));
    return titleMatch || noteMatch || stepMatch;
  });

  const taskListEl = document.getElementById('task-list');
  const completedSection = document.getElementById('completed-section');
  const emptyState = document.getElementById('empty-state');

  taskListEl.innerHTML = '';
  completedSection.classList.add('hidden');

  if (tasks.length === 0) {
    emptyState.classList.remove('hidden');
    document.getElementById('empty-icon').textContent = '🔍';
    document.getElementById('empty-title').textContent = '找不到結果';
    document.getElementById('empty-desc').textContent = `找不到「${query}」相關的任務`;
    return;
  }

  emptyState.classList.add('hidden');
  document.getElementById('view-title').textContent = `🔍 搜尋「${query}」（${tasks.length} 筆）`;
  tasks.forEach(t => taskListEl.appendChild(createTaskCard(t)));
}
