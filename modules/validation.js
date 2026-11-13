// Form validation. Returns { valid, message, value } so callers can show feedback.
(function () {
  const MAX_LENGTH = 120;

  function validateTaskInput(raw, { existing = [], ignoreId = null } = {}) {
    const value = String(raw ?? '').trim();

    if (!value) {
      return { valid: false, message: 'Inscribe a ritual before adding it.', value };
    }
    if (value.length > MAX_LENGTH) {
      return {
        valid: false,
        message: `Shorten this ritual by ${value.length - MAX_LENGTH} characters (limit ${MAX_LENGTH}).`,
        value,
      };
    }
    const duplicate = existing.some(
      (t) => t.id !== ignoreId && t.text.toLowerCase() === value.toLowerCase()
    );
    if (duplicate) {
      return { valid: false, message: 'That ritual already rests in your archive.', value };
    }
    return { valid: true, message: '', value };
  }

  // For any code path that must build HTML strings. The renderer itself
  // uses textContent, so user text is never parsed as HTML.
  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (tag) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[tag]));
  }

  window.TaskFlowValidation = { MAX_LENGTH, validateTaskInput, escapeHTML };
})();
