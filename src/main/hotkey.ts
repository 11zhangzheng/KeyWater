import { globalShortcut } from 'electron'

let currentHotkey = ''

export const registerHotkey = (accelerator: string, callback: () => void) => {
  if (currentHotkey) {
    try { globalShortcut.unregister(currentHotkey) } catch { /* ignore */ }
  }

  const registered = globalShortcut.register(accelerator, callback)

  if (registered) {
    currentHotkey = accelerator
    return { ok: true }
  }
  return { ok: false, error: '快捷键注册失败，可能与其他应用冲突' }
}

export const unregisterAllHotkeys = () => {
  globalShortcut.unregisterAll()
}
