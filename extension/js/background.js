// 背景脚本：管理定时器和通知
// 关键设计：
//  1. 完全不依赖 setInterval，全部走 chrome.alarms（service worker 休眠后也能恢复）
//  2. 启动时从 storage 恢复状态，重新创建 pending 的 alarm
//  3. 每次写 storage 前先清空旧状态，避免残留数据

const STORAGE_KEY = 'timer_state';
const PHASE_KEY   = 'timer_phase';

// ─── Google Analytics 4 (Measurement Protocol) ────────────────────
const GA_MEASUREMENT_ID = 'G-TQYH78Q5C0';
const GA_API_SECRET = ''; // 可选：如果有 secret key

// 生成随机客户端 ID（与标准 UA/GA4 格式一致）
function generateClientId() {
  const hexDigits = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) result += '-';
    result += hexDigits[Math.floor(Math.random() * 16)];
  }
  return result;
}

// 从 storage 获取或创建 clientId
async function getClientId() {
  return new Promise((resolve) => {
    chrome.storage.local.get('ga_client_id', (data) => {
      if (data.ga_client_id) {
        resolve(data.ga_client_id);
      } else {
        const newId = generateClientId();
        chrome.storage.local.set({ ga_client_id: newId }, () => resolve(newId));
      }
    });
  });
}

// 发送 GA4 事件（使用 Measurement Protocol）- 非阻塞版本
function trackEvent(eventName, params = {}) {
  try {
    const clientId = chrome.storage.local.getSync?.(['ga_client_id'])?.ga_client_id || generateClientId();
    if (!chrome.storage.local.getSync) {
      // fallback: 先设置再获取（不等待）
      const newId = generateClientId();
      chrome.storage.local.set({ ga_client_id: newId }, () => {});
    }
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;
    const payload = {
      client_id: clientId,
      events: [{
        name: eventName,
        params: {
          ...params,
          session_type: '1'
        }
      }]
    };
    // 使用 sendBeacon（不会阻塞主线程，且能在页面卸载时发送）
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, JSON.stringify(payload));
    } else {
      // fallback 到 fetch（keepalive 确保请求在页面卸载后也能完成）
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }
    console.log(`[ga] tracked: ${eventName}`, params);
  } catch (e) {
    console.error('[ga] track error:', e);
  }
}

const defaultSettings = {
  workMinutes: 20,
  restSeconds: 20,
  focusDistance: 20,
  enableNotification: true,
  enableSound: true,
  darkMode: false
};

console.log('[bg] Service worker started');

// 启动时从 storage 恢复（异步，等 storage 读完再决定要不要创建 alarm）
chrome.storage.local.get([STORAGE_KEY, PHASE_KEY], (data) => {
  const state = data[STORAGE_KEY];
  const phase = data[PHASE_KEY] || 'work';
  const now   = Date.now();

  if (state && state.endTime && state.endTime > now) {
    const remainingMs = state.endTime - now;
    const remainingSec = Math.ceil(remainingMs / 1000);
    console.log(`[bg] restoring ${phase} timer, ${remainingSec}s remaining`);

    if (phase === 'rest') {
      startRestTimer({ restSeconds: remainingSec }, true);
    } else {
      // work phase：恢复 alarm（用 delayInMinutes，最小 1 分钟）
      const remainingMinutes = Math.ceil(remainingSec / 60);
      saveStateSync(remainingSec, now, state.endTime);
      chrome.alarms.create('eye-break-work', { delayInMinutes: remainingMinutes });
      console.log(`[bg] restored work alarm, fires in ${remainingMinutes}min (${remainingSec}s)`);
    }
  } else {
    console.log('[bg] no pending timer, starting fresh');
    chrome.storage.sync.get(defaultSettings, (settings) => {
      startWorkTimer(settings);
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[bg] onInstalled');
  trackEvent('extension_installed', { version: chrome.runtime.getManifest().version });
  chrome.storage.sync.get(defaultSettings, (settings) => {
    startWorkTimer(settings);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  console.log(`[bg] onAlarm: name=${alarm.name}, time=${new Date().toISOString()}`);

  if (alarm.name === 'eye-break-work') {
    console.log('[bg] work phase done → entering rest phase');
    chrome.storage.sync.get(defaultSettings, (settings) => {
      playSound();
      showNotification(settings);
      incrementBreakCount();
      clearBadge();
      showOverlayToAllTabs();
      startRestTimer(settings);
      trackEvent('break_started', { work_minutes: settings.workMinutes });
    });
  } else if (alarm.name === 'eye-break-rest') {
    console.log('[bg] rest phase done → restarting work phase');
    chrome.storage.sync.get(defaultSettings, (settings) => {
      startWorkTimer(settings);
      trackEvent('break_completed', { rest_seconds: settings.restSeconds });
    });
  }
});

function startWorkTimer(settings) {
  console.log(`[bg] startWorkTimer(workMinutes=${settings.workMinutes})`);
  clearBadge();
  storePhase('work');

  const totalSeconds = settings.workMinutes * 60;
  const startTime    = Date.now();
  const endTime      = startTime + totalSeconds * 1000;

  // 先写 storage，再创建 alarm（保证 popup 随时能读到完整状态）
  saveStateSync(totalSeconds, startTime, endTime);
  chrome.alarms.create('eye-break-work', { delayInMinutes: settings.workMinutes });
  console.log(`[bg] work alarm set: ${totalSeconds}s, endTime=${new Date(endTime).toISOString()}`);
}

function startRestTimer(settings, skipSettingsSync = false) {
  console.log(`[bg] startRestTimer(restSeconds=${settings.restSeconds})`);

  const totalSeconds = settings.restSeconds;
  const startTime    = Date.now();
  const endTime      = startTime + totalSeconds * 1000;

  // 先写 storage，再设置 timeout
  saveStateSync(totalSeconds, startTime, endTime);

  // 休息时间短（< 1 分钟），用 setTimeout 而不是 alarm
  // alarm 最小精度是 1 分钟，无法满足休息秒数需求
  setTimeout(() => {
    console.log('[bg] rest timer done → restarting work phase');
    chrome.storage.sync.get(defaultSettings, (settings) => {
      startWorkTimer(settings);
    });
  }, totalSeconds * 1000);

  console.log(`[bg] rest timeout set: ${totalSeconds}s, endTime=${new Date(endTime).toISOString()}`);
  storePhase('rest');
}

// 同步写入 storage（在同一个回调里完成，避免时序问题）
function saveStateSync(remainingSeconds, startTime, endTime) {
  chrome.storage.local.set({ [STORAGE_KEY]: { remainingSeconds, startTime, endTime, restSeconds: remainingSeconds } }, () => {
    console.log(`[bg] state saved: remaining=${remainingSeconds}, endTime=${new Date(endTime).toISOString()}`);
  });
}

function storePhase(phase) {
  chrome.storage.local.set({ [PHASE_KEY]: phase });
}

function showOverlayToAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    console.log(`[bg] showing overlay to ${tabs.length} tabs`);
    for (const tab of tabs) {
      // 跳过 popup/新标签页等扩展内部页面
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue;
      chrome.tabs.sendMessage(tab.id, { action: 'SHOW_OVERLAY' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log(`[bg] tab ${tab.id}: ${chrome.runtime.lastError.message}`);
        } else {
          console.log(`[bg] tab ${tab.id}: overlay sent OK`);
        }
      });
    }
  });
}

function updateBadge(seconds) {
  const mins  = Math.floor(seconds / 60);
  const secs  = seconds % 60;
  chrome.action.setBadgeText({ text: `${mins}:${secs.toString().padStart(2, '0')}` });
  chrome.action.setBadgeBackgroundColor({ color: seconds <= 60 ? '#ff5252' : '#4fc3f7' });
}

function clearBadge() {
  chrome.action.setBadgeText({ text: '' });
  console.log('[bg] badge cleared');
}

function playSound() {
  try {
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) { console.log('[bg] AudioContext not available'); return; }
    const ctx = new AudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 200);
    console.log('[bg] sound played');
  } catch (e) {
    console.log('[bg] playSound error:', e);
  }
}

function showNotification(settings) {
  if (!settings.enableNotification) {
    console.log('[bg] notification disabled');
    return;
  }
  const iconUrl = chrome.runtime.getURL('icons/icon128.png');
  chrome.notifications.create({
    type: 'basic',
    iconUrl: iconUrl,
    title: '20-20-20 护眼提醒',
    message: `休息一下！远眺 ${settings.focusDistance} 英尺外 ${settings.restSeconds} 秒`,
    priority: 2
  });
  console.log('[bg] notification shown');
}

function incrementBreakCount() {
  const today = new Date().toISOString().split('T')[0];
  const key   = `breaks_${today}`;
  chrome.storage.local.get(key, (data) => {
    chrome.storage.local.set({ [key]: (data[key] || 0) + 1 });
    chrome.storage.sync.set({ lastBreakDate: today });
    console.log(`[bg] break count incremented, today=${data[key] || 0}`);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 忽略来自 popup/content script 的非预期消息
  if (sender && sender.id !== chrome.runtime.id) return;
  if (message.action === 'EARLY_DONE') {
    console.log('[bg] EARLY_DONE received');
    trackEvent('break_completed_early');
    chrome.storage.sync.get(defaultSettings, (settings) => {
      startWorkTimer(settings);
    });
  } else if (message.action === 'RESTART_TIMER') {
    console.log('[bg] RESTART_TIMER received');
    trackEvent('timer_restarted');
    chrome.storage.sync.get(defaultSettings, (settings) => {
      startWorkTimer(settings);
    });
  } else if (message.action === 'OPEN_POPUP') {
    console.log('[bg] OPEN_POPUP received');
    trackEvent('popup_opened');
  }
});
