document.querySelectorAll('[data-code-editor]').forEach((editor) => {
  const workspace = editor.closest('[data-coding-workspace]');
  const lineNumbers = workspace?.querySelector('[data-editor-lines]');
  const status = workspace?.querySelector('[data-editor-status]');

  function getCaretPosition() {
    const valueUntilCursor = editor.value.slice(0, editor.selectionStart);
    const lines = valueUntilCursor.split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  function syncEditorMeta() {
    const lineCount = Math.max(editor.value.split('\n').length, 1);

    if (lineNumbers) {
      lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join('\n');
    }

    if (status) {
      const caret = getCaretPosition();
      const characterCount = editor.value.length;
      status.textContent = `Ln ${caret.line} · Col ${caret.column} · ${characterCount} chars`;
    }
  }

  function syncScroll() {
    if (!lineNumbers) return;
    lineNumbers.scrollTop = editor.scrollTop;
  }

  editor.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;

    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const tab = '  ';

    editor.value = `${editor.value.slice(0, start)}${tab}${editor.value.slice(end)}`;
    editor.selectionStart = editor.selectionEnd = start + tab.length;
    syncEditorMeta();
  });

  editor.addEventListener('input', syncEditorMeta);
  editor.addEventListener('keyup', syncEditorMeta);
  editor.addEventListener('click', syncEditorMeta);
  editor.addEventListener('scroll', syncScroll);

  syncEditorMeta();
  syncScroll();
});
