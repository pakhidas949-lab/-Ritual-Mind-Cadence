// View layer: turns state into DOM. No state lives here.
(function () {
  const RING_RADIUS = 52;
  const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const DAY_MS = 86400000;

  function el(tag, className, attrs = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  function button(label, action, text, className = 'icon-action') {
    const b = el('button', className, { type: 'button', 'data-action': action, 'aria-label': label });
    b.textContent = text;
    return b;
  }

  const ICONS = {
    edit: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11.1 2.7 13.3 4.9M2.9 13.1l.4-2.6 7.2-7.2a1.2 1.2 0 0 1 1.7 0l.5.5a1.2 1.2 0 0 1 0 1.7l-7.2 7.2-2.6.4Z"/></svg>',
    remove: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.6 3.6 12.4 12.4M12.4 3.6 3.6 12.4"/></svg>',
  };

  // Icon-only action: a real <svg> instead of a text glyph, so it renders
  // identically everywhere and scales with the font size.
  function iconButton(label, action, icon, extraClass = '') {
    const b = el('button', `icon-action${extraClass ? ` ${extraClass}` : ''}`, {
      type: 'button', 'data-action': action, 'aria-label': label, title: label,
    });
    b.innerHTML = ICONS[icon];
    return b;
  }

  function formatDay(iso) {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function taskMeta(task) {
    const meta = el('span', 'task-meta');
    const pill = el('span', `pill ${task.completed ? 'pill-sage' : 'pill-soft'}`);
    pill.textContent = task.completed ? 'Fulfilled' : 'In hand';
    const dot = el('span', 'dot');
    dot.setAttribute('aria-hidden', 'true');
    const stamp = el('span', 'task-stamp');
    const when = formatDay(task.createdAt);
    stamp.textContent = when ? `Inscribed ${when}` : 'Inscribed today';
    meta.append(pill, dot, stamp);
    return meta;
  }

  function createTaskElement(task, isEditing) {
    const li = el('li', `task${task.completed ? ' completed' : ''}`);
    li.dataset.id = task.id;

    if (isEditing) {
      li.classList.add('editing');
      const form = el('form', 'edit-form', { novalidate: '' });
      const input = el('input', 'edit-input', {
        type: 'text', 'aria-label': 'Edit ritual text', autocomplete: 'off',
      });
      input.value = task.text;
      const save = el('button', 'btn btn-primary btn-sm', { type: 'submit' });
      save.textContent = 'Save';
      const cancel = button('Cancel editing', 'cancel', 'Cancel', 'btn btn-quiet btn-sm');
      form.append(input, save, cancel);
      li.append(form);
      return li;
    }

    const label = el('label', 'task-main');
    const box = el('input', 'check', { type: 'checkbox' });
    box.checked = task.completed;

    const body = el('span', 'task-body');
    const text = el('span', 'task-text');
    text.textContent = task.text;
    body.append(text, taskMeta(task));
    label.append(box, body);

    const actions = el('div', 'task-actions');
    actions.append(
      iconButton(`Edit ritual: ${task.text}`, 'edit', 'edit'),
      iconButton(`Delete ritual: ${task.text}`, 'delete', 'remove', 'icon-action-danger')
    );
    li.append(label, actions);
    return li;
  }

  const EMPTY_COPY = {
    all: ['The page is still blank', 'Inscribe your first ritual above and let the day find its cadence.'],
    active: ['All clear', 'Every ritual is fulfilled. Add another, or simply enjoy the quiet.'],
    completed: ['Nothing fulfilled yet', 'Finished rituals will rest here as small glories.'],
  };

  const SUGGESTIONS = [
    'Tidy the desk',
    'Ten slow breaths',
    'Read three pages',
    'A glass of water',
  ];

  function createSuggestions() {
    const wrap = el('div', 'suggestions');
    SUGGESTIONS.forEach((text) => {
      const b = el('button', 'suggestion', { type: 'button', 'data-suggestion': text });
      const plus = el('span', 'suggestion-plus');
      plus.setAttribute('aria-hidden', 'true');
      plus.textContent = '+';
      const label = el('span');
      label.textContent = text;
      b.append(plus, label);
      wrap.append(b);
    });
    return wrap;
  }

  function createEmptyState(filter) {
    const [title, body] = EMPTY_COPY[filter] || EMPTY_COPY.all;
    const li = el('li', 'empty-state');
    li.append(el('img', 'empty-illu', { src: 'images/empty-tasks.svg', alt: '', width: '96', height: '96' }));
    const t = el('p', 'empty-title');
    t.textContent = title;
    const b = el('p', 'muted');
    b.textContent = body;
    li.append(t, b);
    if (filter === 'all') li.append(createSuggestions());
    return li;
  }

  function renderTaskList(listEl, tasks, { filter = 'all', editingId = null } = {}) {
    const started = performance.now();
    const fragment = document.createDocumentFragment();
    if (tasks.length === 0) fragment.append(createEmptyState(filter));
    else tasks.forEach((t) => fragment.append(createTaskElement(t, t.id === editingId)));
    listEl.replaceChildren(fragment); // one DOM write per render

    const editInput = listEl.querySelector('.edit-input');
    if (editInput) { editInput.focus(); editInput.select(); }
    lastRenderMs = Math.round((performance.now() - started) * 100) / 100;
  }

  // Exposed for the performance check in the README / DevTools.
  let lastRenderMs = 0;

  /* ---------- Derived helpers ---------- */
  function daysInPractice(tasks) {
    const stamps = tasks
      .map((t) => new Date(t.createdAt).getTime())
      .filter((n) => Number.isFinite(n));
    if (!stamps.length) return 0;
    const start = new Date(Math.min(...stamps));
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((today - start) / DAY_MS) + 1);
  }

  function renderWeekStrip(stripEl, tasks) {
    if (!stripEl) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }

    const byDay = new Map();
    tasks.forEach((t) => {
      const d = new Date(t.createdAt);
      if (Number.isNaN(d.getTime())) return;
      d.setHours(0, 0, 0, 0);
      const key = d.getTime();
      const entry = byDay.get(key) || { total: 0, done: 0 };
      entry.total += 1;
      if (t.completed) entry.done += 1;
      byDay.set(key, entry);
    });

    const fragment = document.createDocumentFragment();
    days.forEach((d, index) => {
      const isToday = index === days.length - 1;
      const entry = byDay.get(d.getTime());
      const chip = el('div', 'day-chip');
      if (isToday) chip.classList.add('is-today');
      if (entry && entry.total > 0) {
        chip.classList.add('has-ritual');
        if (entry.done === entry.total) chip.classList.add('is-full');
      }

      const name = el('span', 'day-name');
      name.textContent = d.toLocaleDateString(undefined, { weekday: 'short' });
      const date = el('span', 'day-date');
      date.textContent = String(d.getDate());

      const dotWrap = el('span', 'day-dot');
      dotWrap.setAttribute('aria-hidden', 'true');

      const status = el('span', 'day-status');
      if (isToday) status.textContent = entry ? `${entry.done}/${entry.total} · in flow` : 'Open';
      else if (entry) status.textContent = `${entry.done}/${entry.total}`;
      else status.textContent = 'Rest';

      chip.append(name, date, dotWrap, status);
      chip.setAttribute('role', 'listitem');
      chip.setAttribute('aria-label',
        `${d.toLocaleDateString()} — ${entry ? `${entry.done} of ${entry.total} fulfilled` : 'resting'}`);
      fragment.append(chip);
    });
    stripEl.replaceChildren(fragment);
  }

  function renderArchive(listEl, countEl, tasks) {
    if (!listEl) return;
    const done = tasks
      .filter((t) => t.completed)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (countEl) countEl.textContent = `${done.length} archived`;

    if (!done.length) {
      const empty = el('li', 'archive-empty');
      empty.textContent = 'No rituals fulfilled yet — the shelf is waiting.';
      listEl.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    done.forEach((t) => {
      const li = el('li', 'archive-row');
      const tick = el('span', 'archive-check');
      tick.setAttribute('aria-hidden', 'true');
      tick.textContent = '✓';
      const text = el('span', 'archive-text');
      text.textContent = t.text;
      li.append(tick, text);
      const when = formatDay(t.createdAt);
      if (when) {
        const date = el('span', 'archive-date');
        date.textContent = when;
        li.append(date);
      }
      fragment.append(li);
    });
    listEl.replaceChildren(fragment);
  }

  function renderStats(dom, tasks, filter) {
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed).length;
    const open = total - done;
    const ratio = total ? done / total : 0;
    const percent = Math.round(ratio * 100);
    const days = daysInPractice(tasks);

    if (dom.ring) {
      dom.ring.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - ratio));
      dom.ring.style.opacity = done ? '1' : '0';
    }
    if (dom.cadencePercent) dom.cadencePercent.textContent = `${percent}%`;
    if (dom.heroMeter) dom.heroMeter.style.width = `${percent}%`;
    if (dom.cadenceBadge) {
      dom.cadenceBadge.textContent = total ? `${done} of ${total} complete` : 'A clean slate';
    }
    if (dom.cadenceDone) dom.cadenceDone.textContent = String(done);
    if (dom.cadenceOpen) dom.cadenceOpen.textContent = String(open);
    if (dom.ritualSummary) {
      dom.ritualSummary.textContent = total ? `${done} of ${total} fulfilled` : 'Nothing inscribed';
    }
    if (dom.progressText) {
      dom.progressText.textContent = total
        ? `${done} of ${total} rituals fulfilled${open ? ` — ${open} resting in the hours ahead.` : ' — a gentle, complete day.'}`
        : 'No rituals inscribed yet. Begin with one small thing.';
    }
    if (dom.counter) dom.counter.textContent = `${open} in hand · ${done} fulfilled`;
    if (dom.clearBtn) dom.clearBtn.disabled = done === 0;

    if (dom.statRate) dom.statRate.textContent = `${percent}%`;
    if (dom.statTotal) dom.statTotal.textContent = String(total);
    if (dom.statDone) dom.statDone.textContent = String(done);
    if (dom.statOpen) dom.statOpen.textContent = String(open);
    if (dom.statDays) dom.statDays.textContent = String(days);
    if (dom.streakDays) dom.streakDays.textContent = String(days);
    if (dom.mindfulDay) dom.mindfulDay.textContent = String(days || 1);

    if (dom.filters) {
      dom.filters.querySelectorAll('[data-filter]').forEach((b) => {
        const on = b.dataset.filter === filter;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }

    renderWeekStrip(dom.weekStrip, tasks);
    renderArchive(dom.archiveList, dom.archiveCount, tasks);
  }

  let toastTimer;
  function showToast(toastEl, message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2400);
  }

  window.TaskFlowRender = {
    renderTaskList,
    renderStats,
    showToast,
    get lastRenderMs() { return lastRenderMs; },
  };
})();
