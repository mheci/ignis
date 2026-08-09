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

  const VERSION = "9.5.1";
  const NAME = "IGNIS";
  const $ = jQuery;

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

      }
    },
    loadImageCache() {
      const raw = this.get(IMAGE_CACHE_KEY, {});
      if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
      return {};
    },
  };

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

    }
  }

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

          }
          if (aStp && bStp && aStp.length !== bStp.length) return bStp.length - aStp.length;
        }
        var aW = a[widthKey] || a.config_width || 0;
        var bW = b[widthKey] || b.config_width || 0;
        return bW - aW;
      });
  }

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

  function updateLoadingBar(isLoading) {
    state.busy = Math.max(0, state.busy + (isLoading ? 1 : -1));
    if (state.busy > 0) Progress.show();
    else Progress.hide();
  }

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

  function decodeMediaIdFromUrl(url) {
    try {
      var u = new URL(url);
      var key = u.searchParams.get("ig_cache_key");
      if (!key) return null;
      key = key.split(".")[0];
      var raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
      return raw || null;
    } catch (e) {
      return null;
    }
  }

  function parseSrcset(srcset) {
    if (!srcset) return [];
    return srcset
      .split(",")
      .map(function (part) {
        var bits = part.trim().split(/\s+/);
        return { url: bits[0], width: parseInt(bits[1], 10) || 0 };
      })
      .filter(function (e) {
        return e.url;
      });
  }

  function stripSizeConstraints(url) {
    if (!url) return url;
    return url.replace(/[\/_]s\d+x\d+/g, "").replace(/s\d+x\d+/g, "s1080x1080");
  }

  function pickImage(candidates) {
    if (!Array.isArray(candidates) || !candidates.length) return null;
    var best = null;
    candidates.forEach(function (c) {
      var url = c.url || c.src || null;
      if (!url) return;
      var w = c.width || c.config_width || 0;
      if (!best || w > best.width) best = { url: url, width: w };
    });
    if (!best) return null;
    return USER_SETTING.DOWNLOAD_ORIGINAL_QUALITY ? stripSizeConstraints(best.url) : best.url;
  }

  function pickVideo(versions) {
    if (!Array.isArray(versions) || !versions.length) return null;
    var best = null;
    versions.forEach(function (v) {
      var url = v.url || v.src || null;
      if (!url) return;
      var area = (v.width || 0) * (v.height || 0);
      if (!best || area > best.area) best = { url: url, area: area };
    });
    return best ? best.url : null;
  }

  function thumbFromDisplayResources(resources) {
    if (!Array.isArray(resources) || !resources.length) return null;
    var sorted = sortCandidatesDescending(resources, "config_width");
    return sorted[0] ? sorted[0].src : null;
  }

  function captionOf(item) {
    if (!item) return null;
    if (typeof item.caption === "string") return item.caption || null;
    if (item.caption && typeof item.caption === "object" && item.caption.text) return item.caption.text;
    if (item.edge_media_to_caption && item.edge_media_to_caption.edges && item.edge_media_to_caption.edges[0]) {
      return item.edge_media_to_caption.edges[0].node.text || null;
    }
    return null;
  }

  function normalizePostResource(resource) {
    var out = { username: null, shortcode: null, takenAt: null, caption: null, items: [] };
    if (!resource) return out;
    out.username = (resource.owner && resource.owner.username) || (resource.user && resource.user.username) || null;
    out.shortcode = resource.shortcode || resource.code || null;
    out.takenAt = resource.taken_at_timestamp || resource.taken_at || null;
    out.caption = captionOf(resource);
    if (out.caption && typeof out.caption === "string") out.caption = out.caption.slice(0, 4000);

    var push = function (node) {
      var it = {
        id: node.id || node.pk || String(node.media_id || ""),
        isVideo: !!node.is_video,
        url: null,
        thumb: null,
        width: 0,
        height: 0,
        caption: captionOf(node),
        dash: node.video_dash_manifest ? node : null,
        ext: null,
      };
      if (it.isVideo) {
        var versions = node.video_versions && node.video_versions.length ? node.video_versions : null;
        var vRes = node.video_resources && node.video_resources.length ? node.video_resources : null;
        var vUrl = pickVideo(versions) || pickVideo(vRes) || node.video_url || null;
        if (vUrl) {
          it.url = vUrl;
          it.ext = "mp4";
          if (versions && versions[0]) {
            it.width = versions[0].width || 0;
            it.height = versions[0].height || 0;
          }
          if (vRes && vRes[0]) {
            it.width = it.width || vRes[0].config_width || 0;
            it.height = it.height || vRes[0].config_height || 0;
          }
          it.thumb = thumbFromDisplayResources(node.display_resources) ||
            (node.image_versions2 && node.image_versions2.candidates && node.image_versions2.candidates[0] ? node.image_versions2.candidates[0].url : null) ||
            node.display_url || null;
        }
      } else {
        var imgUrl = pickImage(node.display_resources) ||
          pickImage(node.image_versions2 && node.image_versions2.candidates) ||
          node.display_url || node.display_src || null;
        if (imgUrl) {
          it.url = imgUrl;
          it.ext = /\.webp(\?|$)/i.test(imgUrl) ? "webp" : "jpg";
          it.thumb = it.url;
          if (node.display_resources && node.display_resources.length) {
            it.width = node.display_resources[node.display_resources.length - 1].config_width || 0;
          }
        }
      }
      if (it.url) out.items.push(it);
    };

    if (resource.__typename === "GraphSidecar") {
      (resource.edge_sidecar_to_children && resource.edge_sidecar_to_children.edges || []).forEach(function (e) {
        push(e.node);
      });
    } else if (resource.carousel_media && resource.carousel_media.length) {
      resource.carousel_media.forEach(push);
    } else {
      push(resource);
    }
    return out;
  }

  function normalizeReelItems(items) {
    return (items || []).map(function (item) {
      var it = {
        id: item.id || "",
        isVideo: !!item.is_video,
        url: null,
        thumb: null,
        takenAt: item.taken_at_timestamp || item.taken_at || null,
        caption: typeof item.caption === "string" ? item.caption : null,
        dash: item.video_dash_manifest ? item : null,
        ext: "jpg",
      };
      if (it.isVideo) {
        var vUrl = pickVideo(item.video_resources) || (item.video_versions && item.video_versions.length ? pickVideo(item.video_versions) : null);
        if (vUrl) {
          it.url = vUrl;
          it.ext = "mp4";
        }
        it.thumb = thumbFromDisplayResources(item.display_resources) || item.display_url || null;
      } else {
        var imgUrl = pickImage(item.display_resources) || item.display_url || null;
        if (imgUrl) {
          it.url = imgUrl;
          it.thumb = it.url;
        }
      }
      return it;
    }).filter(function (it) {
      return it.url;
    });
  }

  let cachedAppId = null;

  function getAppId(force) {
    if (cachedAppId && !force) return cachedAppId;
    var result = null;
    try {
      $('script[type="application/json"]').each(function () {
        var text = this.textContent || "";
        var m = text.match(/"APP_ID":"([0-9]+)"/g);
        if (m && m.length) {
          result = (m[0].match(/"APP_ID":"([0-9]+)"/) || [])[1];
          return false;
        }
      });
      if (!result) {
        $("script:not([src])").each(function () {
          var m = (this.textContent || "").match(/"APP_ID":"([0-9]+)"/);
          if (m) {
            result = m[1];
            return false;
          }
        });
      }
    } catch (e) {

    }
    cachedAppId = result || FALLBACK_APP_ID;
    return cachedAppId;
  }

  function androidHeaders() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.0.0 Mobile Safari/537.36 Instagram 307.0.0.34.111 Android (30/11; 480dpi; 1080x2340; google; Pixel 7 XL; panther; qcom; en_US; 439103586)",
      "X-IG-App-ID": getAppId(),
    };
  }

  function request(url, opts) {
    opts = opts || {};
    var headers = Object.assign({ Accept: "application/json" }, opts.headers || {});
    var attempts = (opts.retries != null ? opts.retries : 1) + 1;
    var timeout = opts.timeout || 15000;
    return new Promise(function (resolve, reject) {
      function attempt(n) {
        GM_xmlhttpRequest({
          method: opts.method || "GET",
          url: url,
          headers: headers,
          data: opts.data || null,
          timeout: timeout,
          onload: function (res) {
            var obj = null;
            try {
              obj = JSON.parse(res.response);
            } catch (e) {
              if (n < attempts) return attempt(n + 1);
              return reject(new Error("Invalid JSON response from API"));
            }
            resolve(obj);
          },
          onerror: function () {
            if (n < attempts) return attempt(n + 1);
            reject(new Error("Network error contacting Instagram"));
          },
          ontimeout: function () {
            if (n < attempts) return attempt(n + 1);
            reject(new Error("API request timed out"));
          },
        });
      }
      attempt(0);
    });
  }

  function getUserIdViaSearch(username) {
    return request("https://www.instagram.com/web/search/topsearch/?query=" + encodeURIComponent(username), {
      retries: 0,
      timeout: 12000,
    }).then(function (obj) {
      var users = (obj && obj.users) || [];
      for (var i = 0; i < users.length; i++) {
        if (users[i].user && (users[i].user.username || "").toLowerCase() === username.toLowerCase()) {
          return { user: users[i].user };
        }
      }
      throw new Error("Username not found in search results");
    });
  }

  function getUserIdWithAgent(username) {
    return request("https://i.instagram.com/api/v1/users/web_profile_info/?username=" + encodeURIComponent(username), {
      headers: { "X-IG-App-ID": getAppId() },
      retries: 1,
      timeout: 10000,
    }).then(function (obj) {
      var user = null;
      var hdUrl = null;
      if (obj && obj.data && obj.data.user) {
        user = obj.data.user;
        hdUrl = obj.data.user.hd_profile_pic_url_info && obj.data.user.hd_profile_pic_url_info.url;
      } else if (obj && obj.user && (obj.user.pk || obj.user.id)) {
        user = obj.user;
        hdUrl = obj.user.hd_profile_pic_url_info && obj.user.hd_profile_pic_url_info.url;
      } else if (obj && obj.status === "ok" && obj.graphql && obj.graphql.user) {
        user = obj.graphql.user;
        hdUrl = obj.graphql.user.hd_profile_pic_url_info && obj.graphql.user.hd_profile_pic_url_info.url;
      }
      if (!user) throw new Error("No user data returned");
      if (!user.pk && user.id) user.pk = user.id;
      if (!user.id && user.pk) user.id = user.pk;
      user._hdUrl = hdUrl || null;
      return { user: user };
    });
  }

  function getUserId(username) {
    var key = (username || "").toLowerCase();
    if (userIdCache.has(key)) return userIdCache.get(key);
    var p = getUserIdWithAgent(key)
      .catch(function () {
        return getUserIdViaSearch(key);
      })
      .catch(function (err) {
        userIdCache.delete(key);
        throw new Error("Cannot resolve user ID for: " + username);
      });
    userIdCache.set(key, p);
    return p;
  }

  function getStories(userId) {
    return request(
      "https://www.instagram.com/graphql/query/?query_hash=15463e8449a83d3d60b06be7e90627c7&variables=" +
        encodeURIComponent(JSON.stringify({ reel_ids: [String(userId)], precomposed_overlay: false })),
      { retries: 1 }
    );
  }

  function getHighlightStories(highlightId) {
    return request(
      "https://www.instagram.com/graphql/query/?query_hash=45246d3fe16ccc6577e0bd297a5db1ab&variables=" +
        encodeURIComponent(JSON.stringify({ highlight_reel_ids: [String(highlightId)], precomposed_overlay: false })),
      { retries: 1 }
    );
  }

  function getUserHighlights(userId) {
    return request("https://www.instagram.com/api/v1/highlights/" + encodeURIComponent(userId) + "/highlights_tray/", {
      headers: { "X-IG-App-ID": getAppId() },
      retries: 0,
      timeout: 12000,
    }).then(function (obj) {
      if (obj && obj.status === "ok" && Array.isArray(obj.tray)) return obj.tray;
      throw new Error("Highlights tray unavailable");
    });
  }

  function findDeepKey(obj, key, depth) {
    if (!obj || typeof obj !== "object" || depth > 8) return null;
    if (obj[key] !== undefined) return obj[key];
    for (var k in obj) {
      if (typeof obj[k] === "object") {
        var r = findDeepKey(obj[k], key, depth + 1);
        if (r) return r;
      }
    }
    return null;
  }

  function shortcodeToMediaId(code) {
    var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    var id = 0n;
    for (var i = 0; i < code.length; i++) {
      id = id * 64n + BigInt(alphabet.indexOf(code[i]));
    }
    return id.toString();
  }

  function extractPostFromPageJson(postPath) {
    var scripts = document.querySelectorAll('script[type="application/json"]');
    for (var i = 0; i < scripts.length; i++) {
      var text = scripts[i].textContent || "";
      var item = null;
      try {
        var obj = JSON.parse(text);
        if (text.indexOf("xdt_api__v1__media__shortcode__web_info") > -1) {
          var info = findDeepKey(obj, "xdt_api__v1__media__shortcode__web_info", 0);
          if (info && info.items && info.items[0] && info.items[0].code === postPath) {
            item = info.items[0];
          }
        }
        if (!item && text.indexOf("xig_polaris_media") > -1) {
          var pol = findDeepKey(obj, "xig_polaris_media", 0);
          if (pol) {
            var gated = pol.if_not_gated_logged_out || pol.if_not_gated || pol.media;
            if (gated && (gated.code === postPath || gated.pk)) item = gated;
          }
        }
      } catch (e) {

      }
      if (item) {
        if (item.user && !item.owner) item.owner = item.user;
        return { type: "query_id", resource: item };
      }
    }
    return null;
  }

  function getPostPayload(shortcode) {
    var cached = state.GL_payloadCache[shortcode];
    if (cached && Date.now() - cached.ts < 600000) {
      return Promise.resolve(cached.value);
    }
    function cache(res) {
      state.GL_payloadCache[shortcode] = { ts: Date.now(), value: res };
      return res;
    }
    var page = extractPostFromPageJson(shortcode);
    if (page) return Promise.resolve(cache(page));
    var pk = shortcodeToMediaId(shortcode);
    return request(
      "https://www.instagram.com/api/v1/media/" + encodeURIComponent(pk) + "/info/",
      { headers: { "X-IG-App-ID": getAppId() }, retries: 0, timeout: 10000 }
    ).then(function (obj) {
      if (obj && obj.status === "ok" && obj.items && obj.items[0]) {
        var item = obj.items[0];
        if (item.user && !item.owner) item.owner = item.user;
        return cache({ type: "query_id", resource: item });
      }
      var csrf = "";
      try {
        var m = document.cookie.match(/csrftoken=([^;]+)/);
        if (m) csrf = m[1];
      } catch (e) {

      }
      var vars = encodeURIComponent(
        JSON.stringify({
          shortcode: shortcode,
          __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: false,
        })
      );
      return request("https://www.instagram.com/graphql/query", {
        method: "POST",
        data: "variables=" + vars + "&doc_id=27128499623469141&server_timestamps=true",
        headers: Object.assign(
          { "X-FB-Friendly-Name": "PolarisPostRootQuery" },
          csrf ? { "X-CSRFToken": csrf } : {}
        ),
        retries: 0,
        timeout: 10000,
      }).then(function (obj2) {
        var items =
          obj2 &&
          obj2.data &&
          obj2.data.xdt_api__v1__media__shortcode__web_info &&
          obj2.data.xdt_api__v1__media__shortcode__web_info.items;
        if (items && items[0]) {
          var item2 = items[0];
          if (item2.user && !item2.owner) item2.owner = item2.user;
          return cache({ type: "query_id", resource: item2 });
        }
        var vars2 = encodeURIComponent(JSON.stringify({ shortcode: shortcode }));
        return request(
          "https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=" + vars2,
          { headers: androidHeaders(), retries: 0, timeout: 10000 }
        ).then(function (obj3) {
          if (obj3 && obj3.data && obj3.data.shortcode_media) {
            return cache({ type: "query_hash", resource: obj3.data.shortcode_media });
          }
          throw new Error("Post payload unavailable");
        });
      });
    });
  }

  function getPostOwner(postPath) {
    var shortcode = String(postPath || "").split("/").filter(Boolean).pop();
    return getPostPayload(shortcode).then(function (res) {
      return res.resource.owner && res.resource.owner.username ? res.resource.owner.username : null;
    });
  }

  function getMediaInfo(mediaId) {
    return new Promise(function (resolve, reject) {
      if (mediaId == null || String(mediaId) === "") {
        reject(new Error("Invalid media id"));
        return;
      }
      var appId = getAppId();
      if (!appId) {
        reject(new Error("Invalid app id"));
        return;
      }
      var url = "https://i.instagram.com/api/v1/media/" + encodeURIComponent(String(mediaId)) + "/info/";
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        headers: { "User-Agent": navigator.userAgent, Accept: "*/*", "X-IG-App-ID": appId },
        timeout: 8000,
        onload: function (res) {
          var obj = null;
          try {
            obj = JSON.parse(res.response);
          } catch (e) {
            reject(new Error("Media API returned invalid data"));
            return;
          }
          var finalUrl = res.finalUrl || url;
          if (finalUrl === url) {
            resolve(obj);
            return;
          }
          try {
            var u = new URL(finalUrl);
            if (u.pathname.indexOf("/accounts/login") === 0) reject(new Error("Login required for Media API"));
            else reject(new Error("Media API redirected to " + u.host));
          } catch (e) {
            reject(new Error("Media API redirect"));
          }
        },
        onerror: function () {
          reject(new Error("Media API network error"));
        },
        ontimeout: function () {
          reject(new Error("Media API timed out"));
        },
      });
    });
  }

  function getUserHdAvatar(userId) {
    return request("https://www.instagram.com/api/v1/users/" + encodeURIComponent(String(userId)) + "/info/", {
      headers: { "X-IG-App-ID": getAppId() },
      retries: 0,
      timeout: 12000,
    }).then(function (obj) {
      if (obj && obj.status === "ok" && obj.user && obj.user.hd_profile_pic_url_info && obj.user.hd_profile_pic_url_info.url) {
        return obj.user.hd_profile_pic_url_info.url;
      }
      throw new Error("HD profile picture unavailable");
    });
  }

  function gmFetch(url, responseType) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        responseType: responseType,
        timeout: 60000,
        onload: function (res) {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error("HTTP " + res.status));
            return;
          }
          var hdrs = String(res.responseHeaders || "").toLowerCase();
          if (/text\/html|application\/json/i.test(hdrs)) {
            reject(new Error("Server returned a web page instead of media"));
            return;
          }
          resolve(res.response);
        },
        onerror: function () {
          reject(new Error("Network error"));
        },
        ontimeout: function () {
          reject(new Error("Download timed out"));
        },
      });
    });
  }

  function fetchMediaBlob(url) {
    return gmFetch(url, "blob").then(function (blob) {
      return { blob: blob, isWeb: false };
    });
  }

  function fetchArrayBuffer(url) {
    updateLoadingBar(true);
    return gmFetch(url, "arraybuffer").finally(function () {
      updateLoadingBar(false);
    });
  }

  function saveFiles(downloadLink, metadata) {
    return new Promise(function (resolve) {
      updateLoadingBar(true);
      var uidPromise =
        metadata.uid == null && metadata.username && metadata.username !== "NONE"
          ? getUserId(metadata.username)
              .then(function (info) {
                return (info && info.user && (info.user.id || info.user.pk)) || null;
              })
              .catch(function () {
                return null;
              })
          : Promise.resolve(metadata.uid != null ? metadata.uid : null);
      var filetype = metadata.filetype || "jpg";
      var wantExif =
        USER_SETTING.MODIFY_RESOURCE_EXIF &&
        filetype === "jpg" &&
        metadata.shortcode &&
        metadata.sourceType === "photo";
      var wantCaption = USER_SETTING.DOWNLOAD_WITH_CAPTION && metadata.caption;
      if (
        USER_SETTING.USE_EXTERNAL_DOWNLOAD_MODE &&
        !wantExif &&
        !wantCaption &&
        typeof GM_download === "function"
      ) {
        try {
          GM_download({
            url: downloadLink,
            name: getSaveFileName(downloadLink, metadata),
            onload: function () {
              updateLoadingBar(false);
              resolve(true);
            },
            onerror: function () {
              updateLoadingBar(false);
              resolve(false);
            },
          });
        } catch (e) {
          updateLoadingBar(false);
          resolve(false);
        }
        return;
      }
      fetchMediaBlob(downloadLink)
        .then(function (r) {
          if (r.isWeb) throw new Error("Server returned a web page instead of media");
          return uidPromise.then(function (uid) {
            metadata.uid = uid;
            return r.blob;
          });
        })
        .then(function (blob) {
          return createSaveFileElement(downloadLink, blob, metadata);
        })
        .then(function () {
          updateLoadingBar(false);
          resolve(true);
        })
        .catch(function (err) {
          updateLoadingBar(false);
          logger("saveFiles failed:", err && err.message ? err.message : err);
          Toasts.error("Download failed: " + ((err && err.message) || "unknown error"));
          resolve(false);
        });
    });
  }

  function triggerDownload(blob, filename) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(blob);
      if (USER_SETTING.USE_EXTERNAL_DOWNLOAD_MODE && typeof GM_download === "function") {
        GM_download({
          url: url,
          name: filename,
          onload: function () {
            URL.revokeObjectURL(url);
            resolve();
          },
          onerror: function () {
            URL.revokeObjectURL(url);
            resolve();
          },
        });
        return;
      }
      var link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(function () {
        try {
          document.body.removeChild(link);
        } catch (e) {

        }
        URL.revokeObjectURL(url);
        resolve();
      }, 300);
    });
  }

  function replaceSameOriginHost(url) {
    try {
      var urlObj = new URL(url);
      urlObj.host = "scontent.cdninstagram.com";
      return urlObj.href;
    } catch (e) {
      return url;
    }
  }

  function getSaveFileName(downloadLink, metadata) {
    var timestamp = normTs(metadata.timestamp);
    var index = metadata.index != null ? metadata.index : 0;
    var date = new Date(timestamp * 1000);
    var original_name = "";
    try {
      original_name = decodeURIComponent(
        String(new URL(downloadLink).pathname.split("/").filter(Boolean).pop() || "")
      );
    } catch (e) {

    }
    var base = original_name.split(".").slice(0, -1).join(".");
    original_name = base || original_name;
    var tokens = {
      USERNAME: metadata.username || "NONE",
      SOURCE_TYPE: metadata.sourceType || "post",
      SHORTCODE: metadata.shortcode || "",
      YEAR: String(date.getFullYear()),
      "2-YEAR": String(date.getFullYear()).substr(-2),
      MONTH: pad2(date.getMonth() + 1),
      DAY: pad2(date.getDate()),
      HOUR: pad2(date.getHours()),
      MINUTE: pad2(date.getMinutes()),
      SECOND: pad2(date.getSeconds()),
      ORIGINAL_NAME: original_name,
      ORIGINAL_NAME_FIRST: original_name.split("_")[0] || original_name,
      INDEX: String(index),
      UID: metadata.uid != null ? String(metadata.uid) : "",
    };
    var filename = (state.fileRenameFormat || "").replace(/%([\w\-]+)%/g, function (m, t) {
      var up = t.toUpperCase();
      return tokens[up] != null ? tokens[up] : m;
    });
    filename = sanitizeFilename(filename);
    if (!USER_SETTING.AUTO_RENAME || !filename) {
      filename = sanitizeFilename(
        (metadata.username || "instagram") + "_" + (original_name || "media") + "_" + (metadata.shortcode || "")
      );
    }
    return filename + "." + (metadata.filetype || "jpg");
  }

  async function createSaveFileElement(downloadLink, object, metadata) {
    var filetype = metadata.filetype || "jpg";
    if (metadata.uid == null && metadata.username && metadata.username !== "NONE") {
      try {
        var userInfo = await getUserId(metadata.username);
        metadata.uid =
          (userInfo && userInfo.user && (userInfo.user.id || userInfo.user.pk)) || null;
      } catch (e) {
        metadata.uid = null;
      }
    }
    var downloadName = getSaveFileName(downloadLink, metadata);
    if (!metadata.skipMedia) {
      var wantExif =
        USER_SETTING.MODIFY_RESOURCE_EXIF &&
        filetype === "jpg" &&
        metadata.shortcode &&
        metadata.sourceType === "photo" &&
        (object.type === "image/jpeg" || object.type === "image/webp");
      if (wantExif) {
        try {
          var newBlob = await changeExifData(object, metadata);
          await triggerDownload(newBlob, downloadName);
        } catch (err) {
          logger("EXIF attach failed, saving original:", err && err.message ? err.message : err);
          await triggerDownload(object, downloadName);
        }
      } else {
        await triggerDownload(object, downloadName);
      }
    }
    if (USER_SETTING.DOWNLOAD_WITH_CAPTION && metadata.caption) {
      var captionName = getSaveFileName(
        downloadLink,
        Object.assign({}, metadata, { filetype: "txt" })
      );
      await triggerDownload(
        new Blob([metadata.caption], { type: "text/plain;charset=utf-8" }),
        captionName
      );
    }
  }

  function concatBytes(a, b) {
    var c = new Uint8Array(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
  }
  function u32le(v) {
    return new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255]);
  }
  function u16le(v) {
    return new Uint8Array([v & 255, (v >> 8) & 255]);
  }
  function enc(s) {
    return new TextEncoder().encode(s);
  }
  function encUtf16le(s) {
    var out = new Uint8Array(s.length * 2);
    for (var i = 0; i < s.length; i++) {
      out[i * 2] = s.charCodeAt(i) & 255;
      out[i * 2 + 1] = (s.charCodeAt(i) >> 8) & 255;
    }
    return out;
  }
  function formatExifDate(timestamp) {
    var d = new Date(normTs(timestamp) * 1000);
    if (isNaN(d.getTime())) return "1970:01:01 00:00:00";
    return (
      d.getFullYear() +
      ":" +
      pad2(d.getMonth() + 1) +
      ":" +
      pad2(d.getDate()) +
      " " +
      pad2(d.getHours()) +
      ":" +
      pad2(d.getMinutes()) +
      ":" +
      pad2(d.getSeconds())
    );
  }
  function makeIFDEntry(tag, type, count, valueOrOffset) {
    var b = new Uint8Array(12);
    var dv = new DataView(b.buffer);
    dv.setUint16(0, tag, true);
    dv.setUint16(2, type, true);
    dv.setUint32(4, count, true);
    dv.setUint32(8, valueOrOffset, true);
    return b;
  }
  function fourCC(s) {
    var b = new Uint8Array(4);
    for (var i = 0; i < 4; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  function buildExifPayload(metadata) {
    var dateBytes = enc(formatExifDate(metadata.timestamp) + "\0");
    var artistBytes = enc((metadata.username || "") + "\0");
    var keywordBytes = encUtf16le(
      "https://www.instagram.com/p/" + (metadata.shortcode || "") + "/\0"
    );
    var xpCommentBytes = encUtf16le(
      "https://www.instagram.com/uid/" + (metadata.uid || "unknown") + "\0"
    );
    var tiffHeader = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
    var ifd0 = concatBytes(
      u16le(4),
      concatBytes(
        concatBytes(
          concatBytes(
            makeIFDEntry(0x013b, 2, artistBytes.length, 80),
            makeIFDEntry(0x8769, 4, 1, 62)
          ),
          concatBytes(
            makeIFDEntry(0x9c9c, 1, xpCommentBytes.length, 80 + artistBytes.length + keywordBytes.length),
            makeIFDEntry(0x9c9e, 1, keywordBytes.length, 80 + artistBytes.length)
          )
        ),
        u32le(0)
      )
    );
    var exifIfd = concatBytes(
      u16le(1),
      concatBytes(
        makeIFDEntry(0x9003, 2, dateBytes.length, 80 + artistBytes.length + keywordBytes.length + xpCommentBytes.length),
        u32le(0)
      )
    );
    var body = concatBytes(tiffHeader, concatBytes(ifd0, exifIfd));
    var payload = concatBytes(enc("Exif\0\0"), body);
    return concatBytes(payload, concatBytes(concatBytes(concatBytes(artistBytes, keywordBytes), xpCommentBytes), dateBytes));
  }

  function changeExifData(blob, metadata) {
    return blob.arrayBuffer().then(function (buffer) {
      var buf = new Uint8Array(buffer);
      if (buf.length < 12) throw new Error("Not a JPEG or WEBP");
      var isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
      var isWebp =
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
      if (!isJpeg && !isWebp) throw new Error("Not a JPEG or WEBP");

      var data = buildExifPayload(metadata);

      if (isJpeg) {
        function app1() {
          var len = data.length + 2;
          var seg = new Uint8Array(4 + data.length);
          seg[0] = 0xff;
          seg[1] = 0xe1;
          seg[2] = (len >> 8) & 255;
          seg[3] = len & 255;
          seg.set(data, 4);
          return seg;
        }
        var out = [];
        out.push(new Uint8Array([0xff, 0xd8]));
        var i = 2;
        var inserted = false;
        var ok = true;
        while (i < buf.length) {
          if (buf[i] !== 0xff) {
            ok = false;
            break;
          }
          var m = buf[i + 1];
          if (m === 0xd9) {
            if (!inserted) {
              out.push(app1());
              inserted = true;
            }
            out.push(buf.subarray(i));
            break;
          }
          if (m === 0xda) {
            if (!inserted) {
              out.push(app1());
              inserted = true;
            }
            out.push(buf.subarray(i));
            break;
          }
          if (m >= 0xd0 && m <= 0xd7) {
            out.push(buf.subarray(i, i + 2));
            i += 2;
            continue;
          }
          if (i + 4 > buf.length) {
            ok = false;
            break;
          }
          var len = (buf[i + 2] << 8) | buf[i + 3];
          if (len < 2 || i + 2 + len > buf.length) {
            ok = false;
            break;
          }
          if (m === 0xe1) {
            i += 2 + len;
            continue;
          }
          out.push(buf.subarray(i, i + 2 + len));
          i += 2 + len;
        }
        if (!ok || !inserted) throw new Error("JPEG parse failed");
        var total = 0;
        out.forEach(function (p) {
          total += p.length;
        });
        var jpeg = new Uint8Array(total);
        var off = 0;
        out.forEach(function (p) {
          jpeg.set(p, off);
          off += p.length;
        });
        return new Blob([jpeg], { type: "image/jpeg" });
      }

      var chunks = [];
      var c = 12;
      var vp8xIndex = -1;
      while (c + 8 <= buf.length) {
        var tag = String.fromCharCode(buf[c], buf[c + 1], buf[c + 2], buf[c + 3]);
        var size = buf[c + 4] | (buf[c + 5] << 8) | (buf[c + 6] << 16) | (buf[c + 7] << 24);
        var end = c + 8 + size;
        if (end > buf.length) break;
        if (tag === "VP8X") vp8xIndex = chunks.length;
        if (tag !== "EXIF" && tag !== "XMP ") chunks.push(buf.subarray(c, end));
        c = end;
      }
      var padded = data.length % 2 === 1 ? concatBytes(data, new Uint8Array([0])) : data;
      var hdr = new Uint8Array(8);
      hdr.set(fourCC("EXIF"), 0);
      new DataView(hdr.buffer).setUint32(4, padded.length, true);
      var exifChunk = concatBytes(hdr, padded);
      if (vp8xIndex > -1) {
        var vp8x = chunks[vp8xIndex].slice();
        vp8x[8] |= 0x10;
        chunks[vp8xIndex] = vp8x;
        chunks.splice(vp8xIndex + 1, 0, exifChunk);
      } else {
        chunks.push(exifChunk);
      }
      var wTotal = 12;
      chunks.forEach(function (ch) {
        wTotal += ch.length;
      });
      var webp = new Uint8Array(wTotal);
      webp.set(new Uint8Array([0x52, 0x49, 0x46, 0x46]), 0);
      webp.set(u32le(wTotal - 8), 4);
      webp.set(new Uint8Array([0x57, 0x45, 0x42, 0x50]), 8);
      var wOff = 12;
      chunks.forEach(function (ch) {
        webp.set(ch, wOff);
        wOff += ch.length;
      });
      return new Blob([webp], { type: "image/webp" });
    });
  }

  function parseDashManifest(mpdXml) {
    try {
      if (!mpdXml || typeof mpdXml !== "string") return { video: null, audio: null };
      var xml = new DOMParser().parseFromString(mpdXml, "application/xml");
      if (xml.querySelector("parsererror")) return { video: null, audio: null };
      var reps = Array.prototype.slice.call(xml.querySelectorAll("Representation"));
      var cands = [];
      reps.forEach(function (rep) {
        var set = rep.closest("AdaptationSet");
        var mimeType = rep.getAttribute("mimeType") || (set && set.getAttribute("mimeType")) || "";
        var contentType = (set && set.getAttribute("contentType")) || "";
        var baseUrlEl = rep.querySelector("BaseURL");
        var url = baseUrlEl ? baseUrlEl.textContent : null;
        if (!url) {
          var st = rep.querySelector("SegmentTemplate");
          if (st && st.getAttribute("media")) {
            url = st
              .getAttribute("media")
              .replace(/\$RepresentationID\$/g, rep.getAttribute("id") || "")
              .replace(/\$Number\$/g, st.getAttribute("startNumber") || "0")
              .replace(/\$Bandwidth\$/g, rep.getAttribute("bandwidth") || "");
          }
        }
        if (!url) return;
        url = url.trim();
        if (!/^https?:\/\//i.test(url)) return;
        cands.push({
          id: rep.getAttribute("id") || "",
          url: url,
          mimeType: mimeType,
          contentType: contentType,
          codecs: rep.getAttribute("codecs") || (set && set.getAttribute("codecs")) || "",
          bandwidth: parseInt(rep.getAttribute("bandwidth") || "0", 10) || 0,
          width: parseInt(rep.getAttribute("width") || "0", 10) || 0,
          height: parseInt(rep.getAttribute("height") || "0", 10) || 0,
        });
      });
      var isVideo = function (c) {
        return (c.contentType || "").indexOf("video") > -1 || (c.mimeType || "").indexOf("video") === 0;
      };
      var isAudio = function (c) {
        return (c.contentType || "").indexOf("audio") > -1 || (c.mimeType || "").indexOf("audio") === 0;
      };
      var video =
        cands
          .filter(isVideo)
          .sort(function (a, b) {
            return b.height - a.height || b.bandwidth - a.bandwidth || b.width - a.width;
          })[0] || null;
      var audio =
        cands
          .filter(isAudio)
          .sort(function (a, b) {
            return b.bandwidth - a.bandwidth;
          })[0] || null;
      return { video: video, audio: audio };
    } catch (e) {
      logger("[DASH]", "parse error:", e && e.message ? e.message : e);
      return { video: null, audio: null };
    }
  }

  function muxDashVideoAudioToMp4(videoBuf, audioBuf) {
    var MB = Mediabunny;
    return (async function () {
      var videoInput = new MB.Input({ formats: [MB.MP4], source: new MB.BufferSource(videoBuf) });
      var audioInput = new MB.Input({ formats: [MB.MP4], source: new MB.BufferSource(audioBuf) });
      var vTrack = await videoInput.getPrimaryVideoTrack();
      if (!vTrack || !vTrack.codec) throw new Error("No video track found");
      var aTrack = await audioInput.getPrimaryAudioTrack();
      if (!aTrack || !aTrack.codec) throw new Error("No audio track found");
      var vSink = new MB.EncodedPacketSink(vTrack);
      var aSink = new MB.EncodedPacketSink(aTrack);
      var output = new MB.Output({
        format: new MB.Mp4OutputFormat({ fastStart: "in-memory" }),
        target: new MB.BufferTarget(),
      });
      var vSource = new MB.EncodedVideoPacketSource(vTrack.codec);
      var aSource = new MB.EncodedAudioPacketSource(aTrack.codec);
      output.addVideoTrack(vSource, { rotation: vTrack.rotation || 0 });
      output.addAudioTrack(aSource);
      await output.start();
      var vDecoderConfig = await vTrack.getDecoderConfig();
      var aDecoderConfig = await aTrack.getDecoderConfig();
      var vMeta = vDecoderConfig ? { decoderConfig: vDecoderConfig } : undefined;
      var aMeta = aDecoderConfig ? { decoderConfig: aDecoderConfig } : undefined;
      var vIter = vSink.packets();
      var aIter = aSink.packets();
      var vNext = await vIter.next();
      var aNext = await aIter.next();
      var vSentMeta = false;
      var aSentMeta = false;
      var minTs = Infinity;
      if (!vNext.done) minTs = Math.min(minTs, vNext.value.timestamp);
      if (!aNext.done) minTs = Math.min(minTs, aNext.value.timestamp);
      var tsShift = isFinite(minTs) && minTs < 0 ? -minTs : 0;
      function adjust(p) {
        if (!tsShift || typeof p.clone !== "function") return p;
        return p.clone({ timestamp: p.timestamp + tsShift });
      }
      while (!vNext.done || !aNext.done) {
        var takeVideo = vNext.done ? false : aNext.done ? true : vNext.value.timestamp <= aNext.value.timestamp;
        if (takeVideo) {
          await vSource.add(adjust(vNext.value), vSentMeta ? undefined : vMeta);
          vSentMeta = true;
          vNext = await vIter.next();
        } else {
          await aSource.add(adjust(aNext.value), aSentMeta ? undefined : aMeta);
          aSentMeta = true;
          aNext = await aIter.next();
        }
      }
      await output.finalize();
      var outBuf = output.target.buffer;
      if (outBuf instanceof ArrayBuffer) return outBuf;
      if (outBuf && outBuf.buffer) {
        return outBuf.buffer.slice(outBuf.byteOffset, outBuf.byteOffset + outBuf.byteLength);
      }
      throw new Error("Unexpected output buffer type");
    })();
  }

  async function downloadDashStreams(videoUrl, audioUrl, meta) {
    var vBuf = await fetchArrayBuffer(videoUrl);
    var aBuf = await fetchArrayBuffer(audioUrl);
    var mergedBuf = await muxDashVideoAudioToMp4(vBuf, aBuf);
    var merged = new Blob([mergedBuf], { type: "video/mp4" });
    await createSaveFileElement(videoUrl, merged, meta);
  }

  async function tryDashDownload(mediaItem, meta, isPreview) {
    try {
      if (!USER_SETTING.PREFER_DASH_MANIFEST || !USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) return false;
      if (!mediaItem || !mediaItem.video_dash_manifest || !mediaItem.video_versions) return false;
      var best = parseDashManifest(mediaItem.video_dash_manifest);
      var vUrl = best && best.video ? best.video.url : "";
      if (!vUrl) return false;
      var aUrl = best && best.audio ? best.audio.url : "";
      if (isPreview) {
        openNewTab(vUrl);
        return true;
      }
      if (!aUrl) {
        await saveFiles(vUrl, meta);
        return true;
      }
      await downloadDashStreams(vUrl, aUrl, meta);
      return true;
    } catch (e) {
      logger("[DASH]", "mux failed, using single-file fallback:", e && e.message ? e.message : e);
      return false;
    }
  }

  async function downloadResource(item, meta, opts) {
    opts = opts || {};
    var dashCandidate = item.dash || state.GL_mediaDataCache[item.id] || null;
    if (dashCandidate && !opts.preview) {
      var okDash = await tryDashDownload(dashCandidate, meta, false);
      if (okDash) return true;
    }
    if (!opts.preview && !item.isVideo && item.id && USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE) {
      var cached = getImageFromCache(item.id);
      if (cached) {
        var okCache = await saveFiles(
          cached,
          Object.assign({}, meta, {
            caption: item.caption || meta.caption,
            index: meta.index != null ? meta.index : 0,
            filetype: "jpg",
          })
        );
        if (okCache) return true;
      }
    }
    if (opts.preview) {
      if (!item.url) {
        Toasts.error("Cannot find download URL.");
        return false;
      }
      openNewTab(replaceSameOriginHost(item.url));
      return true;
    }
    if (!item.url) {
      Toasts.error("Cannot find download URL.");
      return false;
    }
    var finalMeta = Object.assign({}, meta, {
      caption: item.caption || meta.caption,
      index: meta.index != null ? meta.index : 0,
      filetype: item.ext || meta.filetype || (item.isVideo ? "mp4" : "jpg"),
    });
    return await saveFiles(item.url, finalMeta);
  }

  async function batchDownload(items, meta) {
    var total = items.length;
    if (!total) return;
    var done = 0;
    Progress.set(0, total);
    for (var i = 0; i < total; i++) {
      try {
        await downloadResource(items[i], Object.assign({}, meta, { index: i + 1 }), {});
      } catch (e) {
        logger("batch item failed:", e && e.message ? e.message : e);
      }
      done++;
      Progress.set(done, total);
      if (done < total) {
        await new Promise(function (r) {
          setTimeout(r, 350);
        });
      }
    }
    notify(NAME, "Downloaded " + done + " of " + total + " items.");
  }

  

  const INTERNAL_CSS = `
:root{
  --ig-brand:#e1306c;
  --ig-brand-2:#f77737;
  --ig-accent:#0095f6;
  --ig-surface:#ffffff;
  --ig-surface-2:#f7f7f9;
  --ig-text:#1c1c1e;
  --ig-text-2:#6e6e73;
  --ig-line:rgba(0,0,0,.08);
  --ig-shadow:0 12px 40px rgba(0,0,0,.22);
  --ig-radius:14px;
}
@media (prefers-color-scheme:dark){
  :root{
    --ig-surface:#1c1c1e;
    --ig-surface-2:#26262a;
    --ig-text:#f5f5f7;
    --ig-text-2:#a1a1a6;
    --ig-line:rgba(255,255,255,.1);
    --ig-shadow:0 12px 40px rgba(0,0,0,.55);
  }
}
.ignis-toasts{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;max-width:min(92vw,480px)}
.ignis-toast{pointer-events:auto;background:rgba(255,255,255,.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:var(--ig-text);border:1px solid rgba(255,255,255,.45);border-radius:12px;padding:10px 18px;font:500 13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);opacity:0;transform:translateY(-10px) scale(.97);transition:opacity .22s ease,transform .22s ease;cursor:pointer;max-width:100%}
@media (prefers-color-scheme:dark){.ignis-toast{background:rgba(22,22,26,.85);border-color:rgba(255,255,255,.14)}}
.ignis-toast-in{opacity:1;transform:none}
.ignis-toast-out{opacity:0;transform:translateY(-8px)}
.ignis-toast-success{border-left:3px solid #34c759}
.ignis-toast-error{border-left:3px solid #ff3b30}
.ignis-toast-info{border-left:3px solid var(--ig-accent)}
.ignis-progress{position:fixed;bottom:22px;right:22px;z-index:2147483000;display:none;align-items:center;gap:10px;background:rgba(255,255,255,.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:var(--ig-text);border:1px solid rgba(255,255,255,.45);border-radius:12px;padding:10px 16px;font:600 12px -apple-system,"Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18)}
@media (prefers-color-scheme:dark){.ignis-progress{background:rgba(22,22,26,.85);border-color:rgba(255,255,255,.14)}}
.ignis-progress-on{display:flex}
.ignis-progress i{width:16px;height:16px;border-radius:50%;border:2px solid var(--ig-brand);border-top-color:transparent;animation:ignisSpin .7s linear infinite}
@keyframes ignisSpin{to{transform:rotate(360deg)}}
.ignis-modal{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;background:transparent;opacity:0;transition:opacity .2s ease}
.ignis-modal-in{opacity:1}
.ignis-modal-card{position:relative;width:min(720px,94vw);max-height:86vh;display:flex;flex-direction:column;background:rgba(255,255,255,.78);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);color:var(--ig-text);border:1px solid rgba(255,255,255,.45);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.25);overflow:hidden;transform:translateY(10px) scale(.985);transition:transform .18s ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
@media (prefers-color-scheme:dark){.ignis-modal-card{background:rgba(22,22,26,.72);border-color:rgba(255,255,255,.14)}}
.ignis-modal-in .ignis-modal-card{transform:none}
.ignis-modal-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--ig-line);flex-shrink:0}
.ignis-modal-title{font-size:15px;font-weight:700;letter-spacing:.2px;display:flex;align-items:center;gap:8px;min-width:0;flex:1}
.ignis-modal-title .ignis-sub{font-size:11px;font-weight:500;color:var(--ig-text-2);background:var(--ig-surface-2);padding:2px 8px;border-radius:20px;white-space:nowrap}
.ignis-modal-x{width:32px;height:32px;border:none;background:transparent;color:var(--ig-text-2);border-radius:50%;display:grid;place-items:center;cursor:pointer;transition:background .15s,color .15s;flex-shrink:0}
.ignis-modal-x:hover{background:var(--ig-surface-2);color:var(--ig-text)}
.ignis-modal-body{flex:1;overflow-y:auto;padding:12px;scrollbar-width:thin;scrollbar-color:var(--ig-line) transparent}
.ignis-modal-body::-webkit-scrollbar{width:8px}
.ignis-modal-body::-webkit-scrollbar-thumb{background:var(--ig-line);border-radius:4px}
.ignis-modal-foot{display:flex;align-items:center;gap:8px;padding:10px 16px;border-top:1px solid var(--ig-line);flex-shrink:0;flex-wrap:nowrap;justify-content:flex-end}
.ignis-foot-gap{flex:1}
.ignis-sel{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;font:600 12px -apple-system,"Segoe UI",sans-serif;color:var(--ig-text);white-space:nowrap}
.ignis-sel input{position:absolute;opacity:0;width:0;height:0}
.ignis-sel span{width:18px;height:18px;border:1.5px solid var(--ig-line);border-radius:5px;display:grid;place-items:center;transition:all .15s;background:rgba(255,255,255,.5);flex-shrink:0}
.ignis-sel span::after{content:"";width:9px;height:5px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg) scale(0);transition:transform .12s;margin-top:-1px}
.ignis-sel input:checked~span{background:var(--ig-accent);border-color:var(--ig-accent)}
.ignis-sel input:checked~span::after{transform:rotate(-45deg) scale(1)}
.ignis-sel input:indeterminate~span{background:var(--ig-accent);border-color:var(--ig-accent)}
.ignis-sel input:indeterminate~span::after{transform:none;border:none;width:8px;height:2px;background:#fff;margin:0}
.ignis-count{font:700 10px ui-monospace,Menlo,monospace;background:var(--ig-surface-2);border:1px solid var(--ig-line);border-radius:20px;padding:1px 7px;color:var(--ig-text-2)}
.ignis-btn{border:none;border-radius:10px;padding:9px 18px;font:600 13px -apple-system,"Segoe UI",sans-serif;cursor:pointer;transition:transform .1s,filter .15s;display:inline-flex;align-items:center;gap:6px}
.ignis-btn:active{transform:scale(.97)}
.ignis-btn:disabled{opacity:.45;cursor:not-allowed}
.ignis-btn-pri{background:linear-gradient(135deg,var(--ig-brand),var(--ig-brand-2));color:#fff}
.ignis-btn-pri:not(:disabled):hover{filter:brightness(1.08)}
.ignis-btn-sec{background:var(--ig-surface-2);color:var(--ig-text)}
.ignis-btn-sec:not(:disabled):hover{filter:brightness(.97)}
.ignis-check{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;margin:0}
.ignis-check input{position:absolute;opacity:0;width:0;height:0}
.ignis-check span{width:20px;height:20px;border:2px solid var(--ig-line);border-radius:6px;display:grid;place-items:center;transition:all .15s;flex-shrink:0;background:var(--ig-surface)}
.ignis-check span::after{content:"";width:10px;height:6px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg) scale(0);transition:transform .12s;margin-top:-2px}
.ignis-check input:checked~span{background:var(--ig-accent);border-color:var(--ig-accent)}
.ignis-check input:checked~span::after{transform:rotate(-45deg) scale(1)}
.ignis-check input:indeterminate~span{background:var(--ig-accent);border-color:var(--ig-accent)}
.ignis-check input:indeterminate~span::after{transform:none;border:none;width:10px;height:2px;background:#fff;margin:0}
.ignis-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;transition:background .12s;border:1px solid transparent}
.ignis-item:hover{background:var(--ig-surface-2)}
.ignis-thumb{width:56px;height:56px;border-radius:10px;object-fit:cover;background:var(--ig-surface-2);border:1px solid var(--ig-line);flex-shrink:0}
.ignis-meta{flex:1;min-width:0}
.ignis-type{font:600 11px -apple-system,"Segoe UI",sans-serif;color:var(--ig-text-2);letter-spacing:.4px;display:flex;gap:6px;align-items:center}
.ignis-type b{color:var(--ig-text);font-size:12px}
.ignis-cap{font:400 12px/1.4 -apple-system,"Segoe UI",sans-serif;color:var(--ig-text-2);margin-top:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:pre-wrap;word-break:break-word}
.ignis-actions{display:flex;gap:6px;flex-shrink:0}
.ignis-act{width:32px;height:32px;border:none;border-radius:9px;background:var(--ig-surface-2);color:var(--ig-text);display:grid;place-items:center;cursor:pointer;transition:all .12s}
.ignis-act:hover{background:var(--ig-accent);color:#fff;transform:scale(1.05)}
.ignis-act svg{width:15px;height:15px}
.ignis-empty{padding:40px 20px;text-align:center;color:var(--ig-text-2);font:500 13px -apple-system,"Segoe UI",sans-serif}
.ignis-load{display:flex;align-items:center;justify-content:center;gap:10px;padding:48px 0;color:var(--ig-text-2);font:500 13px -apple-system,"Segoe UI",sans-serif}
.ignis-load i{width:18px;height:18px;border-radius:50%;border:2px solid var(--ig-line);border-top-color:var(--ig-accent);animation:ignisSpin .7s linear infinite}
.ignis-hint{font-size:11px;color:var(--ig-text-2);margin-left:auto}

.ignis-tabs{display:flex;gap:4px;padding:10px 18px 0;overflow-x:auto;flex-shrink:0;scrollbar-width:none;border-bottom:1px solid var(--ig-line)}
.ignis-tabs::-webkit-scrollbar{display:none}
.ignis-tab{border:none;background:transparent;color:var(--ig-text-2);font:600 12px -apple-system,"Segoe UI",sans-serif;padding:8px 12px;border-radius:10px 10px 0 0;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s}
.ignis-tab:hover{color:var(--ig-text);background:var(--ig-surface-2)}
.ignis-tab-a{color:var(--ig-accent)!important;border-bottom-color:var(--ig-accent)}
.ignis-tab b{font-size:9px;background:var(--ig-accent);color:#fff;border-radius:20px;padding:1px 6px;margin-left:4px}
.ignis-search{margin:12px 18px 0;padding:8px 12px;border:1px solid var(--ig-line);border-radius:10px;background:var(--ig-surface-2);color:var(--ig-text);font:500 13px -apple-system,"Segoe UI",sans-serif;outline:none;width:calc(100% - 36px);box-sizing:border-box}
.ignis-search:focus{border-color:var(--ig-accent)}
.ignis-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;transition:background .1s}
.ignis-row:hover{background:var(--ig-surface-2)}
.ignis-row-txt{flex:1;min-width:0}
.ignis-row-lb{font:600 13px -apple-system,"Segoe UI",sans-serif;color:var(--ig-text)}
.ignis-row-ds{font:400 11px/1.4 -apple-system,"Segoe UI",sans-serif;color:var(--ig-text-2);margin-top:2px}
.ignis-row-dis .ignis-row-lb,.ignis-row-dis .ignis-row-ds{opacity:.45}
.ignis-sw{position:relative;width:42px;height:24px;flex-shrink:0;cursor:pointer}
.ignis-sw input{position:absolute;opacity:0;width:0;height:0}
.ignis-sw i{position:absolute;inset:0;background:var(--ig-line);border-radius:12px;transition:background .22s}
.ignis-sw i::before{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;background:#fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:left .22s}
.ignis-sw input:checked~i{background:var(--ig-accent)}
.ignis-sw input:checked~i::before{left:20px}
.ignis-sw input:disabled~i{opacity:.5;cursor:not-allowed}
.ignis-row-edit{position:absolute;inset:0;z-index:5;display:flex;align-items:center;gap:8px;background:var(--ig-surface);border:1px solid var(--ig-accent);border-radius:12px;padding:0 12px;box-shadow:var(--ig-shadow)}
.ignis-row-wrap{position:relative}
.ignis-inp{flex:1;min-width:60px;padding:6px 10px;border:1px solid var(--ig-line);border-radius:8px;background:var(--ig-surface-2);color:var(--ig-text);font:500 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;outline:none}
.ignis-inp:focus{border-color:var(--ig-accent)}
.ignis-kbd{display:inline-flex;align-items:center;gap:4px;font:600 11px ui-monospace,Menlo,Consolas,monospace;color:var(--ig-text-2)}
.ignis-kbd kbd{background:var(--ig-surface-2);border:1px solid var(--ig-line);border-bottom-width:2px;border-radius:6px;padding:2px 7px;font:600 11px ui-monospace,Menlo,Consolas,monospace}
.ignis-keyrow{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:background .1s}
.ignis-keyrow:hover{background:var(--ig-surface-2)}
.ignis-keyrow .ignis-kbd{flex:1}
.ignis-keyrow button{border:1px dashed var(--ig-line);background:var(--ig-surface-2);color:var(--ig-text);border-radius:8px;padding:5px 12px;font:600 12px ui-monospace,Menlo,monospace;cursor:pointer}
.ignis-keyrow button:hover{border-color:var(--ig-accent);color:var(--ig-accent)}
.ignis-about{padding:8px 4px;line-height:1.7;font-size:13px;color:var(--ig-text)}
.ignis-about b{color:var(--ig-brand)}
.ignis-about a{color:var(--ig-accent);text-decoration:none;font-weight:600}
.ignis-about .ignis-rt{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.ignis-about .ignis-rt span{background:var(--ig-surface-2);border:1px solid var(--ig-line);border-radius:20px;padding:3px 10px;font:600 11px -apple-system,"Segoe UI",sans-serif;color:var(--ig-text-2)}

.ignis-bar{position:absolute;top:12px;right:12px;z-index:15;display:flex;flex-direction:row-reverse;gap:6px;padding:6px;border-radius:12px;background:rgba(20,20,24,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.12);box-shadow:0 2px 14px rgba(0,0,0,.25)}
.ignis-dl,.ignis-nt,.ignis-th,.ignis-da{width:34px;height:34px;border:none;border-radius:9px;background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer;transition:all .12s}
.ignis-dl:hover,.ignis-nt:hover,.ignis-th:hover,.ignis-da:hover{background:rgba(255,255,255,.18);transform:scale(1.06)}
.ignis-dl:active,.ignis-nt:active,.ignis-th:active,.ignis-da:active{transform:scale(.94)}
.ignis-dl svg,.ignis-nt svg,.ignis-th svg,.ignis-da svg{width:17px;height:17px}

.ignis-sb{position:absolute;z-index:12;width:34px;height:34px;border:none;border-radius:10px;background:rgba(255,255,255,.14);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.25);color:#fff;display:grid;place-items:center;cursor:pointer;transition:all .12s;box-shadow:0 2px 10px rgba(0,0,0,.2)}
.ignis-sb:hover{background:rgba(255,255,255,.2);transform:scale(1.05)}
.ignis-sb svg{width:16px;height:16px}
.ignis-sb-pos{position:absolute;z-index:12;min-width:26px;height:22px;padding:0 6px;border-radius:20px;background:rgba(20,20,24,.7);color:#fff;font:700 10px -apple-system,"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:none;letter-spacing:.3px}
.ignis-pd{position:absolute;top:6px;right:6px;z-index:12;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.8);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#000;display:grid;place-items:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.ignis-pd svg{width:15px;height:15px}
.ignis-gd{position:absolute;top:8px;right:8px;z-index:10;width:32px;height:32px;border:none;border-radius:10px;background:rgba(20,20,24,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);color:#fff;display:grid;place-items:center;cursor:pointer;opacity:0;transition:opacity .15s ease,transform .12s;box-shadow:0 2px 10px rgba(0,0,0,.25)}
a:hover>.ignis-gd,.ignis-gd:focus-visible,.ignis-gd:hover{opacity:1;transform:scale(1.06)}
.ignis-gd svg{width:16px;height:16px}

.ignis-ksh{position:fixed;inset:0;z-index:2147482500;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center}
.ignis-ksh-card{background:var(--ig-surface);color:var(--ig-text);border-radius:var(--ig-radius);padding:22px 26px;max-width:min(560px,92vw);box-shadow:var(--ig-shadow);font:500 13px/2 -apple-system,"Segoe UI",sans-serif}
.ignis-ksh-card h3{margin:0 0 8px;font-size:15px}
.ignis-ksh-card table{border-collapse:collapse;width:100%}
.ignis-ksh-card td{padding:3px 0;border-bottom:1px solid var(--ig-line)}
.ignis-ksh-card td:last-child{text-align:right;color:var(--ig-text-2)}
.ignis-ksh-card .ignis-hint{margin-top:10px;text-align:center;font-size:11px;color:var(--ig-text-2)}
`;

  GM_addStyle(INTERNAL_CSS);


  const ModalStack = {
    modals: [],
    push: function (m) {
      this.modals.push(m);
      return m;
    },
    pop: function () {
      var m = this.modals.pop();
      if (m) m.close();
      return m;
    },
    closeTop: function () {
      if (this.modals.length) this.pop();
    },
  };

  function createModal(opts) {
    opts = opts || {};
    var root = $('<div class="ignis-modal">');
    var card = $('<div class="ignis-modal-card" role="dialog" aria-modal="true">');
    var head = $('<div class="ignis-modal-head">');
    var title = $('<div class="ignis-modal-title">');
    if (opts.title) title.append(esc(opts.title));
    if (opts.sub) title.append('<span class="ignis-sub">' + esc(opts.sub) + "</span>");
    var closeBtn = $(
      '<button class="ignis-modal-x" aria-label="Close" title="Close (Esc / ' +
        esc(getPlatformModifierKey()) +
        '+Q)">' +
        SVG.CLOSE +
        "</button>"
    );
    var body = $('<div class="ignis-modal-body">');
    var foot = $('<div class="ignis-modal-foot">');
    head.append(title, closeBtn);
    card.append(head, body, foot);
    root.append(card);
    $body.append(root);
    var api = {
      el: root,
      body: body,
      foot: foot,
      title: title,
      close: function () {
        root.removeClass("ignis-modal-in");
        setTimeout(function () {
          root.remove();
        }, 220);
        var i = ModalStack.modals.indexOf(api);
        if (i > -1) ModalStack.modals.splice(i, 1);
      },
    };
    closeBtn.on("click", api.close);
    var cardEl = card[0];
    head.css("cursor", "grab");
    head.on("mousedown.igdrag", function (e) {
      if (e.button !== 0) return;
      if ($(e.target).closest("button")[0]) return;
      e.preventDefault();
      var r = cardEl.getBoundingClientRect();
      var sx = e.clientX;
      var sy = e.clientY;
      var ox = r.left;
      var oy = r.top;
      card.css({ transition: "none", position: "fixed", left: ox + "px", top: oy + "px", margin: "0" });
      function onMove(ev) {
        var maxX = Math.max(8, window.innerWidth - r.width - 8);
        var maxY = Math.max(8, window.innerHeight - 48);
        card.css({
          left: Math.min(maxX, Math.max(8, ox + ev.clientX - sx)) + "px",
          top: Math.min(maxY, Math.max(8, oy + ev.clientY - sy)) + "px",
        });
      }
      function onUp() {
        $(document).off("mousemove.igdrag", onMove);
        $(document).off("mouseup.igdrag", onUp);
        card.css("transition", "");
      }
      $(document).on("mousemove.igdrag", onMove);
      $(document).on("mouseup.igdrag", onUp);
    });
    root.on("mousedown", function (e) {
      if (e.target === root[0]) api.close();
    });
    setTimeout(function () {
      root.addClass("ignis-modal-in");
    }, 10);
    return ModalStack.push(api);
  }


  function buildPostItems(payload, postPath) {
    var res = normalizePostResource(payload.resource);
    res.items.forEach(function (it) {
      if (it.dash) state.GL_mediaDataCache[it.id] = it.dash;
    });
    return {
      items: res.items,
      meta: {
        username: res.username || "NONE",
        shortcode: res.shortcode || postPath,
        sourceType: "post",
        timestamp: res.takenAt || Math.floor(Date.now() / 1000),
        caption: res.caption || null,
      },
      fromDom: false,
    };
  }

  function extractPostFromDom(postPath, ctx) {
    var $post = null;
    if (ctx && ctx.post) {
      $post = $(ctx.post);
    } else if (ctx && ctx.anchor) {
      var a = ctx.anchor;
      var img = a.querySelector("img");
      if (img) {
        var srcset = parseSrcset(img.getAttribute("srcset") || "");
        var url = (srcset.length ? srcset[srcset.length - 1].url : null) || img.getAttribute("src") || "";
        if (url) {
          return {
            items: [
              {
                id: decodeMediaIdFromUrl(url),
                isVideo: false,
                url: url,
                thumb: url,
                width: 0,
                height: 0,
                caption: null,
                dash: null,
                ext: /\.webp(\?|$)/i.test(url) ? "webp" : "jpg",
              },
            ],
            meta: {
              username: "NONE",
              shortcode: postPath,
              sourceType: "post",
              timestamp: Math.floor(Date.now() / 1000),
              caption: null,
            },
            fromDom: true,
          };
        }
      }
      return null;
    } else {
      $post = $('[data-snig="canDownload"]')
        .filter(function () {
          return $(this).find('a[href*="/' + postPath + '/"]').length > 0;
        })
        .first();
    }
    if (!$post || !$post.length) return null;
    if ($post.find("video[src^='blob:']").length) return null;
    var items = [];
    var seen = new Set();
    var username = $post.attr("data-username") || getPostUsername($post) || "NONE";
    $post.find("img[src]").each(function () {
      var r = this.getBoundingClientRect();
      if (r.width < 150 || r.height < 150) return;
      var $img = $(this);
      var srcset = parseSrcset($img.attr("srcset") || "");
      var url = (srcset.length ? srcset[srcset.length - 1].url : null) || $img.attr("src") || "";
      if (!url || seen.has(url)) return;
      seen.add(url);
      items.push({
        id: decodeMediaIdFromUrl(url),
        isVideo: false,
        url: url,
        thumb: url,
        width: Math.round(r.width),
        height: Math.round(r.height),
        caption: null,
        dash: null,
        ext: /\.webp(\?|$)/i.test(url) ? "webp" : "jpg",
      });
    });
    var $v = $post.find("video").first();
    if ($v.length) {
      var vUrl = $v.attr("src") || "";
      if (/^https?:/i.test(vUrl)) {
        items.push({
          id: decodeMediaIdFromUrl(vUrl),
          isVideo: true,
          url: vUrl,
          thumb: null,
          width: 0,
          height: 0,
          caption: null,
          dash: null,
          ext: "mp4",
        });
      }
    }
    if (!items.length) return null;
    var ts = Math.floor(Date.now() / 1000);
    var $t = $post.find("time[datetime]").first();
    if ($t.length) {
      var d = new Date($t.attr("datetime")).getTime() / 1000;
      if (isFinite(d) && d > 0) ts = Math.floor(d);
    }
    return {
      items: items,
      meta: { username: username, shortcode: postPath, sourceType: "post", timestamp: ts, caption: null },
      fromDom: true,
    };
  }

  async function loadPostItems(postPath, ctx) {
    var instant = extractPostFromDom(postPath, ctx);
    if (instant) return instant;
    var payload = await getPostPayload(postPath);
    return buildPostItems(payload, postPath);
  }

  function renderItems(body, items, meta) {
    body.empty();
    if (!items.length) {
      body.append('<div class="ignis-empty">No downloadable media found.</div>');
      return;
    }
    var frag = $(document.createDocumentFragment());
    items.forEach(function (item, i) {
      var row = $('<div class="ignis-item" data-idx="' + i + '">');
      var check = $(
        '<label class="ignis-check" title="Select"><input type="checkbox" checked><span></span></label>'
      );
      var thumb = item.thumb
        ? '<img class="ignis-thumb" loading="lazy" src="' + esc(item.thumb) + '" alt="">'
        : '<div class="ignis-thumb"></div>';
      var dims = item.width || item.height ? item.width + "Ã—" + item.height + " Â· " : "";
      var type =
        '<div class="ignis-type">' +
        (item.isVideo ? "<b>VIDEO</b>" : "<b>IMAGE</b>") +
        " " +
        esc(dims) +
        esc(item.ext || "") +
        "</div>";
      var cap = item.caption
        ? '<div class="ignis-cap">' + esc(item.caption.slice(0, 220)) + "</div>"
        : "";
      var actions = $('<div class="ignis-actions">');
      actions.append(
        '<button class="ignis-act ig-act-dl" title="Download">' + SVG.DOWNLOAD + "</button>",
        '<button class="ignis-act ig-act-nt" title="Open in new tab">' + SVG.NEW_TAB + "</button>"
      );
      if (item.thumb && item.isVideo) {
        actions.append(
          '<button class="ignis-act ig-act-th" title="Download thumbnail">' + SVG.THUMBNAIL + "</button>"
        );
      }
      if (item.caption) {
        actions.append(
          '<button class="ignis-act ig-act-cap" title="Download caption (.txt)">' + SVG.TEXT + "</button>"
        );
      }
      row.append(check, thumb, $('<div class="ignis-meta">').append(type, cap), actions);
      frag.append(row);
    });
    body.append(frag);
    body.off(".igitem").on("click.igitem", ".ignis-item", function (e) {
      var act = $(e.target).closest(".ignis-act")[0];
      if (!act) return;
      e.stopPropagation();
      var idx = parseInt($(this).attr("data-idx"), 10);
      var item = items[idx];
      if (!item) return;
      var photoMeta = Object.assign({}, meta, { sourceType: item.isVideo ? "video" : "photo" });
      if (act.classList.contains("ig-act-dl")) {
        downloadResource(item, photoMeta, {});
      } else if (act.classList.contains("ig-act-nt")) {
        downloadResource(item, photoMeta, { preview: true });
      } else if (act.classList.contains("ig-act-th") && item.thumb) {
        saveFiles(item.thumb, Object.assign({}, meta, { sourceType: "thumbnail", filetype: "jpg" }));
      } else if (act.classList.contains("ig-act-cap") && item.caption) {
        var capMeta = Object.assign({}, photoMeta, { caption: item.caption, filetype: "txt" });
        triggerDownload(
          new Blob([item.caption], { type: "text/plain;charset=utf-8" }),
          getSaveFileName(item.url, capMeta)
        );
      }
    });
  }

  async function openPostDialog(postPath, ctx) {
    var modal = createModal({ title: "Download", sub: postPath });
    modal.body.append('<div class="ignis-load"><i></i>Loading media…</div>');
    var loaded;
    try {
      loaded = await loadPostItems(postPath, ctx);
    } catch (e) {
      modal.body.empty().append(
        '<div class="ignis-empty">Could not load this post: ' + esc((e && e.message) || "network error") + "</div>"
      );
      return null;
    }
    if (!modal.el.is(":visible")) return loaded;
    var current = { items: loaded.items, meta: loaded.meta };
    renderItems(modal.body, current.items, current.meta);
    var selectAll = $(
      '<label class="ignis-sel" title="Select / deselect all"><input type="checkbox" checked><span></span>Select all<b class="ignis-count"></b></label>'
    );
    var countBadge = selectAll.find(".ignis-count");
    function refresh() {
      var checks = modal.body.find('.ignis-item input[type="checkbox"]');
      var total = checks.length;
      var sel = checks.filter(":checked").length;
      selectAll.find("input").prop("checked", total > 0 && sel === total);
      selectAll.find("input").prop("indeterminate", sel > 0 && sel < total);
      countBadge.text(total ? sel + "/" + total : "");
      dlSel.prop("disabled", sel === 0);
    }
    var dlSel = $(
      '<button class="ignis-btn ignis-btn-pri" disabled>' + SVG.DOWNLOAD + " Download Selected</button>"
    );
    var dlAll = $(
      '<button class="ignis-btn ignis-btn-sec">' + SVG.DOWNLOAD_ALL + " Download All</button>"
    );
    modal.foot.append(selectAll, '<span class="ignis-foot-gap"></span>', dlSel, dlAll);
    selectAll.find("input").on("change", function () {
      modal.body.find('.ignis-item input[type="checkbox"]').prop("checked", this.checked);
      refresh();
    });
    modal.body.on("change.igsel", '.ignis-item input[type="checkbox"]', refresh);
    function selectedItems() {
      var out = [];
      modal.body.find(".ignis-item").each(function () {
        if ($(this).find('input[type="checkbox"]').prop("checked")) {
          var idx = parseInt($(this).attr("data-idx"), 10);
          if (current.items[idx]) out.push(current.items[idx]);
        }
      });
      return out;
    }
    dlSel.on("click", function () {
      var sel = selectedItems();
      if (!sel.length) {
        Toasts.info("Select at least one item to download.");
        return;
      }
      batchDownload(sel, Object.assign({}, current.meta, { sourceType: "post" }));
    });
    dlAll.on("click", function () {
      batchDownload(current.items, Object.assign({}, current.meta, { sourceType: "post" }));
    });
    if (loaded.fromDom) {
      getPostPayload(postPath)
        .then(function (payload) {
          var rich = buildPostItems(payload, postPath);
          if (rich.items.length && modal.el.is(":visible")) {
            current.items = rich.items;
            current.meta = rich.meta;
            renderItems(modal.body, current.items, current.meta);
            refresh();
          }
        })
        .catch(function () {});
    }
    refresh();
    return loaded;
  }


  function openStoryDialog(payload, type) {
    var reel = payload && payload.data && payload.data.reels_media && payload.data.reels_media[0];
    if (!reel) {
      Toasts.error("No stories available for this account.");
      return null;
    }
    var items = normalizeReelItems(reel.items);
    var username =
      (reel.user && reel.user.username) ||
      (reel.owner && reel.owner.username) ||
      getStoryUsername() ||
      "NONE";
    var meta = {
      username: username,
      shortcode: reel.id || "",
      sourceType: type,
      timestamp: Math.floor(Date.now() / 1000),
      caption: null,
    };
    var modal = createModal({
      title: type === "highlights" ? "Highlights" : "Stories",
      sub: username,
    });
    renderItems(modal.body, items, meta);
    var dlAll = $(
      '<button class="ignis-btn ignis-btn-pri">' + SVG.DOWNLOAD_ALL + " Download All</button>"
    );
    modal.foot.append(dlAll, '<span class="ignis-hint">' + items.length + " items</span>");
    dlAll.on("click", function () {
      batchDownload(items, meta);
    });
    return modal;
  }

  async function downloadStoryAll(payload, type) {
    var reel = payload && payload.data && payload.data.reels_media && payload.data.reels_media[0];
    if (!reel) {
      Toasts.error("No stories available for this account.");
      return;
    }
    var items = normalizeReelItems(reel.items);
    var username =
      (reel.user && reel.user.username) ||
      (reel.owner && reel.owner.username) ||
      getStoryUsername() ||
      "NONE";
    var meta = {
      username: username,
      shortcode: reel.id || "",
      sourceType: type,
      timestamp: Math.floor(Date.now() / 1000),
      caption: null,
    };
    await batchDownload(items, meta);
  }



  function showSetting(tab) {
    if (tab) state._igTab = tab;
    if (!CAT_MAP[state._igTab] && state._igTab !== "about") state._igTab = "download";
    ModalStack.closeTop();
    $(".ignis-modal").remove();
    var modal = createModal({ title: NAME + " Settings", sub: "v" + VERSION });
    var tabs = $('<div class="ignis-tabs">');
    var search = $('<input class="ignis-search" type="search" placeholder="Search settingsâ€¦">');
    var list = $("<div>");
    modal.body.append(tabs, search, list);

    function countOn(cat) {
      var n = 0;
      Object.keys(CAT_MAP).forEach(function (k) {
        if (CAT_MAP[k] === cat && USER_SETTING[k]) n++;
      });
      return n;
    }
    function buildTabs() {
      tabs.empty();
      CATS.forEach(function (c) {
        var on = countOn(c[0]);
        tabs.append(
          '<button class="ignis-tab' +
            (state._igTab === c[0] ? " ignis-tab-a" : "") +
            '" data-tab="' +
            c[0] +
            '">' +
            esc(c[1]) +
            (on ? "<b>" + on + "</b>" : "") +
            "</button>"
        );
      });
      tabs.append(
        '<button class="ignis-tab' +
          (state._igTab === "about" ? " ignis-tab-a" : "") +
          '" data-tab="about">About</button>'
      );
    }

    function keyName(code) {
      try {
        return String.fromCharCode(code);
      } catch (e) {
        return String(code);
      }
    }

    function renderHotkeyEditor(container) {
      var keys = [
        ["settings", "Open Settings", "settingsHotkeyKeyCode"],
        ["downloadStory", "Download Story", "downloadStoryHotkeyKeyCode"],
        ["debug", "Debug Window", "debugHotkeyKeyCode"],
      ];
      keys.forEach(function (k) {
        var code = state[k[2]];
        var row = $('<div class="ignis-keyrow" data-hotkey="' + k[2] + '">');
        row.append(
          '<span class="ignis-kbd"><kbd>' + esc(getPlatformModifierKey()) + "</kbd>+<kbd>" + esc(keyName(code)) + "</kbd></span>",
          $('<div class="ignis-row-txt"><div class="ignis-row-lb">' + esc(k[1]) + "</div></div>"),
          $('<button type="button">Rebind</button>')
        );
        row.on("click", function () {
          container.data("cap", k[2]);
          row.find("button").text("Press a keyâ€¦");
        });
        container.append(row);
      });
      container.append(
        '<div class="ignis-hint" style="margin:10px 12px;display:block">Click a row, then press the new key. Used with ' +
          esc(getPlatformModifierKey()) +
          ".</div>"
      );
    }

    function buildList(filter) {
      list.empty();
      if (state._igTab === "about") {
        list.append(
          '<div class="ignis-about"><b>' + NAME + " v" + VERSION + '</b> â€” clean download-focused build.<div class="ignis-rt">' +
            ["Ignis Core", "Ignis Lens", "Ignis Forge", "Ignis Render"]
              .map(function (r) {
                return "<span>" + esc(r) + "</span>";
              })
              .join("") +
            '</div>All processing is local. Network requests go only to Instagram/CDN hosts. IGNIS is an independent project.</div>'
        );
        return;
      }
      if (state._igTab === "keyboard") {
        renderHotkeyEditor(list);
        return;
      }
      Object.keys(CAT_MAP)
        .filter(function (k) {
          return CAT_MAP[k] === state._igTab;
        })
        .filter(function (k) {
          if (!filter) return true;
          return (LABEL[k] + " " + DESC[k]).toLowerCase().indexOf(filter) > -1;
        })
        .forEach(function (k) {
          var parent = null;
          Object.keys(PARENT_CHILD_MAPPING).forEach(function (p) {
            if (PARENT_CHILD_MAPPING[p].indexOf(k) > -1) parent = p;
          });
          var disabled = parent ? !USER_SETTING[parent] : false;
          var row = $(
            '<div class="ignis-row ignis-row-wrap' + (disabled ? " ignis-row-dis" : "") + '" data-set="' + k + '">'
          );
          var sw = $(
            '<label class="ignis-sw"><input type="checkbox" ' +
              (USER_SETTING[k] ? "checked" : "") +
              (disabled ? "disabled" : "") +
              "><i></i></label>"
          );
          row.append(
            $('<div class="ignis-row-txt">')
              .append(
                '<div class="ignis-row-lb">' + esc(LABEL[k]) + "</div>",
                '<div class="ignis-row-ds">' + esc(DESC[k]) + "</div>"
              ),
            sw
          );
          list.append(row);
        });
      if (!list.children().length) {
        list.append('<div class="ignis-empty">No settings match.</div>');
      }
    }

    modal.el.on("keydown.igcap", function (e) {
      var cap = list.data("cap");
      if (!cap) return;
      e.preventDefault();
      e.stopPropagation();
      var code = e.keyCode || e.which;
      state[cap] = code;
      Store.set("G_HOTKEY_" + cap.replace("HotkeyKeyCode", "").toUpperCase() + "_KEYCODE", code);
      list.data("cap", null);
      buildList();
    });

    modal.el.on("change.igset", ".ignis-sw input", function () {
      var $row = $(this).closest(".ignis-row");
      var k = $row.attr("data-set");
      var v = this.checked;
      USER_SETTING[k] = v;
      Store.set(k, v);
      buildTabs();
      buildList();
    });

    modal.el.on("contextmenu.igset", ".ignis-row[data-set]", function (e) {
      e.preventDefault();
      var $row = $(this);
      var k = $row.attr("data-set");
      if (k !== "AUTO_RENAME") return;
      if ($row.find(".ignis-row-edit").length) return;
      var ed = $(
        '<div class="ignis-row-edit"><input class="ignis-inp" value="' +
          esc(state.fileRenameFormat) +
          '" spellcheck="false" title="' +
          esc("%USERNAME% %SOURCE_TYPE% %SHORTCODE% %YEAR% %2-YEAR% %MONTH% %DAY% %HOUR% %MINUTE% %SECOND% %ORIGINAL_NAME% %ORIGINAL_NAME_FIRST% %INDEX% %UID%") +
          '">' +
          SVG.CLOSE +
          "</div>"
      );
      $row.append(ed);
      var $inp = ed.find("input");
      $inp.trigger("focus");
      $inp.on("input", function () {
        state.fileRenameFormat = $inp.val();
        Store.set("G_RENAME_FORMAT", state.fileRenameFormat);
      });
      ed.children("svg").on("click", function () {
        ed.remove();
      });
    });

    tabs.on("click.igset", ".ignis-tab", function () {
      state._igTab = $(this).attr("data-tab");
      buildTabs();
      buildList();
    });
    search.on("input.igset", function () {
      buildList(search.val().trim().toLowerCase());
    });
    buildTabs();
    buildList();
  }

  function showHotkeySetting() {
    showSetting("keyboard");
  }


  function showDebugDOM() {
    var modal = createModal({ title: "Debug Window", sub: NAME + " v" + VERSION });
    var ta = $(
      '<textarea spellcheck="false" style="width:100%;height:240px;box-sizing:border-box;border:1px solid var(--ig-line);border-radius:10px;background:var(--ig-surface-2);color:var(--ig-text);font:11px ui-monospace,Menlo,monospace;padding:10px;resize:vertical"></textarea>'
    );
    modal.body.append(ta);
    modal.foot.append(
      $('<button class="ignis-btn ignis-btn-sec">Copy</button>').on("click", function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ta.val()).then(function () {
            Toasts.success("Copied to clipboard.");
          });
        } else {
          ta.trigger("select");
          document.execCommand("copy");
        }
      }),
      $('<button class="ignis-btn ignis-btn-sec">Download</button>').on("click", function () {
        var blob = new Blob([ta.val()], { type: "text/plain;charset=utf-8" });
        triggerDownload(blob, "ignis-debug-" + Date.now() + ".txt");
      })
    );
    var lines = [];
    lines.push(NAME + " v" + VERSION + " â€” URL: " + location.href);
    lines.push("UA: " + navigator.userAgent);
    lines.push("");
    lines.push("â€” Log â€”");
    state.GL_logger.slice(-500).forEach(function (entry) {
      lines.push("[" + new Date(entry.time).toISOString() + "] " + entry.content.map(String).join(" "));
    });
    ta.val(lines.join("\n"));
  }

  function showFeedbackDOM() {
    var modal = createModal({ title: "About", sub: NAME + " v" + VERSION });
    modal.body.append(
      '<div class="ignis-about">' +
        NAME +
        " is an independent, self-contained userscript. It sends no data anywhere and is not affiliated with any other project or maintainer.</div>"
    );
  }

  function getVisibleNodeIndex($main) {
    if (!$main || !$main.length) return 0;
    var hasBackButton = $main.find("button._afxv._al46._al47").length > 0;
    if (!hasBackButton) return 0;
    var $viewport = $main
      .find("*:not([data-pagelet])>*:not([role]):not([data-pagelet])>*>*>*[role]>*>ul[class]")
      .parent()
      .parent("[role]");
    var viewportRect = $viewport[0] ? $viewport[0].getBoundingClientRect() : null;
    if (!viewportRect || !viewportRect.width) return 0;
    var best = null;
    var bestDist = Infinity;
    $main.find("li[class]").each(function () {
      var rect = this.getBoundingClientRect();
      if (!rect.width) return;
      var dist = Math.abs(rect.right - viewportRect.right);
      if (dist < bestDist) {
        bestDist = dist;
        best = this;
      }
    });
    if (!best) return 0;
    var m = ((best.style && best.style.transform) || "").match(/translateX\(([^p]+)px\)/);
    if (!m) return 0;
    return Math.max(0, Math.round(Math.abs(parseFloat(m[1])) / viewportRect.width));
  }

  let sharedIO = null;
  const ioCallbacks = new WeakMap();
  function getIO() {
    if (!sharedIO && typeof IntersectionObserver !== "undefined") {
      sharedIO = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              var cb = ioCallbacks.get(en.target);
              if (cb) {
                ioCallbacks.delete(en.target);
                cb(en.target);
              }
            }
          });
        },
        { rootMargin: "150px" }
      );
    }
    return sharedIO;
  }
  function observeOnce(el, cb) {
    var io = getIO();
    if (!io) {
      cb(el);
      return;
    }
    if (ioCallbacks.has(el)) return;
    ioCallbacks.set(el, cb);
    io.observe(el);
  }

  function looksLikePost(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest(".ignis-bar, .ignis-sb, .ignis-rd, .ignis-modal, .ignis-gd")) return false;
    var isDiv = el.tagName === "DIV";
    var hasHeader = el.querySelector(":scope > header, :scope > div > header") != null;
    var hasLink = el.querySelector('a[href^="/p/"], a[href^="/reel/"]') != null;
    var hasMedia =
      el.querySelector("video, img[src*='cdninstagram'], img[src*='fbcdn.net']") != null;
    if (!hasLink && !hasHeader) return false;
    if (!hasMedia) return false;
    if (isDiv && el.closest("article")) return false;
    if (isDiv && !hasLink) return false;
    if (isDiv) {
      var r = el.getBoundingClientRect();
      if (
        r.width > 0 &&
        r.height > 0 &&
        r.width * r.height > window.innerWidth * window.innerHeight * 0.75
      ) {
        return false;
      }
    }
    return true;
  }

  function findPostElements() {
    var out = [];
    var seen = new Set();
    function push(el) {
      if (seen.has(el)) return;
      seen.add(el);
      out.push(el);
    }
    document.querySelectorAll('article[role="presentation"], article, div[role="presentation"]').forEach(function (el) {
      if (looksLikePost(el)) push(el);
    });
    document.querySelectorAll("section > main > div > div > div > div > div > hr").forEach(function (hr) {
      var p = hr.parentElement;
      for (var i = 0; i < 4 && p; i++) p = p.parentElement;
      if (p) push(p);
    });
    return out;
  }

  function qualifiesAsPost(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === "A" || tag === "ARTICLE" || tag === "VIDEO" || tag === "IMG") return false;
    if (el.querySelector(":scope > header")) return true;
    if (tag === "DIV") {
      var r = el.getBoundingClientRect();
      if (
        r.width >= window.innerWidth * 0.98 &&
        r.height >= window.innerHeight * 0.9
      ) {
        return false;
      }
    }
    var hasPostLink = el.querySelector('a[href*="/p/"], a[href*="/reel/"]') != null;
    var hasTime = el.querySelector("time[datetime]") != null;
    var hasActions =
      el.querySelector(
        'svg[aria-label="Like"], svg[aria-label="Unlike"], svg[aria-label="Comment"], svg[aria-label="Share"], textarea[aria-label*="comment" i]'
      ) != null;
    return hasPostLink && hasTime && hasActions;
  }

  function scanMediaContainers() {
    document.querySelectorAll("video, img[src*='cdninstagram'], img[src*='fbcdn.net']").forEach(function (media) {
      try {
        if (
          media.closest(
            "article, [data-snig], .ignis-bar, .ignis-sb, .ignis-rd, .ignis-modal, .ignis-gd, div[aria-busy][tabindex]"
          )
        ) {
          return;
        }
        var r = media.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (media.tagName === "IMG" && (r.width < 250 || r.height < 250)) return;
        if (media.tagName === "VIDEO" && r.width < 150) return;
        var el = media.parentElement;
        var found = null;
        for (var i = 0; i < 30 && el && el !== document.body; i++) {
          if (qualifiesAsPost(el)) {
            found = el;
            break;
          }
          el = el.parentElement;
        }
        if (found && !found.hasAttribute("data-snig")) {
          var $f = $(found);
          if ($f.height() > 0 && $f.width() > 0) injectPostBar($f);
        }
      } catch (e) {

      }
    });
  }

  function findMediaHost($post) {
    var $children = $post.children("div").children("div");
    var tag = $post[0].tagName;
    var $target = $children.eq(tag === "DIV" ? 0 : $children.length - 2);
    if (!$target.length || !$target.is(":visible") || $target.width() === 0) {
      $target = $post.find("video").first().parent();
    }
    if (!$target.length || $target.width() === 0) {
      var best = null;
      var bestArea = 0;
      $post.find("img[src*='cdninstagram'], img[src*='fbcdn.net']").each(function () {
        var r = this.getBoundingClientRect();
        var area = r.width * r.height;
        if (area > bestArea) {
          bestArea = area;
          best = $(this).parent();
        }
      });
      if (best) $target = best;
    }
    if (!$target.length || $target.width() === 0) {
      $target = $post.children().first();
    }
    return $target;
  }

  function injectPostBar($post) {
    if (!$post || !$post.length) return;
    if ($post.attr("data-snig") || $post.hasClass("x1iyjqo2")) return;
    if ($post.parents("div#scrollview").length) return;
    if ($post.find(".ignis-bar, .ignis-rd").length) return;
    var $target = findMediaHost($post);
    if (!$target.length || $target.width() === 0) return;
    var username = getPostUsername($post) || "";
    $post.attr("data-snig", "canDownload").attr("data-username", username);
    $target.css("position", "relative");
    var bar = $('<div class="ignis-bar">');
    bar.append(
      makeButton(SVG.DOWNLOAD, "Download", "ignis-dl"),
      makeButton(SVG.NEW_TAB, "Open in new tab", "ignis-nt")
    );
    if ($post.find(resourceCountSelector).length > 1) {
      bar.append(makeButton(SVG.DOWNLOAD_ALL, "Download all", "ignis-da"));
    }
    $target.append(bar);
    observeOnce($target[0], function () {
      if (bar.find(".ignis-th").length) return;
      if ($target.find("video")[0]) {
        bar.append(makeButton(SVG.THUMBNAIL, "Download thumbnail", "ignis-th"));
      }
    });
  }

  function scanPosts() {

    document.querySelectorAll('[data-snig="canDownload"]').forEach(function (el) {
      if (!el.querySelector(".ignis-bar")) el.removeAttribute("data-snig");
    });
    findPostElements().forEach(function (el) {
      var $a = $(el);
      if ($a.height() > 0 && $a.width() > 0) injectPostBar($a);
    });
    scanMediaContainers();
  }

  function scanGrids() {
    document
      .querySelectorAll('a[href^="/p/"], a[href^="/reel/"], a[href*="/p/"], a[href*="/reel/"]')
      .forEach(function (a) {
      try {
        if (a.dataset.igGrid) return;
        if (a.closest("article, header, nav, .ignis-bar, .ignis-modal, div[aria-busy][tabindex]")) return;
        var media = a.querySelector("img, video");
        if (!media) return;
        var r = media.getBoundingClientRect();
        if (r.width < 200 || r.height < 150) return;
        var href = a.getAttribute("href") || "";
        var hrefParts = href.split("/").filter(Boolean);
        var scIdx = hrefParts.indexOf("p");
        if (scIdx === -1) scIdx = hrefParts.indexOf("reel");
        if (scIdx === -1 || !hrefParts[scIdx + 1]) return;
        a.dataset.igGrid = "1";
        var btn = document.createElement("button");
        btn.className = "ignis-gd";
        btn.title = "Download this post";
        btn.setAttribute("aria-label", "Download this post");
        btn.innerHTML = SVG.DOWNLOAD;
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var parts = href.split("/").filter(Boolean);
          var idx = parts.indexOf("p");
          if (idx === -1) idx = parts.indexOf("reel");
          var sc = idx > -1 ? parts[idx + 1] : null;
          if (sc) openPostDialog(sc, { anchor: a });
        });
        if (getComputedStyle(a).position === "static") a.style.position = "relative";
        a.appendChild(btn);
      } catch (e) {

      }
    });
  }

  function getPostContextFromButton(target) {
    var $article = $(target).closest('[data-snig="canDownload"], article, div[data-snig]');
    if (!$article.length) return { $article: $(), postPath: null };
    var candidates = [];
    function pushHref(h) {
      if (h && h.trim()) candidates.push(h.trim());
    }
    pushHref($article.find('a[href^="/p/"]').first().attr("href"));
    pushHref($article.find('a[href^="/reel/"]').first().attr("href"));
    $article.find('a[role="link"][href], a[href]').each(function () {
      var h = $(this).attr("href") || "";
      if (h.indexOf("/p/") > -1 || h.indexOf("/reel/") > -1 || /^\/[^/]+\/(p|reel)\//i.test(h)) {
        pushHref(h);
        return false;
      }
    });
    var postPath = null;
    for (var i = 0; i < candidates.length && !postPath; i++) {
      var parts = candidates[i].split("/").filter(Boolean);
      var idx = parts.indexOf("p");
      if (idx === -1) idx = parts.indexOf("reel");
      if (idx > -1 && parts[idx + 1]) postPath = parts[idx + 1];
    }
    if (!postPath) {
      var pp = location.pathname.split("/").filter(Boolean);
      if (pp[0] === "p" || pp[0] === "reel") postPath = pp[1];
    }
    return { $article: $article, postPath: postPath };
  }

  async function resolvePostShortcode(shortcode, ctx) {
    try {
      return await loadPostItems(shortcode, ctx);
    } catch (e) {
      Toasts.error("Could not load post: " + ((e && e.message) || "network error"));
      return null;
    }
  }

  function getStoryProgress(username) {
    var $hdr = null;
    $('body > div section:visible a[href^="/' + esc(username) + '"]').each(function () {
      var $a = $(this);
      if ($a.find("img").length === 0) {
        var txt = $a.text().trim();
        if (!txt || txt.toLowerCase() !== String(username).toLowerCase()) return;
      }
      $a.parents("div:not([class]):not([style])").each(function () {
        var t = $(this).text().trim();
        if (t !== String(username) && $(this).children().length > 1) {
          $hdr = $(this);
          return false;
        }
      });
      if ($hdr) return false;
    });
    if (!$hdr) return $();
    return $hdr.children().filter(function () {
      return $(this).height() < 10;
    }).first().children();
  }

  function setStoryProgressIndexText($element, className, username) {
    var $segs = getStoryProgress(username);
    var total = $segs.length;
    if (total < 2) return;
    var current = 0;
    $segs.each(function (i) {
      if ($(this).children().length > 0) current = i + 1;
    });
    if (!current) return;
    var $counter = $element.find("." + className).first();
    if (!$counter.length) {
      $counter = $('<div class="' + className + ' ignis-sb-pos">');
      $element.append($counter);
    }
    $counter.text(current + "/" + total).attr("title", "Item " + current + " of " + total);
  }

  function resolveStoryMediaIdByTimestamp(payload) {
    var items = payload && payload.data && payload.data.reels_media && payload.data.reels_media[0] && payload.data.reels_media[0].items;
    if (!items || !items.length) return null;
    var $time = $('body > div section:visible time[datetime]')
      .filter(function () {
        return (
          $(this).is(":visible") &&
          $(this).parents('a[href^="/stories/highlights/"]').length === 0 &&
          $(this).parents('[role="button"]').length === 0
        );
      })
      .first();
    if (!$time.length) return null;
    var visibleTs = Math.floor(new Date($time.attr("datetime")).getTime() / 1000);
    if (!isFinite(visibleTs) || !visibleTs) return null;
    var bestId = null;
    var minDiff = Infinity;
    items.forEach(function (item) {
      var d = Math.abs((item.taken_at_timestamp || 0) - visibleTs);
      if (d < minDiff) {
        minDiff = d;
        bestId = item.id;
      }
    });
    return bestId;
  }

  function urlStoryId() {
    var parts = location.pathname.split("/").filter(Boolean);
    for (var i = parts.length - 1; i >= 0; i--) {
      if (/^\d{5,}$/.test(parts[i])) return parts[i];
    }
    return null;
  }

  async function loadStoryPayload(username, type) {
    var cacheKey = type === "highlights" ? "highlights" : "stories";
    var cacheId = type === "highlights" ? location.pathname.split("/").filter(Boolean).pop() : username;
    if (state.GL_dataCache[cacheKey][cacheId]) return state.GL_dataCache[cacheKey][cacheId];
    var payload;
    if (type === "highlights") {
      payload = await getHighlightStories(cacheId);
    } else {
      var userInfo = await getUserId(username);
      var uid = (userInfo.user && (userInfo.user.pk || userInfo.user.id)) || null;
      if (!uid) throw new Error("Cannot resolve user id");
      payload = await getStories(uid);
    }
    state.GL_dataCache[cacheKey][cacheId] = payload;
    return payload;
  }

  async function resolveStoryTarget(payload, urlId) {
    var reel = payload && payload.data && payload.data.reels_media && payload.data.reels_media[0];
    if (!reel) return null;
    var items = normalizeReelItems(reel.items);
    if (!items.length) return null;
    var target = null;
    if (urlId) {
      items.forEach(function (it) {
        if (it.id === urlId) target = it;
      });
    }
    if (!target) {
      var byTs = resolveStoryMediaIdByTimestamp(payload);
      if (byTs) {
        items.forEach(function (it) {
          if (it.id === byTs) target = it;
        });
      }
    }
    if (!target) {
      var countA = document.querySelectorAll(
        "body > div section._ac0a header._ac0k > ._ac3r ._ac3n ._ac3p[style]"
      ).length;
      var countB = document.querySelectorAll(
        "body > div section:visible > div > div:not([class]) > div > div div.x1ned7t2.x78zum5 div.x1caxmr6"
      ).length;
      var countC = 0;
      var base = document.querySelector(
        "body > div div:not([hidden]) section:visible > div div[style]:not([class]) > div"
      );
      if (base) {
        countC = base.querySelectorAll("div div.x1ned7t2.x78zum5 div.x1caxmr6").length;
      }
      var nowIndex = countA || countB || countC;
      if (nowIndex > 0 && nowIndex <= items.length) {
        target = items[nowIndex - 1];
      }
    }
    if (!target) target = items[0];
    return { items: items, target: target };
  }

  async function downloadStoryCurrent(type, isPreview) {
    var username = type === "highlights" ? getHighlightsStoryUsername() : getStoryUsername();
    if (!username) {
      var parts = location.pathname.split("/").filter(Boolean);
      if (parts[0] === "stories" && parts[1]) username = parts[1];
    }
    if (!username) {
      Toasts.error("Cannot resolve the account name.");
      return;
    }
    var ts = Math.floor(Date.now() / 1000);
    var $time = $("body > div section:visible time[datetime]").first();
    if ($time.length) {
      var d = new Date($time.attr("datetime")).getTime() / 1000;
      if (isFinite(d) && d > 0) ts = Math.floor(d);
    }
    var hasVideo = $("body > div section:visible video[playsinline]").length > 0;
    if (!hasVideo) {
      var $img = $(
        "body > div section:visible img[referrerpolicy][class], body > div section:visible img._aa63"
      ).first();
      var srcset = parseSrcset($img.attr("srcset") || "");
      var url = (srcset.length ? srcset[srcset.length - 1].url : null) || $img.attr("src") || "";
      if (/^https?:/i.test(url)) {
        var imgMeta = {
          username: username,
          sourceType: type,
          timestamp: ts,
          shortcode: urlStoryId() || "",
          filetype: "jpg",
        };
        if (isPreview) openNewTab(replaceSameOriginHost(url));
        else await saveFiles(url, imgMeta);
        return;
      }
    }
    var payload;
    try {
      payload = await loadStoryPayload(username, type);
    } catch (e) {
      Toasts.error("Could not load story data: " + ((e && e.message) || "network error"));
      return;
    }
    var t = await resolveStoryTarget(payload, urlStoryId());
    if (!t) {
      Toasts.error("No stories found for this account.");
      return;
    }
    var item = t.target;
    var meta = {
      username: username,
      sourceType: type,
      timestamp: item.takenAt || ts,
      shortcode: item.id,
      caption: item.caption || null,
    };
    if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && USER_SETTING.PREFER_DASH_MANIFEST && item.id) {
      try {
        var mi = await getMediaInfo(item.id);
        if (mi && mi.status === "ok" && mi.items && mi.items[0]) {
          var mediaItem = mi.items[0];
          var dashOk = await tryDashDownload(mediaItem, meta, isPreview);
          if (dashOk) return;
        }
      } catch (e) {
        if (!USER_SETTING.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED) {
          Toasts.error("Media API failed: " + ((e && e.message) || "network error"));
        }
      }
    }
    if (isPreview) openNewTab(replaceSameOriginHost(item.url));
    else await saveFiles(item.url, Object.assign({}, meta, { filetype: item.ext || "mp4" }));
  }

  async function downloadStoryThumbnail(type) {
    var username = type === "highlights" ? getHighlightsStoryUsername() : getStoryUsername();
    if (!username) {
      var parts = location.pathname.split("/").filter(Boolean);
      if (parts[0] === "stories" && parts[1]) username = parts[1];
    }
    if (!username) {
      Toasts.error("Cannot resolve the account name.");
      return;
    }
    try {
      var payload = await loadStoryPayload(username, type);
      var t = await resolveStoryTarget(payload, urlStoryId());
      if (!t || !t.target.thumb) {
        Toasts.error("No thumbnail available.");
        return;
      }
      await saveFiles(t.target.thumb, {
        username: username,
        sourceType: "thumbnail",
        timestamp: t.target.takenAt || Math.floor(Date.now() / 1000),
        shortcode: t.target.id,
        filetype: "jpg",
      });
    } catch (e) {
      Toasts.error("Could not load thumbnail: " + ((e && e.message) || "network error"));
    }
  }

  async function downloadStoriesAll(type) {
    var username = type === "highlights" ? getHighlightsStoryUsername() : getStoryUsername();
    if (!username) {
      var parts = location.pathname.split("/").filter(Boolean);
      if (parts[0] === "stories" && parts[1]) username = parts[1];
    }
    if (!username) {
      Toasts.error("Cannot resolve the account name.");
      return;
    }
    try {
      var payload = await loadStoryPayload(username, type);
      var reel = payload.data && payload.data.reels_media && payload.data.reels_media[0];
      var items = normalizeReelItems(reel ? reel.items : []);
      if (!items.length) {
        Toasts.info("No stories available right now.");
        return;
      }
      var meta = {
        username: username,
        shortcode: (reel && reel.id) || "",
        sourceType: type,
        timestamp: Math.floor(Date.now() / 1000),
        caption: null,
      };
      await batchDownload(items, meta);
      if (type === "stories" && USER_SETTING.DOWNLOAD_STORY_HIGHLIGHTS) {
        try {
          var userInfo = await getUserId(username);
          var uid = (userInfo.user && (userInfo.user.pk || userInfo.user.id)) || null;
          if (uid) {
            var tray = await getUserHighlights(uid);
            for (var i = 0; i < tray.length; i++) {
              var hl = await getHighlightStories(tray[i].id);
              var hReel = hl.data && hl.data.reels_media && hl.data.reels_media[0];
              var hItems = normalizeReelItems(hReel ? hReel.items : []);
              if (hItems.length) {
                await batchDownload(hItems, {
                  username: username,
                  shortcode: (hReel && hReel.id) || "",
                  sourceType: "highlights",
                  timestamp: Math.floor(Date.now() / 1000),
                  caption: null,
                });
              }
            }
          }
        } catch (e) {
          logger("highlights batch failed:", e && e.message ? e.message : e);
        }
      }
    } catch (e) {
      Toasts.error("Could not load stories: " + ((e && e.message) || "network error"));
    }
  }

  function attachStoryButtons() {
    if ($(".ignis-sd").length) return;
    var $element = findStoryContainer();
    if (!$element) return;
    var username = getStoryUsername() || "";
    $element.append(
      makeButton(SVG.DOWNLOAD, "Download this story", "ignis-sd").css({ right: "40px", top: "15px" }),
      makeButton(SVG.NEW_TAB, "Open story in new tab", "ignis-sn").css({ right: "40px", top: "51px" })
    );
    if (getStoryProgress(username).length > 1) {
      $element.append(
        makeButton(SVG.DOWNLOAD_ALL, "Download all stories", "ignis-sa").css({ right: "40px", top: "87px" })
      );
    }
    setStoryProgressIndexText($element, "ignis-sp-pos", username);
  }

  function attachHighlightButtons() {
    if ($(".ignis-hd").length) return;
    var $element = findStoryContainer();
    if (!$element) return;
    var username = getHighlightsStoryUsername() || "";
    $element.append(
      makeButton(SVG.DOWNLOAD, "Download this highlight", "ignis-hd").css({ right: "40px", top: "15px" }),
      makeButton(SVG.NEW_TAB, "Open highlight in new tab", "ignis-hn").css({ right: "40px", top: "51px" })
    );
    if (getStoryProgress(username).length > 1) {
      $element.append(
        makeButton(SVG.DOWNLOAD_ALL, "Download all highlights", "ignis-ha").css({ right: "40px", top: "87px" })
      );
    }
    setStoryProgressIndexText($element, "ignis-hp-pos", username);
  }

  function attachStoryThumbnailButton() {
    var $story = $(".ignis-sd").first().parent();
    if (!$story.length) return;
    if ($story.find("video").length === 0) {
      $story.find(".ignis-st").remove();
      return;
    }
    if ($story.find(".ignis-st").length) return;
    $story.append(
      makeButton(SVG.THUMBNAIL, "Download story thumbnail", "ignis-st").css({ right: "40px", top: "87px" })
    );
  }

  function attachHighlightThumbnailButton() {
    var $hl = $(".ignis-hd").first().parent();
    if (!$hl.length) return;
    if ($hl.find("video").length === 0) {
      $hl.find(".ignis-ht").remove();
      return;
    }
    if ($hl.find(".ignis-ht").length) return;
    $hl.append(
      makeButton(SVG.THUMBNAIL, "Download highlight thumbnail", "ignis-ht").css({ right: "40px", top: "87px" })
    );
  }

  function scanStoryPage() {
    attachStoryButtons();
    var $story = $(".ignis-sd").first().parent();
    if ($story.find("video").length) attachStoryThumbnailButton();
  }

  function scanHighlightPage() {
    attachHighlightButtons();
    var $hl = $(".ignis-hd").first().parent();
    if ($hl.find("video").length) attachHighlightThumbnailButton();
  }

  function attachReelBar($main) {
    if (!$main || !$main.length || $main.find(".ignis-rd, .ignis-bar").length) return;
    $main.css("position", "relative");
    $main.append(
      makeButton(SVG.DOWNLOAD, "Download reel", "ignis-rd").css({ right: "40px", top: "15px" }),
      makeButton(SVG.NEW_TAB, "Open reel in new tab", "ignis-rn").css({ right: "40px", top: "51px" })
    );
  }

  function onReelsPage() {
    $("div[aria-busy][tabindex]").children("div").each(function () {
      var $c = $(this);
      if (
        $c.children().length &&
        $c.width() > window.innerWidth * 0.8 &&
        $c.height() > window.innerHeight * 0.8 &&
        $c.find("video").length
      ) {
        attachReelBar($c);
      }
    });
  }

  async function downloadCurrentReel(isPreview) {
    var path = location.pathname.split("/").filter(Boolean);
    var shortcode = null;
    if (path[0] === "reels" && path[1]) shortcode = path[1];
    if (!shortcode) {
      Toasts.error("Cannot resolve reel id.");
      return;
    }
    var loaded = await resolvePostShortcode(shortcode);
    if (!loaded) return;
    var meta = Object.assign({}, loaded.meta, { sourceType: "reels", caption: null });
    var item = loaded.items[0];
    if (!item) return;
    if (isPreview) openNewTab(replaceSameOriginHost(item.url));
    else await downloadResource(item, meta, {});
  }

  function attachAvatarButton() {
    if ($(".ignis-pd").length) return;
    var $img = $(
      'header > *[class]:first-child > *[class]:first-child img[alt], header > *[class]:first-child img[alt]'
    ).first();
    if (!$img.length) return;
    var $mount = $img.parent().parent();
    $mount.css("position", "relative");
    if ($mount.find(".ignis-pd").length) return;
    $mount.append(makeButton(SVG.DOWNLOAD, "Download profile picture", "ignis-pd"));
  }

  async function downloadAvatar() {
    var parts = location.pathname.split("/").filter(Boolean);
    var username = null;
    if (parts.length && !["p", "reel", "reels", "stories", "explore", "direct"].includes(parts[0])) {
      username = parts[0];
    }
    if (!username) {
      Toasts.error("Cannot resolve the profile name.");
      return;
    }
    try {
      var userInfo = await getUserId(username);
      var uid = (userInfo.user && (userInfo.user.pk || userInfo.user.id)) || null;
      var url = null;
      if (USER_SETTING.DOWNLOAD_PROFILE_PIC_HD && userInfo.user._hdUrl) {
        url = userInfo.user._hdUrl;
      } else if (USER_SETTING.DOWNLOAD_PROFILE_PIC_HD && uid) {
        try {
          url = await getUserHdAvatar(uid);
        } catch (e) {
          url = null;
        }
      }
      if (!url) {
        url = $("header img[alt]").first().attr("src");
      }
      if (!url) {
        Toasts.error("Cannot find profile picture URL.");
        return;
      }
      await saveFiles(url, {
        username: username,
        sourceType: "avatar",
        timestamp: Math.floor(Date.now() / 1000),
        shortcode: username,
        filetype: "jpg",
        uid: uid,
      });
    } catch (e) {
      Toasts.error("Could not download profile picture: " + ((e && e.message) || "network error"));
    }
  }

  function scanAll() {
    if (!state.pageLoaded) return;
    function safe(fn) {
      try {
        fn();
      } catch (e) {
        logger("scan error:", e && e.message ? e.message : e);
      }
    }
    if (state.route === "reels") {
      safe(onReelsPage);
    } else if (state.route === "story") {
      safe(scanStoryPage);
    } else if (state.route === "highlights") {
      safe(scanHighlightPage);
    } else if (state.route === "profile") {
      safe(attachAvatarButton);
      safe(scanPosts);
    } else if (
      state.route === "post" ||
      state.route === "home" ||
      state.route === "explore" ||
      state.route === "dm" ||
      state.route === null
    ) {
      safe(scanPosts);
    }
    safe(scanGrids);
  }

  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(function () {
      scanScheduled = false;
      scanAll();
    }, 150);
  }

  let domObserver = null;
  function installDomObserver() {
    if (domObserver) domObserver.disconnect();
    var mount = document.querySelector('div[id^="mount"]') || document.body;
    domObserver = new MutationObserver(function () {
      scheduleScan();
    });
    domObserver.observe(mount, { childList: true, subtree: true });
  }

  function registerBodyHandlers() {
    if (state.bodyEventsRegistered) return;
    state.bodyEventsRegistered = true;

    $body.on("click.ignisEvents", ".ignis-dl", function () {
      var ctx = getPostContextFromButton(this);
      if (!ctx.postPath) {
        Toasts.error("Cannot find the post link.");
        return;
      }
      var postEl = ctx.$article[0] || null;
      if (USER_SETTING.DIRECT_DOWNLOAD_ALL) {
        resolvePostShortcode(ctx.postPath, { post: postEl }).then(function (loaded) {
          if (loaded) batchDownload(loaded.items, loaded.meta);
        });
        return;
      }
      if (USER_SETTING.DIRECT_DOWNLOAD_VISIBLE_RESOURCE) {
        var index = getVisibleNodeIndex(ctx.$article);
        resolvePostShortcode(ctx.postPath, { post: postEl }).then(function (loaded) {
          if (!loaded) return;
          var item = loaded.items[index] || loaded.items[0];
          if (item) downloadResource(item, loaded.meta, {});
        });
        return;
      }
      openPostDialog(ctx.postPath, { post: postEl });
    });

    $body.on("click.ignisEvents", ".ignis-da", function () {
      var ctx = getPostContextFromButton(this);
      if (!ctx.postPath) {
        Toasts.error("Cannot find the post link.");
        return;
      }
      resolvePostShortcode(ctx.postPath, { post: ctx.$article[0] || null }).then(function (loaded) {
        if (loaded) batchDownload(loaded.items, loaded.meta);
      });
    });

    $body.on("click.ignisEvents", ".ignis-nt", function () {
      var ctx = getPostContextFromButton(this);
      if (!ctx.postPath) {
        Toasts.error("Cannot find the post link.");
        return;
      }
      var index = getVisibleNodeIndex(ctx.$article);
      resolvePostShortcode(ctx.postPath, { post: ctx.$article[0] || null }).then(function (loaded) {
        if (!loaded) return;
        var item = loaded.items[index] || loaded.items[0];
        if (item) downloadResource(item, loaded.meta, { preview: true });
      });
    });

    $body.on("click.ignisEvents", ".ignis-th", function () {
      var ctx = getPostContextFromButton(this);
      if (!ctx.postPath) {
        Toasts.error("Cannot find the post link.");
        return;
      }
      var index = getVisibleNodeIndex(ctx.$article);
      resolvePostShortcode(ctx.postPath, { post: ctx.$article[0] || null }).then(function (loaded) {
        if (!loaded) return;
        var item = loaded.items[index] || loaded.items[0];
        if (item && item.thumb) {
          saveFiles(item.thumb, Object.assign({}, loaded.meta, { sourceType: "thumbnail", filetype: "jpg" }));
        }
      });
    });

    $body.on("click.ignisEvents", ".ignis-sd", function () {
      downloadStoryCurrent("stories", false);
    });
    $body.on("click.ignisEvents", ".ignis-sn", function () {
      downloadStoryCurrent("stories", true);
    });
    $body.on("click.ignisEvents", ".ignis-sa", function () {
      downloadStoriesAll("stories");
    });
    $body.on("click.ignisEvents", ".ignis-st", function () {
      downloadStoryThumbnail("stories");
    });

    $body.on("click.ignisEvents", ".ignis-hd", function () {
      downloadStoryCurrent("highlights", false);
    });
    $body.on("click.ignisEvents", ".ignis-hn", function () {
      downloadStoryCurrent("highlights", true);
    });
    $body.on("click.ignisEvents", ".ignis-ha", function () {
      downloadStoriesAll("highlights");
    });
    $body.on("click.ignisEvents", ".ignis-ht", function () {
      downloadStoryThumbnail("highlights");
    });

    $body.on("click.ignisEvents", ".ignis-rd", function () {
      downloadCurrentReel(false);
    });
    $body.on("click.ignisEvents", ".ignis-rn", function () {
      downloadCurrentReel(true);
    });

    $body.on("click.ignisEvents", ".ignis-pd", function () {
      downloadAvatar();
    });
  }

  const Router = {
    enter: function () {
      state.firstStarted = true;
      state.route = null;
      var path = location.pathname;
      var blacklist =
        /^\/(challenge\/?.*|qr\/?|accounts\/.*|emails\/.*|language\/?.*?|your_activity\/?.*|settings\/help(\/.*)?|auth_platform\/codeentry\/?.*|consent\/?.*)$/i;
      if (
        blacklist.test(path) ||
        ($("div#splash-screen").length > 0 && !$("div#splash-screen").is(":hidden"))
      ) {
        state.pageLoaded = false;
        return;
      }
      if (path === "/" || path.startsWith("/explore")) {
        state.route = "explore";
      } else if (path.startsWith("/p/") || path.startsWith("/reel/") || /^\/([^/]+)\/(p|reel)\//.test(path)) {
        state.route = "post";
      } else if (path.startsWith("/reels/")) {
        state.route = "reels";
      } else if (path.startsWith("/stories/highlights/")) {
        state.route = "highlights";
      } else if (path.startsWith("/stories/")) {
        state.route = "story";
      } else if (path.startsWith("/direct/")) {
        state.route = "dm";
      } else if (
        path.split("/").filter(Boolean).length === 1 &&
        /^[a-zA-Z0-9_.]{1,30}$/.test(path.split("/").filter(Boolean)[0] || "")
      ) {
        state.route = "profile";
      } else {
        state.route = null;
      }
      state.pageLoaded = true;
      this.cleanup();
      try {
        scanAll();
      } catch (e) {
        logger("router scan error:", e && e.message ? e.message : e);
      }
      if (state.route === "home" || state.route === "explore" || state.route === "post") {
        var pollCalls = 0;
        state.postPoll = setInterval(function () {
          pollCalls++;
          try {
            scanAll();
          } catch (e) {

          }
          if (pollCalls >= 100 || document.querySelector(".ignis-bar, .ignis-gd")) {
            clearInterval(state.postPoll);
            state.postPoll = null;
          }
        }, 50);
        setTimeout(scanAll, 400);
        setTimeout(scanAll, 1200);
        setTimeout(scanAll, 3000);
      }
      if (state.route === "story" || state.route === "highlights") {
        state.GL_repeat = setInterval(function () {
          scanAll();
        }, checkInterval);
      }
    },
    cleanup: function () {
      clearInterval(state.GL_repeat);
      state.GL_repeat = null;
      clearInterval(state.postPoll);
      state.postPoll = null;
      clearTimeout(state.homepageObserverDebounce);
      if (Object.keys(state.GL_mediaDataCache).length > 200) {
        state.GL_mediaDataCache = {};
      }
    },
    start: function () {
      setInterval(function () {
        if (location.href !== state.currentURL || !state.firstStarted || !state.pageLoaded) {
          state.firstStarted = true;
          state.currentURL = location.href;
          Router.enter();
        }
      }, 500);
    },
  };

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
