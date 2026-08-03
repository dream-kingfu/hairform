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
import type { BilingualLabel, HairAnalysis, HairJobPresentation, HairPreferenceProfile, HairSlot } from "./types";

const bi = (zh: string, en: string): BilingualLabel => ({ zh, en });

const LENGTH_LABELS = {
  short: bi("短发", "Short"),
  medium: bi("中发", "Medium"),
  long: bi("长发", "Long"),
};

function preferenceLead(preferences?: HairPreferenceProfile) {
  if (!preferences) return "";
  if (preferences.maintenanceTolerance === "low") return "你提到不想花太多时间打理，所以我会优先保留自然成形、容易整理的方向。";
  if (preferences.fringePreference === "avoid") return "你不想要明显刘海，所以轮廓会更多依靠自然分缝和脸周层次。";
  if (preferences.fringePreference === "prefer") return "你希望保留刘海，所以我会让额前轮廓更柔和，但不做得太厚重。";
  if (preferences.preferredLengths.length) return `你更偏向${preferences.preferredLengths.map((item) => item === "short" ? "短发" : item === "medium" ? "中发" : "长发").join("或")}，所以我会把这个长度的可执行性放在前面。`;
  return "";
}

function visualObservation(analysis: HairAnalysis) {
  if (analysis.hairDensity === "low") return "从照片看，你的头发更需要保留完整感，不适合把层次打得太碎";
  if (analysis.hairDensity === "high") return "从照片看，你的发量条件足够，重点是把两侧重量收住、让头顶自然透气";
  if (analysis.hairline === "high" || analysis.hairline === "receding") return "从照片看，额前保留一点柔和轮廓，会比把发际线完全露出来更自然";
  if (analysis.faceShape === "round") return "从照片看，顶部留一点高度、两侧不要堆宽，整体比例会更舒展";
  if (analysis.faceShape === "oblong") return "从照片看，横向层次比一味把头顶做高更能平衡比例";
  return "从照片看，你更适合轮廓干净、层次不过度、回家也能自己复现的方向";
}

function firstChoiceTradeoff(length: keyof typeof LENGTH_LABELS) {
  if (length === "short") return "日常最省心，不过两侧长出后要稍微勤修轮廓";
  if (length === "long") return "氛围感更强，不过每天要多留几分钟吹整";
  return "变化比较自然，不过想维持轮廓，仍要定期修剪";
}

function styleAdvice(analysis: HairAnalysis, slot: HairSlot, styleName: string, preferences?: HairPreferenceProfile): BilingualLabel {
  const lead = preferenceLead(preferences);
  if (slot === "less_suitable") {
    const reason = analysis.hairDensity === "low"
      ? "它比较依赖发量和每天的造型支撑，稍不注意就容易显得扁或散。"
      : analysis.foreheadRatio === "long" || analysis.hairline === "high" || analysis.hairline === "receding"
        ? "它容易把额头和发际线全部露出来，视觉重心会偏高。"
        : "它对蓬松度和日常造型要求更高，效果不如前几款稳定。";
    return bi(`${lead}不是完全不能选「${styleName}」，只是${reason}如果很喜欢，建议先让理发师做小幅度版本。`, `Not impossible, but ${styleName} asks more from daily styling. Start with a softer version if you love it.`);
  }

  if (slot === "best_short") {
    const reason = analysis.hairDensity === "high"
      ? "你本身发量条件不错，把两侧收干净、头顶留一点纹理，会显得利落但不生硬。"
      : analysis.hairDensity === "low"
        ? "它不需要硬撑很高的蓬松度，保留轻层次反而会让头发看起来更完整。"
        : "它能把轮廓收得更干净，早上也不用花太多时间打理。";
    return bi(`${lead}如果你想先做一个不容易出错的改变，可以从「${styleName}」开始。${reason}`, `${styleName} is the safest first move: cleaner shape, natural texture, and easy daily upkeep.`);
  }

  if (slot === "best_medium") {
    const reason = analysis.faceShape === "round"
      ? "自然分缝和顶部层次能把视觉重心轻轻往上提，脸部线条会更舒展。"
      : analysis.faceShape === "oblong"
        ? "中等长度能保留一点横向层次，避免头顶堆得太高，比例会更平衡。"
        : analysis.hairline === "high" || analysis.hairline === "receding"
          ? "保留自然刘海会比完全露额更友好，看起来也不会刻意。"
          : "它会给脸周留一点柔和轮廓，有变化，但不会突然变成很难驾驭的风格。";
    return bi(`${lead}想保留更多造型空间，可以试试「${styleName}」。${reason}`, `${styleName} gives you more styling room while keeping the shape balanced and wearable.`);
  }

  const reason = analysis.hairTexture === "wavy" || analysis.hairTexture === "curly"
    ? "你的自然纹理会让长层次更有流动感，重点是控制厚重感，不要把层次打得太碎。"
    : analysis.hairDensity === "low"
      ? "可以留长，但层次不要打得太碎，保留发尾重量会更显完整。"
      : "长层次会更有氛围感，但需要愿意吹整和定期修轮廓。";
  return bi(`${lead}如果你愿意多花一点时间打理，「${styleName}」会是更有个性的选择。${reason}`, `${styleName} is the more expressive option if you are happy to spend a little more time styling it.`);
}

function colorAdvice(analysis: HairAnalysis, colorName: string, index: number, preferences?: HairPreferenceProfile): BilingualLabel {
  const tone = analysis.skinUndertone === "warm" ? "你的肤色偏暖，保留一点柔和暖感会更自然。"
    : analysis.skinUndertone === "cool" ? "你的肤色偏冷，控制红橙感会更干净。"
      : analysis.skinUndertone === "neutral" ? "你的肤色包容度比较高，重点是把饱和度压低。"
        : "先从低饱和、接近原生发色的方向开始，会更稳妥。";
  const preference = preferences?.colorChange === "none" ? "你想尽量保留原生发色，所以这次只建议非常克制的明度变化。"
    : preferences?.colorChange === "subtle" ? "你希望变化自然，所以会避开高饱和和明显漂浅。"
      : preferences?.colorChange === "noticeable" ? "你希望变化能被看出来，但仍以日常好驾驭为前提。" : "";
  return index === 0
    ? bi(`${preference}想稳妥一点，优先试「${colorName}」。${tone}它会增加一点通透感，但不会一下子改变整个人的感觉。`, `${colorName} is the safer first choice: subtle dimension without changing your overall look too abruptly.`)
    : bi(`${preference}如果想让变化再明显一点，可以选「${colorName}」。${tone}正式染之前先做一束测试，看看室内和自然光下是否都喜欢。`, `${colorName} gives a more visible change. Test a small section first and check it in indoor and natural light.`);
}

export function buildHairPresentation(analysis: HairAnalysis, preferences?: HairPreferenceProfile): HairJobPresentation {
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
      advice: styleAdvice(analysis, recommendation.slot, labels.style.zh, preferences),
      barberBrief: recommendation.slot === "less_suitable" ? undefined : buildBarberBrief(analysis, recommendation, labels),
    };
  });

  const colors = analysis.colors.map((color, index) => ({
    assetId: index === 0 ? "color_primary" as const : "color_secondary" as const,
    colorId: color.colorId,
    label: colorLabel(color.colorId),
    swatchHex: color.swatchHex,
    levelLabel: color.level ? bi(`${color.level}度`, `Level ${color.level}`) : bi("自然明度", "Natural Level"),
    advice: colorAdvice(analysis, colorLabel(color.colorId).zh, index, preferences),
  }));

  const firstChoice = hairstyles.find((item) => item.assetId === "best_short") ?? hairstyles[0];
  const firstChoiceLength = analysis.hairstyleSlots.find((item) => item.slot === firstChoice?.assetId);
  const catalogLength = firstChoiceLength ? getStyle(firstChoiceLength.styleId).length : "medium";
  const consultantSummary = bi(
    preferences
      ? `我听明白了：${preferences.summaryZh} 这版我已经按你的真实生活习惯重新取舍，先看理由，觉得对了再选一款生成真人效果。`
      : firstChoice
      ? `我先替你做个取舍：${visualObservation(analysis)}。所以第一款更建议「${firstChoice.styleLabel.zh}」；${firstChoiceTradeoff(catalogLength)}。`
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
