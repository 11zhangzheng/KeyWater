# HydraBit

HydraBit 是一个极简、像素风的桌面小挂件，用来追踪饮水和补剂微习惯。它常驻在屏幕右下角，安静统计键盘活跃度，不弹窗、不发系统通知，只在需要补水时通过 widget 自己的状态变化提醒你。

## 功能

- 透明、置顶、轻量的桌面 widget。
- 像素风水杯 UI，包含普通状态和 thirsty 状态。
- 键盘活跃度统计，默认阈值为 `2000` 次按键。
- 全局快捷键：
  - macOS：`Cmd + Shift + W`
  - Windows/Linux：`Ctrl + Shift + W`
- 屏幕中央 HUD：`SIP! +250ml`。
- `Enter` 确认记录一次饮水，`Escape` 取消 HUD。
- 显示今日饮水次数、今日估算饮水量和当前按键计数。
- 设置项：按键阈值、每次饮水量、补剂追踪开关、暂停模式。
- 使用 Electron `userData` 目录进行本地 JSON 持久化。
- 日期变化后自动重置今日数据。
- 可拖拽移动桌面挂件，并记住上次窗口位置。

## 安装依赖

```bash
npm install
```

如果 Windows PowerShell 因执行策略阻止 `npm`，可以使用：

```bash
npm.cmd install
```

## 开发启动

```bash
npm run dev
```

Windows PowerShell 中也可以使用：

```bash
npm.cmd run dev
```

## 构建

```bash
npm run build
```

## 打包

```bash
npm run dist
```

打包产物会输出到 `release/` 目录。

## 使用方式

1. 启动 HydraBit。
2. 正常打字工作。按键数达到阈值后，水杯会进入 thirsty 状态。
3. 按下快捷键：Windows/Linux 使用 `Ctrl + Shift + W`，macOS 使用 `Cmd + Shift + W`。
4. HUD 出现后，按 `Enter` 记录一次饮水，按 `Escape` 取消。
5. 点击 widget 可以打开小型设置面板。
6. 拖拽挂件边框、顶部小点或状态区域可以调整桌面位置，HydraBit 会自动记住。

如果当前机器无法使用全局键盘统计，HydraBit 会降级为仅在 widget 获得焦点时统计按键。全局快捷键仍由 Electron 注册。

## 常见问题

### Windows 提示 `Unable to move the cache` 或 `Gpu Cache Creation failed`

这是 Electron/Chromium 磁盘缓存目录被占用或无权限访问时的报错，常见于开发时重复启动了多个 HydraBit/Electron 实例。

当前版本已经做了两层处理：

- 启动时固定缓存目录到 `%APPDATA%\HydraBit\session\cache`。
- 使用单实例锁，避免多个 HydraBit 实例同时抢同一个缓存目录。

如果你是在旧版本实例还运行时看到这个报错，请先关闭已有 HydraBit/Electron 进程，然后重新运行：

```bash
npm.cmd run dev
```
