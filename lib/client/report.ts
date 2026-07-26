import { FACE_LABELS, HAIRLINE_LABELS, STYLE_TRAIT_LABELS, TEXTURE_LABELS, UNDERTONE_LABELS } from "@/lib/hair/labels";
import type { BilingualLabel, HairJobView } from "@/lib/hair/types";

const WIDTH = 2160;
const HEIGHT = 3840;
const INK = "#171914";
const PAPER = "#f3f0e7";
const ACID = "#e6ff57";
const MUTED = "#74786b";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("report_image_failed"));
    image.src = src;
  });
}

function rounded(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath(); context.roundRect(x, y, width, height, radius);
}

function cover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, radius = 36) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.save(); rounded(context, x, y, width, height, radius); context.clip();
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = INK, weight = 600) {
  context.fillStyle = color;
  context.font = `${weight} ${size}px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif`;
  context.fillText(value, x, y);
}

function wrapped(context: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, size: number, lineHeight: number, maxLines = 3, color = INK, weight = 600) {
  context.font = `${weight} ${size}px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif`;
  context.fillStyle = color;
  const chars = Array.from(value);
  const lines: string[] = [];
  let line = "";
  for (const char of chars) {
    if (line && context.measureText(line + char).width > maxWidth) { lines.push(line); line = char; }
    else line += char;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
}

function bilingual(context: CanvasRenderingContext2D, value: BilingualLabel, x: number, y: number, size = 34) {
  text(context, value.zh, x, y, size, INK, 750);
  text(context, value.en.toUpperCase(), x, y + size + 18, Math.max(18, Math.round(size * 0.48)), MUTED, 600);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("report_export_failed")), type, quality));
}

export async function composeHairReport(job: HairJobView) {
  const selectedId = job.generationPolicy?.selectedAssetId;
  const selectedAsset = job.assets.find((asset) => asset.id === selectedId && asset.status === "ready" && asset.url);
  const selected = job.presentation?.hairstyles.find((style) => style.assetId === selectedId);
  if (!job.analysis || !job.presentation || !job.originalUrl || !selectedAsset?.url || !selected) throw new Error("job_not_composable");
  const [original, preview] = await Promise.all([loadImage(job.originalUrl), loadImage(selectedAsset.url)]);
  const canvas = document.createElement("canvas"); canvas.width = WIDTH; canvas.height = HEIGHT;
  const context = canvas.getContext("2d"); if (!context) throw new Error("canvas_unavailable");
  context.fillStyle = PAPER; context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = INK; context.fillRect(0, 0, WIDTH, 250);
  text(context, "型格", 92, 112, 66, ACID, 800);
  text(context, "HAIRFORM / SINGLE PREVIEW REPORT", 92, 176, 26, PAPER, 650);
  text(context, "V0.3 · 24H PRIVATE", 1685, 145, 24, ACID, 700);

  cover(context, original, 88, 330, 958, 1110, 42);
  cover(context, preview, 1114, 330, 958, 1110, 42);
  text(context, "原始肖像 / ORIGINAL", 88, 1490, 24, MUTED, 650);
  text(context, `${selected.slotLabel.zh} / ${selected.slotLabel.en.toUpperCase()}`, 1114, 1490, 24, INK, 750);

  text(context, "视觉分析", 88, 1610, 52, INK, 800);
  text(context, "VISUAL PROFILE", 88, 1655, 21, MUTED, 650);
  const tags: BilingualLabel[] = [
    FACE_LABELS[job.analysis.faceShape], TEXTURE_LABELS[job.analysis.hairTexture],
    HAIRLINE_LABELS[job.analysis.hairline], UNDERTONE_LABELS[job.analysis.skinUndertone],
    ...job.analysis.styleTraitIds.slice(0, 2).map((id) => STYLE_TRAIT_LABELS[id]),
  ];
  tags.forEach((tag, index) => {
    const x = 88 + (index % 3) * 674; const y = 1710 + Math.floor(index / 3) * 130;
    context.fillStyle = index < 4 ? ACID : "#dedbd1"; rounded(context, x, y, 626, 100, 18); context.fill();
    bilingual(context, tag, x + 25, y + 38, 26);
  });

  text(context, "所选发型", 88, 2050, 52, INK, 800);
  text(context, "SELECTED STYLE", 88, 2095, 21, MUTED, 650);
  context.fillStyle = "#fff"; rounded(context, 88, 2150, 1984, 330, 36); context.fill();
  bilingual(context, selected.styleLabel, 142, 2230, 50);
  bilingual(context, selected.lengthLabel, 880, 2225, 28);
  bilingual(context, selected.fringeLabel, 1280, 2225, 28);
  bilingual(context, selected.partLabel, 1650, 2225, 28);
  if (selected.barberBrief) {
    text(context, "给理发师这样说 / BARBER BRIEF", 142, 2370, 22, MUTED, 700);
    wrapped(context, selected.barberBrief.spokenZh, 142, 2425, 1840, 28, 40, 2, INK, 650);
  }

  text(context, "其他建议", 88, 2605, 52, INK, 800);
  text(context, "OTHER RECOMMENDATIONS", 88, 2650, 21, MUTED, 650);
  job.presentation.hairstyles.forEach((style, index) => {
    const x = 88 + (index % 2) * 1002; const y = 2705 + Math.floor(index / 2) * 230;
    context.fillStyle = style.assetId === "less_suitable" ? "#dedbd1" : "#fff"; rounded(context, x, y, 938, 190, 28); context.fill();
    bilingual(context, style.slotLabel, x + 28, y + 54, 25);
    bilingual(context, style.styleLabel, x + 390, y + 54, 30);
  });

  text(context, "发色色卡", 88, 3260, 46, INK, 800);
  text(context, "HAIR COLOR SWATCHES", 88, 3300, 19, MUTED, 650);
  job.presentation.colors.forEach((color, index) => {
    const x = 88 + index * 1002;
    context.fillStyle = "#fff"; rounded(context, x, 3340, 938, 210, 30); context.fill();
    context.fillStyle = color.swatchHex; context.beginPath(); context.arc(x + 92, 3445, 52, 0, Math.PI * 2); context.fill();
    bilingual(context, color.label, x + 180, 3418, 34);
    bilingual(context, color.levelLabel, x + 610, 3418, 24);
  });

  context.fillStyle = INK; rounded(context, 88, 3610, 1984, 150, 30); context.fill();
  text(context, job.presentation.overallStyle.zh, 132, 3680, 34, PAPER, 800);
  text(context, job.presentation.overallStyle.en, 132, 3725, 18, "#a7ab9b", 600);
  text(context, "单张正面照视觉建议 · 非医学或植发结论", 1480, 3725, 17, "#a7ab9b", 550);

  const png = await toBlob(canvas, "image/png");
  const previewCanvas = document.createElement("canvas"); previewCanvas.width = 1080; previewCanvas.height = 1920;
  previewCanvas.getContext("2d")?.drawImage(canvas, 0, 0, 1080, 1920);
  const webp = await toBlob(previewCanvas, "image/webp", 0.9);
  return { png, webp };
}
