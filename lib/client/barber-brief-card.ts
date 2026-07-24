import type { BarberBrief } from "@/lib/hair/barber-brief";

const WIDTH = 1080;
const HEIGHT = 1920;
const INK = "#171914";
const PAPER = "#f3f0e7";
const PAPER_DEEP = "#dedbd1";
const ACID = "#e6ff57";
const MUTED = "#74786b";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("barber_brief_image_failed"));
    image.src = src;
  });
}

function rounded(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function cover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, radius: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.save();
  rounded(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function setFont(context: CanvasRenderingContext2D, size: number, weight = 600) {
  context.font = `${weight} ${size}px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif`;
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = INK, weight = 600) {
  context.fillStyle = color;
  setFont(context, size, weight);
  context.fillText(value, x, y);
}

function tokensFor(value: string) {
  return value.includes(" ") ? value.split(/(\s+)/).filter(Boolean) : Array.from(value);
}

function wrappedLines(context: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number) {
  const tokens = tokensFor(value);
  const lines: string[] = [];
  let line = "";
  let truncated = false;
  for (const token of tokens) {
    const next = line + token;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line.trim());
      line = token.trimStart();
      if (lines.length === maxLines) { truncated = true; break; }
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  if (truncated) {
    const last = lines.length - 1;
    while (lines[last].length > 1 && context.measureText(`${lines[last]}…`).width > maxWidth) lines[last] = lines[last].slice(0, -1);
    lines[last] = `${lines[last]}…`;
  }
  return lines;
}

function wrappedText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
  color = INK,
  weight = 600,
  maxLines = 4,
) {
  context.fillStyle = color;
  setFont(context, size, weight);
  const lines = wrappedLines(context, value, maxWidth, maxLines);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("barber_brief_export_failed")), "image/png"));
}

export async function composeBarberBriefCard(brief: BarberBrief, imageUrl: string) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");

  context.fillStyle = PAPER;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = INK;
  context.fillRect(0, 0, WIDTH, 136);
  text(context, "型格", 58, 66, 40, ACID, 800);
  text(context, "HAIRFORM", 58, 105, 16, PAPER, 700);
  text(context, "理发师沟通卡 / BARBER BRIEF", 598, 78, 22, PAPER, 700);

  cover(context, image, 58, 180, 414, 620, 28);
  context.fillStyle = ACID;
  rounded(context, 78, 730, 170, 44, 22);
  context.fill();
  text(context, "REFERENCE", 104, 760, 14, INK, 800);

  text(context, "目标发型", 520, 218, 20, MUTED, 700);
  text(context, "TARGET STYLE", 520, 250, 13, MUTED, 700);
  wrappedText(context, brief.styleName.zh, 520, 324, 500, 52, 64, INK, 800, 2);
  wrappedText(context, brief.styleName.en.toUpperCase(), 520, 386, 500, 18, 26, MUTED, 700, 2);

  context.fillStyle = INK;
  rounded(context, 510, 444, 512, 356, 28);
  context.fill();
  text(context, "直接这样说", 548, 494, 20, ACID, 800);
  text(context, "SAY THIS", 548, 524, 13, "#a7ab9b", 700);
  wrappedText(context, `“${brief.spokenZh}”`, 548, 574, 436, 24, 37, PAPER, 700, 5);

  brief.rows.forEach((row, index) => {
    const column = index % 2;
    const line = Math.floor(index / 2);
    const x = 58 + column * 504;
    const y = 850 + line * 226;
    context.fillStyle = "#ffffff";
    rounded(context, x, y, 462, 202, 22);
    context.fill();
    text(context, row.label.zh, x + 24, y + 36, 19, INK, 800);
    text(context, row.label.en, x + 24, y + 59, 11, MUTED, 700);
    const zhEnd = wrappedText(context, row.value.zh, x + 24, y + 95, 414, 21, 30, INK, 650, 3);
    wrappedText(context, row.value.en, x + 24, Math.max(y + 153, zhEnd + 3), 414, 13, 18, MUTED, 550, 2);
  });

  context.fillStyle = "#f0ddda";
  rounded(context, 58, 1542, 964, 134, 22);
  context.fill();
  text(context, "避免 / AVOID", 82, 1582, 17, "#8b3e31", 800);
  const avoidZhEnd = wrappedText(context, brief.avoid.zh, 82, 1620, 916, 20, 28, "#6d332a", 650, 2);
  wrappedText(context, brief.avoid.en, 82, Math.max(1650, avoidZhEnd), 916, 13, 18, "#8b5b52", 550, 1);

  context.fillStyle = PAPER_DEEP;
  rounded(context, 58, 1700, 964, 126, 22);
  context.fill();
  text(context, "现场确认 / CONFIRM IN PERSON", 82, 1740, 17, INK, 800);
  const confirmZhEnd = wrappedText(context, brief.confirm.zh, 82, 1778, 916, 18, 26, INK, 600, 2);
  wrappedText(context, brief.confirm.en, 82, Math.max(1806, confirmZhEnd), 916, 12, 17, MUTED, 550, 1);

  text(context, "以参考图为目标，理发师可根据实际头型与发流微调。", 58, 1880, 15, MUTED, 600);
  text(context, "VISUAL GUIDE · ADJUST TO HEAD SHAPE & GROWTH", 622, 1880, 12, MUTED, 700);
  return toBlob(canvas);
}
