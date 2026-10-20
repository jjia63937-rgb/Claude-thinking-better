// ==UserScript==
// @name         学习通视频播放监测
// @namespace    https://github.com/jjia63937-rgb/Claude-thinking-better
// @version      1.0.0
// @description  监测学习通页面（包括嵌套 iframe）里视频的播放状态。视频暂停、播完、卡住或弹出题目时，用系统通知和提示音提醒你。只读取状态，不改变播放行为。
// @match        *://*.chaoxing.com/*
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

// 同一份文件既是 Tampermonkey 用户脚本，也是 Edge 扩展的 content script（见 manifest.json）。

(function () {
  'use strict';

  const MSG_KEY = '__xxtVideoMonitor';
  const IS_TOP = window === window.top;

  // 学习通视频里弹出的随堂题目。页面结构改版后可能需要更新这个选择器。
  const QUIZ_SELECTOR = '.ans-videoquiz';
  // 用来在面板上显示当前章节名，找不到时退回 document.title。
  const CHAPTER_SELECTOR = '.prev_title, #mainid h1, .chapter_title';

  const PAUSE_ALERT_MS = 5000;    // 暂停超过这么久才提醒，避免拖进度条时误报
  const STALL_ALERT_MS = 20000;   // 缓冲超过这么久算卡住
  const REPORT_INTERVAL_MS = 1000;
  const STALE_MS = 6000;          // 这么久没收到某个视频的汇报，就认为它所在的 iframe 已经关掉了

  // ---------------------------------------------------------------------------
  // 每个 frame：找到本 frame 里的 <video>，把状态汇报给顶层页面
  // ---------------------------------------------------------------------------

  const frameId = Math.random().toString(36).slice(2, 8);
  const tracked = new Map(); // video -> { id, bufferingSince }
  let videoSeq = 0;

  function isVisible(el) {
    return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
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

  function report(v) {
    const info = tracked.get(v);
    if (!info) return;
    const msg = {
      [MSG_KEY]: 1,
      id: info.id,
      state: videoState(v, info),
      bufferingSince: info.bufferingSince,
      current: v.currentTime,
      duration: v.duration,
      rate: v.playbackRate,
      quiz: Array.from(document.querySelectorAll(QUIZ_SELECTOR)).some(isVisible),
    };
    try {
      window.top.postMessage(msg, '*');
    } catch (e) {
      // 顶层页面不可达时什么也不做
    }
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
        try {
          window.top.postMessage({ [MSG_KEY]: 1, id: info.id, gone: true }, '*');
        } catch (e) {
          // 同上
        }
      }
    }
  }

  setInterval(scan, REPORT_INTERVAL_MS);
  scan();

  if (!IS_TOP) return;

  // ---------------------------------------------------------------------------
  // 顶层页面：汇总所有 frame 的视频状态，显示面板，按需提醒
  // ---------------------------------------------------------------------------

  const SETTINGS_KEY = 'xxtVideoMonitorSettings';
  const settings = { notify: true, sound: true, onlyBackground: true, collapsed: false };
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch (e) {
    // 读不到就用默认值
  }
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // 存不了也不影响本次使用
    }
  }

  // id -> { state, since, lastSeen, everPlayed, alerted, quiz, current, duration, rate, bufferingSince }
  const videos = new Map();

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m[MSG_KEY] !== 1 || typeof m.id !== 'string') return;
    if (m.gone) {
      videos.delete(m.id);
      render();
      return;
    }
    const now = Date.now();
    let v = videos.get(m.id);
    if (!v) {
      v = { state: m.state, since: now, everPlayed: false, alerted: false, quiz: false };
      videos.set(m.id, v);
    }
    if (m.state !== v.state) {
      v.state = m.state;
      v.since = now;
      v.alerted = false;
      if (m.state === 'ended' && v.everPlayed) raiseAlert('视频播放完毕', '可以去看下一节了。');
    }
    if (m.state === 'playing') v.everPlayed = true;
    if (m.quiz && !v.quiz) raiseAlert('视频中弹出了题目', '回到页面作答后视频才会继续。');
    v.quiz = !!m.quiz;
    v.current = m.current;
    v.duration = m.duration;
    v.rate = m.rate;
    v.bufferingSince = m.bufferingSince;
    v.lastSeen = now;
    render();
  });

  setInterval(() => {
    const now = Date.now();
    for (const [id, v] of videos) {
      if (now - v.lastSeen > STALE_MS) {
        videos.delete(id);
        continue;
      }
      if (v.alerted) continue;
      if (v.state === 'paused' && v.everPlayed && !v.quiz && now - v.since >= PAUSE_ALERT_MS) {
        v.alerted = true;
        raiseAlert('视频已暂停', '学习通在页面失去焦点时常会自动暂停视频。');
      } else if (v.state === 'buffering' && v.bufferingSince && now - v.bufferingSince >= STALL_ALERT_MS) {
        v.alerted = true;
        raiseAlert('视频卡住了', '已经缓冲超过 ' + STALL_ALERT_MS / 1000 + ' 秒，可以刷新或换线路。');
      }
    }
    render();
  }, 1000);

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
    if (typeof GM_notification === 'function') {
      GM_notification({ title, text: body, timeout: 10000, onclick: () => window.focus() });
    } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({ type: 'xxt-notify', title, body });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
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
    </style>
    <div class="box">
      <div class="head"><span>视频监测</span><small class="summary"></small></div>
      <div class="body">
        <div class="chapter"></div>
        <div class="list"></div>
        <div class="opts">
          <label><input type="checkbox" data-key="notify"> 系统通知</label>
          <label><input type="checkbox" data-key="sound"> 提示音</label>
          <label><input type="checkbox" data-key="onlyBackground"> 只在页面不在前台时提醒</label>
          <button class="test">测试提醒</button>
        </div>
      </div>
    </div>`;

  const box = root.querySelector('.box');
  const summaryEl = root.querySelector('.summary');
  const chapterEl = root.querySelector('.chapter');
  const listEl = root.querySelector('.list');

  box.classList.toggle('collapsed', settings.collapsed);
  root.querySelector('.head').addEventListener('click', () => {
    settings.collapsed = !settings.collapsed;
    box.classList.toggle('collapsed', settings.collapsed);
    saveSettings();
  });
  for (const input of root.querySelectorAll('input[data-key]')) {
    input.checked = !!settings[input.dataset.key];
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
    const chapter = document.querySelector(CHAPTER_SELECTOR);
    chapterEl.textContent = (chapter && chapter.textContent.trim()) || originalTitle;

    if (videos.size === 0) {
      listEl.innerHTML = '<div class="empty">本页还没有发现视频</div>';
      summaryEl.textContent = '';
      return;
    }
    listEl.textContent = '';
    let i = 0;
    let playing = 0;
    for (const v of videos.values()) {
      i++;
      if (v.state === 'playing') playing++;
      const [label, color] = v.quiz ? ['弹出题目', '#dc2626'] : STATE_LABEL[v.state] || [v.state, '#6b7280'];
      const row = document.createElement('div');
      row.className = 'row';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = color;
      const text = document.createElement('span');
      text.textContent = (videos.size > 1 ? '视频 ' + i + ' · ' : '') + label;
      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = fmt(v.current) + ' / ' + fmt(v.duration) + (v.rate && v.rate !== 1 ? ' ×' + v.rate : '');
      row.append(dot, text, time);
      listEl.append(row);
    }
    summaryEl.textContent = playing ? playing + ' 个播放中' : '无播放';
  }

  render();
  document.documentElement.append(host);
})();
