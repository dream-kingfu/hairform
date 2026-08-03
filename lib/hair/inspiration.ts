/**
 * Curated outbound references only. This catalog must never contain platform
 * images, copied note text, tracking parameters, comments, or audience data.
 */
export type HairInspirationPlatform = "douyin" | "xiaohongshu";

export interface HairInspirationLink {
  id: string;
  styleId: string;
  platform: HairInspirationPlatform;
  creatorDisplayName: string;
  summaryZh: string;
  url: string;
  verifiedAt: string;
}

const PLATFORM_LABELS: Record<HairInspirationPlatform, string> = {
  douyin: "抖音",
  xiaohongshu: "小红书",
};

const VERIFIED_AT = "2026-07-31";

/**
 * Only canonical content URLs are accepted. Short links, search pages, share
 * parameters and tracking fragments deliberately fail closed.
 */
export function isAllowedHairInspirationUrl(url: string, platform: HairInspirationPlatform): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) return false;
    if (platform === "douyin") {
      return (parsed.hostname === "www.douyin.com" && /^\/video\/\d{16,20}$/.test(parsed.pathname))
        || (parsed.hostname === "jingxuan.douyin.com" && /^\/m\/video\/\d{16,20}$/.test(parsed.pathname));
    }
    return parsed.hostname === "www.xiaohongshu.com" && /^\/explore\/[a-zA-Z0-9]{16,32}$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function hairInspirationPlatformLabel(platform: HairInspirationPlatform) {
  return PLATFORM_LABELS[platform];
}

export const HAIR_INSPIRATION_LINKS: readonly HairInspirationLink[] = [
  {
    id: "textured-crop-douyin-01",
    styleId: "textured_crop",
    platform: "douyin",
    creatorDisplayName: "你家的冰箱",
    summaryZh: "细碎刘海配合自然发根蓬松，重点看顶部纹理与前额遮盖。",
    url: "https://www.douyin.com/video/7306788552791100724",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "french-crop-douyin-01",
    styleId: "french_crop",
    platform: "douyin",
    creatorDisplayName: "小龙匠人",
    summaryZh: "短碎向前、两侧收紧，可参考法式短碎的干净轮廓。",
    url: "https://jingxuan.douyin.com/m/video/7622162277878024659",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "crew-cut-douyin-01",
    styleId: "crew_cut",
    platform: "douyin",
    creatorDisplayName: "向前",
    summaryZh: "低打理圆寸示范，适合观察顶部长度和两侧渐短比例。",
    url: "https://www.douyin.com/video/7663724923357524401",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "ivy-league-douyin-01",
    styleId: "ivy_league",
    platform: "douyin",
    creatorDisplayName: "燕麦周",
    summaryZh: "凌乱三七分保留轻微前额高度，通勤感更自然。",
    url: "https://jingxuan.douyin.com/m/video/7502707293919464755",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "short-quiff-douyin-01",
    styleId: "short_quiff",
    platform: "douyin",
    creatorDisplayName: "大志教男发",
    summaryZh: "短发前区向上抓出束感，重点看前额支撑和侧面收紧。",
    url: "https://jingxuan.douyin.com/m/video/7401724872151354639",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "comma-hair-douyin-01",
    styleId: "comma_hair",
    platform: "douyin",
    creatorDisplayName: "满江红教育—妆教版",
    summaryZh: "男团感弧形刘海与侧分纹理，可参考前额弯度和走向。",
    url: "https://jingxuan.douyin.com/m/video/7621833743418286671",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "soft-side-part-douyin-01",
    styleId: "soft_side_part",
    platform: "douyin",
    creatorDisplayName: "柯野Kayn",
    summaryZh: "三七侧背保留柔和纹理，适合看分线与两侧过渡。",
    url: "https://jingxuan.douyin.com/m/video/7606963922347904283",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "curtain-douyin-01",
    styleId: "curtain",
    platform: "douyin",
    creatorDisplayName: "不倒翁会倒嘛",
    summaryZh: "中长发向两侧打开，重点看中分弧度和面部两侧留量。",
    url: "https://www.douyin.com/video/7418919841555385650",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "layered-two-block-douyin-01",
    styleId: "layered_two_block",
    platform: "douyin",
    creatorDisplayName: "臭搞头的江言酱",
    summaryZh: "气垫纹理建立顶部层次，可参考两段式基础上的轻盈感。",
    url: "https://www.douyin.com/video/7353210743287860480",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "slick-back-douyin-01",
    styleId: "slick_back",
    platform: "douyin",
    creatorDisplayName: "稳妥十八",
    summaryZh: "凌乱背头避免贴头皮，重点看向后走向与自然束感。",
    url: "https://jingxuan.douyin.com/m/video/7642675870322412834",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "bro-flow-douyin-01",
    styleId: "bro_flow",
    platform: "douyin",
    creatorDisplayName: "上海Dee",
    summaryZh: "耳下中长发自然后梳，兼顾流动感和日常清爽度。",
    url: "https://www.douyin.com/video/7629663158349295784",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "layered-wolf-douyin-01",
    styleId: "layered_wolf",
    platform: "douyin",
    creatorDisplayName: "上海黑玫瑰男士沙龙 Will",
    summaryZh: "慵懒狼尾保留后颈长度，重点看头顶层次和发尾外翘。",
    url: "https://www.douyin.com/video/7629609638556666831",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "long-layers-douyin-01",
    styleId: "long_layers",
    platform: "douyin",
    creatorDisplayName: "有理Barbershop",
    summaryZh: "日系中长发不牺牲长度，通过去量和层次改善厚重感。",
    url: "https://www.douyin.com/video/7629718852712873699",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "buzz-cut-douyin-01",
    styleId: "buzz_cut",
    platform: "douyin",
    creatorDisplayName: "毛十三",
    summaryZh: "约一点五厘米短寸示范，适合观察头型和自然发际线。",
    url: "https://www.douyin.com/video/7588710751591979365",
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "high-pompadour-douyin-01",
    styleId: "high_volume_pompadour",
    platform: "douyin",
    creatorDisplayName: "泽泽耶",
    summaryZh: "中长前区向上后方建立高度，参考高蓬松轮廓与侧面控制。",
    url: "https://jingxuan.douyin.com/m/video/7470425518555270412",
    verifiedAt: VERIFIED_AT,
  },
];

export function getHairInspirationLinks(styleId: string): HairInspirationLink[] {
  return HAIR_INSPIRATION_LINKS.filter((item) => item.styleId === styleId)
    .filter((item) => item.creatorDisplayName.trim().length > 0 && item.summaryZh.trim().length > 0)
    .filter((item) => isAllowedHairInspirationUrl(item.url, item.platform))
    .slice(0, 2);
}
