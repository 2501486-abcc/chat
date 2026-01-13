document.addEventListener('DOMContentLoaded', () => {
  const LANG_KEY = 'siteLang';
  const DEFAULT_LANG = 'en';
  const I18N = {
    en: {
      title: 'Home Dashboard',
      menu: 'Menu',
      nav_home: 'Home',
      nav_messaging: 'Messaging',
      nav_connection: 'Connection',
      connected: '● Connected',
      card_connection_summary: 'Connection Summary',
      label_latency: 'Latency',
      label_packet_loss: 'Packet Loss',
      card_last_test: 'Last Test',
      label_status: 'Status',
      label_avg_rtt: 'Avg RTT',
      card_quick_actions: 'Quick Actions',
      btn_run_test: 'Run Test',
      btn_open_messaging: 'Open Messaging',
      card_latency_trend: 'Latency Trend',
      graph_preview: 'Graph Preview',
      lang_english: 'English',
      lang_japanese: '日本語',
      quality_excellent: 'Excellent',
      quality_good: 'Good',
      quality_fair: 'Fair',
      quality_poor: 'Poor',
      quality_offline: 'Offline',
      quality_testing: 'Testing…'
    },
    ja: {
      title: 'ホームダッシュボード',
      menu: 'メニュー',
      nav_home: 'ホーム',
      nav_messaging: 'メッセージ',
      nav_connection: '接続',
      connected: '● 接続中',
      card_connection_summary: '接続サマリー',
      label_latency: '遅延',
      label_packet_loss: 'パケットロス',
      card_last_test: '前回のテスト',
      label_status: '状態',
      label_avg_rtt: '平均RTT',
      card_quick_actions: 'クイック操作',
      btn_run_test: 'テスト開始',
      btn_open_messaging: 'メッセージを開く',
      card_latency_trend: '遅延の推移',
      graph_preview: 'グラフ表示',
      lang_english: 'English',
      lang_japanese: '日本語',
      quality_excellent: 'とても良い',
      quality_good: '良い',
      quality_fair: '普通',
      quality_poor: '悪い',
      quality_offline: 'オフライン',
      quality_testing: '測定中…'
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

    document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
      const isActive = btn.getAttribute('data-lang') === lang;
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'ja') return;
    localStorage.setItem(LANG_KEY, lang);
    applyTranslations();
    applyStatsToHome(loadStats());
  }

  document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
  });

  window.addEventListener('storage', (e) => {
    if (e.key === LANG_KEY) {
      applyTranslations();
      applyStatsToHome(loadStats());
    }
  });

  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("toggle-btn");

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle("collapsed");
    const isCollapsed = sidebar.classList.contains("collapsed");
    toggleBtn.setAttribute("aria-expanded", !isCollapsed);
  });

  // Pull latest network-test stats from Simulation page
  const STORAGE_KEY = 'networkTestStats';
  const latencyEl = document.getElementById('homeLatency');
  const lossEl = document.getElementById('homeLoss');
  const statusEl = document.getElementById('homeStatus');
  const avgEl = document.getElementById('homeAvgRtt');
  const trendEl = document.getElementById('homeTrend');
  const trendLabelEl = document.getElementById('homeTrendLabel');
  const trendCanvas = document.getElementById('homeGraph');
  const runTestBtn = document.getElementById('runTestBtn');

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name);
    const trimmed = value ? value.trim() : '';
    return trimmed || fallback;
  }

  function renderTrendGraph(stats) {
    if (!trendEl || !trendCanvas) return;

    const points = Array.isArray(stats?.points) ? stats.points : [];
    const hasData = points.some(p => Number.isFinite(p?.ms));

    if (trendLabelEl) {
      trendLabelEl.style.display = hasData ? 'none' : 'flex';
      if (!hasData) trendLabelEl.textContent = t('graph_preview');
    }

    const ctx = trendCanvas.getContext('2d');
    if (!ctx) return;

    const rect = trendCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (trendCanvas.width !== w || trendCanvas.height !== h) {
      trendCanvas.width = w;
      trendCanvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(239, 227, 218, 0.35)';
    ctx.fillRect(0, 0, w, h);

    if (!hasData) return;

    const padding = 10 * dpr;
    const plotW = w - padding * 2;
    const plotH = h - padding * 2;

    const values = points.map(p => p?.ms).filter(v => Number.isFinite(v));
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const span = (maxV - minV) || 1;

    const lineColor = cssVar('--pink-accent', '#D9A5B3');

    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = lineColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    let started = false;
    const n = Math.max(2, points.length);

    for (let i = 0; i < points.length; i++) {
      const ms = points[i]?.ms;
      const x = padding + (i / (n - 1)) * plotW;
      if (!Number.isFinite(ms)) {
        started = false;
        continue;
      }
      const y = padding + plotH - ((ms - minV) / span) * plotH;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Last point marker
    for (let i = points.length - 1; i >= 0; i--) {
      const ms = points[i]?.ms;
      if (!Number.isFinite(ms)) continue;
      const x = padding + (i / (n - 1)) * plotW;
      const y = padding + plotH - ((ms - minV) / span) * plotH;
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  function formatMs(ms) {
    if (ms == null || Number.isNaN(ms)) return '—';
    return `${Math.round(ms)} ms`;
  }

  function formatPct(pct) {
    if (pct == null || Number.isNaN(pct)) return '—';
    return `${pct.toFixed(0)}%`;
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function applyStatsToHome(stats) {
    if (!stats) return;
    if (latencyEl) latencyEl.textContent = formatMs(stats.lastMs);
    if (lossEl) lossEl.textContent = formatPct(stats.lossPct);
    if (statusEl) {
      const qualityKey = stats.qualityKey;
      if (typeof qualityKey === 'string' && qualityKey) {
        statusEl.textContent = t(`quality_${qualityKey}`);
      } else {
        statusEl.textContent = stats.quality || '—';
      }
    }
    if (avgEl) avgEl.textContent = formatMs(stats.avgMs);

    renderTrendGraph(stats);
  }

  applyStatsToHome(loadStats());

  applyTranslations();

  // Keep cards in sync if simulation updates in another tab.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      applyStatsToHome(loadStats());
    }
  });

  window.addEventListener('resize', () => {
    renderTrendGraph(loadStats());
  });

  if (runTestBtn) {
    runTestBtn.addEventListener('click', () => {
      window.location.href = '../simulation/index.html';
    });
  }

  const openMsgBtn = document.getElementById('openMessagingBtn');
  if (openMsgBtn) {
    openMsgBtn.addEventListener('click', () => {
      window.location.href = '../sms/index.html';
    });
  }
});
