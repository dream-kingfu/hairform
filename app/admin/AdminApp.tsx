"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AnalysisProvider } from "@/lib/hair/types";

type Health = { status: "ok" | "failed"; latencyMs?: number; errorCode?: string; testedAt: string; fresh: boolean };
type Dashboard = {
  config: { analysisProvider: AnalysisProvider; analysisModel: string; imagePreviewEnabled: boolean; revision: number; updatedAt: number };
  providers: Array<{ id: AnalysisProvider; model: string; keyConfigured: boolean; health?: Health }>;
  usage: { analyses: number; successes: number; failures: number; image_calls: number };
  audit: Array<{ action: string; providerId?: string; details: Record<string, unknown>; createdAt: string }>;
};

const PROVIDER_NAMES: Record<AnalysisProvider, string> = { kie: "Kie Terra", qwen: "阿里云千问", glm: "智谱 GLM" };
const ACTION_NAMES: Record<string, string> = {
  provider_test: "供应商连接测试", provider_switch: "切换识别供应商", image_preview_toggle: "调整真人预览开关",
  login_success: "管理员登录成功", login_failed: "管理员登录失败",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "request_failed");
  return payload;
}

export function AdminApp() {
  const [authenticated, setAuthenticated] = useState<boolean | undefined>();
  const [csrf, setCsrf] = useState("");
  const [password, setPassword] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [provider, setProvider] = useState<AnalysisProvider>("kie");
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const loadDashboard = useCallback(async () => {
    const data = await requestJson<Dashboard>("/api/admin/config");
    setDashboard(data); setProvider(data.config.analysisProvider); setPreviewEnabled(data.config.imagePreviewEnabled);
  }, []);

  useEffect(() => {
    void requestJson<{ authenticated: boolean; csrfToken: string }>("/api/admin/session")
      .then(async (session) => { setCsrf(session.csrfToken); setAuthenticated(true); await loadDashboard(); })
      .catch(() => setAuthenticated(false));
  }, [loadDashboard]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy("login"); setNotice(undefined);
    try {
      const session = await requestJson<{ csrfToken: string }>("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      setPassword(""); setCsrf(session.csrfToken); setAuthenticated(true); await loadDashboard();
    } catch { setNotice("密码错误或暂时无法登录"); }
    finally { setBusy(undefined); }
  }

  async function testProvider(id: AnalysisProvider) {
    setBusy(`test:${id}`); setNotice(undefined);
    try {
      await requestJson(`/api/admin/providers/${id}/test`, { method: "POST", headers: { "X-Admin-CSRF": csrf } });
      setNotice(`${PROVIDER_NAMES[id]} 连接测试通过`); await loadDashboard();
    } catch (error) {
      setNotice(error instanceof Error && error.message === "provider_not_configured" ? "该供应商尚未配置密钥" : "连接测试失败，请检查密钥或供应商服务");
      await loadDashboard().catch(() => undefined);
    } finally { setBusy(undefined); }
  }

  async function saveConfig() {
    if (!dashboard) return;
    setBusy("save"); setNotice(undefined);
    try {
      await requestJson("/api/admin/config", {
        method: "PUT", headers: { "Content-Type": "application/json", "X-Admin-CSRF": csrf },
        body: JSON.stringify({ revision: dashboard.config.revision, analysisProvider: provider, imagePreviewEnabled: previewEnabled }),
      });
      setNotice("配置已生效，只影响之后创建的新任务"); await loadDashboard();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setNotice(code === "provider_health_required" ? "请先完成该供应商的连接测试，测试结果30分钟内有效" : code === "config_conflict" ? "配置已在其他页面更新，已为你刷新" : "配置保存失败");
      await loadDashboard().catch(() => undefined);
    } finally { setBusy(undefined); }
  }

  async function logout() {
    await requestJson("/api/admin/logout", { method: "POST", headers: { "X-Admin-CSRF": csrf } }).catch(() => undefined);
    setAuthenticated(false); setDashboard(undefined); setCsrf("");
  }

  if (authenticated === undefined) return <main className="admin-shell"><div className="admin-loading">正在验证管理会话…</div></main>;
  if (!authenticated) return (
    <main className="admin-shell admin-login-shell">
      <form className="admin-login" onSubmit={login}>
        <p className="eyebrow">HAIRFORM / CONTROL ROOM</p>
        <h1>管理后台</h1>
        <p>输入管理员密码，管理识别供应商与真人预览功能。</p>
        <label><span>管理员密码</span><input autoFocus autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="primary-button" disabled={busy === "login" || !password}>{busy === "login" ? "正在登录…" : "进入后台 →"}</button>
        {notice && <div className="admin-notice is-error" role="alert">{notice}</div>}
        <Link href="/">返回 HAIRFORM</Link>
      </form>
    </main>
  );

  return (
    <main className="admin-shell">
      <header className="admin-topbar"><div><b>型格 HAIRFORM</b><span>管理后台 / ADMIN</span></div><button onClick={logout}>退出登录</button></header>
      <section className="admin-heading"><p className="eyebrow">AI RUNTIME CONTROL</p><h1>识别服务控制台</h1><p>密钥保存在加密环境中；这里不会显示或修改任何 API Key。</p></section>
      {notice && <div className="admin-notice" role="status">{notice}</div>}
      {dashboard && <>
        <section className="admin-stats" aria-label="今日使用量">
          <div><small>今日分析</small><strong>{dashboard.usage.analyses}</strong></div>
          <div><small>成功</small><strong>{dashboard.usage.successes}</strong></div>
          <div><small>失败</small><strong>{dashboard.usage.failures}</strong></div>
          <div><small>Image2 调用</small><strong>{dashboard.usage.image_calls}</strong></div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-title"><div><p className="eyebrow">01 / VISION PROVIDER</p><h2>视觉识别供应商</h2></div><span>当前：{PROVIDER_NAMES[dashboard.config.analysisProvider]}</span></div>
          <div className="provider-grid">
            {dashboard.providers.map((item) => <article className={`provider-card ${provider === item.id ? "is-selected" : ""}`} key={item.id}>
              <label><input type="radio" name="provider" checked={provider === item.id} onChange={() => setProvider(item.id)} /><span><b>{PROVIDER_NAMES[item.id]}</b><small>{item.model}</small></span></label>
              <div className="provider-status"><span className={item.keyConfigured ? "ok" : "missing"}>{item.keyConfigured ? "密钥已配置" : "密钥未配置"}</span><span>{item.health?.status === "ok" ? `${item.health.latencyMs ?? "—"}ms · ${item.health.fresh ? "有效" : "已过期"}` : item.health?.status === "failed" ? `测试失败 · ${item.health.errorCode}` : "尚未测试"}</span></div>
              <button className="secondary-button" disabled={!item.keyConfigured || busy === `test:${item.id}`} onClick={() => testProvider(item.id)}>{busy === `test:${item.id}` ? "测试中…" : "测试连接"}</button>
            </article>)}
          </div>
        </section>
        <section className="admin-panel preview-control">
          <div><p className="eyebrow">02 / IMAGE PREVIEW</p><h2>真人发型预览</h2><p>关闭时只生成文字分析、色卡、沟通卡与报告，不产生 Image2 费用。</p></div>
          <label className="switch"><input type="checkbox" checked={previewEnabled} onChange={(event) => setPreviewEnabled(event.target.checked)} /><span /><b>{previewEnabled ? "已开启" : "已关闭"}</b></label>
        </section>
        <div className="admin-savebar"><p>配置版本 {dashboard.config.revision} · 切换供应商只影响新任务</p><button className="primary-button" disabled={busy === "save"} onClick={saveConfig}>{busy === "save" ? "正在保存…" : "保存并生效 →"}</button></div>
        <section className="admin-panel"><div className="admin-panel-title"><div><p className="eyebrow">03 / AUDIT</p><h2>最近配置记录</h2></div></div>
          <div className="audit-list">{dashboard.audit.length ? dashboard.audit.map((item, index) => <div key={`${item.createdAt}:${index}`}><span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span><b>{ACTION_NAMES[item.action] || item.action}</b><small>{item.providerId ? PROVIDER_NAMES[item.providerId as AnalysisProvider] || item.providerId : "系统"}</small></div>) : <p>暂无配置变更记录</p>}</div>
        </section>
      </>}
    </main>
  );
}
