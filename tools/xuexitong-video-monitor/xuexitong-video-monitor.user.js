// ==UserScript==
// @name         学习通视频播放监测
// @namespace    https://github.com/jjia63937-rgb/Claude-thinking-better
// @version      1.3.0
// @description  监测学习通页面（包括嵌套 iframe）里视频的播放状态。视频在后台被暂停时自动继续播放，播完自动进入下一节；暂停、播完、卡住或弹出题目时，用系统通知和提示音提醒你。
// @match        *://*.chaoxing.com/*
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

// 同一份文件既是 Tampermonkey 用户脚本，也是 Edge 扩展的 content script（见 manifest.json）。

(function () {
  'use strict';

  const VERSION = '1.3.0';
  const MSG_KEY = '__xxtVideoMonitor';
  const IS_TOP = window === window.top;

  // 学习通视频里弹出的随堂题目。页面结构改版后可能需要更新这个选择器。
  const QUIZ_SELECTOR = '.ans-videoquiz';
  // 用来在面板上显示当前章节名，找不到时退回 document.title。
  const CHAPTER_SELECTOR = '.prev_title, #mainid h1, .chapter_title';
  // 学习通的"下一节"按钮。找不到时按按钮文字"下一节"查找。
  const NEXT_SELECTOR = '#prevNextFocusNext';

  const PAUSE_ALERT_MS = 5000;    // 暂停超过这么久才提醒，避免拖进度条时误报
  const RESUME_DELAY_MS = 1500;   // 后台被暂停后等这么久再自动继续播放
  const MAX_RESUMES_PER_MIN = 5;  // 一分钟内自动续播超过这么多次就停下，避免和页面来回拉锯
  const STALL_ALERT_MS = 20000;   // 缓冲超过这么久算卡住
  const AUTO_NEXT_DELAY_MS = 5000;   // 播完后等这么久再进下一节，给学习通留时间记录进度
  const ADVANCE_CHECK_MS = 8000;     // 点了"下一节"这么久页面还没变，就当没进去
  const AUTO_START_WAIT_MS = 20000;  // 进入下一节后等这么久还没发现视频，就提醒你
  const REPORT_INTERVAL_MS = 1000;
  // 标签页在后台久了，浏览器会把定时器压到一分钟一次，所以"多久没汇报算消失"要留足余量。
  // 视频所在 iframe 被关掉时会立刻发现（见 pagehide 和 source.closed），不靠这个。
  const STALE_MS = 90000;

  // ---------------------------------------------------------------------------
  // 每个 frame：找到本 frame 里的 <video>，把状态汇报给顶层页面
  // ---------------------------------------------------------------------------

  const frameId = Math.random().toString(36).slice(2, 8);
  const tracked = new Map(); // video -> { id, bufferingSince }
  let videoSeq = 0;

  function isVisible(el) {
    return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  }

  function quizShown() {
    return Array.from(document.querySelectorAll(QUIZ_SELECTOR)).some(isVisible);
  }

  // 本 frame 在页面里的位置，比如 [0, 1] 表示顶层第 1 个 iframe 里的第 2 个 iframe。
  // 用来让面板按页面上的先后顺序排列视频。跨域时也能比较 frame 对象，所以拿得到。
  function framePath() {
    const path = [];
    try {
      let w = window;
      while (w !== w.top) {
        const p = w.parent;
        let idx = -1;
        for (let i = 0; i < p.frames.length; i++) {
          if (p.frames[i] === w) {
            idx = i;
            break;
          }
        }
        path.unshift(idx);
        w = p;
      }
    } catch (e) {
      // 拿不到就不排序
    }
    return path;
  }

  function videoState(v, info) {
    if (v.ended) return 'ended';
    if (v.paused) return 'paused';
    // 没暂停但数据不够播放下一帧，就是在缓冲
    if (v.readyState < 3) {
      if (!info.bufferingSince) info.bufferingSince = Date.now();
      return 'buffering';
    }
    info.bufferingSince = 0;
    return 'playing';
  }

  function postTop(msg) {
    try {
      window.top.postMessage(msg, '*');
    } catch (e) {
      // 顶层页面不可达时什么也不做
    }
  }

  function report(v) {
    const info = tracked.get(v);
    if (!info) return;
    postTop({
      [MSG_KEY]: 1,
      id: info.id,
      order: framePath().concat(Array.prototype.indexOf.call(document.querySelectorAll('video'), v)),
      state: videoState(v, info),
      bufferingSince: info.bufferingSince,
      current: v.currentTime,
      duration: v.duration,
      rate: v.playbackRate,
      quiz: quizShown(),
      muted: v.muted,
    });
  }

  function scan() {
    for (const v of document.querySelectorAll('video')) {
      if (tracked.has(v)) continue;
      tracked.set(v, { id: frameId + '-' + ++videoSeq, bufferingSince: 0 });
      for (const ev of ['play', 'playing', 'pause', 'ended', 'waiting', 'seeked', 'ratechange']) {
        v.addEventListener(ev, () => report(v));
      }
    }
    for (const [v, info] of tracked) {
      if (v.isConnected) {
        report(v);
      } else {
        tracked.delete(v);
        postTop({ [MSG_KEY]: 1, id: info.id, gone: true });
      }
    }
  }

  // 本 frame 被关掉或跳走时，告诉顶层页面这些视频没了
  window.addEventListener('pagehide', () => {
    for (const info of tracked.values()) postTop({ [MSG_KEY]: 1, id: info.id, gone: true });
  });

  // 给"诊断"用：本 frame 里和视频、题目有关的情况。网址去掉了参数，里面有课程和账号相关的编号。
  function frameDiag() {
    const hints = new Set();
    const els = document.querySelectorAll('[class]');
    for (let i = 0; i < els.length && i < 5000 && hints.size < 15; i++) {
      for (const c of els[i].classList) if (/quiz|topic|question|tk/i.test(c)) hints.add(c);
    }
    return {
      path: framePath(),
      url: location.origin + location.pathname,
      iframes: document.querySelectorAll('iframe').length,
      videos: Array.from(document.querySelectorAll('video')).map((v) => ({
        state: v.ended ? 'ended' : v.paused ? 'paused' : 'playing',
        readyState: v.readyState,
        duration: Math.round(v.duration) || 0,
        muted: v.muted,
        src: v.currentSrc ? v.currentSrc.split(':')[0] : '(无)',
      })),
      quizMatches: document.querySelectorAll(QUIZ_SELECTOR).length,
      quizVisible: quizShown(),
      classHints: Array.from(hints),
    };
  }

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m[MSG_KEY] !== 1 || e.source !== window.top) return;
    if (m.cmd === 'diag') {
      postTop({ [MSG_KEY]: 1, diag: frameDiag(), reqId: m.reqId });
      return;
    }
    // 顶层页面要求播放某个视频（自动续播，或进入下一节后开始播放）。弹出题目时不播放，题目需要你自己作答。
    if (m.cmd !== 'play' || quizShown()) return;
    for (const [v, info] of tracked) {
      if (info.id === m.id && v.paused && !v.ended) {
        const p = v.play();
        // 播放失败时视频仍是暂停状态，顶层页面会照常发出"视频已暂停"的提醒。
        // 新一节的视频还没被你点过，浏览器可能不允许有声自动播放，这时退一步静音播放。
        if (p) {
          p.catch((err) => {
            if (m.allowMuted && err && err.name === 'NotAllowedError') {
              v.muted = true;
              v.play().catch(() => {});
            }
          });
        }
      }
    }
  });

  setInterval(scan, REPORT_INTERVAL_MS);
  scan();

  if (!IS_TOP) return;

  // ---------------------------------------------------------------------------
  // 顶层页面：汇总所有 frame 的视频状态，显示面板，按需提醒
  // ---------------------------------------------------------------------------

  // 设置存在扩展或 Tampermonkey 自己的存储里，学习通的各个子域名（mooc1、mooc1-1……）共用一份。
  const SETTINGS_KEY = 'xxtVideoMonitorSettings';
  const settings = { autoResume: true, autoNext: true, notify: true, sound: true, onlyBackground: true, collapsed: false };
  const hasExtStorage = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
  try {
    // 旧版本存在页面 localStorage 里，先读出来当默认值
    Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch (e) {
    // 读不到就用默认值
  }
  function loadSettings(cb) {
    try {
      if (typeof GM_getValue === 'function') return cb(GM_getValue(SETTINGS_KEY, null));
      if (hasExtStorage) return chrome.storage.local.get(SETTINGS_KEY, (r) => cb(r && r[SETTINGS_KEY]));
    } catch (e) {
      // 扩展刚被重新加载时会读不到，用当前值
    }
    cb(null);
  }
  function saveSettings() {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(SETTINGS_KEY, { ...settings });
      else if (hasExtStorage) chrome.storage.local.set({ [SETTINGS_KEY]: { ...settings } });
      else localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // 存不了也不影响本次使用
    }
  }

  // id -> { order, state, since, lastSeen, everPlayed, alerted, quiz, current, duration, rate, bufferingSince,
  //         source, pausedInBackground, resumeTried, resumeTimes, resumes, gaveUp, autoStarted, muted }
  const videos = new Map();

  // 按页面上的先后顺序排列
  function sortedVideos() {
    return Array.from(videos).sort(([, a], [, b]) => {
      const x = a.order || [];
      const y = b.order || [];
      for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
      return x.length - y.length;
    });
  }

  // 自动进入下一节的进度。点"下一节"前在 sessionStorage 记一笔，这样学习通整页刷新后也能接着开始播放。
  const AUTO_START_KEY = 'xxtVideoMonitorAutoStart';
  let allEndedAt = 0;   // 本页所有视频都播完的时间
  let advance = null;   // 正在离开的那一节：{ key, ids }。同一节只尝试一次，进入新的一节后清空
  let autoStartAt = 0;  // 进入下一节的时间，等新视频出现后开始播放
  try {
    const t = Number(sessionStorage.getItem(AUTO_START_KEY));
    if (t && Date.now() - t < AUTO_START_WAIT_MS) autoStartAt = t;
    sessionStorage.removeItem(AUTO_START_KEY);
  } catch (e) {
    // 读不到就不接着播
  }

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m[MSG_KEY] !== 1 || m.cmd) return;
    if (m.diag) {
      onDiagReply(m);
      return;
    }
    if (typeof m.id !== 'string') return;
    if (m.gone) {
      videos.delete(m.id);
      tick();
      return;
    }
    const now = Date.now();
    let v = videos.get(m.id);
    if (!v) {
      v = { state: m.state, since: now, everPlayed: false, alerted: false, quiz: false, resumeTimes: [], resumes: 0 };
      videos.set(m.id, v);
      // 刚进入下一节，开始播放新出现的第一个视频
      if (autoStartAt && settings.autoNext && m.state === 'paused') {
        autoStartAt = 0;
        v.autoStarted = true;
        e.source.postMessage({ [MSG_KEY]: 1, cmd: 'play', id: m.id, allowMuted: true }, '*');
      }
    }
    v.source = e.source;
    v.order = m.order;
    if (m.state !== v.state) {
      v.state = m.state;
      v.since = now;
      v.alerted = false;
      v.resumeTried = false;
      // 你看着页面时暂停的，当作你自己按的暂停，不自动续播
      v.pausedInBackground = pageInBackground();
      // 后台标签页的周期定时器会被浏览器压慢，到点要做的检查用一次性定时器另外安排
      if (m.state === 'paused') {
        setTimeout(tick, RESUME_DELAY_MS + 50);
        setTimeout(tick, PAUSE_ALERT_MS + 50);
      }
      if (m.state === 'ended' && v.everPlayed) {
        const next = settings.autoNext && nextUnplayedVideo();
        if (next) {
          // 同一页还有没看的视频，先播它
          next.v.autoStarted = true;
          next.v.source.postMessage({ [MSG_KEY]: 1, cmd: 'play', id: next.id, allowMuted: true }, '*');
        } else if (!settings.autoNext) {
          raiseAlert('视频播放完毕', '可以去看下一节了。');
        } else {
          setTimeout(tick, AUTO_NEXT_DELAY_MS + 50);
        }
      }
    }
    if (m.state === 'playing') {
      v.everPlayed = true;
      // 你回到页面重新播放后，之前放弃的自动续播重新生效
      if (!pageInBackground()) v.gaveUp = false;
    }
    if (m.muted && !v.muted && v.autoStarted) {
      raiseAlert('视频在静音播放', '浏览器不允许自动播放有声视频，已改为静音播放。回到页面可以取消静音。');
    }
    v.muted = !!m.muted;
    if (m.quiz && !v.quiz) raiseAlert('视频中弹出了题目', '回到页面作答后视频才会继续。');
    v.quiz = !!m.quiz;
    v.current = m.current;
    v.duration = m.duration;
    v.rate = m.rate;
    v.bufferingSince = m.bufferingSince;
    v.lastSeen = now;
    tick();
  });

  function tick() {
    const now = Date.now();
    for (const [id, v] of videos) {
      let closed = false;
      try {
        closed = !!(v.source && v.source.closed);
      } catch (e) {
        // 读不到就当还在
      }
      if (closed || now - v.lastSeen > STALE_MS) {
        videos.delete(id);
        continue;
      }
      if (
        settings.autoResume && v.state === 'paused' && v.everPlayed && !v.quiz &&
        v.pausedInBackground && !v.resumeTried && !v.gaveUp && v.source && now - v.since >= RESUME_DELAY_MS
      ) {
        v.resumeTried = true;
        v.resumeTimes = v.resumeTimes.filter((t) => now - t < 60000);
        if (v.resumeTimes.length >= MAX_RESUMES_PER_MIN) {
          v.gaveUp = true;
        } else {
          v.resumeTimes.push(now);
          v.resumes++;
          v.source.postMessage({ [MSG_KEY]: 1, cmd: 'play', id }, '*');
        }
      }
      if (v.alerted) continue;
      // 自动续播成功的话视频早就回到播放状态了，还停在暂停说明需要你处理
      if (v.state === 'paused' && v.everPlayed && !v.quiz && now - v.since >= PAUSE_ALERT_MS) {
        v.alerted = true;
        raiseAlert(
          '视频已暂停',
          v.gaveUp
            ? '视频一分钟内被反复暂停，已停止自动继续播放，需要你回到页面处理。'
            : v.resumeTried
              ? '自动继续播放没有成功，需要你回到页面处理。'
              : '学习通在页面失去焦点时常会自动暂停视频。'
        );
      } else if (v.state === 'buffering' && v.bufferingSince && now - v.bufferingSince >= STALL_ALERT_MS) {
        v.alerted = true;
        raiseAlert('视频卡住了', '已经缓冲超过 ' + STALL_ALERT_MS / 1000 + ' 秒，可以刷新或换线路。');
      }
    }
    checkAutoNext(now);
    render();
  }
  setInterval(tick, 1000);

  // ---- 自动进入下一节 ----

  function nextUnplayedVideo() {
    for (const [id, v] of sortedVideos()) {
      if (v.state === 'paused' && !v.everPlayed && v.source) return { id, v };
    }
    return null;
  }

  function chapterText() {
    const el = document.querySelector(CHAPTER_SELECTOR);
    return el ? el.textContent.trim() : '';
  }

  function pageKey() {
    return location.href + '|' + chapterText();
  }

  // 是否已经离开了 a 记下的那一节。网址或章节标题变了算；不依赖它们也能判断：
  // 出现了新视频，或者上一节的视频全都没了（学习通换节时会换掉视频所在的 iframe）。
  function movedOn(a) {
    if (pageKey() !== a.key) return true;
    const ids = Array.from(videos.keys());
    return ids.some((id) => !a.ids.has(id)) || !ids.some((id) => a.ids.has(id));
  }

  function findNextButton() {
    const el = document.querySelector(NEXT_SELECTOR);
    if (el && isVisible(el)) return { el, how: '按 ' + NEXT_SELECTOR + ' 找到' };
    // 页面改版后按文字找，取最里层的那个元素来点
    for (const el of document.querySelectorAll('a, button, div, span')) {
      const t = el.textContent.trim();
      if ((t === '下一节' || t === '下一章') && isVisible(el) &&
          !Array.from(el.children).some((c) => c.textContent.trim() === t)) {
        return { el, how: '按文字「' + t + '」找到' };
      }
    }
    return null;
  }

  function clearAutoStart() {
    autoStartAt = 0;
    try {
      sessionStorage.removeItem(AUTO_START_KEY);
    } catch (e) {
      // 同上
    }
  }

  function checkAutoNext(now) {
    if (advance && movedOn(advance)) {
      // 已经到了新的一节（自动或你手动切的）。上一节播完的视频立刻清掉，免得又被当成"本节已播完"连跳两节
      for (const id of advance.ids) if (videos.has(id) && videos.get(id).state === 'ended') videos.delete(id);
      advance = null;
    }
    if (autoStartAt && now - autoStartAt > AUTO_START_WAIT_MS) {
      autoStartAt = 0;
      raiseAlert('新一节没有找到视频', '这一节可能是测验、文档，或者视频在别的标签页里，需要你回到页面处理。');
    }
    if (!settings.autoNext || advance || videos.size === 0 ||
        !Array.from(videos.values()).every((v) => v.state === 'ended')) {
      allEndedAt = 0;
      return;
    }
    if (!allEndedAt) allEndedAt = now;
    if (now - allEndedAt < AUTO_NEXT_DELAY_MS) return;

    allEndedAt = 0;
    const a = { key: pageKey(), ids: new Set(videos.keys()) };
    advance = a;
    const btn = findNextButton();
    if (!btn) {
      raiseAlert('本节视频已播完', '没有找到"下一节"按钮，可能已经是最后一节。');
      return;
    }
    try {
      sessionStorage.setItem(AUTO_START_KEY, String(now));
    } catch (e) {
      // 整页刷新后就不会自动开始播放，不影响别的
    }
    autoStartAt = now;
    btn.el.click();
    setTimeout(() => {
      if (advance === a && !movedOn(a)) {
        // 不去点学习通弹出的确认框：本节没完成的任务点要你自己决定
        clearAutoStart();
        raiseAlert('没能进入下一节', '本节可能还有任务点没完成（比如章节测验），已停在本节，需要你回到页面处理。');
      }
      tick();
    }, ADVANCE_CHECK_MS);
  }

  // ---- 提醒 ----

  const originalTitle = document.title;
  let titleAlert = '';

  function pageInBackground() {
    return document.hidden || !document.hasFocus();
  }

  function raiseAlert(title, body, force) {
    // 你正看着页面时，面板本身就够了
    if (!force && settings.onlyBackground && !pageInBackground()) {
      flashPanel();
      return;
    }
    flashPanel();
    if (settings.sound) beep();
    if (settings.notify) notify('学习通：' + title, body);
    if (pageInBackground()) {
      titleAlert = '【' + title + '】';
      document.title = titleAlert + originalTitle;
    }
  }

  function clearTitleAlert() {
    if (titleAlert && !pageInBackground()) {
      if (document.title.startsWith(titleAlert)) document.title = document.title.slice(titleAlert.length);
      titleAlert = '';
    }
  }
  document.addEventListener('visibilitychange', clearTitleAlert);
  window.addEventListener('focus', clearTitleAlert);

  function notify(title, body) {
    try {
      if (typeof GM_notification === 'function') {
        GM_notification({ title, text: body, timeout: 10000, onclick: () => window.focus() });
      } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({ type: 'xxt-notify', title, body });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch (e) {
      // 扩展刚被重新加载、旧页面还没刷新时会走到这里，刷新页面即可
    }
  }

  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new AudioContext();
      audioCtx.resume();
      const t0 = audioCtx.currentTime;
      for (const offset of [0, 0.25]) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, t0 + offset);
        gain.gain.exponentialRampToValueAtTime(0.3, t0 + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.18);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0 + offset);
        osc.stop(t0 + offset + 0.2);
      }
    } catch (e) {
      // 浏览器不允许自动播放声音时静默失败
    }
  }

  // ---- 诊断：把页面结构整理成一段文字，方便对照真实页面调整选择器 ----

  let diagOpen = false;
  let diagReq = null; // { id, replies: [] }

  function allFrames(w, path, out) {
    for (let i = 0; i < w.frames.length; i++) {
      const f = w.frames[i];
      out.push({ w: f, path: path.concat(i) });
      try {
        allFrames(f, path.concat(i), out);
      } catch (e) {
        // 读不到更深的层就算了
      }
    }
    return out;
  }

  function onDiagReply(m) {
    if (diagReq && m.reqId === diagReq.id) diagReq.replies.push(m.diag);
  }

  function describe(el) {
    const id = el.id ? '#' + el.id : '';
    const cls = el.classList.length ? '.' + Array.from(el.classList).join('.') : '';
    return '<' + el.tagName.toLowerCase() + id + cls + '> "' + el.textContent.trim().slice(0, 20) + '"';
  }

  function runDiag() {
    diagOpen = true;
    render();
    diagText.value = '正在收集……';
    const req = { id: Math.random().toString(36).slice(2), replies: [] };
    diagReq = req;
    const frames = allFrames(window, [], []);
    for (const f of frames) {
      try {
        f.w.postMessage({ [MSG_KEY]: 1, cmd: 'diag', reqId: req.id }, '*');
      } catch (e) {
        // 发不过去的会在报告里显示成"没有回应"
      }
    }
    setTimeout(() => {
      if (diagReq !== req) return;
      diagText.value = buildDiag(frames, [frameDiag()].concat(req.replies));
      copyDiag();
    }, 1500);
  }

  function buildDiag(frames, replies) {
    const lines = [];
    const next = findNextButton();
    const chapter = document.querySelector(CHAPTER_SELECTOR);
    lines.push('学习通视频监测 诊断信息 v' + VERSION + '（' + (typeof GM_info !== 'undefined' ? 'Tampermonkey' : '扩展') + '）');
    lines.push('浏览器：' + (navigator.userAgent.match(/Edg\/[\d.]+|Chrome\/[\d.]+/g) || []).join(' '));
    lines.push('页面：' + location.origin + location.pathname + (pageInBackground() ? '（在后台）' : ''));
    lines.push('章节标题：' + (chapter ? describe(chapter) : '没找到（' + CHAPTER_SELECTOR + '），用的是网页标题'));
    lines.push('下一节按钮：' + (next ? next.how + ' ' + describe(next.el) : '没找到'));
    const candidates = Array.from(document.querySelectorAll('a, button, div, span, li'))
      .filter((el) => /下一|next/i.test(el.textContent.trim()) && el.textContent.trim().length <= 12 && isVisible(el))
      .slice(0, 6);
    if (candidates.length) lines.push('  页面上含"下一"的元素：' + candidates.map(describe).join('；'));
    lines.push('设置：' + JSON.stringify(settings));
    lines.push('监测到的视频：' + videos.size + ' 个' + (advance ? '（正在离开上一节）' : '') + (autoStartAt ? '（等待新一节视频）' : ''));
    lines.push('');
    lines.push('iframe 共 ' + frames.length + ' 个，' + (replies.length - 1) + ' 个有回应：');
    replies.sort((a, b) => a.path.join(',').localeCompare(b.path.join(',')));
    for (const r of replies) {
      lines.push('[' + (r.path.join('-') || '顶层') + '] ' + r.url + ' ｜ 子iframe ' + r.iframes + ' ｜ 视频 ' + r.videos.length + ' 个' +
        (r.videos.length ? ' ' + JSON.stringify(r.videos) : '') +
        ' ｜ 弹题选择器命中 ' + r.quizMatches + (r.quizVisible ? '（显示中）' : '') +
        (r.classHints.length ? ' ｜ 可能相关的 class：' + r.classHints.join(' ') : ''));
    }
    const answered = new Set(replies.map((r) => r.path.join('-')));
    for (const f of frames) {
      if (answered.has(f.path.join('-'))) continue;
      let url = '跨域，读不到网址';
      try {
        url = f.w.location.href.split('?')[0];
      } catch (e) {
        // 保持"读不到"
      }
      lines.push('[' + f.path.join('-') + '] 没有回应（脚本没在这里运行）：' + url);
    }
    return lines.join('\n');
  }

  function copyDiag() {
    const done = () => (diagStatus.textContent = '已复制，可以直接粘贴发出去');
    const fallback = () => {
      diagText.select();
      try {
        if (document.execCommand('copy')) return done();
      } catch (e) {
        // 再退一步：让你手动复制
      }
      diagStatus.textContent = '没能自动复制，请点「复制」或手动全选复制';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(diagText.value).then(done, fallback);
    } else {
      fallback();
    }
  }

  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('生成诊断信息', runDiag);
  try {
    // 扩展版：点浏览器工具栏上的扩展图标也能生成（没有视频、面板不显示时也能用）
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'xxt-diag') runDiag();
      });
    }
  } catch (e) {
    // 不是扩展环境
  }

  // ---- 面板 ----

  const STATE_LABEL = {
    playing: ['播放中', '#16a34a'],
    paused: ['已暂停', '#d97706'],
    ended: ['已播完', '#2563eb'],
    buffering: ['缓冲中', '#6b7280'],
  };

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .box { font: 13px/1.5 system-ui, "Microsoft YaHei", sans-serif; color: #111827; background: #fff;
             border: 1px solid #d1d5db; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.15);
             width: 260px; overflow: hidden; transition: box-shadow .2s; }
      .box.flash { box-shadow: 0 0 0 3px #f59e0b, 0 4px 16px rgba(0,0,0,.15); }
      .box.diag-open { width: 420px; }
      .head { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px;
              background: #f3f4f6; cursor: pointer; user-select: none; font-weight: 600; }
      .head small { font-weight: 400; color: #6b7280; }
      .body { padding: 8px 10px; }
      .collapsed .body { display: none; }
      .chapter { color: #6b7280; font-size: 12px; margin-bottom: 6px; white-space: nowrap;
                 overflow: hidden; text-overflow: ellipsis; }
      .row { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
      .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
      .time { margin-left: auto; font-variant-numeric: tabular-nums; color: #374151; }
      .empty { color: #6b7280; }
      .opts { border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 6px; }
      .opts label { display: block; cursor: pointer; }
      button { margin-top: 6px; font: inherit; padding: 2px 10px; border: 1px solid #d1d5db;
               border-radius: 4px; background: #fff; cursor: pointer; }
      button:hover { background: #f3f4f6; }
      .diag { display: none; border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 6px; }
      .diag-open .diag { display: block; }
      .diag textarea { width: 100%; box-sizing: border-box; height: 180px; font: 11px/1.4 Consolas, monospace; }
      .diag .status { color: #6b7280; font-size: 12px; }
    </style>
    <div class="box">
      <div class="head"><span>视频监测</span><small class="summary"></small></div>
      <div class="body">
        <div class="chapter"></div>
        <div class="list"></div>
        <div class="opts">
          <label><input type="checkbox" data-key="autoResume"> 后台被暂停时自动继续播放</label>
          <label><input type="checkbox" data-key="autoNext"> 播完自动播放下一节</label>
          <label><input type="checkbox" data-key="notify"> 系统通知</label>
          <label><input type="checkbox" data-key="sound"> 提示音</label>
          <label><input type="checkbox" data-key="onlyBackground"> 只在页面不在前台时提醒</label>
          <button class="test">测试提醒</button>
          <button class="run-diag">生成诊断</button>
        </div>
        <div class="diag">
          <textarea readonly></textarea>
          <div class="status"></div>
          <button class="copy">复制</button>
          <button class="close-diag">关闭</button>
        </div>
      </div>
    </div>`;

  const box = root.querySelector('.box');
  const summaryEl = root.querySelector('.summary');
  const chapterEl = root.querySelector('.chapter');
  const listEl = root.querySelector('.list');
  const diagText = root.querySelector('.diag textarea');
  const diagStatus = root.querySelector('.diag .status');

  function syncSettingsUI() {
    box.classList.toggle('collapsed', settings.collapsed);
    for (const input of root.querySelectorAll('input[data-key]')) input.checked = !!settings[input.dataset.key];
  }
  root.querySelector('.head').addEventListener('click', () => {
    settings.collapsed = !settings.collapsed;
    syncSettingsUI();
    saveSettings();
  });
  for (const input of root.querySelectorAll('input[data-key]')) {
    input.addEventListener('change', () => {
      settings[input.dataset.key] = input.checked;
      saveSettings();
    });
  }
  root.querySelector('.test').addEventListener('click', () => {
    // 这次点击同时让浏览器允许之后播放提示音、弹出网页通知
    if (typeof GM_notification !== 'function' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    raiseAlert('测试提醒', '能看到这条通知、听到提示音，就说明提醒正常。', true);
  });
  root.querySelector('.run-diag').addEventListener('click', runDiag);
  root.querySelector('.copy').addEventListener('click', copyDiag);
  root.querySelector('.close-diag').addEventListener('click', () => {
    diagOpen = false;
    diagReq = null;
    render();
  });

  syncSettingsUI();
  loadSettings((saved) => {
    if (saved && typeof saved === 'object') Object.assign(settings, saved);
    else saveSettings(); // 第一次用新版本：把旧设置搬过去
    syncSettingsUI();
  });

  let flashTimer = 0;
  function flashPanel() {
    box.classList.add('flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => box.classList.remove('flash'), 3000);
  }

  function fmt(sec) {
    if (!isFinite(sec)) return '--:--';
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = String(sec % 60).padStart(2, '0');
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + s : m + ':' + s;
  }

  function render() {
    chapterEl.textContent = chapterText() || originalTitle;
    box.classList.toggle('diag-open', diagOpen);
    if (diagOpen && settings.collapsed) {
      settings.collapsed = false;
      syncSettingsUI();
    }

    // 只在发现视频的页面显示面板，学习通的其他页面（首页、作业、消息等）不受影响
    host.style.display = videos.size === 0 && !diagOpen ? 'none' : '';
    if (videos.size === 0) {
      listEl.innerHTML = '<div class="empty">本页没有发现视频</div>';
      summaryEl.textContent = '';
      return;
    }
    listEl.textContent = '';
    let i = 0;
    let playing = 0;
    for (const [, v] of sortedVideos()) {
      i++;
      if (v.state === 'playing') playing++;
      const [label, color] = v.quiz ? ['弹出题目', '#dc2626'] : STATE_LABEL[v.state] || [v.state, '#6b7280'];
      const row = document.createElement('div');
      row.className = 'row';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = color;
      const text = document.createElement('span');
      text.textContent = (videos.size > 1 ? '视频 ' + i + ' · ' : '') + label +
        (v.muted ? ' · 静音' : '') + (v.resumes ? ' · 已续播 ' + v.resumes + ' 次' : '');
      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = fmt(v.current) + ' / ' + fmt(v.duration) + (v.rate && v.rate !== 1 ? ' ×' + v.rate : '');
      row.append(dot, text, time);
      listEl.append(row);
    }
    summaryEl.textContent = allEndedAt
      ? Math.max(1, Math.ceil((AUTO_NEXT_DELAY_MS - (Date.now() - allEndedAt)) / 1000)) + ' 秒后下一节'
      : playing ? playing + ' 个播放中' : '无播放';
  }

  render();
  document.documentElement.append(host);
})();
