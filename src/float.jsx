import { Minus } from "lucide-react"
import { IconButton } from "@/components/controls"
import { StudyCard } from "@/components/study-card"
import { useStudyShortcuts, useWindowTheme } from "@/lib/jiaci"

function floatAppearance({ colors, floatTheme, transparentBackground, opacity, scale }) {
  const color = colors[floatTheme]
  const channels = color.slice(1).match(/../g).map((part) => Number.parseInt(part, 16) / 255)
  const [red, green, blue] = channels.map((part) => part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4)
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
  const light = transparentBackground ? floatTheme === "light" : luminance >= 0.179
  const foreground = transparentBackground ? light ? "#202127" : "#f4f4f5"
    : luminance > 0.7 ? "#202127" : luminance < 0.06 ? "#f4f4f5" : light ? "#000" : "#fff"
  return {
    "--float-background": color,
    "--float-foreground": foreground,
    "--float-muted": transparentBackground ? foreground : luminance > 0.7 ? "#62636b" : luminance < 0.06 ? "#b5b6c1" : light ? "#000" : "#fff",
    "--float-opacity": opacity / 100,
    "--float-scale": scale / 100,
    colorScheme: light ? "light" : "dark",
  }
}

export function FloatingWindow({ state, bridge }) {
  const send = bridge.action
  const { floatTheme, keys, transparentBackground } = state.preferences
  useWindowTheme(floatTheme)
  useStudyShortcuts(keys, send, true)
  return (
    <main
      className="float-shell" aria-label="学习小窗"
      data-transparent={transparentBackground}
      style={floatAppearance(state.preferences)}
    >
      {transparentBackground ? <div className="float-grip" aria-hidden="true" /> : (
        <header className="float-toolbar">
          <h1>AI 加词</h1>
          {state.loaded && (
            <span className="float-progress"><span className="sr-only">本轮进度 </span>{state.done} / {state.total}</span>
          )}
          <IconButton label="隐藏学习小窗" size="icon-xs" onClick={() => send("hide")}><Minus /></IconButton>
        </header>
      )}
      <StudyCard state={state} send={send} compact />
    </main>
  )
}
