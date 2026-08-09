// ==UserScript==
// @name               IGNIS — Instagram Enhancement Suite
// @version            9.5.1
// @description        IGNIS v9.4: instant high-quality downloads (posts, reels, stories, highlights, HD avatars, DASH video+audio MP4 mux via Mediabunny, captions, EXIF) with sane defaults on every media surface.
// @author             IGNIS
// @match              https://*.instagram.com/*
// @downloadURL        https://cdn.jsdelivr.net/gh/mheci/ignis@main/ignis.user.js
// @updateURL          https://cdn.jsdelivr.net/gh/mheci/ignis@main/ignis.user.js
// @require            https://code.jquery.com/jquery-4.0.0.min.js
// @require            https://cdn.jsdelivr.net/npm/mediabunny@1.34.5/dist/bundles/mediabunny.min.cjs
// @grant              GM_addStyle
// @grant              GM_download
// @grant              GM_getValue
// @grant              GM_info
// @grant              GM_notification
// @grant              GM_openInTab
// @grant              GM_registerMenuCommand
// @grant              GM_setValue
// @grant              GM_unregisterMenuCommand
// @grant              GM_xmlhttpRequest
// @connect            *
// @icon               https://www.google.com/s2/favicons?domain=www.instagram.com&sz=32
// @license            GPL-3.0-only
// @compatible         chrome >= 100
// @compatible         edge >= 100
// @compatible         firefox >= 100
// @run-at             document-idle
// ==/UserScript==
(function () {
  "use strict";

  /* ============================================================
     IGNIS v9.2 — download-focused build
     Ignis Core    : state, storage, utils
     Ignis Lens    : media detection & extraction
     Ignis Forge   : download engine (blob, EXIF, DASH, captions)
     Ignis Render  : UI (download dialog, dashboard, viewer, toasts)
     ============================================================ */

  const VERSION = "9.5.1";
  const NAME = "IGNIS";
  const $ = jQuery;

  // ─── Settings catalog [key, category, label, description, default] ─────
  const SETTINGS = [
    ["AUTO_RENAME", "download", "Auto Rename Files", "Auto-renames downloaded files. Right-click the row to edit the template.", true],
    ["RENAME_PUBLISH_DATE", "download", "Use Publish Date in Filename", "Uses the post publish date instead of the download time.", true],
    ["CAPTURE_IMAGE_VIA_MEDIA_CACHE", "download", "Capture Images via Cache", "Captures high-quality image URLs from the page's resource cache.", true],
    ["DOWNLOAD_ORIGINAL_QUALITY", "download", "Download Original Quality", "Strips size constraints from CDN URLs to get the original file.", true],
    ["FORCE_RESOURCE_VIA_MEDIA", "download", "Fetch via Media API", "Fetches resources via the Media API for the highest quality.", true],
    ["PREFER_DASH_MANIFEST", "download", "Prefer DASH Manifest", "Downloads separate highest-quality video + audio DASH streams and merges them.", true],
    ["FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED", "download", "Fallback if API Throttled", "Falls back to direct links when the Media API is rate-limited.", true],
    ["NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST", "download", "Always Use Media API for New Tab", "Always resolves items via the Media API when opening a new tab.", false],
    ["FORCE_FETCH_ALL_RESOURCES", "download", "Force Fetch All Resources", "Always loads the full post payload from the API for dialogs.", false],
    ["MODIFY_RESOURCE_EXIF", "download", "Add EXIF Metadata", "Adds post URL, date and author to image EXIF.", true],
    ["DOWNLOAD_WITH_CAPTION", "download", "Download with Caption (.txt)", "Also saves the post caption as a .txt file alongside the media.", false],
    ["DIRECT_DOWNLOAD_ALL", "download", "Direct Download All", "Downloads every item of a post immediately, without a dialog.", false],
    ["DIRECT_DOWNLOAD_STORY", "download", "Direct Download Story", "Downloads all story items immediately, without a dialog.", false],
    ["DIRECT_DOWNLOAD_VISIBLE_RESOURCE", "download", "Download Visible Resource", "Directly downloads only the currently visible carousel item.", false],
    ["DOWNLOAD_CAROUSEL_ALL", "download", "Download All Carousel Items", "Downloading a carousel post always fetches every item.", false],
    ["DOWNLOAD_STORY_HIGHLIGHTS", "download", "Download Story Highlights", "Story 'Download All' also includes the user's highlights.", false],
    ["DOWNLOAD_PROFILE_PIC_HD", "download", "Download HD Profile Pic", "Requests the highest-resolution profile picture available.", true],
    ["USE_EXTERNAL_DOWNLOAD_MODE", "download", "Use External Download Mode", "Downloads via the browser download manager (GM_download) instead of in-memory blobs — best for large videos.", false],
    ["KEYBOARD_DOWNLOAD_S", "keyboard", "S Download", "S downloads the focused post.", true],
    ["KEYBOARD_SHORTCUTS_HELP", "keyboard", "Keyboard Shortcuts Help", "Shift+? shows the shortcuts overlay.", true],
  ];

  const CATS = [["download", "Downloads"], ["keyboard", "Keyboard"]];

  const USER_SETTING = {};
  const CAT_MAP = {};
  const LABEL = {};
  const DESC = {};
  SETTINGS.forEach(function (s) {
    USER_SETTING[s[0]] = !!s[4];
    CAT_MAP[s[0]] = s[1];
    LABEL[s[0]] = s[2];
    DESC[s[0]] = s[3];
  });

  const PARENT_CHILD_MAPPING = {
    AUTO_RENAME: ["RENAME_PUBLISH_DATE"],
    FORCE_RESOURCE_VIA_MEDIA: [
      "FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED",
      "NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST",
      "PREFER_DASH_MANIFEST",
    ],
  };

  const FALLBACK_APP_ID = "936619743392459";
  const IMAGE_CACHE_KEY = "URLS_OF_IMAGES_TEMPORARILY_STORED";
  const IMAGE_CACHE_MAX_AGE = 12 * 60 * 60 * 1000;
  const IMAGE_MAX_CACHE_ITEMS = 300;
  const checkInterval = 250;

  const SVG = {
    DOWNLOAD: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>',
    NEW_TAB: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    THUMBNAIL: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    DOWNLOAD_ALL: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13v8l-4-4"/><path d="m12 21 4-4"/><path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284"/></svg>',
    CLOSE: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    TEXT: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>',
  };

  const resourceCountSelector =
    "*:not([data-pagelet])>*:not([role]):not([data-pagelet])>*>*>*[role]>*>ul[class] li[class]";
  const userIdCache = new Map();
  const $body = $("body");

  // ─── State ─────────────────────────────────────────────────────────────
  const state = {
    fileRenameFormat:
      "%USERNAME%-%SOURCE_TYPE%-%SHORTCODE%-%YEAR%%MONTH%%DAY%_%HOUR%%MINUTE%%SECOND%_%ORIGINAL_NAME_FIRST%",
    registerMenuIds: [],
    currentURL: location.href,
    firstStarted: false,
    pageLoaded: false,
    route: null,
    GL_logger: [],
    GL_repeat: null,
    postPoll: null,
    homepageObserverDebounce: null,
    GL_dataCache: { stories: {}, highlights: {} },
    GL_payloadCache: {},
    GL_imageCache: {},
    GL_mediaDataCache: {},
    busy: 0,
    _igTab: "download",
    settingsHotkeyKeyCode: 87,
    debugHotkeyKeyCode: 90,
    downloadStoryHotkeyKeyCode: 83,
    bodyEventsRegistered: false,
  };

  // ─── Storage (crash-safe) ──────────────────────────────────────────────
  const Store = {
    get(key, fallback) {
      try {
        const v = GM_getValue(key, fallback);
        return v === undefined ? fallback : v;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        GM_setValue(key, value);
      } catch (e) {
        /* storage full or disabled */
      }
    },
    loadImageCache() {
      const raw = this.get(IMAGE_CACHE_KEY, {});
      if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
      return {};
    },
  };

  // ─── Logging ───────────────────────────────────────────────────────────
  function logger() {
    var msg = Array.prototype.slice.call(arguments);
    if (state.GL_logger.length > 500) {
      state.GL_logger = [{ time: Date.now(), content: ["logger sliced"] }].concat(
        state.GL_logger.slice(-499)
      );
    }
    state.GL_logger.push({ time: Date.now(), content: msg });
    try {
      console.log("[" + new Date().toISOString() + "]", "[" + NAME + "]", msg.join(" "));
    } catch (e) {
      /* console blocked */
    }
  }

  // ─── Small utils ───────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function normTs(ts) {
    if (ts == null || isNaN(ts)) return Math.floor(Date.now() / 1000);
    ts = Number(ts);
    return ts > 1e12 ? Math.floor(ts / 1000) : Math.floor(ts);
  }

  function sanitizeFilename(name) {
    return String(name == null ? "" : name)
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .replace(/[. ]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
  }

  function isMacOS() {
    return /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent);
  }

  function getPlatformModifierKey() {
    return isMacOS() ? "⌥" : "Alt";
  }

  function makeButton(icon, title, cls) {
    return $(
      '<div class="' + cls + '" role="button" tabindex="0" aria-label="' + esc(title) + '" title="' + esc(title) + '">' + icon + "</div>"
    );
  }

  function openNewTab(link) {
    if (!link) return;
    var a = document.createElement("a");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ─── Username extraction (multi-strategy) ──────────────────────────────
  function cleanName(t) {
    t = (t || "").replace(/^@/, "").trim().toLowerCase();
    return /^[a-zA-Z0-9_.]{1,30}$/.test(t) ? t : null;
  }

  function getStoryUsername() {
    var name = $("body > div section._ac0a header._ac0k ._ac0l a + div a")
      .first()
      .text()
      .trim();
    var u = cleanName(name);
    if (u) return u;

    name = $('body > div section:visible header a[href^="/"]')
      .filter(function () {
        var $a = $(this);
        var href = $a.attr("href") || "";
        var parts = href.split("/").filter(Boolean);
        return (
          parts.length === 1 &&
          $a.text().trim().length > 0 &&
          !href.startsWith("/stories/") &&
          !/^\d+$/.test(parts[0])
        );
      })
      .first()
      .text()
      .trim();
    u = cleanName(name);
    if (u) return u;

    name = $("body > div section:visible header span")
      .filter(function () {
        return cleanName($(this).text()) && $(this).children().length === 0;
      })
      .first()
      .text()
      .trim();
    u = cleanName(name);
    if (u) return u;

    var parts = location.pathname.split("/").filter(Boolean);
    if (parts[0] === "stories" && parts.length >= 2 && !/^\d+$/.test(parts[1])) {
      return cleanName(parts[1]);
    }
    return null;
  }

  function getPostUsername($article) {
    if (!$article || !$article.length) return null;
    var name = $article.find("header > div:last-child > div:first-child span a")
      .first()
      .text()
      .trim();
    var u = cleanName(name);
    if (u) return u;

    name = $article
      .find('header a[href^="/"]')
      .filter(function () {
        var href = $(this).attr("href") || "";
        return href.split("/").filter(Boolean).length === 1 && $(this).text().trim();
      })
      .first()
      .text()
      .trim();
    u = cleanName(name);
    if (u) return u;

    name = $article
      .find('a[href^="/"]')
      .filter(function () {
        var href = $(this).attr("href") || "";
        var p = href.split("/").filter(Boolean);
        return p.length === 1 && /^[a-zA-Z0-9_.]{1,30}$/.test(p[0]) && !/^\d+$/.test(p[0]);
      })
      .first()
      .attr("href");
    if (name) return cleanName(name.split("/").filter(Boolean)[0]);

    var alt = $article.find("header img[alt]").first().attr("alt") || "";
    var m = alt.match(/^(.+?)(?:'s?\s+profile\s+picture|のプロフィール)/i);
    if (m) return cleanName(m[1]);
    return null;
  }

  function getHighlightsStoryUsername() {
    var name = $('body > div section:visible a[href^="/"]')
      .filter(function () {
        var href = $(this).attr("href") || "";
        var p = href.split("/").filter(Boolean);
        return p.length === 1 && /^[a-zA-Z0-9_.]{1,30}$/.test(p[0]) && !/^\d+$/.test(p[0]);
      })
      .first()
      .attr("href");
    var u = cleanName(name);
    if (u) return u;

    name = $('body > div section:visible header a[href^="/"]')
      .filter(function () {
        var href = $(this).attr("href") || "";
        return href.split("/").filter(Boolean).length === 1 && $(this).text().trim();
      })
      .first()
      .text()
      .trim();
    u = cleanName(name);
    if (u) return u;

    return getStoryUsername();
  }

  // ─── Candidate sorting (non-mutating) ──────────────────────────────────
  function sortCandidatesDescending(candidates, widthKey, stpKey) {
    if (!Array.isArray(candidates)) return candidates || [];
    return candidates
      .map(function (c) {
        return c;
      })
      .sort(function (a, b) {
        if (stpKey) {
          var aStp = "",
            bStp = "";
          try {
            aStp = new URL(a.url || a.src).searchParams.get("stp") || "";
            bStp = new URL(b.url || b.src).searchParams.get("stp") || "";
          } catch (e) {
            /* ignore */
          }
          if (aStp && bStp && aStp.length !== bStp.length) return bStp.length - aStp.length;
        }
        var aW = a[widthKey] || a.config_width || 0;
        var bW = b[widthKey] || b.config_width || 0;
        return bW - aW;
      });
  }

  // ─── Story container detection ─────────────────────────────────────────
  function findStoryContainer() {
    if ($("body > div section._ac0a").length > 0) {
      return $("body > div section:visible._ac0a");
    }
    var $c = $("body > div section:visible > div > div[style]:not([class])");
    if ($c.length) {
      $c.css("position", "relative");
      return $c;
    }
    var $mount = $('div[id^="mount"] section > div > a[href="/"]');
    if ($mount.length) {
      var $d = $mount
        .parent()
        .parent()
        .parent()
        .find("section:visible > div > div[style]:not([class])");
      if ($d.length) {
        $d.css("position", "relative");
        return $d;
      }
      var $e = $mount
        .parent()
        .parent()
        .parent()
        .find(
          'section:visible > div div[style]:not([class]) > div:not([data-visualcompletion="loading-state"])'
        );
      if ($e.length) {
        $e.css("position", "relative");
        return $e;
      }
      var $f = $mount.parents("section:visible").find("div[style]:not([class])");
      if ($f.length) {
        $f.css("position", "relative");
        return $f;
      }
    }
    var $g = $(
      "body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])"
    );
    if ($g.length) {
      var best = null,
        bestW = -1;
      $g.each(function () {
        var w = $(this).width();
        if (w > bestW) {
          bestW = w;
          best = $(this);
        }
      });
      if (best) return best.children("div").first();
    }
    return null;
  }

  // ─── Loading bar / progress helpers ────────────────────────────────────
  function updateLoadingBar(isLoading) {
    state.busy = Math.max(0, state.busy + (isLoading ? 1 : -1));
    if (state.busy > 0) Progress.show();
    else Progress.hide();
  }

  // ─── Toast + notification system ───────────────────────────────────────
  const Toasts = (function () {
    var stack = [];
    var host = null;
    function ensure() {
      if (!host || !document.body.contains(host)) {
        host = document.createElement("div");
        host.className = "ignis-toasts";
        document.body.appendChild(host);
      }
      return host;
    }
    function show(message, type, duration) {
      var el = document.createElement("div");
      el.className = "ignis-toast ignis-toast-" + (type || "info");
      el.textContent = message;
      el.setAttribute("role", "status");
      ensure().appendChild(el);
      requestAnimationFrame(function () {
        el.classList.add("ignis-toast-in");
      });
      stack.push(el);
      while (stack.length > 5) {
        var old = stack.shift();
        if (old.parentNode) old.parentNode.removeChild(old);
      }
      var t = setTimeout(function () {
        el.classList.remove("ignis-toast-in");
        el.classList.add("ignis-toast-out");
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
          var i = stack.indexOf(el);
          if (i > -1) stack.splice(i, 1);
        }, 250);
      }, duration || 4000);
      el.addEventListener("click", function () {
        clearTimeout(t);
        el.classList.remove("ignis-toast-in");
        el.classList.add("ignis-toast-out");
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 250);
      });
    }
    return {
      info: function (m) {
        show(m, "info");
      },
      success: function (m) {
        show(m, "success");
      },
      error: function (m) {
        show(m, "error", 6000);
      },
    };
  })();

  function notify(title, text) {
    try {
      GM_notification({ title: title, text: text || "", timeout: 5000 });
    } catch (e) {
      Toasts.info((title || "") + (text ? " — " + text : ""));
    }
  }

  // ─── Progress overlay ───────────────────────────────────────────────────
  const Progress = (function () {
    var el = null;
    var label = null;
    function ensure() {
      if (!el || !document.body.contains(el)) {
        el = document.createElement("div");
        el.className = "ignis-progress";
        label = document.createElement("span");
        var spin = document.createElement("i");
        el.appendChild(spin);
        el.appendChild(label);
        document.body.appendChild(el);
      }
      return el;
    }
    return {
      show: function () {
        ensure().classList.add("ignis-progress-on");
      },
      hide: function () {
        if (el) el.classList.remove("ignis-progress-on");
      },
      set: function (now, total) {
        ensure();
        label.textContent = now + "/" + total;
        this.show();
        if (now >= total) {
          setTimeout(function () {
            Progress.hide();
          }, 700);
        }
      },
    };
  })();

  // ─── Persistent settings boot ───────────────────────────────────────────
  function initSettings() {
    Object.keys(USER_SETTING).forEach(function (name) {
      var v = Store.get(name, null);
      if (typeof v === "boolean") USER_SETTING[name] = v;
    });
    var fmt = Store.get("G_RENAME_FORMAT", null);
    if (typeof fmt === "string" && fmt.length > 0) state.fileRenameFormat = fmt;
    var hotkeys = [
      ["G_HOTKEY_SETTINGS_KEYCODE", "settingsHotkeyKeyCode"],
      ["G_HOTKEY_DEBUG_KEYCODE", "debugHotkeyKeyCode"],
      ["G_HOTKEY_DOWNLOAD_STORY_KEYCODE", "downloadStoryHotkeyKeyCode"],
    ];
    hotkeys.forEach(function (pair) {
      var v = Store.get(pair[0], null);
      if (typeof v === "number") state[pair[1]] = v;
    });
    state.GL_imageCache = Store.loadImageCache();
  }
