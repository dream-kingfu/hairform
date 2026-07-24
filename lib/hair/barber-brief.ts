import type { BilingualLabel, HairAnalysis, HairstyleRecommendation } from "./types";

const bi = (zh: string, en: string): BilingualLabel => ({ zh, en });

export interface BarberBriefSpec {
  styleId: string;
  top: BilingualLabel;
  sidesBack: BilingualLabel;
  layersTexture: BilingualLabel;
  baseThinning: BilingualLabel;
  styling: BilingualLabel;
  avoid: BilingualLabel;
  avoidShortZh: string;
}

export interface BarberBriefRow {
  id: "top" | "sides_back" | "fringe_part" | "layers_texture" | "thinning" | "styling";
  label: BilingualLabel;
  value: BilingualLabel;
}

export interface BarberBrief {
  styleId: string;
  styleName: BilingualLabel;
  spokenZh: string;
  rows: BarberBriefRow[];
  avoid: BilingualLabel;
  confirm: BilingualLabel;
}

export interface BarberBriefLabels {
  style: BilingualLabel;
  fringe: BilingualLabel;
  part: BilingualLabel;
}

export const BARBER_BRIEF_CATALOG: Record<string, BarberBriefSpec> = {
  textured_crop: {
    styleId: "textured_crop",
    top: bi("顶部保留4–6cm，刘海保留2–3cm", "Keep 4–6cm on top and 2–3cm at the fringe"),
    sidesBack: bi("耳周和后颈做6–12mm低渐变", "Use a 6–12mm low taper around the ears and neckline"),
    layersTexture: bi("发尾剪出轻碎纹理，保持自然向前", "Add light separated texture through the ends with natural forward movement"),
    baseThinning: bi("只在发尾轻度去量，不从发根打薄", "Remove a little weight at the ends only; do not thin from the roots"),
    styling: bi("吹干后使用少量哑光发泥或发蜡", "Blow-dry, then use a small amount of matte clay or wax"),
    avoid: bi("不要推成贴皮渐变，也不要剪成厚重整齐的一条刘海", "Avoid a skin fade and a heavy ruler-straight fringe"),
    avoidShortZh: "不要推成贴皮，也不要从发根打薄",
  },
  french_crop: {
    styleId: "french_crop",
    top: bi("顶部保留3–5cm，刘海保留1.5–2.5cm", "Keep 3–5cm on top and 1.5–2.5cm at the fringe"),
    sidesBack: bi("两侧和后区做3–9mm低渐变", "Use a 3–9mm low taper on the sides and back"),
    layersTexture: bi("顶部向前整理，刘海边缘做柔和碎感", "Direct the top forward and soften the fringe edge with texture"),
    baseThinning: bi("顶部只做轻度纹理，不挖空内部重量", "Add light texture on top without hollowing out the interior"),
    styling: bi("使用少量哑光发泥，保持干爽纹理", "Use a small amount of matte clay for a dry textured finish"),
    avoid: bi("避免厚重齐刘海和位置过高的贴皮渐变", "Avoid a heavy blunt fringe and a high skin fade"),
    avoidShortZh: "避免厚重齐刘海和高贴皮渐变",
  },
  crew_cut: {
    styleId: "crew_cut",
    top: bi("前区保留3–4cm，头顶与后冠保留2–3cm", "Keep 3–4cm at the front and 2–3cm through the crown"),
    sidesBack: bi("两侧和后区做3–9mm自然渐变", "Use a natural 3–9mm taper on the sides and back"),
    layersTexture: bi("顶部随头型柔和衔接，前区保留轻微支撑", "Blend the top to the head shape and keep slight support at the front"),
    baseThinning: bi("只修整重量，不把顶部剪得稀薄", "Balance the weight without making the top look sparse"),
    styling: bi("可自然吹干，或使用少量哑光发蜡", "Air-dry or use a small amount of matte wax"),
    avoid: bi("保留自然发际线，不要向后重画边线或擅自推成零毫米", "Keep the natural hairline; do not push it back or take the sides to zero"),
    avoidShortZh: "保留自然发际线，不要擅自推成零毫米",
  },
  ivy_league: {
    styleId: "ivy_league",
    top: bi("顶部和前区保留5–7cm", "Keep 5–7cm through the top and front"),
    sidesBack: bi("两侧后区保留6–12mm并柔和衔接", "Keep 6–12mm on the sides and back with a soft blend"),
    layersTexture: bi("前区保留侧梳空间，轮廓整洁但不过度贴头", "Leave enough length to sweep the front aside with a clean, soft outline"),
    baseThinning: bi("轻度调整顶部重量，前区保持完整", "Lightly balance the top while preserving fullness at the front"),
    styling: bi("顺着分缝吹干，使用轻质发蜡或造型霜", "Blow-dry along the part and use a light wax or styling cream"),
    avoid: bi("不要剃硬分缝，也不要把两侧推成过高贴皮渐变", "Avoid a shaved hard part and an overly high skin fade"),
    avoidShortZh: "不要剃硬分缝，也不要做高贴皮渐变",
  },
  short_quiff: {
    styleId: "short_quiff",
    top: bi("前区保留6–8cm，头顶保留4–5cm", "Keep 6–8cm at the front and 4–5cm on top"),
    sidesBack: bi("耳周和后颈做6–12mm低渐变", "Use a 6–12mm low taper around the ears and neckline"),
    layersTexture: bi("前区保留向上支撑，顶部向后逐渐变短", "Preserve lift at the front and graduate shorter toward the crown"),
    baseThinning: bi("保留前区密度，只在发尾做轻度纹理", "Preserve density at the front and texture the ends lightly"),
    styling: bi("先逆向吹出高度，再用哑光发泥固定", "Blow-dry upward for lift, then set with matte clay"),
    avoid: bi("不要把前区打薄过头，也不要把渐变推得太高", "Do not over-thin the front or take the taper too high"),
    avoidShortZh: "不要过度打薄前区，也不要把渐变推太高",
  },
  comma_hair: {
    styleId: "comma_hair",
    top: bi("前区保留9–11cm，头顶保留7–9cm", "Keep 9–11cm at the front and 7–9cm on top"),
    sidesBack: bi("两侧后区用剪刀保留2–4cm并柔和衔接", "Scissor-cut the sides and back to 2–4cm with a soft blend"),
    layersTexture: bi("前区保留可弯成C形的长度，顶部做轻层次", "Keep enough front length for a C-shaped bend and add light layers on top"),
    baseThinning: bi("仅做轻度内部去量，保持刘海完整和顺滑", "Remove a little internal weight while keeping the fringe full and smooth"),
    styling: bi("按6:4方向吹出弧度，使用轻质发蜡或造型霜", "Blow-dry into a 6:4 curve and use a light wax or styling cream"),
    avoid: bi("不要把刘海剪短，也不要留下明显断层或蘑菇轮廓", "Do not cut the fringe short or leave a visible disconnect or mushroom shape"),
    avoidShortZh: "不要剪短刘海，也不要留下明显断层",
  },
  soft_side_part: {
    styleId: "soft_side_part",
    top: bi("顶部和前区保留7–10cm", "Keep 7–10cm through the top and front"),
    sidesBack: bi("两侧后区用剪刀渐层保留2–4cm", "Scissor-taper the sides and back to 2–4cm"),
    layersTexture: bi("顺着自然生长方向做柔和层次，保留侧扫流向", "Add soft layers along the natural growth pattern and preserve side-swept movement"),
    baseThinning: bi("内部只做少量去重，外轮廓保持完整", "Remove minimal internal weight and keep the outer shape intact"),
    styling: bi("按6:4或7:3方向吹干，使用轻质造型霜", "Blow-dry into a 6:4 or 7:3 part and use a light styling cream"),
    avoid: bi("不要剃硬分缝，也不要使用过高贴皮渐变", "Avoid a shaved hard part and an overly high skin fade"),
    avoidShortZh: "不要剃硬分缝，也不要做高贴皮渐变",
  },
  curtain: {
    styleId: "curtain",
    top: bi("前区保留10–13cm，顶部保留8–11cm", "Keep 10–13cm at the front and 8–11cm on top"),
    sidesBack: bi("耳侧和后区保留3–5cm并自然衔接", "Keep 3–5cm around the sides and back with a natural blend"),
    layersTexture: bi("前区做包裹脸侧的柔和弧度，顶部保持轻层次", "Shape a soft face-framing bend at the front with light layers on top"),
    baseThinning: bi("只做轻度内部去量，不削薄刘海外轮廓", "Remove light internal weight without thinning the fringe outline"),
    styling: bi("按5:5或6:4吹开分缝，使用蓬松喷雾或造型霜", "Blow-dry into a 5:5 or 6:4 part and use a volume spray or styling cream"),
    avoid: bi("刘海不要剪到眉毛以上，也不要把两侧推得过短", "Do not cut the fringe above the brows or take the sides too short"),
    avoidShortZh: "刘海不要短于眉区，两侧不要推得过短",
  },
  layered_two_block: {
    styleId: "layered_two_block",
    top: bi("顶部保留8–11cm，刘海保留7–10cm", "Keep 8–11cm on top and 7–10cm at the fringe"),
    sidesBack: bi("内层保留6–12mm，外层保留4–6cm覆盖", "Keep the under-section at 6–12mm with a 4–6cm upper layer"),
    layersTexture: bi("顶部做轻层次，让外层自然覆盖内层", "Add light top layers so the upper section falls naturally over the undercut"),
    baseThinning: bi("控制内部重量，但保留外层连接和发尾厚度", "Control internal weight while preserving connection and weight through the ends"),
    styling: bi("顺着自然分缝吹松发根，使用轻质发蜡", "Lift the roots along the natural part and use a light wax"),
    avoid: bi("避免蘑菇轮廓、明显断层和过薄的外层发尾", "Avoid a mushroom shape, a visible disconnect, or overly thin outer ends"),
    avoidShortZh: "避免蘑菇轮廓和明显断层",
  },
  slick_back: {
    styleId: "slick_back",
    top: bi("前区保留10–13cm，顶部保留8–11cm", "Keep 10–13cm at the front and 8–11cm on top"),
    sidesBack: bi("两侧后区用剪刀渐层保留3–5cm", "Scissor-taper the sides and back to 3–5cm"),
    layersTexture: bi("顶部向后做流动层次，保持可梳动而非贴死", "Layer the top for backward movement while keeping it touchable"),
    baseThinning: bi("内部轻度去重，前区和外轮廓保持完整", "Remove light internal weight while preserving the front and outer shape"),
    styling: bi("向后吹干，使用低光泽发蜡或造型霜", "Blow-dry backward and use a low-shine wax or styling cream"),
    avoid: bi("不要做贴皮渐变，也不要使用僵硬高光泽的湿发效果", "Avoid a skin fade and a rigid high-shine wet look"),
    avoidShortZh: "不要做贴皮渐变或僵硬油头",
  },
  bro_flow: {
    styleId: "bro_flow",
    top: bi("顶部保留12–18cm，后区保留10–14cm", "Keep 12–18cm on top and 10–14cm through the back"),
    sidesBack: bi("耳侧保留7–10cm，保持自然覆盖", "Keep 7–10cm around the ears with natural coverage"),
    layersTexture: bi("做长而柔和的流动层次，保留整体外轮廓", "Add long flowing layers while preserving the overall perimeter"),
    baseThinning: bi("只做内部重量调整，不削薄发尾重量线", "Balance internal weight without thinning the perimeter or ends"),
    styling: bi("使用免洗护发或轻质造型霜，自然后梳", "Use leave-in conditioner or a light styling cream and sweep it back naturally"),
    avoid: bi("不要把耳周剪得过于整齐短促，也不要削薄发尾", "Do not crop tightly around the ears or thin out the ends"),
    avoidShortZh: "不要剪短耳周，也不要削薄发尾",
  },
  layered_wolf: {
    styleId: "layered_wolf",
    top: bi("前区保留10–13cm，后颈保留14–18cm", "Keep 10–13cm at the front and 14–18cm through the nape"),
    sidesBack: bi("耳侧保留8–12cm并与后颈自然连接", "Keep 8–12cm around the ears and connect softly into the nape"),
    layersTexture: bi("头顶到后颈做连续柔和层次，保持轻盈流动", "Create continuous soft layers from crown to nape for light movement"),
    baseThinning: bi("以层次释放重量，不使用剃刀过度削薄", "Release weight through layering rather than aggressive razor thinning"),
    styling: bi("使用纹理喷雾或轻质造型霜，抓出自然束感", "Use texture spray or a light styling cream for natural separation"),
    avoid: bi("不要剪成突然断开的狼尾，也不要把后颈留成单独细尾", "Avoid an abrupt mullet disconnect or a thin isolated tail at the nape"),
    avoidShortZh: "避免突然断层和单独细尾",
  },
  long_layers: {
    styleId: "long_layers",
    top: bi("前区保留14–20cm，整体长度保留20cm以上", "Keep 14–20cm at the front and more than 20cm overall"),
    sidesBack: bi("保留两侧和后区长度及完整重量线", "Preserve length and a full weight line through the sides and back"),
    layersTexture: bi("从下颌附近开始做长层次和脸侧修饰", "Start long layers and face framing around the jawline"),
    baseThinning: bi("仅调整内部堆积，不削薄外轮廓和发尾", "Reduce internal bulk only; keep the perimeter and ends full"),
    styling: bi("使用免洗护发和轻质造型霜，保持自然光泽", "Use leave-in conditioner and a light styling cream for natural shine"),
    avoid: bi("不要剪过短的头顶层次，也不要把发尾削得稀薄", "Avoid short crown layers and overly thinned ends"),
    avoidShortZh: "不要剪短头顶层次或削薄发尾",
  },
  buzz_cut: {
    styleId: "buzz_cut",
    top: bi("顶部保留9–12mm", "Keep 9–12mm on top"),
    sidesBack: bi("两侧后区保留3–6mm并做低位衔接", "Keep 3–6mm on the sides and back with a low blend"),
    layersTexture: bi("顺着头型均匀修剪，边缘保持自然", "Cut evenly with the head shape and keep the edges natural"),
    baseThinning: bi("无需打薄，以均匀长度和自然密度为主", "No thinning; prioritize even length and natural density"),
    styling: bi("通常无需产品，可使用少量头皮保湿产品", "Usually product-free; use light scalp moisturizer if needed"),
    avoid: bi("不要擅自推成贴皮零毫米，也不要重画或后移发际线", "Do not take it to skin without asking or redraw the hairline farther back"),
    avoidShortZh: "不要擅自推成零毫米或重画发际线",
  },
  high_volume_pompadour: {
    styleId: "high_volume_pompadour",
    top: bi("前区保留11–14cm，顶部保留8–11cm", "Keep 11–14cm at the front and 8–11cm on top"),
    sidesBack: bi("两侧后区做3–9mm低位或中低位渐变", "Use a 3–9mm low or mid-low taper on the sides and back"),
    layersTexture: bi("前区保留高度和支撑，顶部向后逐渐连接", "Preserve height and support at the front, graduating toward the back"),
    baseThinning: bi("保留前区密度，只在顶部内部轻度去重", "Preserve front density and remove only light internal weight on top"),
    styling: bi("先用预造型产品吹出高度，再用强支撑哑光发泥固定", "Blow-dry with a pre-styler for height, then set with strong matte clay"),
    avoid: bi("不要过度打薄前区，也不要做僵硬高光泽的湿发造型", "Do not over-thin the front or create a rigid high-shine wet finish"),
    avoidShortZh: "不要过度打薄前区或做僵硬油头",
  },
};

const ROW_LABELS: Record<BarberBriefRow["id"], BilingualLabel> = {
  top: bi("顶部与前区", "TOP & FRONT"),
  sides_back: bi("两侧与后区", "SIDES & BACK"),
  fringe_part: bi("刘海与分缝", "FRINGE & PART"),
  layers_texture: bi("层次与纹理", "LAYERS & TEXTURE"),
  thinning: bi("打薄与去量", "WEIGHT REMOVAL"),
  styling: bi("日常造型", "STYLING"),
};

function densityGuidance(density: HairAnalysis["hairDensity"]): BilingualLabel {
  if (density === "low") return bi("保留整体重量，不做发根打薄或高贴皮渐变", "Preserve overall weight; avoid root thinning and high skin fades");
  if (density === "high") return bi("可做受控的内部去量，但保留外轮廓", "Controlled internal weight removal is fine, but keep the outer shape full");
  if (density === "medium") return bi("只做轻度内部去量，保留自然密度", "Use light internal weight removal and preserve natural density");
  return bi("正面照无法确认实际发量，请现场判断是否需要去量", "Density is unclear from one front photo; confirm weight removal in person");
}

function textureGuidance(texture: HairAnalysis["hairTexture"]): BilingualLabel | undefined {
  if (texture === "curly" || texture === "coily") {
    return bi("按干发长度确认并预留卷缩，不使用剃刀过度削薄", "Confirm the dry length, allow for shrinkage, and avoid aggressive razor thinning");
  }
  if (texture === "wavy") return bi("按自然波纹落点检查最终层次", "Check the finished layers where the natural wave settles");
  if (texture === "unknown") return bi("发质无法可靠判断，请按现场自然状态调整", "Texture is unclear; adjust to the hair's natural state in person");
  return undefined;
}

function hairlineGuidance(hairline: HairAnalysis["hairline"]): BilingualLabel | undefined {
  if (hairline === "high" || hairline === "receding") {
    return bi("保留前区和鬓角的自然边缘，不强行画直发际线", "Keep the natural front and temple edges; do not force a straight line-up");
  }
  if (hairline === "widows_peak") return bi("保留自然美人尖，不强行修成水平直线", "Keep the natural widow's peak instead of forcing a level line");
  if (hairline === "unknown") return bi("发际线情况无法确认，请现场沿自然边缘修整", "Hairline details are unclear; follow the natural edge in person");
  return undefined;
}

function append(base: BilingualLabel, extra?: BilingualLabel): BilingualLabel {
  if (!extra) return base;
  return bi(`${base.zh}；${extra.zh}`, `${base.en}; ${extra.en}`);
}

export function buildBarberBrief(
  analysis: HairAnalysis,
  recommendation: HairstyleRecommendation,
  labels: BarberBriefLabels,
): BarberBrief {
  const spec = BARBER_BRIEF_CATALOG[recommendation.styleId];
  if (!spec) throw new Error(`unknown_barber_style:${recommendation.styleId}`);

  const texture = textureGuidance(analysis.hairTexture);
  const hairline = hairlineGuidance(analysis.hairline);
  const fringePart = bi(
    `${labels.fringe.zh}，${labels.part.zh}；按参考图和自然生长方向调整`,
    `${labels.fringe.en}, ${labels.part.en}; adjust to the reference and natural growth pattern`,
  );
  const fringePartSpoken = recommendation.fringeId === "none"
    ? `前区不留刘海，按${labels.part.zh}处理`
    : `刘海做${labels.fringe.zh}，按${labels.part.zh}处理`;
  const spokenZh = `请按参考图剪成${labels.style.zh}，${spec.top.zh}；${spec.sidesBack.zh}；${fringePartSpoken}，${spec.avoidShortZh}。`;

  return {
    styleId: recommendation.styleId,
    styleName: labels.style,
    spokenZh,
    rows: [
      { id: "top", label: ROW_LABELS.top, value: spec.top },
      { id: "sides_back", label: ROW_LABELS.sides_back, value: spec.sidesBack },
      { id: "fringe_part", label: ROW_LABELS.fringe_part, value: fringePart },
      { id: "layers_texture", label: ROW_LABELS.layers_texture, value: append(spec.layersTexture, texture) },
      { id: "thinning", label: ROW_LABELS.thinning, value: append(spec.baseThinning, densityGuidance(analysis.hairDensity)) },
      { id: "styling", label: ROW_LABELS.styling, value: spec.styling },
    ],
    avoid: append(spec.avoid, hairline),
    confirm: bi(
      "剪之前请先确认发旋、生长方向、当前长度、实际发量和每天愿意花多少时间打理。",
      "Before cutting, confirm the cowlick, growth direction, current length, actual density, and daily styling time.",
    ),
  };
}

export function barberBriefCopyText(brief: BarberBrief) {
  return [
    `【${brief.styleName.zh}】`,
    brief.spokenZh,
    ...brief.rows.map((row) => `${row.label.zh}：${row.value.zh}`),
    `避免：${brief.avoid.zh}`,
    `现场确认：${brief.confirm.zh}`,
  ].join("\n");
}
