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
import type { BilingualLabel, HairAnalysis, HairJobPresentation } from "./types";

const bi = (zh: string, en: string): BilingualLabel => ({ zh, en });

const LENGTH_LABELS = {
  short: bi("短发", "Short"),
  medium: bi("中发", "Medium"),
  long: bi("长发", "Long"),
};

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
      barberBrief: recommendation.slot === "less_suitable" ? undefined : buildBarberBrief(analysis, recommendation, labels),
    };
  });

  const colors = analysis.colors.map((color, index) => ({
    assetId: index === 0 ? "color_primary" as const : "color_secondary" as const,
    colorId: color.colorId,
    label: colorLabel(color.colorId),
    swatchHex: color.swatchHex,
    levelLabel: color.level ? bi(`${color.level}度`, `Level ${color.level}`) : bi("自然明度", "Natural Level"),
  }));

  return {
    traits,
    hairstyles,
    colors,
    overallStyle: bi("清爽结构感 · 轻盈纹理 · 自然分缝", "Clean Structure · Airy Texture · Natural Part"),
  };
}
