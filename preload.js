const fs = require("node:fs");
const path = require("node:path");
const { ipcRenderer } = require("electron");
const { localToday, normalizeHost } = require("./api");
const { RATINGS, Study } = require("./study");
const manifest = require("./plugin.json");

const commands = manifest.features.filter((feature) => feature.mainHide);
const defaults = {
  answer: "Enter", know: "1", fuzzy: "2", master: "3", reset: "4", generate: "5", details: "D", speak: "Space",
};
const ranges = { opacity: [35, 100], width: [304, 720], height: [234, 800], scale: [60, 200] };
const storage = path.join(utools.getPluginLocalDataPath(), "state.json");
let saved = {};
let storageError = "";

try {
  const data = JSON.parse(fs.readFileSync(storage, "utf8"));
  if (data && typeof data === "object") saved = data;
} catch (error) {
  if (error.code !== "ENOENT") storageError = "读取本地设置失败";
}

function save(changes) {
  Object.assign(saved, changes);
  try {
    fs.mkdirSync(path.dirname(storage), { recursive: true, mode: 0o700 });
    fs.writeFileSync(`${storage}.tmp`, JSON.stringify(saved), { mode: 0o600 });
    fs.renameSync(`${storage}.tmp`, storage);
    storageError = "";
  } catch {
    storageError = "保存本地设置失败";
  }
}

function bounded(value, range, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(range[1], Math.max(range[0], Math.round(number))) : fallback;
}

function settingsFrom(data) {
  const colors = { light: "#fcfaf4", dark: "#1c1d22" };
  for (const theme of Object.keys(colors)) {
    const color = data?.colors?.[theme] ?? (theme === "light" ? data?.color : null);
    if (/^#[0-9a-f]{6}$/i.test(color)) colors[theme] = color;
  }
  return {
    sidebarCollapsed: data?.sidebarCollapsed === true,
    alwaysOnTop: data?.alwaysOnTop !== false,
    sound: data?.sound === true,
    mainTheme: data?.mainTheme === "dark" ? "dark" : "light",
    floatTheme: data?.floatTheme === "dark" ? "dark" : "light",
    transparentBackground: data?.transparentBackground === true,
    colors,
    opacity: bounded(data?.opacity, ranges.opacity, 96),
    width: bounded(data?.width, ranges.width, 404),
    height: bounded(data?.height, ranges.height, 380),
    scale: bounded(data?.scale, ranges.scale, 100),
    keys: Object.fromEntries(Object.entries(defaults).map(([code, key]) => [
      code, typeof data?.keys?.[code] === "string" ? data.keys[code] : key,
    ])),
  };
}

let preferences = settingsFrom(saved.preferences);
const subscribers = new Set();
let floatWindow = null;
let floatReady = false;
let floatWanted = false;
let windowError = "";
let audioEpoch = 0;
let audio = null;
let lastItem = null;
const study = new Study(saved, publish, save);

function snapshot() {
  return {
    ...study.snapshot(),
    preferences,
    floatVisible: floatWanted,
    settingsNotice: windowError || storageError,
    notice: windowError || storageError || study.notice,
  };
}

function liveFloat() {
  if (floatWindow?.isDestroyed()) {
    floatWindow = null;
    floatReady = false;
    floatWanted = false;
  }
  return floatWindow;
}

function refreshFloatVisibility() {
  const wasVisible = floatWanted;
  const win = liveFloat();
  if (win && floatWanted && floatReady && !win.isVisible()) {
    floatWanted = false;
  }
  if (wasVisible && !floatWanted) {
    stopAudio();
    publish();
  }
}

function publish() {
  if (lastItem !== study.item) {
    lastItem = study.item;
    stopAudio();
  }
  const win = liveFloat();
  if (floatWanted && (!study.api || study.user?.termsOutdated)) setFloatVisible(false);
  const state = snapshot();
  for (const listener of subscribers) listener(state);
  if (floatReady && win) {
    const { host, user, books, otp, ...cardState } = state;
    win.webContents.send("jiaci:state", { ...cardState, user: user && { termsOutdated: user.termsOutdated } });
  }
}

function floatBounds(bounds) {
  const point = bounds ? { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2) } : utools.getCursorScreenPoint();
  const area = utools.getDisplayNearestPoint(point).workArea;
  const scale = preferences.scale / 100;
  const width = Math.min(Math.round(preferences.width * scale), area.width);
  const height = Math.min(Math.round(preferences.height * scale), area.height);
  const right = area.x + area.width - width;
  const bottom = area.y + area.height - height;
  return {
    width, height,
    x: Math.max(area.x, Math.min(bounds?.x ?? right - 24, right)),
    y: Math.max(area.y, Math.min(bounds?.y ?? bottom - 24, bottom)),
  };
}

function setFloatVisible(show) {
  floatWanted = show;
  if (!show) {
    floatWindow?.hide();
    stopAudio();
    return;
  }
  if (floatWindow) {
    if (floatReady) floatWindow.showInactive();
    return;
  }
  try {
    const created = utools.createBrowserWindow("float.html", {
      ...floatBounds(),
      show: false, frame: false, transparent: true, resizable: false,
      alwaysOnTop: preferences.alwaysOnTop, skipTaskbar: true, hasShadow: false, backgroundColor: "#00000000",
      webPreferences: { preload: "float-preload.js" },
    }, () => {
      if (floatWindow !== created) return;
      floatReady = true;
      if (floatWanted) created.showInactive();
      publish();
    });
    floatWindow = created;
  } catch {
    floatWindow = null;
    floatReady = false;
    floatWanted = false;
    windowError = "无法创建学习小窗，请检查 uTools 版本后重试";
  }
}

function toggleFloat() {
  refreshFloatVisibility();
  if (!study.api?.session || study.user?.termsOutdated) return;
  windowError = "";
  setFloatVisible(!floatWanted);
  publish();
  if (floatWanted) syncIfNeeded();
}

function syncIfNeeded() {
  if (study.api && (!study.loaded || study.localDay !== localToday())) void study.sync();
}

function changePreferences(changes) {
  const win = liveFloat();
  const old = preferences;
  preferences = settingsFrom({ ...preferences, ...changes });
  windowError = "";
  if (old.sound && !preferences.sound) stopAudio();
  if (win && old.alwaysOnTop !== preferences.alwaysOnTop) {
    try {
      win.setAlwaysOnTop(preferences.alwaysOnTop);
    } catch {
      preferences.alwaysOnTop = old.alwaysOnTop;
      windowError = "无法更新小窗置顶状态";
    }
  }
  if (win && (old.width !== preferences.width || old.height !== preferences.height || old.scale !== preferences.scale)) {
    try {
      win.setBounds(floatBounds(win.getBounds()));
    } catch {
      preferences = { ...preferences, width: old.width, height: old.height, scale: old.scale };
      windowError = "无法调整小窗尺寸";
    }
  }
  save({ preferences });
  publish();
}

function setKey({ code, key }) {
  if (!Object.hasOwn(defaults, code) || typeof key !== "string" || key.length > 32) return false;
  if (key && Object.entries(preferences.keys).some(([action, old]) => action !== code && old === key)) return false;
  changePreferences({ keys: { ...preferences.keys, [code]: key } });
  return true;
}

function stopAudio() {
  audioEpoch += 1;
  if (audio) {
    audio.pause();
    audio = null;
  }
  window.speechSynthesis?.cancel();
}

async function pronounce(sentence) {
  const item = study.item;
  if (!item || !preferences.sound) return;
  const asSentence = typeof sentence === "string";
  const text = asSentence ? sentence : item.spelling;
  if (asSentence && !item.examples?.includes(text) && !study.detail?.view.examples?.some((example) => example.en === text)) return;
  stopAudio();
  const epoch = audioEpoch;
  let usedFallback = false;
  function fallback() {
    if (usedFallback || epoch !== audioEpoch || !window.speechSynthesis) return;
    usedFallback = true;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = study.user?.settings?.accent === "uk" ? "en-GB" : "en-US";
    window.speechSynthesis.speak(utterance);
  }
  try {
    const bytes = await study.pronunciation(asSentence ? "sentence" : "word", text);
    if (epoch !== audioEpoch) return;
    if (!bytes) return fallback();
    audio = new Audio(`data:audio/mpeg;base64,${bytes.toString("base64")}`);
    audio.addEventListener("error", fallback, { once: true });
    await audio.play();
  } catch {
    fallback();
  }
}

const learningActions = {
  answer: () => study.reveal(),
  details: () => study.reveal(true),
  refreshDetail: () => study.refreshDetail(),
  generate: () => study.generate(),
  speak: (sentence) => pronounce(sentence),
  ...Object.fromEntries(Object.keys(RATINGS).map((result) => [result, () => study.rate(result)])),
};

function runLearning(code, value) {
  if (Object.hasOwn(learningActions, code)) void learningActions[code](value);
}

const mainActions = {
  ...learningActions,
  sync: () => study.sync(),
  otp: (values) => study.sendCode(values),
  login: (values) => study.signIn(values),
  logout: () => study.logout(),
  acceptTerms: () => study.acceptTerms(),
  book: (bookId) => study.switchBook(bookId),
  toggleFloat,
  preferences: (changes) => changePreferences(changes),
  resetKeys: () => changePreferences({ keys: defaults }),
  openTerms: ({ host, type }) => {
    if (!["privacy", "terms"].includes(type)) return;
    try {
      utools.shellOpenExternal(`${normalizeHost(host)}/legal/${type}`);
    } catch (error) {
      study.notice = error.message;
      publish();
    }
  },
  globalKey: (code) => {
    const command = commands.find((feature) => feature.code === code);
    if (command) utools.redirectHotKeySetting(command.cmds[0]);
  },
};

ipcRenderer.on("jiaci:action", (_event, code, value) => {
  if (!liveFloat() || !floatReady || !floatWanted) return;
  if (code === "hide") {
    setFloatVisible(false);
    publish();
  } else if (code === "sync") void study.sync();
  else runLearning(code, value);
});

window.addEventListener("focus", refreshFloatVisibility);

utools.onPluginEnter(({ code, from }) => {
  if (code === "boss") {
    toggleFloat();
    if (from !== "hotkey") utools.hideMainWindow();
  } else if (commands.some((feature) => feature.code === code)) {
    if (liveFloat() && floatWanted) runLearning(code);
    if (from !== "hotkey") utools.hideMainWindow();
  } else {
    utools.subInputBlur();
    refreshFloatVisibility();
    syncIfNeeded();
  }
});

utools.onPluginOut((killed) => {
  if (killed) {
    stopAudio();
    liveFloat()?.close();
  }
});

window.jiaci = {
  action(code, value) {
    if (Object.hasOwn(mainActions, code)) return mainActions[code](value);
  },
  subscribe(listener) {
    subscribers.add(listener);
    listener(snapshot());
    return () => subscribers.delete(listener);
  },
  setKey,
  globalKey(code) {
    const command = commands.find((feature) => feature.code === code);
    return command ? (utools.getCmdHotKey?.(command.cmds[0]) ?? "") : "";
  },
};
