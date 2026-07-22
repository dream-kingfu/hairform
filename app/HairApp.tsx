"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { getColor } from "@/lib/hair/catalog";
import { DENSITY_LABELS, FACE_LABELS, FOREHEAD_LABELS, FRINGE_LABELS, HAIRLINE_LABELS, PART_LABELS, SLOT_LABELS, STYLE_TRAIT_LABELS, TEXTURE_LABELS, UNDERTONE_LABELS, colorLabel, styleLabel } from "@/lib/hair/labels";
import type { AssetId, BilingualLabel, HairJobView, JobAsset, JobStatus } from "@/lib/hair/types";
import { inspectPhoto, type PhotoInspection } from "@/lib/client/photo-quality";
import { composeHairReport } from "@/lib/client/report";

const ACTIVE_STATUSES: JobStatus[] = ["validating", "analyzing", "generating", "compositing"];
const STATUS_STEPS: Array<{ status: JobStatus; zh: string; en: string }> = [
  { status: "validating", zh: "照片检查", en: "PHOTO CHECK" },
  { status: "analyzing", zh: "特征分析", en: "ANALYSIS" },
  { status: "generating", zh: "生成预览", en: "6 PREVIEWS" },
  { status: "compositing", zh: "报告排版", en: "COMPOSING" },
  { status: "completed", zh: "完成", en: "COMPLETE" },
];

const ERROR_MESSAGES: Record<string, string> = {
  unsupported_file_type: "仅支持 JPEG、PNG 或 WebP 图片。",
  file_too_large: "图片不能超过 15MB。",
  create_job_failed: "创建任务失败，请稍后重试。",
  processing_failed: "AI 服务暂时不可用，请稍后重试。",
  rate_limited: "当前生成请求较多，请稍后重试。",
  moderation_blocked: "这张照片无法处理，请更换本人清晰正面照。",
  insufficient_previews: "可用预览数量不足，请重新生成。",
  photo_quality_failed: "照片角度或遮挡不符合要求，请更换清晰正面照。",
};

function Bi({ value }: { value: BilingualLabel }) {
  return <span className="bi"><strong>{value.zh}</strong><small>{value.en}</small></span>;
}

function authHeaders(token?: string, json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "request_failed");
  return payload;
}

function statusRank(status: JobStatus) {
  const rank: Record<JobStatus, number> = { validating: 0, analyzing: 1, generating: 2, compositing: 3, completed: 4, partial: 4, failed: 4, expired: 4, deleted: 4 };
  return rank[status];
}

function AssetCard({ asset, job, onRetry }: { asset: JobAsset; job: HairJobView; onRetry: (id: AssetId) => void }) {
  const recommendation = job.analysis?.hairstyleSlots.find((item) => item.slot === asset.id);
  const colorIndex = asset.id === "color_primary" ? 0 : 1;
  const color = asset.kind === "color" ? job.analysis?.colors[colorIndex] : undefined;
  const title = recommendation ? SLOT_LABELS[recommendation.slot] : color ? colorLabel(color.colorId) : { zh: "生成中", en: "GENERATING" };
  return (
    <article className={`asset-card ${asset.kind === "color" ? "is-color" : ""} ${asset.id === "less_suitable" ? "is-caution" : ""}`}>
      <div className="asset-media">
        {asset.status === "ready" && asset.url ? <img src={asset.url} alt={`${title.zh}真人预览`} /> : (
          <div className="asset-placeholder">
            <span className={asset.status === "failed" ? "failed-mark" : "loader-mark"}>{asset.status === "failed" ? "!" : "✦"}</span>
            <p>{asset.status === "failed" ? "这张没有生成成功" : asset.status === "generating" ? "正在生成真人预览" : "等待生成"}</p>
            {asset.status === "failed" && <button className="text-button" onClick={() => onRetry(asset.id)}>单独重试</button>}
          </div>
        )}
        {asset.status === "ready" && <span className="media-badge">{asset.kind === "color" ? "COLOR" : asset.id === "less_suitable" ? "COMPARE" : "RECOMMENDED"}</span>}
      </div>
      <div className="asset-body">
        <Bi value={title} />
        {recommendation && <>
          <Bi value={styleLabel(recommendation.styleId)} />
          <div className="mini-tags"><span>{FRINGE_LABELS[recommendation.fringeId].zh}</span><span>{PART_LABELS[recommendation.partId].zh}</span></div>
        </>}
        {color && <div className="color-line"><i style={{ background: getColor(color.colorId).hex }} /><span>{color.level ? `${color.level} 度` : "自然明度"}</span></div>}
      </div>
    </article>
  );
}

export function HairApp() {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const composingJob = useRef<string | null>(null);
  const accessToken = useRef<string | undefined>(undefined);
  const [file, setFile] = useState<File>();
  const [localPreview, setLocalPreview] = useState<string>();
  const [inspection, setInspection] = useState<PhotoInspection>();
  const [checking, setChecking] = useState(false);
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState<HairJobView>();
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<boolean>();
  const [busyAsset, setBusyAsset] = useState<AssetId>();

  const refreshJob = useCallback(async (jobId: string) => {
    try {
      const current = await jsonRequest<HairJobView>(`/api/v1/hair-jobs/${jobId}`, { headers: authHeaders(accessToken.current) });
      setJob(current);
      return current;
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "request_failed";
      if (code === "job_not_found") localStorage.removeItem("hairform:lastJob");
      throw requestError;
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("hairform:lastJob");
    if (!saved) return;
    let jobId = saved;
    try {
      const restored = JSON.parse(saved) as { jobId?: string; accessToken?: string };
      if (restored.jobId) jobId = restored.jobId;
      accessToken.current = restored.accessToken;
    } catch {
      // Backward compatible with the early prototype, which stored only the ID.
    }
    queueMicrotask(() => void refreshJob(jobId).catch(() => undefined));
  }, [refreshJob]);

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const activeJobId = job?.id;
  const activeJobStatus = job?.status;
  useEffect(() => {
    if (!activeJobId || !activeJobStatus || !ACTIVE_STATUSES.includes(activeJobStatus)) return;
    const timer = window.setInterval(() => void refreshJob(activeJobId).catch(() => undefined), 1400);
    return () => window.clearInterval(timer);
  }, [activeJobId, activeJobStatus, refreshJob]);

  useEffect(() => {
    if (!job || job.status !== "compositing" || !job.analysis || composingJob.current === job.id) return;
    composingJob.current = job.id;
    void (async () => {
      try {
        const { png, webp } = await composeHairReport(job);
        const form = new FormData();
        form.append("report", new File([png], "hairform-report.png", { type: "image/png" }));
        form.append("preview", new File([webp], "hairform-preview.webp", { type: "image/webp" }));
        await jsonRequest(`/api/v1/hair-jobs/${job.id}/report`, { method: "POST", headers: authHeaders(accessToken.current), body: form });
        await refreshJob(job.id);
      } catch {
        composingJob.current = null;
        setError("报告排版失败，请刷新页面重试。");
      }
    })();
  }, [job, refreshJob]);

  const blockingIssues = inspection?.issues.filter((issue) => issue.blocking) ?? [];
  const canStart = Boolean(file && inspection && blockingIssues.length === 0 && consent && !checking);
  const resultReady = Boolean(job && ["completed", "partial"].includes(job.status));
  const recommendationAssets = job?.assets.filter((asset) => asset.kind === "hairstyle") ?? [];
  const colorAssets = job?.assets.filter((asset) => asset.kind === "color") ?? [];

  async function selectPhoto(nextFile?: File) {
    if (!nextFile) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(nextFile.type)) { setError(ERROR_MESSAGES.unsupported_file_type); return; }
    if (nextFile.size > 15 * 1024 * 1024) { setError(ERROR_MESSAGES.file_too_large); return; }
    setError(undefined);
    setChecking(true);
    setInspection(undefined);
    setConsent(false);
    setFile(nextFile);
    setLocalPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(nextFile);
    });
    try { setInspection(await inspectPhoto(nextFile)); }
    catch { setError("照片读取失败，请换一张图片。"); }
    finally { setChecking(false); }
  }

  function resetPhoto() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setFile(undefined); setLocalPreview(undefined); setInspection(undefined); setConsent(false); setError(undefined);
  }

  async function startJob() {
    if (!file || !inspection || !canStart) return;
    setError(undefined);
    try {
      const form = new FormData();
      form.append("photo", file);
      if (inspection.mask) form.append("mask", new File([inspection.mask], "hair-mask.png", { type: "image/png" }));
      const created = await jsonRequest<{ jobId: string; accessToken: string; expiresAt: string; demoMode: boolean }>("/api/v1/hair-jobs", { method: "POST", body: form });
      accessToken.current = created.accessToken;
      localStorage.setItem("hairform:lastJob", JSON.stringify({ jobId: created.jobId, accessToken: created.accessToken }));
      const initial: HairJobView = { id: created.jobId, status: "validating", progress: 4, assets: [], expiresAt: created.expiresAt, demoMode: created.demoMode };
      setJob(initial);
      void jsonRequest<HairJobView>(`/api/v1/hair-jobs/${created.jobId}/process`, { method: "POST", headers: authHeaders(created.accessToken) })
        .then(setJob)
        .catch((processError) => setError(ERROR_MESSAGES[processError instanceof Error ? processError.message : ""] || ERROR_MESSAGES.processing_failed));
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "create_job_failed";
      setError(ERROR_MESSAGES[code] || ERROR_MESSAGES.create_job_failed);
    }
  }

  async function retryAsset(id: AssetId) {
    if (!job || busyAsset) return;
    setBusyAsset(id); setError(undefined); composingJob.current = null;
    try {
      const current = await jsonRequest<HairJobView>(`/api/v1/hair-jobs/${job.id}/retry`, { method: "POST", headers: authHeaders(accessToken.current, true), body: JSON.stringify({ assetIds: [id] }) });
      setJob(current);
    } catch { setError("单张重试失败，请稍后再试。"); }
    finally { setBusyAsset(undefined); }
  }

  async function submitFeedback(helpful: boolean) {
    if (!job || feedback !== undefined) return;
    await jsonRequest(`/api/v1/hair-jobs/${job.id}/feedback`, { method: "POST", headers: authHeaders(accessToken.current, true), body: JSON.stringify({ helpful }) });
    setFeedback(helpful);
  }

  async function downloadReport() {
    if (!job?.reportUrl) return;
    const response = await fetch(job.reportUrl, { credentials: "same-origin" });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `hairform-${job.id.slice(0, 8)}.png`; anchor.click();
    URL.revokeObjectURL(url);
  }

  async function shareReport() {
    if (!job?.reportUrl) return;
    const response = await fetch(job.reportUrl, { credentials: "same-origin" });
    const blob = await response.blob();
    const shareFile = new File([blob], "hairform-report.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [shareFile] })) await navigator.share({ title: "我的男生发型分析", text: "型格 HAIRFORM 发型报告", files: [shareFile] });
    else await downloadReport();
  }

  async function deleteCurrentJob() {
    if (!job || !window.confirm("立即删除原图、预览和报告？删除后无法恢复。")) return;
    await jsonRequest(`/api/v1/hair-jobs/${job.id}`, { method: "DELETE", headers: authHeaders(accessToken.current) });
    localStorage.removeItem("hairform:lastJob");
    accessToken.current = undefined;
    setJob(undefined); setFeedback(undefined); resetPhoto();
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="型格首页"><span>型格</span><small>HAIRFORM</small></a>
        <div className="topbar-meta"><span>AI MEN&apos;S HAIR</span><span className="privacy-dot" />24H PRIVATE</div>
      </header>

      {!job && <>
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow">AI MEN&apos;S HAIR REPORT / 01</p>
            <h1>先看见，<br />再决定<span>剪什么。</span></h1>
            <p className="hero-lead">一张正面照，获得短发、中发、长发与发色真人对比。不是滤镜，是走进理发店前的第二意见。</p>
            <div className="hero-stats"><span><strong>4</strong> 款发型</span><span><strong>2</strong> 款发色</span><span><strong>24H</strong> 自动删除</span></div>
          </div>
          <div className="hero-mark" aria-hidden="true"><span>01</span><b>LOOK<br />FIRST</b><i /></div>
        </section>

        <section className="upload-section" aria-labelledby="upload-title">
          <div className="section-heading"><p className="eyebrow">START / 开始分析</p><h2 id="upload-title">上传一张清晰正面照</h2></div>
          {!file ? <div className="upload-card">
            <div className="scan-frame"><span /><span /><span /><span /><b>正面 · 单人 · 自然光</b></div>
            <div className="upload-copy"><h3>让头顶、发际线和耳侧完整入镜</h3><p>支持 JPEG、PNG、WebP，最大 15MB。建议自然表情、无遮挡、背景简洁。</p>
              <div className="upload-actions"><button className="primary-button" onClick={() => fileInput.current?.click()}>选择照片 <span>↗</span></button><button className="secondary-button" onClick={() => cameraInput.current?.click()}>立即拍照</button></div>
            </div>
          </div> : <div className="review-grid">
            <div className="review-photo">{localPreview && <img src={localPreview} alt="待分析的正面肖像" />}<button onClick={resetPhoto}>重新选择</button></div>
            <div className="review-panel"><p className="eyebrow">PHOTO CHECK</p><h3>{checking ? "正在检查照片" : blockingIssues.length ? "建议重新拍摄" : "照片可以使用"}</h3>
              {inspection && <div className="photo-meta"><span>{inspection.width} × {inspection.height}</span><span>亮度 {Math.round(inspection.luminance)} / 255</span></div>}
              <ul className="issue-list">{checking && <li className="is-ok">正在读取清晰度与光线…</li>}{inspection?.issues.map((issue) => <li className={issue.blocking ? "is-error" : "is-note"} key={issue.code}>{issue.message}</li>)}{inspection && !blockingIssues.length && <li className="is-ok">清晰度与基础光线检查通过</li>}</ul>
              {!blockingIssues.length && inspection && <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>我确认照片属于本人或已获授权，并同意上传至 AI 服务处理。文件最长保留24小时，可随时删除。</span></label>}
              <button className="primary-button full" disabled={!canStart} onClick={startJob}>生成我的发型报告 <span>→</span></button>
            </div>
          </div>}
          <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
          <input ref={cameraInput} className="visually-hidden" type="file" accept="image/*" capture="user" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
          {error && <p className="error-banner" role="alert">{error}</p>}
        </section>

        <section className="principles"><div><span>01</span><h3>同一张脸</h3><p>所有预览都从原图独立编辑，避免连续生成造成身份漂移。</p></div><div><span>02</span><h3>文字不交给 AI</h3><p>双语标签由程序排版，保证清晰、准确、可下载。</p></div><div><span>03</span><h3>不评价长相</h3><p>只讨论发型结构与视觉适配，不做身份或医学判断。</p></div></section>
      </>}

      {job && !resultReady && <section className="progress-page">
        <div className="progress-heading"><p className="eyebrow">ANALYSIS IN PROGRESS</p><h1>正在为你生成<br />六张真人预览<span>。</span></h1>{job.demoMode && <p className="demo-notice">演示模式：当前未配置 OpenAI API Key，流程和报告可完整体验，预览暂用原图占位。</p>}</div>
        <div className="progress-meter"><div style={{ width: `${job.progress}%` }} /><strong>{job.progress}%</strong></div>
        <ol className="status-steps">{STATUS_STEPS.map((step, index) => { const current = statusRank(job.status); return <li className={index < current ? "done" : index === current ? "active" : ""} key={step.status}><span>{String(index + 1).padStart(2, "0")}</span><b>{step.zh}</b><small>{step.en}</small></li>; })}</ol>
        <div className="generating-grid">{(job.assets.length ? job.assets : [
          { id: "best_short", kind: "hairstyle", status: "pending" }, { id: "best_medium", kind: "hairstyle", status: "pending" }, { id: "best_long", kind: "hairstyle", status: "pending" }, { id: "less_suitable", kind: "hairstyle", status: "pending" }, { id: "color_primary", kind: "color", status: "pending" }, { id: "color_secondary", kind: "color", status: "pending" },
        ] as JobAsset[]).map((asset) => <div className={`generating-tile ${asset.status}`} key={asset.id}><span>✦</span><b>{asset.id.replaceAll("_", " ")}</b><small>{asset.status === "ready" ? "READY" : asset.status === "failed" ? "RETRY AVAILABLE" : "GENERATING"}</small></div>)}</div>
        {job.status === "failed" && <><p className="error-banner" role="alert">{ERROR_MESSAGES[job.errorCode ?? ""] || ERROR_MESSAGES.processing_failed}</p><button className="secondary-button" onClick={() => { localStorage.removeItem("hairform:lastJob"); accessToken.current = undefined; setJob(undefined); }}>重新开始</button></>}
        {error && <p className="error-banner" role="alert">{error}</p>}
      </section>}

      {job && resultReady && job.analysis && <section className="results-page">
        <div className="results-hero"><div><p className="eyebrow">YOUR REPORT / ANALYSIS COMPLETE</p><h1>更适合你的，<br />是轻盈、有结构的发型。</h1><p>基于单张正面照片的视觉估计。把它当作与发型师沟通的起点，而不是唯一答案。</p></div>{job.originalUrl && <div className="original-frame"><img src={job.originalUrl} alt="原始肖像" /><span>ORIGINAL</span></div>}</div>
        {job.demoMode && <p className="demo-notice">演示模式：页面、报告与全部交互已启用；接入 API Key 后会生成真实换发型与发色图。</p>}
        <div className="analysis-strip">
          <Bi value={FACE_LABELS[job.analysis.faceShape]} /><Bi value={TEXTURE_LABELS[job.analysis.hairTexture]} /><Bi value={DENSITY_LABELS[job.analysis.hairDensity]} /><Bi value={HAIRLINE_LABELS[job.analysis.hairline]} /><Bi value={FOREHEAD_LABELS[job.analysis.foreheadRatio]} /><Bi value={UNDERTONE_LABELS[job.analysis.skinUndertone]} />
        </div>
        <div className="result-section-heading"><p className="eyebrow">01 / HAIRSTYLES</p><h2>三种长度，一个避雷对照</h2></div>
        <div className="asset-grid">{recommendationAssets.map((asset) => <AssetCard asset={asset} job={job} key={asset.id} onRetry={retryAsset} />)}</div>
        <div className="result-section-heading"><p className="eyebrow">02 / COLORS</p><h2>发色只做辅助，不抢五官</h2></div>
        <div className="asset-grid color-grid">{colorAssets.map((asset) => <AssetCard asset={asset} job={job} key={asset.id} onRetry={retryAsset} />)}</div>
        <div className="overall-card"><p className="eyebrow">OVERALL STYLE</p><h2>{job.analysis.styleTraitIds.map((id) => STYLE_TRAIT_LABELS[id]?.zh).filter(Boolean).join(" · ")}</h2><p>{styleLabel(job.analysis.hairstyleSlots[0].styleId).zh}优先，保留轻盈纹理与自然分缝。</p></div>
        {job.previewUrl && <div className="report-preview"><img src={job.previewUrl} alt="双语发型分析报告预览" /><div><p className="eyebrow">READY TO SAVE</p><h2>你的双语报告已排好</h2><p>2160 × 3840 PNG，适合保存到相册或直接发给发型师。</p><div className="report-actions"><button className="primary-button" onClick={downloadReport}>下载高清报告 ↓</button><button className="secondary-button" onClick={shareReport}>分享结果 ↗</button></div></div></div>}
        <div className="feedback-row"><div><p className="eyebrow">FEEDBACK</p><h3>这个结果对你有帮助吗？</h3></div><div><button disabled={feedback !== undefined} className={feedback === true ? "selected" : ""} onClick={() => void submitFeedback(true)}>有帮助</button><button disabled={feedback !== undefined} className={feedback === false ? "selected" : ""} onClick={() => void submitFeedback(false)}>没帮助</button></div></div>
        {job.status === "partial" && <p className="error-banner">部分预览没有成功，你可以在对应卡片中单独重试。</p>}
        {error && <p className="error-banner" role="alert">{error}</p>}
        <div className="result-footer"><span>结果将在 {new Date(job.expiresAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 自动删除</span><button className="danger-button" onClick={deleteCurrentJob}>立即删除全部数据</button></div>
      </section>}

      <footer className="footer"><span>型格 HAIRFORM</span><p>视觉建议，不构成医学、植发或专业理发结论。</p><small>AI MEN&apos;S HAIR REPORT · 2026</small></footer>
    </main>
  );
}
