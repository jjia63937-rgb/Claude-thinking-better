// 扩展版的系统通知：content script 发来 { type: 'xxt-notify' }，这里弹出通知，点击后切回对应标签页。

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
