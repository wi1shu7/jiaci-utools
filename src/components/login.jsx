import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Notice } from "@/components/controls"
import { HelpDialog } from "@/components/help-dialog"

function Policies({ host, send }) {
  return (
    <div className="policies">
      <Button type="button" variant="ghost" size="sm" onClick={() => send("openTerms", { host, type: "terms" })}>服务条款</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => send("openTerms", { host, type: "privacy" })}>隐私政策</Button>
    </div>
  )
}

export function Login({ state, send, hidden }) {
  const [mode, setMode] = useState(state.mode)
  const [host, setHost] = useState(state.host)
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [clock, setClock] = useState(Date.now)
  const { otp, busy, hasSession, user } = state
  const emailMode = mode === "email"

  useEffect(() => {
    if (!hasSession) return
    setApiKey("")
    setCode("")
    if (user?.email) setEmail(user.email)
  }, [hasSession, user?.email])

  useEffect(() => {
    if (hidden || !emailMode || !otp) return
    const tick = () => {
      const now = Date.now()
      setClock(now)
      if (now >= otp.until) clearInterval(timer)
    }
    const timer = setInterval(tick, 1000)
    tick()
    return () => clearInterval(timer)
  }, [hidden, emailMode, otp])

  const sameAddress = otp && host.trim().replace(/\/+$/, "") === otp.host && email.trim() === otp.email
  const remaining = sameAddress ? Math.max(0, Math.ceil((otp.until - clock) / 1000)) : 0

  return (
    <section className="login-pane" aria-labelledby="login-title" hidden={hidden}>
      <div className="pane-heading">
        <h1 id="login-title">登录</h1>
        <HelpDialog login />
      </div>
      <form className="login-form" onSubmit={(event) => {
        event.preventDefault()
        if (!busy) send("login", emailMode ? { host, mode, email, code } : { host, mode, apiKey })
      }}>
        <div className="field">
          <Label htmlFor="host">服务地址</Label>
          <Input id="host" name="host" type="url" autoComplete="url" spellCheck={false} value={host} required onChange={(event) => setHost(event.target.value)} />
        </div>
        <Tabs value={mode} onValueChange={setMode} className="login-tabs">
          <TabsList variant="line" aria-label="登录方式">
            <TabsTrigger value="key">密钥</TabsTrigger>
            <TabsTrigger value="email">邮箱验证码</TabsTrigger>
          </TabsList>
          <TabsContent value="key">
            <div className="field">
              <Label htmlFor="api-key">登录密钥</Label>
              <Input id="api-key" type="password" name="apiKey" autoComplete="off" maxLength={256} value={apiKey} required onChange={(event) => setApiKey(event.target.value)} />
            </div>
          </TabsContent>
          <TabsContent value="email" className="email-fields">
            <div className="field">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" type="email" name="email" autoComplete="email" maxLength={254} value={email} required onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="field">
              <Label htmlFor="code">验证码</Label>
              <div className="otp-row">
                <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} required onChange={(event) => setCode(event.target.value)} />
                <Button
                  type="button" variant="outline" disabled={Boolean(busy || remaining)}
                  onClick={(event) => {
                    const fields = event.currentTarget.form.elements
                    if (fields.host.reportValidity() && fields.email.reportValidity()) send("otp", { host, email })
                  }}
                >
                  {remaining ? `${remaining} 秒后重发` : "发送验证码"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <Button type="submit" size="lg" disabled={Boolean(busy)}>
          {busy === "login" ? "登录中…" : emailMode ? "同意并登录" : "登录"}
        </Button>
        <Notice message={hidden ? "" : state.notice} />
      </form>
      <Policies host={host} send={send} />
    </section>
  )
}

export function Session({ state, send }) {
  const terms = Boolean(state.user?.termsOutdated)
  return (
    <section className="login-pane session-pane" aria-labelledby="session-title">
      <h1 id="session-title">
        {terms ? "确认服务条款" : state.busy ? "正在同步学习进度…" : "无法加载学习队列"}
      </h1>
      {terms && <Policies host={state.host} send={send} />}
      <Notice message={state.notice} />
      <div className="session-actions">
        <Button type="button" disabled={Boolean(state.busy)} onClick={() => send(terms ? "acceptTerms" : "sync")}>
          {terms ? "同意并继续" : "重新连接"}
        </Button>
        <Button type="button" variant="ghost" disabled={Boolean(state.busy)} onClick={() => send("logout")}>退出登录</Button>
      </div>
    </section>
  )
}
