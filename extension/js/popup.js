// Popup 逻辑
chrome.runtime.sendMessage({ action: 'OPEN_POPUP' }); // GA4 tracking

const defaultSettings = {
  workMinutes: 20,
  restSeconds: 20,
  focusDistance: 20,
  enableNotification: true,
  enableSound: true,
  darkMode: false,
};

const STORAGE_KEY = 'timer_state';
const LANG_KEY = 'popup_lang';

// 中英文文案
const I18N = {
  zh: {
    title: '护眼提醒 · 视力守护',
    countdownLabel: '距离下次休息',
    countdownHintWorking: '正在专注工作中...',
    countdownHintSoon: '⚠️ 即将休息！',
    statToday: '今日休息',
    statStreak: '连续天数',
    settingWork: '工作时长（分钟）',
    settingRest: '休息时长（秒）',
    settingDistance: '远眺距离（英尺）',
    toggleNotification: '桌面通知',
    toggleSound: '提示音',
    toggleDarkMode: '暗黑模式',
    saveButton: '💾 保存设置',
    savedMessage: '✅ 已保存！',
  },
  en: {
    title: 'Eye Care Reminder',
    countdownLabel: 'Until next break',
    countdownHintWorking: 'Staying focused...',
    countdownHintSoon: '⚠️ Break coming up!',
    statToday: "Today's breaks",
    statStreak: 'Day streak',
    settingWork: 'Work duration (min)',
    settingRest: 'Break length (sec)',
    settingDistance: 'Look distance (feet)',
    toggleNotification: 'Desktop notifications',
    toggleSound: 'Sound alert',
    toggleDarkMode: 'Dark mode',
    saveButton: '💾 Save settings',
    savedMessage: '✅ Saved!',
  },
};

let currentLang = 'zh';

function loadLang() {
  chrome.storage.sync.get({ [LANG_KEY]: 'zh' }, (data) => {
    currentLang = data[LANG_KEY] === 'en' ? 'en' : 'zh';
    applyLanguage(currentLang);
  });
}

function applyLanguage(lang) {
  const t = I18N[lang];
  document.documentElement.lang = lang;
  document.title = lang === 'en' ? '20-20-20 Eye Break' : '20-20-20 护眼提醒';
  document.getElementById('subtitle').textContent = t.title;
  document.getElementById('save-btn').textContent = t.saveButton;

  const hintEl = document.querySelector('.countdown-hint');
  // 保留倒计时逻辑，只在非即将休息时更新文案
  if (hintEl && !hintEl.dataset.upcoming) {
    hintEl.textContent = t.countdownHintWorking;
  }

  // 设置标签
  const labelMap = {
    'countdownLabel': t.countdownLabel,
    'statToday': t.statToday,
    'statStreak': t.statStreak,
    'settingWork': t.settingWork,
    'settingRest': t.settingRest,
    'settingDistance': t.settingDistance,
    'toggleNotification': t.toggleNotification,
    'toggleSound': t.toggleSound,
    'toggleDarkMode': t.toggleDarkMode,
  };
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (labelMap[key]) el.textContent = labelMap[key];
  });

  // 按钮文案
  const saveBtn = document.getElementById('save-btn');
  saveBtn.dataset.original = t.saveButton;

  // 切换按钮显示目标语言
  const langToggle = document.getElementById('lang-toggle');
  langToggle.textContent = lang === 'zh' ? 'EN' : '中文';
  langToggle.title = lang === 'zh' ? 'Switch to English' : '切换到中文';
}

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
        if (hintEl) {
          hintEl.textContent = I18N[currentLang].countdownHintWorking;
          delete hintEl.dataset.upcoming;
        }
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
        if (remaining <= 60) {
          hintEl.textContent = I18N[currentLang].countdownHintSoon;
          hintEl.dataset.upcoming = '1';
        } else {
          hintEl.textContent = I18N[currentLang].countdownHintWorking;
          delete hintEl.dataset.upcoming;
        }
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
      btn.textContent = I18N[currentLang].savedMessage;
      btn.style.background = '#4caf50';
      setTimeout(() => { btn.textContent = I18N[currentLang].saveButton; btn.style.background = ''; }, 1500);
      window.close();
    });
  });
});

document.getElementById('dark-mode').addEventListener('change', (e) => {
  document.body.classList.toggle('dark', e.target.checked);
});

// 语言切换
document.getElementById('lang-toggle').addEventListener('click', () => {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  chrome.storage.sync.set({ [LANG_KEY]: currentLang }, () => {
    applyLanguage(currentLang);
  });
});

loadLang();
loadSettings();
startCountdown();
