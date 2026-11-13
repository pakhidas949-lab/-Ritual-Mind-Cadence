// localStorage abstraction. Every call is wrapped so private mode,
// quota errors or corrupted JSON never break the app.
// Loaded as a classic script, so it can run from file:// too.
(function () {
  const TASKS_KEY = 'tasks';
  const THEME_KEY = 'theme';
  const JOURNAL_KEY = 'journal';
  const MOOD_KEY = 'mood';

  function saveTasks(tasks) {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      return true;
    } catch (err) {
      console.error('Could not save tasks:', err);
      return false;
    }
  }

  function loadTasks() {
    try {
      const data = JSON.parse(localStorage.getItem(TASKS_KEY));
      if (!Array.isArray(data)) return [];
      return data
        .filter((t) => t && Number.isFinite(t.id) && typeof t.text === 'string')
        .map((t) => ({ ...t, completed: Boolean(t.completed) }));
    } catch (err) {
      console.error('Could not read tasks, starting fresh:', err);
      return [];
    }
  }

  function saveTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }

  function loadJournal() {
    try {
      return localStorage.getItem(JOURNAL_KEY) || '';
    } catch (err) {
      console.error('Could not read journal:', err);
      return '';
    }
  }

  function saveJournal(text) {
    try {
      localStorage.setItem(JOURNAL_KEY, text);
      return true;
    } catch (err) {
      console.error('Could not save journal:', err);
      return false;
    }
  }

  function loadMood() {
    try { return localStorage.getItem(MOOD_KEY) || ''; } catch { return ''; }
  }

  function saveMood(mood) {
    try { localStorage.setItem(MOOD_KEY, mood); } catch { /* ignore */ }
  }

  window.TaskFlowStorage = {
    loadTasks, saveTasks, saveTheme,
    loadJournal, saveJournal,
    loadMood, saveMood,
  };
})();
