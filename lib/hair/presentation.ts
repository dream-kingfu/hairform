import { buildBarberBrief } from "./barber-brief";
import { getStyle } from "./catalog";
import {
  DENSITY_LABELS,
  FACE_LABELS,
  FOREHEAD_LABELS,
  FRINGE_LABELS,
  HAIRLINE_LABELS,
  PART_LABELS,
  SLOT_LABELS,
  STYLE_TRAIT_LABELS,
  TEXTURE_LABELS,
  UNDERTONE_LABELS,
  colorLabel,
  styleLabel,
} from "./labels";
import type { BilingualLabel, HairAnalysis, HairJobPresentation, HairSlot } from "./types";

const bi = (zh: string, en: string): BilingualLabel => ({ zh, en });

const LENGTH_LABELS = {
  short: bi("短发", "Short"),
  medium: bi("中发", "Medium"),
  long: bi("长发", "Long"),
};

function styleAdvice(analysis: HairAnalysis, slot: HairSlot, styleName: string): BilingualLabel {
  if (slot === "less_suitable") {
    const reason = analysis.hairDensity === "low"
      ? "它比较依赖发量和每天的造型支撑，稍不注意就容易显得扁或散。"
      : analysis.foreheadRatio === "long" || analysis.hairline === "high" || analysis.hairline === "receding"
        ? "它容易把额头和发际线全部露出来，视觉重心会偏高。"
        : "它对蓬松度和日常造型要求更高，效果不如前几款稳定。";
    return bi(`不是完全不能选「${styleName}」，只是${reason}如果很喜欢，建议先让理发师做小幅度版本。`, `Not impossible, but ${styleName} asks more from daily styling. Start with a softer version if you love it.`);
  }

  if (slot === "best_short") {
    const reason = analysis.hairDensity === "high"
      ? "你本身发量条件不错，把两侧收干净、头顶留一点纹理，会显得利落但不生硬。"
      : analysis.hairDensity === "low"
        ? "它不需要硬撑很高的蓬松度，保留轻层次反而会让头发看起来更完整。"
        : "它能把轮廓收得更干净，早上也不用花太多时间打理。";
    return bi(`如果你想先做一个不容易出错的改变，可以从「${styleName}」开始。${reason}`, `${styleName} is the safest first move: cleaner shape, natural texture, and easy daily upkeep.`);
  }

  if (slot === "best_medium") {
    const reason = analysis.faceShape === "round"
      ? "自然分缝和顶部层次能把视觉重心轻轻往上提，脸部线条会更舒展。"
      : analysis.faceShape === "oblong"
        ? "中等长度能保留一点横向层次，避免头顶堆得太高，比例会更平衡。"
        : analysis.hairline === "high" || analysis.hairline === "receding"
          ? "保留自然刘海会比完全露额更友好，看起来也不会刻意。"
          : "它会给脸周留一点柔和轮廓，有变化，但不会突然变成很难驾驭的风格。";
    return bi(`想保留更多造型空间，可以试试「${styleName}」。${reason}`, `${styleName} gives you more styling room while keeping the shape balanced and wearable.`);
  }

  const reason = analysis.hairTexture === "wavy" || analysis.hairTexture === "curly"
    ? "你的自然纹理会让长层次更有流动感，重点是控制厚重感，不要把层次打得太碎。"
    : analysis.hairDensity === "low"
      ? "可以留长，但层次不要打得太碎，保留发尾重量会更显完整。"
      : "长层次会更有氛围感，但需要愿意吹整和定期修轮廓。";
  return bi(`如果你愿意多花一点时间打理，「${styleName}」会是更有个性的选择。${reason}`, `${styleName} is the more expressive option if you are happy to spend a little more time styling it.`);
}

function colorAdvice(analysis: HairAnalysis, colorName: string, index: number): BilingualLabel {
  const tone = analysis.skinUndertone === "warm" ? "你的肤色偏暖，保留一点柔和暖感会更自然。"
    : analysis.skinUndertone === "cool" ? "你的肤色偏冷，控制红橙感会更干净。"
      : analysis.skinUndertone === "neutral" ? "你的肤色包容度比较高，重点是把饱和度压低。"
        : "先从低饱和、接近原生发色的方向开始，会更稳妥。";
  return index === 0
    ? bi(`想稳妥一点，优先试「${colorName}」。${tone}它会增加一点通透感，但不会一下子改变整个人的感觉。`, `${colorName} is the safer first choice: subtle dimension without changing your overall look too abruptly.`)
    : bi(`如果想让变化再明显一点，可以选「${colorName}」。${tone}正式染之前先做一束测试，看看室内和自然光下是否都喜欢。`, `${colorName} gives a more visible change. Test a small section first and check it in indoor and natural light.`);
}

export function buildHairPresentation(analysis: HairAnalysis): HairJobPresentation {
  const traits: HairJobPresentation["traits"] = [
    { id: analysis.faceShape, kind: "faceShape", label: FACE_LABELS[analysis.faceShape] },
    { id: analysis.hairTexture, kind: "hairTexture", label: TEXTURE_LABELS[analysis.hairTexture] },
    { id: analysis.hairDensity, kind: "hairDensity", label: DENSITY_LABELS[analysis.hairDensity] },
    { id: analysis.hairline, kind: "hairline", label: HAIRLINE_LABELS[analysis.hairline] },
    { id: analysis.foreheadRatio, kind: "foreheadRatio", label: FOREHEAD_LABELS[analysis.foreheadRatio] },
    { id: analysis.skinUndertone, kind: "skinUndertone", label: UNDERTONE_LABELS[analysis.skinUndertone] },
    ...analysis.styleTraitIds.map((id) => ({ id, kind: "styleTrait" as const, label: STYLE_TRAIT_LABELS[id] })),
  ];

  const hairstyles = analysis.hairstyleSlots.map((recommendation) => {
    const style = getStyle(recommendation.styleId);
    const labels = {
      style: styleLabel(recommendation.styleId),
      fringe: FRINGE_LABELS[recommendation.fringeId],
      part: PART_LABELS[recommendation.partId],
    };
    return {
      assetId: recommendation.slot,
      slotLabel: SLOT_LABELS[recommendation.slot],
      styleId: recommendation.styleId,
      styleLabel: labels.style,
      lengthLabel: LENGTH_LABELS[style.length],
      fringeLabel: labels.fringe,
      partLabel: labels.part,
      advice: styleAdvice(analysis, recommendation.slot, labels.style.zh),
      barberBrief: recommendation.slot === "less_suitable" ? undefined : buildBarberBrief(analysis, recommendation, labels),
    };
  });

  const colors = analysis.colors.map((color, index) => ({
    assetId: index === 0 ? "color_primary" as const : "color_secondary" as const,
    colorId: color.colorId,
    label: colorLabel(color.colorId),
    swatchHex: color.swatchHex,
    levelLabel: color.level ? bi(`${color.level}度`, `Level ${color.level}`) : bi("自然明度", "Natural Level"),
    advice: colorAdvice(analysis, colorLabel(color.colorId).zh, index),
  }));

  const firstChoice = hairstyles.find((item) => item.assetId === "best_short") ?? hairstyles[0];
  const consultantSummary = bi(
    firstChoice
      ? `如果先替你做一个稳妥决定，我会从「${firstChoice.styleLabel.zh}」开始。它更容易和你现在的脸型、发量相处，也方便回家自己打理。`
      : "先从自然、好打理的方向开始，再慢慢增加变化。",
    firstChoice
      ? `My safest starting point is ${firstChoice.styleLabel.en}: balanced for your current features and manageable at home.`
      : "Start natural and manageable, then add more personality once the shape feels right.",
  );

  return {
    traits,
    hairstyles,
    colors,
    overallStyle: bi("清爽结构感 · 轻盈纹理 · 自然分缝", "Clean Structure · Airy Texture · Natural Part"),
    consultantSummary,
  };
}
