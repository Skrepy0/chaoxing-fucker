// ==UserScript==
// @name         chaoxing-fucker
// @namespace    https://github.com/Skrepy0/chaoxing-fucker
// @supportURL   https://github.com/Skrepy0/chaoxing-fucker/issues
// @source     	 https://github.com/Skrepy0/chaoxing-fucker
// @icon         https://mooc1.chaoxing.com/favicon.ico
// @version      1.0
// @description  阻止超星鼠标离开/切标签/最小化暂停 + 自动静音 + 自动答弹题 + 自动跳转下一节
// @author       Skrepy
// @match        *://*.chaoxing.com/*
// @match        *://*.edu.cn/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const win = (el.ownerDocument && el.ownerDocument.defaultView) || window;
    let style;
    try {
      style = win.getComputedStyle(el);
    } catch (e) {
      return false;
    }
    if (!style) return false;
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function queryAcrossFrames(selector) {
    const docs = [document];
    try {
      if (window.parent && window.parent !== window && window.parent.document) {
        docs.push(window.parent.document);
      }
    } catch (e) {}
    try {
      if (window.top && window.top !== window && window.top.document) {
        if (docs.indexOf(window.top.document) === -1)
          docs.push(window.top.document);
      }
    } catch (e) {}
    for (const doc of docs) {
      try {
        const el = doc.querySelector(selector);
        if (el && isVisible(el)) return el;
      } catch (e) {}
    }
    return null;
  }

  try {
    const origPause = HTMLMediaElement.prototype.pause;
    Object.defineProperty(HTMLMediaElement.prototype, "__cfOriginalPause", {
      value: origPause,
      writable: false,
      configurable: true,
    });
    HTMLMediaElement.prototype.pause = function () {
      // 静默阻止
    };
  } catch (e) {
    console.warn("[chaoxing-fucker] 拦截 pause 失败:", e);
  }

  try {
    const proto = HTMLMediaElement.prototype;
    const mutedDesc = Object.getOwnPropertyDescriptor(proto, "muted");
    const volumeDesc = Object.getOwnPropertyDescriptor(proto, "volume");
    Object.defineProperty(proto, "__cfOriginalMuted", {
      value: mutedDesc,
      writable: false,
      configurable: true,
    });
    Object.defineProperty(proto, "__cfOriginalVolume", {
      value: volumeDesc,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(proto, "muted", {
      get: function () {
        return true;
      },
      set: function () {
        /* 忽略，永远静音 */
      },
      configurable: true,
    });

    Object.defineProperty(proto, "volume", {
      get: function () {
        return 0;
      },
      set: function () {
        /* 忽略，永远静音 */
      },
      configurable: true,
    });

    const origPlay = proto.play;
    Object.defineProperty(proto, "__cfOriginalPlay", {
      value: origPlay,
      writable: false,
      configurable: true,
    });
    proto.play = function () {
      try {
        if (mutedDesc && mutedDesc.set) mutedDesc.set.call(this, true);
        if (volumeDesc && volumeDesc.set) volumeDesc.set.call(this, 0);
      } catch (e) {}
      return origPlay.apply(this, arguments);
    };

    console.log("[chaoxing-fucker] 自动静音已启用");
  } catch (e) {
    console.warn("[chaoxing-fucker] 自动静音初始化失败:", e);
  }

  const BLOCKED_EVENTS = new Set([
    "mouseout",
    "mouseleave",
    "blur",
    "focusout",
    "visibilitychange",
    "pagehide",
  ]);
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if ((this === window || this === document) && BLOCKED_EVENTS.has(type)) {
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  [
    "onblur",
    "onfocus",
    "onfocusout",
    "onfocusin",
    "onmouseout",
    "onmouseleave",
    "onvisibilitychange",
    "onpagehide",
  ].forEach((prop) => {
    try {
      Object.defineProperty(window, prop, {
        get: () => null,
        set: () => {},
        configurable: true,
      });
    } catch (e) {}
    try {
      Object.defineProperty(document, prop, {
        get: () => null,
        set: () => {},
        configurable: true,
      });
    } catch (e) {}
  });

  [
    "visibilityState",
    "webkitVisibilityState",
    "mozVisibilityState",
    "msVisibilityState",
  ].forEach((prop) => {
    try {
      Object.defineProperty(document, prop, {
        get: () => "visible",
        configurable: true,
      });
    } catch (e) {}
  });
  ["hidden", "webkitHidden", "mozHidden", "msHidden"].forEach((prop) => {
    try {
      Object.defineProperty(document, prop, {
        get: () => false,
        configurable: true,
      });
    } catch (e) {}
  });
  try {
    Object.defineProperty(document, "hasFocus", {
      value: () => true,
      writable: false,
      configurable: true,
    });
  } catch (e) {}

  window.addEventListener("load", function () {
    function hijackPlayerPause() {
      if (window.ananas && typeof window.ananas.pause === "function") {
        window.ananas.pause = function () {
          console.log("[chaoxing-fucker] 已拦截 ananas.pause");
        };
      }
    }
    hijackPlayerPause();
    setTimeout(hijackPlayerPause, 1000);
    setTimeout(hijackPlayerPause, 3000);

    function resumeAllVideos() {
      const quizVisible = Array.from(
        document.querySelectorAll(".ans-videoquiz"),
      ).some((q) => isVisible(q));
      if (quizVisible) return;
      document.querySelectorAll("video").forEach((video) => {
        try {
          const origMuted = HTMLMediaElement.prototype.__cfOriginalMuted;
          const origVolume = HTMLMediaElement.prototype.__cfOriginalVolume;
          if (origMuted && origMuted.set && video.muted !== true)
            origMuted.set.call(video, true);
          if (origVolume && origVolume.set && video.volume !== 0)
            origVolume.set.call(video, 0);
        } catch (e) {}

        if (video.paused && !video.ended) {
          try {
            const p = video.play();
            if (p && p.catch) p.catch(() => {});
          } catch (e) {}
        }
      });
    }

    setInterval(resumeAllVideos, 800);

    try {
      const workerCode =
        'setInterval(function(){ postMessage("tick"); }, 700);';
      const workerBlob = new Blob([workerCode], {
        type: "application/javascript",
      });
      const workerUrl = URL.createObjectURL(workerBlob);
      const worker = new Worker(workerUrl);
      worker.onmessage = function () {
        resumeAllVideos();
      };
      console.log("[chaoxing-fucker] Worker 定时器已启动（后台不再节流）");
    } catch (e) {
      console.warn("[chaoxing-fucker] Worker 创建失败，退回主线程定时器:", e);
    }

    const quizAttempts = new Map();
    const processingQuizzes = new WeakSet();

    function autoAnswerQuiz() {
      document.querySelectorAll(".ans-videoquiz").forEach((quiz) => {
        const container = quiz.closest(".x-container") || quiz;
        if (!isVisible(quiz) && !isVisible(container)) return;
        if (processingQuizzes.has(quiz)) return;

        const submitting = quiz.querySelector("#videoquiz-submitting");
        if (submitting && isVisible(submitting)) return;

        const titleEl = quiz.querySelector(".tkItem_title");
        const key = titleEl
          ? titleEl.textContent.trim()
          : "quiz_" + (quiz.id || "");
        if (!key) return;

        const options = quiz.querySelectorAll(".ans-videoquiz-opt");
        if (options.length === 0) return;

        let tried = quizAttempts.get(key);
        if (!tried) {
          tried = new Set();
          quizAttempts.set(key, tried);
        }
        if (tried.size >= options.length) tried.clear();

        let chosenIdx = -1;
        for (let i = 0; i < options.length; i++) {
          if (!tried.has(i)) {
            chosenIdx = i;
            break;
          }
        }
        if (chosenIdx === -1) chosenIdx = 0;

        const opt = options[chosenIdx];
        const input = opt.querySelector("input[type=radio]");
        const label = opt.querySelector("label");
        if (input && !input.checked) input.click();
        else if (label && (!input || !input.checked)) label.click();
        tried.add(chosenIdx);

        processingQuizzes.add(quiz);
        console.log(
          "[chaoxing-fucker] 自动答题：选项",
          chosenIdx + 1,
          "｜题干：",
          key,
        );

        setTimeout(() => {
          const submitBtn = quiz.querySelector("#videoquiz-submit");
          if (submitBtn && isVisible(submitBtn)) submitBtn.click();

          setTimeout(() => {
            const continueBtn = quiz.querySelector("#videoquiz-continue");
            if (continueBtn && isVisible(continueBtn)) continueBtn.click();

            const spanNot = quiz.querySelector("#spanNot");
            const spanNotBack = quiz.querySelector("#spanNotBack");
            const wrongVisible =
              (spanNot && isVisible(spanNot)) ||
              (spanNotBack && isVisible(spanNotBack));
            if (!wrongVisible) quizAttempts.delete(key);
            setTimeout(() => processingQuizzes.delete(quiz), 600);
          }, 1000);
        }, 400);
      });
    }
    setInterval(autoAnswerQuiz, 1000);

    initAutoAdvance();
  });

  function initAutoAdvance() {
    const SS_KEY = "cf_auto_advance_state";
    const MAX_CLICKS = 30;
    const MAX_DURATION = 3 * 60 * 1000;

    function getState() {
      try {
        const s = sessionStorage.getItem(SS_KEY);
        if (!s) return null;
        const o = JSON.parse(s);
        if (Date.now() - o.ts > MAX_DURATION) {
          sessionStorage.removeItem(SS_KEY);
          return null;
        }
        return o;
      } catch {
        return null;
      }
    }
    function setState(count, ts) {
      try {
        sessionStorage.setItem(
          SS_KEY,
          JSON.stringify({ count, ts: ts || Date.now() }),
        );
      } catch (e) {}
    }
    function clearState() {
      try {
        sessionStorage.removeItem(SS_KEY);
      } catch (e) {}
    }

    function findVideo() {
      return (
        document.querySelector("#video_html5_api") ||
        document.querySelector("video.vjs-tech") ||
        document.querySelector("video")
      );
    }
    function isVideoReady(v) {
      return (
        v &&
        v.readyState >= 1 &&
        isFinite(v.duration) &&
        v.duration > 0 &&
        !v.ended
      );
    }
    function clickNextSection() {
      const btn = queryAcrossFrames("#prevNextFocusNext");
      if (btn) {
        console.log("[chaoxing-fucker] 找到下一节按钮，点击");
        btn.click();
        return true;
      }
      return false;
    }
    function handlePopup() {
      const next = queryAcrossFrames(".popDiv .nextChapter");
      if (next) {
        console.log("[chaoxing-fucker] 弹窗出现 → 点击弹窗中的下一节");
        next.click();
        return true;
      }
      return false;
    }

    function autoAdvanceStep(count) {
      const state = getState();
      if (!state) return;
      const startTs = state.ts;

      if (count >= MAX_CLICKS) {
        console.log("[chaoxing-fucker] 跳转次数达上限，停止");
        clearState();
        return;
      }
      if (handlePopup()) {
        setState(count + 1, startTs);
        setTimeout(() => autoAdvanceStep(count + 1), 3000);
        return;
      }

      const v = findVideo();
      const hasSrc = v && (v.currentSrc || v.src);

      if (hasSrc && isVideoReady(v)) {
        console.log("[chaoxing-fucker] 找到可播放视频，结束自动跳转");
        clearState();
        if (v.paused) v.play().catch(() => {});
        return;
      }
      if (hasSrc && !v.ended && v.readyState < 1) {
        setTimeout(() => autoAdvanceStep(count), 2500);
        return;
      }

      if (clickNextSection()) {
        console.log("[chaoxing-fucker] 点击下一节，第", count + 1, "次");
        setState(count + 1, startTs);
        setTimeout(() => autoAdvanceStep(count + 1), 3500);
      } else {
        console.log("[chaoxing-fucker] 找不到下一节按钮，3 秒后重试");
        setTimeout(() => autoAdvanceStep(count), 3000);
      }
    }

    function bindVideoEnd() {
      const v = findVideo();
      if (!v || v._cfEndBound) return;
      v._cfEndBound = true;
      v.addEventListener("ended", () => {
        console.log("[chaoxing-fucker] 视频结束 → 自动跳转下一节");
        if (getState()) return;
        const now = Date.now();
        setState(0, now);
        setTimeout(() => autoAdvanceStep(0), 1000);
      });
    }
    bindVideoEnd();
    setInterval(bindVideoEnd, 2000);

    const state = getState();
    if (state) {
      console.log(
        "[chaoxing-fucker] 恢复自动跳转状态，已跳",
        state.count,
        "次",
      );
      setTimeout(() => autoAdvanceStep(state.count), 2500);
    }

    setInterval(() => {
      if (getState()) return;
      const v = findVideo();
      if (v && v.ended && v.currentTime > 0) {
        console.log("[chaoxing-fucker] 兜底检测到视频结束");
        const now = Date.now();
        setState(0, now);
        setTimeout(() => autoAdvanceStep(0), 1000);
      }
    }, 3000);

    console.log("[chaoxing-fucker] 已启动");
  }
})();
