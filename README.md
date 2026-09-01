# KeySip

KeySip 是一个通过键盘肌肉记忆帮助你喝水的桌面小挂件。

敲久了，就喝一口。

水蓝蓝是 KeySip 中的像素水灵桌宠。它常驻在桌面角落，根据键盘活跃度判断自己是否“口渴”，不弹窗、不发系统通知，只通过轻微动画、快捷键和饮水记录帮你养成微习惯。
<img width="153" height="195" alt="image" src="https://github.com/user-attachments/assets/d7844cfb-4ced-4290-8029-67cf4c1cc47f" />



## 启动

```bash
npm install
npm run dev
```

开发模式会启动 Electron + React 渲染进程。应用启动后，水蓝蓝会显示在屏幕右下角。

## 打包

```bash
npm run build
npm run dist
```

打包产物会输出到 `release/` 目录，应用产品名为 KeySip。

## 使用

- 全局快捷键：Windows/Linux 使用 `Ctrl + Shift + W`，macOS 使用 `Cmd + Shift + W`。
- 快捷键会打开补水 HUD，按 `Enter` 记录一次饮水，按 `Escape` 取消。
- 点击水蓝蓝可以打开迷你快捷菜单。
- 菜单里的“喝一口”会立即记录一次饮水。
- 菜单里的“数据”会打开饮水数据面板。
- “暂停”开启后，水蓝蓝不会因为键盘输入继续掉水。
- “最小化”会隐藏水蓝蓝，只保留系统托盘 / 菜单栏图标。

## 托盘菜单

KeySip 会创建一个像素水滴托盘图标。托盘菜单提供：

- 显示 / 隐藏水蓝蓝
- 喝一口
- 饮水数据
- 暂停 / 恢复提醒
- 今日饮水量、次数、目标进度和当前状态
- 退出 KeySip

托盘 tooltip 会显示今日饮水量、饮水次数和当前状态。隐藏主窗口后，可以通过托盘图标重新显示水蓝蓝。

## 本地数据

KeySip 不需要登录，也不使用云同步。设置、今日数据和历史饮水数据会保存在 Electron 的本地 `userData` 目录中，并会按日期自动重置今日统计。

首次从旧版本升级时，KeySip 会尝试读取旧版本的本地记录，并在之后写入新的 KeySip 数据目录。
