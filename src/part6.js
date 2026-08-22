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
      [getPlatformModifierKey() + " + K", "Command palette"],
      [(isMacOS() ? "\u2318" : "Ctrl") + " + K", "Command palette (browser-safe)"],
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

  // ─── Command palette ───────────────────────────────────────────────────
  function toggleCommandPalette() {
    var existing = document.querySelector(".ignis-palette");
    if (existing) {
      existing.remove();
      return;
    }
    var actions = [
      { label: "Open Settings", kw: "settings preferences options", fn: function () { showSetting(); } },
      { label: "Download Statistics", kw: "stats usage numbers", fn: function () { showSetting("stats"); } },
      { label: "About " + NAME, kw: "about version info", fn: showAbout },
      { label: "Debug Window", kw: "debug logs console", fn: showDebugDOM },
      { label: "Download Focused Post", kw: "save post quick download", fn: quickDownloadFocusedPost },
      {
        label: "Download Current Story",
        kw: "save story download",
        fn: function () {
          if (state.route === "story") $(".ignis-sd").first().trigger("click");
          else Toasts.info("Open a story first.");
        },
      },
      { label: "Download All Stories", kw: "save story all batch", fn: function () { downloadStoriesAll("stories"); } },
      { label: "Keyboard Shortcuts", kw: "shortcuts help keys overlay", fn: toggleShortcutsHelp },
      { label: "Close Dialogs", kw: "close modals dismiss", fn: function () { ModalStack.closeTop(); } },
      { label: "Reload " + NAME, kw: "reload restart refresh", fn: reloadScript },
    ];
    var wrap = $('<div class="ignis-palette">');
    var card = $('<div class="ignis-pal-card">');
    var inp = $('<input class="ignis-pal-inp" type="text" placeholder="Type a command…" spellcheck="false">');
    var listBox = $('<div class="ignis-pal-list">');
    var shown = actions.slice();
    var active = 0;
    function paint() {
      listBox.children(".ignis-pal-it").each(function (i) {
        $(this).toggleClass("ignis-pal-on", i === active);
      });
      var el = listBox.children(".ignis-pal-on")[0];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    }
    function render(q) {
      q = (q || "").trim().toLowerCase();
      shown = actions.filter(function (a) {
        return !q || a.label.toLowerCase().indexOf(q) > -1 || a.kw.indexOf(q) > -1;
      });
      active = 0;
      listBox.empty();
      if (!shown.length) {
        listBox.append('<div class="ignis-empty" style="padding:18px">No matching commands.</div>');
        return;
      }
      shown.forEach(function (a, i) {
        var it = $('<div class="ignis-pal-it" role="button" tabindex="-1">').text(a.label);
        it.on("mouseenter", function () {
          active = i;
          paint();
        });
        it.on("click", function () {
          close();
          a.fn();
        });
        listBox.append(it);
      });
      paint();
    }
    function close() {
      wrap.remove();
      $(document).off("keydown.igpal");
    }
    inp.on("input", function () {
      render(inp.val());
    });
    wrap.on("mousedown", function (e) {
      if (e.target === wrap[0]) close();
    });
    card.append(inp, listBox);
    wrap.append(card);
    $body.append(wrap);
    $(document).on("keydown.igpal", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (shown.length) {
          active = (active + 1) % shown.length;
          paint();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (shown.length) {
          active = (active - 1 + shown.length) % shown.length;
          paint();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        var a = shown[active];
        close();
        if (a) a.fn();
      }
    });
    render("");
    setTimeout(function () {
      inp.trigger("focus");
    }, 0);
  }

  function installCommandPalette() {
    document.addEventListener("keydown", function (e) {
      if (!USER_SETTING.COMMAND_PALETTE) return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        toggleCommandPalette();
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
      } else if (code === 75) {
        e.preventDefault();
        toggleCommandPalette();
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
    clearTimeout(state.postPoll);
    state.postPoll = null;
    $body.off(".ignisEvents");
    state.bodyEventsRegistered = false;
    $(".ignis-bar, .ignis-sb, .ignis-sb-pos, .ignis-pd, .ignis-ksh, .ignis-palette, .ignis-gd").remove();
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
    add("Command Palette", "k", toggleCommandPalette);
    add("About " + NAME, "i", showAbout);
    add("Debug Window", "z", showDebugDOM);
    add("Reload Script", "r", reloadScript);
  }

  // ─── Boot ──────────────────────────────────────────────────────────────
  function ignisBoot() {
    $body = $("body");
    initSettings();
    purgeCache();
    Stats.session();
    registerMenuCommand();
    registerBodyHandlers();
    registerPerformanceObserver();
    installKeyboardShortcuts();
    installAltHotkeys();
    installCommandPalette();

    Router.start();
    Router.enter();
    installDomObserver();
    setTimeout(function () {
      scanAll();
    }, 250);

    logger(NAME, "v" + VERSION, "ready \u2192 route:", state.route || location.pathname);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ignisBoot);
  } else {
    ignisBoot();
  }
})();
