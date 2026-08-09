  /* ============================================================
     Ignis Forge — download engine
     ============================================================ */

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
          /* ignore */
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
      /* ignore */
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

  // ─── EXIF writer (JPEG APP1 + WebP EXIF chunk) ─────────────────────────
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

  // ─── DASH pipeline ─────────────────────────────────────────────────────
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

  // Master dispatcher for one normalized media item
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
