import { createRoot } from "react-dom/client"
import { Notice } from "@/components/controls"
import { useJiaciState } from "@/lib/jiaci"
import { MainWindow } from "./main"
import { FloatingWindow } from "./float"
import "./style.css"

const root = document.getElementById("app")
const bridge = window.jiaci
const Window = root.dataset.window === "float" ? FloatingWindow : MainWindow

function App() {
  const state = useJiaciState(bridge)
  if (!bridge) return <main className="login-pane"><Notice message="请从 uTools 开发者工具运行此插件。" /></main>
  return state && <Window state={state} bridge={bridge} />
}

createRoot(root).render(<App />)
