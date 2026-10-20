# 学习通视频播放监测（Edge）

脚本只在学习通（`*.chaoxing.com`）的网页上运行，其他网站完全不加载。在学习通里，也只有页面上有视频时才会在右下角显示一个小面板，实时显示视频的播放状态；首页、作业、消息等页面看不到它。出现下面这些情况时，它会用系统通知、提示音和标签页标题提醒你：

| 情况 | 提醒 |
|---|---|
| 视频播放后暂停超过 5 秒（学习通在你切走窗口时常会自动暂停） | 视频已暂停 |
| 视频播放完毕 | 视频播放完毕 |
| 视频里弹出了随堂题目 | 视频中弹出了题目 |
| 缓冲超过 20 秒 | 视频卡住了 |

脚本**只读取**播放状态，不会自动播放、倍速、跳过题目或修改学习进度。

学习通的视频在两层嵌套的 iframe 里，脚本会在每一层里查找 `<video>`，再把状态汇总到顶层页面的面板上。

## 安装（二选一）

### 方法 A：Tampermonkey 用户脚本

1. 在 Edge 加载项商店安装 [Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd)。
2. 打开 Tampermonkey 管理面板 →「添加新脚本」，把 `xuexitong-video-monitor.user.js` 的全部内容粘贴进去，保存。
3. 新版 Edge 需要在 `edge://extensions` 里给 Tampermonkey 打开「允许用户脚本」（或打开左下角的「开发人员模式」），否则脚本不会运行。

### 方法 B：直接作为 Edge 扩展加载

不需要 Tampermonkey。

1. 把整个 `xuexitong-video-monitor` 文件夹下载到本地。
2. 打开 `edge://extensions`，打开左下角的「开发人员模式」。
3. 点「加载解压缩的扩展」，选择这个文件夹。

扩展版的通知点一下会切回对应的学习通标签页。

## 使用

1. 打开学习通课程里有视频的章节，右下角会出现「视频监测」面板。点标题栏可以折叠。
2. 先点一次面板里的「测试提醒」。这一下点击会让浏览器允许之后播放提示音；如果收不到系统通知，检查 Windows 的「设置 → 系统 → 通知」里是否允许 Edge（或 Tampermonkey）发通知。
3. 选项：
   - **系统通知** / **提示音**：分别开关。
   - **只在页面不在前台时提醒**（默认开）：你正在看这个页面时只让面板闪一下，不弹通知、不响铃。

## 常见问题

- **面板没出现**：面板只在页面上发现视频后才显示，先确认这一节有视频。脚本只在 `*.chaoxing.com` 下运行。如果你的学校用的是自己的域名（比如 `mooc.xxx.edu.cn`），在用户脚本头部加一行 `// @match *://mooc.xxx.edu.cn/*`；扩展版在 `manifest.json` 的 `matches` 里加同样的地址，然后在 `edge://extensions` 里点「重新加载」。
- **弹题没有提醒**：题目弹窗是按 `.ans-videoquiz` 这个选择器识别的。学习通改版后如果失效，按 F12 找到弹窗元素的 class，改脚本顶部的 `QUIZ_SELECTOR`。
- **提醒太早或太晚**：改脚本顶部的 `PAUSE_ALERT_MS`（暂停多久提醒）和 `STALL_ALERT_MS`（缓冲多久算卡住），单位毫秒。

## 文件

| 文件 | 用途 |
|---|---|
| `xuexitong-video-monitor.user.js` | 脚本本体。既是 Tampermonkey 用户脚本，也是扩展的 content script |
| `manifest.json` | Edge 扩展清单（Manifest V3） |
| `background.js` | 扩展版的系统通知 |
| `icon.png` | 扩展图标 |
