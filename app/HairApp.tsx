"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { getColor } from "@/lib/hair/catalog";
import { barberBriefCopyText, buildBarberBrief, type BarberBrief } from "@/lib/hair/barber-brief";
import { DENSITY_LABELS, FACE_LABELS, FOREHEAD_LABELS, FRINGE_LABELS, HAIRLINE_LABELS, PART_LABELS, SLOT_LABELS, STYLE_TRAIT_LABELS, TEXTURE_LABELS, UNDERTONE_LABELS, colorLabel, styleLabel } from "@/lib/hair/labels";
import type { AssetId, BilingualLabel, HairJobView, HairSlot, JobAsset, JobStatus, PreviewAssetId } from "@/lib/hair/types";
import { composeBarberBriefCard } from "@/lib/client/barber-brief-card";
import { inspectPhoto, preparePhotoUpload, type PhotoInspection } from "@/lib/client/photo-quality";
import { composeHairReport } from "@/lib/client/report";
import { PHOTO_CONSENT_VERSION } from "@/lib/hair/privacy";
import { getHairInspirationLinks, hairInspirationPlatformLabel } from "@/lib/hair/inspiration";

const ACTIVE_STATUSES: JobStatus[] = ["validating", "analyzing", "generating", "compositing"];
const STATUS_STEPS: Array<{ status: JobStatus; zh: string; en: string }> = [
  { status: "validating", zh: "照片检查", en: "PHOTO CHECK" },
  { status: "analyzing", zh: "特征分析", en: "ANALYSIS" },
  { status: "analysis_ready", zh: "文字建议", en: "TEXT REPORT" },
  { status: "awaiting_selection", zh: "选择发型", en: "CHOOSE" },
  { status: "generating", zh: "生成预览", en: "1 PREVIEW" },
  { status: "compositing", zh: "报告排版", en: "COMPOSING" },
  { status: "completed", zh: "完成", en: "COMPLETE" },
];

const ERROR_MESSAGES: Record<string, string> = {
  unsupported_file_type: "仅支持 JPEG、PNG 或 WebP 图片。",
  file_too_large: "图片不能超过 15MB。",
  create_job_failed: "创建任务失败，请稍后重试。",
  client_update_required: "网页已更新，请刷新页面后重新选择照片。",
  processing_failed: "AI 服务暂时不可用，请稍后重试。",
  invalid_api_key: "AI 服务密钥无效，请联系管理员更新配置。",
  insufficient_credits: "AI 服务额度不足，请联系管理员充值后重试。",
  model_request_failed: "AI 分析请求失败，请稍后重试。",
  image_upload_failed: "照片发送至 AI 服务失败，请稍后重试。",
  rate_limited: "当前生成请求较多，请稍后重试。",
  moderation_blocked: "这张照片无法处理，请更换本人清晰正面照。",
  insufficient_previews: "可用预览数量不足，请重新生成。",
  photo_quality_failed: "照片角度或遮挡不符合要求，请更换清晰正面照。",
  job_busy: "当前任务仍在处理中，请稍后再试。",
  selection_locked: "这份报告已经锁定一款发型或发色，不能更换生成款。",
  image_call_limit_reached: "两次生成额度已用完，请重新上传照片开始。",
  service_paused_low_credit: "AI 服务正在维护额度，请稍后再试。",
  service_temporarily_unavailable: "AI 服务繁忙，请稍后再试。",
  model_policy_error: "AI 模型配置异常，请联系管理员。",
  model_daily_limit: "今天的生成额度已用完，请明天再试。",
  quality_check_failed: "预览未通过一致性检查，请重新上传照片。",
  quality_service_failed: "预览质检服务暂时不可用，请稍后重新分析。",
  provider_not_configured: "当前识别服务尚未配置，请联系管理员。",
  image_preview_disabled: "真人预览目前未开放，文字报告仍可正常使用。",
  consultation_disabled: "沟通改建议暂未开放，当前报告仍可正常使用。",
  consultation_turn_limit: "这一轮沟通已经确认完整，可以直接调整建议或保留原建议。",
  revision_limit_reached: "这份报告已经完成两次建议调整。",
  consultation_in_progress: "请先确认调整方向或保留原建议，再生成真人预览。",
  consultation_locked: "真人预览开始后不能再修改建议。",
  consent_required: "请先确认肖像授权与本次 AI 处理说明。",
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

function statusRank(status: JobStatus, progress = 0) {
  if (status === "failed") return progress < 22 ? 1 : progress < 92 ? 2 : 3;
  const rank: Record<JobStatus, number> = { validating: 0, analyzing: 1, analysis_ready: 2, awaiting_selection: 3, generating: 4, compositing: 5, completed: 6, partial: 6, failed: 6, expired: 6, deleted: 6 };
  return rank[status];
}

function HairInspirationLinks({ styleId }: { styleId: string }) {
  const links = getHairInspirationLinks(styleId);
  if (!links.length) return null;
  return (
    <aside className="hair-inspiration" aria-label="真实发型灵感">
      <div className="hair-inspiration-heading">
        <strong>真实发型灵感</strong>
        <small>REAL REFERENCES</small>
      </div>
      <p className="hair-inspiration-intro">看看真实轮廓和打理效果。点击后将离开 HAIRFORM，进入第三方平台。</p>
      <div className="hair-inspiration-list">
        {links.map((link) => {
          const platform = hairInspirationPlatformLabel(link.platform);
          return (
            <a
              href={link.url}
              key={link.id}
              target="_blank"
              rel="noopener noreferrer nofollow external"
              referrerPolicy="no-referrer"
              onClick={(event) => {
                if (!window.confirm(`即将打开${platform}原帖（第三方平台），是否继续？`)) event.preventDefault();
              }}
            >
              <span className={`hair-inspiration-platform is-${link.platform}`}>{platform}</span>
              <span className="hair-inspiration-copy"><b>@{link.creatorDisplayName}</b><small>{link.summaryZh}</small></span>
              <span className="hair-inspiration-action">去原帖看效果 ↗</span>
            </a>
          );
        })}
      </div>
      <p className="hair-inspiration-disclaimer">原帖内容归作者及平台所有，非合作或代言，仅作发型灵感参考。</p>
    </aside>
  );
}

function AssetCard({ asset, job, selected, onSelect, onRetry, onOpenBarberBrief }: { asset: JobAsset; job: HairJobView; selected?: boolean; onSelect: (id: PreviewAssetId) => void; onRetry: (id: AssetId) => void; onOpenBarberBrief: (id: HairSlot) => void }) {
  const recommendation = job.analysis?.hairstyleSlots.find((item) => item.slot === asset.id);
  const colorIndex = asset.id === "color_primary" ? 0 : 1;
  const color = asset.kind === "color" ? job.analysis?.colors[colorIndex] : undefined;
  const stylePresentation = job.presentation?.hairstyles.find((item) => item.assetId === asset.id);
  const colorPresentation = job.presentation?.colors.find((item) => item.assetId === asset.id);
  const advice = stylePresentation?.advice ?? colorPresentation?.advice;
  const title = recommendation ? SLOT_LABELS[recommendation.slot] : color ? colorLabel(color.colorId) : { zh: "生成中", en: "GENERATING" };
  const consultationActive = ["clarifying", "ready_to_confirm", "revising"].includes(job.consultation?.state ?? "");
  const canSelect = asset.id !== "less_suitable"
    && asset.status === "not_requested"
    && ["analysis_ready", "awaiting_selection", "completed", "partial"].includes(job.status)
    && Boolean(job.generationPolicy?.imagePreviewAvailable)
    && !job.generationPolicy?.selectedAssetId
    && !consultationActive;
  return (
    <article className={`asset-card ${asset.kind === "color" ? "is-color" : ""} ${asset.id === "less_suitable" ? "is-caution" : ""} ${selected ? "is-selected" : ""}`}>
      <div className="asset-media">
        {asset.status === "ready" && asset.url ? <img src={asset.url} alt={`${title.zh}真人预览`} /> : asset.kind === "color" ? (
          <div className="asset-placeholder color-only"><i style={{ background: color ? getColor(color.colorId).hex : "#30251f" }} /><p>{job.generationPolicy?.imagePreviewAvailable ? "先选中，再生成真人发色预览" : "发色色卡 · 当前不生成图片"}</p></div>
        ) : (
          <div className="asset-placeholder">
            <span className={asset.status === "failed" ? "failed-mark" : "loader-mark"}>{asset.status === "failed" ? "!" : "✦"}</span>
            <p>{asset.status === "failed" ? "预览未通过检查" : asset.status === "generating" ? "正在生成真人预览" : asset.id === "less_suitable" ? "谨慎选择 · 仅作文字参考" : "选择后生成真人预览"}</p>
            {asset.status === "failed" && job.generationPolicy?.version === "legacy-six-v1" && <button className="text-button" onClick={() => onRetry(asset.id)}>单独重试</button>}
          </div>
        )}
        {asset.status === "ready" && <span className="media-badge">{asset.kind === "color" ? "COLOR" : asset.id === "less_suitable" ? "COMPARE" : "RECOMMENDED"}</span>}
      </div>
      <div className="asset-body">
        <Bi value={title} />
        {recommendation && <>
          <Bi value={styleLabel(recommendation.styleId)} />
          <div className="mini-tags"><span>{FRINGE_LABELS[recommendation.fringeId].zh}</span><span>{PART_LABELS[recommendation.partId].zh}</span></div>
          {advice && <p className="recommendation-advice">{advice.zh}</p>}
          {canSelect && <button className={`selection-button ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => onSelect(asset.id as PreviewAssetId)}><span>{selected ? "已选这款" : "选这款"}</span><small>{selected ? "SELECTED ✓" : "SELECT FIRST"}</small></button>}
          {recommendation.slot !== "less_suitable" && <button className="barber-brief-button" onClick={() => onOpenBarberBrief(recommendation.slot)}><span>给理发师看</span><small>BARBER BRIEF ↗</small></button>}
          {recommendation.slot !== "less_suitable" && <HairInspirationLinks styleId={recommendation.styleId} />}
        </>}
        {color && <>
          <div className="color-line"><i style={{ background: getColor(color.colorId).hex }} /><span>{color.level ? `${color.level} 度` : "自然明度"}</span></div>
          {advice && <p className="recommendation-advice">{advice.zh}</p>}
          {canSelect && <button className={`selection-button ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => onSelect(asset.id as PreviewAssetId)}><span>{selected ? "已选这款发色" : "选这款发色"}</span><small>{selected ? "SELECTED ✓" : "SELECT FIRST"}</small></button>}
        </>}
        {job.generationPolicy?.selectedAssetId === asset.id && asset.status === "ready" && <p className="generated-note">已用这款生成完整真人预览</p>}
      </div>
    </article>
  );
}

function BarberBriefDialog({ brief, imageUrl, busy, notice, onClose, onCopy, onDownload, onShare }: {
  brief: BarberBrief;
  imageUrl: string;
  busy?: "download" | "share";
  notice?: string;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onCloseRef.current(); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="barber-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="barber-dialog" role="dialog" aria-modal="true" aria-labelledby="barber-dialog-title" ref={panel}>
        <header className="barber-dialog-header">
          <div><p className="eyebrow">BARBER BRIEF / 理发师沟通卡</p><h2 id="barber-dialog-title">把想要的发型，说清楚。</h2></div>
          <button className="barber-dialog-close" onClick={onClose} ref={closeButton} aria-label="关闭理发师沟通卡">关闭 ×</button>
        </header>
        <div className="barber-dialog-content">
          <div className="barber-reference"><img src={imageUrl} alt={`${brief.styleName.zh}理发参考图`} /><span>REFERENCE / 参考图</span></div>
          <div className="barber-summary">
            <p className="eyebrow">TARGET STYLE</p>
            <h3>{brief.styleName.zh}<small>{brief.styleName.en}</small></h3>
            <div className="barber-spoken"><span>直接这样说 / SAY THIS</span><p>“{brief.spokenZh}”</p></div>
          </div>
        </div>
        <div className="barber-spec-grid">
          {brief.rows.map((row) => <div className="barber-spec" key={row.id}><Bi value={row.label} /><p>{row.value.zh}</p><small>{row.value.en}</small></div>)}
        </div>
        <div className="barber-guardrails">
          <div className="barber-avoid"><strong>避免 / AVOID</strong><p>{brief.avoid.zh}</p><small>{brief.avoid.en}</small></div>
          <div className="barber-confirm"><strong>现场确认 / CONFIRM IN PERSON</strong><p>{brief.confirm.zh}</p><small>{brief.confirm.en}</small></div>
        </div>
        <footer className="barber-dialog-actions">
          <p aria-live="polite">{notice ?? "以参考图为目标，理发师可根据实际头型与发流微调。"}</p>
          <div><button className="secondary-button" onClick={onCopy}>复制沟通话术</button><button className="secondary-button" disabled={Boolean(busy)} onClick={onDownload}>{busy === "download" ? "正在生成…" : "下载沟通卡 ↓"}</button><button className="primary-button" disabled={Boolean(busy)} onClick={onShare}>{busy === "share" ? "正在准备…" : "分享给理发师 ↗"}</button></div>
        </footer>
      </div>
    </div>
  );
}

export function HairApp() {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const consultationRef = useRef<HTMLDivElement>(null);
  const composingJob = useRef<string | null>(null);
  const accessToken = useRef<string | undefined>(undefined);
  const [file, setFile] = useState<File>();
  const [localPreview, setLocalPreview] = useState<string>();
  const [inspection, setInspection] = useState<PhotoInspection>();
  const [checking, setChecking] = useState(false);
  const [authorizationConsent, setAuthorizationConsent] = useState(false);
  const [processingConsent, setProcessingConsent] = useState(false);
  const [job, setJob] = useState<HairJobView>();
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<boolean>();
  const [busyAsset, setBusyAsset] = useState<AssetId>();
  const [pendingAssetId, setPendingAssetId] = useState<PreviewAssetId>();
  const [selectedBriefSlot, setSelectedBriefSlot] = useState<HairSlot>();
  const [selectedStyleId, setSelectedStyleId] = useState<string>();
  const [briefBusy, setBriefBusy] = useState<"download" | "share">();
  const [briefNotice, setBriefNotice] = useState<string>();
  const [consultationInput, setConsultationInput] = useState("");
  const [consultationBusy, setConsultationBusy] = useState<"message" | "confirm" | "cancel">();

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
    const canCompose = job && job.analysis && (job.status === "compositing" || (job.status === "analysis_ready" && !job.reportUrl));
    const composeKey = job ? `${job.id}:${job.generationPolicy?.selectedAssetId ?? "text"}:${job.consultation?.revisionsUsed ?? 0}` : "";
    if (!canCompose || composingJob.current === composeKey) return;
    composingJob.current = composeKey;
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
  const visibleIssues = inspection?.issues.filter((issue) => issue.code !== "detector_unavailable") ?? [];
  const canStart = Boolean(file && inspection && blockingIssues.length === 0 && authorizationConsent && processingConsent && !checking);
  const resultReady = Boolean(job && ["analysis_ready", "awaiting_selection", "completed", "partial"].includes(job.status));
  const recommendationAssets = job?.assets.filter((asset) => asset.kind === "hairstyle") ?? [];
  const colorAssets = job?.assets.filter((asset) => asset.kind === "color") ?? [];
  const progressAssets = job?.generationPolicy?.selectedAssetId
    ? job.assets.filter((asset) => asset.id === job.generationPolicy?.selectedAssetId)
    : [];
  const selectedBriefAsset = selectedBriefSlot ? recommendationAssets.find((asset) => asset.id === selectedBriefSlot && asset.status === "ready" && asset.url) : undefined;
  const selectedBriefImageUrl = selectedBriefAsset?.url || job?.originalUrl;
  const selectedRecommendation = selectedBriefSlot ? job?.analysis?.hairstyleSlots.find((item) => item.slot === selectedBriefSlot) : undefined;
  const selectedBrief = job?.analysis && selectedRecommendation ? buildBarberBrief(job.analysis, selectedRecommendation, {
    style: styleLabel(selectedRecommendation.styleId),
    fringe: FRINGE_LABELS[selectedRecommendation.fringeId],
    part: PART_LABELS[selectedRecommendation.partId],
  }) : undefined;
  const pendingStyle = pendingAssetId ? job?.presentation?.hairstyles.find((item) => item.assetId === pendingAssetId) : undefined;
  const pendingColor = pendingAssetId ? job?.presentation?.colors.find((item) => item.assetId === pendingAssetId) : undefined;
  const pendingLabel = pendingStyle?.styleLabel ?? pendingColor?.label;
  const pendingKind = pendingColor ? "发色" : "发型";
  const pendingDetails = pendingStyle
    ? [pendingStyle.lengthLabel.zh, pendingStyle.fringeLabel.zh, pendingStyle.partLabel.zh]
    : pendingColor ? [pendingColor.levelLabel.zh, "只调整发色", "保留脸部与背景"] : [];

  async function selectPhoto(nextFile?: File) {
    if (!nextFile) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(nextFile.type)) { setError(ERROR_MESSAGES.unsupported_file_type); return; }
    if (nextFile.size > 15 * 1024 * 1024) { setError(ERROR_MESSAGES.file_too_large); return; }
    setError(undefined);
    setChecking(true);
    setInspection(undefined);
    setAuthorizationConsent(false);
    setProcessingConsent(false);
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
    setFile(undefined); setLocalPreview(undefined); setInspection(undefined); setAuthorizationConsent(false); setProcessingConsent(false); setError(undefined);
  }

  async function startJob() {
    if (!file || !inspection || !canStart) return;
    setError(undefined);
    try {
      const form = new FormData();
      form.append("photo", await preparePhotoUpload(file));
      form.append("portraitAuthorized", "true");
      form.append("aiProcessingConsent", "true");
      form.append("consentVersion", PHOTO_CONSENT_VERSION);
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
    } catch (retryError) {
      const code = retryError instanceof Error ? retryError.message : "retry_failed";
      setError(ERROR_MESSAGES[code] || "单张重试失败，请稍后再试。");
    }
    finally { setBusyAsset(undefined); }
  }

  async function generateAsset(id: PreviewAssetId) {
    if (!job || busyAsset || ["clarifying", "ready_to_confirm", "revising"].includes(job.consultation?.state ?? "") || !["analysis_ready", "awaiting_selection", "completed", "partial"].includes(job.status)) return;
    const recommendation = job.analysis?.hairstyleSlots.find((item) => item.slot === id);
    setBusyAsset(id); setError(undefined); composingJob.current = null;
    if (recommendation) setSelectedStyleId(recommendation.styleId);
    setJob({
      ...job,
      status: "generating",
      progress: 42,
      generationPolicy: job.generationPolicy ? { ...job.generationPolicy, selectedAssetId: id } : undefined,
      assets: job.assets.map((asset) => asset.id === id ? { ...asset, status: "generating" } : asset),
    });
    try {
      const current = await jsonRequest<HairJobView>(`/api/v1/hair-jobs/${job.id}/generate`, {
        method: "POST",
        headers: authHeaders(accessToken.current, true),
        body: JSON.stringify({ assetId: id }),
      });
      setJob(current);
    } catch (generationError) {
      const code = generationError instanceof Error ? generationError.message : "processing_failed";
      setError(ERROR_MESSAGES[code] || ERROR_MESSAGES.processing_failed);
      await refreshJob(job.id).catch(() => undefined);
    } finally { setBusyAsset(undefined); }
  }

  async function submitFeedback(helpful: boolean) {
    if (!job || feedback !== undefined) return;
    const selectedSlot = job.generationPolicy?.selectedAssetId;
    const effectiveStyleId = selectedStyleId || job.analysis?.hairstyleSlots.find((item) => item.slot === selectedSlot)?.styleId;
    await jsonRequest(`/api/v1/hair-jobs/${job.id}/feedback`, { method: "POST", headers: authHeaders(accessToken.current, true), body: JSON.stringify({ helpful, selectedStyleId: effectiveStyleId }) });
    setFeedback(helpful);
    if (!helpful) window.setTimeout(() => consultationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  async function sendConsultation(messageOverride?: string) {
    const message = (messageOverride ?? consultationInput).trim();
    if (!job || !message || consultationBusy) return;
    setConsultationBusy("message"); setError(undefined); setPendingAssetId(undefined);
    try {
      const current = await jsonRequest<HairJobView>(`/api/v1/hair-jobs/${job.id}/consultation/messages`, {
        method: "POST", headers: authHeaders(accessToken.current, true), body: JSON.stringify({ message }),
      });
      setJob(current); setConsultationInput("");
    } catch (consultationError) {
      const code = consultationError instanceof Error ? consultationError.message : "processing_failed";
      setError(ERROR_MESSAGES[code] || "暂时没能理解这条补充，请稍后再试。");
    } finally { setConsultationBusy(undefined); }
  }

  async function confirmConsultation() {
    if (!job || consultationBusy || job.consultation?.state !== "ready_to_confirm") return;
    setConsultationBusy("confirm"); setError(undefined); setPendingAssetId(undefined); composingJob.current = null;
    try {
      const current = await jsonRequest<HairJobView>(`/api/v1/hair-jobs/${job.id}/consultation/confirm`, { method: "POST", headers: authHeaders(accessToken.current, true), body: "{}" });
      setJob(current);
    } catch (consultationError) {
      const code = consultationError instanceof Error ? consultationError.message : "processing_failed";
      setError(ERROR_MESSAGES[code] || "建议调整失败，原来的报告没有受到影响，请稍后再试。");
      await refreshJob(job.id).catch(() => undefined);
    } finally { setConsultationBusy(undefined); }
  }

  async function cancelConsultation() {
    if (!job || consultationBusy) return;
    setConsultationBusy("cancel"); setError(undefined);
    try {
      const current = await jsonRequest<HairJobView>(`/api/v1/hair-jobs/${job.id}/consultation/cancel`, { method: "POST", headers: authHeaders(accessToken.current, true), body: "{}" });
      setJob(current); setConsultationInput("");
    } catch { setError("暂时无法保留原建议，请稍后再试。"); }
    finally { setConsultationBusy(undefined); }
  }

  function openBarberBrief(slot: HairSlot) {
    const recommendation = job?.analysis?.hairstyleSlots.find((item) => item.slot === slot);
    if (!recommendation || slot === "less_suitable") return;
    setSelectedBriefSlot(slot);
    setSelectedStyleId(recommendation.styleId);
    setBriefNotice(undefined);
  }

  function closeBarberBrief() {
    if (briefBusy) return;
    setSelectedBriefSlot(undefined);
    setBriefNotice(undefined);
  }

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyBarberBrief() {
    if (!selectedBrief) return;
    const value = barberBriefCopyText(selectedBrief);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setBriefNotice("沟通话术已复制，可以直接发给理发师。");
    } catch {
      setBriefNotice("复制失败，请长按选择话术文字。");
    }
  }

  async function createBarberBriefBlob() {
    if (!selectedBrief || !selectedBriefImageUrl) throw new Error("barber_brief_unavailable");
    return composeBarberBriefCard(selectedBrief, selectedBriefImageUrl);
  }

  async function downloadBarberBrief() {
    if (!selectedBrief || briefBusy) return;
    setBriefBusy("download");
    setBriefNotice(undefined);
    try {
      const blob = await createBarberBriefBlob();
      saveBlob(blob, `hairform-barber-${selectedBrief.styleId}.png`);
      setBriefNotice("1080 × 1920 沟通卡已保存。");
    } catch {
      setBriefNotice("沟通卡生成失败，请稍后再试。");
    } finally { setBriefBusy(undefined); }
  }

  async function shareBarberBrief() {
    if (!selectedBrief || briefBusy) return;
    setBriefBusy("share");
    setBriefNotice(undefined);
    try {
      const blob = await createBarberBriefBlob();
      const file = new File([blob], `hairform-barber-${selectedBrief.styleId}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${selectedBrief.styleName.zh} · 理发师沟通卡`, text: selectedBrief.spokenZh, files: [file] });
        setBriefNotice("沟通卡已分享。");
      } else {
        saveBlob(blob, file.name);
        setBriefNotice("当前浏览器不支持文件分享，已改为下载沟通卡。");
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") setBriefNotice(undefined);
      else setBriefNotice("分享失败，请下载后再发送给理发师。");
    } finally { setBriefBusy(undefined); }
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
    setSelectedBriefSlot(undefined); setSelectedStyleId(undefined); setPendingAssetId(undefined); setBriefNotice(undefined);
    setJob(undefined); setFeedback(undefined); resetPhoto();
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="型格首页"><span>型格</span><small>HAIRFORM</small></a>
        <div className="topbar-meta"><span>V0.6.1 · CONSULT THEN GENERATE</span><span className="privacy-dot" />24H PRIVATE</div>
      </header>

      {!job && <>
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow">AI MEN&apos;S HAIR REPORT / 01</p>
            <h1>先看见，<br />再决定<span>剪什么。</span></h1>
            <p className="hero-lead">一张正面照，先听懂适合你的理由。不满意可以继续和顾问聊，调整好建议再选一款，确认后生成完整真人预览图。</p>
            <div className="hero-stats"><span><strong>3</strong> 款推荐</span><span><strong>1</strong> 次视觉分析</span><span><strong>24H</strong> 自动删除</span></div>
          </div>
          <div className="hero-mark" aria-hidden="true"><span>01</span><b>LOOK<br />FIRST</b><i /></div>
        </section>

        <section className="upload-section" aria-labelledby="upload-title">
          <div className="section-heading"><p className="eyebrow">START / 开始分析</p><h2 id="upload-title">上传一张清晰正面照</h2></div>
          {!file ? <div className="upload-card">
            <div className="scan-frame"><span /><span /><span /><span /><b>正面 · 单人 · 自然光</b></div>
            <div className="upload-copy"><h3>让头顶、发际线和耳侧完整入镜</h3><p>支持 JPEG、PNG、WebP，最大 15MB。建议自然表情、无遮挡、背景简洁。公开服务每位访客每小时最多生成 2 份报告。</p>
              <div className="upload-actions"><button className="primary-button" onClick={() => fileInput.current?.click()}>选择照片 <span>↗</span></button><button className="secondary-button" onClick={() => cameraInput.current?.click()}>立即拍照</button></div>
            </div>
          </div> : <div className="review-grid">
            <div className="review-photo">{localPreview && <img src={localPreview} alt="待分析的正面肖像" />}<button onClick={resetPhoto}>重新选择</button></div>
            <div className="review-panel"><p className="eyebrow">PHOTO CHECK</p><h3>{checking ? "正在本地检查照片" : blockingIssues.length ? "建议重新拍摄" : "照片可以使用"}</h3>
              <p className="local-check-note">照片先在你的浏览器里检查；只有检查合格并由你确认后，才会上传开始分析。</p>
              {inspection && <div className="photo-meta"><span>{inspection.width} × {inspection.height}</span><span>亮度 {Math.round(inspection.luminance)} / 255</span><span>清晰度 {Math.round(inspection.sharpness)}</span><span>{inspection.detector === "mediapipe" ? "本地完整检查" : inspection.detector === "native" ? "浏览器基础检查" : "服务端继续复核"}</span></div>}
              {checking && <div className="photo-check-loading">正在检查清晰度、单人脸、角度和构图…</div>}
              {inspection && <div className="photo-check-grid">{inspection.checks.map((check) => <div className={`photo-check is-${check.status}`} key={check.id}><span>{check.status === "pass" ? "✓" : check.status === "fail" ? "!" : "i"}</span><div><strong>{check.label}</strong><small>{check.detail}</small></div></div>)}</div>}
              <ul className="issue-list">{visibleIssues.map((issue) => <li className={issue.blocking ? "is-error" : "is-note"} key={issue.code}>{issue.message}</li>)}{inspection && !blockingIssues.length && <li className="is-ok">关键检查已通过，可以继续</li>}</ul>
              {!blockingIssues.length && inspection && <div className="consent-group">
                <label className="consent"><input type="checkbox" checked={authorizationConsent} onChange={(event) => setAuthorizationConsent(event.target.checked)} /><span>我确认照片属于本人，或已获得照片中人物的明确授权。</span></label>
                <label className="consent"><input type="checkbox" checked={processingConsent} onChange={(event) => setProcessingConsent(event.target.checked)} /><span>我同意本次将肖像交给已配置的 AI 服务完成分析和所选预览。HAIRFORM 不将照片用于训练，任务最长保留 24 小时，也可以立即删除。</span></label>
              </div>}
              <button className="primary-button full" disabled={!canStart} onClick={startJob}>生成我的发型报告 <span>→</span></button>
            </div>
          </div>}
          <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
          <input ref={cameraInput} className="visually-hidden" type="file" accept="image/*" capture="user" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
          {error && <p className="error-banner" role="alert">{error}</p>}
        </section>

        <section className="principles"><div><span>01</span><h3>先给可用建议</h3><p>默认只做一次视觉分析，不等待高成本图片生成。</p></div><div><span>02</span><h3>文字稳定清晰</h3><p>双语标签由程序排版，保证清晰、准确、可下载。</p></div><div><span>03</span><h3>不评价长相</h3><p>只讨论发型结构与视觉适配，不做身份或医学判断。</p></div></section>
      </>}

      {job && !resultReady && <section className="progress-page">
        <div className="progress-heading"><p className="eyebrow">ANALYSIS IN PROGRESS</p><h1>{job.status === "generating" ? <>正在生成你选的<br />一张真人预览<span>。</span></> : <>正在分析你的<br />发型适配<span>。</span></>}</h1>{job.demoMode && <p className="demo-notice">演示模式：当前未配置 AI 服务密钥，预览暂用原图占位。</p>}</div>
        <div className="progress-meter"><div style={{ width: `${job.progress}%` }} /><strong>{job.progress}%</strong></div>
        <ol className="status-steps">{STATUS_STEPS.map((step, index) => { const current = statusRank(job.status, job.progress); return <li className={index < current ? "done" : index === current ? "active" : ""} key={step.status}><span>{String(index + 1).padStart(2, "0")}</span><b>{step.zh}</b><small>{step.en}</small></li>; })}</ol>
        <div className="generating-grid single-preview-grid">{progressAssets.length ? progressAssets.map((asset) => <div className={`generating-tile ${asset.status}`} key={asset.id}><span>✦</span><b>{asset.id.replaceAll("_", " ")}</b><small>{asset.status === "ready" ? "READY" : asset.status === "failed" ? "NOT PASSED" : "GENERATING"}</small></div>) : <div className="generating-tile analyzing"><span>✦</span><b>VISUAL ANALYSIS</b><small>CHECKING FEATURES</small></div>}</div>
        {job.status === "failed" && <><p className="error-banner" role="alert">{ERROR_MESSAGES[job.errorCode ?? ""] || ERROR_MESSAGES.processing_failed}</p><button className="secondary-button" onClick={() => { localStorage.removeItem("hairform:lastJob"); accessToken.current = undefined; setJob(undefined); }}>重新开始</button></>}
        {error && !(job.status === "failed" && job.errorCode) && <p className="error-banner" role="alert">{error}</p>}
      </section>}

      {job && resultReady && job.analysis && <section className="results-page">
        <div className="results-hero"><div><p className="eyebrow">YOUR REPORT / ANALYSIS COMPLETE</p><h1>先选适合的，<br />再看真实效果。</h1><p>{job.presentation?.consultantSummary.zh ?? "我先把更稳妥的方向替你排在前面，你可以从中选一款，再生成真人预览。"}</p></div>{job.originalUrl && <div className="original-frame"><img src={job.originalUrl} alt="原始肖像" /><span>ORIGINAL</span></div>}</div>
        {job.demoMode && <p className="demo-notice">演示模式：页面、报告与全部交互已启用；接入 API Key 后会生成真实换发型与发色图。</p>}
        <div className="analysis-strip">
          <Bi value={FACE_LABELS[job.analysis.faceShape]} /><Bi value={TEXTURE_LABELS[job.analysis.hairTexture]} /><Bi value={DENSITY_LABELS[job.analysis.hairDensity]} /><Bi value={HAIRLINE_LABELS[job.analysis.hairline]} /><Bi value={FOREHEAD_LABELS[job.analysis.foreheadRatio]} /><Bi value={UNDERTONE_LABELS[job.analysis.skinUndertone]} />
        </div>
        <div className="result-section-heading"><p className="eyebrow">01 / HAIRSTYLES</p><h2>{job.generationPolicy?.imagePreviewAvailable && !job.generationPolicy.selectedAssetId ? "先听建议，再选一款看真人效果" : "更适合你的发型方向"}</h2></div>
        <div className="barber-intro"><div><p className="eyebrow">SELECT FIRST / 先选后生成</p><h3>点“选这款”不会立刻生成。</h3></div><p>你可以先比较每款适合你的理由；确认选择后再生成一张真人预览。每份报告只锁定一款，避免误触和重复花费。</p></div>
        <div className="asset-grid">{recommendationAssets.map((asset) => <AssetCard asset={asset} job={job} selected={pendingAssetId === asset.id} key={asset.id} onSelect={setPendingAssetId} onRetry={retryAsset} onOpenBarberBrief={openBarberBrief} />)}</div>
        <div className="result-section-heading"><p className="eyebrow">02 / COLORS</p><h2>想换发色，也可以先选中再生成</h2></div>
        <div className="asset-grid color-grid">{colorAssets.map((asset) => <AssetCard asset={asset} job={job} selected={pendingAssetId === asset.id} key={asset.id} onSelect={setPendingAssetId} onRetry={retryAsset} onOpenBarberBrief={openBarberBrief} />)}</div>
        {job.generationPolicy?.imagePreviewAvailable && !job.generationPolicy.selectedAssetId && pendingAssetId && !["clarifying", "ready_to_confirm", "revising"].includes(job.consultation?.state ?? "") && <div className="generation-confirm has-selection" aria-live="polite">
          <div><p className="eyebrow">FINAL CONFIRMATION / 最后确认</p><h3>已选{pendingKind}：{pendingLabel?.zh}</h3><div className="generation-details">{pendingDetails.map((detail) => <span key={detail}>{detail}</span>)}</div><p>确认后才会锁定本次建议并开始生成；生成期间不能再修改建议，完成后会自动重排整张高清报告。</p></div>
          <button className="primary-button" disabled={Boolean(busyAsset)} onClick={() => void generateAsset(pendingAssetId)}>{busyAsset ? "正在提交…" : `生成「${pendingLabel?.zh}」完整预览 →`}</button>
        </div>}
        {!job.generationPolicy?.imagePreviewAvailable && !job.generationPolicy?.selectedAssetId && <p className="preview-unavailable-note">真人预览暂未开放。你仍然可以查看完整建议与下载文字版报告；开放后这里会出现“选中后生成”按钮。</p>}
        <div className="overall-card"><p className="eyebrow">OVERALL STYLE</p><h2>{job.analysis.styleTraitIds.map((id) => STYLE_TRAIT_LABELS[id]?.zh).filter(Boolean).join(" · ")}</h2><p>{styleLabel(job.analysis.hairstyleSlots[0].styleId).zh}优先，保留轻盈纹理与自然分缝。</p></div>
        {(job.consultation?.enabled || Boolean(job.consultation?.revisionsUsed)) && <div className={`consultation-panel state-${job.consultation?.state}`} ref={consultationRef}>
          <div className="consultation-heading"><div><p className="eyebrow">03 / PERSONAL CONSULTANT</p><h2>不太满意？告诉我想改哪里</h2></div><span>{job.consultation?.provider === "qwen" ? "千问顾问" : "GPT 顾问"} · 已调整 {job.consultation?.revisionsUsed ?? 0}/2 次</span></div>
          <p className="consultation-privacy">这里只沟通发型、发色和打理偏好。后续不会再次发送你的照片。</p>
          {job.consultation?.changeSummary && <div className="consultation-change"><b>上次调整</b><p>{job.consultation.changeSummary.zh}</p></div>}
          {job.consultation?.state === "locked" ? <p className="consultation-locked">真人预览已经开始，当前建议与图片已锁定，不能继续修改。</p> : <>
            {job.consultation?.messages.length ? <div className="consultation-messages" aria-live="polite">{job.consultation.messages.map((message, index) => <div className={message.role} key={`${message.role}:${index}`}><small>{message.role === "user" ? "你" : "发型顾问"}</small><p>{message.content}</p></div>)}</div> : <p className="consultation-intro">比如你可以说：“不想剪太短，早上没时间吹头发，也不喜欢厚刘海。”我会先确认你的真实想法，再重新排建议。</p>}
            {job.consultation?.state === "ready_to_confirm" && job.consultation.pendingPreferences && <div className="preference-confirm"><small>我理解的是</small><strong>{job.consultation.pendingPreferences.summaryZh}</strong><div><button className="primary-button" disabled={Boolean(consultationBusy)} onClick={() => void confirmConsultation()}>{consultationBusy === "confirm" ? "正在重新调整…" : "确认按这个调整 →"}</button><button className="secondary-button" disabled={Boolean(consultationBusy)} onClick={() => void cancelConsultation()}>保留原建议</button></div></div>}
            {(job.consultation?.turnsUsed ?? 0) < 2 && <>
              <div className="consultation-chips">{["不要太短", "尽量好打理", "不喜欢厚刘海", "想更自然一点", "发色变化小一点"].map((label) => <button disabled={Boolean(consultationBusy)} key={label} onClick={() => void sendConsultation(label)}>{label}</button>)}</div>
              <div className="consultation-composer"><textarea maxLength={500} value={consultationInput} onChange={(event) => setConsultationInput(event.target.value)} placeholder={job.consultation?.state === "ready_to_confirm" ? "还想补充什么？最多再沟通一轮" : "说说哪一处不符合你的想法…"} /><button className="primary-button" disabled={Boolean(consultationBusy) || !consultationInput.trim()} onClick={() => void sendConsultation()}>{consultationBusy === "message" ? "正在理解…" : "发送给顾问 →"}</button></div>
            </>}
          </>}
        </div>}
        {job.previewUrl && <div className="report-preview"><img src={job.previewUrl} alt="完整发型与发色分析报告预览" /><div><p className="eyebrow">READY TO SAVE</p><h2>{job.generationPolicy?.selectedAssetId ? "完整真人预览图已排好" : "你的建议报告已排好"}</h2><p>{job.generationPolicy?.selectedAssetId ? "所选真人效果、个性化理由、发型建议、发色色卡与整体风格都在一张 2160 × 3840 PNG 里。" : "当前是文字建议版；选中一款并生成后，会自动升级为带真人效果的完整预览图。"}</p><div className="ai-content-note"><strong>{job.generationPolicy?.selectedAssetId ? "AI 生成发型效果" : "AI 辅助建议"}</strong><span>图片带内容标识 · HAIRFORM 不将照片用于训练 · 效果不等同真实染剪结果</span></div><div className="report-actions"><button className="primary-button" onClick={downloadReport}>下载高清报告 ↓</button><button className="secondary-button" onClick={shareReport}>分享结果 ↗</button></div></div></div>}
        {["analysis_ready", "completed", "partial"].includes(job.status) && <div className="feedback-row"><div><p className="eyebrow">FEEDBACK</p><h3>这个结果对你有帮助吗？</h3></div><div><button disabled={feedback !== undefined} className={feedback === true ? "selected" : ""} onClick={() => void submitFeedback(true)}>有帮助</button><button disabled={feedback !== undefined} className={feedback === false ? "selected" : ""} onClick={() => void submitFeedback(false)}>没帮助</button></div></div>}
        {job.status === "partial" && <p className="error-banner">部分预览没有成功，你可以在对应卡片中单独重试。</p>}
        {job.status === "analysis_ready" && job.errorCode && <p className="error-banner">真人预览未能完成，文字分析、沟通卡和原始报告仍可正常使用。</p>}
        {error && <p className="error-banner" role="alert">{error}</p>}
        <div className="result-footer"><span>结果将在 {new Date(job.expiresAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 自动删除</span><button className="danger-button" onClick={deleteCurrentJob}>立即删除全部数据</button></div>
      </section>}

      {selectedBrief && selectedBriefImageUrl && <BarberBriefDialog brief={selectedBrief} imageUrl={selectedBriefImageUrl} busy={briefBusy} notice={briefNotice} onClose={closeBarberBrief} onCopy={() => void copyBarberBrief()} onDownload={() => void downloadBarberBrief()} onShare={() => void shareBarberBrief()} />}

      <footer className="footer"><span>型格 HAIRFORM</span><p>视觉建议，不构成医学、植发或专业理发结论。</p><small>AI MEN&apos;S HAIR REPORT · 2026</small></footer>
    </main>
  );
}
