import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowLeft, BookOpen, LogOut, PanelLeftClose, PanelLeftOpen, PictureInPicture2, RefreshCw, Settings2, UserRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { BookLibrary } from "@/components/book-library"
import { BookWords } from "@/components/book-words"
import { IconButton } from "@/components/controls"
import { Login, Session } from "@/components/login"
import { Settings } from "@/components/settings"
import { StudyCard } from "@/components/study-card"
import { useStudyShortcuts, useWindowTheme } from "@/lib/jiaci"

function Toolbar({ state, board, sidebar, book, browsing, openBook, closeBook, settingsOpen, setSettingsOpen, send }) {
  const boardOpen = board && !settingsOpen
  const { done, total, busy, floatVisible } = state
  const settingsLabel = settingsOpen ? state.hasSession ? "关闭设置" : "返回登录" : "设置"
  return (
    <header className="toolbar">
      <div className="toolbar-leading">
        {boardOpen ? (
          <>
            {sidebar}
            {browsing ? (
              <Button type="button" variant="ghost" size="sm" onClick={closeBook}><ArrowLeft />返回学习</Button>
            ) : book ? (
              <h1 className="toolbar-title">
                <Button type="button" variant="ghost" size="sm" title={`查看词库 · ${book.name}`} onClick={() => openBook(book.id)}>
                  <BookOpen /><span>{book.name}</span>
                </Button>
              </h1>
            ) : <h1 className="toolbar-title">学习</h1>}
          </>
        ) : <div className="wordmark"><BookOpen aria-hidden="true" />AI 加词</div>}
      </div>
      <nav aria-label="插件功能">
        {boardOpen && !browsing && (
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
  const [browsingId, setBrowsingId] = useState(null)
  const [scope, setScope] = useState("personal")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [narrow, setNarrow] = useState(() => narrowLayout.matches)
  const settingsHeading = useRef(null)
  const board = Boolean(state.hasSession && state.user && !state.user.termsOutdated && state.loaded)
  const { sidebarCollapsed } = state.preferences
  const book = state.books.find(({ id }) => id === state.bookId)
  const browsingBook = state.books.find(({ id }) => id === browsingId)
  const studying = board && !settingsOpen && !browsingBook
  const send = bridge.action
  const openBook = (bookId) => {
    setDrawerOpen(false)
    setBrowsingId(bookId)
  }
  const closeBook = () => setBrowsingId(null)
  const library = {
    state, scope, setScope,
    selectedBookId: browsingBook?.id ?? state.bookId,
    onSelect: openBook,
  }
  useWindowTheme(state.preferences.mainTheme)
  useStudyShortcuts(state.preferences.keys, send, studying)

  useLayoutEffect(() => {
    send("studyVisible", studying)
    return () => { send("studyVisible", false) }
  }, [send, studying])

  useEffect(() => {
    const update = ({ matches }) => {
      setNarrow(matches)
      setDrawerOpen(false)
    }
    narrowLayout.addEventListener("change", update)
    return () => narrowLayout.removeEventListener("change", update)
  }, [])

  useLayoutEffect(() => {
    if (settingsOpen) {
      send("stopBrowseAudio")
      settingsHeading.current?.focus({ preventScroll: true })
    }
  }, [send, settingsOpen])

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
      <Toolbar {...{ state, board, sidebar, book, browsing: Boolean(browsingBook), openBook, closeBook, settingsOpen, setSettingsOpen, send }} />
      <main className="app-main">
        <Login state={state} send={send} hidden={state.hasSession || settingsOpen} />
        {board && (
          <section className="board" aria-label={browsingBook ? "词库" : "学习"} hidden={settingsOpen}>
            {!narrow && (
              <aside id="library" className="library-pane" aria-label="词库" hidden={sidebarCollapsed}>
                <BookLibrary {...library} />
              </aside>
            )}
            {browsingBook ? <BookWords key={browsingBook.id} book={browsingBook} state={state} send={send} onBack={closeBook} /> : <StudyCard state={state} send={send} />}
          </section>
        )}
        {!settingsOpen && state.hasSession && !board && <Session state={state} send={send} />}
        {settingsOpen && <Settings state={state} bridge={bridge} headingRef={settingsHeading} />}
      </main>
    </div>
  )
}
