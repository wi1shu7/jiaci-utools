const { ipcRenderer } = require("electron");

let state;
const subscribers = new Set();

ipcRenderer.on("jiaci:state", (event, nextState) => {
  state = nextState;
  for (const listener of subscribers) listener(state);
});

window.jiaci = {
  action(code, value) {
    utools.sendToParent("jiaci:action", code, value);
  },
  subscribe(listener) {
    subscribers.add(listener);
    if (state) listener(state);
    return () => subscribers.delete(listener);
  },
};
