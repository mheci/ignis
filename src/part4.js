  /* ============================================================
     Ignis Render — UI (download dialog, dashboard, viewer)
     ============================================================ */

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

  // ─── Modal stack ───────────────────────────────────────────────────────
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

  // ─── Post download dialog ──────────────────────────────────────────────
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
      var dims = item.width || item.height ? item.width + "×" + item.height + " · " : "";
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

  // ─── Story / highlight dialogs ─────────────────────────────────────────
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


  // ─── Dashboard settings ────────────────────────────────────────────────
  function showSetting(tab) {
    if (tab) state._igTab = tab;
    if (!CAT_MAP[state._igTab] && state._igTab !== "about") state._igTab = "download";
    ModalStack.closeTop();
    $(".ignis-modal").remove();
    var modal = createModal({ title: NAME + " Settings", sub: "v" + VERSION });
    var tabs = $('<div class="ignis-tabs">');
    var search = $('<input class="ignis-search" type="search" placeholder="Search settings…">');
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
          row.find("button").text("Press a key…");
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
          '<div class="ignis-about"><b>' + NAME + " v" + VERSION + '</b> — clean download-focused build.<div class="ignis-rt">' +
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

  // ─── Debug & feedback ──────────────────────────────────────────────────
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
    lines.push(NAME + " v" + VERSION + " — URL: " + location.href);
    lines.push("UA: " + navigator.userAgent);
    lines.push("");
    lines.push("— Log —");
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
