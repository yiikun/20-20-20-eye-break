# 20-20-20 Eye Break — 实现进展记录

## 2026-09-02（今天）

### 完成
- [x] 初始化项目结构
- [x] manifest.json（MV3）
- [x] 背景脚本 — Alarm API 定时 + storage 持久化倒计时状态
- [x] Popup 设置面板 — 自定义参数、统计、暗黑模式
- [x] Content Script — 页内浮动提醒弹窗（带倒计时）
- [x] 图标徽章实时更新（每秒递减，最后 60 秒变红）
- [x] 桌面通知 + 提示音
- [x] 今日休息次数 + 连续天数统计
- [x] 赞助推荐位（popup 底部 + 弹窗底部 banner）
- [x] 赞助开关（用户可关闭）
- [x] 项目目录整理（extension/ + docs/）
- [x] 设计文档（docs/DESIGN.md）

### 遇到的问题 & 解决

**问题 1：Chrome 重启后 popup 显示 `--:--`**
- 原因：service worker 从内存重启，`window._remainingSeconds` 丢失
- 解决：所有状态存 `chrome.storage.local`，background 每秒写，popup 每秒读，完全不依赖内存变量

**问题 2：background↔popup 消息传递时序问题**
- 原因：popup 打开时 service worker 可能还没初始化，消息发不出去
- 解决：改用 storage 轮询方案，popup 直接 `chrome.storage.local.get()` 读数据

**问题 3：缺少图标文件导致加载失败**
- 原因：manifest.json 引用了 `icons/icon16.png` 但目录为空
- 解决：用 Pillow 生成 16/48/128px 的 SVG 风格图标

### 待办
- [ ] 申请 Amazon Associates，替换 content.js 里的占位链接
- [ ] 设计更精致的图标（当前是代码生成的基础版）
- [ ] 撰写英文产品描述，准备上架 Chrome Web Store
- [ ] 编写隐私政策页面
- [ ] 截图素材准备
