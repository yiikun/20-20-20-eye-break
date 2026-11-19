// Overlay 窗口逻辑
const STORAGE_KEY = 'timer_state';
const RING_CIRCUMFERENCE = 2 * Math.PI * 48; // ≈ 301.6

// 护眼提示语库
const EYE_TIPS = [
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
];

// 读取配置
chrome.storage.local.get(STORAGE_KEY, (data) => {
  const state = data[STORAGE_KEY];
  const totalSeconds = state?.restSeconds || 20;
  const endTime = state?.endTime || Date.now() + totalSeconds * 1000;

  // 设置随机提示
  const tip = EYE_TIPS[Math.floor(Math.random() * EYE_TIPS.length)];
  document.getElementById('emoji').textContent = tip.emoji;
  document.getElementById('tipText').textContent = tip.text;

  // 初始化圆环
  const ringFg = document.getElementById('ringFg');
  ringFg.style.strokeDasharray = RING_CIRCUMFERENCE;
  ringFg.style.strokeDashoffset = '0';

  let remaining = Math.max(1, Math.ceil((endTime - Date.now()) / 1000));
  updateDisplay(remaining);

  // 倒计时
  const timer = setInterval(() => {
    remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    updateDisplay(remaining);

    if (remaining <= 0) {
      clearInterval(timer);
      // 完成动画后关闭窗口
      document.body.style.transition = 'opacity 0.3s';
      document.body.style.opacity = '0';
      setTimeout(() => window.close(), 300);
    }
  }, 1000);

  function updateDisplay(r) {
    document.getElementById('time').textContent = r;
    const progress = 1 - r / totalSeconds;
    ringFg.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - progress)).toFixed(1);

    // 最后5秒显示呼吸动画
    if (r <= 5 && r > 0) {
      document.getElementById('time').style.display = 'none';
      document.querySelector('.unit').style.display = 'none';
      document.getElementById('breathe').style.display = 'block';
      ringFg.style.stroke = '#66bb6a';
    } else {
      document.getElementById('time').style.display = 'block';
      document.querySelector('.unit').style.display = 'block';
      document.getElementById('breathe').style.display = 'none';
    }

    // 最后3秒变橙色
    if (r <= 3 && r > 0) {
      ringFg.style.stroke = '#ff7043';
    }
  }

  // 完成按钮
  document.getElementById('done').addEventListener('click', () => {
    clearInterval(timer);
    window.close();
    chrome.runtime.sendMessage({ action: 'EARLY_DONE' });
  });

  // 关闭按钮
  document.getElementById('close').addEventListener('click', () => {
    clearInterval(timer);
    window.close();
  });
});
