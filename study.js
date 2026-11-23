const { randomUUID } = require("node:crypto");
const { clearTimeout, setTimeout } = require("node:timers");
const { JiaciApi, localToday } = require("./api");

const RATINGS = { know: "认识", fuzzy: "模糊", master: "已掌握", reset: "重新记" };
const POLL_MS = 3_000;
const POLL_LIMIT_MS = 15 * 60_000;

function rateMessage(result, response) {
  if (response.skipped === "stale") return "其他设备已有较新的评分，本次未改变复习安排";
  if (response.skipped === "removed") return "该词已移出学习";
  if (response.skipped === "mastered") return "该词已掌握";
  if (result === "master" || response.nextInterval === -1) return "已标记为已掌握";
  if (result === "reset") return "已加入重新记";
  if (response.requeueToday) return "今日稍后再次出现";
  return `下次复习在 ${response.nextInterval} 天后`;
}

class Study {
  constructor(saved, publish, save) {
    this.publish = publish;
    this.save = save;
    this.host = saved.host ?? "";
    this.mode = saved.mode === "email" ? "email" : "key";
    this.checkpoint = saved.checkpoint;
    this.api = null;
    this.user = null;
    this.books = [];
    this.jobs = new Map();
    this.otp = null;
    this.busy = "";
    this.notice = "";
    this.clearQueue();
    if (this.host && saved.session) {
      try {
        const api = this.client(this.host, saved.session);
        if (api.session) this.api = api;
        else this.save({ session: null });
      } catch {
        this.save({ session: null });
      }
    }
  }

  client(host, session) {
    const api = new JiaciApi(host, session, (updated) => {
      if (this.api === api) this.save({ session: updated });
    });
    return api;
  }

  get item() {
    return this.items[0] ?? null;
  }

  snapshot() {
    const job = this.jobs.get(this.item?.spelling);
    return {
      host: this.host, mode: this.mode, hasSession: Boolean(this.api?.session),
      user: this.user && { email: this.user.email, termsOutdated: this.user.termsOutdated },
      accent: this.user?.settings?.accent === "uk" ? "uk" : "us",
      books: this.books, bookId: this.bookId, loaded: this.loaded, date: this.date,
      item: this.item, total: this.total, done: this.done,
      answered: this.answered, detailsOpen: this.detailsOpen, detail: this.detail,
      detailError: this.detailError, detailLoading: Boolean(this.detailTask),
      generating: Boolean(job), ratingRetry: this.pendingRate?.result ?? null,
      otp: this.otp, busy: this.busy, notice: this.notice,
    };
  }

  clearCard() {
    this.answered = false;
    this.detailsOpen = false;
    this.detail = null;
    this.detailError = "";
    this.detailTask = null;
    this.pendingRate = null;
  }

  clearQueue() {
    this.items = [];
    this.bookId = null;
    this.date = "";
    this.localDay = "";
    this.loaded = false;
    this.total = 0;
    this.done = 0;
    this.clearCard();
  }

  clearSession(notice) {
    this.api = null;
    this.user = null;
    this.books = [];
    this.voices = null;
    this.checkpoint = null;
    this.otp = null;
    for (const job of this.jobs.values()) clearTimeout(job.timer);
    this.jobs.clear();
    this.clearQueue();
    this.save({ session: null, checkpoint: null });
    this.notice = notice;
  }

  async run(busy, operation) {
    if (this.busy) return;
    this.notice = "";
    this.busy = busy;
    this.publish();
    try {
      await operation();
    } catch (error) {
      this.notice = error.message;
      if (error.status === 401 && this.api && busy !== "login") {
        this.clearSession("登录已过期，请重新登录");
      }
    } finally {
      this.busy = "";
      this.publish();
    }
  }

  async sendCode({ host, email }) {
    await this.run("otp", async () => {
      const api = this.client(host);
      const result = await api.request("/api/auth/request-otp", {
        method: "POST", json: { email: email.trim() }, auth: false,
      });
      this.otp = { host: api.host, email: email.trim(), until: Date.now() + (result.resendSeconds ?? 60) * 1000 };
      this.notice = result.devCode ? `开发环境验证码 ${result.devCode}` : "验证码已发送，请查收邮件";
    });
  }

  async signIn({ host, mode, email, code, apiKey }) {
    if (this.api || !["email", "key"].includes(mode)) return;
    await this.run("login", async () => {
      const api = this.client(host);
      const isEmail = mode === "email";
      await api.request(isEmail ? "/api/auth/verify" : "/api/auth/api-key-login", {
        method: "POST", json: isEmail ? { email: email.trim(), code: code.trim() } : { apiKey: apiKey.trim() },
        auth: false, signIn: true,
      });
      if (!api.session) throw new Error("服务未返回登录会话，请检查反向代理的 Cookie 配置");
      this.user = await api.request("/api/me");
      this.api = api;
      this.host = api.host;
      this.mode = mode;
      this.otp = null;
      this.save({ host: this.host, mode, session: api.session });
      if (!this.user.termsOutdated) await this.loadQueue();
    });
  }

  async sync() {
    if (!this.api) return;
    await this.run("sync", async () => {
      const api = this.api;
      const user = await api.request("/api/me");
      if (api !== this.api) return;
      this.user = user;
      if (!this.user.termsOutdated) await this.loadQueue();
    });
  }

  async acceptTerms() {
    if (!this.api || !this.user?.termsOutdated) return;
    await this.run("terms", async () => {
      const api = this.api;
      await api.request("/api/account/accept-terms", { method: "POST" });
      if (api !== this.api) return;
      this.user = { ...this.user, termsOutdated: false };
      await this.loadQueue();
    });
  }

  async logout() {
    if (!this.api) return;
    await this.run("logout", async () => {
      const api = this.api;
      this.clearSession("");
      this.publish();
      try {
        await api.request("/api/auth/logout", { method: "POST" });
      } catch {
        this.notice = "本机已退出，未能连接服务撤销会话";
      }
    });
  }

  async switchBook(bookId) {
    if (!this.user || this.user.termsOutdated || bookId === this.bookId || !this.books.some((book) => book.id === bookId)) return;
    await this.run("book", async () => {
      const api = this.api;
      await api.request("/api/wordbooks/current", { method: "PUT", json: { wordbookId: bookId } });
      if (api !== this.api) return;
      this.clearQueue();
      this.rememberCard();
      await this.loadQueue();
    });
  }

  async loadQueue() {
    const api = this.api;
    const localDay = localToday();
    const [books, queue] = await Promise.all([
      api.request("/api/wordbooks"),
      api.request(`/api/study/today?date=${localDay}`),
    ]);
    if (api !== this.api) return;
    const savedCard = this.checkpoint;
    this.clearQueue();
    this.books = books.wordbooks;
    this.bookId = queue.bookId;
    this.date = queue.today;
    this.localDay = localDay;
    this.items = queue.items;
    this.total = queue.items.length;
    this.loaded = true;
    if (savedCard && savedCard.date === this.date && savedCard.bookId === this.bookId) {
      const index = this.items.findIndex((item) => item.wordId === savedCard.wordId);
      if (index >= 0) {
        this.items.unshift(...this.items.splice(index, 1));
        this.answered = Boolean(savedCard.answered);
        this.detailsOpen = Boolean(savedCard.detailsOpen && this.answered);
      }
    }
    this.rememberCard();
    if (this.answered) void this.loadDetail();
  }

  rememberCard() {
    this.checkpoint = this.item ? {
      date: this.date, bookId: this.bookId, wordId: this.item.wordId,
      answered: this.answered, detailsOpen: this.detailsOpen,
    } : null;
    this.save({ checkpoint: this.checkpoint });
  }

  canStudy() {
    if (!this.item || !this.api || !this.user || this.user.termsOutdated || this.busy) return false;
    if (localToday() === this.localDay) return true;
    void this.sync();
    return false;
  }

  async reveal(showDetails = false) {
    if (!this.canStudy()) return;
    if (!this.answered || showDetails) {
      this.detailsOpen = showDetails ? !this.detailsOpen : false;
      this.answered = true;
      this.rememberCard();
      this.publish();
    }
    return this.loadDetail();
  }

  refreshDetail() {
    if (this.answered && !this.busy && !this.detailTask && !this.user?.termsOutdated) {
      return this.loadDetail({ refresh: true });
    }
  }

  loadDetail({ refresh = false } = {}) {
    if (!refresh) {
      if (this.detailTask) return this.detailTask;
      if (this.detail) return Promise.resolve(this.detail);
    }
    const item = this.item;
    const api = this.api;
    if (!item || !api) return Promise.resolve(null);
    const search = new URLSearchParams({ date: this.date });
    if (this.bookId) search.set("book", this.bookId);
    const task = api.request(`/api/words/${encodeURIComponent(item.spelling)}?${search}`)
      .then((detail) => {
        if (this.detailTask !== task || api !== this.api || this.item !== item) return null;
        this.detail = detail;
        const requestId = detail.aiGenerate?.requestId;
        if (detail.aiGenerate?.running && requestId && !this.jobs.has(item.spelling)) {
          this.watch(api, item.spelling, { requestId, startedAt: Date.now() });
        }
        return detail;
      })
      .catch((error) => {
        if (this.detailTask === task && api === this.api && this.item === item) {
          if (error.status === 401) this.clearSession("登录已过期，请重新登录");
          else this.detailError = error.message;
        }
        return null;
      })
      .finally(() => {
        if (this.detailTask === task) this.detailTask = null;
        this.publish();
      });
    this.detailError = "";
    this.detailTask = task;
    this.publish();
    return task;
  }

  async rate(result) {
    if (!Object.hasOwn(RATINGS, result) || !this.answered || !this.canStudy()) return;
    if (this.pendingRate && this.pendingRate.result !== result) {
      this.notice = `请先重试「${RATINGS[this.pendingRate.result]}」或刷新队列`;
      this.publish();
      return;
    }
    const item = this.item;
    const payload = this.pendingRate ?? {
      wordId: item.wordId, result, clientTs: `${randomUUID()}-${Date.now()}`,
      date: this.date, wordbookId: this.bookId ?? undefined, source: "study",
    };
    await this.run("rate", async () => {
      const api = this.api;
      this.pendingRate = payload;
      try {
        const response = await api.request("/api/study/rate", { method: "POST", json: payload });
        if (api !== this.api) return;
        this.items.shift();
        if (response.requeueToday) this.items.push({ ...item, kind: result === "reset" ? "new" : item.kind });
        else this.done += 1;
        this.clearCard();
        this.rememberCard();
        this.notice = rateMessage(result, response);
      } catch (error) {
        if (error.status >= 400 && error.status < 500) this.pendingRate = null;
        throw error;
      }
    });
  }

  async generate() {
    if (!this.canStudy()) return;
    const { item, api } = this;
    const detail = await this.reveal();
    if (!detail || this.item !== item || api !== this.api || this.jobs.has(item.spelling)) return;
    if (!detail.aiGenerate) {
      this.notice = "服务端暂未开放该词的 AI 生成";
      this.publish();
      return;
    }
    const job = { requestId: null, startedAt: Date.now() };
    this.jobs.set(item.spelling, job);
    this.notice = "";
    this.publish();
    try {
      const response = await api.request(`/api/words/${encodeURIComponent(item.spelling)}/generate`, {
        method: "POST", json: detail.view.provider ? { regenerate: detail.aiGenerate.provider } : {},
      });
      if (api !== this.api) return;
      job.requestId = response.requestId;
      this.notice = response.started ? `已提交，24 小时内还可生成 ${response.remaining} 次` : "正在生成这份资料";
      this.watch(api, item.spelling, job);
    } catch (error) {
      if (api !== this.api) return;
      this.jobs.delete(item.spelling);
      if (error.status === 401) this.clearSession("登录已过期，请重新登录");
      else {
        this.notice = error.message;
        if (this.item === item && ["exists", "missing"].includes(error.code)) {
          void this.loadDetail({ refresh: true });
        }
      }
    }
    this.publish();
  }

  watch(api, spelling, job) {
    this.jobs.set(spelling, job);
    const active = () => this.api === api && this.jobs.get(spelling) === job;
    const tick = async () => {
      if (!active()) return;
      let response;
      try {
        response = await api.request(`/api/words/${encodeURIComponent(spelling)}/generate?requestId=${encodeURIComponent(job.requestId)}`);
      } catch (error) {
        if (!active()) return;
        if (error.status === 401) {
          this.clearSession("登录已过期，请重新登录");
          this.publish();
          return;
        }
        response = error.status && error.status < 500
          ? { status: "failed", error: error.message }
          : { status: "running" };
      }
      if (!active()) return;
      if (response.status === "running" && Date.now() - job.startedAt < POLL_LIMIT_MS) {
        job.timer = setTimeout(tick, POLL_MS);
        return;
      }
      this.jobs.delete(spelling);
      if (response.status === "done") {
        this.notice = `${spelling} 的 AI 资料已更新`;
        if (this.item?.spelling === spelling && this.answered) {
          void this.loadDetail({ refresh: true });
        }
      } else {
        this.notice = response.error || (response.status === "running" ? "仍在生成，请稍后刷新查看" : "AI 资料生成未完成，请重试");
      }
      this.publish();
    };
    job.timer = setTimeout(tick, POLL_MS);
  }

  async pronunciation(kind, text) {
    const api = this.api;
    if (!api || !this.user) return null;
    if (!this.voices) {
      const config = await api.request("/api/config/public", { auth: false });
      if (api !== this.api) return null;
      this.voices = config.ttsVoices ?? {};
    }
    const settings = this.user.settings;
    const voice = this.voices[`${settings?.accent ?? "us"}_${settings?.voice ?? "female"}`];
    return voice ? api.sound(kind, text, voice) : null;
  }
}

module.exports = { RATINGS, Study };
