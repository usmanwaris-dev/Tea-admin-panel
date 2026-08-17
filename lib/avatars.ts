/**
 * Preset avatar characters — ported 1:1 from the app / website
 * (Tea-Website/src/lib/avatars.ts → Tea-App avatar_picker.dart). The `id`
 * (e.g. "p1", "m3") is stored as users.preset_avatar_id, so the admin preview
 * renders the exact same illustrated face the app and website show.
 */
export type HairStyle =
  | "short" | "long" | "curly" | "bun" | "buzz" | "wavy" | "ponytail" | "afro";

export type AvatarChar = {
  id: string;
  skin: string;
  hair: string;
  bg: string;
  bgEnd?: string;
  clothing?: string;
  eye?: string;
  hairStyle: HairStyle;
  glasses?: boolean;
  beard?: boolean;
};

export const AVATARS: AvatarChar[] = [
  { id: "p1", skin: "#F3C6A5", hair: "#2B1B12", bg: "#7C5CFF", bgEnd: "#4C2FD6", clothing: "#1F2937", eye: "#5B3A29", hairStyle: "long" },
  { id: "p2", skin: "#8D5524", hair: "#14100E", bg: "#FFB07C", bgEnd: "#E8563F", clothing: "#0F172A", eye: "#3B2416", hairStyle: "afro" },
  { id: "p3", skin: "#E8B88A", hair: "#1A1A1A", bg: "#34D399", bgEnd: "#0E9F6E", clothing: "#111827", eye: "#2F4858", hairStyle: "bun" },
  { id: "p4", skin: "#FAD2B4", hair: "#B4551F", bg: "#60A5FA", bgEnd: "#2563EB", clothing: "#1E293B", eye: "#2E7D6B", hairStyle: "wavy" },
  { id: "p5", skin: "#C68642", hair: "#171310", bg: "#F472B6", bgEnd: "#BE2C74", clothing: "#10151F", eye: "#4A2C1A", hairStyle: "short", beard: true },
  { id: "p6", skin: "#F7D7BE", hair: "#3A2C1E", bg: "#FBBF24", bgEnd: "#D97706", clothing: "#1B1B1F", eye: "#3E5C4B", hairStyle: "ponytail", glasses: true },
  { id: "w1", skin: "#FDBDA1", hair: "#4A3728", bg: "#FEE2E2", hairStyle: "long" },
  { id: "w2", skin: "#FDBDA1", hair: "#D4A017", bg: "#FEF3C7", hairStyle: "wavy" },
  { id: "w3", skin: "#E8B88A", hair: "#1A1A1A", bg: "#EDE9FE", hairStyle: "bun" },
  { id: "w4", skin: "#FDBDA1", hair: "#C0392B", bg: "#FCE7F3", hairStyle: "ponytail" },
  { id: "m1", skin: "#FDBDA1", hair: "#4A3728", bg: "#DBEAFE", hairStyle: "short" },
  { id: "m2", skin: "#FDBDA1", hair: "#1A1A1A", bg: "#D1FAE5", hairStyle: "buzz", glasses: true },
  { id: "m3", skin: "#E8B88A", hair: "#4A3728", bg: "#FFF7ED", hairStyle: "short", beard: true },
  { id: "m4", skin: "#FDBDA1", hair: "#D4A017", bg: "#CFFAFE", hairStyle: "curly" },
  { id: "w5", skin: "#C68642", hair: "#1A1A1A", bg: "#FFE4E6", hairStyle: "afro" },
  { id: "w6", skin: "#8D5524", hair: "#1A1A1A", bg: "#F3E8FF", hairStyle: "long" },
  { id: "w7", skin: "#C68642", hair: "#4A3728", bg: "#F0FDFA", hairStyle: "bun", glasses: true },
  { id: "w8", skin: "#8D5524", hair: "#1A1A1A", bg: "#FEF9C3", hairStyle: "wavy" },
  { id: "m5", skin: "#C68642", hair: "#1A1A1A", bg: "#E0F2FE", hairStyle: "short" },
  { id: "m6", skin: "#8D5524", hair: "#1A1A1A", bg: "#F1F5F9", hairStyle: "buzz", beard: true },
  { id: "m7", skin: "#C68642", hair: "#1A1A1A", bg: "#FFFBEB", hairStyle: "afro", glasses: true },
  { id: "m8", skin: "#8D5524", hair: "#4A3728", bg: "#DDD6FE", hairStyle: "curly", beard: true },
  { id: "a1", skin: "#FDBDA1", hair: "#7C3AED", bg: "#F3E8FF", hairStyle: "wavy" },
  { id: "a2", skin: "#E8B88A", hair: "#1A1A1A", bg: "#E0E7FF", hairStyle: "ponytail", glasses: true },
  { id: "a3", skin: "#C68642", hair: "#D4A017", bg: "#FFE4E6", hairStyle: "bun" },
  { id: "a4", skin: "#8D5524", hair: "#1A1A1A", bg: "#DCFCE7", hairStyle: "short", beard: true },
  { id: "a5", skin: "#FDBDA1", hair: "#C0392B", bg: "#CFFAFE", hairStyle: "curly" },
  { id: "a6", skin: "#E8B88A", hair: "#4A3728", bg: "#FEF3C7", hairStyle: "afro" },
  { id: "a7", skin: "#C68642", hair: "#1A1A1A", bg: "#FCE7F3", hairStyle: "long", glasses: true },
  { id: "a8", skin: "#FDBDA1", hair: "#1A1A1A", bg: "#FFEDD5", hairStyle: "buzz" },
  { id: "a9", skin: "#8D5524", hair: "#6B4423", bg: "#EDE9FE", hairStyle: "curly", glasses: true },
  { id: "a10", skin: "#E8B88A", hair: "#D4A017", bg: "#D1FAE5", hairStyle: "wavy" },
  { id: "a11", skin: "#FDBDA1", hair: "#4A3728", bg: "#FEE2E2", hairStyle: "short", beard: true },
  { id: "a12", skin: "#C68642", hair: "#1A1A1A", bg: "#DBEAFE", hairStyle: "ponytail" },
  { id: "a13", skin: "#8D5524", hair: "#1A1A1A", bg: "#FFF7ED", hairStyle: "bun" },
  { id: "a14", skin: "#FDBDA1", hair: "#D4A017", bg: "#F0FDFA", hairStyle: "long" },
  { id: "a15", skin: "#E8B88A", hair: "#1A1A1A", bg: "#DDD6FE", hairStyle: "afro", glasses: true },
  { id: "a16", skin: "#C68642", hair: "#4A3728", bg: "#FEF9C3", hairStyle: "curly" },
];

/** Look up a preset by id; returns null for unknown/absent ids (so callers fall back). */
export const avatarById = (id?: string | null): AvatarChar | null =>
  id ? AVATARS.find((a) => a.id === id) ?? null : null;
