import type { FaceShape, HairDensity, HairTexture } from "./types";

export interface HairStyleDefinition {
  id: string;
  zh: string;
  en: string;
  length: "short" | "medium" | "long";
  fringeId: string;
  partId: string;
  maintenance: "low" | "medium" | "high";
  textures: HairTexture[];
  densities: HairDensity[];
  faceShapes: FaceShape[];
  prompt: string;
}

export const HAIRSTYLE_CATALOG: HairStyleDefinition[] = [
  { id: "textured_crop", zh: "纹理碎盖", en: "Textured Crop", length: "short", fringeId: "soft_fringe", partId: "natural", maintenance: "low", textures: ["straight", "wavy"], densities: ["medium", "high"], faceShapes: ["oval", "round", "square", "heart", "mixed"], prompt: "a clean textured crop with airy separated strands and a soft natural fringe" },
  { id: "french_crop", zh: "法式短碎", en: "French Crop", length: "short", fringeId: "french", partId: "natural", maintenance: "low", textures: ["straight", "wavy", "curly"], densities: ["low", "medium", "high"], faceShapes: ["oval", "oblong", "diamond", "mixed"], prompt: "a refined French crop with controlled texture and a short forward fringe" },
  { id: "crew_cut", zh: "清爽短寸", en: "Crew Cut", length: "short", fringeId: "none", partId: "natural", maintenance: "low", textures: ["straight", "wavy", "curly", "coily"], densities: ["low", "medium", "high"], faceShapes: ["oval", "square", "diamond", "mixed"], prompt: "a polished crew cut with softly tapered sides and natural density" },
  { id: "ivy_league", zh: "常春藤短发", en: "Ivy League", length: "short", fringeId: "none", partId: "side", maintenance: "medium", textures: ["straight", "wavy"], densities: ["medium", "high"], faceShapes: ["oval", "round", "square", "heart", "mixed"], prompt: "an Ivy League haircut with a neat side part and subtle lift at the front" },
  { id: "short_quiff", zh: "短款飞机头", en: "Short Quiff", length: "short", fringeId: "upswept", partId: "natural", maintenance: "medium", textures: ["straight", "wavy"], densities: ["medium", "high"], faceShapes: ["round", "square", "heart", "mixed"], prompt: "a short modern quiff with controlled upward volume and clean sides" },
  { id: "comma_hair", zh: "韩系逗号刘海", en: "Comma Hair", length: "medium", fringeId: "comma", partId: "side", maintenance: "medium", textures: ["straight", "wavy"], densities: ["medium", "high"], faceShapes: ["oval", "round", "oblong", "heart", "mixed"], prompt: "a Korean comma hairstyle with a soft curved fringe and natural side part" },
  { id: "soft_side_part", zh: "柔和侧分", en: "Soft Side Part", length: "medium", fringeId: "side_swept", partId: "side", maintenance: "low", textures: ["straight", "wavy", "curly"], densities: ["low", "medium", "high"], faceShapes: ["oval", "round", "square", "heart", "oblong", "diamond", "mixed"], prompt: "a soft medium side part with natural flow and light root volume" },
  { id: "curtain", zh: "八字中分", en: "Curtain Hair", length: "medium", fringeId: "curtain", partId: "middle", maintenance: "medium", textures: ["straight", "wavy"], densities: ["medium", "high"], faceShapes: ["oval", "square", "heart", "diamond", "mixed"], prompt: "a modern curtain hairstyle with an airy middle part and face-framing bends" },
  { id: "layered_two_block", zh: "层次两段式", en: "Layered Two-Block", length: "medium", fringeId: "soft_fringe", partId: "natural", maintenance: "medium", textures: ["straight", "wavy"], densities: ["medium", "high"], faceShapes: ["oval", "round", "heart", "mixed"], prompt: "a layered two-block haircut with light crown volume and a soft separated fringe" },
  { id: "slick_back", zh: "自然背头", en: "Soft Slick Back", length: "medium", fringeId: "none", partId: "back", maintenance: "high", textures: ["straight", "wavy"], densities: ["medium", "high"], faceShapes: ["oval", "round", "square", "diamond", "mixed"], prompt: "a soft contemporary slick back with touchable texture, not wet or rigid" },
  { id: "bro_flow", zh: "自然后梳中长发", en: "Bro Flow", length: "long", fringeId: "none", partId: "back", maintenance: "medium", textures: ["straight", "wavy", "curly"], densities: ["medium", "high"], faceShapes: ["oval", "square", "heart", "diamond", "mixed"], prompt: "a natural medium-long bro flow swept away from the face with soft movement" },
  { id: "layered_wolf", zh: "轻层次狼尾", en: "Soft Wolf Cut", length: "long", fringeId: "curtain", partId: "middle", maintenance: "high", textures: ["straight", "wavy", "curly"], densities: ["medium", "high"], faceShapes: ["oval", "round", "heart", "diamond", "mixed"], prompt: "a wearable soft wolf cut with controlled layers and a subtle longer nape" },
  { id: "long_layers", zh: "自然长层次", en: "Long Layers", length: "long", fringeId: "curtain", partId: "middle", maintenance: "high", textures: ["straight", "wavy", "curly"], densities: ["medium", "high"], faceShapes: ["oval", "square", "heart", "oblong", "mixed"], prompt: "natural masculine long layers with balanced face framing and healthy movement" },
  { id: "buzz_cut", zh: "极短寸头", en: "Buzz Cut", length: "short", fringeId: "none", partId: "none", maintenance: "low", textures: ["straight", "wavy", "curly", "coily"], densities: ["low", "medium", "high"], faceShapes: ["oval", "square", "diamond", "mixed"], prompt: "an even refined buzz cut with a natural hairline and realistic scalp density" },
  { id: "high_volume_pompadour", zh: "高蓬庞巴度", en: "High Pompadour", length: "medium", fringeId: "upswept", partId: "back", maintenance: "high", textures: ["straight", "wavy"], densities: ["high"], faceShapes: ["round", "square", "mixed"], prompt: "a high-volume pompadour with pronounced height and tightly controlled sides" },
];

export const HAIR_COLOR_CATALOG = [
  { id: "natural_black", zh: "自然黑", en: "Natural Black", hex: "#181715", prompt: "natural soft black hair with subtle dimension, never blue-black" },
  { id: "black_tea", zh: "黑茶棕", en: "Black Tea Brown", hex: "#30251f", prompt: "deep black tea brown hair, neutral and understated" },
  { id: "warm_tea", zh: "暖茶棕", en: "Warm Tea Brown", hex: "#624638", prompt: "medium warm tea brown hair with restrained golden warmth" },
  { id: "chestnut", zh: "栗棕色", en: "Chestnut Brown", hex: "#704333", prompt: "rich chestnut brown hair with low red saturation" },
  { id: "chocolate", zh: "巧克力棕", en: "Chocolate Brown", hex: "#4b322a", prompt: "deep chocolate brown hair with natural glossy dimension" },
  { id: "ash_brown", zh: "冷灰棕", en: "Ash Brown", hex: "#665d57", prompt: "muted ash brown hair with a clean cool-neutral tone" },
] as const;

export function getStyle(id: string) {
  return HAIRSTYLE_CATALOG.find((style) => style.id === id) ?? HAIRSTYLE_CATALOG[0];
}

export function getColor(id: string) {
  return HAIR_COLOR_CATALOG.find((color) => color.id === id) ?? HAIR_COLOR_CATALOG[0];
}
