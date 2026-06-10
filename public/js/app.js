(function initThemeToggle() {
  const STORAGE_KEY = 'quizAppTheme';
  const DARK_CLASS = 'theme-dark';
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function getTheme() {
    return document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light';
  }

  function updateThemeButtons(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const icon = button.querySelector('[data-theme-icon]');
      const label = button.querySelector('[data-theme-label]');
      const isDark = theme === 'dark';

      if (icon) {
        icon.classList.toggle('fa-moon', !isDark);
        icon.classList.toggle('fa-sun', isDark);
      }

      if (label) {
        label.textContent = isDark ? 'Light mode' : 'Dark mode';
      }

      button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      button.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function applyTheme(theme) {
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    const isDark = normalizedTheme === 'dark';

    document.documentElement.classList.toggle(DARK_CLASS, isDark);
    document.documentElement.dataset.theme = normalizedTheme;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

    if (themeMeta) {
      themeMeta.setAttribute('content', isDark ? '#1f2d33' : '#0e4b78');
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, normalizedTheme);
    } catch {}

    updateThemeButtons(normalizedTheme);
  }

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
  });

  applyTheme(getTheme());
})();

(function initTabSession() {
  const STORAGE_KEY = 'quizAppTabId';
  const WINDOW_NAME_PREFIX = 'quizapp-tab:';
  const url = new URL(window.location.href);
  const urlTab = url.searchParams.get('tab');
  const storedTab = window.sessionStorage.getItem(STORAGE_KEY);
  const bodyTab = document.body.dataset.currentTabId || '';
  const namedTab = window.name.startsWith(WINDOW_NAME_PREFIX)
    ? window.name.slice(WINDOW_NAME_PREFIX.length)
    : '';
  let tabId = bodyTab || urlTab || namedTab || storedTab;

  if (!tabId) {
    tabId = `tab-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  }

  window.sessionStorage.setItem(STORAGE_KEY, tabId);
  window.name = `${WINDOW_NAME_PREFIX}${tabId}`;

  if (urlTab !== tabId) {
    url.searchParams.set('tab', tabId);
    window.history.replaceState({}, '', url.toString());
  }

  function isInternalLink(href) {
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return false;
    try {
      const link = new URL(href, window.location.href);
      return link.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function appendTabParam(link) {
    try {
      const href = link.getAttribute('href');
      if (!isInternalLink(href)) return;
      const linkUrl = new URL(href, window.location.href);
      if (
        linkUrl.pathname === '/auth/login' ||
        linkUrl.pathname === '/auth/register' ||
        linkUrl.pathname === '/auth/forgot-password' ||
        linkUrl.pathname.startsWith('/auth/reset-password/')
      ) {
        linkUrl.searchParams.delete('tab');
        link.setAttribute('href', `${linkUrl.pathname}${linkUrl.search}${linkUrl.hash}`);
        return;
      }
      if (!linkUrl.searchParams.get('tab')) {
        linkUrl.searchParams.set('tab', tabId);
        link.setAttribute('href', linkUrl.toString());
      }
    } catch {}
  }

  function appendTabInput(form) {
    const action = form.getAttribute('action') || window.location.pathname;
    if (!isInternalLink(action)) return;
    try {
      const actionUrl = new URL(action, window.location.href);
      if (!actionUrl.searchParams.get('tab')) {
        actionUrl.searchParams.set('tab', tabId);
        form.setAttribute('action', `${actionUrl.pathname}${actionUrl.search}${actionUrl.hash}`);
      }
    } catch {}

    let input = form.querySelector('input[name="tab"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'tab';
      form.appendChild(input);
    }
    input.value = tabId;
  }

  document.querySelectorAll('a[href]').forEach((link) => appendTabParam(link));
  document.querySelectorAll('form').forEach((form) => appendTabInput(form));

  document.addEventListener(
    'click',
    (event) => {
      const link = event.target.closest ? event.target.closest('a[href]') : null;
      if (link) appendTabParam(link);
    },
    true
  );

  document.addEventListener(
    'submit',
    (event) => {
      if (event.target && event.target.tagName === 'FORM') {
        appendTabInput(event.target);
      }
    },
    true
  );

  function getRequestUrl(resource) {
    try {
      if (typeof resource === 'string') return new URL(resource, window.location.href);
      if (resource instanceof URL) return new URL(resource.toString(), window.location.href);
      if (typeof Request !== 'undefined' && resource instanceof Request) {
        return new URL(resource.url, window.location.href);
      }
      if (resource && typeof resource.url === 'string') {
        return new URL(resource.url, window.location.href);
      }
    } catch {}
    return null;
  }

  if (typeof window.fetch === 'function' && typeof window.Headers === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (resource, options = {}) => {
      const fetchOptions = options || {};
      const requestUrl = getRequestUrl(resource);
      if (!requestUrl || requestUrl.origin !== window.location.origin) {
        return originalFetch(resource, fetchOptions);
      }

      const requestHeaders =
        typeof Request !== 'undefined' && resource instanceof Request ? resource.headers : undefined;
      const headers = new Headers(fetchOptions.headers || requestHeaders);
      if (!headers.has('X-Tab-Session')) {
        headers.set('X-Tab-Session', tabId);
      }

      return originalFetch(resource, { ...fetchOptions, headers });
    };
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href]').forEach((link) => appendTabParam(link));
    document.querySelectorAll('form').forEach((form) => appendTabInput(form));
  });
})();

(function initProtectedCoursePlayback() {
  const protectedCourse = document.querySelector('[data-protected-course="true"]');
  if (!protectedCourse) return;

  const blockedCtrlKeys = new Set(['s', 'p', 'u']);
  const blockedDevKeys = new Set(['i', 'j', 'c']);
  const protectedPlayers = Array.from(protectedCourse.querySelectorAll('.course-video-player--protected'));
  const watermarkNodes = Array.from(protectedCourse.querySelectorAll('.course-video-watermark'));
  const reportUrl = protectedCourse.dataset.protectionReportUrl || '';
  let violationInProgress = false;

  function kickOutForViolation(reason) {
    if (violationInProgress) return;
    violationInProgress = true;

    const redirectToLogin = (url) => {
      window.location.assign(url || '/auth/login');
    };

    if (!reportUrl || typeof window.fetch !== 'function') {
      redirectToLogin('/auth/login');
      return;
    }

    window.fetch(reportUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      keepalive: true,
    })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => redirectToLogin(payload.redirect))
      .catch(() => redirectToLogin('/auth/login'));
  }

  protectedCourse.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.course-video-player')) {
      event.preventDefault();
      kickOutForViolation('right-click on protected video');
    }
  });

  protectedCourse.querySelectorAll('video').forEach((video) => {
    video.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('playsinline', '');
    video.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  document.addEventListener('keydown', (event) => {
    const key = String(event.key || '').toLowerCase();
    const isProtectedShortcut =
      key === 'f12' ||
      key === 'printscreen' ||
      ((event.ctrlKey || event.metaKey) && blockedCtrlKeys.has(key)) ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && blockedDevKeys.has(key));

    if (!isProtectedShortcut) return;
    event.preventDefault();
    event.stopPropagation();

    if (key === 'printscreen' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText('').catch(() => {});
    }

    kickOutForViolation(`blocked shortcut: ${event.key || key}`);
  }, true);

  if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
    try {
      navigator.mediaDevices.getDisplayMedia = () => {
        kickOutForViolation('browser screen capture attempt');
        return Promise.reject(new DOMException('Screen capture is disabled in protected courses.', 'NotAllowedError'));
      };
    } catch {}
  }

  function updateWatermarks() {
    if (!watermarkNodes.length) return;
    const timestamp = new Date().toLocaleString();
    watermarkNodes.forEach((node) => {
      const baseText = node.dataset.baseWatermark || node.textContent.trim();
      node.dataset.baseWatermark = baseText;
      node.textContent = `${baseText} | ${timestamp}`;
    });
  }

  function moveWatermarks() {
    watermarkNodes.forEach((node, index) => {
      const top = 18 + Math.random() * 64;
      const left = 18 + Math.random() * 64;
      const rotation = index % 2 === 0
        ? -8 + Math.random() * 16
        : -22 + Math.random() * 44;

      node.style.top = `${top}%`;
      node.style.left = `${left}%`;
      node.style.transform = `translate(-50%, -50%) rotate(${rotation.toFixed(1)}deg)`;
    });
  }

  function pauseProtectedVideos() {
    protectedCourse.querySelectorAll('video').forEach((video) => {
      if (!video.paused) video.pause();
    });
  }

  function setPlaybackShield(active) {
    protectedPlayers.forEach((player) => {
      player.classList.toggle('is-obscured', active);
    });
    if (active) pauseProtectedVideos();
  }

  document.addEventListener('visibilitychange', () => {
    setPlaybackShield(document.hidden);
  });

  updateWatermarks();
  moveWatermarks();
  window.setInterval(updateWatermarks, 30000);
  window.setInterval(moveWatermarks, 9000);
})();

(function initCourseCurriculumBuilder() {
  const expandButton = document.querySelector('[data-expand-curriculum]');
  if (!expandButton) return;

  const topics = Array.from(document.querySelectorAll('.curriculum-topic'));
  if (!topics.length) return;

  function allTopicsOpen() {
    return topics.every((topic) => topic.open);
  }

  function updateLabel() {
    expandButton.textContent = allTopicsOpen() ? 'Collapse All' : 'Expand All';
  }

  expandButton.addEventListener('click', () => {
    const shouldOpen = !allTopicsOpen();
    topics.forEach((topic) => {
      topic.open = shouldOpen;
    });
    updateLabel();
  });

  topics.forEach((topic) => topic.addEventListener('toggle', updateLabel));
  updateLabel();
})();

(function initTeacherQuestionForm() {
  const form = document.querySelector('.modern-question-form');
  if (!form) return;

  const questionTypeField = form.querySelector('.question-type');
  const optionsBox = form.querySelector('#optionsBox');
  const codingFields = form.querySelector('#codingFields');
  const correctAnswerGroup = form.querySelector('#correctAnswerGroup');
  const manualAnswerGroup = form.querySelector('#manualAnswerGroup');
  const textAnswerField = form.querySelector('#correctAnswerField');
  const manualCorrectAnswerField = form.querySelector('#manualCorrectAnswerField');
  const trueFalseAnswerField = form.querySelector('#trueFalseAnswerField');
  const correctAnswerHelp = form.querySelector('#correctAnswerHelp');
  const explanationGroup = form.querySelector('#explanationGroup');
  const explanationField = form.querySelector('#explanationField');
  const optionInputs = Array.from(form.querySelectorAll('#optionsBox input'));
  const addQuizTestCaseButton = form.querySelector('#addQuizTestCase');
  const testCasesContainer = form.querySelector('#testCasesContainer');
  const languageField = form.querySelector('#language');

  if (!questionTypeField) return;

  function setElementVisible(element, visible) {
    if (!element) return;
    element.classList.toggle('d-none', !visible);
  }

  function setFieldEnabled(field, enabled) {
    if (!field) return;
    field.disabled = !enabled;
    field.required = enabled && field.dataset.optional !== 'true';
  }

  function setCodingFieldsEnabled(enabled) {
    if (!codingFields) return;
    codingFields.querySelectorAll('input, textarea, select').forEach((field) => {
      field.disabled = !enabled;
    });
    if (languageField) languageField.required = enabled;
  }

  function applyQuestionMode() {
    const type = questionTypeField.value;
    const isCoding = type === 'coding';
    const isShortAnswer = type === 'short-answer';
    const isTrueFalse = type === 'true-false';
    const isMultipleChoice = type === 'multiple-choice';
    const isManualReview = isShortAnswer || isCoding;

    setElementVisible(optionsBox, isMultipleChoice);
    setElementVisible(codingFields, isCoding);
    setElementVisible(correctAnswerGroup, !isManualReview);
    setElementVisible(manualAnswerGroup, isManualReview);
    setElementVisible(explanationGroup, !isManualReview);
    setElementVisible(textAnswerField, isMultipleChoice);
    setElementVisible(trueFalseAnswerField, isTrueFalse);

    setFieldEnabled(textAnswerField, isMultipleChoice);
    setFieldEnabled(manualCorrectAnswerField, isManualReview);
    setFieldEnabled(trueFalseAnswerField, isTrueFalse);
    if (explanationField) explanationField.disabled = isManualReview;
    setCodingFieldsEnabled(isCoding);

    optionInputs.forEach((input) => {
      input.required = isMultipleChoice;
      input.disabled = !isMultipleChoice;
    });

    if (correctAnswerHelp) {
      if (isMultipleChoice) correctAnswerHelp.textContent = 'For multiple choice, this must match one option exactly.';
      else if (isTrueFalse) correctAnswerHelp.textContent = 'Choose the correct truth value.';
    }

    if (textAnswerField) {
      if (isMultipleChoice) textAnswerField.placeholder = 'Enter the exact correct option text';
    }

    if (manualCorrectAnswerField) {
      manualCorrectAnswerField.rows = isCoding ? 8 : 4;
      manualCorrectAnswerField.placeholder = isCoding
        ? 'Paste the reference solution or expected approach'
        : 'Write the correct or ideal short answer';
    }
  }

  function addTestCase() {
    if (!testCasesContainer) return;
    const testCaseCount = testCasesContainer.children.length;
    const wrapper = document.createElement('div');
    wrapper.className = 'test-case mb-3';
    wrapper.innerHTML = `
      <textarea class="form-control mb-2" name="testCaseInputs[]" rows="3" placeholder="Sample Input ${testCaseCount + 1}"></textarea>
      <textarea class="form-control" name="testCaseOutputs[]" rows="2" placeholder="Sample Output ${testCaseCount + 1}"></textarea>
    `;
    testCasesContainer.appendChild(wrapper);
  }

  questionTypeField.addEventListener('change', applyQuestionMode);
  if (addQuizTestCaseButton) addQuizTestCaseButton.addEventListener('click', addTestCase);
  applyQuestionMode();
})();
