import type { CSSProperties } from "react";

const ACCENT = "#1ed760";

const CSS = `
.mb-panel { color: #fff; font-size: 13px; }
.mb-panel *, .mb-panel *::before, .mb-panel *::after { box-sizing: border-box; }

.mb-search {
  display: grid; grid-template-columns: 82px minmax(0, 1fr) 68px;
  align-items: center; gap: 8px; width: 100%; padding: 12px;
}
.mb-search-field {
  min-width: 0; display: flex; align-items: center; gap: 8px; height: 38px;
  padding: 0 12px; border-radius: 999px; background: #242424;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}
.mb-search-field:focus-within { background: #2a2a2a; box-shadow: inset 0 0 0 1px #4d4d4d; }
.mb-search-field svg { color: #a7a7a7; flex: none; }
.mb-search-input {
  flex: 1; min-width: 0; border: 0; outline: 0; background: transparent;
  color: #fff; font: inherit;
}
.mb-search-input::placeholder { color: #a7a7a7; }
.mb-search-input:disabled { cursor: not-allowed; }
.mb-provider-select {
  width: 82px; height: 38px; padding: 0 26px 0 12px;
  border: 1px solid #3a3a3a; border-radius: 999px; outline: 0;
  appearance: none; -webkit-appearance: none; color: #fff; font: inherit;
  font-weight: 600; cursor: pointer;
  background-color: #242424;
  background-image:
    linear-gradient(45deg, transparent 50%, #b3b3b3 50%),
    linear-gradient(135deg, #b3b3b3 50%, transparent 50%);
  background-position: calc(100% - 14px) 16px, calc(100% - 10px) 16px;
  background-repeat: no-repeat; background-size: 4px 4px;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.mb-provider-select:hover:not(:disabled) { background-color: #2a2a2a; }
.mb-provider-select:focus { border-color: #6a6a6a; box-shadow: 0 0 0 1px #4d4d4d; }
.mb-provider-select:disabled { opacity: 0.5; cursor: not-allowed; }
.mb-provider-select option { background: #242424; color: #fff; }

.mb-add {
  width: 68px; height: 38px; padding: 0 10px; border: 0; border-radius: 999px;
  background: ${ACCENT}; color: #000; font: inherit; font-weight: 700;
  letter-spacing: 0.02em; cursor: pointer;
  transition: transform 0.1s ease, background 0.15s ease;
}
.mb-add:hover:not(:disabled) { background: #24e065; transform: scale(1.04); }
.mb-add:disabled { opacity: 0.4; cursor: not-allowed; }

.mb-hero {
  display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 12px;
  align-items: center; padding: 2px 16px 10px;
}
.mb-art {
  width: 76px; height: 76px; border-radius: 8px; overflow: hidden;
  display: grid; place-items: center; background: #282828;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.mb-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mb-art-fallback { color: #6a6a6a; }

.mb-eyebrow {
  font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: ${ACCENT};
}
.mb-eyebrow-idle { color: #a7a7a7; }
.mb-title {
  margin-top: 5px; font-size: 16px; font-weight: 700; line-height: 1.25;
  overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.mb-sub { margin-top: 3px; font-size: 12px; color: #b3b3b3; }

.mb-progress { padding: 0 16px; }
.mb-bar { height: 4px; border-radius: 999px; background: #4d4d4d; overflow: hidden; }
.mb-bar-fill {
  height: 100%; width: 0; border-radius: 999px; background: #fff;
  transition: width 1s linear, background 0.15s ease;
}
.mb-panel:hover .mb-bar-fill { background: ${ACCENT}; }
.mb-times {
  display: flex; justify-content: space-between; margin-top: 6px;
  font-size: 11px; color: #a7a7a7; font-variant-numeric: tabular-nums;
}

.mb-controls {
  display: flex; justify-content: center; align-items: center;
  padding: 8px 16px 10px;
}
.mb-transport { display: flex; align-items: center; gap: 20px; }
.mb-ctrl {
  display: grid; place-items: center; padding: 4px; border: 0;
  background: transparent; color: #b3b3b3; cursor: pointer;
  transition: color 0.15s ease, transform 0.1s ease;
}
.mb-ctrl:hover:not(:disabled) { color: #fff; transform: scale(1.1); }
.mb-ctrl:disabled { opacity: 0.35; cursor: not-allowed; }
.mb-ctrl-main {
  width: 40px; height: 40px; padding: 0; border-radius: 50%;
  background: #fff; color: #000;
}
.mb-ctrl-main:hover:not(:disabled) { color: #000; transform: scale(1.06); }
.mb-ctrl-main:disabled { background: #535353; color: #1a1a1a; }


.mb-section { border-top: 1px solid #242424; padding: 12px 8px 10px; }
.mb-section-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px; padding: 0 8px 8px;
}
.mb-section-title {
  font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: #b3b3b3;
}
.mb-section-count { font-size: 11px; color: #a7a7a7; }

.mb-list {
  list-style: none; margin: 0; padding: 0;
  max-height: min(216px, 28dvh); overflow-y: auto; overscroll-behavior: contain;
}
.mb-list::-webkit-scrollbar { width: 8px; }
.mb-list::-webkit-scrollbar-track { background: transparent; }
.mb-list::-webkit-scrollbar-thumb { background: #4d4d4d; border-radius: 4px; }
.mb-list::-webkit-scrollbar-thumb:hover { background: #6a6a6a; }

.mb-row {
  display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 10px;
  align-items: center; padding: 6px 8px; border-radius: 6px;
  transition: background 0.15s ease;
}
.mb-row:hover, .mb-row:focus-within { background: #1f1f1f; }
.mb-row-copy { min-width: 0; }
.mb-queue-art {
  position: relative; width: 38px; height: 38px; overflow: hidden;
  display: grid; place-items: center; border-radius: 5px;
  background: #282828; color: #6a6a6a;
}
.mb-queue-art img { width: 100%; height: 100%; object-fit: cover; }
.mb-queue-position {
  position: absolute; right: 2px; bottom: 2px; min-width: 16px; height: 16px;
  padding: 0 4px; display: grid; place-items: center; border-radius: 999px;
  background: rgba(0, 0, 0, 0.76); color: #fff; font-size: 9px;
  font-variant-numeric: tabular-nums;
}
.mb-queue-play {
  position: absolute; inset: 0; display: none; place-items: center;
  width: 100%; height: 100%; border-radius: 5px;
  background: rgba(0, 0, 0, 0.68); color: #fff;
}
.mb-row:hover .mb-queue-position, .mb-row:focus-within .mb-queue-position { display: none; }
.mb-row:hover .mb-queue-play, .mb-row:focus-within .mb-queue-play { display: grid; }
.mb-row-label {
  min-width: 0; font-size: 13px; line-height: 1.3; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.mb-row-meta { margin-top: 2px; font-size: 11px; color: #a7a7a7; }
.mb-row-remove { opacity: 0; transition: opacity 0.15s ease, color 0.15s ease; }
.mb-row:hover .mb-row-remove, .mb-row:focus-within .mb-row-remove { opacity: 1; }
.mb-row-remove:focus-visible { opacity: 1; }

.mb-results { padding-bottom: 12px; }
.mb-result {
  display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 10px;
  align-items: center; padding: 7px 8px; border-radius: 6px;
  transition: background 0.15s ease;
}
.mb-result:hover, .mb-result:focus-within { background: #1f1f1f; }
.mb-result-art {
  width: 42px; height: 42px; display: grid; place-items: center; overflow: hidden;
  border-radius: 5px; background: #282828; color: #6a6a6a;
}
.mb-result-art img { width: 100%; height: 100%; object-fit: cover; }
.mb-result-copy { min-width: 0; }
.mb-result-play {
  display: flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px;
  border: 0; border-radius: 999px; background: #fff; color: #000;
  font: inherit; font-size: 11px; font-weight: 700; cursor: pointer;
}
.mb-result-play:hover:not(:disabled) { transform: scale(1.04); }
.mb-result-play:disabled { opacity: 0.4; cursor: not-allowed; }
.mb-load-more-row { padding: 8px 8px 2px; overflow-anchor: none; }
.mb-load-more {
  display: block; width: 100%; height: 34px; margin: 0;
  border: 1px solid #3a3a3a; border-radius: 999px; background: transparent;
  color: #fff; font: inherit; font-weight: 700; cursor: pointer;
}
.mb-load-more:hover:not(:disabled) { border-color: #6a6a6a; background: #242424; }
.mb-load-more:disabled { opacity: 0.5; cursor: wait; }

.mb-note { padding: 0 16px 12px; font-size: 12px; color: #f5a3a3; overflow-wrap: anywhere; }
.mb-empty { padding: 6px 16px 14px; font-size: 12px; color: #a7a7a7; text-align: center; }

/* the pulse on the topbar trigger, outside .mb-panel */
.mb-dot {
  position: absolute; right: 6px; top: 6px; width: 7px; height: 7px;
  border-radius: 50%; background: ${ACCENT};
  animation: mb-pulse 1.8s ease-in-out infinite;
}
@keyframes mb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

@media (max-height: 720px) {
  .mb-search { padding-block: 8px; }
  .mb-hero {
    grid-template-columns: 64px minmax(0, 1fr); gap: 10px;
    padding-bottom: 8px;
  }
  .mb-art { width: 64px; height: 64px; }
  .mb-controls { padding-block: 6px 8px; }
  .mb-section { padding-top: 8px; padding-bottom: 8px; }
  .mb-list { max-height: 24dvh; }
}

@media (prefers-reduced-motion: reduce) {
  .mb-dot, .mb-panel *, .mb-panel *::before, .mb-panel *::after {
    animation-duration: 0.01ms !important; transition-duration: 0.01ms !important;
  }
}
`;

const STYLE_ID = "music-bot-player-styles";

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const element = document.createElement("style");

  element.id = STYLE_ID;
  element.textContent = CSS;

  document.head.append(element);
}

const panelStyle: CSSProperties = {
  width: "min(380px, calc(100vw - 20px))",
  padding: 0,
  border: "1px solid #2a2a2a",
  borderRadius: 14,
  background: "linear-gradient(180deg, #1c2a20 0%, #141414 38%, #121212 100%)",
  maxHeight: "calc(100dvh - 24px)",
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehavior: "contain",
};

export { ACCENT, panelStyle };
