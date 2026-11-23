import { useEffect, useRef, useState } from "react"
import { ArrowDownUp, ChevronLeft, ChevronRight, RefreshCw, Search, Volume2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { AiBadge, IconButton, Notice } from "@/components/controls"
import { WordDetails } from "@/components/word-details"

const PAGE_SIZE = 50
const statuses = { all: "全部", new: "未开始", learning: "学习中", mastered: "已掌握", none: "未加入" }
const sorts = { order: "添加顺序", alpha: "字母", freq: "词频", due: "下次复习时间" }

function WordStatus({ status }) {
  return <span className="word-status" data-status={status}>{statuses[status]}</span>
}

function BookWordDialog({ bookId, word, state, send, restoreFocus }) {
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)
  const detail = result?.detail
  const view = detail?.view
  const phonetic = view?.phonetic?.[state.accent]
  const sound = state.preferences.sound

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const next = await send("bookWord", { bookId, spelling: word.spelling })
        if (!active) return
        setResult({ detail: next })
        send("browseAudio", { spelling: next.spelling, sentence: next.view.examples?.[0]?.en, automatic: true })
      } catch (error) {
        if (active) setResult({ error: error.message })
      }
    }
    void load()
    return () => {
      active = false
      send("stopBrowseAudio")
    }
  }, [bookId, word.spelling, retry, send])

  return (
    <DialogContent
      className="book-word-dialog" showCloseButton={false} aria-describedby={undefined}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        restoreFocus()
      }}
    >
      <header className="book-word-dialog-header">
        <DialogTitle lang="en">{detail?.display || word.display || word.spelling}</DialogTitle>
        <DialogClose asChild><IconButton label="关闭单词详情"><X /></IconButton></DialogClose>
      </header>
      <div className="book-word-meta">
        <WordStatus status={detail?.status ?? word.status} />
        {phonetic && <span>{phonetic}{view.phoneticFromAi && <AiBadge />}</span>}
        {sound && <IconButton label="朗读单词" onClick={() => send("browseAudio", { spelling: word.spelling })}><Volume2 /></IconButton>}
      </div>
      {!result && <Notice message="正在加载词条…" />}
      {result?.error && (
        <div className="book-word-error">
          <Notice message={result.error} />
          <Button type="button" size="sm" variant="outline" onClick={() => {
            setResult(null)
            setRetry((count) => count + 1)
          }}>重试</Button>
        </div>
      )}
      {view?.core && <p className="definition">{view.coreFromAi && <AiBadge />}{view.core}</p>}
      {detail && (
        <div className="word-details">
          <WordDetails detail={detail} sound={sound} speakerSide={state.settings?.exSpeaker} speak={(sentence) => send("browseAudio", { sentence })} />
        </div>
      )}
    </DialogContent>
  )
}

export function BookWords({ book, state, send, onBack }) {
  const [criteria, setCriteria] = useState({ status: "all", q: "", sort: "order", cursor: 0 })
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState(null)
  const [word, setWord] = useState(null)
  const [startError, setStartError] = useState(false)
  const searchInput = useRef(null)
  const wordTrigger = useRef(null)
  const current = book.id === state.bookId
  const liveResult = result?.criteria === criteria && result.refresh === refresh ? result : null
  const page = liveResult?.page
  const counts = result?.counts
  const change = (patch) => setCriteria((previous) => ({ ...previous, cursor: 0, ...patch }))

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const page = await send("bookWords", { bookId: book.id, ...criteria, q: criteria.q.trim(), limit: PAGE_SIZE })
        if (active) setResult({ criteria, refresh, page, counts: page.counts })
      } catch (error) {
        if (active) setResult((previous) => ({ criteria, refresh, counts: previous?.counts, error: error.message }))
      }
    }
    const timer = window.setTimeout(load, criteria.q ? 180 : 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [book.id, criteria, refresh, send])

  useEffect(() => () => { send("stopBrowseAudio") }, [send])

  return (
    <section className="book-words" aria-labelledby="book-words-title">
      <div className="book-words-inner">
        <header className="book-words-header">
          <div>
            <h2 id="book-words-title">{book.name}</h2>
            <p>{(counts?.all ?? book.wordCount).toLocaleString()} 词{(page?.ownProgress ?? book.ownProgress) && " · 独立进度"}</p>
          </div>
          <Button type="button" size="sm" disabled={Boolean(state.busy)} onClick={async () => {
            setStartError(false)
            if (current || await send("book", book.id)) onBack()
            else setStartError(true)
          }}>{current ? "继续学习" : "设为当前学习"}</Button>
        </header>
        {startError && <Notice message={state.notice || "暂时无法切换词库，请重试。"} />}
        <div className="book-status-filters" role="group" aria-label="学习状态">
          {Object.entries(statuses).map(([key, label]) => (
            <Button type="button" size="sm" variant="ghost" key={key} aria-pressed={criteria.status === key} onClick={() => change({ status: key })}>
              {label}{counts && <span>{counts[key]?.toLocaleString() ?? "0"}</span>}
            </Button>
          ))}
        </div>
        <div className="book-word-tools">
          <label className="book-search">
            <Search aria-hidden="true" />
            <Input
              ref={searchInput} type="search" maxLength={60} className="h-8" aria-label="搜索单词或释义" placeholder="搜索单词或释义"
              value={criteria.q} onChange={(event) => change({ q: event.target.value })}
            />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" aria-label={`排序：${sorts[criteria.sort]}`}><ArrowDownUp />{sorts[criteria.sort]}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={criteria.sort} onValueChange={(sort) => change({ sort })}>
                {Object.entries(sorts).map(([key, label]) => <DropdownMenuRadioItem value={key} key={key}>{label}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton label="刷新词库" onClick={() => setRefresh((count) => count + 1)}><RefreshCw /></IconButton>
        </div>
        {!liveResult && <p className="book-list-message" role="status">正在加载单词…</p>}
        {liveResult?.error && <Notice message={liveResult.error} />}
        {page?.rows.length === 0 && <p className="book-list-message" role="status">没有匹配的单词</p>}
        {Boolean(page?.rows.length) && (
          <ul className="book-word-list" role="list">
            {page.rows.map((row) => (
              <li className="book-word-row" key={row.id}>
                {state.preferences.sound && (
                  <IconButton label={`朗读 ${row.spelling}`} onClick={() => send("browseAudio", { spelling: row.spelling })}><Volume2 /></IconButton>
                )}
                <Button type="button" variant="ghost" className="book-word-link" onClick={(event) => {
                  wordTrigger.current = event.currentTarget
                  setWord(row)
                }}>
                  <span className="book-word-name" lang="en">{row.display || row.spelling}</span>
                  <WordStatus status={row.status} />
                  {row.due && <time dateTime={row.due} title="下次复习">{row.due}</time>}
                  <ChevronRight aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {page && (criteria.cursor > 0 || page.nextCursor !== null) && (
          <footer className="book-word-pager">
            <span>{page.rows.length ? `${criteria.cursor + 1}–${criteria.cursor + page.rows.length} / ` : ""}{page.total.toLocaleString()} 词</span>
            <IconButton label="上一页" disabled={criteria.cursor === 0} onClick={() => change({ cursor: Math.max(0, criteria.cursor - PAGE_SIZE) })}><ChevronLeft /></IconButton>
            <IconButton label="下一页" disabled={page.nextCursor === null} onClick={() => change({ cursor: page.nextCursor })}><ChevronRight /></IconButton>
          </footer>
        )}
      </div>
      <Dialog open={Boolean(word)} onOpenChange={(open) => { if (!open) setWord(null) }}>
        {word && (
          <BookWordDialog bookId={book.id} word={word} state={state} send={send} restoreFocus={() => {
            if (wordTrigger.current?.isConnected) wordTrigger.current.focus()
            else searchInput.current?.focus()
          }} />
        )}
      </Dialog>
    </section>
  )
}
