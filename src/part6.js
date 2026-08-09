  /* ============================================================
     Ignis Boot — cache, keyboard, menu, startup
     ============================================================ */

  // ─── Cache subsystem ───────────────────────────────────────────────────
  function purgeCache() {
    var now = Date.now();
    var changed = false;
    Object.keys(state.GL_imageCache).forEach(function (k) {
      var e = state.GL_imageCache[k];
      if (!e || !e.ts || now - e.ts > IMAGE_CACHE_MAX_AGE) {
        delete state.GL_imageCache[k];
        changed = true;
      }
    });
    if (changed) Store.set(IMAGE_CACHE_KEY, state.GL_imageCache);
  }

  function putInCache(mediaId, url) {
    if (!mediaId || !url) return;
    var keys = Object.keys(state.GL_imageCache);
    if (keys.length >= IMAGE_MAX_CACHE_ITEMS) {
      keys.sort(function (a, b) {
        return (state.GL_imageCache[a].ts || 0) - (state.GL_imageCache[b].ts || 0);
      });
      delete state.GL_imageCache[keys[0]];
    }
    state.GL_imageCache[mediaId] = { url: url, ts: Date.now() };
    clearTimeout(window.__imgCacheTimer);
    window.__imgCacheTimer = setTimeout(function () {
      Store.set(IMAGE_CACHE_KEY, state.GL_imageCache);
    }, 800);
  }

  function getImageFromCache(mediaId) {
    if (!mediaId) return null;
    var e = state.GL_imageCache[mediaId];
    if (!e) return null;
    if (Date.now() - (e.ts || 0) > IMAGE_CACHE_MAX_AGE) {
      delete state.GL_imageCache[mediaId];
      return null;
    }
    return e.url || null;
  }

  function registerPerformanceObserver() {
    if (typeof PerformanceObserver === "undefined") return;
    try {
      var perfObs = new PerformanceObserver(function (list) {
        if (!USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE) return;
        list.getEntries().forEach(function (entry) {
          if (entry.initiatorType !== "img") return;
          var u = entry.name || "";
          if (!(u.indexOf("_e35") > -1 || u.indexOf("_e15") > -1 || u.indexOf(".webp?") > -1)) return;
          if (u.indexOf("_e35_s") > -1) return;
          if (/_[sp](\d+)x\1(?!\d)/.test(u)) return;
          var id = decodeMediaIdFromUrl(u);
          if (id && !state.GL_imageCache[id]) putInCache(id, u);
        });
      });
      perfObs.observe({ entryTypes: ["resource"] });
    } catch (e) {
      logger("PerformanceObserver unavailable:", e && e.message ? e.message : e);
    }
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────
  function quickDownloadFocusedPost() {
    var pa = document.querySelector('a[href^="/p/"]');
    if (!pa) {
      Toasts.info("No post link found on this page.");
      return;
    }
    var href = pa.getAttribute("href") || "";
    var shortcode = href.split("/p/")[1];
    if (!shortcode) return;
    shortcode = shortcode.split("/")[0].split("?")[0];
    var art = pa.closest('[data-snig="canDownload"]');
    resolvePostShortcode(shortcode, { post: art || null }).then(function (loaded) {
      if (!loaded) return;
      var index = 0;
      if (art) index = getVisibleNodeIndex($(art));
      var item = loaded.items[index] || loaded.items[0];
      if (item) {
        downloadResource(item, Object.assign({}, loaded.meta, { sourceType: item.isVideo ? "video" : "photo" }), {});
      }
    });
  }

  function toggleShortcutsHelp() {
    var existing = document.querySelector(".ignis-ksh");
    if (existing) {
      existing.remove();
      return;
    }
    var rows = [
      ["S", "Download focused post"],
      ["Shift + ?", "Show / hide this overlay"],
      [getPlatformModifierKey() + " + W", "Settings"],
      [getPlatformModifierKey() + " + S", "Download story"],
      [getPlatformModifierKey() + " + Z", "Debug window"],
      [getPlatformModifierKey() + " + R", "Reload " + NAME],
      [getPlatformModifierKey() + " + Q", "Close dialogs"],
    ];
    var wrap = $('<div class="ignis-ksh">');
    var card = $('<div class="ignis-ksh-card">');
    card.append(
      "<h3>" + NAME + " — Keyboard Shortcuts</h3><table>" +
        rows
          .map(function (r) {
            return (
              "<tr><td>" +
              esc(r[1]) +
              "</td><td><kbd style='background:var(--ig-surface-2);border:1px solid var(--ig-line);border-bottom-width:2px;border-radius:6px;padding:2px 8px;font:600 11px ui-monospace,Menlo,monospace'>" +
              esc(r[0]) +
              "</kbd></td></tr>"
            );
          })
          .join("") +
        "</table><div class='ignis-hint'>Shortcuts are disabled while typing.</div>"
    );
    wrap.append(card);
    $body.append(wrap);
    wrap.on("mousedown", function (e) {
      if (e.target === wrap[0]) wrap.remove();
    });
  }

  function installKeyboardShortcuts() {
    if (window.__igKS) return;
    window.__igKS = true;
    document.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable)) return;
      var k = e.key;
      if (e.shiftKey && k === "?" && USER_SETTING.KEYBOARD_SHORTCUTS_HELP) {
        e.preventDefault();
        toggleShortcutsHelp();
        return;
      }
      if (k === "s" && !e.ctrlKey && !e.metaKey && USER_SETTING.KEYBOARD_DOWNLOAD_S) {
        e.preventDefault();
        quickDownloadFocusedPost();
      }
    });
  }

  // ─── Alt hotkeys ───────────────────────────────────────────────────────
  function installAltHotkeys() {
    $(window).on("keydown.igAlt", function (e) {
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable)) return;
      if (!e.altKey) return;
      var code = e.keyCode || e.which;
      if (code === 81) {
        e.preventDefault();
        ModalStack.closeTop();
      } else if (code === state.settingsHotkeyKeyCode) {
        e.preventDefault();
        showSetting();
      } else if (code === state.debugHotkeyKeyCode) {
        e.preventDefault();
        showDebugDOM();
      } else if (code === 82) {
        e.preventDefault();
        reloadScript();
      } else if (code === state.downloadStoryHotkeyKeyCode) {
        e.preventDefault();
        if (state.route === "story") $(".ignis-sd").first().trigger("click");
        else if (state.route === "highlights") $(".ignis-hd").first().trigger("click");
        else Toasts.info("Open a story first, then press " + getPlatformModifierKey() + "+S.");
      }
    });
  }

  // ─── Reload & menu ─────────────────────────────────────────────────────
  function reloadScript() {
    clearInterval(state.GL_repeat);
    state.GL_repeat = null;
    clearInterval(state.postPoll);
    state.postPoll = null;
    $body.off(".ignisEvents");
    state.bodyEventsRegistered = false;
    $(".ignis-bar, .ignis-sb, .ignis-sb-pos, .ignis-pd, .ignis-ksh, .ignis-gd").remove();
    $(".ignis-modal").remove();
    $("[data-snig]").removeAttr("data-snig");
    state.pageLoaded = false;
    state.firstStarted = false;
    state.currentURL = location.href;
    if (domObserver) domObserver.disconnect();
    setTimeout(function () {
      Router.enter();
      installDomObserver();
      scanAll();
    }, 150);
    Toasts.info(NAME + " reloaded.");
  }

  function showAbout() {
    showSetting("about");
  }

  function registerMenuCommand() {
    state.registerMenuIds.forEach(function (id) {
      try {
        GM_unregisterMenuCommand(id);
      } catch (e) {
        /* ignore */
      }
    });
    state.registerMenuIds = [];
    function add(label, accessKey, fn) {
      try {
        var id = GM_registerMenuCommand(label, fn, accessKey);
        state.registerMenuIds.push(id);
      } catch (e) {
        logger("menu registration failed:", label);
      }
    }
    add("Settings", "w", showSetting);
    add("Hotkey Settings", "q", showHotkeySetting);
    add("About " + NAME, "i", showAbout);
    add("Debug Window", "z", showDebugDOM);
    add("Reload Script", "r", reloadScript);
  }

  // ─── Boot ──────────────────────────────────────────────────────────────
  initSettings();
  purgeCache();
  registerMenuCommand();
  registerBodyHandlers();
  registerPerformanceObserver();
  installKeyboardShortcuts();
  installAltHotkeys();

  Router.start();
  Router.enter();
  installDomObserver();
  setTimeout(function () {
    scanAll();
  }, 250);

  logger(NAME, "v" + VERSION, "ready — route:", state.route || location.pathname);
})();
