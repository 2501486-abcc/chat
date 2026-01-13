document.addEventListener('DOMContentLoaded', () => {
  const LANG_KEY = 'siteLang';
  const DEFAULT_LANG = 'en';
  const I18N = {
    en: {
      title: 'Network Simulation',
      menu: 'Menu',
      nav_home: 'Home',
      nav_messaging: 'Messaging',
      nav_connection: 'Connection',
      lang_english: 'English',
      lang_japanese: '日本語',
      conn_checking: 'Checking…',
      online: 'Online',
      offline: 'Offline',
      start_test: 'Start Test',
      stop: 'Stop',
      live_status: 'Live Status',
      hint_ready: 'Click “Start Test” to begin measuring fetch latency to a local endpoint.',
      hint_running: 'Running… measuring latency to ./ping.json',
      hint_stopped: 'Stopped. You can start again any time.',
      error_failed: 'Network test failed. If you opened this as a file, run it via a local server.',
      card_connection_summary: 'Connection Summary',
      label_status: 'Status',
      label_last_ping: 'Last ping',
      label_avg_ping: 'Avg ping (last 20)',
      label_jitter: 'Jitter (last 20)',
      latency_graph: 'Latency Graph (ms)',
      legend_ping: 'Ping (ms)',
      no_data: 'No data yet. Start the test to see live latency.',
      quality_excellent: 'Excellent',
      quality_good: 'Good',
      quality_fair: 'Fair',
      quality_poor: 'Poor',
      quality_offline: 'Offline',
      quality_testing: 'Testing…'
    },
    ja: {
      title: '接続テスト',
      menu: 'メニュー',
      nav_home: 'ホーム',
      nav_messaging: 'メッセージ',
      nav_connection: '接続',
      lang_english: 'English',
      lang_japanese: '日本語',
      conn_checking: '確認中…',
      online: 'オンライン',
      offline: 'オフライン',
      start_test: 'テスト開始',
      stop: '停止',
      live_status: 'ライブ状態',
      hint_ready: '「テスト開始」を押すと、ローカルのエンドポイントへの遅延を測定します。',
      hint_running: '測定中… ./ping.json への遅延を計測しています',
      hint_stopped: '停止しました。いつでも再開できます。',
      error_failed: 'テストに失敗しました。file:// で開いている場合は、ローカルサーバーで開いてください。',
      card_connection_summary: '接続サマリー',
      label_status: '状態',
      label_last_ping: '最新のPing',
      label_avg_ping: '平均Ping（直近20回）',
      label_jitter: 'ジッター（直近20回）',
      latency_graph: '遅延グラフ（ms）',
      legend_ping: 'Ping（ms）',
      no_data: 'データがありません。テスト開始で遅延を表示します。',
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
    updateStatsUI();
    drawGraph();
  }

  document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
  });

  window.addEventListener('storage', (e) => {
    if (e.key === LANG_KEY) {
      applyTranslations();
      updateStatsUI();
      drawGraph();
    }
  });

  // Sidebar toggle (same behavior as Home)
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-btn');
  if (sidebar && toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
    });
  }

  const connDot = document.getElementById('connDot');
  const connText = document.getElementById('connText');

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');

  const statusLabel = document.getElementById('statusLabel');
  const lastPing = document.getElementById('lastPing');
  const avgPing = document.getElementById('avgPing');
  const jitter = document.getElementById('jitter');

  const effectiveType = document.getElementById('effectiveType');
  const downlink = document.getElementById('downlink');
  const reportedRtt = document.getElementById('reportedRtt');
  const saveData = document.getElementById('saveData');

  const hint = document.getElementById('hint');
  const errorEl = document.getElementById('error');

  const canvas = document.getElementById('graph');
  const ctx = canvas ? canvas.getContext('2d') : null;

  const PING_ENDPOINT = './ping.json';
  const SAMPLE_MS = 1200;
  const MAX_POINTS = 60;
  const STATS_WINDOW = 20;

  const STORAGE_KEY = 'networkTestStats';

  let timerId = null;
  let points = [];

  function restorePersistedPoints() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const storedPoints = Array.isArray(parsed?.points) ? parsed.points : null;
      if (!storedPoints) return;

      points = storedPoints
        .filter(p => p && typeof p === 'object')
        .map(p => ({
          t: typeof p.t === 'number' ? p.t : Date.now(),
          ms: typeof p.ms === 'number' ? p.ms : NaN
        }))
        .slice(-MAX_POINTS);
    } catch (_) {
      // ignore malformed storage
    }
  }

  function setError(msg) {
    errorEl.textContent = msg || '';
  }

  function setOnlineUI(isOnline) {
    connDot.classList.toggle('connected', isOnline);
    connDot.classList.toggle('disconnected', !isOnline);
    connText.textContent = isOnline ? t('online') : t('offline');
  }

  function formatMs(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${Math.round(value)} ms`;
  }

  function estimateEffectiveTypeFromRtt(rttMs) {
    if (!Number.isFinite(rttMs)) return null;
    if (rttMs <= 80) return '4g';
    if (rttMs <= 150) return '3g';
    if (rttMs <= 300) return '2g';
    return 'slow-2g';
  }

  function mean(values) {
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function computeJitter(values) {
    if (values.length < 2) return null;
    const diffs = [];
    for (let i = 1; i < values.length; i++) {
      diffs.push(Math.abs(values[i] - values[i - 1]));
    }
    return mean(diffs);
  }

  function getRecentLatencies() {
    const recent = points.slice(-STATS_WINDOW).map(p => p.ms).filter(v => Number.isFinite(v));
    return recent;
  }

  function getRecentWindow() {
    return points.slice(-STATS_WINDOW);
  }

  function computeLossPct(windowPoints) {
    if (!windowPoints.length) return null;
    const missing = windowPoints.filter(p => !Number.isFinite(p.ms)).length;
    return (missing / windowPoints.length) * 100;
  }

  function bucketQualityKey(last) {
    if (!Number.isFinite(last)) return 'testing';
    if (last <= 60) return 'excellent';
    if (last <= 120) return 'good';
    if (last <= 250) return 'fair';
    return 'poor';
  }

  function qualityLabel(key) {
    return t(`quality_${key}`);
  }

  function persistStats(stats) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (_) {
      // ignore storage failures (private mode / quotas)
    }
  }

  function updateStatsUI() {
    const windowPoints = getRecentWindow();
    const recent = getRecentLatencies();
    const avg = mean(recent);
    const jit = computeJitter(recent);
    const lossPct = computeLossPct(windowPoints);

    const last = points.length ? points[points.length - 1].ms : null;

    lastPing.textContent = formatMs(last);
    avgPing.textContent = formatMs(avg);
    jitter.textContent = formatMs(jit);

    // Keep the device info card updated; used as fallback when API isn't supported.
    updateDeviceNetworkInfo({ avgMs: avg, lastMs: last });

    const isOnline = navigator.onLine;
    setOnlineUI(isOnline);

    if (!isOnline) {
      const qualityKey = 'offline';
      statusLabel.textContent = qualityLabel(qualityKey);
      persistStats({
        ts: Date.now(),
        isOnline: false,
        lastMs: Number.isFinite(last) ? last : null,
        avgMs: Number.isFinite(avg) ? avg : null,
        jitterMs: Number.isFinite(jit) ? jit : null,
        lossPct: Number.isFinite(lossPct) ? lossPct : null,
        quality: qualityLabel(qualityKey),
        qualityKey,
        points: points.slice(-MAX_POINTS)
      });
      return;
    }

    const qualityKey = bucketQualityKey(last);
    const quality = qualityLabel(qualityKey);
    statusLabel.textContent = quality;

    persistStats({
      ts: Date.now(),
      isOnline: true,
      lastMs: Number.isFinite(last) ? last : null,
      avgMs: Number.isFinite(avg) ? avg : null,
      jitterMs: Number.isFinite(jit) ? jit : null,
      lossPct: Number.isFinite(lossPct) ? lossPct : null,
      quality,
      qualityKey,
      points: points.slice(-MAX_POINTS)
    });
  }

  function updateDeviceNetworkInfo(fallback = {}) {
    // Device card removed from UI; keep logic safe if elements don't exist.
    if (!effectiveType || !downlink || !reportedRtt || !saveData) return;

    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const estimatedType = estimateEffectiveTypeFromRtt(fallback.avgMs ?? fallback.lastMs);

    if (!c) {
      effectiveType.textContent = estimatedType ? `${estimatedType} (estimated)` : 'Not supported';
      downlink.textContent = '—';
      reportedRtt.textContent = formatMs(fallback.avgMs ?? fallback.lastMs);
      saveData.textContent = '—';
      return;
    }

    effectiveType.textContent = c.effectiveType || (estimatedType ? `${estimatedType} (estimated)` : '—');
    downlink.textContent = typeof c.downlink === 'number' ? `${c.downlink.toFixed(1)} Mbps` : '—';
    reportedRtt.textContent = typeof c.rtt === 'number' ? `${c.rtt} ms` : formatMs(fallback.avgMs ?? fallback.lastMs);
    saveData.textContent = typeof c.saveData === 'boolean' ? (c.saveData ? 'On' : 'Off') : '—';
  }

  function drawGraph() {
    if (!canvas || !ctx) return;
    // Match internal resolution to CSS size for crispness.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const padding = 24 * dpr;
    const plotW = w - padding * 2;
    const plotH = h - padding * 2;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(239, 227, 218, 0.35)';
    ctx.fillRect(0, 0, w, h);

    // If no points, show a subtle hint
    if (!points.length) {
      ctx.fillStyle = 'rgba(62, 42, 31, 0.6)';
      ctx.font = `${12 * dpr}px Arial`;
      ctx.fillText(t('no_data'), padding, padding + 6 * dpr);
      return;
    }

    const ys = points.map(p => p.ms).filter(v => Number.isFinite(v));
    const maxY = Math.max(50, ...ys, 1);
    const minY = 0;

    // Grid
    ctx.strokeStyle = 'rgba(62, 42, 31, 0.12)';
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding + (plotH * i) / gridLines;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + plotW, y);
      ctx.stroke();

      const labelVal = Math.round(maxY - (maxY * i) / gridLines);
      ctx.fillStyle = 'rgba(62, 42, 31, 0.55)';
      ctx.font = `${11 * dpr}px Arial`;
      ctx.fillText(`${labelVal}ms`, 6 * dpr, y + 4 * dpr);
    }

    // Line (gap on missing samples)
    ctx.strokeStyle = '#D9A5B3';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();

    const startIndex = Math.max(0, points.length - MAX_POINTS);
    const slice = points.slice(startIndex);

    let hasOpenSegment = false;
    for (let i = 0; i < slice.length; i++) {
      const p = slice[i];
      if (!Number.isFinite(p.ms)) {
        hasOpenSegment = false;
        continue;
      }

      const x = padding + (plotW * i) / Math.max(1, slice.length - 1);
      const yNorm = (p.ms - minY) / (maxY - minY || 1);
      const y = padding + plotH - yNorm * plotH;

      if (!hasOpenSegment) {
        ctx.moveTo(x, y);
        hasOpenSegment = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Last point dot
    const last = slice[slice.length - 1];
    if (last && Number.isFinite(last.ms)) {
      const i = slice.length - 1;
      const x = padding + (plotW * i) / Math.max(1, slice.length - 1);
      const yNorm = (last.ms - minY) / (maxY - minY || 1);
      const y = padding + plotH - yNorm * plotH;
      ctx.fillStyle = '#D9A5B3';
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  async function measurePingOnce() {
    const start = performance.now();
    const url = `${PING_ENDPOINT}?t=${Date.now()}`;

    // NOTE: this is a same-origin request to a local file so we can avoid CORS issues.
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Ping request failed: ${res.status}`);
    }
    // Consume body to include transfer time.
    await res.text();

    const end = performance.now();
    return end - start;
  }

  async function tick() {
    try {
      setError('');
      if (!navigator.onLine) {
        points.push({ t: Date.now(), ms: NaN });
        points = points.slice(-MAX_POINTS);
        updateStatsUI();
        drawGraph();
        return;
      }

      const ms = await measurePingOnce();
      points.push({ t: Date.now(), ms });
      points = points.slice(-MAX_POINTS);

      updateStatsUI();
      drawGraph();
    } catch (e) {
      setError(t('error_failed'));
      // Record a missing sample so the graph reflects instability.
      points.push({ t: Date.now(), ms: NaN });
      points = points.slice(-MAX_POINTS);
      updateStatsUI();
      drawGraph();
    }
  }

  function start() {
    if (timerId) return;

    // Starting a new test should replace any previously saved results.
    points = [];
    setError('');
    updateStatsUI();
    drawGraph();

    hint.textContent = t('hint_running');
    startBtn.disabled = true;
    stopBtn.disabled = false;

    // Prime immediately, then interval.
    tick();
    timerId = window.setInterval(tick, SAMPLE_MS);
  }

  function stop() {
    if (!timerId) return;
    window.clearInterval(timerId);
    timerId = null;

    hint.textContent = t('hint_stopped');
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }

  // Wire up controls
  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);

  // Online/offline + connection info
  window.addEventListener('online', () => {
    setOnlineUI(true);
    updateDeviceNetworkInfo();
    updateStatsUI();
  });
  window.addEventListener('offline', () => {
    setOnlineUI(false);
    updateDeviceNetworkInfo();
    updateStatsUI();
  });

  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (c && c.addEventListener) {
    c.addEventListener('change', () => {
      updateDeviceNetworkInfo();
    });
  }

  // Initial render
  restorePersistedPoints();
  applyTranslations();
  updateDeviceNetworkInfo();
  updateStatsUI();
  drawGraph();
});
