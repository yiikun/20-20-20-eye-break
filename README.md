# 20-20-20 Eye Break

Chrome 扩展，基于「20-20-20 护眼法则」帮助用户保护视力。

每工作 20 分钟，提醒休息 20 秒，眺望 20 英尺外。

## 功能

- ⏱️ 智能计时器：可自定义工作时长和休息时长
- 🔔 桌面通知：提醒即使你正在使用其他应用
- 🔊 提示音：柔和的闹钟声音
- 🌙 暗黑模式：全天护眼
- 📊 数据统计：今日休息次数 + 连续天数
- 🔍 页内弹窗：不遮挡视线的浮动提醒

## 安装

### Chrome Web Store
[即将上线]

### 开发者模式安装
1. 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目的 `extension` 文件夹

## 开发

```bash
# 查看项目结构
ls -la extension/

# 测试修改
# 编辑 extension/js/*.js 后在 chrome://extensions 重新加载
```

## 技术栈

- Chrome Extension Manifest V3
- Vanilla JavaScript
- CSS (with dark mode support)

## 隐私

- 所有数据存储在本地 `chrome.storage.local`
- 不收集任何用户数据
- 不发送遥测信息
- 无需账户登录

## 许可证

MIT License
