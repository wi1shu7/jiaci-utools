import { useEffect, useLayoutEffect, useState } from "react"

export const actions = {
  answer: "显示答案",
  know: "认识",
  fuzzy: "模糊",
  master: "已掌握",
  reset: "重新记",
  generate: "生成 AI 资料",
  details: "词条资料",
  speak: "发音",
}

export function keyLabel(key) {
  return key ? key.split("+").map((part) => part === "Space" ? "空格" : part).join("+") : ""
}

export function combo(event) {
  if (event.isComposing || ["Alt", "Control", "Meta", "Shift", "Dead", "Unidentified", "Process"].includes(event.key)) return ""
  let key = /^(Key[A-Z]|Digit\d|Numpad\d)$/.test(event.code) ? event.code.slice(-1) : event.key
  if (key === " ") key = "Space"
  if (key.length === 1) key = key.toUpperCase()
  return [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Meta", key].filter(Boolean).join("+")
}

export function useJiaciState(bridge) {
  const [state, setState] = useState(null)
  useEffect(() => bridge?.subscribe(setState), [bridge])
  return state
}

export function useWindowTheme(theme) {
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
}

export function useStudyShortcuts(keys, send, active) {
  useEffect(() => {
    if (!keys || !active) return
    const handle = (event) => {
      if (event.repeat || event.defaultPrevented ||
        event.target.closest("input, select, textarea, [contenteditable], [role=dialog], [role=menu], [data-book-library]")) return
      const key = combo(event)
      if (!key || (event.target.closest("button, a, summary") && ["Enter", "Space"].includes(key))) return
      const action = Object.keys(keys).find((name) => keys[name] === key)
      if (action) {
        event.preventDefault()
        send(action)
      }
    }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [keys, send, active])
}
