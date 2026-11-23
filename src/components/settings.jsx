import { useEffect, useState } from "react"
import { ChevronDown, Moon, Plus, RotateCcw, Sun } from "lucide-react"
import { HexColorInput, HexColorPicker } from "react-colorful"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Notice } from "@/components/controls"
import { HelpDialog } from "@/components/help-dialog"
import { actions, combo, keyLabel } from "@/lib/jiaci"

function SettingsNotes({ title, children }) {
  return (
    <Collapsible className="settings-notes">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className="notes-trigger group">
          <ChevronDown className="group-data-[state=open]:rotate-180" />
          {title}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="notes-content">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function Dimension({ name, label, value, min, max, onCommit }) {
  const [draft, setDraft] = useState(null)
  return (
    <div className="field">
      <Label htmlFor={name}>{label}（px）</Label>
      <Input
        id={name} type="number" min={min} max={max} step={1} value={draft ?? value}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          const next = event.target.valueAsNumber
          setDraft(null)
          if (Number.isFinite(next) && next !== value) onCommit(next)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
      />
    </div>
  )
}

function ColorField({ color, onChange, disabled }) {
  const [draft, setDraft] = useState(color)
  const commit = (value) => {
    const hex = value.length === 4 ? value.replace(/[0-9a-f]/gi, "$&$&") : value
    setDraft(hex)
    if (hex !== color) onChange(hex)
  }

  return (
    <Popover onOpenChange={(open) => { if (open) setDraft(color) }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon-sm" disabled={disabled} aria-labelledby="color-label" className="color-swatch">
          <span style={{ backgroundColor: color }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-labelledby="color-label" className="color-picker">
        <HexColorPicker color={draft} onChange={setDraft} onChangeEnd={commit} />
        <div className="hex-field">
          <Label htmlFor="color-hex">HEX</Label>
          <HexColorInput id="color-hex" color={draft} onChange={commit} spellCheck={false} prefixed />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ThemeControl({ value, onChange, label }) {
  return (
    <div className="theme-control" role="group" aria-label={label}>
      {[["light", "白天", Sun], ["dark", "黑夜", Moon]].map(([theme, name, Icon]) => (
        <Button
          key={theme} type="button" variant="ghost" size="sm"
          aria-pressed={value === theme} onClick={() => onChange(theme)}
        >
          <Icon />{name}
        </Button>
      ))}
    </div>
  )
}

function GeneralSettings({ state, send }) {
  const { alwaysOnTop, sound, colors, opacity, scale, width, height, mainTheme, floatTheme, transparentBackground } = state.preferences
  const change = (name, value) => send("preferences", { [name]: value })
  return (
    <>
      <section className="settings-section" aria-labelledby="appearance-settings-title">
        <h2 id="appearance-settings-title">主界面</h2>
        <div className="settings-surface">
          <div className="setting-row">
            <span>明暗模式</span>
            <ThemeControl label="主界面明暗模式" value={mainTheme} onChange={(value) => change("mainTheme", value)} />
          </div>
          <div className="setting-row">
            <Label htmlFor="sound">插件内发音</Label>
            <Switch id="sound" checked={sound} onCheckedChange={(value) => change("sound", value)} />
          </div>
        </div>
      </section>
      <section className="settings-section" aria-labelledby="window-settings-title">
        <h2 id="window-settings-title">学习小窗</h2>
        <div className="settings-surface">
          <div className="setting-row">
            <Label htmlFor="float-visible">显示小窗</Label>
            <Switch id="float-visible" checked={state.floatVisible} disabled={!state.hasSession || Boolean(state.user?.termsOutdated)} onCheckedChange={() => send("toggleFloat")} />
          </div>
          <div className="setting-row">
            <Label htmlFor="always-on-top">始终置顶</Label>
            <Switch id="always-on-top" checked={alwaysOnTop} onCheckedChange={(value) => change("alwaysOnTop", value)} />
          </div>
          <div className="setting-row">
            <Label id="scale-label">整体缩放</Label>
            <div className="percent-control">
              <Slider aria-labelledby="scale-label" min={60} max={200} step={5} value={[scale]} onValueChange={([value]) => change("scale", value)} />
              <span aria-hidden="true">{scale}%</span>
            </div>
          </div>
          <div className="setting-row">
            <span>明暗模式</span>
            <ThemeControl label="小窗明暗模式" value={floatTheme} onChange={(value) => change("floatTheme", value)} />
          </div>
          <div className="setting-row">
            <Label htmlFor="transparent-background">背景完全透明</Label>
            <Switch id="transparent-background" checked={transparentBackground} onCheckedChange={(value) => change("transparentBackground", value)} />
          </div>
          <div className="setting-row" data-disabled={transparentBackground}>
            <span id="color-label">背景颜色</span>
            <ColorField
              color={colors[floatTheme]} disabled={transparentBackground}
              onChange={(value) => change("colors", { ...colors, [floatTheme]: value })}
            />
          </div>
          <div className="setting-row">
            <Label id="opacity-label">不透明度</Label>
            <div className="percent-control">
              <Slider aria-labelledby="opacity-label" min={35} max={100} value={[opacity]} onValueChange={([value]) => change("opacity", value)} />
              <span aria-hidden="true">{opacity}%</span>
            </div>
          </div>
          <div className="dimension-row">
            <Dimension name="width" label="宽度" value={width} min={304} max={720} onCommit={(value) => change("width", value)} />
            <Dimension name="height" label="高度" value={height} min={234} max={800} onCommit={(value) => change("height", value)} />
          </div>
          <SettingsNotes title="小窗配置说明">
            <p>显示开关随工具栏、小窗和老板键的操作同步。开启始终置顶后，小窗会保持在普通应用窗口上方。</p>
            <p>整体缩放同时调整小窗、文字和控件。宽高以 100% 为基准，窗口尺寸受屏幕可用区域限制。</p>
            <p>主界面与小窗分别保存明暗模式。完全透明时，拖动顶部标志移动小窗。白天模式使用深色文字，黑夜模式使用浅色文字。每种模式各自保存背景颜色，不透明度作用于整个小窗。</p>
          </SettingsNotes>
        </div>
      </section>
    </>
  )
}

const keyRows = Object.entries({ boss: "老板键", ...actions })

function globalBindings(bridge) {
  return Object.fromEntries(keyRows.map(([action]) => [action, bridge.globalKey(action)]))
}

function KeySettings({ state, bridge }) {
  const [recording, setRecording] = useState(null)
  const [message, setMessage] = useState("")
  const [globals, setGlobals] = useState(() => globalBindings(bridge))

  useEffect(() => {
    const onFocus = () => setGlobals(globalBindings(bridge))
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [bridge])

  useEffect(() => {
    if (!recording) return
    const record = (event) => {
      if (event.repeat || event.target.closest("[role=dialog]")) return
      const key = combo(event)
      if (!key) return
      event.preventDefault()
      event.stopPropagation()
      if (event.key === "Escape" || bridge.setKey({ code: recording, key: event.key === "Backspace" ? "" : key })) {
        setRecording(null)
        setMessage("")
      } else {
        setMessage("此按键已绑定其他操作。")
      }
    }
    document.addEventListener("keydown", record, true)
    return () => document.removeEventListener("keydown", record, true)
  }, [bridge, recording])

  return (
    <div className="settings-surface">
      <table className="key-table">
        <thead><tr><th scope="col">操作</th><th scope="col">窗口内</th><th scope="col">全局</th></tr></thead>
        <tbody>
          {keyRows.map(([action, label]) => {
            const local = keyLabel(state.preferences.keys[action])
            const global = globals[action]
            const active = recording === action
            return (
              <tr key={action}>
                <th scope="row">{label}</th>
                <td>
                  {action !== "boss" && (
                    <Button
                      type="button" variant={active ? "secondary" : "ghost"} size="sm" aria-pressed={active}
                      aria-label={`${label}的窗口内快捷键${active ? "，录制中…" : local ? ` ${local}` : ""}`}
                      onClick={() => {
                        setRecording(active ? null : action)
                        setMessage("")
                      }}
                    >
                      {active ? "录制中…" : local ? <Kbd>{local}</Kbd> : <Plus />}
                    </Button>
                  )}
                </td>
                <td>
                  <Button
                    type="button" variant="ghost" size="sm"
                    aria-label={global ? `${label}的全局快捷键 ${global}` : `设置${label}的全局快捷键`}
                    onClick={() => bridge.action("globalKey", action)}
                  >
                    {global ? <Kbd>{global}</Kbd> : action === "boss" ? "设置" : <Plus />}
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Notice message={message} />
      <div className="keys-footer">
        <SettingsNotes title="快捷键配置说明">
          <p>窗口内快捷键在主界面或小窗有焦点时生效。全局快捷键由 uTools 管理，其中学习操作在小窗显示时生效。</p>
        </SettingsNotes>
        <Button type="button" size="sm" variant="ghost" onClick={() => {
          setRecording(null)
          setMessage("")
          bridge.action("resetKeys")
        }}><RotateCcw />恢复默认</Button>
      </div>
    </div>
  )
}

export function Settings({ state, bridge, headingRef }) {
  return (
    <section className="settings-pane" id="settings" aria-labelledby="settings-title">
      <div className="pane-heading">
        <h1 id="settings-title" ref={headingRef} tabIndex={-1}>设置</h1>
        <HelpDialog />
      </div>
      <Notice message={state.settingsNotice} />
      <Tabs defaultValue="general" className="settings-tabs">
        <TabsList variant="line" aria-label="设置分类">
          <TabsTrigger value="general">通用</TabsTrigger>
          <TabsTrigger value="keys">快捷键</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralSettings state={state} send={bridge.action} /></TabsContent>
        <TabsContent value="keys"><KeySettings state={state} bridge={bridge} /></TabsContent>
      </Tabs>
    </section>
  )
}
