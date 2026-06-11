function togglePressed(button) {
  const group = button.closest('.segmented');
  if (!group) return;

  group.querySelectorAll('button').forEach((item) => {
    item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
  });
}

function markLoading(button, label) {
  const original = button.textContent;
  button.textContent = label || 'Working';
  button.setAttribute('aria-busy', 'true');
  button.disabled = true;

  window.setTimeout(() => {
    button.textContent = original;
    button.removeAttribute('aria-busy');
    button.disabled = false;
  }, 900);
}

function announceDemo(message) {
  const live = document.querySelector('[data-live-region]');
  if (live) {
    live.textContent = message;
  }
}
