// Popup 逻辑
const defaultSettings = {
  workMinutes: 20,
  restSeconds: 20,
  focusDistance: 20,
  enableNotification: true,
  enableSound: true,
  darkMode: false,
};

const STORAGE_KEY = 'timer_state';

function loadSettings() {
  console.log('[popup] loadSettings()');
  chrome.storage.sync.get(defaultSettings, (settings) => {
    console.log('[popup] settings loaded:', settings);
    document.getElementById('work-minutes').value = settings.workMinutes;
    document.getElementById('rest-seconds').value = settings.restSeconds;
    document.getElementById('focus-distance').value = settings.focusDistance;
    document.getElementById('enable-notification').checked = settings.enableNotification;
    document.getElementById('enable-sound').checked = settings.enableSound;
    document.getElementById('dark-mode').checked = settings.darkMode;
    if (settings.darkMode) document.body.classList.add('dark');
    updateStats(settings);
  });
}

function updateStats() {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get([`breaks_${today}`, 'lastBreakDate'], (data) => {
    console.log('[popup] updateStats:', data);
    document.getElementById('today-count').textContent = data[`breaks_${today}`] || 0;
    document.getElementById('streak').textContent = calculateStreak(data.lastBreakDate);
  });
}

function calculateStreak(lastDate) {
  if (!lastDate) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (ds === lastDate) { streak++; lastDate = ds; }
    else break;
  }
  return streak;
}

// ========== 实时倒计时：storage 变化时立即响应 ==========
function startCountdown() {
  const el = document.getElementById('countdown-value');
  const hintEl = document.querySelector('.countdown-hint');
  const card = document.getElementById('countdown-card');

  function tick() {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const state = data[STORAGE_KEY];
      console.log(`[popup] tick: endTime=${state?.endTime ?? 'null'}, remainingSeconds=${state?.remainingSeconds ?? 'null'}, now=${Date.now()}`);

      if (!state || !state.endTime) {
        console.log('[popup] no valid state, showing --:--');
        if (el) el.textContent = '--:--';
        return;
      }

      const remaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
      console.log(`[popup] computed remaining=${remaining}s`);

      if (el) {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      }
      if (hintEl) {
        hintEl.textContent = remaining <= 60 ? '⚠️ 即将休息！' : '正在专注工作中...';
      }
      if (card) {
        card.style.background = remaining <= 60
          ? 'linear-gradient(135deg, #4a1a1a 0%, #2e1616 100%)'
          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';
        if (el) el.style.color = remaining <= 60 ? '#ff5252' : '#4fc3f7';
      }
    });
  }

  // 初始立即读一次
  tick();

  // 监听 storage 变化，一有写入就立即刷新（不用等下一个 1s tick）
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      console.log('[popup] storage changed, refreshing immediately');
      tick();
    }
  });

  // 兜底：每秒也读一次（兼容 storage.onChanged 不触发的边缘情况）
  setInterval(tick, 1000);
  console.log('[popup] countdown started, listening to storage changes');
}

document.getElementById('save-btn').addEventListener('click', () => {
  const settings = {
    workMinutes: parseInt(document.getElementById('work-minutes').value) || 20,
    restSeconds: parseInt(document.getElementById('rest-seconds').value) || 20,
    focusDistance: parseInt(document.getElementById('focus-distance').value) || 20,
    enableNotification: document.getElementById('enable-notification').checked,
    enableSound: document.getElementById('enable-sound').checked,
    darkMode: document.getElementById('dark-mode').checked,
  };
  console.log('[popup] save-btn clicked, settings:', settings);
  chrome.storage.sync.set(settings, () => {
    chrome.storage.local.remove(STORAGE_KEY, () => {
      console.log('[popup] timer state removed, sending RESTART_TIMER');
      chrome.runtime.sendMessage({ action: 'RESTART_TIMER' });
      document.body.classList.toggle('dark', settings.darkMode);
      const btn = document.getElementById('save-btn');
      const original = btn.textContent;
      btn.textContent = '✅ 已保存！';
      btn.style.background = '#4caf50';
      setTimeout(() => { btn.textContent = original; btn.style.background = ''; }, 1500);
      window.close();
    });
  });
});

document.getElementById('dark-mode').addEventListener('change', (e) => {
  document.body.classList.toggle('dark', e.target.checked);
});

loadSettings();
startCountdown();
