import { getColor } from "@/lib/hair/catalog";
import { FACE_LABELS, FRINGE_LABELS, HAIRLINE_LABELS, PART_LABELS, SLOT_LABELS, STYLE_TRAIT_LABELS, TEXTURE_LABELS, UNDERTONE_LABELS, colorLabel, styleLabel } from "@/lib/hair/labels";
import type { BilingualLabel, HairJobView } from "@/lib/hair/types";

const WIDTH = 2160;
const HEIGHT = 3840;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("report_image_failed"));
    image.src = src;
  });
}

function rounded(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function cover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, radius = 36) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.save();
  rounded(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = "#171914", weight = 600) {
  context.fillStyle = color;
  context.font = `${weight} ${size}px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif`;
  context.fillText(value, x, y);
}

function bilingual(context: CanvasRenderingContext2D, value: BilingualLabel, x: number, y: number, size = 34) {
  text(context, value.zh, x, y, size, "#171914", 700);
  text(context, value.en.toUpperCase(), x, y + size + 18, Math.max(18, Math.round(size * 0.48)), "#74786b", 600);
}

function chip(context: CanvasRenderingContext2D, value: BilingualLabel, x: number, y: number, width: number) {
  context.fillStyle = "#e6ff57";
  rounded(context, x, y, width, 98, 49);
  context.fill();
  bilingual(context, value, x + 28, y + 38, 27);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("report_export_failed")), type, quality));
}

export async function composeHairReport(job: HairJobView) {
  if (!job.analysis || !job.originalUrl) throw new Error("job_not_composable");
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  const original = await loadImage(job.originalUrl);
  const imageMap = new Map<string, HTMLImageElement>();
  await Promise.all(job.assets.filter((asset) => asset.status === "ready" && asset.url).map(async (asset) => {
    try { imageMap.set(asset.id, await loadImage(asset.url!)); } catch { imageMap.set(asset.id, original); }
  }));

  context.fillStyle = "#f3f0e7";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = "#171914";
  context.fillRect(0, 0, WIDTH, 250);
  text(context, "型格", 92, 112, 66, "#e6ff57", 800);
  text(context, "HAIRFORM / AI MEN'S HAIR REPORT", 92, 176, 26, "#f3f0e7", 600);
  text(context, "01 / VISUAL ESTIMATE", 1625, 116, 25, "#a7ab9b", 600);
  if (job.demoMode) text(context, "DEMO MODE", 1788, 176, 24, "#e6ff57", 700);

  cover(context, original, 88, 330, 660, 720, 44);
  text(context, "原始肖像 / ORIGINAL", 88, 1108, 25, "#74786b", 600);
  text(context, "你的视觉特征", 820, 400, 56, "#171914", 800);
  text(context, "YOUR VISUAL PROFILE", 820, 448, 21, "#74786b", 600);
  const tags: BilingualLabel[] = [
    FACE_LABELS[job.analysis.faceShape], TEXTURE_LABELS[job.analysis.hairTexture],
    HAIRLINE_LABELS[job.analysis.hairline], UNDERTONE_LABELS[job.analysis.skinUndertone],
    ...job.analysis.styleTraitIds.slice(0, 2).map((id) => STYLE_TRAIT_LABELS[id]),
  ];
  tags.forEach((item, index) => chip(context, item, 820 + (index % 2) * 610, 520 + Math.floor(index / 2) * 142, 560));
  text(context, "基于单张正面照片 · 结果仅供造型参考", 820, 1025, 24, "#74786b", 500);

  text(context, "发型对比", 88, 1220, 54, "#171914", 800);
  text(context, "HAIRSTYLE COMPARISON", 88, 1265, 21, "#74786b", 600);
  const slots = ["best_short", "best_medium", "best_long", "less_suitable"] as const;
  slots.forEach((slot, index) => {
    const recommendation = job.analysis!.hairstyleSlots.find((item) => item.slot === slot)!;
    const x = 88 + (index % 2) * 1002;
    const y = 1325 + Math.floor(index / 2) * 640;
    context.fillStyle = slot === "less_suitable" ? "#dedbd1" : "#ffffff";
    rounded(context, x, y, 938, 590, 40);
    context.fill();
    cover(context, imageMap.get(slot) ?? original, x + 24, y + 24, 438, 542, 28);
    bilingual(context, SLOT_LABELS[slot], x + 500, y + 86, 31);
    bilingual(context, styleLabel(recommendation.styleId), x + 500, y + 190, 38);
    bilingual(context, FRINGE_LABELS[recommendation.fringeId], x + 500, y + 330, 26);
    bilingual(context, PART_LABELS[recommendation.partId], x + 500, y + 430, 26);
  });

  text(context, "发色辅助", 88, 2630, 54, "#171914", 800);
  text(context, "HAIR COLOR SUPPORT", 88, 2675, 21, "#74786b", 600);
  ["color_primary", "color_secondary"].forEach((id, index) => {
    const color = job.analysis!.colors[index];
    const x = 88 + index * 1002;
    const y = 2735;
    context.fillStyle = "#ffffff";
    rounded(context, x, y, 938, 540, 40);
    context.fill();
    cover(context, imageMap.get(id) ?? original, x + 24, y + 24, 430, 492, 28);
    context.fillStyle = getColor(color.colorId).hex;
    context.beginPath();
    context.arc(x + 520, y + 102, 38, 0, Math.PI * 2);
    context.fill();
    bilingual(context, colorLabel(color.colorId), x + 580, y + 90, 36);
    text(context, color.level ? `${color.level} 度 / LEVEL ${color.level}` : "自然明度 / NATURAL", x + 500, y + 230, 25, "#74786b", 600);
    text(context, index === 0 ? "低调耐看" : "提亮气色", x + 500, y + 325, 31, "#171914", 700);
    text(context, index === 0 ? "SUBTLE" : "BRIGHTENING", x + 500, y + 366, 19, "#74786b", 600);
  });

  context.fillStyle = "#171914";
  rounded(context, 88, 3360, 1984, 370, 44);
  context.fill();
  const best = job.analysis.hairstyleSlots.find((item) => item.slot === "best_short")!;
  text(context, "OVERALL STYLE", 142, 3440, 23, "#e6ff57", 700);
  text(context, "清爽结构感 · 轻盈纹理 · 自然分缝", 142, 3525, 48, "#f3f0e7", 800);
  text(context, `${styleLabel(best.styleId).zh} / ${styleLabel(best.styleId).en}`, 142, 3602, 29, "#a7ab9b", 600);
  text(context, "本报告为视觉建议，不构成医学、植发或专业理发结论。", 142, 3683, 21, "#74786b", 500);
  text(context, "HAIRFORM · 24H PRIVATE RESULT", 1640, 3683, 19, "#74786b", 600);

  const png = await toBlob(canvas, "image/png");
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = 1080;
  previewCanvas.height = 1920;
  previewCanvas.getContext("2d")?.drawImage(canvas, 0, 0, 1080, 1920);
  const webp = await toBlob(previewCanvas, "image/webp", 0.9);
  return { png, webp };
}
