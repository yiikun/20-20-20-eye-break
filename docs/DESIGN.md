# 20-20-20 Eye Break — 项目设计文档

## 产品定位

Chrome 插件，基于"20-20-20 护眼法则"，帮助用户每 20 分钟休息 20 秒远眺 20 英尺外。

**目标用户：** 长时间用电脑的程序员、设计师、办公族
**市场：** Chrome Web Store，面向英语/全球用户
**商业模式：** 联盟营销（Amazon Associates）+ 潜在付费高级版

---

## 功能清单

### MVP（已完成）
| 功能 | 状态 | 说明 |
|------|------|------|
| 20-20-20 核心计时 | ✅ | Chrome Alarm API 定时触发 |
| 图标徽章倒计时 | ✅ | 实时显示剩余时间，最后 60 秒变红 |
| 页内浮动提醒弹窗 | ✅ | 带 20 秒倒计时 + 完成按钮 |
| 桌面通知 | ✅ | Chrome Notification API |
| 提示音 | ✅ | AudioContext 合成短音 |
| Popup 设置面板 | ✅ | 自定义间隔/休息时长/距离 |
| 暗黑模式 | ✅ | popup 和弹窗均支持 |
| 今日休息次数统计 | ✅ | chrome.storage.local |
| 连续天数统计 | ✅ | 算 streak |
| 赞助推荐位 | ✅ | popup 底部 + 弹窗底部 banner |
| 赞助开关 | ✅ | 用户可关闭（审核要求） |

### 待开发
| 功能 | 优先级 | 说明 |
|------|--------|------|
| 上架 Chrome Web Store | 高 | 发布正式版 |
| 更精致的图标 | 高 | 用 Figma/SVG 重设计 |
| 统计图表 | 中 | 本周/本月休息趋势图 |
| 多语言 | 低 | en / zh / ja |
| Pro 版解锁 | 低 | 去广告 + 更多主题 |

---

## 技术架构

```
extension/
├── manifest.json          # MV3，permissions: storage, alarms, notifications
├── popup.html             # 设置面板 UI
├── js/
│   ├── background.js      # 后台服务：Alarm API + 状态持久化
│   ├── content.js         # 注入页面：浮动提醒弹窗
│   └── popup.js           # 弹窗逻辑：读取 storage 倒计时
├── css/popup.css          # Popup 样式（含暗黑）
└── icons/                 # 16/48/128px PNG
```

**关键设计决策：**
- 倒计时数据存储在 `chrome.storage.local.timer_state`，background 每秒写入，popup 每秒读取
- 不依赖 background↔popup 消息传递来传递倒计时（service worker 休眠会导致通信失败）
- 赞助链接由用户在 content.js 里自行替换为真实联盟链接

---

## 目录结构

```
20-20-20-reminder/
├── docs/                  # 项目文档（本目录）
│   ├── DESIGN.md          # 本文档
│   └── PROGRESS.md        # 实现进展记录
└── extension/             # Chrome 扩展源码（用于开发/上架）
    ├── manifest.json
    ├── popup.html
    ├── css/popup.css
    ├── js/background.js
    ├── js/content.js
    ├── js/popup.js
    └── icons/
```

---

## 上架准备清单

- [ ] 申请 Amazon Associates 账号，获取真实推广链接
- [ ] 设计高质量图标（至少 128x128，黑白两版）
- [ ] 撰写英文标题 + 描述（SEO 友好）
- [ ] 截图（popup 展示 + 提醒弹窗展示）
- [ ] 隐私政策页面（Chrome Web Store 要求）
- [ ] 支付信息（Stripe / PayPal）
- [ ] 提交审核
