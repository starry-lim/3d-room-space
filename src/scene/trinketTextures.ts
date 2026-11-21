import * as THREE from "three";
import { M, PAL, cyl } from "./kit";

const textureCache = new Map<string, THREE.CanvasTexture>();

function chibiFaceSvg(blush = "#f3a3a8", eyeColor = "#4e6cb8", smile: "gentle" | "wink" | "happy" = "gentle"): string {
  const rightEye =
    smile === "wink"
      ? `<path d="M43.2 32.5 Q46.5 29.8 49.6 32.5" fill="none" stroke="#2b2030" stroke-width="1.9" stroke-linecap="round" />`
      : `<ellipse cx="46.5" cy="32.5" rx="2.7" ry="3.5" fill="${eyeColor}" />
         <ellipse cx="46.5" cy="31.5" rx="2.7" ry="2" fill="#2b2030" opacity="0.72" />
         <circle cx="45.6" cy="30.8" r="1.15" fill="#ffffff" />
         <circle cx="47.5" cy="33.8" r="0.6" fill="#ffffff" />
         <path d="M43.2 29.2 Q46.5 27.6 49.8 29.2" fill="none" stroke="#2b2030" stroke-width="1.5" stroke-linecap="round" />`;
  const mouth =
    smile === "happy"
      ? `<path d="M37.5 39.2 Q40 42 42.5 39.2 Z" fill="#e58a82" stroke="#2b2030" stroke-width="1.3" stroke-linejoin="round" />`
      : `<path d="M38 39.5 Q40 41.2 42 39.5" fill="none" stroke="#2b2030" stroke-width="1.5" stroke-linecap="round" />`;

  return `
    <circle cx="40" cy="31" r="16.5" fill="#fde3d3" stroke="#2b2030" stroke-width="2" />
    <ellipse cx="33.5" cy="32.5" rx="2.7" ry="3.5" fill="${eyeColor}" />
    <ellipse cx="33.5" cy="31.5" rx="2.7" ry="2" fill="#2b2030" opacity="0.72" />
    <circle cx="32.6" cy="30.8" r="1.15" fill="#ffffff" />
    <circle cx="34.5" cy="33.8" r="0.6" fill="#ffffff" />
    <path d="M30.2 29.2 Q33.5 27.6 36.8 29.2" fill="none" stroke="#2b2030" stroke-width="1.5" stroke-linecap="round" />
    ${rightEye}
    <ellipse cx="29" cy="36.5" rx="3" ry="1.6" fill="${blush}" opacity="0.65" />
    <ellipse cx="51" cy="36.5" rx="3" ry="1.6" fill="${blush}" opacity="0.65" />
    ${mouth}
  `;
}

function getTrinketInnerSvg(id: string): string {
  switch (id) {
    case "dawn_knight":
      return `
        <path d="M21 30 Q20 12 40 11 Q60 12 59 30 Q58 43 53 45 L27 45 Q22 43 21 30 Z" fill="#cad8ef" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M27 48 L53 48 L57 67 L45 67 L43 58 L37 58 L35 67 L23 67 Z" fill="#2c3e6b" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M34 48 L46 48 L44 63 L36 63 Z" fill="#f7eedc" stroke="#2b2030" stroke-width="1.6" stroke-linejoin="round" />
        <path d="M40 49 L40 62" stroke="#e9b44c" stroke-width="1.8" />
        <circle cx="40" cy="52" r="2.2" fill="#5aa8e8" stroke="#2b2030" stroke-width="1.2" />
        <circle cx="24.5" cy="57" r="3" fill="#fde3d3" stroke="#2b2030" stroke-width="1.6" />
        <circle cx="55.5" cy="57" r="3" fill="#fde3d3" stroke="#2b2030" stroke-width="1.6" />
        <path d="M56 56 L65 40" stroke="#4868b2" stroke-width="3.2" stroke-linecap="round" />
        <path d="M53 54 L59 58" stroke="#e9b44c" stroke-width="2.4" stroke-linecap="round" />
        <rect x="30" y="65" width="7" height="6" rx="2.5" fill="#231a2b" stroke="#2b2030" stroke-width="1.6" />
        <rect x="43" y="65" width="7" height="6" rx="2.5" fill="#231a2b" stroke="#2b2030" stroke-width="1.6" />
        ${chibiFaceSvg("#f3a3a8", "#4868b2", "gentle")}
        <path d="M23 29 Q24 14 40 13 Q56 14 57 29 L53 26 L50 32 L45 24 L40 31 L35 23 L30 31 L27 25 Z" fill="#dce6f7" stroke="#2b2030" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M40 13 Q42 6 47 9" fill="none" stroke="#2b2030" stroke-width="2" stroke-linecap="round" />
        <path d="M50 19 L58 16 L55 23 Z" fill="#e9b44c" stroke="#2b2030" stroke-width="1.4" stroke-linejoin="round" />
      `;
    case "mint_scholar":
      return `
        <path d="M21 31 Q20 12 40 11 Q60 12 59 31 Q59 46 53 47 L27 47 Q21 46 21 31 Z" fill="#89cbb8" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M26 48 L54 48 L57 67 L23 67 Z" fill="#214653" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M35 48 L45 48 L43 66 L37 66 Z" fill="#2d6e78" stroke="#2b2030" stroke-width="1.5" />
        <circle cx="40" cy="52" r="2.1" fill="#63d8d6" stroke="#2b2030" stroke-width="1.2" />
        <circle cx="24" cy="57" r="3" fill="#fde3d3" stroke="#2b2030" stroke-width="1.6" />
        <circle cx="56" cy="57" r="3" fill="#fde3d3" stroke="#2b2030" stroke-width="1.6" />
        <path d="M62 34 Q67 28 65 21 Q60 25 57 30 Z" fill="#5ce1e6" stroke="#2b2030" stroke-width="1.5" stroke-linejoin="round" />
        <rect x="30" y="65" width="7" height="6" rx="2.5" fill="#231a2b" stroke="#2b2030" stroke-width="1.6" />
        <rect x="43" y="65" width="7" height="6" rx="2.5" fill="#231a2b" stroke="#2b2030" stroke-width="1.6" />
        ${chibiFaceSvg("#f3a3a8", "#d06b8e", "wink")}
        <rect x="43.2" y="29" width="7" height="5.5" rx="2" fill="#2b2030" stroke="#e9b44c" stroke-width="1.3" />
        <path d="M22 30 Q24 13 40 12 Q56 13 58 30 L53 26 L48 33 L42 23 L38 32 L32 24 L27 32 Z" fill="#a7dfd0" stroke="#2b2030" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M39 12 Q35 6 31 9" fill="none" stroke="#2b2030" stroke-width="2" stroke-linecap="round" />
      `;
    case "star_mage":
      return `
        <path d="M22 32 Q21 15 40 14 Q59 15 58 32 L55 46 L25 46 Z" fill="#7c6ca6" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M25 48 L55 48 L58 67 L22 67 Z" fill="#464d84" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M31 48 L40 55 L49 48" fill="#e9b44c" stroke="#2b2030" stroke-width="1.5" stroke-linejoin="round" />
        <rect x="55" y="54" width="7" height="9" rx="2" fill="#f7d372" stroke="#2b2030" stroke-width="1.6" />
        ${chibiFaceSvg("#f3a3a8", "#5963a6", "happy")}
        <path d="M24 29 Q29 19 40 19 Q51 19 56 29 L50 26 L44 30 L40 25 L35 30 L29 26 Z" fill="#9484bd" stroke="#2b2030" stroke-width="1.8" stroke-linejoin="round" />
        <ellipse cx="40" cy="21" rx="22" ry="5" fill="#3a3f70" stroke="#2b2030" stroke-width="2" />
        <path d="M26 20 L38 4 Q43 2 45 7 L54 20 Z" fill="#484f8a" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <circle cx="42" cy="14" r="2.2" fill="#e9b44c" />
      `;
    case "cloud_traveler":
      return `
        <path d="M22 31 Q22 15 40 14 Q58 15 58 31 L54 45 L26 45 Z" fill="#a86d4b" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M27 48 L53 48 L55 67 L25 67 Z" fill="#c9704f" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <rect x="28" y="45" width="24" height="8" rx="4" fill="#f7eedc" stroke="#2b2030" stroke-width="1.8" />
        <path d="M44 51 L49 62 L42 62 L39 52 Z" fill="#ecdfc4" stroke="#2b2030" stroke-width="1.6" />
        <rect x="30" y="65" width="7" height="6" rx="2.5" fill="#46353a" stroke="#2b2030" stroke-width="1.6" />
        <rect x="43" y="65" width="7" height="6" rx="2.5" fill="#46353a" stroke="#2b2030" stroke-width="1.6" />
        ${chibiFaceSvg("#f3a3a8", "#4a6b5e", "gentle")}
        <path d="M24 28 Q30 18 40 18 Q50 18 56 28 L50 25 L43 30 L38 24 L31 30 Z" fill="#be7e58" stroke="#2b2030" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M22 21 Q25 10 42 11 Q56 12 56 21 Z" fill="#2d3b66" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <line x1="40" y1="8" x2="41" y2="11" stroke="#2b2030" stroke-width="2" stroke-linecap="round" />
      `;
    case "sparky_mouse":
      return `
        <path d="M55 58 L64 52 L61 46 L70 39 L65 36" fill="none" stroke="#d99a1e" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M55 58 L64 52 L61 46 L70 39" fill="none" stroke="#2b2030" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M24 29 L17 12 L31 22 Z" fill="#f7d354" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M17 12 L22 20 L25 17 Z" fill="#2b2030" />
        <path d="M56 29 L63 12 L49 22 Z" fill="#f7d354" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M63 12 L58 20 L55 17 Z" fill="#2b2030" />
        <ellipse cx="40" cy="54" rx="16" ry="15" fill="#f7d354" stroke="#2b2030" stroke-width="2" />
        <circle cx="40" cy="34" r="15.5" fill="#f7d354" stroke="#2b2030" stroke-width="2" />
        <circle cx="33.5" cy="32.5" r="2.7" fill="#2b2030" /><circle cx="32.7" cy="31.5" r="1.1" fill="#ffffff" />
        <circle cx="46.5" cy="32.5" r="2.7" fill="#2b2030" /><circle cx="45.7" cy="31.5" r="1.1" fill="#ffffff" />
        <circle cx="28" cy="37.5" r="3.4" fill="#e4572e" stroke="#2b2030" stroke-width="1.2" />
        <circle cx="52" cy="37.5" r="3.4" fill="#e4572e" stroke="#2b2030" stroke-width="1.2" />
        <path d="M36 37.5 Q38 40 40 37.5 Q42 40 44 37.5" fill="none" stroke="#2b2030" stroke-width="1.6" stroke-linecap="round" />
        <ellipse cx="32" cy="67" rx="4.5" ry="2.8" fill="#f7d354" stroke="#2b2030" stroke-width="1.8" />
        <ellipse cx="48" cy="67" rx="4.5" ry="2.8" fill="#f7d354" stroke="#2b2030" stroke-width="1.8" />
      `;
    case "leafy_sprout":
      return `
        <path d="M35 28 Q33 17 40 13 Q47 17 45 28 Z" fill="#77b36b" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M39 14 Q23 6 19 18 Q28 24 39 16 Z" fill="#64a358" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M41 14 Q57 6 61 18 Q52 24 41 16 Z" fill="#77b36b" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M22 48 Q21 28 40 27 Q59 28 58 48 Q58 66 40 67 Q22 66 22 48 Z" fill="#9cd3b8" stroke="#2b2030" stroke-width="2" />
        <ellipse cx="33" cy="43" rx="3" ry="3.6" fill="#c74838" stroke="#2b2030" stroke-width="1.4" />
        <circle cx="32.2" cy="41.6" r="1.2" fill="#ffffff" />
        <ellipse cx="47" cy="43" rx="3" ry="3.6" fill="#c74838" stroke="#2b2030" stroke-width="1.4" />
        <circle cx="46.2" cy="41.6" r="1.2" fill="#ffffff" />
        <path d="M36.5 49.5 Q40 52 43.5 49.5" fill="none" stroke="#2b2030" stroke-width="1.7" stroke-linecap="round" />
        <ellipse cx="31" cy="67" rx="4.5" ry="3" fill="#82bfa2" stroke="#2b2030" stroke-width="1.8" />
        <ellipse cx="49" cy="67" rx="4.5" ry="3" fill="#82bfa2" stroke="#2b2030" stroke-width="1.8" />
      `;
    case "cream_pup":
      return `
        <circle cx="57" cy="55" r="7.5" fill="#fcf4e4" stroke="#2b2030" stroke-width="2" />
        <ellipse cx="40" cy="55" rx="15" ry="13" fill="#d88d55" stroke="#2b2030" stroke-width="2" />
        <path d="M23 48 Q26 41 34 45 Q40 40 46 45 Q54 41 57 48 Q53 56 46 54 Q40 58 34 54 Q27 56 23 48 Z" fill="#fcf4e4" stroke="#2b2030" stroke-width="1.9" stroke-linejoin="round" />
        <ellipse cx="22" cy="27" rx="5.5" ry="9" transform="rotate(-18 22 27)" fill="#d88d55" stroke="#2b2030" stroke-width="2" />
        <ellipse cx="58" cy="27" rx="5.5" ry="9" transform="rotate(18 58 27)" fill="#d88d55" stroke="#2b2030" stroke-width="2" />
        <circle cx="40" cy="33" r="14.5" fill="#d88d55" stroke="#2b2030" stroke-width="2" />
        <ellipse cx="40" cy="38" rx="9" ry="6.5" fill="#fcf4e4" />
        <circle cx="34" cy="31.5" r="2.7" fill="#2b2030" /><circle cx="33.1" cy="30.5" r="1" fill="#ffffff" />
        <circle cx="46" cy="31.5" r="2.7" fill="#2b2030" /><circle cx="45.1" cy="30.5" r="1" fill="#ffffff" />
        <ellipse cx="40" cy="35.5" rx="2.2" ry="1.5" fill="#2b2030" />
        <path d="M36.5 38.5 Q38.5 40.5 40 38.5 Q41.5 40.5 43.5 38.5" fill="none" stroke="#2b2030" stroke-width="1.5" stroke-linecap="round" />
      `;
    case "pebble_duck":
      return `
        <path d="M37 15 L35 9 M40 14 L40 8 M43 15 L45 9" stroke="#2b2030" stroke-width="2" stroke-linecap="round" />
        <ellipse cx="40" cy="54" rx="16.5" ry="14" fill="#f7cb52" stroke="#2b2030" stroke-width="2" />
        <ellipse cx="40" cy="57" rx="10" ry="8" fill="#fdf1c8" />
        <circle cx="40" cy="31" r="15" fill="#f7cb52" stroke="#2b2030" stroke-width="2" />
        <circle cx="33.5" cy="29.5" r="4.2" fill="#ffffff" stroke="#2b2030" stroke-width="1.6" /><circle cx="33.5" cy="29.5" r="1.4" fill="#2b2030" />
        <circle cx="46.5" cy="29.5" r="4.2" fill="#ffffff" stroke="#2b2030" stroke-width="1.6" /><circle cx="46.5" cy="29.5" r="1.4" fill="#2b2030" />
        <ellipse cx="40" cy="37" rx="8" ry="4.2" fill="#fae6b4" stroke="#2b2030" stroke-width="1.8" />
        <ellipse cx="26" cy="54" rx="4.5" ry="7" transform="rotate(15 26 54)" fill="#f0bd3c" stroke="#2b2030" stroke-width="1.8" />
        <ellipse cx="54" cy="54" rx="4.5" ry="7" transform="rotate(-15 54 54)" fill="#f0bd3c" stroke="#2b2030" stroke-width="1.8" />
        <ellipse cx="33" cy="68" rx="4.5" ry="2.5" fill="#e89a38" stroke="#2b2030" stroke-width="1.6" />
        <ellipse cx="47" cy="68" rx="4.5" ry="2.5" fill="#e89a38" stroke="#2b2030" stroke-width="1.6" />
      `;
    case "mochi_ghost":
      return `
        <path d="M22 50 Q22 25 40 24 Q58 25 58 50 L58 64 Q53 69 49 64 Q45 69 40 64 Q35 69 31 64 Q27 69 22 64 Z" fill="#ebe5f7" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M27 28 Q35 10 56 14 L50 28 Z" fill="#7b6ba8" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <circle cx="57" cy="14" r="4" fill="#f7eedc" stroke="#2b2030" stroke-width="1.8" />
        <rect x="26" y="25" width="26" height="5" rx="2.5" fill="#f7eedc" stroke="#2b2030" stroke-width="1.8" />
        <path d="M31 41 Q34 38 37 41" fill="none" stroke="#2b2030" stroke-width="2" stroke-linecap="round" />
        <path d="M43 41 Q46 38 49 41" fill="none" stroke="#2b2030" stroke-width="2" stroke-linecap="round" />
        <ellipse cx="29" cy="45" rx="3" ry="1.8" fill="#f0a8ba" opacity="0.7" />
        <ellipse cx="51" cy="45" rx="3" ry="1.8" fill="#f0a8ba" opacity="0.7" />
        <path d="M38 46 Q40 48.5 42 46" fill="none" stroke="#2b2030" stroke-width="1.6" stroke-linecap="round" />
      `;
    case "berry_penguin":
      return `
        <ellipse cx="40" cy="47" rx="18" ry="20" fill="#5e86b4" stroke="#2b2030" stroke-width="2" />
        <ellipse cx="40" cy="51" rx="13" ry="14" fill="#fbf5e8" />
        <ellipse cx="22" cy="49" rx="4" ry="8" transform="rotate(20 22 49)" fill="#4b719c" stroke="#2b2030" stroke-width="1.8" />
        <ellipse cx="58" cy="49" rx="4" ry="8" transform="rotate(-20 58 49)" fill="#4b719c" stroke="#2b2030" stroke-width="1.8" />
        <path d="M27 28 Q35 17 53 24 L50 30 Q39 27 27 28 Z" fill="#e4572e" stroke="#2b2030" stroke-width="1.8" stroke-linejoin="round" />
        <circle cx="34" cy="39" r="2.6" fill="#2b2030" /><circle cx="33.2" cy="38" r="1" fill="#ffffff" />
        <circle cx="46" cy="39" r="2.6" fill="#2b2030" /><circle cx="45.2" cy="38" r="1" fill="#ffffff" />
        <polygon points="37,43 43,43 40,47" fill="#e9b44c" stroke="#2b2030" stroke-width="1.4" stroke-linejoin="round" />
        <ellipse cx="33" cy="67.5" rx="4.5" ry="2.5" fill="#e9b44c" stroke="#2b2030" stroke-width="1.6" />
        <ellipse cx="47" cy="67.5" rx="4.5" ry="2.5" fill="#e9b44c" stroke="#2b2030" stroke-width="1.6" />
      `;
    case "moon_fox":
      return `
        <path d="M51 58 Q68 55 66 39 Q56 41 51 50 Z" fill="#3f4a78" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <path d="M62 41 Q66 39 66 44 Q61 45 59 43 Z" fill="#f7eedc" />
        <ellipse cx="39" cy="55" rx="13.5" ry="12.5" fill="#3f4a78" stroke="#2b2030" stroke-width="2" />
        <path d="M32 48 L39 58 L46 48 Z" fill="#f7eedc" stroke="#2b2030" stroke-width="1.4" stroke-linejoin="round" />
        <polygon points="24,31 19,11 35,23" fill="#3f4a78" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <polygon points="54,31 59,11 43,23" fill="#3f4a78" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <circle cx="39" cy="34" r="14" fill="#3f4a78" stroke="#2b2030" stroke-width="2" />
        <path d="M36 25 A4 4 0 1 0 42 25 A3 3 0 1 1 36 25 Z" fill="#f5ca5c" />
        <ellipse cx="33.5" cy="34.5" rx="2.6" ry="3.2" fill="#f5ca5c" stroke="#2b2030" stroke-width="1.2" /><circle cx="33" cy="33.5" r="1" fill="#ffffff" />
        <ellipse cx="44.5" cy="34.5" rx="2.6" ry="3.2" fill="#f5ca5c" stroke="#2b2030" stroke-width="1.2" /><circle cx="44" cy="33.5" r="1" fill="#ffffff" />
        <path d="M36.5 40 Q39 42 41.5 40" fill="none" stroke="#f7eedc" stroke-width="1.6" stroke-linecap="round" />
      `;
    case "teacup_cat":
    default:
      return `
        <path d="M55 46 Q64 46 64 54 Q64 61 54 61" fill="none" stroke="#f7eedc" stroke-width="5" stroke-linecap="round" />
        <path d="M55 46 Q64 46 64 54 Q64 61 54 61" fill="none" stroke="#2b2030" stroke-width="2" stroke-linecap="round" />
        <polygon points="26,33 23,19 35,27" fill="#e99052" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <polygon points="54,33 57,19 45,27" fill="#e99052" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <circle cx="40" cy="34" r="13.5" fill="#e99052" stroke="#2b2030" stroke-width="2" />
        <circle cx="34.5" cy="34" r="2.6" fill="#2b2030" /><circle cx="33.7" cy="33" r="1" fill="#ffffff" />
        <circle cx="45.5" cy="34" r="2.6" fill="#2b2030" /><circle cx="44.7" cy="33" r="1" fill="#ffffff" />
        <ellipse cx="40" cy="37.5" rx="6" ry="4" fill="#fdf1e2" />
        <path d="M23 44 L57 44 L54 62 Q52 69 40 69 Q28 69 26 62 Z" fill="#f7eedc" stroke="#2b2030" stroke-width="2" stroke-linejoin="round" />
        <line x1="25" y1="48" x2="55" y2="48" stroke="#e9b44c" stroke-width="2" />
        <ellipse cx="32" cy="44" rx="3.8" ry="2.6" fill="#fdf1e2" stroke="#2b2030" stroke-width="1.6" />
        <ellipse cx="48" cy="44" rx="3.8" ry="2.6" fill="#fdf1e2" stroke="#2b2030" stroke-width="1.6" />
      `;
  }
}

export function getTrinketTexture(id: string): THREE.CanvasTexture {
  const existing = textureCache.get(id);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(id, tex);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="128" height="128">${getTrinketInnerSvg(id)}</svg>`;
  const img = new Image();
  img.onload = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, 128, 128);
    ctx.drawImage(img, 0, 0, 128, 128);
    tex.needsUpdate = true;
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return tex;
}

/** Lightweight 2D-illustration acrylic standee on a rounded base. */
export function buildAcrylicStandee(id: string, scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.userData.standeeId = id;
  const base = cyl(0.068, 0.072, 0.014, M(PAL.cream, 0.45), 0, 0.007, 0, 14);
  base.castShadow = false;
  g.add(base);
  const tex = getTrinketTexture(id);
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.18),
    new THREE.MeshLambertMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.52,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    }),
  );
  card.position.set(0, 0.098, 0);
  card.castShadow = false;
  g.add(card);
  g.scale.setScalar(scale);
  return g;
}

export function disposeTrinketTextures(): void {
  for (const tex of textureCache.values()) {
    tex.dispose();
  }
  textureCache.clear();
}
