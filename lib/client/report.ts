import { DENSITY_LABELS, FACE_LABELS, FOREHEAD_LABELS, HAIRLINE_LABELS, STYLE_TRAIT_LABELS, TEXTURE_LABELS, UNDERTONE_LABELS } from "@/lib/hair/labels";
import type { BilingualLabel, HairJobView } from "@/lib/hair/types";

const WIDTH = 2160;
const HEIGHT = 3840;
const INK = "#171914";
const PAPER = "#f3f0e7";
const WHITE = "#fbfaf6";
const ACID = "#e6ff57";
const MUTED = "#74786b";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("report_image_failed")); image.src = src;
  });
}

function rounded(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath(); context.roundRect(x, y, width, height, radius);
}

function cover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, radius = 36) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale; const drawHeight = image.naturalHeight * scale;
  context.save(); rounded(context, x, y, width, height, radius); context.clip();
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight); context.restore();
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = INK, weight = 600) {
  context.fillStyle = color; context.font = `${weight} ${size}px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif`; context.fillText(value, x, y);
}

function wrap(context: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, size: number, lineHeight: number, maxLines = 2, color = INK, weight = 600) {
  context.font = `${weight} ${size}px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif`; context.fillStyle = color;
  const lines: string[] = []; let line = "";
  for (const char of Array.from(value)) {
    if (line && context.measureText(line + char).width > width) { lines.push(line); line = char; }
    else line += char;
    if (lines.length >= maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  lines.forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
}

function bilingual(context: CanvasRenderingContext2D, value: BilingualLabel, x: number, y: number, size = 30, color = INK) {
  text(context, value.zh, x, y, size, color, 760);
  text(context, value.en.toUpperCase(), x, y + size + 14, Math.max(17, Math.round(size * .46)), color === INK ? MUTED : "#a7ab9b", 600);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("report_export_failed")), type, quality));
}

export async function composeHairReport(job: HairJobView) {
  if (!job.analysis || !job.presentation || !job.originalUrl) throw new Error("job_not_composable");
  const selectedId = job.generationPolicy?.selectedAssetId;
  const selectedAsset = job.assets.find((asset) => asset.id === selectedId && asset.status === "ready" && asset.url);
  const selectedStyle = job.presentation.hairstyles.find((style) => style.assetId === selectedId);
  const selectedColor = job.presentation.colors.find((color) => color.assetId === selectedId);
  const selectedLabel = selectedStyle?.styleLabel ?? selectedColor?.label;
  const original = await loadImage(job.originalUrl);
  const preview = selectedAsset?.url ? await loadImage(selectedAsset.url) : undefined;
  const canvas = document.createElement("canvas"); canvas.width = WIDTH; canvas.height = HEIGHT;
  const context = canvas.getContext("2d"); if (!context) throw new Error("canvas_unavailable");
  context.fillStyle = PAPER; context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = INK; context.fillRect(0, 0, WIDTH, 240);
  text(context, "型格", 88, 108, 66, ACID, 850);
  text(context, "HAIRFORM / TEXT-FIRST HAIR REPORT", 88, 172, 25, PAPER, 650);
  text(context, preview ? (selectedColor ? "SELECTED COLOR PREVIEW" : "SELECTED STYLE PREVIEW") : "ONE ANALYSIS · ZERO IMAGE CALLS", 1530, 142, 21, ACID, 700);

  if (preview) {
    cover(context, original, 88, 318, 958, 900, 40); cover(context, preview, 1114, 318, 958, 900, 40);
    text(context, "原始肖像 / ORIGINAL", 88, 1260, 23, MUTED, 650);
    text(context, `${selectedColor ? "所选发色" : "所选发型"}：${selectedLabel?.zh ?? "真人预览"} / ${selectedLabel?.en.toUpperCase() ?? "PREVIEW"}`, 1114, 1260, 23, INK, 750);
    wrap(context, `发型顾问建议：${job.presentation.consultantSummary.zh}`, 88, 1350, 1984, 22, 30, 1, MUTED, 650);
  } else {
    cover(context, original, 88, 318, 690, 900, 40);
    text(context, "原始肖像 / ORIGINAL", 88, 1260, 23, MUTED, 650);
    text(context, "一次视觉分析，先把适合你的发型说清楚。", 850, 510, 66, INK, 850);
    text(context, "TEXT FIRST · CLEAR BEFORE GENERATING", 850, 575, 22, MUTED, 650);
    const traits: BilingualLabel[] = [
      FACE_LABELS[job.analysis.faceShape], TEXTURE_LABELS[job.analysis.hairTexture], DENSITY_LABELS[job.analysis.hairDensity],
      HAIRLINE_LABELS[job.analysis.hairline], FOREHEAD_LABELS[job.analysis.foreheadRatio], UNDERTONE_LABELS[job.analysis.skinUndertone],
    ];
    traits.forEach((trait, index) => {
      const x = 850 + (index % 2) * 600; const y = 665 + Math.floor(index / 2) * 160;
      context.fillStyle = index < 2 ? ACID : WHITE; rounded(context, x, y, 550, 125, 20); context.fill(); bilingual(context, trait, x + 24, y + 44, 27);
    });
  }

  text(context, "发型建议", 88, 1410, 52, INK, 850); text(context, "HAIRSTYLE RECOMMENDATIONS", 88, 1454, 20, MUTED, 650);
  job.presentation.hairstyles.forEach((style, index) => {
    const x = 88 + (index % 2) * 1002; const y = 1500 + Math.floor(index / 2) * 300;
    context.fillStyle = style.assetId === "less_suitable" ? "#dedbd1" : WHITE; rounded(context, x, y, 938, 260, 28); context.fill();
    bilingual(context, style.slotLabel, x + 30, y + 55, 24); bilingual(context, style.styleLabel, x + 360, y + 58, 34);
    bilingual(context, style.lengthLabel, x + 30, y + 160, 23); bilingual(context, style.fringeLabel, x + 340, y + 160, 23); bilingual(context, style.partLabel, x + 650, y + 160, 23);
    wrap(context, style.advice.zh, x + 30, y + 225, 865, 18, 24, 1, MUTED, 600);
  });

  text(context, "理发师沟通参数", 88, 2185, 50, INK, 850); text(context, "BARBER BRIEFS", 88, 2228, 20, MUTED, 650);
  job.presentation.hairstyles.filter((style) => style.assetId !== "less_suitable").forEach((style, index) => {
    const y = 2270 + index * 360;
    context.fillStyle = index === 0 ? INK : WHITE; rounded(context, 88, y, 1984, 320, 30); context.fill();
    const primary = index === 0 ? PAPER : INK; const secondary = index === 0 ? "#a7ab9b" : MUTED;
    bilingual(context, style.styleLabel, 130, y + 70, 34, primary);
    if (style.barberBrief) {
      text(context, "直接这样说 / SAY THIS", 680, y + 58, 18, index === 0 ? ACID : MUTED, 750);
      wrap(context, style.barberBrief.spokenZh, 680, y + 110, 1320, 27, 40, 2, primary, 650);
      const quick = style.barberBrief.rows.slice(0, 4).map((row) => `${row.label.zh}：${row.value.zh}`).join("  ·  ");
      wrap(context, quick, 680, y + 220, 1320, 21, 32, 2, secondary, 600);
    }
  });

  text(context, "发色色卡", 88, 3445, 44, INK, 850); text(context, "HAIR COLOR SWATCHES", 88, 3485, 18, MUTED, 650);
  job.presentation.colors.forEach((color, index) => {
    const x = 88 + index * 1002;
    context.fillStyle = WHITE; rounded(context, x, 3520, 938, 190, 28); context.fill();
    context.fillStyle = color.swatchHex; context.beginPath(); context.arc(x + 92, 3615, 50, 0, Math.PI * 2); context.fill();
    bilingual(context, color.label, x + 175, 3590, 32); bilingual(context, color.levelLabel, x + 635, 3590, 23);
    wrap(context, color.advice.zh, x + 175, 3686, 720, 17, 22, 1, MUTED, 550);
  });

  context.fillStyle = INK; context.fillRect(0, 3770, WIDTH, 70);
  const overall = job.analysis.styleTraitIds.map((id) => STYLE_TRAIT_LABELS[id]?.zh).filter(Boolean).join(" · ");
  text(context, overall || job.presentation.overallStyle.zh, 88, 3817, 23, PAPER, 750);
  text(context, "单张正面照视觉建议 · 非医学或植发结论", 1580, 3817, 17, "#a7ab9b", 550);

  const png = await toBlob(canvas, "image/png");
  const previewCanvas = document.createElement("canvas"); previewCanvas.width = 1080; previewCanvas.height = 1920;
  previewCanvas.getContext("2d")?.drawImage(canvas, 0, 0, 1080, 1920);
  return { png, webp: await toBlob(previewCanvas, "image/webp", .9) };
}
