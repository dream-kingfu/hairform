import { getColor, getStyle } from "./catalog";
import type { BilingualLabel, HairAnalysis, HairSlot } from "./types";

const label = (zh: string, en: string): BilingualLabel => ({ zh, en });

export const FACE_LABELS: Record<string, BilingualLabel> = {
  oval: label("鹅蛋脸", "Oval"), round: label("圆脸", "Round"), square: label("方脸", "Square"),
  heart: label("心形脸", "Heart"), oblong: label("长脸", "Oblong"), diamond: label("菱形脸", "Diamond"),
  mixed: label("混合脸型", "Mixed"), unknown: label("无法判断", "Unclear"),
};
export const TEXTURE_LABELS: Record<string, BilingualLabel> = {
  straight: label("直发", "Straight"), wavy: label("波浪发", "Wavy"), curly: label("卷发", "Curly"),
  coily: label("紧密卷发", "Coily"), unknown: label("无法判断", "Unclear"),
};
export const DENSITY_LABELS: Record<string, BilingualLabel> = {
  low: label("发量偏少", "Light"), medium: label("发量中等", "Medium"), high: label("发量偏多", "Full"),
  unknown: label("无法判断", "Unclear"),
};
export const HAIRLINE_LABELS: Record<string, BilingualLabel> = {
  low: label("低发际线", "Low Hairline"), balanced: label("发际线均衡", "Balanced"), high: label("高发际线", "High Hairline"),
  receding: label("发际线后移", "Receding"), widows_peak: label("美人尖", "Widow's Peak"), unknown: label("无法判断", "Unclear"),
};
export const FOREHEAD_LABELS: Record<string, BilingualLabel> = {
  short: label("短额头", "Short Forehead"), balanced: label("额头均衡", "Balanced"), long: label("长额头", "Long Forehead"),
  unknown: label("无法判断", "Unclear"),
};
export const UNDERTONE_LABELS: Record<string, BilingualLabel> = {
  warm: label("暖调", "Warm"), cool: label("冷调", "Cool"), neutral: label("中性调", "Neutral"),
  unknown: label("无法判断", "Unclear"),
};
export const SLOT_LABELS: Record<HairSlot, BilingualLabel> = {
  best_short: label("最佳短发", "Best Short"), best_medium: label("最佳中发", "Best Medium"),
  best_long: label("最佳长发", "Best Long"), less_suitable: label("谨慎选择", "Less Suitable"),
};
export const FRINGE_LABELS: Record<string, BilingualLabel> = {
  none: label("无刘海", "No Fringe"), soft_fringe: label("轻薄刘海", "Soft Fringe"), french: label("法式短刘海", "French Fringe"),
  upswept: label("上梳", "Upswept"), comma: label("逗号刘海", "Comma Fringe"), side_swept: label("侧扫刘海", "Side Fringe"),
  curtain: label("八字刘海", "Curtain Fringe"),
};
export const PART_LABELS: Record<string, BilingualLabel> = {
  natural: label("自然分缝", "Natural Part"), side: label("侧分", "Side Part"), middle: label("中分", "Middle Part"),
  back: label("向后梳", "Swept Back"), none: label("无分缝", "No Part"),
};
export const STYLE_TRAIT_LABELS: Record<string, BilingualLabel> = {
  clean: label("清爽利落", "Clean"), modern: label("现代简约", "Modern"), soft: label("柔和亲近", "Soft"),
  mature: label("成熟稳重", "Mature"), sporty: label("运动活力", "Sporty"), editorial: label("时髦个性", "Editorial"),
};

export function styleLabel(styleId: string) {
  const style = getStyle(styleId);
  return label(style.zh, style.en);
}

export function colorLabel(colorId: string) {
  const color = getColor(colorId);
  return label(color.zh, color.en);
}

export function analysisTags(analysis: HairAnalysis) {
  return [
    FACE_LABELS[analysis.faceShape],
    TEXTURE_LABELS[analysis.hairTexture],
    DENSITY_LABELS[analysis.hairDensity],
    HAIRLINE_LABELS[analysis.hairline],
    FOREHEAD_LABELS[analysis.foreheadRatio],
    UNDERTONE_LABELS[analysis.skinUndertone],
  ];
}
