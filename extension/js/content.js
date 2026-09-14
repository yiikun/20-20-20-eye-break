// Content script：在页面上显示浮动提醒
const STORAGE_KEY = 'timer_state';

function showOverlay(options = {}) {
  console.log('[content] showOverlay called with options:', options);

  const existing = document.getElementById('e20-overlay');
  if (existing) {
    console.log('[content] removing existing overlay');
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'e20-overlay';
  overlay.innerHTML = `
    <div class="e20-box">
      <div class="e20-title">👀 休息一下！</div>
      <div class="e20-subtitle">远眺 20 英尺外，放松 20 秒</div>
      <div class="e20-countdown">20</div>
      <button class="e20-done">✅ 已完成</button>
    </div>
  `;

  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: auto;
  `;

  const style = document.createElement('style');
  style.textContent = `
    .e20-box {
      background: #1a1a2e;
      color: #eee;
      padding: 20px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      text-align: center;
      min-width: 200px;
      animation: e20-slide-in 0.3s ease-out;
    }
    .e20-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .e20-subtitle { font-size: 14px; color: #aaa; margin-bottom: 12px; }
    .e20-countdown { font-size: 48px; font-weight: 700; color: #4fc3f7; margin: 10px 0; }
    .e20-done {
      background: #4fc3f7; color: #1a1a2e;
      border: none; padding: 8px 20px;
      border-radius: 6px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .e20-done:hover { background: #29b6f6; transform: scale(1.05); }
    @keyframes e20-slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    .e20-box.light { background: #fff; color: #333; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
    .e20-box.light .e20-subtitle { color: #666; }
    .e20-box.light .e20-countdown { color: #1976d2; }
    .e20-box.light .e20-done { background: #1976d2; color: #fff; }
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  console.log('[content] overlay injected into page');

  // 倒计时：从 storage 读取实际休息时间
  const countdownEl = overlay.querySelector('.e20-countdown');
  const doneBtn = overlay.querySelector('.e20-done');

  let remaining = 20;
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const state = data[STORAGE_KEY];
    if (state && state.endTime) {
      remaining = Math.max(1, Math.ceil((state.endTime - Date.now()) / 1000));
      console.log(`[content] initial remaining from storage: ${remaining}s`);
    }
    countdownEl.textContent = remaining;
  });

  const timer = setInterval(() => {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const state = data[STORAGE_KEY];
      if (state && state.endTime) {
        const secs = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
        countdownEl.textContent = secs;
        if (secs <= 0) {
          clearInterval(timer);
          overlay.remove();
          console.log('[content] overlay timer expired, removed');
        }
      } else {
        // fallback: 手动递减
        countdownEl.textContent = --remaining;
        if (remaining <= 0) {
          clearInterval(timer);
          overlay.remove();
        }
      }
    });
  }, 1000);

  doneBtn.addEventListener('click', () => {
    clearInterval(timer);
    overlay.remove();
    chrome.runtime.sendMessage({ action: 'EARLY_DONE' });
    console.log('[content] done button clicked');
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`[content] message received: action=${message.action}, sender=${sender.tab?.id ?? 'background'}`);
  if (message.action === 'SHOW_OVERLAY') {
    showOverlay(message);
  }
});
