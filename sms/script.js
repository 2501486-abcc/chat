const ws = new WebSocket("ws://13.70.46.116:3000");

const PROMPT_AFTER_MS = 5 * 60 * 1000;

let isMatched = false;
let lastStatusState = null;
let sendBlockedNoticeShown = false;

let chatStartedAt = null;
let timerIntervalId = null;

function setChatStatus(state, text) {
  const el = document.getElementById('chatStatus');
  if (!el) return;
  if (state) el.setAttribute('data-state', state);
  if (typeof text === 'string') el.textContent = text;
}

function isJa() {
  return (document.documentElement.lang || 'en').toLowerCase().startsWith('ja');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatMMSS(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function ensureTimerLoop() {
  if (timerIntervalId) return;
  timerIntervalId = setInterval(updateChatTimer, 1000);
}

function clearTimerLoopIfIdle() {
  if (!timerIntervalId) return;
  if (isMatched) return;
  clearInterval(timerIntervalId);
  timerIntervalId = null;
}

function resetChatTimer() {
  chatStartedAt = null;
  updateChatTimer();
}

function maybeStartChatTimer() {
  if (!isMatched) return;
  if (typeof chatStartedAt === 'number') return;
  chatStartedAt = Date.now();
  ensureTimerLoop();
  updateChatTimer();
}

function updateChatTimer() {
  const el = document.getElementById('chatTimer');
  if (!el) return;

  if (!isMatched) {
    el.textContent = '';
    clearTimerLoopIfIdle();
    return;
  }

  // Connected but no chat yet (server starts the 5-min timer on first real message).
  if (typeof chatStartedAt !== 'number') {
    el.textContent = isJa()
      ? '※ 最初のメッセージ送受信から5分後に（待機ユーザーがいれば）相手変更の選択が出ます。'
      : 'Note: After your first message, the keep/switch prompt can appear at 5:00 (only if others are waiting).';
    ensureTimerLoop();
    return;
  }

  const elapsed = Date.now() - chatStartedAt;
  const remaining = PROMPT_AFTER_MS - elapsed;
  if (remaining > 0) {
    el.textContent = isJa()
      ? `相手変更の選択まで: ${formatMMSS(remaining)}（待機ユーザーがいる場合）`
      : `Partner change option in: ${formatMMSS(remaining)} (if someone is waiting)`;
    return;
  }

  el.textContent = isJa()
    ? '相手変更の選択が可能です（待機ユーザーがいる場合）'
    : 'Partner change option is available (if someone is waiting)';
}

function refreshChatStatusText() {
  const el = document.getElementById('chatStatus');
  if (!el) return;
  const state = el.getAttribute('data-state') || 'waiting';
  setChatStatus(state, statusLabel(state));
}

function statusLabel(state) {
  const lang = document.documentElement.lang || 'en';
  const isJa = lang.toLowerCase().startsWith('ja');

  if (state === 'connected') return isJa ? '接続しました' : 'Connected';
  if (state === 'waiting') return isJa ? '相手を待っています…' : 'Waiting for partner…';
  if (state === 'disconnected') return isJa ? '相手が切断しました' : 'Partner disconnected';
  return isJa ? '状態を確認中…' : 'Checking…';
}

function sendJSON(payload) {
  try {
    ws.send(JSON.stringify(payload));
  } catch (_) {
    // ignore
  }
}

function clearConversation() {
  const log = document.getElementById('log');
  if (log) log.innerHTML = '';
}

function setModalOpen(isOpen) {
  const modal = document.getElementById('rematchModal');
  if (!modal) return;
  modal.classList.toggle('open', Boolean(isOpen));
  modal.setAttribute('aria-hidden', String(!isOpen));
}

function showRematchPrompt(waitingCount) {
  const body = document.getElementById('rematchBody');
  if (body) {
    const lang = document.documentElement.lang || 'en';
    const isJa = lang.toLowerCase().startsWith('ja');
    if (Number.isFinite(waitingCount) && waitingCount > 0) {
      body.textContent = isJa
        ? `新しいユーザーが待っています（${waitingCount}人）。今の相手と続けますか？それとも別の相手とマッチしますか？`
        : `${waitingCount} new user(s) waiting. Keep chatting with your current partner, or match someone else?`;
    }
  }
  setModalOpen(true);
}

function appendMessage(text, kind) {
  const log = document.getElementById("log");
  if (!log) return;

  const li = document.createElement("li");
  li.classList.add("message");
  if (kind === 'system') {
    li.classList.add('system');
  } else {
    li.classList.add(kind === "self" ? "self" : "other");
  }
  li.textContent = text;
  log.appendChild(li);

  // Keep the newest message visible.
  log.scrollTop = log.scrollHeight;
}

ws.onmessage = (e) => {
  const raw = String(e.data ?? "");

  // Server may send JSON status messages.
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.type === 'rematch_prompt') {
        // Only prompt if currently chatting.
        if (isMatched) {
          showRematchPrompt(Number(parsed.waitingCount));
        }
        return;
      }

      if (parsed?.type === 'rematch_pending') {
        appendMessage(isJa() ? '相手の選択を待っています…' : 'Waiting for your partner’s choice…', 'system');
        return;
      }

      if (parsed?.type === 'rematch_result' && parsed?.result === 'stay') {
        setModalOpen(false);
        // Server resets its 5-minute timer when both users choose keep.
        chatStartedAt = Date.now();
        updateChatTimer();
        appendMessage((document.documentElement.lang || 'en').toLowerCase().startsWith('ja') ? 'このまま続けます。' : 'Staying with current partner.', 'system');
        return;
      }

      if (parsed?.type === 'conversation_end') {
        setModalOpen(false);
        clearConversation();
        isMatched = false;
        sendBlockedNoticeShown = false;
        lastStatusState = null;
        resetChatTimer();

        const reason = String(parsed.reason || '');
        const isJa = (document.documentElement.lang || 'en').toLowerCase().startsWith('ja');
        const msg =
          reason === 'partner_chose_rematch'
            ? (isJa ? '相手が別の相手とマッチすることを選びました。会話を終了します。' : 'Your partner chose to match with someone else. Ending this conversation.')
            : reason === 'you_chose_rematch'
              ? (isJa ? '別の相手とマッチします。会話を終了します。' : 'Matching with someone else. Ending this conversation.')
              : reason === 'partner_disconnected'
                ? (isJa ? '相手が切断しました。会話を終了します。' : 'Your partner disconnected. Ending this conversation.')
                : (isJa ? '会話を終了しました。' : 'Conversation ended.');

        appendMessage(msg, 'system');
        setChatStatus('waiting', statusLabel('waiting'));
        return;
      }

      if (parsed?.type === 'status') {
        const state = String(parsed.state || '');

        // Avoid spamming repeated status updates.
        if (state === lastStatusState) {
          setChatStatus(state, statusLabel(state));
          return;
        }

        lastStatusState = state;
        sendBlockedNoticeShown = false;

        if (state === 'connected') {
          isMatched = true;
          resetChatTimer();
          ensureTimerLoop();
        }
        if (state === 'waiting' || state === 'disconnected') {
          isMatched = false;
          resetChatTimer();
        }
        setChatStatus(state, statusLabel(state));

        if (state === 'connected') appendMessage(statusLabel('connected'), 'system');
        if (state === 'disconnected') appendMessage(statusLabel('disconnected'), 'system');
        return;
      }
    } catch (_) {
      // fall through: treat as normal message
    }
  }

  // Normal chat message received.
  if (isMatched) maybeStartChatTimer();
  appendMessage(raw, "other");
};

function send() {
  const input = document.getElementById("msg");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  if (!isMatched) {
    // Only show the waiting notice once per waiting period.
    if (!sendBlockedNoticeShown) {
      appendMessage(statusLabel('waiting'), 'system');
      sendBlockedNoticeShown = true;
    }
    return;
  }

  sendBlockedNoticeShown = false;

  // A real chat message starts the server's 5-minute timer; mirror that on the client.
  maybeStartChatTimer();

  // Optimistic UI: show your message immediately.
  appendMessage(text, "self");
  ws.send(text);
  input.value = "";

  // User asked for the placeholder to be empty after sending.
  input.setAttribute('placeholder', '');
  input.focus();
}

// Sidebar toggle (same behavior as Home Screen)
document.addEventListener('DOMContentLoaded', () => {
  const LANG_KEY = 'siteLang';
  const DEFAULT_LANG = 'en';
  const I18N = {
    en: {
      title: 'SMS Chat',
      menu: 'Menu',
      nav_home: 'Home',
      nav_messaging: 'Messaging',
      nav_connection: 'Connection',
      lang_english: 'English',
      lang_japanese: '日本語',
      sms_title: '1-on-1 Anonymous Chat',
      sms_subtitle: 'Waiting until the other person connects.',
      sms_placeholder: 'Type a message',
      sms_send: 'Send'
    },
    ja: {
      title: 'SMSチャット',
      menu: 'メニュー',
      nav_home: 'ホーム',
      nav_messaging: 'メッセージ',
      nav_connection: '接続',
      lang_english: 'English',
      lang_japanese: '日本語',
      sms_title: '1対1 匿名チャット',
      sms_subtitle: '相手が接続するまで待機します。',
      sms_placeholder: 'メッセージを入力',
      sms_send: '送信'
    }
  };

  function getLang() {
    const raw = localStorage.getItem(LANG_KEY);
    return raw === 'ja' || raw === 'en' ? raw : DEFAULT_LANG;
  }

  function t(key) {
    const lang = getLang();
    return I18N[lang]?.[key] ?? I18N[DEFAULT_LANG]?.[key] ?? key;
  }

  function applyTranslations() {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.title = t('title');

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      el.setAttribute('placeholder', t(key));
    });

    document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
      const isActive = btn.getAttribute('data-lang') === lang;
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // Keep match status label in sync with the selected language.
    refreshChatStatusText();
    updateChatTimer();
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'ja') return;
    localStorage.setItem(LANG_KEY, lang);
    applyTranslations();
  }

  document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
  });

  window.addEventListener('storage', (e) => {
    if (e.key === LANG_KEY) applyTranslations();
  });

  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("toggle-btn");

  if (sidebar && toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle("collapsed");
      const isCollapsed = sidebar.classList.contains("collapsed");
      toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
    });
  }

  // Initial status on load (will be re-labeled after translations apply).
  setChatStatus('waiting', statusLabel('waiting'));

  // Rematch modal actions.
  const keepBtn = document.getElementById('rematchKeep');
  const switchBtn = document.getElementById('rematchSwitch');
  if (keepBtn) {
    keepBtn.addEventListener('click', () => {
      setModalOpen(false);
      sendJSON({ type: 'rematch_choice', choice: 'keep' });
    });
  }
  if (switchBtn) {
    switchBtn.addEventListener('click', () => {
      setModalOpen(false);
      sendJSON({ type: 'rematch_choice', choice: 'rematch' });
    });
  }

  // Send on Enter (common messaging-app behavior).
  const input = document.getElementById('msg');
  if (input) {
    let isComposing = false;

    input.addEventListener('compositionstart', () => {
      isComposing = true;
    });

    input.addEventListener('compositionend', () => {
      isComposing = false;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (e.shiftKey) return;
      if (e.isComposing || isComposing) return;
      e.preventDefault();
      send();
    });
  }

  applyTranslations();
});
