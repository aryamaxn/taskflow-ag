// ==========================================================
// TaskFlow — Frontend Engine (Dark Task Manager)
// ==========================================================

const API_BASE = '/api';
const TOKEN_KEY = 'taskflow_token';

// Application State
let currentUser = null;
let todos = [];

// Navigation & Filter State
// activeView: { type: 'smart'|'category'|'date', value: 'myday'|'upcoming'|'important'|'Personal'|... }
let activeView = { type: 'smart', value: 'myday' };
let currentFilter = 'all'; // 'all' | 'active' | 'completed'
let selectedCalendarDate = getTodayDateIso(); // 'YYYY-MM-DD'
let calendarCurrentMonth = new Date(); // Date object for calendar navigation
let weekStripOffset = 0; // week offset for upcoming week strip

// DOM Elements - Auth & Layout
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const nameModal = document.getElementById('nameModal');
const addTaskModal = document.getElementById('addTaskModal');
const mobileBottomTabs = document.getElementById('mobileBottomTabs');
const mobileOverviewSection = document.getElementById('mobileOverviewSection');
const weekStripSection = document.getElementById('weekStripSection');

// User Elements
const userNameGreeting = document.getElementById('userNameGreeting');
const sidebarUserName = document.getElementById('sidebarUserName');
const sidebarAvatar = document.getElementById('sidebarAvatar');
const mobileUserAvatar = document.getElementById('mobileUserAvatar');
const editNameBtn = document.getElementById('editNameBtn');
const logoutBtn = document.getElementById('logoutBtn');

// View Header Elements
const viewTitle = document.getElementById('viewTitle');
const viewSubtitle = document.getElementById('viewSubtitle');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const headerDateDisplay = document.getElementById('headerDateDisplay');
const filterStatusText = document.getElementById('filterStatusText');

// Task List & Counts
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const emptyTitle = document.getElementById('emptyTitle');
const emptyDesc = document.getElementById('emptyDesc');

// Filter Pills
const filterPills = document.querySelectorAll('.filter-pill');
const filterCountAll = document.getElementById('filterCountAll');
const filterCountActive = document.getElementById('filterCountActive');
const filterCountCompleted = document.getElementById('filterCountCompleted');

// Smart Cards & Category Tiles
const smartCards = document.querySelectorAll('.smart-card');
const categoryTiles = document.querySelectorAll('.category-tile');
const navItems = document.querySelectorAll('.nav-item');

// Counts Elements
const smartCountMyDay = document.getElementById('smartCountMyDay');
const smartCountUpcoming = document.getElementById('smartCountUpcoming');
const smartCountImportant = document.getElementById('smartCountImportant');
const countNavMyDay = document.getElementById('countNavMyDay');
const countNavUpcoming = document.getElementById('countNavUpcoming');
const countNavImportant = document.getElementById('countNavImportant');

const tileCountPersonal = document.getElementById('tileCountPersonal');
const tileCountWork = document.getElementById('tileCountWork');
const tileCountLearning = document.getElementById('tileCountLearning');
const tileCountShopping = document.getElementById('tileCountShopping');
const countNavPersonal = document.getElementById('countNavPersonal');
const countNavWork = document.getElementById('countNavWork');
const countNavLearning = document.getElementById('countNavLearning');
const countNavShopping = document.getElementById('countNavShopping');

// Desktop Form
const desktopTaskForm = document.getElementById('desktopTaskForm');
const desktopTaskInput = document.getElementById('desktopTaskInput');
const desktopCategorySelect = document.getElementById('desktopCategorySelect');
const desktopDueDateInput = document.getElementById('desktopDueDateInput');
const desktopImportantToggle = document.getElementById('desktopImportantToggle');
let desktopIsImportant = false;

// Modal Form
const modalTaskForm = document.getElementById('modalTaskForm');
const modalTaskInput = document.getElementById('modalTaskInput');
const modalDueDateInput = document.getElementById('modalDueDateInput');
const modalImportantInput = document.getElementById('modalImportantInput');
const closeAddTaskModalBtn = document.getElementById('closeAddTaskModalBtn');
const mobileFabBtn = document.getElementById('mobileFabBtn');

// Calendar & Progress Panel
const calMonthYear = document.getElementById('calMonthYear');
const calPrevMonthBtn = document.getElementById('calPrevMonthBtn');
const calNextMonthBtn = document.getElementById('calNextMonthBtn');
const calendarDaysGrid = document.getElementById('calendarDaysGrid');
const selectedDayLabel = document.getElementById('selectedDayLabel');
const selectedDayCount = document.getElementById('selectedDayCount');
const miniTaskList = document.getElementById('miniTaskList');
const panelPercentText = document.getElementById('panelPercentText');
const panelProgressFill = document.getElementById('panelProgressFill');
const panelProgressSub = document.getElementById('panelProgressSub');

// Week Strip
const weekMonthLabel = document.getElementById('weekMonthLabel');
const weekStrip = document.getElementById('weekStrip');
const prevWeekBtn = document.getElementById('prevWeekBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');

// Mobile Bottom Tabs
const bottomTabItems = document.querySelectorAll('.bottom-tab-item');

// ==========================================================
// Initialization
// ==========================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupFormattedDate();
  setDefaultFormDates();
  setupEventListeners();
  await checkAuthStatus();
});

function getTodayDateIso() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function setupFormattedDate() {
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  const formatted = new Date().toLocaleDateString(undefined, options);
  if (headerDateDisplay) {
    headerDateDisplay.textContent = formatted;
  }
}

function setDefaultFormDates() {
  const today = getTodayDateIso();
  if (desktopDueDateInput) desktopDueDateInput.value = today;
  if (modalDueDateInput) modalDueDateInput.value = today;
}

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

async function apiFetch(endpoint, options = {}) {
  const defaultHeaders = getAuthHeaders();
  const mergedHeaders = { ...defaultHeaders, ...(options.headers || {}) };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'same-origin',
    ...options,
    headers: mergedHeaders
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return res;
}

// ==========================================================
// Auth Handling
// ==========================================================
async function checkAuthStatus() {
  if (window.__INITIAL_USER__) {
    currentUser = window.__INITIAL_USER__;
    showDashboardView();
  }

  if (Array.isArray(window.__INITIAL_TODOS__)) {
    todos = window.__INITIAL_TODOS__;
    updateAllCounts();
    renderTasks();
    renderCalendar();
    renderWeekStrip();
  }

  try {
    const res = await apiFetch('/auth/me');
    const data = await res.json();
    currentUser = data.user;

    showDashboardView();
    await fetchTodos();
  } catch (err) {
    console.warn('Auth check failed:', err);
    window.location.href = '/login';
  }
}

function showAuthView() {
  window.location.href = '/login';
}

function showDashboardView() {
  if (authSection) authSection.style.display = 'none';
  if (dashboardSection) {
    dashboardSection.style.display = window.innerWidth >= 1100 ? 'flex' : 'block';
  }
  if (window.innerWidth < 1100) {
    if (mobileBottomTabs) mobileBottomTabs.style.display = 'grid';
    if (mobileFabBtn) mobileFabBtn.style.display = 'flex';
  } else {
    if (mobileBottomTabs) mobileBottomTabs.style.display = 'none';
    if (mobileFabBtn) mobileFabBtn.style.display = 'none';
  }
  updateUserDisplay();
}

function showNameModal() {
  nameModal.style.display = 'flex';
  const input = document.getElementById('userNameInput');
  if (input) {
    input.value = currentUser?.name || '';
    setTimeout(() => input.focus(), 100);
  }
}

function hideNameModal() {
  nameModal.style.display = 'none';
}

function updateUserDisplay() {
  if (!currentUser) return;
  const name = currentUser.name || 'Friend';
  const initial = name.charAt(0).toUpperCase();

  if (userNameGreeting) userNameGreeting.textContent = name;
  if (sidebarUserName) sidebarUserName.textContent = name;

  const renderAvatar = (el) => {
    if (!el) return;
    if (currentUser.picture) {
      el.innerHTML = `<img src="${escapeHtml(currentUser.picture)}" alt="${escapeHtml(name)}" class="avatar-img" referrerpolicy="no-referrer" onerror="this.onerror=null; this.parentElement.textContent='${initial}';" />`;
      el.classList.add('has-image');
    } else {
      el.textContent = initial;
      el.classList.remove('has-image');
    }
  };

  renderAvatar(sidebarAvatar);
  renderAvatar(mobileUserAvatar);
  renderAvatar(document.getElementById('modalUserAvatar'));

  const modalEmail = document.getElementById('modalUserEmail');
  if (modalEmail) {
    modalEmail.textContent = currentUser.email || 'Google Account';
  }
}

// ==========================================================
// Event Listeners
// ==========================================================
function setupEventListeners() {
  // Mobile avatar and modal triggers
  if (mobileUserAvatar) mobileUserAvatar.addEventListener('click', showNameModal);
  if (editNameBtn) editNameBtn.addEventListener('click', showNameModal);
  if (userNameGreeting) userNameGreeting.addEventListener('click', showNameModal);

  const closeNameModalBtn = document.getElementById('closeNameModalBtn');
  if (closeNameModalBtn) closeNameModalBtn.addEventListener('click', hideNameModal);

  // Sign out triggers (Desktop sidebar & Mobile profile modal)
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);

  // Set name form
  const setNameForm = document.getElementById('setNameForm');
  if (setNameForm) {
    setNameForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('userNameInput');
      const name = input.value.trim();
      if (!name) return;

      try {
        const res = await apiFetch('/auth/set-name', {
          method: 'POST',
          body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error('Failed to set name');

        const data = await res.json();
        currentUser = data.user;
        updateUserDisplay();
        hideNameModal();
      } catch (err) {
        console.error('Error saving name:', err);
        alert('Could not save name. Please try again.');
      }
    });
  }

  // Keyboard shortcut: Escape to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      nameModal.style.display = 'none';
      addTaskModal.style.display = 'none';
    }
  });

  // Desktop Add Task
  if (desktopImportantToggle) {
    desktopImportantToggle.addEventListener('click', () => {
      desktopIsImportant = !desktopIsImportant;
      desktopImportantToggle.classList.toggle('active', desktopIsImportant);
    });
  }

  if (desktopTaskForm) {
    desktopTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = desktopTaskInput.value.trim();
      if (!title) return;

      const category = desktopCategorySelect.value;
      const dueDate = desktopDueDateInput.value || getTodayDateIso();
      const important = desktopIsImportant;

      await createTodo({ title, category, dueDate, important });
      desktopTaskInput.value = '';
      desktopIsImportant = false;
      if (desktopImportantToggle) desktopImportantToggle.classList.remove('active');
    });
  }

  // Modal / Mobile Add Task
  if (mobileFabBtn) {
    mobileFabBtn.addEventListener('click', () => {
      addTaskModal.style.display = 'flex';
      setTimeout(() => modalTaskInput.focus(), 100);
    });
  }

  if (closeAddTaskModalBtn) {
    closeAddTaskModalBtn.addEventListener('click', () => {
      addTaskModal.style.display = 'none';
    });
  }

  if (modalTaskForm) {
    modalTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = modalTaskInput.value.trim();
      if (!title) return;

      const checkedCategory = document.querySelector('input[name="modalCategory"]:checked');
      const category = checkedCategory ? checkedCategory.value : 'Personal';
      const dueDate = modalDueDateInput.value || getTodayDateIso();
      const important = modalImportantInput.checked;

      await createTodo({ title, category, dueDate, important });
      modalTaskInput.value = '';
      modalImportantInput.checked = false;
      addTaskModal.style.display = 'none';
    });
  }

  // Smart Cards (Mobile/Tablet)
  smartCards.forEach(card => {
    card.addEventListener('click', () => {
      const view = card.dataset.view;
      setView('smart', view);
    });
  });

  // Sidebar Nav Items (Desktop)
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.dataset.view) {
        setView('smart', item.dataset.view);
      } else if (item.dataset.category) {
        setView('category', item.dataset.category);
      }
    });
  });

  // Category Tiles (Mobile/Tablet)
  categoryTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      const cat = tile.dataset.category;
      setView('category', cat);
    });
  });

  // Filter Pills (All, Active, Completed)
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');
      currentFilter = pill.dataset.filter;
      renderTasks();
    });
  });

  // Clear completed
  if (clearCompletedBtn) {
    clearCompletedBtn.addEventListener('click', async () => {
      try {
        const res = await apiFetch('/todos/clear-completed', {
          method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to clear completed tasks');

        todos = todos.filter(t => !t.completed);
        updateAllCounts();
        renderTasks();
        renderCalendar();
      } catch (err) {
        console.error('Error clearing tasks:', err);
      }
    });
  }

  // Calendar Month Navigation
  if (calPrevMonthBtn) {
    calPrevMonthBtn.addEventListener('click', () => {
      calendarCurrentMonth.setMonth(calendarCurrentMonth.getMonth() - 1);
      renderCalendar();
    });
  }
  if (calNextMonthBtn) {
    calNextMonthBtn.addEventListener('click', () => {
      calendarCurrentMonth.setMonth(calendarCurrentMonth.getMonth() + 1);
      renderCalendar();
    });
  }

  // Week Strip Navigation
  if (prevWeekBtn) {
    prevWeekBtn.addEventListener('click', () => {
      weekStripOffset -= 7;
      renderWeekStrip();
    });
  }
  if (nextWeekBtn) {
    nextWeekBtn.addEventListener('click', () => {
      weekStripOffset += 7;
      renderWeekStrip();
    });
  }

  // Mobile Bottom Tabs
  bottomTabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      bottomTabItems.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      if (target === 'home') {
        mobileOverviewSection.style.display = 'block';
        weekStripSection.style.display = 'none';
        setView('smart', 'myday');
      } else if (target === 'upcoming') {
        mobileOverviewSection.style.display = 'none';
        weekStripSection.style.display = 'block';
        setView('smart', 'upcoming');
      } else if (target === 'calendar') {
        const rightPanel = document.getElementById('rightPanel');
        if (rightPanel) {
          rightPanel.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (target === 'profile') {
        showNameModal();
      }
    });
  });

  // Responsive resize check
  window.addEventListener('resize', () => {
    if (!currentUser) return;
    if (window.innerWidth >= 1100) {
      dashboardSection.style.display = 'flex';
      if (mobileBottomTabs) mobileBottomTabs.style.display = 'none';
      if (mobileFabBtn) mobileFabBtn.style.display = 'none';
      if (mobileOverviewSection) mobileOverviewSection.style.display = 'none';
    } else {
      dashboardSection.style.display = 'block';
      if (mobileBottomTabs) mobileBottomTabs.style.display = 'grid';
      if (mobileFabBtn) mobileFabBtn.style.display = 'flex';
      const activeTabEl = document.querySelector('.bottom-tab-item.active');
      const activeTab = activeTabEl ? activeTabEl.dataset.tab : 'home';
      if (mobileOverviewSection) {
        mobileOverviewSection.style.display = activeTab === 'home' ? 'block' : 'none';
      }
    }
  });
}

// Switch Active View (Smart List or Category)
function setView(type, value) {
  activeView = { type, value };

  // Update titles
  if (type === 'smart') {
    viewSubtitle.textContent = 'SMART LIST';
    if (value === 'myday') viewTitle.textContent = 'My Day';
    else if (value === 'upcoming') viewTitle.textContent = 'Upcoming';
    else if (value === 'important') viewTitle.textContent = 'Important';

    // Show/hide week strip if upcoming
    if (value === 'upcoming') {
      weekStripSection.style.display = 'block';
      renderWeekStrip();
    } else {
      weekStripSection.style.display = 'none';
    }
  } else if (type === 'category') {
    viewSubtitle.textContent = 'CATEGORY';
    viewTitle.textContent = value;
    weekStripSection.style.display = 'none';
  } else if (type === 'date') {
    viewSubtitle.textContent = 'DATE VIEW';
    viewTitle.textContent = formatDateLabel(value);
    weekStripSection.style.display = 'none';
  }

  // Sync Active State across Sidebar and Mobile Cards
  smartCards.forEach(c => c.classList.toggle('active', type === 'smart' && c.dataset.view === value));
  categoryTiles.forEach(c => c.classList.toggle('active', type === 'category' && c.dataset.category === value));
  navItems.forEach(item => {
    if (type === 'smart') {
      item.classList.toggle('active', item.dataset.view === value);
    } else if (type === 'category') {
      item.classList.toggle('active', item.dataset.category === value);
    } else {
      item.classList.remove('active');
    }
  });

  renderTasks();
}

// ==========================================================
// To-Do CRUD
// ==========================================================
async function fetchTodos() {
  try {
    const res = await apiFetch('/todos');
    if (!res.ok) throw new Error('Failed to fetch tasks');

    todos = await res.json();
    updateAllCounts();
    renderTasks();
    renderCalendar();
    renderWeekStrip();
  } catch (err) {
    console.error('Error fetching todos:', err);
  }
}

async function createTodo(taskData) {
  try {
    const res = await apiFetch('/todos', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
    if (!res.ok) throw new Error('Failed to create task');

    const newTodo = await res.json();
    todos.unshift(newTodo);
    updateAllCounts();
    renderTasks();
    renderCalendar();
    renderWeekStrip();
  } catch (err) {
    console.error('Error adding task:', err);
    alert('Unable to add task. Please check server.');
  }
}

async function toggleTask(id, completed) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  const prev = todo.completed;
  todo.completed = completed;
  updateAllCounts();
  renderTasks();
  renderCalendar();

  try {
    const res = await apiFetch(`/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed })
    });
    if (!res.ok) throw new Error('Failed to toggle task');
  } catch (err) {
    console.error('Error toggling task:', err);
    todo.completed = prev;
    updateAllCounts();
    renderTasks();
    renderCalendar();
  }
}

async function toggleImportant(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  todo.important = !todo.important;
  updateAllCounts();
  renderTasks();

  try {
    const res = await apiFetch(`/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ important: todo.important })
    });
    if (!res.ok) throw new Error('Failed to update importance');
  } catch (err) {
    console.error('Error toggling importance:', err);
    todo.important = !todo.important;
    updateAllCounts();
    renderTasks();
  }
}

async function deleteTask(id) {
  const index = todos.findIndex(t => t.id === id);
  if (index === -1) return;
  const removed = todos.splice(index, 1)[0];
  updateAllCounts();
  renderTasks();
  renderCalendar();

  try {
    const res = await apiFetch(`/todos/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete task');
  } catch (err) {
    console.error('Error deleting task:', err);
    todos.splice(index, 0, removed);
    updateAllCounts();
    renderTasks();
    renderCalendar();
  }
}

// ==========================================================
// Counts & Metric Updates
// ==========================================================
function updateAllCounts() {
  const today = getTodayDateIso();

  // Smart lists counts (active tasks)
  const myDayActive = todos.filter(t => !t.completed && (t.dueDate === today || !t.dueDate)).length;
  const upcomingActive = todos.filter(t => !t.completed && t.dueDate && t.dueDate >= today).length;
  const importantActive = todos.filter(t => !t.completed && t.important).length;

  if (smartCountMyDay) smartCountMyDay.textContent = myDayActive;
  if (countNavMyDay) countNavMyDay.textContent = myDayActive;
  if (smartCountUpcoming) smartCountUpcoming.textContent = upcomingActive;
  if (countNavUpcoming) countNavUpcoming.textContent = upcomingActive;
  if (smartCountImportant) smartCountImportant.textContent = importantActive;
  if (countNavImportant) countNavImportant.textContent = importantActive;

  // Category counts (all tasks in that category)
  const cats = ['Personal', 'Work', 'Learning', 'Shopping'];
  cats.forEach(cat => {
    const total = todos.filter(t => (t.category || 'Personal') === cat).length;
    if (cat === 'Personal') {
      if (tileCountPersonal) tileCountPersonal.textContent = `${total} task${total === 1 ? '' : 's'}`;
      if (countNavPersonal) countNavPersonal.textContent = total;
    } else if (cat === 'Work') {
      if (tileCountWork) tileCountWork.textContent = `${total} task${total === 1 ? '' : 's'}`;
      if (countNavWork) countNavWork.textContent = total;
    } else if (cat === 'Learning') {
      if (tileCountLearning) tileCountLearning.textContent = `${total} task${total === 1 ? '' : 's'}`;
      if (countNavLearning) countNavLearning.textContent = total;
    } else if (cat === 'Shopping') {
      if (tileCountShopping) tileCountShopping.textContent = `${total} task${total === 1 ? '' : 's'}`;
      if (countNavShopping) countNavShopping.textContent = total;
    }
  });

  // Today's Progress in Right Panel
  const todayTasks = todos.filter(t => t.dueDate === today || !t.dueDate);
  const todayTotal = todayTasks.length;
  const todayDone = todayTasks.filter(t => t.completed).length;
  const todayPct = todayTotal === 0 ? 0 : Math.round((todayDone / todayTotal) * 100);

  if (panelPercentText) panelPercentText.textContent = `${todayPct}%`;
  if (panelProgressFill) panelProgressFill.style.width = `${todayPct}%`;
  if (panelProgressSub) panelProgressSub.textContent = `${todayDone} of ${todayTotal} tasks completed`;
}

// ==========================================================
// Render Tasks Grid (#8FB0F7 Cards)
// ==========================================================
function renderTasks() {
  const today = getTodayDateIso();

  // 1. Filter by Active View
  let filtered = todos.filter(todo => {
    if (activeView.type === 'smart') {
      if (activeView.value === 'myday') return todo.dueDate === today || !todo.dueDate;
      if (activeView.value === 'upcoming') return todo.dueDate && todo.dueDate >= today;
      if (activeView.value === 'important') return todo.important;
    } else if (activeView.type === 'category') {
      return (todo.category || 'Personal') === activeView.value;
    } else if (activeView.type === 'date') {
      return todo.dueDate === activeView.value;
    }
    return true;
  });

  // 2. Update Filter Badge Counts
  const totalInView = filtered.length;
  const activeInView = filtered.filter(t => !t.completed).length;
  const completedInView = totalInView - activeInView;

  if (filterCountAll) filterCountAll.textContent = totalInView;
  if (filterCountActive) filterCountActive.textContent = activeInView;
  if (filterCountCompleted) filterCountCompleted.textContent = completedInView;

  // 3. Filter by Tab (All, Active, Completed)
  if (currentFilter === 'active') {
    filtered = filtered.filter(t => !t.completed);
    filterStatusText.textContent = `Showing ${filtered.length} active task${filtered.length === 1 ? '' : 's'}`;
  } else if (currentFilter === 'completed') {
    filtered = filtered.filter(t => t.completed);
    filterStatusText.textContent = `Showing ${filtered.length} completed task${filtered.length === 1 ? '' : 's'}`;
  } else {
    filterStatusText.textContent = `Showing all ${filtered.length} tasks`;
  }

  // 4. Render Empty State or Cards
  if (filtered.length === 0) {
    taskList.innerHTML = '';
    emptyState.style.display = 'flex';
    if (currentFilter === 'completed') {
      emptyTitle.textContent = 'No completed tasks';
      emptyDesc.textContent = 'Check off tasks using the round checkbox to mark them done.';
    } else {
      emptyTitle.textContent = 'All clear!';
      emptyDesc.textContent = 'No tasks in this view. Enjoy staying in flow!';
    }
    return;
  }

  emptyState.style.display = 'none';

  taskList.innerHTML = filtered.map(todo => {
    const isCompleted = todo.completed;
    const isImportant = todo.important;
    const cat = todo.category || 'Personal';
    const catDotClass = `dot-${cat.toLowerCase()}`;
    const dateBadge = formatDueDateDisplay(todo.dueDate);

    return `
      <li class="task-card ${isCompleted ? 'completed' : ''}" data-id="${todo.id}">
        <div class="task-card-left">
          <!-- Round Checkbox -->
          <label class="round-checkbox" aria-label="Mark task ${isCompleted ? 'incomplete' : 'complete'}">
            <input 
              type="checkbox" 
              ${isCompleted ? 'checked' : ''} 
              onchange="toggleTask('${todo.id}', this.checked)"
            />
            <span class="round-checkmark">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </label>

          <!-- Task Title & Badges -->
          <div class="task-card-info">
            <div class="task-card-title">${escapeHtml(todo.title)}</div>
            <div class="task-card-meta">
              <!-- Small colored dot + category label -->
              <span class="task-category-badge">
                <span class="badge-dot ${catDotClass}"></span>
                <span>${cat}</span>
              </span>
              ${dateBadge ? `<span class="task-due-date">📅 ${dateBadge}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Actions: Important Star & Delete -->
        <div class="task-card-actions">
          <button 
            type="button" 
            class="btn-card-star ${isImportant ? 'active' : ''}" 
            onclick="toggleImportant('${todo.id}')"
            title="${isImportant ? 'Mark not important' : 'Mark as important'}"
            aria-label="Toggle importance"
          >
            ★
          </button>
          <button 
            type="button" 
            class="btn-card-delete" 
            onclick="deleteTask('${todo.id}')" 
            title="Delete task"
            aria-label="Delete task"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </li>
    `;
  }).join('');
}

// ==========================================================
// Right Panel Calendar Widget
// ==========================================================
function renderCalendar() {
  const year = calendarCurrentMonth.getFullYear();
  const month = calendarCurrentMonth.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (calMonthYear) calMonthYear.textContent = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const todayIso = getTodayDateIso();

  let html = '';

  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    html += `<div class="cal-day-cell other-month">${dayNum}</div>`;
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateIso = `${year}-${mStr}-${dStr}`;

    const isToday = dateIso === todayIso;
    const isSelected = dateIso === selectedCalendarDate;
    const hasTasks = todos.some(t => t.dueDate === dateIso);

    html += `
      <div 
        class="cal-day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasTasks ? 'has-tasks' : ''}"
        onclick="selectCalendarDate('${dateIso}')"
      >
        ${day}
      </div>
    `;
  }

  calendarDaysGrid.innerHTML = html;
  renderMiniDayTasks();
}

function selectCalendarDate(dateIso) {
  selectedCalendarDate = dateIso;
  renderCalendar();
  // Also filter view to this date!
  setView('date', dateIso);
}

function renderMiniDayTasks() {
  const dateIso = selectedCalendarDate;
  const dayTasks = todos.filter(t => t.dueDate === dateIso);

  if (selectedDayLabel) selectedDayLabel.textContent = `Tasks for ${formatDateLabel(dateIso)}`;
  if (selectedDayCount) selectedDayCount.textContent = dayTasks.length;

  if (dayTasks.length === 0) {
    miniTaskList.innerHTML = `<li class="mini-task-item" style="color:var(--text-muted); font-size:0.8rem;">No tasks scheduled</li>`;
    return;
  }

  miniTaskList.innerHTML = dayTasks.map(t => `
    <li class="mini-task-item ${t.completed ? 'done' : ''}">
      <span class="cat-dot dot-${(t.category || 'personal').toLowerCase()}"></span>
      <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(t.title)}</span>
    </li>
  `).join('');
}

// ==========================================================
// Horizontal Week Strip (Upcoming View)
// ==========================================================
function renderWeekStrip() {
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekStripOffset);

  // Find Monday of this week
  const dayOfWeek = baseDate.getDay();
  const diff = baseDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(baseDate.setDate(diff));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  if (weekMonthLabel) {
    weekMonthLabel.textContent = `${monthNames[monday.getMonth()]} ${monday.getFullYear()}`;
  }

  const daysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let stripHtml = '';

  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    const iso = current.toISOString().split('T')[0];
    const isSelected = iso === selectedCalendarDate;

    stripHtml += `
      <div 
        class="week-day-pill ${isSelected ? 'active' : ''}" 
        onclick="selectCalendarDate('${iso}')"
      >
        <span class="week-day-name">${daysShort[i]}</span>
        <span class="week-day-num">${current.getDate()}</span>
      </div>
    `;
  }

  if (weekStrip) weekStrip.innerHTML = stripHtml;
}

// ==========================================================
// Helpers
// ==========================================================
function formatDueDateDisplay(dueDateIso) {
  if (!dueDateIso) return '';
  const today = getTodayDateIso();
  if (dueDateIso === today) return 'Today';

  const d = new Date(dueDateIso + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  const diffDays = Math.round((d - t) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDateLabel(dateIso) {
  if (!dateIso) return 'Today';
  const today = getTodayDateIso();
  if (dateIso === today) return 'Today';
  const d = new Date(dateIso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin'
    });
  } catch (e) {
    console.warn('Logout error:', e);
  }
  localStorage.removeItem(TOKEN_KEY);
  currentUser = null;
  todos = [];
  window.location.href = '/login';
}

