// ============================================================
// AI生活管家 · LifeMate — 交互逻辑
// ============================================================

// ── Storage Keys ────────────────────────────────────────────
const KEYS = {
  events: 'lifemate_events',
  habits: 'lifemate_habits',
  transactions: 'lifemate_transactions',
  theme: 'lifemate_theme',
};

// ── Global State ────────────────────────────────────────────
const state = {
  events: [],
  habits: [],
  transactions: [],
  theme: 'light',
  currentTab: 'dashboard',
  calendarView: 'month',   // month | week | day
  calendarDate: new Date(),
  selectedDate: null,
  editingEventId: null,
  editingHabitId: null,
  editingTransactionId: null,
  transactionFilter: 'all',
};

// ── Helpers ─────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const dateStr = (d) => d.toISOString().split('T')[0];
const todayStr = () => dateStr(new Date());
const fmtDateCN = (d) => d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
const fmtShortDate = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
const fmtMonthYear = (d) => `${d.getFullYear()}年${d.getMonth() + 1}月`;
const fmtAmount = (n) => '¥' + Number(n || 0).toFixed(2);

const CAT_ICONS = {
  '餐饮':'🍜','交通':'🚗','购物':'🛍️','娱乐':'🎮',
  '住房':'🏠','医疗':'💊','教育':'📚','收入':'💵','其他':'📦',
};
const WEEKDAYS = ['一','二','三','四','五','六','日'];

// ── Data Persistence ────────────────────────────────────────
function loadData() {
  try {
    state.events = JSON.parse(localStorage.getItem(KEYS.events)) || [];
    state.habits = JSON.parse(localStorage.getItem(KEYS.habits)) || [];
    state.transactions = JSON.parse(localStorage.getItem(KEYS.transactions)) || [];
    state.theme = localStorage.getItem(KEYS.theme) || 'light';
  } catch (e) {
    state.events = []; state.habits = []; state.transactions = [];
    state.theme = 'light';
  }
}

function saveEvents() { localStorage.setItem(KEYS.events, JSON.stringify(state.events)); }
function saveHabits() { localStorage.setItem(KEYS.habits, JSON.stringify(state.habits)); }
function saveTransactions() { localStorage.setItem(KEYS.transactions, JSON.stringify(state.transactions)); }
function saveTheme() { localStorage.setItem(KEYS.theme, state.theme); }

// ── Toast ───────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s ease'; }, 2500);
  setTimeout(() => el.remove(), 2800);
}

// ── Theme ───────────────────────────────────────────────────
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const icon = document.querySelector('#themeToggle .theme-icon');
  const label = document.querySelector('#themeToggle .theme-label');
  if (icon) icon.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  if (label) label.textContent = state.theme === 'dark' ? '亮色模式' : '暗色模式';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveTheme();
  applyTheme();
  refreshCurrentTab();
}

// ── Navigation ──────────────────────────────────────────────
function switchTab(tab) {
  state.currentTab = tab;
  // Nav items
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  // Tab panels
  document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
  // Mobile sidebar
  const sidebar = document.getElementById('sidebar');
  if (sidebar && window.innerWidth <= 768) sidebar.classList.remove('open');
  refreshCurrentTab();
}

function refreshCurrentTab() {
  switch (state.currentTab) {
    case 'dashboard': renderDashboard(); break;
    case 'schedule': renderCalendar(); break;
    case 'habits': renderHabits(); break;
    case 'finance': renderFinance(); break;
    case 'report': renderReport(); break;
  }
}

// ── Dashboard ───────────────────────────────────────────────
function renderDashboard() {
  const now = new Date();
  document.getElementById('dashboardDate').textContent = fmtDateCN(now);
  const today = todayStr();

  // Today's events
  const todayEvents = state.events.filter(e => e.date === today).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  document.getElementById('todayEventCount').textContent = todayEvents.length;

  const todayEventsContainer = document.getElementById('todayEvents');
  if (todayEvents.length === 0) {
    todayEventsContainer.innerHTML = '<div class="empty-state"><span class="empty-icon">🎉</span><p>今天没有安排，享受自由时光！</p></div>';
  } else {
    todayEventsContainer.innerHTML = todayEvents.map(e => `
      <div class="event-item" onclick="editEventById('${e.id}')">
        <span class="event-dot" style="background:${e.color || '#FF6B6B'}"></span>
        <span class="event-time">${e.time || '全天'}</span>
        <span class="event-title-text">${escHtml(e.title)}</span>
        <span class="event-type-badge">${e.type || ''}</span>
      </div>
    `).join('');
  }

  // Habit progress
  const totalHabits = state.habits.length;
  document.getElementById('todayHabitTotal').textContent = totalHabits;
  let doneCount = 0;
  state.habits.forEach(h => { if (h.checkins && h.checkins[today]) doneCount++; });
  document.getElementById('todayHabitDone').textContent = doneCount;

  // Month balance
  const monthKey = dateStr(now).slice(0, 7);
  const monthTxns = state.transactions.filter(t => t.date.startsWith(monthKey));
  const income = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  document.getElementById('monthBalance').textContent = fmtAmount(income - expense);

  // Habit mini list
  const habitMiniList = document.getElementById('habitMiniList');
  if (state.habits.length === 0) {
    habitMiniList.innerHTML = '<div class="empty-state" style="padding:20px"><p>还没有习惯，去添加吧！</p></div>';
  } else {
    habitMiniList.innerHTML = state.habits.map(h => {
      const checkedToday = h.checkins && h.checkins[today];
      const streak = calcStreak(h, today);
      const weekCheckins = state.habits.length ? getWeekCheckinCount(h) : 0;
      const goal = h.goal || 5;
      const pct = Math.min(100, Math.round(weekCheckins / goal * 100));
      return `
        <div class="habit-mini-item">
          <span class="habit-mini-emoji">${h.emoji || '📌'}</span>
          <div class="habit-mini-info">
            <div class="habit-mini-name">${escHtml(h.name)}</div>
            <div class="habit-mini-streak">🔥 ${streak} 天 | 本周 ${weekCheckins}/${goal}</div>
          </div>
          <div class="habit-mini-progress">
            <div class="habit-mini-bar" style="width:${pct}%;background:${h.color || '#4ECDC4'}"></div>
          </div>
          <button class="habit-mini-check ${checkedToday ? 'done' : ''}" onclick="event.stopPropagation();toggleHabitCheck('${h.id}')">
            ${checkedToday ? '✓' : '打卡'}
          </button>
        </div>
      `;
    }).join('');
  }
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function calcStreak(habit, fromDate) {
  if (!habit.checkins) return 0;
  let streak = 0;
  const d = new Date(fromDate + 'T00:00:00');
  while (true) {
    const ds = dateStr(d);
    if (habit.checkins[ds]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getWeekCheckinCount(habit) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (habit.checkins && habit.checkins[dateStr(d)]) count++;
  }
  return count;
}

function toggleHabitCheck(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;
  if (!habit.checkins) habit.checkins = {};
  const today = todayStr();
  if (habit.checkins[today]) {
    delete habit.checkins[today];
  } else {
    habit.checkins[today] = true;
  }
  saveHabits();
  renderDashboard();
  renderHabits();
}

// ── Calendar ────────────────────────────────────────────────
function renderCalendar() {
  const view = state.calendarView;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

  const grid = document.getElementById('calendarGrid');
  const title = document.getElementById('calTitle');

  if (view === 'month') renderMonthView(grid, title);
  else if (view === 'week') renderWeekView(grid, title);
  else if (view === 'day') renderDayView(grid, title);

  // Show events for selected date
  renderDayEvents();
}

function renderMonthView(grid, title) {
  const cd = state.calendarDate;
  const year = cd.getFullYear();
  const month = cd.getMonth();

  title.textContent = fmtMonthYear(cd);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();

  // Monday = 0
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const today = todayStr();
  const selected = state.selectedDate;

  let html = '<div class="cal-weekday">一</div><div class="cal-weekday">二</div><div class="cal-weekday">三</div>';
  html += '<div class="cal-weekday">四</div><div class="cal-weekday">五</div><div class="cal-weekday">六</div><div class="cal-weekday">日</div>';

  // Previous month padding
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLast - i;
    html += `<div class="cal-day other-month" data-date="${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}"><span>${d}</span></div>`;
  }

  for (let d = 1; d <= totalDays; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    let cls = 'cal-day';
    if (ds === today) cls += ' today';
    if (ds === selected) cls += ' selected';
    const dayEvents = state.events.filter(e => e.date === ds);
    let dots = '';
    if (dayEvents.length > 0) {
      const maxDots = 3;
      dots = '<span class="cal-day-dots">' +
        dayEvents.slice(0, maxDots).map(e => `<span class="cal-day-dot" style="background:${e.color || '#FF6B6B'}"></span>`).join('') +
        (dayEvents.length > maxDots ? `<span class="cal-day-dot" style="background:#999"></span>` : '') +
        '</span>';
    }
    html += `<div class="${cls}" data-date="${ds}"><span>${d}</span>${dots}</div>`;
  }

  // Next month padding to fill row
  const remaining = 42 - startDow - totalDays; // 6 rows * 7
  const totalCells = startDow + totalDays;
  const nextPad = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= nextPad; d++) {
    html += `<div class="cal-day other-month"><span>${d}</span></div>`;
  }

  grid.innerHTML = html;
}

function renderWeekView(grid, title) {
  const cd = state.calendarDate;
  const day = cd.getDay();
  const monday = new Date(cd);
  monday.setDate(cd.getDate() - (day === 0 ? 6 : day - 1));

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const m = monday.getMonth(), s = sunday.getMonth();
  if (m === s) {
    title.textContent = `${monday.getFullYear()}年${m + 1}月 — 第${Math.ceil(monday.getDate() / 7)}周`;
  } else {
    title.textContent = `${m + 1}月/${s + 1}月 — 一周`;
  }

  const today = todayStr();
  const selected = state.selectedDate;

  let html = '';
  for (let i = 0; i < 7; i++) {
    html += `<div class="cal-weekday">${WEEKDAYS[i]}</div>`;
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = dateStr(d);
    let cls = 'cal-day';
    if (ds === today) cls += ' today';
    if (ds === selected) cls += ' selected';
    const dayEvents = state.events.filter(e => e.date === ds);
    let content = `<span>${d.getDate()}</span>`;
    if (dayEvents.length > 0) {
      content += '<div style="margin-top:2px;font-size:9px;line-height:1.3;overflow:hidden">' +
        dayEvents.slice(0, 2).map(e => `<div style="color:${e.color};white-space:nowrap">${escHtml(e.title).slice(0, 4)}</div>`).join('') +
        (dayEvents.length > 2 ? '<div style="color:#999">...</div>' : '') +
        '</div>';
    }
    html += `<div class="${cls}" data-date="${ds}">${content}</div>`;
  }

  grid.innerHTML = html;
}

function renderDayView(grid, title) {
  const cd = state.calendarDate;
  title.textContent = fmtDateCN(cd);

  const today = todayStr();
  const ds = dateStr(cd);
  const selected = state.selectedDate;

  let html = '<div class="cal-weekday">日期</div>';
  let cls = 'cal-day';
  if (ds === today) cls += ' today';
  if (ds === selected) cls += ' selected';
  html += `<div class="${cls}" style="grid-column:span 6" data-date="${ds}"><span>${fmtDateCN(cd)}</span></div>`;

  grid.innerHTML = html;
}

function renderDayEvents() {
  const panel = document.getElementById('dayEventsPanel');
  const sel = state.selectedDate;
  if (!sel) {
    panel.innerHTML = '<div class="empty-state"><span class="empty-icon">📅</span><p>点击日历上的日期查看当天事件</p></div>';
    return;
  }
  const dayEvents = state.events.filter(e => e.date === sel).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  if (dayEvents.length === 0) {
    panel.innerHTML = `
      <div class="day-events-header">
        <span class="day-events-title">${sel} · 无事件</span>
        <button class="btn btn-primary btn-sm" onclick="openEventModal('${sel}')">+ 添加</button>
      </div>
      <div class="empty-state" style="padding:20px"><span class="empty-icon">☀️</span><p>这一天没有安排</p></div>`;
    return;
  }
  panel.innerHTML = `
    <div class="day-events-header">
      <span class="day-events-title">${sel} · ${dayEvents.length} 个事件</span>
      <button class="btn btn-primary btn-sm" onclick="openEventModal('${sel}')">+ 添加</button>
    </div>
    ${dayEvents.map(e => `
      <div class="day-event-item" onclick="editEventById('${e.id}')">
        <span class="event-dot" style="background:${e.color || '#FF6B6B'}"></span>
        <span class="event-time">${e.time || '全天'}</span>
        <span class="event-title-text">${escHtml(e.title)}</span>
        <span class="event-type-badge">${e.type || ''}</span>
      </div>
    `).join('')}`;
}

function navigateCalendar(dir) {
  const cd = state.calendarDate;
  if (state.calendarView === 'month') {
    state.calendarDate = new Date(cd.getFullYear(), cd.getMonth() + dir, 1);
  } else if (state.calendarView === 'week') {
    state.calendarDate = new Date(cd);
    state.calendarDate.setDate(cd.getDate() + dir * 7);
  } else {
    state.calendarDate = new Date(cd);
    state.calendarDate.setDate(cd.getDate() + dir);
  }
  renderCalendar();
  renderDayEvents();
}

function goToToday() {
  state.calendarDate = new Date();
  state.selectedDate = todayStr();
  renderCalendar();
  renderDayEvents();
}

function selectCalendarDate(date) {
  state.selectedDate = date;
  renderCalendar();
  renderDayEvents();
}

// ── Event CRUD ──────────────────────────────────────────────
function openEventModal(presetDate) {
  state.editingEventId = null;
  const d = presetDate || todayStr();
  document.getElementById('eventModalTitle').textContent = '新建事件';
  document.getElementById('eventTitle').value = '';
  document.getElementById('eventDate').value = d;
  document.getElementById('eventTime').value = '';
  document.getElementById('eventType').value = '工作';
  document.getElementById('eventNote').value = '';
  document.getElementById('eventId').value = '';
  document.getElementById('eventDeleteBtn').style.display = 'none';
  resetColorPicker('eventColorPicker');
  document.getElementById('eventModal').classList.add('show');
}

function editEventById(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  state.editingEventId = id;
  document.getElementById('eventModalTitle').textContent = '编辑事件';
  document.getElementById('eventTitle').value = ev.title || '';
  document.getElementById('eventDate').value = ev.date || '';
  document.getElementById('eventTime').value = ev.time || '';
  document.getElementById('eventType').value = ev.type || '工作';
  document.getElementById('eventNote').value = ev.note || '';
  document.getElementById('eventId').value = id;
  document.getElementById('eventDeleteBtn').style.display = 'inline-flex';
  setColorPicker('eventColorPicker', ev.color || '#FF6B6B');
  document.getElementById('eventModal').classList.add('show');
}

function closeEventModal() {
  document.getElementById('eventModal').classList.remove('show');
  state.editingEventId = null;
}

function saveEvent() {
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  const time = document.getElementById('eventTime').value;
  const type = document.getElementById('eventType').value;
  const note = document.getElementById('eventNote').value.trim();
  const color = getActiveColor('eventColorPicker') || '#FF6B6B';
  const id = state.editingEventId || uid();

  if (!title) { showToast('请输入事件标题', 'error'); return; }
  if (!date) { showToast('请选择日期', 'error'); return; }

  if (state.editingEventId) {
    const idx = state.events.findIndex(e => e.id === state.editingEventId);
    if (idx >= 0) {
      state.events[idx] = { ...state.events[idx], title, date, time, type, note, color };
    }
  } else {
    state.events.push({ id, title, date, time, type, color, note });
  }

  saveEvents();
  closeEventModal();
  showToast('事件已保存 👍', 'success');
  refreshCurrentTab();
}

function deleteEvent() {
  const id = state.editingEventId;
  if (!id) return;
  if (!confirm('确定删除这个事件吗？')) return;
  state.events = state.events.filter(e => e.id !== id);
  saveEvents();
  closeEventModal();
  showToast('事件已删除', 'info');
  refreshCurrentTab();
}

// ── Habit CRUD ──────────────────────────────────────────────
function openHabitModal() {
  state.editingHabitId = null;
  document.getElementById('habitModalTitle').textContent = '新建习惯';
  document.getElementById('habitName').value = '';
  document.getElementById('habitId').value = '';
  document.getElementById('habitDeleteBtn').style.display = 'none';
  resetEmojiPicker();
  resetGoalSelector();
  resetColorPicker('habitColorPicker');
  document.getElementById('habitModal').classList.add('show');
}

function editHabitById(id) {
  const h = state.habits.find(hh => hh.id === id);
  if (!h) return;
  state.editingHabitId = id;
  document.getElementById('habitModalTitle').textContent = '编辑习惯';
  document.getElementById('habitName').value = h.name || '';
  document.getElementById('habitId').value = id;
  document.getElementById('habitDeleteBtn').style.display = 'inline-flex';
  setEmojiPicker(h.emoji || '📚');
  setGoalSelector(h.goal || 5);
  setColorPicker('habitColorPicker', h.color || '#FF6B6B');
  document.getElementById('habitModal').classList.add('show');
}

function closeHabitModal() {
  document.getElementById('habitModal').classList.remove('show');
  state.editingHabitId = null;
}

function saveHabit() {
  const name = document.getElementById('habitName').value.trim();
  const emoji = getActiveEmoji() || '📚';
  const goal = getActiveGoal() || 5;
  const color = getActiveColor('habitColorPicker') || '#FF6B6B';
  const id = state.editingHabitId || uid();

  if (!name) { showToast('请输入习惯名称', 'error'); return; }

  if (state.editingHabitId) {
    const idx = state.habits.findIndex(h => h.id === state.editingHabitId);
    if (idx >= 0) {
      state.habits[idx] = { ...state.habits[idx], name, emoji, goal, color };
    }
  } else {
    state.habits.push({ id, name, emoji, goal, color, checkins: {} });
  }

  saveHabits();
  closeHabitModal();
  showToast('习惯已保存 👍', 'success');
  refreshCurrentTab();
}

function deleteHabit() {
  const id = state.editingHabitId;
  if (!id) return;
  if (!confirm('确定删除这个习惯吗？所有打卡记录也会被删除。')) return;
  state.habits = state.habits.filter(h => h.id !== id);
  saveHabits();
  closeHabitModal();
  showToast('习惯已删除', 'info');
  refreshCurrentTab();
}

// ── Render Habits ───────────────────────────────────────────
function renderHabits() {
  const grid = document.getElementById('habitsGrid');
  if (state.habits.length === 0) {
    grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🌱</span><p>还没有习惯，点击上方按钮添加吧！</p></div>';
    document.getElementById('habitHeatmapSection').style.display = 'none';
    return;
  }

  const today = todayStr();
  grid.innerHTML = state.habits.map(h => {
    const checkedToday = h.checkins && h.checkins[today];
    const streak = calcStreak(h, today);
    const weekCount = getWeekCheckinCount(h);
    const goal = h.goal || 5;
    const pct = Math.min(100, Math.round(weekCount / goal * 100));
    return `
      <div class="habit-card">
        <div class="habit-card-header">
          <span class="habit-card-emoji">${h.emoji || '📌'}</span>
          <span class="habit-card-goal">目标 ${goal}天/周</span>
        </div>
        <div class="habit-card-name">${escHtml(h.name)}</div>
        <div class="habit-card-streak">🔥 连续 ${streak} 天</div>
        <div class="habit-progress-bar">
          <div class="habit-progress-fill" style="width:${pct}%;background:${h.color || '#4ECDC4'}"></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">本周 ${weekCount}/${goal}</div>
        <button class="habit-check-btn ${checkedToday ? 'done' : ''}" onclick="toggleHabitCheck('${h.id}')">
          ${checkedToday ? '✓ 今日已打卡' : '打卡签到'}
        </button>
        <div class="habit-card-actions">
          <button class="habit-edit-btn" onclick="event.stopPropagation();editHabitById('${h.id}')">✏️ 编辑</button>
        </div>
      </div>
    `;
  }).join('');

  // Heatmap for first habit
  if (state.habits.length > 0) {
    renderHabitHeatmap(state.habits[0]);
    document.getElementById('habitHeatmapSection').style.display = 'block';
  }
}

function renderHabitHeatmap(habit) {
  const container = document.getElementById('habitHeatmap');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = '';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const checked = habit.checkins && habit.checkins[ds];
    const color = checked ? (habit.color || '#4ECDC4') : '#e0e0e0';
    html += `<span class="heatmap-day" style="background:${color};${!checked ? 'opacity:0.3' : ''}" title="${ds}"></span>`;
  }
  container.innerHTML = html;
}

// ── Emoji / Color / Goal pickers ────────────────────────────
function resetEmojiPicker() {
  document.querySelectorAll('#emojiPicker .emoji-option').forEach((el, i) => {
    el.classList.toggle('active', i === 0);
  });
}
function getActiveEmoji() {
  const el = document.querySelector('#emojiPicker .emoji-option.active');
  return el ? el.dataset.emoji : null;
}
function setEmojiPicker(emoji) {
  document.querySelectorAll('#emojiPicker .emoji-option').forEach(el => {
    el.classList.toggle('active', el.dataset.emoji === emoji);
  });
}

function resetGoalSelector() {
  document.querySelectorAll('#habitModal .goal-btn').forEach((el, i) => {
    el.classList.toggle('active', i === 1); // default 5
  });
}
function getActiveGoal() {
  const el = document.querySelector('#habitModal .goal-btn.active');
  return el ? parseInt(el.dataset.goal) : 5;
}
function setGoalSelector(goal) {
  document.querySelectorAll('#habitModal .goal-btn').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.goal) === goal);
  });
}

function resetColorPicker(pickerId) {
  document.querySelectorAll(`#${pickerId} .color-dot`).forEach((el, i) => {
    el.classList.toggle('active', i === 0);
  });
}
function getActiveColor(pickerId) {
  const el = document.querySelector(`#${pickerId} .color-dot.active`);
  return el ? el.dataset.color : null;
}
function setColorPicker(pickerId, color) {
  document.querySelectorAll(`#${pickerId} .color-dot`).forEach(el => {
    el.classList.toggle('active', el.dataset.color === color);
  });
}

// ── Transaction CRUD ────────────────────────────────────────
function openTransactionModal() {
  state.editingTransactionId = null;
  document.getElementById('transactionModalTitle').textContent = '记一笔';
  document.getElementById('transactionAmount').value = '';
  document.getElementById('transactionDate').value = todayStr();
  document.getElementById('transactionNote').value = '';
  document.getElementById('transactionId').value = '';
  document.getElementById('transactionDeleteBtn').style.display = 'none';
  document.getElementById('transactionType').value = 'expense';
  resetTypeSwitch('expense');
  resetCategoryChips();
  document.getElementById('transactionModal').classList.add('show');
}

function editTransactionById(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  state.editingTransactionId = id;
  document.getElementById('transactionModalTitle').textContent = '编辑记录';
  document.getElementById('transactionAmount').value = tx.amount;
  document.getElementById('transactionDate').value = tx.date;
  document.getElementById('transactionNote').value = tx.note || '';
  document.getElementById('transactionId').value = id;
  document.getElementById('transactionDeleteBtn').style.display = 'inline-flex';
  document.getElementById('transactionType').value = tx.type;
  resetTypeSwitch(tx.type);
  resetCategoryChips();
  if (tx.type === 'expense') setCategoryChip(tx.category);
  document.getElementById('transactionModal').classList.add('show');
}

function closeTransactionModal() {
  document.getElementById('transactionModal').classList.remove('show');
  state.editingTransactionId = null;
}

function saveTransaction() {
  const amount = parseFloat(document.getElementById('transactionAmount').value);
  const date = document.getElementById('transactionDate').value;
  const note = document.getElementById('transactionNote').value.trim();
  const type = document.getElementById('transactionType').value;
  const catEl = document.querySelector('#categoryGrid .cat-chip.active');
  let category = catEl ? catEl.dataset.cat : '其他';

  if (type === 'income') category = '收入';

  if (!amount || amount <= 0) { showToast('请输入有效金额', 'error'); return; }
  if (!date) { showToast('请选择日期', 'error'); return; }

  if (state.editingTransactionId) {
    const idx = state.transactions.findIndex(t => t.id === state.editingTransactionId);
    if (idx >= 0) {
      state.transactions[idx] = { ...state.transactions[idx], amount, date, note, type, category };
    }
  } else {
    state.transactions.push({ id: uid(), amount, date, note, type, category });
  }

  saveTransactions();
  closeTransactionModal();
  showToast('记录已保存 👍', 'success');
  refreshCurrentTab();
}

function deleteTransaction() {
  const id = state.editingTransactionId;
  if (!id) return;
  if (!confirm('确定删除这条记录吗？')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveTransactions();
  closeTransactionModal();
  showToast('记录已删除', 'info');
  refreshCurrentTab();
}

function resetTypeSwitch(type) {
  document.querySelectorAll('#transactionModal .type-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.type === type);
  });
  document.getElementById('categoryGrid').style.display = type === 'income' ? 'none' : 'grid';
}

function resetCategoryChips() {
  document.querySelectorAll('#categoryGrid .cat-chip').forEach((el, i) => {
    el.classList.toggle('active', i === 0);
  });
}
function setCategoryChip(cat) {
  document.querySelectorAll('#categoryGrid .cat-chip').forEach(el => {
    el.classList.toggle('active', el.dataset.cat === cat);
  });
}

// ── Render Finance ──────────────────────────────────────────
function renderFinance() {
  const now = new Date();
  const monthKey = dateStr(now).slice(0, 7);
  const allTxns = state.transactions;
  const monthTxns = allTxns.filter(t => t.date.startsWith(monthKey));

  const income = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  document.getElementById('monthIncome').textContent = fmtAmount(income);
  document.getElementById('monthExpense').textContent = fmtAmount(expense);
  document.getElementById('monthBalance2').textContent = fmtAmount(income - expense);

  // Filtered transactions
  const filter = state.transactionFilter;
  let filtered = monthTxns;
  if (filter !== 'all') {
    filtered = monthTxns.filter(t => t.category === filter);
  }
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  const list = document.getElementById('transactionList');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">💳</span><p>暂无记录</p></div>';
  } else {
    list.innerHTML = filtered.map(t => {
      const isIncome = t.type === 'income';
      const catIcon = CAT_ICONS[t.category] || '📦';
      return `
        <div class="transaction-item" onclick="editTransactionById('${t.id}')">
          <span class="transaction-cat-icon">${catIcon}</span>
          <div class="transaction-info">
            <div class="transaction-cat">${t.category}</div>
            ${t.note ? `<div class="transaction-note">${escHtml(t.note)}</div>` : ''}
          </div>
          <div>
            <div class="transaction-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}${fmtAmount(t.amount)}</div>
            <div class="transaction-date">${t.date.slice(5)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Draw finance chart (category expense breakdown)
  drawFinanceChart(monthTxns);
}

function drawFinanceChart(monthTxns) {
  const canvas = document.getElementById('financeChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.parentElement.clientWidth - 40; // padding
  const h = 220;
  canvas.width = w;
  canvas.height = h;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const expenses = monthTxns.filter(t => t.type === 'expense');
  if (expenses.length === 0) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#999';
    ctx.font = '14px Inter, Noto Sans SC, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('本月暂无支出数据', w / 2, h / 2);
    return;
  }

  // Aggregate by category
  const catMap = {};
  expenses.forEach(t => {
    const cat = t.category || '其他';
    catMap[cat] = (catMap[cat] || 0) + Number(t.amount);
  });

  const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const colors = ['#FF6B6B', '#54A0FF', '#FFB347', '#A29BFE', '#2ED573', '#FFD93D', '#FF8A80', '#80D8FF', '#B388FF', '#CCFF90'];

  // Donut
  const cx = w * 0.35, cy = h / 2, r = Math.min(80, h / 2 - 20);
  let angle = -Math.PI / 2;
  entries.forEach(([, val], i) => {
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    angle += slice;
  });
  // Inner circle for donut
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#fff';
  ctx.fill();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#333';
  ctx.font = 'bold 14px Inter, Noto Sans SC, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('总支出', cx, cy - 4);
  ctx.font = 'bold 12px Inter, Noto Sans SC, sans-serif';
  ctx.fillText(fmtAmount(total), cx, cy + 14);

  // Legend
  const lx = w * 0.6, ly = h / 2 - entries.length * 12;
  ctx.textAlign = 'left';
  entries.forEach(([cat, val], i) => {
    const y = ly + i * 24;
    if (y > h) return;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(lx, y - 5, 10, 10);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#333';
    ctx.font = '11px Inter, Noto Sans SC, sans-serif';
    const pct = Math.round(val / total * 100);
    ctx.fillText(`${CAT_ICONS[cat] || ''} ${cat} ${pct}%`, lx + 16, y + 4);
  });
}

// ── AI Report ───────────────────────────────────────────────
function generateReport() {
  refreshCurrentTab();
  showToast('报告已生成 📊', 'success');
}

function renderReport() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  document.getElementById('reportDateRange').textContent =
    `${monday.getMonth() + 1}月${monday.getDate()}日 — ${sunday.getMonth() + 1}月${sunday.getDate()}日`;

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(dateStr(d));
  }

  // Score calculations
  let completedDays = 0;
  weekDates.forEach(ds => {
    if (state.events.some(e => e.date === ds)) completedDays++;
  });
  const scheduleRate = Math.round(completedDays / 7 * 100);

  let habitDaysAvg = 0;
  if (state.habits.length > 0) {
    let totalCompletions = 0, totalPossible = 0;
    state.habits.forEach(h => {
      weekDates.forEach(ds => {
        totalPossible++;
        if (h.checkins && h.checkins[ds]) totalCompletions++;
      });
    });
    habitDaysAvg = totalPossible > 0 ? Math.round(totalCompletions / totalPossible * 100) : 0;
  }

  const weekTxns = state.transactions.filter(t => weekDates.includes(t.date));
  const weekIncome = weekTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const weekExpense = weekTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const financeScore = weekIncome > 0 ? Math.max(0, Math.round((1 - weekExpense / weekIncome) * 100)) : (weekExpense > 0 ? 30 : 70);

  const totalScore = Math.round((scheduleRate + habitDaysAvg + financeScore) / 3);

  // Update score circle
  document.getElementById('scoreNumber').textContent = totalScore;
  const circle = document.getElementById('scoreFill');
  const circumference = 326.73;
  const offset = circumference - (totalScore / 100) * circumference;
  circle.style.strokeDashoffset = offset;

  // Score details
  document.getElementById('scoreSchedule').textContent = scheduleRate + '%';
  document.getElementById('scoreHabit').textContent = habitDaysAvg + '%';
  document.getElementById('scoreFinance').textContent = financeScore + '%';

  // AI Summary
  let summary = '';
  const name = '你';
  if (totalScore >= 80) {
    summary = `🌟 本周表现优秀！${name}的生活管理做得非常出色。`;
  } else if (totalScore >= 60) {
    summary = `👍 本周表现良好！${name}在多个方面都有不错的进展。`;
  } else if (totalScore >= 40) {
    summary = `💪 本周还有提升空间，${name}可以尝试在薄弱环节多花些时间。`;
  } else {
    summary = `🌱 新的开始！${name}可以从设定小目标开始，逐步建立良好的生活节奏。`;
  }

  if (scheduleRate >= 80) summary += `\n\n📅 日程管理方面，${name}有${scheduleRate}%的天数有计划安排，生活井井有条。`;
  else if (scheduleRate > 0) summary += `\n\n📅 日程方面，${name}本周${scheduleRate}%的天数有计划，可以尝试提前规划每一天。`;
  else summary += `\n\n📅 日程方面，${name}本周还没有安排事件，试试为明天定一个小目标吧。`;

  if (state.habits.length > 0) {
    const bestHabit = [...state.habits].sort((a, b) => calcStreak(b, todayStr()) - calcStreak(a, todayStr()))[0];
    summary += `\n\n✅ 习惯方面，坚持率${habitDaysAvg}%。做得最好的习惯是「${bestHabit.name}」，连续${calcStreak(bestHabit, todayStr())}天，继续保持！`;
  }

  if (weekExpense > 0) {
    const topCat = getTopExpenseCategory(weekTxns);
    summary += `\n\n💰 本周支出共${fmtAmount(weekExpense)}，主要花在「${topCat}」上。`;
    if (weekIncome > 0) summary += `收入${fmtAmount(weekIncome)}，结余${fmtAmount(weekIncome - weekExpense)}。`;
    else summary += `本周暂无收入记录。`;
  } else {
    summary += `\n\n💰 本周暂无支出记录，财务状况干净清爽！`;
  }

  summary += `\n\n🎯 下周建议：保持优势，关注薄弱环节，每天进步一点点。LifeMate 会一直陪伴${name}！`;

  const summaryEl = document.getElementById('aiSummary');
  summaryEl.innerHTML = summary.split('\n\n').map(p => `<p>${p}</p>`).join('');

  // Charts
  drawHabitTrendChart(weekDates);
  drawFinanceTrendChart(weekDates);

  // Highlights
  renderHighlights(weekDates);
}

function getTopExpenseCategory(txns) {
  const catMap = {};
  txns.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || '其他';
    catMap[cat] = (catMap[cat] || 0) + Number(t.amount);
  });
  let topCat = '其他', topAmt = 0;
  Object.entries(catMap).forEach(([cat, amt]) => {
    if (amt > topAmt) { topCat = cat; topAmt = amt; }
  });
  return topCat;
}

function drawHabitTrendChart(weekDates) {
  const canvas = document.getElementById('habitTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.parentElement.clientWidth - 40;
  const h = 200;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  if (state.habits.length === 0) {
    ctx.fillStyle = '#999';
    ctx.font = '13px Inter, Noto Sans SC, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无习惯数据', w / 2, h / 2);
    return;
  }

  // Count daily completions
  const data = weekDates.map(ds => {
    let count = 0;
    state.habits.forEach(h => { if (h.checkins && h.checkins[ds]) count++; });
    return count;
  });

  const maxVal = Math.max(state.habits.length, 1);
  const pad = { left: 40, right: 20, top: 20, bottom: 30 };
  const gw = w - pad.left - pad.right;
  const gh = h - pad.top - pad.bottom;

  // Background
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#fff';
  ctx.fillRect(0, 0, w, h);

  // Gridlines
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-light').trim() || '#eee';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + gh * i / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  // Y-axis labels
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#999';
  ctx.font = '10px Inter, Noto Sans SC, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(maxVal * (4 - i) / 4);
    const y = pad.top + gh * i / 4;
    ctx.fillText(val, pad.left - 6, y + 3);
  }

  // X-axis labels
  ctx.textAlign = 'center';
  const dayLabels = weekDates.map(ds => {
    const d = new Date(ds + 'T00:00:00');
    return ['日','一','二','三','四','五','六'][d.getDay()];
  });
  dayLabels.forEach((label, i) => {
    const x = pad.left + gw * i / 6;
    ctx.fillText(label, x, h - 8);
  });

  // Line chart
  const points = data.map((v, i) => ({
    x: pad.left + gw * i / 6,
    y: pad.top + gh * (1 - v / maxVal)
  }));

  // Area fill
  ctx.beginPath();
  ctx.moveTo(points[0].x, pad.top + gh);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[6].x, pad.top + gh);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + gh);
  gradient.addColorStop(0, 'rgba(78, 205, 196, 0.3)');
  gradient.addColorStop(1, 'rgba(78, 205, 196, 0.02)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#4ECDC4';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Dots
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4ECDC4';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawFinanceTrendChart(weekDates) {
  const canvas = document.getElementById('financeTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.parentElement.clientWidth - 40;
  const h = 200;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  // Daily expense totals
  const data = weekDates.map(ds => {
    return state.transactions
      .filter(t => t.date === ds && t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount), 0);
  });

  const maxVal = Math.max(...data, 1);
  const pad = { left: 50, right: 20, top: 20, bottom: 30 };
  const gw = w - pad.left - pad.right;
  const gh = h - pad.top - pad.bottom;
  const barWidth = gw / 7 * 0.6;
  const gap = gw / 7 * 0.4;

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#fff';
  ctx.fillRect(0, 0, w, h);

  // Gridlines
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-light').trim() || '#eee';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + gh * i / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  // Y-axis
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#999';
  ctx.font = '10px Inter, Noto Sans SC, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(maxVal * (4 - i) / 4);
    const y = pad.top + gh * i / 4;
    ctx.fillText('¥' + val, pad.left - 6, y + 3);
  }

  // X-axis
  ctx.textAlign = 'center';
  const dayLabels = weekDates.map(ds => {
    const d = new Date(ds + 'T00:00:00');
    return ['日','一','二','三','四','五','六'][d.getDay()];
  });
  dayLabels.forEach((label, i) => {
    const x = pad.left + gw / 7 * i + gw / 14;
    ctx.fillText(label, x, h - 8);
  });

  // Bars
  data.forEach((v, i) => {
    const barH = maxVal > 0 ? (v / maxVal) * gh : 0;
    const x = pad.left + gw / 7 * i + gap / 2;
    const y = pad.top + gh - barH;
    const gradient = ctx.createLinearGradient(x, y, x, pad.top + gh);
    gradient.addColorStop(0, '#FF6B6B');
    gradient.addColorStop(1, '#FF8A80');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, Math.max(barH, 2));

    // Value label
    if (v > 0) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#333';
      ctx.font = '9px Inter, Noto Sans SC, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('¥' + v, x + barWidth / 2, y - 4);
    }
  });
}

function renderHighlights(weekDates) {
  const list = document.getElementById('highlightsList');
  const items = [];

  // Best habit streak
  if (state.habits.length > 0) {
    const best = [...state.habits].sort((a, b) => calcStreak(b, todayStr()) - calcStreak(a, todayStr()))[0];
    const streak = calcStreak(best, todayStr());
    if (streak >= 3) {
      items.push({ emoji: '🔥', text: `「${best.name}」连续坚持 ${streak} 天，太棒了！` });
    }
  }

  // Most scheduled day
  let maxEvents = 0, maxDay = '';
  weekDates.forEach(ds => {
    const count = state.events.filter(e => e.date === ds).length;
    if (count > maxEvents) { maxEvents = count; maxDay = ds; }
  });
  if (maxEvents >= 2) {
    const d = new Date(maxDay + 'T00:00:00');
    items.push({ emoji: '📅', text: `${fmtShortDate(d)}安排了 ${maxEvents} 个事件，是最充实的一天` });
  }

  // Total week transactions
  const weekTxns = state.transactions.filter(t => weekDates.includes(t.date));
  if (weekTxns.length > 0) {
    items.push({ emoji: '💳', text: `本周共记录 ${weekTxns.length} 笔交易` });
  }

  // Habit completion rate
  if (state.habits.length > 0) {
    let completed = 0, total = 0;
    state.habits.forEach(h => {
      weekDates.forEach(ds => {
        total++;
        if (h.checkins && h.checkins[ds]) completed++;
      });
    });
    if (total > 0) {
      const rate = Math.round(completed / total * 100);
      items.push({ emoji: '✅', text: `本周习惯打卡率 ${rate}%` });
    }
  }

  // Longest habit streak
  if (state.habits.length > 0) {
    const longest = [...state.habits].sort((a, b) => calcStreak(b, todayStr()) - calcStreak(a, todayStr()))[0];
    const ls = calcStreak(longest, todayStr());
    if (ls >= 5) {
      items.push({ emoji: '🏆', text: `「${longest.name}」达成 ${ls} 天连续打卡记录` });
    }
  }

  if (items.length === 0) {
    items.push({ emoji: '🌱', text: '新的一周开始了！多使用 LifeMate 就会有数据分析哦～' });
  }

  list.innerHTML = items.map(i => `
    <div class="highlight-item">
      <span class="highlight-emoji">${i.emoji}</span>
      <span>${i.text}</span>
    </div>
  `).join('');
}

// ── Event Delegation & Initialization ───────────────────────
function initEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Mobile menu
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Calendar navigation
  document.getElementById('calPrev').addEventListener('click', () => navigateCalendar(-1));
  document.getElementById('calNext').addEventListener('click', () => navigateCalendar(1));
  document.getElementById('calToday').addEventListener('click', goToToday);

  // Calendar grid clicks (day selection)
  document.getElementById('calendarGrid').addEventListener('click', (e) => {
    const day = e.target.closest('.cal-day');
    if (!day) return;
    const date = day.dataset.date;
    if (date) selectCalendarDate(date);
  });

  // View switcher
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.calendarView = btn.dataset.view;
      renderCalendar();
      renderDayEvents();
    });
  });

  // Event modal: close on overlay click
  document.getElementById('eventModal').addEventListener('click', (e) => {
    if (e.target.id === 'eventModal') closeEventModal();
  });
  document.getElementById('eventModal').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEventModal();
  });

  // Event color picker
  document.getElementById('eventColorPicker').addEventListener('click', (e) => {
    const dot = e.target.closest('.color-dot');
    if (!dot) return;
    document.querySelectorAll('#eventColorPicker .color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
  });

  // Habit modal: close on overlay click
  document.getElementById('habitModal').addEventListener('click', (e) => {
    if (e.target.id === 'habitModal') closeHabitModal();
  });

  // Emoji picker
  document.getElementById('emojiPicker').addEventListener('click', (e) => {
    const opt = e.target.closest('.emoji-option');
    if (!opt) return;
    document.querySelectorAll('#emojiPicker .emoji-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
  });

  // Goal selector
  document.querySelectorAll('#habitModal .goal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#habitModal .goal-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Habit color picker
  document.getElementById('habitColorPicker').addEventListener('click', (e) => {
    const dot = e.target.closest('.color-dot');
    if (!dot) return;
    document.querySelectorAll('#habitColorPicker .color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
  });

  // Transaction modal: close on overlay click
  document.getElementById('transactionModal').addEventListener('click', (e) => {
    if (e.target.id === 'transactionModal') closeTransactionModal();
  });

  // Transaction type switch
  document.querySelectorAll('#transactionModal .type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#transactionModal .type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('transactionType').value = btn.dataset.type;
      document.getElementById('categoryGrid').style.display = btn.dataset.type === 'income' ? 'none' : 'grid';
      if (btn.dataset.type === 'income') {
        document.querySelectorAll('#categoryGrid .cat-chip').forEach(c => c.classList.remove('active'));
      } else {
        resetCategoryChips();
      }
    });
  });

  // Category grid
  document.getElementById('categoryGrid').addEventListener('click', (e) => {
    const chip = e.target.closest('.cat-chip');
    if (!chip) return;
    document.querySelectorAll('#categoryGrid .cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });

  // Finance filter chips
  document.querySelector('.finance-filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('.finance-filters .filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.transactionFilter = chip.dataset.category;
    renderFinance();
  });

  // Keyboard: close modals with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEventModal();
      closeHabitModal();
      closeTransactionModal();
    }
  });

  // Resize charts on window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.currentTab === 'finance') renderFinance();
      if (state.currentTab === 'report') renderReport();
    }, 250);
  });
}

// ── Bootstrap ───────────────────────────────────────────────
function init() {
  loadData();
  applyTheme();
  initEventListeners();
  goToToday(); // Sets calendar to today
  state.currentTab = 'dashboard';
  switchTab('dashboard');
}

// ── Global helpers (exposed for inline onclick) ─────────────
// These are already function declarations above, so they're naturally global.
// But we also need editEventById, editHabitById, editTransactionById to be accessible.
window.editEventById = editEventById;
window.editHabitById = editHabitById;
window.editTransactionById = editTransactionById;
window.toggleHabitCheck = toggleHabitCheck;
window.switchTab = switchTab;
window.openEventModal = openEventModal;
window.closeEventModal = closeEventModal;
window.saveEvent = saveEvent;
window.deleteEvent = deleteEvent;
window.openHabitModal = openHabitModal;
window.closeHabitModal = closeHabitModal;
window.saveHabit = saveHabit;
window.deleteHabit = deleteHabit;
window.openTransactionModal = openTransactionModal;
window.closeTransactionModal = closeTransactionModal;
window.saveTransaction = saveTransaction;
window.deleteTransaction = deleteTransaction;
window.generateReport = generateReport;

// Start the app
document.addEventListener('DOMContentLoaded', init);
