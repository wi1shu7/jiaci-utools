import { useLayoutEffect, useRef } from "react"
import { ChevronDown, RefreshCw, Sparkles, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Kbd } from "@/components/ui/kbd"
import { AiBadge, IconButton, Notice } from "@/components/controls"
import { WordDetails } from "@/components/word-details"
import { actions, keyLabel } from "@/lib/jiaci"

const ratings = ["know", "fuzzy", "master", "reset"]
const providerNames = { openai: "OpenAI", deepseek: "DeepSeek" }

function EmptyCard({ state, send, compact }) {
  const terms = state.user?.termsOutdated
  let message = "今天的单词学完了"
  if (terms) message = "请在主界面确认服务条款"
  else if (!state.loaded) message = state.busy ? "正在加载词卡…" : "队列尚未加载"
  else if (!state.bookId) {
    message = compact ? "请在主界面选择词库" : state.books.length ? "请选择词库" : "暂无词库"
  }

  return (
    <div className="card-empty">
      <h2>{message}</h2>
      {compact && state.hasSession && !state.busy && !terms && (
        <Button type="button" variant="outline" size="sm" onClick={() => send("sync")}><RefreshCw />刷新队列</Button>
      )}
    </div>
  )
}

export function StudyCard({ state, send, compact = false }) {
  const { answered, busy, detail, detailError, detailLoading, detailsOpen, generating, item, preferences } = state
  const { sound, keys } = preferences
  const ready = Boolean(item && !state.user?.termsOutdated)
  const showDetails = Boolean(detailsOpen && detail)
  const scroll = useRef(null)
  const heading = useRef(null)
  const detailButton = useRef(null)
  const previouslyOpen = useRef(false)

  useLayoutEffect(() => {
    if (!answered) scroll.current?.scrollTo({ top: 0 })
  }, [item?.wordId, answered])

  useLayoutEffect(() => {
    if (!compact || !scroll.current) return
    if (showDetails && detailButton.current) {
      detailButton.current.scrollIntoView({ block: "start" })
    } else if (previouslyOpen.current && !detailsOpen) {
      scroll.current.scrollTop = 0
    }
    previouslyOpen.current = showDetails
  }, [compact, showDetails, detailsOpen, item?.wordId])

  const focusWord = (action) => {
    heading.current?.focus({ preventScroll: true })
    send(action)
  }
  const shortcut = (action) => keys[action] && <Kbd aria-hidden="true">{keyLabel(keys[action])}</Kbd>
  const display = detail?.display || item?.display || item?.spelling
  const view = detail?.view
  const phoneticSource = view?.phonetic ? view : item
  const phonetic = phoneticSource?.phonetic?.[state.accent]
  const provider = view?.provider
  const generationTitle = [provider && `资料来源 ${providerNames[provider] ?? provider}`, keyLabel(keys.generate)].filter(Boolean).join(" · ")

  return (
    <section className="study-card" aria-label="词卡">
      {ready ? (
        <div className="card-scroll" ref={scroll}>
          <article className="card-content">
            <h2 className="word" ref={heading} tabIndex={-1} lang="en" aria-live="polite">{display}</h2>
            {(phonetic || sound) && (
              <div className="word-meta">
                {phonetic && <span>{phonetic}</span>}
                {phonetic && phoneticSource.phoneticFromAi === true && <AiBadge />}
                {sound && (
                  <>
                    <IconButton label="朗读单词" title={keyLabel(keys.speak) || "朗读单词"} onClick={() => send("speak")}><Volume2 /></IconButton>
                    {shortcut("speak")}
                  </>
                )}
              </div>
            )}
            {answered ? (
              <Collapsible open={detailsOpen} onOpenChange={() => send("details")}>
                <p className="definition" role="status">
                  {view?.core && view.coreFromAi === true && <AiBadge />}
                  {detail ? view.core || "暂无释义" : detailError || "正在加载释义…"}
                </p>
                <div className="answer-tools">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" ref={detailButton} disabled={Boolean(busy)} title={keyLabel(keys.details) || undefined}>
                      <ChevronDown className={detailsOpen ? "rotate-180" : undefined} />
                      {detailsOpen ? "收起资料" : actions.details}
                      {shortcut("details")}
                    </Button>
                  </CollapsibleTrigger>
                  {(generating || detail?.aiGenerate) && (
                    <Button
                      type="button" variant="ghost" size="sm" disabled={Boolean(generating || busy)}
                      title={generationTitle || undefined}
                      onClick={() => {
                        heading.current?.focus({ preventScroll: true })
                        send("generate")
                      }}
                    >
                      <Sparkles />
                      {generating ? "AI 生成中…" : provider ? "重新解析" : actions.generate}
                      {shortcut("generate")}
                    </Button>
                  )}
                  <Button
                    type="button" variant="ghost" size={compact ? "icon-sm" : "sm"}
                    aria-label="刷新词条" title="刷新词条" aria-busy={detailLoading}
                    disabled={Boolean(busy || detailLoading)} onClick={() => send("refreshDetail")}
                  >
                    <RefreshCw className={detailLoading ? "motion-safe:animate-spin" : undefined} />
                    {!compact && "刷新词条"}
                  </Button>
                </div>
                {detail && detailError && <p className="mt-1 text-xs text-muted-foreground" role="status">{detailError}</p>}
                <CollapsibleContent className="word-details">
                  {detail && <WordDetails detail={detail} sound={sound} speakerSide={state.settings?.exSpeaker} speak={(sentence) => send("speak", sentence)} />}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <div className="reveal">
                <Button type="button" size="sm" disabled={Boolean(busy)} title={keyLabel(keys.answer) || undefined} onClick={() => focusWord("answer")}>
                  {actions.answer}
                  {shortcut("answer")}
                </Button>
              </div>
            )}
          </article>
        </div>
      ) : <EmptyCard state={state} send={send} compact={compact} />}
      <Notice message={state.notice} />
      {ready && answered && (
        <div className="rating-bar" role="group" aria-label="标记学习结果">
          <div className="ratings">
            {ratings.map((action) => (
              <Button
                type="button" key={action} variant="outline" size="sm" data-rating={action}
                disabled={Boolean(busy || (state.ratingRetry && state.ratingRetry !== action))}
                title={keyLabel(keys[action]) || undefined}
                onClick={() => focusWord(action)}
              >
                {actions[action]}
                {shortcut(action)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
