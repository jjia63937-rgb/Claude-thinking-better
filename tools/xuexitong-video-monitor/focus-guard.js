// 扩展版：和 xuexitong-video-monitor.user.js 一起注入到页面自己的 JS 环境里（见 background.js）。
// 有了这个标记，脚本在这里只做一件事：让页面以为自己一直在前台、有焦点。
window.__xxtFocusGuardOnly = true;
