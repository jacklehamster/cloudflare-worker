// yt-random-playlist.js
// Usage (works in <head> or <body>):
//   <script src="yt-random-playlist.js" defer></script>
//
// Optional attributes on the SAME <script> tag:
//   data-playlist="PL..."     (defaults to the playlist below)
//   data-video="VIDEO_ID"     (optional: start EXACTLY on this video; playlist is still shown)
//   data-width="560"          (default 560)
//   data-height="315"         (default 315)
//   data-shuffle="1|0"        (default 1; used only when data-video is not set)
//   data-right="16"           (px, default 16)
//   data-bottom="16"          (px, default 16)

(function () {
  const DEFAULT_PLAYLIST_ID = "PLV681LxQUUTOz-kmaY2hCS7ZDOqgbhMTO";
  const HOST_ID = "yt-random-playlist-player";
  let apiPromise;

  function loadYouTubeAPI() {
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) return resolve(window.YT);

      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === "function") prev();
        resolve(window.YT);
      };

      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.onerror = () => reject(new Error("[yt-random-playlist] Failed to load YouTube IFrame API"));
      document.head.appendChild(s);
    });
    return apiPromise;
  }

  function getScriptEl() {
    return (
      document.currentScript ||
      document.querySelector('script[src*="yt-random-playlist"]') ||
      document.querySelector("script[data-playlist],script[data-video]")
    );
  }

  function attrNum(el, name, def) {
    const n = Number(el.getAttribute(name));
    return Number.isFinite(n) ? n : def;
  }

  function attrBool(el, name, def) {
    const v = el.getAttribute(name);
    if (v == null) return def;
    return v !== "0" && v.toLowerCase() !== "false";
  }

  function isLikelyVideoId(s) {
    return typeof s === "string" && /^[a-zA-Z0-9_-]{11}$/.test(s);
  }

  function ensureHost(rightPx, bottomPx) {
    let host = document.getElementById(HOST_ID);
    if (host) return host;

    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.position = "absolute";
    host.style.right = `${rightPx}px`;
    host.style.bottom = `${bottomPx}px`;
    host.style.zIndex = "9999";

    const attach = () => (document.body || document.documentElement).appendChild(host);
    if (document.body) attach();
    else document.addEventListener("DOMContentLoaded", attach);

    return host;
  }

  function ensureOverlayButton(host, onClick) {
    if (host.querySelector("[data-yt-sound-btn]")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "▶ Play with sound";
    btn.setAttribute("data-yt-sound-btn", "1");

    btn.style.position = "absolute";
    btn.style.left = "50%";
    btn.style.top = "50%";
    btn.style.transform = "translate(-50%, -50%)";
    btn.style.padding = "10px 14px";
    btn.style.borderRadius = "12px";
    btn.style.border = "1px solid rgba(0,0,0,.25)";
    btn.style.background = "white";
    btn.style.cursor = "pointer";
    btn.style.zIndex = "10000";
    btn.style.boxShadow = "0 8px 24px rgba(0,0,0,.15)";

    btn.addEventListener("click", () => {
      btn.remove();
      onClick();
    });

    host.appendChild(btn);
  }

  function playWithSound(player) {
    if (player.unMute) player.unMute();
    if (player.setVolume) player.setVolume(100);
    if (player.playVideo) player.playVideo();
  }

  function tryAutoplayWithSoundOrWaitForClick(player, host) {
    try {
      playWithSound(player);
      setTimeout(() => {
        const st = player.getPlayerState ? player.getPlayerState() : null;
        // 1=PLAYING, 3=BUFFERING; otherwise likely blocked
        if (st !== 1 && st !== 3) ensureOverlayButton(host, () => playWithSound(player));
      }, 500);
    } catch {
      ensureOverlayButton(host, () => playWithSound(player));
    }
  }

  async function boot() {
    const scriptEl = getScriptEl();
    if (!scriptEl) return;

    const playlistId = scriptEl.getAttribute("data-playlist") || DEFAULT_PLAYLIST_ID;
    const rawVideoId = (scriptEl.getAttribute("data-video") || "").trim();
    const videoId = isLikelyVideoId(rawVideoId) ? rawVideoId : "";

    const width = attrNum(scriptEl, "data-width", 560);
    const height = attrNum(scriptEl, "data-height", 315);
    const shuffle = attrBool(scriptEl, "data-shuffle", true);
    const rightPx = attrNum(scriptEl, "data-right", 16);
    const bottomPx = attrNum(scriptEl, "data-bottom", 16);

    const host = ensureHost(rightPx, bottomPx);
    const YT = await loadYouTubeAPI();

    let player;

    // IMPORTANT:
    // - If videoId is provided, we pass it into the constructor AND include list/listType.
    //   We do NOT call cuePlaylist(), because that forces index 0 and overrides your selection.
    // - If no videoId, we load playlist then pick a random item.
    player = new YT.Player(host, {
      width,
      height,
      videoId: videoId || undefined,
      playerVars: {
        enablejsapi: 1,
        origin: window.location.origin,
        autoplay: 0,

        // Always include playlist UI/context
        listType: "playlist",
        list: playlistId,
      },
      events: {
        onReady: () => {
          if (rawVideoId && !videoId) {
            console.warn(
              "[yt-random-playlist] data-video must be an 11-char YouTube video id (like dQw4w9WgXcQ). Ignoring:",
              rawVideoId
            );
          }

          if (videoId) {
            // Direct: stay on the requested video (no cuePlaylist override).
            tryAutoplayWithSoundOrWaitForClick(player, host);
            return;
          }

          // Random mode: cue playlist and then play a random index.
          if (player.cuePlaylist) player.cuePlaylist({ listType: "playlist", list: playlistId });

          let attempts = 0;
          const pickRandom = () => {
            attempts++;
            const ids = player.getPlaylist ? player.getPlaylist() : null;
            if (ids && ids.length && player.playVideoAt) {
              if (shuffle && player.setShuffle) player.setShuffle(true);
              player.playVideoAt(Math.floor(Math.random() * ids.length));
              tryAutoplayWithSoundOrWaitForClick(player, host);
              return;
            }
            if (attempts < 25) setTimeout(pickRandom, 150);
            else ensureOverlayButton(host, () => playWithSound(player));
          };
          pickRandom();
        },
        onError: (e) => {
          console.error("[yt-random-playlist] Player error code:", e && e.data);
          ensureOverlayButton(host, () => playWithSound(player));
        },
      },
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch(console.error));
  } else {
    boot().catch(console.error);
  }
})();
