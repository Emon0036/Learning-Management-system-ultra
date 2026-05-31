const timer = document.querySelector('.timer');
const quizForm = document.getElementById('quizForm');
const timerText = document.getElementById('timerText');
const timeSpent = document.getElementById('timeSpent');
const autoSubmitted = document.getElementById('autoSubmitted');
const autoSubmitReason = document.getElementById('autoSubmitReason');
const examFocusWarning = document.getElementById('examFocusWarning');
const examFocusWarningText = document.getElementById('examFocusWarningText');

if (timer && quizForm && timerText) {
  const totalSeconds = Number(timer.dataset.duration) * 60;
  const startedAt = Date.now();
  const originalDocumentTitle = document.title;
  const focusGraceSeconds = 5;
  const focusGraceLimit = 2;
  let remaining = totalSeconds;
  let alreadySubmitted = false;
  let focusWarningCount = 0;
  let focusGraceTimer = null;
  let focusGraceCountdownInterval = null;
  let focusGraceDeadline = 0;
  let activeFocusReason = '';
  const clipboardShortcutReasons = {
    c: 'clipboard_copy_shortcut',
    v: 'clipboard_paste_shortcut',
    x: 'clipboard_cut_shortcut',
  };

  function syncTimeSpent() {
    if (!timeSpent) return;
    timeSpent.value = Math.min(totalSeconds, Math.floor((Date.now() - startedAt) / 1000));
  }

  function hideFocusWarning() {
    if (!examFocusWarning) return;
    examFocusWarning.classList.add('d-none');
  }

  function restoreDocumentTitle() {
    document.title = originalDocumentTitle;
  }

  function clearFocusGrace() {
    if (focusGraceTimer) {
      clearTimeout(focusGraceTimer);
      focusGraceTimer = null;
    }
    if (focusGraceCountdownInterval) {
      clearInterval(focusGraceCountdownInterval);
      focusGraceCountdownInterval = null;
    }
    focusGraceDeadline = 0;
    activeFocusReason = '';
  }

  function updateFocusWarning() {
    if (!focusGraceDeadline) return;
    const secondsLeft = Math.max(0, Math.ceil((focusGraceDeadline - Date.now()) / 1000));
    const chancesLeft = Math.max(0, focusGraceLimit - focusWarningCount);
    document.title = `Return in ${secondsLeft}s | ${originalDocumentTitle}`;

    if (examFocusWarning && examFocusWarningText) {
      examFocusWarning.classList.remove('d-none');
      examFocusWarningText.textContent =
        `Come back within ${secondsLeft}s to continue. ` +
        `${chancesLeft} tab-switch chance${chancesLeft === 1 ? '' : 's'} left after this.`;
    }
  }

  function cancelFocusGrace() {
    if (!focusGraceTimer) return;
    clearFocusGrace();
    hideFocusWarning();
    restoreDocumentTitle();
  }

  function startFocusGrace(reason) {
    if (alreadySubmitted || focusGraceTimer) return;

    if (focusWarningCount >= focusGraceLimit) {
      submitNow(reason || 'focus_lost');
      return;
    }

    focusWarningCount += 1;
    activeFocusReason = reason || 'focus_lost';
    focusGraceDeadline = Date.now() + focusGraceSeconds * 1000;
    updateFocusWarning();

    focusGraceCountdownInterval = setInterval(updateFocusWarning, 250);
    focusGraceTimer = setTimeout(() => {
      submitNow(activeFocusReason);
    }, focusGraceSeconds * 1000);
  }

  function submitNow(reason) {
    if (alreadySubmitted) return;
    alreadySubmitted = true;

    syncTimeSpent();
    if (autoSubmitted) autoSubmitted.value = '1';
    if (autoSubmitReason) autoSubmitReason.value = String(reason || 'focus_lost');

    clearInterval(interval);
    clearInterval(focusCheckInterval);
    clearFocusGrace();
    hideFocusWarning();
    restoreDocumentTitle();

    // Use native submit for automatic submission so required validation does not block it.
    quizForm.noValidate = true;
    quizForm.submit();
  }

  function submitForSecurityEvent(event, reason) {
    if (event) event.preventDefault();
    submitNow(reason);
  }

  // Timer countdown
  const interval = setInterval(() => {
    remaining -= 1;
    const minutes = Math.floor(remaining / 60);
    const seconds = String(remaining % 60).padStart(2, '0');
    timerText.textContent = `${minutes}:${seconds}`;
    syncTimeSpent();

    if (remaining <= 60) timer.classList.add('timer-danger');
    if (remaining <= 0) {
      submitNow('time_up');
    }
  }, 1000);

  // Continuous focus monitor for tabs, notifications, and app switches
  const focusCheckInterval = setInterval(() => {
    if (alreadySubmitted) return;
    if (!document.hasFocus() || document.visibilityState !== 'visible') {
      startFocusGrace('focus_lost');
    } else {
      cancelFocusGrace();
    }
  }, 500);

  quizForm.addEventListener('submit', () => {
    alreadySubmitted = true;
    syncTimeSpent();
  });

  // Tab visibility change - auto submit when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !alreadySubmitted) {
      startFocusGrace('tab_hidden');
    } else if (!document.hidden && document.hasFocus()) {
      cancelFocusGrace();
    }
  });

  // Window blur - auto submit when user switches window
  window.addEventListener('blur', () => {
    if (!alreadySubmitted) {
      startFocusGrace('window_blur');
    }
  });

  window.addEventListener('focus', () => {
    if (!alreadySubmitted && document.visibilityState === 'visible') {
      cancelFocusGrace();
    }
  });

  // Fallback for modern browsers when page is hidden or closed
  window.addEventListener('pagehide', () => {
    if (!alreadySubmitted) submitNow('page_hide');
  });

  // Prevent right-click and developer tools opening
  document.addEventListener('keydown', (e) => {
    const key = String(e.key || '').toLowerCase();

    // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key))) {
      submitForSecurityEvent(e, 'dev_tools_attempted');
      return;
    }

    // Copy, cut, and paste shortcuts are treated as exam security violations.
    if ((e.ctrlKey || e.metaKey) && clipboardShortcutReasons[key]) {
      submitForSecurityEvent(e, clipboardShortcutReasons[key]);
      return;
    }

    // Common alternate clipboard shortcuts on Windows/Linux keyboards.
    if (e.shiftKey && key === 'insert') {
      submitForSecurityEvent(e, 'clipboard_paste_shortcut');
      return;
    }

    if (e.ctrlKey && key === 'insert') {
      submitForSecurityEvent(e, 'clipboard_copy_shortcut');
    }
  });

  document.addEventListener(
    'copy',
    (e) => {
      submitForSecurityEvent(e, 'clipboard_copy');
    },
    true
  );

  document.addEventListener(
    'cut',
    (e) => {
      submitForSecurityEvent(e, 'clipboard_cut');
    },
    true
  );

  document.addEventListener(
    'paste',
    (e) => {
      submitForSecurityEvent(e, 'clipboard_paste');
    },
    true
  );

  document.addEventListener(
    'beforeinput',
    (e) => {
      if (['insertFromPaste', 'insertFromPasteAsQuotation'].includes(e.inputType)) {
        submitForSecurityEvent(e, 'clipboard_paste');
      }
    },
    true
  );

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Warn before closing/navigating away
  window.addEventListener('beforeunload', (e) => {
    if (!alreadySubmitted) {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave? Closing or navigating away can auto-submit your exam.';
    }
  });

  // Prevent back button
  history.pushState(null, null, window.location.href);
  window.addEventListener('popstate', () => {
    history.pushState(null, null, window.location.href);
  });
}

