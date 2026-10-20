// 扩展版的系统通知：content script 发来 { type: 'xxt-notify' }，这里弹出通知，点击后切回对应标签页。
// 另外按设置注册"阻止切走窗口时自动暂停"的页面脚本。

const tabsByNotification = new Map();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'xxt-notify' || !sender.tab) return;
  const id = 'xxt-' + sender.tab.id + '-' + Date.now();
  tabsByNotification.set(id, { tabId: sender.tab.id, windowId: sender.tab.windowId });
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icon.png',
    title: String(msg.title),
    message: String(msg.body),
    priority: 2,
  });
});

chrome.notifications.onClicked.addListener((id) => {
  const target = tabsByNotification.get(id);
  if (target) {
    chrome.tabs.update(target.tabId, { active: true });
    chrome.windows.update(target.windowId, { focused: true });
  }
  chrome.notifications.clear(id);
});

chrome.notifications.onClosed.addListener((id) => tabsByNotification.delete(id));

// 点工具栏上的扩展图标：让当前学习通页面生成诊断信息。不是学习通页面时什么也不做。
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'xxt-diag' }, { frameId: 0 }).catch(() => {});
});

// "阻止切走窗口时自动暂停"要在学习通自己的脚本之前、在页面自己的 JS 环境里运行，
// 只能用动态注册的 content script（world: MAIN）。按面板上的开关注册或取消，刷新页面后生效。
const SETTINGS_KEY = 'xxtVideoMonitorSettings';
const GUARD_ID = 'xxt-focus-guard';
let syncing = Promise.resolve();

function syncFocusGuard() {
  syncing = syncing.then(async () => {
    const saved = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];
    const on = !(saved && saved.focusGuard === false);
    const registered = (await chrome.scripting.getRegisteredContentScripts({ ids: [GUARD_ID] })).length > 0;
    if (on && !registered) {
      await chrome.scripting.registerContentScripts([{
        id: GUARD_ID,
        matches: ['*://*.chaoxing.com/*'],
        js: ['focus-guard.js', 'xuexitong-video-monitor.user.js'],
        allFrames: true,
        runAt: 'document_start',
        world: 'MAIN',
      }]);
    } else if (!on && registered) {
      await chrome.scripting.unregisterContentScripts({ ids: [GUARD_ID] });
    }
  }).catch((e) => console.warn('focus guard:', e));
}

chrome.runtime.onInstalled.addListener(syncFocusGuard);
chrome.runtime.onStartup.addListener(syncFocusGuard);
chrome.storage.onChanged.addListener((changes) => {
  if (changes[SETTINGS_KEY]) syncFocusGuard();
});
syncFocusGuard();
