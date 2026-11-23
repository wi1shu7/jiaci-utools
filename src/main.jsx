import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowLeft, BookOpen, LogOut, PanelLeftClose, PanelLeftOpen, PictureInPicture2, RefreshCw, Settings2, UserRound, X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { BookLibrary } from "@/components/book-library"
import { IconButton } from "@/components/controls"
import { Login, Session } from "@/components/login"
import { Settings } from "@/components/settings"
import { StudyCard } from "@/components/study-card"
import { useStudyShortcuts, useWindowTheme } from "@/lib/jiaci"

function Toolbar({ state, board, sidebar, bookName, settingsOpen, setSettingsOpen, send }) {
  const studying = board && !settingsOpen
  const { done, total, busy, floatVisible } = state
  const settingsLabel = settingsOpen ? state.hasSession ? "返回学习" : "返回登录" : "设置"
  return (
    <header className="toolbar">
      <div className="toolbar-leading">
        {studying ? (
          <>
            {sidebar}
            <h1 className="toolbar-title" title={bookName}>{bookName}</h1>
          </>
        ) : <div className="wordmark"><BookOpen aria-hidden="true" />AI 加词</div>}
      </div>
      <nav aria-label="插件功能">
        {studying && (
          <>
            <div className="study-progress">
              <Progress
                className="progress-track"
                aria-label="本轮进度"
                getValueLabel={() => `${done} / ${total}`}
                value={total ? done / total * 100 : 0}
              />
              <span aria-hidden="true">{done} / {total}</span>
            </div>
            <IconButton label="刷新队列" disabled={Boolean(busy)} onClick={() => send("sync")}><RefreshCw /></IconButton>
          </>
        )}
        {state.hasSession && !state.user?.termsOutdated && (
          <IconButton
            label={floatVisible ? "隐藏小窗" : "显示小窗"}
            data-active={floatVisible}
            onClick={() => send("toggleFloat")}
          ><PictureInPicture2 /></IconButton>
        )}
        <IconButton
          label={settingsLabel}
          aria-expanded={settingsOpen}
          aria-controls={settingsOpen ? "settings" : undefined}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          {settingsOpen ? <ArrowLeft /> : <Settings2 />}
        </IconButton>
        {board && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <IconButton label="账户"><UserRound /></IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="account-menu">
              <DropdownMenuLabel className="account-email">{state.user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={Boolean(state.busy)} onSelect={() => send("logout")}>
                <LogOut />退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>
    </header>
  )
}

const narrowLayout = window.matchMedia("(max-width: 620px)")

export function MainWindow({ state, bridge }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scope, setScope] = useState("personal")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [narrow, setNarrow] = useState(() => narrowLayout.matches)
  const settingsHeading = useRef(null)
  const board = Boolean(state.hasSession && state.user && !state.user.termsOutdated && state.loaded)
  const { sidebarCollapsed } = state.preferences
  const bookName = state.books.find(({ id }) => id === state.bookId)?.name ?? "学习"
  const send = bridge.action
  const library = {
    state, scope, setScope,
    onSelect(bookId) {
      setDrawerOpen(false)
      send("book", bookId)
    },
  }
  useWindowTheme(state.preferences.mainTheme)
  useStudyShortcuts(state.preferences.keys, send, board && !settingsOpen)

  useEffect(() => {
    const update = ({ matches }) => {
      setNarrow(matches)
      setDrawerOpen(false)
    }
    narrowLayout.addEventListener("change", update)
    return () => narrowLayout.removeEventListener("change", update)
  }, [])

  useLayoutEffect(() => {
    if (settingsOpen) settingsHeading.current?.focus({ preventScroll: true })
  }, [settingsOpen])

  const sidebar = narrow ? (
    <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
      <DialogTrigger asChild>
        <IconButton label="展开词库侧栏"><PanelLeftOpen /></IconButton>
      </DialogTrigger>
      <DialogContent className="library-drawer" showCloseButton={false} aria-describedby={undefined}>
        <header>
          <DialogTitle>词库</DialogTitle>
          <DialogClose asChild><IconButton label="收起词库侧栏"><X /></IconButton></DialogClose>
        </header>
        <BookLibrary {...library} />
      </DialogContent>
    </Dialog>
  ) : (
    <IconButton
      label={sidebarCollapsed ? "展开词库侧栏" : "收起词库侧栏"}
      aria-expanded={!sidebarCollapsed}
      aria-controls="library"
      onClick={() => send("preferences", { sidebarCollapsed: !sidebarCollapsed })}
    >{sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</IconButton>
  )

  return (
    <div className="app-shell">
      <Toolbar {...{ state, board, sidebar, bookName, settingsOpen, setSettingsOpen, send }} />
      <main className="app-main">
        <Login state={state} send={send} hidden={state.hasSession || settingsOpen} />
        {board && (
          <section className="board" aria-label="学习" hidden={settingsOpen}>
            {!narrow && (
              <aside id="library" className="library-pane" aria-label="词库" hidden={sidebarCollapsed}>
                <BookLibrary {...library} />
              </aside>
            )}
            <StudyCard state={state} send={send} />
          </section>
        )}
        {!settingsOpen && state.hasSession && !board && <Session state={state} send={send} />}
        {settingsOpen && <Settings state={state} bridge={bridge} headingRef={settingsHeading} />}
      </main>
    </div>
  )
}
