// Content script: 在页面上显示浮动提醒
const STORAGE_KEY = 'timer_state';
const LANG_KEY = 'popup_lang';

// 上下文有效性检查（防止扩展重载后旧实例报错）
function isContextValid() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
}

// 界面语言
const I18N = {
  zh: {
    title: '休息一下！',
    subtitle: '远眺放松 20 秒',
    unit: '秒',
    breathe: '深呼吸',
    done: '已完成，去休息',
    close: '关闭',
    tips: [
      { emoji: '🌳', text: '找找窗外的绿植，数一数有几片叶子' },
      { emoji: '☁️', text: '看一片云的形状，像什么动物？' },
      { emoji: '🚗', text: '数远处车牌，看看能认出几个字' },
      { emoji: '🏔️', text: '盯住最远处的物体，眯一只眼再看' },
      { emoji: '🐦', text: '有没有鸟飞过？跟着它飞的方向看' },
      { emoji: '🌙', text: '如果是晚上，看看星星或月亮的位置' },
      { emoji: '👥', text: '远处有人走过吗？假装他是主角' },
      { emoji: '🪟', text: '盯着玻璃反光里的远方发呆3秒' },
      { emoji: '🎯', text: '找5个不同颜色的远处物体' },
      { emoji: '🌅', text: '看天际线的交界处，闭上眼再睁开' },
      { emoji: '😌', text: '深呼吸一次，让眼睛和心情一起放松' },
      { emoji: '🦅', text: '想象自己是一只鹰，视野无限远' },
    ],
  },
  en: {
    title: 'Take a break!',
    subtitle: 'Look far away for 20 seconds',
    unit: 'sec',
    breathe: 'Breathe',
    done: 'Done, go rest',
    close: 'Close',
    tips: [
      { emoji: '🌳', text: 'Find the green plants outside, count the leaves' },
      { emoji: '☁️', text: 'What animal does that cloud look like?' },
      { emoji: '🚗', text: 'Read the license plates in the distance' },
      { emoji: '🏔️', text: 'Focus on the farthest object, squint one eye' },
      { emoji: '🐦', text: 'Did a bird just fly by? Follow its direction' },
      { emoji: '🌙', text: "If it's night, find the stars or moon" },
      { emoji: '👥', text: "Someone walking far away? Make them the main character" },
      { emoji: '🪟', text: 'Stare at the reflection in the glass for 3 seconds' },
      { emoji: '🎯', text: 'Spot 5 objects of different colors far away' },
      { emoji: '🌅', text: 'Look at the horizon, close your eyes, open them again' },
      { emoji: '😌', text: 'Take a deep breath, relax your eyes and mind' },
      { emoji: '🦅', text: 'Imagine you are an eagle with endless vision' },
    ],
  },
};

let currentLang = 'zh';

// 加载语言设置（与 popup 保持一致）
function loadLang() {
  if (!isContextValid()) return;
  chrome.storage.sync.get({ [LANG_KEY]: 'zh' }, (data) => {
    currentLang = data[LANG_KEY] === 'en' ? 'en' : 'zh';
  });
}

// 护眼提示语库（每次随机展示）
const EYE_TIPS = I18N.zh.tips; // 兼容旧代码，实际使用 t('tips')

// 圆环进度参数
const RING_RADIUS = 48;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 301.6

function showOverlay() {
  console.log('[content] showOverlay called');
  if (!isContextValid()) {
    console.log('[content] context invalid, skipping');
    return;
  }

  // 清除旧弹窗
  const existing = document.getElementById('e20-overlay');
  if (existing) {
    console.log('[content] removing old overlay');
    existing.remove();
  }

  // 读取语言设置和计时状态
  chrome.storage.sync.get({ [LANG_KEY]: 'zh' }, (langData) => {
    currentLang = langData[LANG_KEY] === 'en' ? 'en' : 'zh';
    const t = I18N[currentLang];

    // 随机选一条提示
    const tip = t.tips[Math.floor(Math.random() * t.tips.length)];

    // 从 storage 读取实际休息时长和结束时间
    let totalSeconds = 20;
    let endTime = null;
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const state = data[STORAGE_KEY];
      if (state && state.endTime) {
        endTime = state.endTime;
        totalSeconds = state.restSeconds || 20;
      }
      renderOverlay(t, tip, totalSeconds, endTime);
    });
  });
}

function renderOverlay(t, tip, totalSeconds, endTime) {
  const overlay = document.createElement('div');
  overlay.id = 'e20-overlay';
  overlay.innerHTML = `
    <div class="e20-box">
      <!-- 头部：提示语 + 关闭 -->
      <div class="e20-header">
        <div class="e20-tip">
          <span class="e20-tip-emoji">${tip.emoji}</span>
          <span class="e20-tip-text">${tip.text}</span>
        </div>
        <button class="e20-close" title="${t.close}">✕</button>
      </div>

      <!-- 中部：圆环进度 + 呼吸动画 -->
      <div class="e20-ring-wrap">
        <svg class="e20-ring" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="e20-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#4fc3f7"/>
              <stop offset="100%" stop-color="#66bb6a"/>
            </linearGradient>
          </defs>
          <circle class="e20-ring-bg" cx="60" cy="60" r="${RING_RADIUS}"/>
          <circle class="e20-ring-fg" cx="60" cy="60" r="${RING_RADIUS}"/>
        </svg>
        <div class="e20-ring-content">
          <div class="e20-time" id="e20-time">${totalSeconds}</div>
          <div class="e20-unit">${t.unit}</div>
        </div>
        <!-- 呼吸动画层（最后5秒显示） -->
        <div class="e20-breathe" id="e20-breathe" style="display:none">
          <div class="e20-breathe-ring"></div>
          <div class="e20-breathe-text">${t.breathe}</div>
        </div>
      </div>

      <!-- 底部：完成按钮 -->
      <button class="e20-done" id="e20-done">
        <span class="e20-done-icon">✓</span>
        ${t.done}
      </button>
    </div>
  `;

  // 注入样式
  const style = document.createElement('style');
  style.textContent = `
    /* ── 基础布局 ── */
    .e20-box {
      background: #1a1a2e;
      color: #eee;
      padding: 20px 22px 18px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
      text-align: center;
      min-width: 240px;
      max-width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: e20-slide-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      overflow: hidden;
    }
    .e20-box::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, #4fc3f7, #66bb6a, #4fc3f7);
      background-size: 200% 100%;
      animation: e20-shimmer 3s ease-in-out infinite;
    }

    /* ── 头部提示区 ── */
    .e20-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .e20-tip {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
    }
    .e20-tip-emoji {
      font-size: 20px;
      flex-shrink: 0;
      animation: e20-bounce 2s ease-in-out infinite;
    }
    .e20-tip-text {
      font-size: 13px;
      color: #b0bec5;
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .e20-close {
      background: none;
      border: none;
      color: #546e7a;
      font-size: 14px;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: all 0.15s;
      flex-shrink: 0;
      margin-left: 8px;
    }
    .e20-close:hover {
      color: #eee;
      background: rgba(255,255,255,0.1);
    }

    /* ── 圆环进度 ── */
    .e20-ring-wrap {
      position: relative;
      width: 120px;
      height: 120px;
      margin: 0 auto 14px;
    }
    .e20-ring {
      width: 120px;
      height: 120px;
      transform: rotate(-90deg);
    }
    .e20-ring-bg {
      fill: none;
      stroke: #2a2a4a;
      stroke-width: 6;
    }
    .e20-ring-fg {
      fill: none;
      stroke: url(#e20-ring-gradient);
      stroke-width: 6;
      stroke-linecap: round;
      stroke-dasharray: ${RING_CIRCUMFERENCE.toFixed(1)};
      stroke-dashoffset: 0;
      transition: stroke-dashoffset 1s linear, stroke 0.3s;
    }
    .e20-ring-content {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: baseline;
      gap: 2px;
    }
    .e20-time {
      font-size: 32px;
      font-weight: 700;
      color: #4fc3f7;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .e20-unit {
      font-size: 12px;
      color: #78909c;
    }

    /* ── 呼吸动画 ── */
    .e20-breathe {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .e20-breathe-ring {
      width: 60px;
      height: 60px;
      border: 3px solid rgba(79, 195, 247, 0.3);
      border-radius: 50%;
      animation: e20-breathe-expand 2s ease-in-out infinite;
    }
    .e20-breathe-text {
      font-size: 11px;
      color: #4fc3f7;
      opacity: 0.8;
    }

    /* ── 完成按钮 ── */
    .e20-done {
      background: linear-gradient(135deg, #4fc3f7 0%, #26a69a 100%);
      color: #1a1a2e;
      border: none;
      padding: 10px 24px;
      border-radius: 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin: 0 auto;
    }
    .e20-done:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 16px rgba(79, 195, 247, 0.4);
    }
    .e20-done:active {
      transform: scale(0.98);
    }
    .e20-done-icon {
      font-size: 16px;
    }

    /* ── 动画定义 ── */
    @keyframes e20-slide-in {
      from { transform: translateY(-20px) scale(0.9); opacity: 0; }
      to   { transform: translateY(0) scale(1);    opacity: 1; }
    }
    @keyframes e20-shimmer {
      0%, 100% { background-position: 0% 50%; }
      50%      { background-position: 100% 50%; }
    }
    @keyframes e20-bounce {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-3px); }
    }
    @keyframes e20-breathe-expand {
      0%, 100% { transform: scale(0.8); opacity: 0.4; }
      50%      { transform: scale(1.3); opacity: 0.8; }
    }
  `;
  document.head.appendChild(style);

  // 定位到右上角
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    pointer-events: auto;
  `;
  document.body.appendChild(overlay);

  // ── 倒计时逻辑 ──
  const timeEl = overlay.querySelector('#e20-time');
  const ringFg = overlay.querySelector('.e20-ring-fg');
  const breatheEl = overlay.querySelector('#e20-breathe');
  const doneBtn = overlay.querySelector('#e20-done');
  const closeBtn = overlay.querySelector('.e20-close');

  function updateDisplay(remaining) {
    timeEl.textContent = remaining;
    // 更新圆环进度
    const progress = 1 - remaining / totalSeconds;
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    ringFg.style.strokeDashoffset = offset.toFixed(1);

    // 最后5秒切换呼吸动画
    if (remaining <= 5 && remaining > 0) {
      timeEl.style.display = 'none';
      breatheEl.style.display = 'flex';
      ringFg.style.stroke = '#66bb6a'; // 绿色完成感
    } else {
      timeEl.style.display = 'block';
      breatheEl.style.display = 'none';
    }

    // 最后3秒变警告色
    if (remaining <= 3 && remaining > 0) {
      ringFg.style.stroke = '#ff7043';
    }
  }

  // 初始化
  if (endTime) {
    const initial = Math.max(1, Math.ceil((endTime - Date.now()) / 1000));
    updateDisplay(initial);
  } else {
    updateDisplay(totalSeconds);
  }

  const timer = setInterval(() => {
    let remaining;
    if (endTime) {
      remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    } else {
      // fallback 手动递减
      remaining = --totalSeconds;
    }
    updateDisplay(remaining);
    if (remaining <= 0) {
      clearInterval(timer);
      // 完成动画后关闭
      overlay.style.transition = 'opacity 0.3s, transform 0.3s';
      overlay.style.opacity = '0';
      overlay.style.transform = 'translateY(-10px) scale(0.95)';
      setTimeout(() => overlay.remove(), 300);
    }
  }, 1000);

  // 完成按钮
  doneBtn.addEventListener('click', () => {
    clearInterval(timer);
    overlay.remove();
    if (isContextValid()) {
      chrome.runtime.sendMessage({ action: 'EARLY_DONE' });
    }
  });

  // 关闭按钮
  closeBtn.addEventListener('click', () => {
    clearInterval(timer);
    overlay.remove();
  });
}

// 监听 background 消息
try {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isContextValid()) return;
    if (message.action === 'SHOW_OVERLAY') {
      showOverlay();
    }
  });
} catch (e) {
  console.log('[content] onMessage setup failed (extension reloading):', e.message);
}
