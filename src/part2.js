  /* ============================================================
     Ignis Lens — media detection & extraction
     ============================================================ */

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

  // Universal media-item normalizer. Handles every shape Instagram uses:
  // GraphQL (GraphImage/GraphVideo/GraphSidecar), Media-API items
  // (query_id / carousel_media), and story/highlight reel items.
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

  // Story / highlight reel normalizer (reels_media[0].items)
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

  /* ============================================================
     Ignis Fetch — API layer (timeouts, retries, safe parsing)
     ============================================================ */

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
      /* ignore */
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
        /* skip malformed script */
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
        /* ignore */
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
