// ==UserScript==
// @name         chaoxing-fucker
// @namespace    https://github.com/Skrepy0/chaoxing-fucker
// @supportURL   https://github.com/Skrepy0/chaoxing-fucker/issues
// @source       https://github.com/Skrepy0/chaoxing-fucker
// @icon         https://mooc1.chaoxing.com/favicon.ico
// @version      1.1
// @description  阻止超星鼠标离开/切标签/最小化暂停 + 自动静音 + 自动答弹题 + 自动跳转下一节 + 一键复制题目
// @author       Skrepy
// @match        *://*.chaoxing.com/*
// @match        *://*.edu.cn/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  // ============ 工具函数 ============
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

  // ============ 第〇层：阉割 HTMLMediaElement.pause ============
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

  // ============ 第〇.五层：自动静音 ============
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
      set: function () {},
      configurable: true,
    });

    Object.defineProperty(proto, "volume", {
      get: function () {
        return 0;
      },
      set: function () {},
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

  // ============ 第一层：拦截事件监听器 ============
  const BLOCKED_EVENTS = new Set([
    "mouseout",
    "mouseleave",
    "blur",
    "focusout",
    "visibilitychange",
    "pagehide",
    "unload",
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

  // ============ 第二层：伪造可见性与焦点 ============
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

  // ============ 主逻辑 ============
  window.addEventListener("load", function () {
    // ---- 第三层：劫持 ananas.pause ----
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

    // ---- 恢复播放 + 强制静音 ----
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

    // ---- Web Worker 定时器：绕过后台标签节流 ----
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

    // ---- 第四层：自动处理弹题 ----
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

    // ---- 第五层：自动跳转下一节 ----
    initAutoAdvance();

    // ---- 第六层：一键复制题目 ----
    initCopyButton();
  });

  // ============ 自动跳转下一节 ============
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

    console.log(
      "[chaoxing-fucker] 已启动：防暂停(含后台) + 自动静音 + 自动弹题 + 自动跳转下一节",
    );
  }

  // ============ 第六层：一键复制题目（字形哈希解密）============

  // ============ 第六层：一键复制题目 ============

  // ---------- 题目提取 ----------
  function extractQuestionsFromDoc(doc) {
    const results = [];
    if (!doc || !doc.body) return results;

    const containerSelectors = [
      ".TiMu",
      ".question-item",
      ".questionLi",
      ".ans-que",
      ".subject-item",
      ".questionItem",
      '[class*="question-item"]',
      '[class*="TiMu"]',
    ];
    let containers = [];
    for (const sel of containerSelectors) {
      try {
        const found = doc.querySelectorAll(sel);
        if (found.length > 0) {
          containers = Array.from(found);
          break;
        }
      } catch (e) {}
    }
    if (containers.length === 0) return results;

    containers.forEach((container) => {
      try {
        const titleSelectors = [
          ".Zy_TItle",
          ".question-title",
          ".TiMu_title",
          ".question-content",
          ".title-content",
          ".mark_name",
        ];
        let titleText = "";
        for (const sel of titleSelectors) {
          const el = container.querySelector(sel);
          if (el) {
            const t = (el.textContent || "").trim().replace(/\s+/g, " ");
            if (t) {
              titleText = t;
              break;
            }
          }
        }
        if (!titleText) {
          const children = container.querySelectorAll("*");
          for (const child of children) {
            const t = (child.textContent || "").trim();
            if (t && t.length > 5 && t.length < 500) {
              titleText = t.replace(/\s+/g, " ");
              break;
            }
          }
        }
        if (!titleText) return;
        titleText = titleText.replace(/^\d+[、.．)]\s*/, "");

        const optionSelectors = [
          ".Zy_ulTop",
          ".option-list",
          ".question-options",
          ".ans-option-list",
          ".option-list-wrap",
        ];
        let optionList = null;
        for (const sel of optionSelectors) {
          const el = container.querySelector(sel);
          if (el) {
            optionList = el;
            break;
          }
        }
        let options = [];
        if (optionList) {
          const items = optionList.querySelectorAll(
            "li, .option-item, .ans-option",
          );
          options = Array.from(items)
            .map((li) => (li.textContent || "").trim().replace(/\s+/g, " "))
            .filter((t) => t);
        } else {
          const uls = container.querySelectorAll("ul");
          for (const ul of uls) {
            const items = ul.querySelectorAll("li");
            if (items.length >= 2) {
              options = Array.from(items)
                .map((li) => (li.textContent || "").trim().replace(/\s+/g, " "))
                .filter((t) => t);
              break;
            }
          }
        }

        function stripOptionPrefix(s) {
          let t = (s || "").replace(/\s+/g, " ").trim();
          let guard = 0;
          while (guard++ < 5) {
            const before = t;
            t = t.replace(/^[A-Za-z]\s*[、.．)）:：]\s*/, "").trim();
            if (t === before)
              t = t.replace(/^[A-Za-z]\s+(?=[^\sA-Za-z])/, "").trim();
            if (t === before) break;
          }
          return t;
        }

        const body = [titleText];
        const seenOpts = new Set();
        options.forEach((opt) => {
          const cleaned = stripOptionPrefix(opt);
          if (!cleaned || seenOpts.has(cleaned)) return;
          seenOpts.add(cleaned);
          const idx = body.length - 1;
          body.push(`${String.fromCharCode(65 + idx)}. ${cleaned}`);
        });

        if (body.length > 0) results.push(body.join("\n"));
      } catch (e) {
        console.warn("[chaoxing-fucker] 提取题目出错:", e);
      }
    });
    return results;
  }

  function collectAllQuestions() {
    const all = [];
    const seen = new Set();
    function walk(win) {
      let doc;
      try {
        doc = win.document;
        if (!doc || seen.has(doc)) return;
        seen.add(doc);
      } catch (e) {
        return;
      }
      try {
        all.push(...extractQuestionsFromDoc(doc));
      } catch (e) {}
      try {
        doc.querySelectorAll("iframe").forEach((iframe) => {
          try {
            if (iframe.contentWindow) walk(iframe.contentWindow);
          } catch (e) {}
        });
      } catch (e) {}
    }
    try {
      walk(window.top || window);
    } catch (e) {
      walk(window);
    }
    return all;
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {}
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px;top:0;";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ---------- 按钮 ----------
  function createCopyButton(inline) {
    const host = document.createElement("span");
    host.id = "cf-copy-btn-host";
    host.style.cssText = inline
      ? "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10;display:inline-block;pointer-events:auto;"
      : "all:initial;position:fixed;right:20px;bottom:150px;z-index:2147483647;";

    const defaultText = inline ? "📋 复制题目" : "📋 复制全部题目";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        .cf-btn {
          padding: ${inline ? "4px 12px" : "10px 18px"};
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          border: none;
          border-radius: ${inline ? "6px" : "8px"};
          cursor: pointer;
          font-size: ${inline ? "13px" : "14px"};
          font-family: system-ui, -apple-system, "PingFang SC", sans-serif;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
          transition: transform 0.15s ease, box-shadow 0.15s ease,
                      opacity 0.15s, background 0.2s ease;
          user-select: none;
          font-weight: 500;
          letter-spacing: 0.3px;
          line-height: 1.4;
          white-space: nowrap;
          min-width: ${inline ? "104px" : "150px"};
          box-sizing: border-box;
          text-align: center;
        }
        .cf-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.55);
        }
        .cf-btn:active:not(:disabled) { transform: translateY(0); }
        .cf-btn:disabled { opacity: 0.8; cursor: wait; }
        .cf-btn.cf-success {
          background: linear-gradient(135deg, #43a047 0%, #2e7d32 100%);
          box-shadow: 0 2px 8px rgba(67, 160, 71, 0.4);
        }
        .cf-btn.cf-error {
          background: linear-gradient(135deg, #e53935 0%, #c62828 100%);
          box-shadow: 0 2px 8px rgba(229, 57, 53, 0.4);
        }
      </style>
      <button class="cf-btn" type="button">${defaultText}</button>
    `;

    const btn = shadow.querySelector(".cf-btn");
    let restoreTimer = null;

    function setButtonText(text, state, duration) {
      if (restoreTimer) {
        clearTimeout(restoreTimer);
        restoreTimer = null;
      }
      btn.textContent = text;
      btn.classList.remove("cf-success", "cf-error");
      if (state === "success") btn.classList.add("cf-success");
      else if (state === "error") btn.classList.add("cf-error");
      if (duration && duration > 0) {
        restoreTimer = setTimeout(() => {
          btn.textContent = defaultText;
          btn.classList.remove("cf-success", "cf-error");
          restoreTimer = null;
        }, duration);
      }
    }

    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      setButtonText("⏳ 提取中…", null, 0);

      try {
        const questions = collectAllQuestions();

        if (questions.length === 0) {
          setButtonText("❌ 未找到题目", "error", 5000);
        } else {
          const text = questions.join("\n\n");
          const ok = await copyToClipboard(text);
          if (ok) {
            setButtonText(`✅ 已复制 ${questions.length} 道`, "success", 5000);
          } else {
            setButtonText("❌ 复制失败", "error", 5000);
            console.log("[chaoxing-fucker] 提取的题目内容：\n" + text);
          }
        }
      } catch (e) {
        console.error("[chaoxing-fucker] 复制题目失败:", e);
        setButtonText("❌ 出错", "error", 5000);
      } finally {
        btn.disabled = false;
      }
    });

    return host;
  }

  function findNewTestTitle() {
    const selectors = [
      "#newTestTitle",
      ".newTestTitle",
      '[id*="newTestTitle"]',
      '[class*="newTestTitle"]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  // ---------- 按钮去重 ----------
  const CF_BTN_MARK = "cf_btn_inserted_at";
  const CF_BTN_TTL = 60000; // 标记有效期 60 秒

  // 检查"任何可见 frame"是否已有按钮
  function cfButtonExistsAnywhere() {
    // 自己
    if (document.getElementById("cf-copy-btn-host")) return true;
    // parent / top（跨域会抛，吞掉）
    for (const w of [window.parent, window.top]) {
      if (!w || w === window) continue;
      try {
        if (w.document && w.document.getElementById("cf-copy-btn-host"))
          return true;
      } catch (e) {}
    }
    // 所有同源子 iframe
    try {
      for (const f of document.querySelectorAll("iframe")) {
        try {
          if (
            f.contentDocument &&
            f.contentDocument.getElementById("cf-copy-btn-host")
          )
            return true;
        } catch (e) {}
      }
    } catch (e) {}
    return false;
  }

  function cfMarkInserted() {
    try {
      sessionStorage.setItem(CF_BTN_MARK, String(Date.now()));
    } catch (e) {}
  }
  function cfRecentlyMarked(ms) {
    try {
      const t = +sessionStorage.getItem(CF_BTN_MARK) || 0;
      return Date.now() - t < (ms || CF_BTN_TTL);
    } catch (e) {
      return false;
    }
  }

  function tryInsertInline() {
    if (cfButtonExistsAnywhere()) return true;
    const title = findNewTestTitle();
    if (!title) return false;
    try {
      const cs = window.getComputedStyle(title);
      if (cs.position === "static") title.style.position = "relative";
    } catch (e) {}
    const btn = createCopyButton(true);
    try {
      title.appendChild(btn);
    } catch (e) {
      return false;
    }
    console.log("[chaoxing-fucker] 复制按钮已插入 newTestTitle");
    return true;
  }

  function tryInsertFallback() {
    if (cfButtonExistsAnywhere()) return;
    if (!document.body) return;
    const btn = createCopyButton(false);
    document.body.appendChild(btn);
    console.log("[chaoxing-fucker] 未找到 newTestTitle，已插入右下角兜底按钮");
  }

  function initCopyButton() {
    // 1. 任何 frame 已有按钮 → 立即退出
    if (cfButtonExistsAnywhere()) {
      console.log("[chaoxing-fucker] 检测到已有按钮，跳过");
      return;
    }

    // 2. 立即尝试内联
    if (tryInsertInline()) {
      cfMarkInserted();
      return;
    }

    // 3. 轮询 8 秒，每 500ms 一次
    let attempts = 0;
    const iv = setInterval(() => {
      attempts++;

      // 每次轮询先看看有没有别处已经插好了
      if (cfButtonExistsAnywhere()) {
        clearInterval(iv);
        console.log("[chaoxing-fucker] 其他 frame 已插入按钮，停止轮询");
        return;
      }

      if (tryInsertInline()) {
        clearInterval(iv);
        cfMarkInserted();
        return;
      }

      if (attempts >= 16) {
        clearInterval(iv);
        // 8 秒内没找到 newTestTitle
        // 30 秒内有人插过 → 跳过兜底
        if (cfRecentlyMarked(30000)) {
          console.log("[chaoxing-fucker] 最近有人插过按钮，跳过兜底");
          return;
        }
        // 再等 3 秒，给其他 frame 最后的机会
        setTimeout(() => {
          if (cfButtonExistsAnywhere()) return;
          if (cfRecentlyMarked(30000)) return;
          tryInsertFallback();
          cfMarkInserted();
        }, 3000);
      }
    }, 500);
  }
})();
