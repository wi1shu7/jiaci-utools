const http = require("node:http");
const https = require("node:https");
const { createHash } = require("node:crypto");
const { clearTimeout, setTimeout } = require("node:timers");

const COOKIE = "aiword_session";
const SESSION_TOKEN = /^[0-9a-f]{64}$/;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizeHost(input) {
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("请输入完整的服务地址，例如 https://jiaci.example.com");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("服务地址须为 HTTP 或 HTTPS 地址");
  }
  return url.origin + url.pathname.replace(/\/+$/, "");
}

function localToday() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function readSession(headers, protocol) {
  const cookie = headers["set-cookie"]?.find((value) => value.startsWith(`${COOKIE}=`));
  if (!cookie) return undefined;
  const [pair, ...attributes] = cookie.split(";");
  if (protocol !== "https:" && attributes.some((part) => part.trim().toLowerCase() === "secure")) return undefined;
  const token = pair.slice(COOKIE.length + 1);
  const maxAge = attributes.find((part) => /^\s*max-age=/i.test(part))?.split("=")[1];
  const expires = attributes.find((part) => /^\s*expires=/i.test(part))?.split("=")[1];
  const expiresAt = maxAge !== undefined ? Date.now() + Number(maxAge) * 1000 : Date.parse(expires);
  if (!SESSION_TOKEN.test(token) || (Number.isFinite(expiresAt) && expiresAt <= Date.now())) return null;
  return { token, expiresAt: Number.isFinite(expiresAt) ? expiresAt : null };
}

function send(url, headers, method, body) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(url, { method, headers }, (res) => {
      const chunks = [];
      let length = 0;
      res.on("data", (chunk) => {
        length += chunk.length;
        if (length > MAX_RESPONSE_BYTES) {
          res.destroy(new ApiError(0, "服务返回的数据过大", "response_too_large"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    const timeout = setTimeout(() => req.destroy(new ApiError(0, "连接加词服务超时", "timeout")), 40_000);
    req.once("close", () => clearTimeout(timeout));
    req.on("error", reject);
    req.end(body);
  });
}

class JiaciApi {
  constructor(host, session = null, onSession = () => {}) {
    this.host = normalizeHost(host);
    this.session = SESSION_TOKEN.test(session?.token ?? "") && (!session.expiresAt || session.expiresAt > Date.now()) ? session : null;
    this.onSession = onSession;
  }

  async request(route, { method = "GET", json, auth = true, signIn = false, audio = false } = {}) {
    if (!route.startsWith("/api/")) throw new Error("无效的加词接口");
    const url = new URL(this.host + route);
    const headers = { Accept: audio ? "audio/mpeg" : "application/json" };
    const previous = this.session?.token;
    if (auth && previous) headers.Cookie = `${COOKIE}=${previous}`;
    const body = json === undefined ? undefined : Buffer.from(JSON.stringify(json));
    if (body) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = body.length;
    }

    let res;
    try {
      res = await send(url, headers, method, body);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, "连接加词服务失败，请检查地址、网络或 HTTPS 证书", "network");
    }
    if (res.status >= 300 && res.status < 400) {
      throw new ApiError(res.status, "服务地址发生跳转，请填写跳转后的部署地址", "redirect");
    }
    if (audio && res.status < 300) {
      if (!res.body.length || !/^audio\//i.test(res.headers["content-type"] ?? "")) {
        throw new ApiError(res.status, "服务没有返回发音音频", "no_audio");
      }
      return res.body;
    }

    let data;
    try {
      data = JSON.parse(res.body.toString("utf8"));
    } catch {
      if (res.status < 300) throw new ApiError(res.status, "服务返回的内容无法识别，请检查加词地址", "bad_response");
    }
    if (res.status >= 400) {
      const message = res.status === 404 && (signIn || !auth) ? "该接口不可用，请检查服务地址与服务端登录方式" : `请求失败（${res.status}）`;
      throw new ApiError(res.status, data?.error?.message ?? message, data?.error?.code);
    }

    const updated = auth || signIn ? readSession(res.headers, url.protocol) : undefined;
    if (updated !== undefined && previous === this.session?.token && (
      updated?.token !== this.session?.token || updated?.expiresAt !== this.session?.expiresAt
    )) {
      this.session = updated;
      this.onSession(updated);
    }
    return data;
  }

  async sound(kind, text, voice) {
    const segment = kind === "sentence"
      ? createHash("sha1").update(text.trim().replace(/\s+/g, " ")).digest("hex")
      : encodeURIComponent(text.toLowerCase().trim().replace(/\s+/g, "_"));
    return this.request(`/api/audio/${kind === "sentence" ? "sent" : "word"}/${encodeURIComponent(voice)}/${segment}.mp3`, { audio: true });
  }
}

module.exports = { ApiError, JiaciApi, localToday, normalizeHost };
