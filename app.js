// Entry point: wires the model (state + storage), the view (render.js)
// and the controllers. Classic script, so the app also runs from file://.
(function () {
  const {
    loadTasks, saveTasks, saveTheme,
    loadJournal, saveJournal, loadMood, saveMood,
  } = window.TaskFlowStorage;
  const { renderTaskList, renderStats, showToast } = window.TaskFlowRender;
  const { validateTaskInput, MAX_LENGTH } = window.TaskFlowValidation;

  const $ = (id) => document.getElementById(id);
  const dom = {
    form: $('task-form'), input: $('task-input'), error: $('task-error'), count: $('char-count'),
    list: $('task-list'), filters: $('filters'), counter: $('task-counter'),
    clearBtn: $('clear-completed'), undoBtn: $('undo-btn'), redoBtn: $('redo-btn'), toast: $('toast'),
    ring: $('ring-fill'), progressText: $('progress-text'), theme: $('theme-toggle'),
    cadencePercent: $('cadence-percent'), cadenceBadge: $('cadence-badge'),
    cadenceDone: $('cadence-done'), cadenceOpen: $('cadence-open'),
    ritualSummary: $('ritual-summary'), streakDays: $('streak-days'), mindfulDay: $('mindful-day'),
    weekStrip: $('week-strip'), archiveList: $('archive-list'), archiveCount: $('archive-count'),
    statRate: $('stat-rate'), statTotal: $('stat-total'), statDone: $('stat-done'),
    statOpen: $('stat-open'), statDays: $('stat-days'),
    todayDate: $('today-date'), greeting: $('greeting'),
    journal: $('journal-note'), journalStatus: $('journal-status'),
    journalSave: $('journal-save'), journalClear: $('journal-clear'),
    moodNote: $('mood-note'), breathToggle: $('breath-toggle'), breathOrb: $('breath-orb'),
    breathWord: $('breath-word'), breathHint: $('breath-hint'),
    heroMeter: $('hero-meter'), heroCta: $('hero-cta'),
  };

  /* ---------- Model ---------- */
  // `history` and `future` hold JSON snapshots, capped at 50 steps.
  // Undo moves a snapshot to `future`; redo moves it back.
  const state = { tasks: loadTasks(), filter: 'all', editingId: null, history: [], future: [] };

  function createTask(text) {
    let id = Date.now();
    while (state.tasks.some((t) => t.id === id)) id += 1; // keep ids unique on rapid adds
    return { id, text: text.trim(), completed: false, createdAt: new Date().toISOString() };
  }

  function snapshot() {
    state.history.push(JSON.stringify(state.tasks));
    if (state.history.length > 50) state.history.shift();
    state.future.length = 0; // a new edit invalidates the redo branch
  }

  function commit(message) {
    if (!saveTasks(state.tasks)) showToast(dom.toast, 'Could not save. Storage may be full or blocked.');
    else if (message) showToast(dom.toast, message);
    render();
  }

  const visibleTasks = () => state.tasks.filter((t) =>
    state.filter === 'all' ? true : state.filter === 'active' ? !t.completed : t.completed);

  /* ---------- View ---------- */
  function render() {
    renderTaskList(dom.list, visibleTasks(), {
      filter: state.filter, editingId: state.editingId,
    });
    renderStats(dom, state.tasks, state.filter);
    dom.undoBtn.disabled = state.history.length === 0;
    if (dom.redoBtn) dom.redoBtn.disabled = state.future.length === 0;
  }

  function setFieldError(message) {
    dom.error.textContent = message;
    dom.input.setAttribute('aria-invalid', String(Boolean(message)));
    dom.form.classList.toggle('invalid', Boolean(message));
  }

  /* ---------- Task controllers ---------- */
  // Live feedback is debounced so a fast typist does not re-validate the whole
  // archive on every keystroke. The character counter stays instant.
  let validationTimer;
  function queueFieldError(value) {
    clearTimeout(validationTimer);
    validationTimer = setTimeout(() => {
      const len = value.trim().length;
      setFieldError(len ? validateTaskInput(value, { existing: state.tasks }).message : '');
    }, 180);
  }

  dom.input.addEventListener('input', () => {
    const len = dom.input.value.trim().length;
    dom.count.textContent = `${len} / ${MAX_LENGTH}`;
    dom.count.classList.toggle('over', len > MAX_LENGTH);
    if (!len) { clearTimeout(validationTimer); setFieldError(''); return; }
    queueFieldError(dom.input.value);
  });

  // Single write path, shared by the composer, the suggestion chips
  // and the hero call to action.
  function addRitual(raw) {
    clearTimeout(validationTimer);
    const result = validateTaskInput(raw, { existing: state.tasks });
    if (!result.valid) { setFieldError(result.message); dom.input.focus(); return false; }
    snapshot();
    state.tasks.push(createTask(result.value));
    if (state.filter === 'completed') state.filter = 'all';
    dom.input.value = '';
    dom.count.textContent = `0 / ${MAX_LENGTH}`;
    setFieldError('');
    commit('Ritual inscribed');
    return true;
  }

  dom.form.addEventListener('submit', (e) => {
    e.preventDefault();
    addRitual(dom.input.value);
  });

  // Empty-state suggestion chips: one click inscribes the ritual.
  dom.list.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-suggestion]');
    if (!chip) return;
    addRitual(chip.dataset.suggestion);
  });

  // Hero call to action: bring the composer into view and start typing.
  function inviteToComposer() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    dom.form.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    dom.form.classList.add('is-inviting');
    window.setTimeout(() => dom.form.classList.remove('is-inviting'), 1400);
    dom.input.focus({ preventScroll: true });
  }
  if (dom.heroCta) dom.heroCta.addEventListener('click', inviteToComposer);

  // Event delegation: one set of listeners for every ritual, present or future.
  dom.list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const li = e.target.closest('.task');
    if (!btn || !li) return;
    const id = Number(li.dataset.id);
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;

    if (btn.dataset.action === 'delete') {
      if (!window.confirm(`Delete "${task.text}"? This can be undone with Undo.`)) return;
      snapshot();
      state.tasks = state.tasks.filter((t) => t.id !== id);
      commit('Ritual removed');
    } else if (btn.dataset.action === 'edit') {
      state.editingId = id;
      render();
    } else if (btn.dataset.action === 'cancel') {
      state.editingId = null;
      render();
    }
  });

  dom.list.addEventListener('change', (e) => {
    if (!e.target.matches('input[type="checkbox"]')) return;
    const id = Number(e.target.closest('.task').dataset.id);
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    snapshot();
    task.completed = e.target.checked;
    commit(task.completed ? 'Ritual fulfilled' : 'Ritual returned to hand');
    dom.list.querySelector(`[data-id="${id}"] input[type="checkbox"]`)?.focus(); // keep keyboard position
  });

  dom.list.addEventListener('submit', (e) => {
    if (!e.target.matches('.edit-form')) return;
    e.preventDefault();
    const id = Number(e.target.closest('.task').dataset.id);
    const task = state.tasks.find((t) => t.id === id);
    const result = validateTaskInput(e.target.querySelector('.edit-input').value, { existing: state.tasks, ignoreId: id });
    if (!result.valid) { showToast(dom.toast, result.message); return; }
    if (result.value !== task.text) { snapshot(); task.text = result.value; }
    state.editingId = null;
    commit('Ritual updated');
  });

  dom.list.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.editingId !== null) { state.editingId = null; render(); }
  });

  dom.filters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    state.editingId = null;
    render();
  });

  dom.clearBtn.addEventListener('click', () => {
    const n = state.tasks.filter((t) => t.completed).length;
    if (!n || !window.confirm(`Clear ${n} fulfilled ritual${n === 1 ? '' : 's'}?`)) return;
    snapshot();
    state.tasks = state.tasks.filter((t) => !t.completed);
    commit('Fulfilled rituals cleared');
  });

  function undo() {
    if (!state.history.length) return;
    state.future.push(JSON.stringify(state.tasks));
    state.tasks = JSON.parse(state.history.pop());
    state.editingId = null;
    commit('Change undone');
  }

  function redo() {
    if (!state.future.length) return;
    state.history.push(JSON.stringify(state.tasks));
    if (state.history.length > 50) state.history.shift();
    state.tasks = JSON.parse(state.future.pop());
    state.editingId = null;
    commit('Change restored');
  }

  dom.undoBtn.addEventListener('click', undo);
  if (dom.redoBtn) dom.redoBtn.addEventListener('click', redo);

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName) && document.activeElement.type !== 'checkbox';
    if (!(e.ctrlKey || e.metaKey) || typing) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
  });

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    dom.theme.setAttribute('aria-pressed', String(theme === 'dark'));
    dom.theme.setAttribute('aria-label', theme === 'dark' ? 'Use light theme' : 'Use dark theme');
  }
  dom.theme.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    saveTheme(next);
    showToast(dom.toast, next === 'dark' ? 'Evening theme applied' : 'Daylight theme applied');
  });
  applyTheme(document.documentElement.dataset.theme || 'light');

  /* ---------- Day ---------- */
  function paintDay() {
    const now = new Date();
    if (dom.todayDate) {
      dom.todayDate.textContent = now.toLocaleDateString(undefined, {
        weekday: 'long', month: 'short', day: 'numeric',
      });
    }
    if (dom.greeting) {
      const h = now.getHours();
      dom.greeting.textContent = h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
    }
  }

  /* ---------- Journal ---------- */
  let journalTimer;
  function setJournalStatus(text) {
    if (dom.journalStatus) dom.journalStatus.textContent = text;
  }

  if (dom.journal) {
    dom.journal.value = loadJournal();
    dom.journal.addEventListener('input', () => {
      setJournalStatus('Saving…');
      clearTimeout(journalTimer);
      journalTimer = setTimeout(() => {
        const ok = saveJournal(dom.journal.value);
        setJournalStatus(ok ? 'Saved quietly on this device' : 'Could not save — storage may be blocked');
      }, 350);
    });
  }

  dom.journalSave?.addEventListener('click', () => {
    clearTimeout(journalTimer);
    const ok = saveJournal(dom.journal.value);
    setJournalStatus(ok ? 'Saved quietly on this device' : 'Could not save — storage may be blocked');
    showToast(dom.toast, ok ? 'Journal note saved' : 'Could not save journal');
  });

  dom.journalClear?.addEventListener('click', () => {
    if (!dom.journal.value.trim()) { showToast(dom.toast, 'The page is already clear'); return; }
    if (!window.confirm('Clear your evening note? This cannot be undone.')) return;
    clearTimeout(journalTimer);
    dom.journal.value = '';
    saveJournal('');
    setJournalStatus('Note cleared — a blank page again');
    showToast(dom.toast, 'Journal note cleared');
  });

  /* ---------- Mind check-in ---------- */
  const MOOD_COPY = {
    serene: 'a softer pace — let the day arrive without urgency.',
    grounded: 'steady, unhurried, rooted in the present hour.',
    reflective: 'turn inward and make room for a longer exhale.',
    energised: 'carry that brightness gently into the first ritual.',
  };

  function applyMood(btn, { announce = false } = {}) {
    if (!btn) return;
    document.querySelectorAll('[data-mood]').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const label = btn.dataset.mood;
    if (dom.moodNote) {
      const em = document.createElement('em');
      em.textContent = label.charAt(0).toUpperCase() + label.slice(1);
      dom.moodNote.replaceChildren(
        document.createTextNode('Current anchor: '), em,
        document.createTextNode(` — ${MOOD_COPY[label] || ''}`)
      );
    }
    saveMood(label);
    if (announce) showToast(dom.toast, `Today's anchor: ${label}`);
  }

  document.querySelectorAll('[data-mood]').forEach((btn) => {
    btn.addEventListener('click', () => applyMood(btn, { announce: true }));
  });
  const savedMood = loadMood();
  applyMood(
    document.querySelector(`[data-mood="${savedMood}"]`) || document.querySelector('[data-mood="grounded"]')
  );

  /* ---------- 4·7·8 breathing practice ---------- */
  const PHASES = [
    { name: 'Inhale', seconds: 4 },
    { name: 'Hold', seconds: 7 },
    { name: 'Exhale', seconds: 8 },
  ];
  let phaseIndex = 0;
  let remaining = PHASES[0].seconds;
  let breathTimer = null;
  let breathing = false;

  function paintBreath() {
    if (!dom.breathOrb) return;
    dom.breathOrb.dataset.phase = PHASES[phaseIndex].name.toLowerCase();
    if (dom.breathWord) dom.breathWord.textContent = PHASES[phaseIndex].name;
    if (dom.breathHint) dom.breathHint.textContent = `${remaining}s`;
  }

  function tickBreath() {
    remaining -= 1;
    if (remaining <= 0) {
      phaseIndex = (phaseIndex + 1) % PHASES.length;
      remaining = PHASES[phaseIndex].seconds;
    }
    paintBreath();
  }

  function setBreathing(on) {
    breathing = on;
    dom.breathOrb.classList.toggle('is-breathing', on);
    dom.breathToggle.setAttribute('aria-pressed', String(on));

    if (on) {
      dom.breathToggle.textContent = 'Pause practice';
      paintBreath();
      if (!breathTimer) breathTimer = setInterval(tickBreath, 1000);
    } else {
      dom.breathToggle.textContent = breathTimer || phaseIndex || remaining !== PHASES[0].seconds
        ? 'Resume practice' : 'Begin practice';
      if (dom.breathHint) dom.breathHint.textContent = 'Paused';
      clearInterval(breathTimer);
      breathTimer = null;
    }
  }

  if (dom.breathToggle && dom.breathOrb) {
    dom.breathToggle.addEventListener('click', () => setBreathing(!breathing));
  }

  /* ---------- Navigation ---------- */
  document.querySelectorAll('.primary-nav .nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.primary-nav .nav-link').forEach((l) => {
        const on = l === link;
        l.classList.toggle('is-active', on);
        if (on) l.setAttribute('aria-current', 'page');
        else l.removeAttribute('aria-current');
      });
    });
  });

  paintDay();
  render();
})();
