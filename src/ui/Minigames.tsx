import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sound } from "../game/audio";
import type { RooftopSave } from "../game/data";
import {
  CONSTELLATIONS,
  MEMORY_CARDS,
  TRINKETS,
  type ConstellationDef,
  type MemoryCardDef,
  type TrinketDef,
} from "../game/rooftopData";
import type { MemoryCardView } from "../scene/StudyScene";
import { cn } from "../utils/cn";
import { Icon } from "./Hud";

/* ------------------------------------------------------------------ */
/* Chibi & Pocket-Creature Vector Figures (No Uncanny Proportions)     */
/* ------------------------------------------------------------------ */

export function TrinketFigure({ id, size = 64 }: { id: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className="shrink-0 select-none overflow-visible"
      aria-hidden
    >
      {/* subtle warm stand */}
      <ellipse cx="40" cy="72" rx="18" ry="4.5" fill="#2b2030" opacity="0.14" />
      {renderFigureArt(id)}
    </svg>
  );
}

/** Shared soft anime chibi base face (nendoroid proportions: ~1:1.2 torso to head). */
function ChibiFace({ blush = "#f3a3a8", eyeColor = "#4e6cb8", smile = "gentle" }: { blush?: string; eyeColor?: string; smile?: "gentle" | "wink" | "happy" }) {
  return (
    <g>
      <circle cx="40" cy="31" r="16.5" fill="#fde3d3" stroke="#2b2030" strokeWidth="2" />
      {/* glossy eyes */}
      <g>
        <ellipse cx="33.5" cy="32.5" rx="2.7" ry="3.5" fill={eyeColor} />
        <ellipse cx="33.5" cy="31.5" rx="2.7" ry="2" fill="#2b2030" opacity="0.72" />
        <circle cx="32.6" cy="30.8" r="1.15" fill="#ffffff" />
        <circle cx="34.5" cy="33.8" r="0.6" fill="#ffffff" />
        <path d="M30.2 29.2 Q33.5 27.6 36.8 29.2" fill="none" stroke="#2b2030" strokeWidth="1.5" strokeLinecap="round" />

        {smile === "wink" ? (
          <path d="M43.2 32.5 Q46.5 29.8 49.6 32.5" fill="none" stroke="#2b2030" strokeWidth="1.9" strokeLinecap="round" />
        ) : (
          <>
            <ellipse cx="46.5" cy="32.5" rx="2.7" ry="3.5" fill={eyeColor} />
            <ellipse cx="46.5" cy="31.5" rx="2.7" ry="2" fill="#2b2030" opacity="0.72" />
            <circle cx="45.6" cy="30.8" r="1.15" fill="#ffffff" />
            <circle cx="47.5" cy="33.8" r="0.6" fill="#ffffff" />
            <path d="M43.2 29.2 Q46.5 27.6 49.8 29.2" fill="none" stroke="#2b2030" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </g>
      {/* cozy blush */}
      <ellipse cx="29" cy="36.5" rx="3" ry="1.6" fill={blush} opacity="0.65" />
      <ellipse cx="51" cy="36.5" rx="3" ry="1.6" fill={blush} opacity="0.65" />
      {/* tiny warm mouth */}
      {smile === "happy" ? (
        <path d="M37.5 39.2 Q40 42 42.5 39.2 Z" fill="#e58a82" stroke="#2b2030" strokeWidth="1.3" strokeLinejoin="round" />
      ) : (
        <path d="M38 39.5 Q40 41.2 42 39.5" fill="none" stroke="#2b2030" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </g>
  );
}

function renderFigureArt(id: string) {
  switch (id) {
    /* -------------------- 4 NENDOROID-STYLE CHIBIS -------------------- */
    case "dawn_knight":
      return (
        <g>
          {/* back hair volume */}
          <path d="M21 30 Q20 12 40 11 Q60 12 59 30 Q58 43 53 45 L27 45 Q22 43 21 30 Z" fill="#cad8ef" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          {/* navy & white coat */}
          <path d="M27 48 L53 48 L57 67 L45 67 L43 58 L37 58 L35 67 L23 67 Z" fill="#2c3e6b" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          {/* cream-white inner vest + gold trim */}
          <path d="M34 48 L46 48 L44 63 L36 63 Z" fill="#f7eedc" stroke="#2b2030" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M40 49 L40 62" stroke="#e9b44c" strokeWidth="1.8" />
          <circle cx="40" cy="52" r="2.2" fill="#5aa8e8" stroke="#2b2030" strokeWidth="1.2" />
          {/* sleeves & tiny hands */}
          <circle cx="24.5" cy="57" r="3" fill="#fde3d3" stroke="#2b2030" strokeWidth="1.6" />
          <circle cx="55.5" cy="57" r="3" fill="#fde3d3" stroke="#2b2030" strokeWidth="1.6" />
          {/* tiny star-sword hilt */}
          <path d="M56 56 L65 40" stroke="#4868b2" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M53 54 L59 58" stroke="#e9b44c" strokeWidth="2.4" strokeLinecap="round" />
          {/* boots */}
          <rect x="30" y="65" width="7" height="6" rx="2.5" fill="#231a2b" stroke="#2b2030" strokeWidth="1.6" />
          <rect x="43" y="65" width="7" height="6" rx="2.5" fill="#231a2b" stroke="#2b2030" strokeWidth="1.6" />
          <ChibiFace eyeColor="#4868b2" />
          {/* fluffy silver-blue bangs + ahoge */}
          <path
            d="M23 29 Q24 14 40 13 Q56 14 57 29 L53 26 L50 32 L45 24 L40 31 L35 23 L30 31 L27 25 Z"
            fill="#dce6f7"
            stroke="#2b2030"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M40 13 Q42 6 47 9" fill="none" stroke="#2b2030" strokeWidth="2" strokeLinecap="round" />
          {/* golden wing hairpin */}
          <path d="M50 19 L58 16 L55 23 Z" fill="#e9b44c" stroke="#2b2030" strokeWidth="1.4" strokeLinejoin="round" />
        </g>
      );

    case "mint_scholar":
      return (
        <g>
          {/* back mint hair */}
          <path d="M21 31 Q20 12 40 11 Q60 12 59 31 Q59 46 53 47 L27 47 Q21 46 21 31 Z" fill="#89cbb8" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          {/* dark teal academic coat */}
          <path d="M26 48 L54 48 L57 67 L23 67 Z" fill="#214653" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <path d="M35 48 L45 48 L43 66 L37 66 Z" fill="#2d6e78" stroke="#2b2030" strokeWidth="1.5" />
          <circle cx="40" cy="52" r="2.1" fill="#63d8d6" stroke="#2b2030" strokeWidth="1.2" />
          {/* sleeves & hands */}
          <circle cx="24" cy="57" r="3" fill="#fde3d3" stroke="#2b2030" strokeWidth="1.6" />
          <circle cx="56" cy="57" r="3" fill="#fde3d3" stroke="#2b2030" strokeWidth="1.6" />
          {/* floating cyan star-wisp */}
          <path d="M62 34 Q67 28 65 21 Q60 25 57 30 Z" fill="#5ce1e6" stroke="#2b2030" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="62" cy="31" r="2" fill="#ffffff" opacity="0.85" />
          {/* boots */}
          <rect x="30" y="65" width="7" height="6" rx="2.5" fill="#231a2b" stroke="#2b2030" strokeWidth="1.6" />
          <rect x="43" y="65" width="7" height="6" rx="2.5" fill="#231a2b" stroke="#2b2030" strokeWidth="1.6" />
          <ChibiFace eyeColor="#d06b8e" smile="wink" />
          {/* stylish gold-trim scholar eyepiece over right eye */}
          <rect x="43.2" y="29" width="7" height="5.5" rx="2" fill="#2b2030" stroke="#e9b44c" strokeWidth="1.3" />
          {/* soft layered mint bangs */}
          <path
            d="M22 30 Q24 13 40 12 Q56 13 58 30 L53 26 L48 33 L42 23 L38 32 L32 24 L27 32 Z"
            fill="#a7dfd0"
            stroke="#2b2030"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M39 12 Q35 6 31 9" fill="none" stroke="#2b2030" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case "star_mage":
      return (
        <g>
          {/* lavender hair */}
          <path d="M22 32 Q21 15 40 14 Q59 15 58 32 L55 46 L25 46 Z" fill="#7c6ca6" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          {/* cozy starry cloak */}
          <path d="M25 48 L55 48 L58 67 L22 67 Z" fill="#464d84" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <path d="M31 48 L40 55 L49 48" fill="#e9b44c" stroke="#2b2030" strokeWidth="1.5" strokeLinejoin="round" />
          {/* brass lantern */}
          <rect x="55" y="54" width="7" height="9" rx="2" fill="#f7d372" stroke="#2b2030" strokeWidth="1.6" />
          <circle cx="58.5" cy="58.5" r="1.8" fill="#fff7d6" />
          <ChibiFace eyeColor="#5963a6" smile="happy" />
          {/* bangs */}
          <path d="M24 29 Q29 19 40 19 Q51 19 56 29 L50 26 L44 30 L40 25 L35 30 L29 26 Z" fill="#9484bd" stroke="#2b2030" strokeWidth="1.8" strokeLinejoin="round" />
          {/* oversized starry wizard hat */}
          <ellipse cx="40" cy="21" rx="22" ry="5" fill="#3a3f70" stroke="#2b2030" strokeWidth="2" />
          <path d="M26 20 L38 4 Q43 2 45 7 L54 20 Z" fill="#484f8a" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="42" cy="14" r="2.2" fill="#e9b44c" />
        </g>
      );

    case "cloud_traveler":
      return (
        <g>
          <path d="M22 31 Q22 15 40 14 Q58 15 58 31 L54 45 L26 45 Z" fill="#a86d4b" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          {/* jacket */}
          <path d="M27 48 L53 48 L55 67 L25 67 Z" fill="#c9704f" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          {/* snug knit scarf */}
          <rect x="28" y="45" width="24" height="8" rx="4" fill="#f7eedc" stroke="#2b2030" strokeWidth="1.8" />
          <path d="M44 51 L49 62 L42 62 L39 52 Z" fill="#ecdfc4" stroke="#2b2030" strokeWidth="1.6" />
          <rect x="30" y="65" width="7" height="6" rx="2.5" fill="#46353a" stroke="#2b2030" strokeWidth="1.6" />
          <rect x="43" y="65" width="7" height="6" rx="2.5" fill="#46353a" stroke="#2b2030" strokeWidth="1.6" />
          <ChibiFace eyeColor="#4a6b5e" />
          {/* caramel bangs */}
          <path d="M24 28 Q30 18 40 18 Q50 18 56 28 L50 25 L43 30 L38 24 L31 30 Z" fill="#be7e58" stroke="#2b2030" strokeWidth="1.8" strokeLinejoin="round" />
          {/* cozy beret */}
          <path d="M22 21 Q25 10 42 11 Q56 12 56 21 Z" fill="#2d3b66" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <line x1="40" y1="8" x2="41" y2="11" stroke="#2b2030" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    /* -------------------- 8 CUTE POCKET CREATURES -------------------- */
    case "sparky_mouse":
      return (
        <g>
          {/* zigzag lightning tail */}
          <path d="M55 58 L64 52 L61 46 L70 39 L65 36" fill="none" stroke="#d99a1e" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M55 58 L64 52 L61 46 L70 39" fill="none" stroke="#2b2030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* ears */}
          <path d="M24 29 L17 12 L31 22 Z" fill="#f7d354" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <path d="M17 12 L22 20 L25 17 Z" fill="#2b2030" />
          <path d="M56 29 L63 12 L49 22 Z" fill="#f7d354" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <path d="M63 12 L58 20 L55 17 Z" fill="#2b2030" />
          {/* plump round body & head */}
          <ellipse cx="40" cy="54" rx="16" ry="15" fill="#f7d354" stroke="#2b2030" strokeWidth="2" />
          <circle cx="40" cy="34" r="15.5" fill="#f7d354" stroke="#2b2030" strokeWidth="2" />
          {/* glossy eyes */}
          <circle cx="33.5" cy="32.5" r="2.7" fill="#2b2030" />
          <circle cx="32.7" cy="31.5" r="1.1" fill="#ffffff" />
          <circle cx="46.5" cy="32.5" r="2.7" fill="#2b2030" />
          <circle cx="45.7" cy="31.5" r="1.1" fill="#ffffff" />
          {/* rosy electric cheeks & cat smile */}
          <circle cx="28" cy="37.5" r="3.4" fill="#e4572e" stroke="#2b2030" strokeWidth="1.2" />
          <circle cx="52" cy="37.5" r="3.4" fill="#e4572e" stroke="#2b2030" strokeWidth="1.2" />
          <path d="M36 37.5 Q38 40 40 37.5 Q42 40 44 37.5" fill="none" stroke="#2b2030" strokeWidth="1.6" strokeLinecap="round" />
          {/* little paws */}
          <ellipse cx="32" cy="67" rx="4.5" ry="2.8" fill="#f7d354" stroke="#2b2030" strokeWidth="1.8" />
          <ellipse cx="48" cy="67" rx="4.5" ry="2.8" fill="#f7d354" stroke="#2b2030" strokeWidth="1.8" />
        </g>
      );

    case "leafy_sprout":
      return (
        <g>
          {/* bulb on head + twin glossy leaves */}
          <path d="M35 28 Q33 17 40 13 Q47 17 45 28 Z" fill="#77b36b" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <path d="M39 14 Q23 6 19 18 Q28 24 39 16 Z" fill="#64a358" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <path d="M41 14 Q57 6 61 18 Q52 24 41 16 Z" fill="#77b36b" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          {/* round mint-teal body */}
          <path d="M22 48 Q21 28 40 27 Q59 28 58 48 Q58 66 40 67 Q22 66 22 48 Z" fill="#9cd3b8" stroke="#2b2030" strokeWidth="2" />
          {/* cute mint spot */}
          <circle cx="51" cy="54" r="3.5" fill="#63ab8c" opacity="0.65" />
          <circle cx="29" cy="58" r="2.5" fill="#63ab8c" opacity="0.65" />
          {/* ruby eyes */}
          <ellipse cx="33" cy="43" rx="3" ry="3.6" fill="#c74838" stroke="#2b2030" strokeWidth="1.4" />
          <circle cx="32.2" cy="41.6" r="1.2" fill="#ffffff" />
          <ellipse cx="47" cy="43" rx="3" ry="3.6" fill="#c74838" stroke="#2b2030" strokeWidth="1.4" />
          <circle cx="46.2" cy="41.6" r="1.2" fill="#ffffff" />
          <path d="M36.5 49.5 Q40 52 43.5 49.5" fill="none" stroke="#2b2030" strokeWidth="1.7" strokeLinecap="round" />
          <ellipse cx="31" cy="67" rx="4.5" ry="3" fill="#82bfa2" stroke="#2b2030" strokeWidth="1.8" />
          <ellipse cx="49" cy="67" rx="4.5" ry="3" fill="#82bfa2" stroke="#2b2030" strokeWidth="1.8" />
        </g>
      );

    case "cream_pup":
      return (
        <g>
          {/* fluffy cream tail */}
          <circle cx="57" cy="55" r="7.5" fill="#fcf4e4" stroke="#2b2030" strokeWidth="2" />
          {/* caramel body */}
          <ellipse cx="40" cy="55" rx="15" ry="13" fill="#d88d55" stroke="#2b2030" strokeWidth="2" />
          {/* cloud neck ruff */}
          <path d="M23 48 Q26 41 34 45 Q40 40 46 45 Q54 41 57 48 Q53 56 46 54 Q40 58 34 54 Q27 56 23 48 Z" fill="#fcf4e4" stroke="#2b2030" strokeWidth="1.9" strokeLinejoin="round" />
          {/* ears */}
          <ellipse cx="22" cy="27" rx="5.5" ry="9" transform="rotate(-18 22 27)" fill="#d88d55" stroke="#2b2030" strokeWidth="2" />
          <ellipse cx="58" cy="27" rx="5.5" ry="9" transform="rotate(18 58 27)" fill="#d88d55" stroke="#2b2030" strokeWidth="2" />
          {/* head + cream forehead */}
          <circle cx="40" cy="33" r="14.5" fill="#d88d55" stroke="#2b2030" strokeWidth="2" />
          <ellipse cx="40" cy="38" rx="9" ry="6.5" fill="#fcf4e4" />
          <circle cx="34" cy="31.5" r="2.7" fill="#2b2030" />
          <circle cx="33.1" cy="30.5" r="1" fill="#ffffff" />
          <circle cx="46" cy="31.5" r="2.7" fill="#2b2030" />
          <circle cx="45.1" cy="30.5" r="1" fill="#ffffff" />
          <ellipse cx="40" cy="35.5" rx="2.2" ry="1.5" fill="#2b2030" />
          <path d="M36.5 38.5 Q38.5 40.5 40 38.5 Q41.5 40.5 43.5 38.5" fill="none" stroke="#2b2030" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );

    case "pebble_duck":
      return (
        <g>
          {/* head tufts */}
          <path d="M37 15 L35 9 M40 14 L40 8 M43 15 L45 9" stroke="#2b2030" strokeWidth="2" strokeLinecap="round" />
          {/* round sunny duck body */}
          <ellipse cx="40" cy="54" rx="16.5" ry="14" fill="#f7cb52" stroke="#2b2030" strokeWidth="2" />
          <ellipse cx="40" cy="57" rx="10" ry="8" fill="#fdf1c8" />
          <circle cx="40" cy="31" r="15" fill="#f7cb52" stroke="#2b2030" strokeWidth="2" />
          {/* deadpan cute eyes (white + tiny pupil dot) */}
          <circle cx="33.5" cy="29.5" r="4.2" fill="#ffffff" stroke="#2b2030" strokeWidth="1.6" />
          <circle cx="33.5" cy="29.5" r="1.4" fill="#2b2030" />
          <circle cx="46.5" cy="29.5" r="4.2" fill="#ffffff" stroke="#2b2030" strokeWidth="1.6" />
          <circle cx="46.5" cy="29.5" r="1.4" fill="#2b2030" />
          {/* plump cream duck bill */}
          <ellipse cx="40" cy="37" rx="8" ry="4.2" fill="#fae6b4" stroke="#2b2030" strokeWidth="1.8" />
          <path d="M35 37 L45 37" stroke="#2b2030" strokeWidth="1.3" strokeLinecap="round" />
          {/* little flippers hugging belly */}
          <ellipse cx="26" cy="54" rx="4.5" ry="7" transform="rotate(15 26 54)" fill="#f0bd3c" stroke="#2b2030" strokeWidth="1.8" />
          <ellipse cx="54" cy="54" rx="4.5" ry="7" transform="rotate(-15 54 54)" fill="#f0bd3c" stroke="#2b2030" strokeWidth="1.8" />
          {/* webbed feet */}
          <ellipse cx="33" cy="68" rx="4.5" ry="2.5" fill="#e89a38" stroke="#2b2030" strokeWidth="1.6" />
          <ellipse cx="47" cy="68" rx="4.5" ry="2.5" fill="#e89a38" stroke="#2b2030" strokeWidth="1.6" />
        </g>
      );

    case "mochi_ghost":
      return (
        <g>
          {/* scalloped squishy ghost silhouette */}
          <path
            d="M22 50 Q22 25 40 24 Q58 25 58 50 L58 64 Q53 69 49 64 Q45 69 40 64 Q35 69 31 64 Q27 69 22 64 Z"
            fill="#ebe5f7"
            stroke="#2b2030"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* sleepy striped nightcap */}
          <path d="M27 28 Q35 10 56 14 L50 28 Z" fill="#7b6ba8" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="57" cy="14" r="4" fill="#f7eedc" stroke="#2b2030" strokeWidth="1.8" />
          <rect x="26" y="25" width="26" height="5" rx="2.5" fill="#f7eedc" stroke="#2b2030" strokeWidth="1.8" />
          {/* happy closed eyes + blush */}
          <path d="M31 41 Q34 38 37 41" fill="none" stroke="#2b2030" strokeWidth="2" strokeLinecap="round" />
          <path d="M43 41 Q46 38 49 41" fill="none" stroke="#2b2030" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="29" cy="45" rx="3" ry="1.8" fill="#f0a8ba" opacity="0.7" />
          <ellipse cx="51" cy="45" rx="3" ry="1.8" fill="#f0a8ba" opacity="0.7" />
          <path d="M38 46 Q40 48.5 42 46" fill="none" stroke="#2b2030" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );

    case "berry_penguin":
      return (
        <g>
          {/* chubby round sky-blue penguin */}
          <ellipse cx="40" cy="47" rx="18" ry="20" fill="#5e86b4" stroke="#2b2030" strokeWidth="2" />
          <ellipse cx="40" cy="51" rx="13" ry="14" fill="#fbf5e8" />
          {/* flippers */}
          <ellipse cx="22" cy="49" rx="4" ry="8" transform="rotate(20 22 49)" fill="#4b719c" stroke="#2b2030" strokeWidth="1.8" />
          <ellipse cx="58" cy="49" rx="4" ry="8" transform="rotate(-20 58 49)" fill="#4b719c" stroke="#2b2030" strokeWidth="1.8" />
          {/* cozy tomato-blush beret */}
          <path d="M27 28 Q35 17 53 24 L50 30 Q39 27 27 28 Z" fill="#e4572e" stroke="#2b2030" strokeWidth="1.8" strokeLinejoin="round" />
          {/* cute eyes + golden beak */}
          <circle cx="34" cy="39" r="2.6" fill="#2b2030" />
          <circle cx="33.2" cy="38" r="1" fill="#ffffff" />
          <circle cx="46" cy="39" r="2.6" fill="#2b2030" />
          <circle cx="45.2" cy="38" r="1" fill="#ffffff" />
          <polygon points="37,43 43,43 40,47" fill="#e9b44c" stroke="#2b2030" strokeWidth="1.4" strokeLinejoin="round" />
          <ellipse cx="33" cy="67.5" rx="4.5" ry="2.5" fill="#e9b44c" stroke="#2b2030" strokeWidth="1.6" />
          <ellipse cx="47" cy="67.5" rx="4.5" ry="2.5" fill="#e9b44c" stroke="#2b2030" strokeWidth="1.6" />
        </g>
      );

    case "moon_fox":
      return (
        <g>
          {/* fluffy midnight tail */}
          <path d="M51 58 Q68 55 66 39 Q56 41 51 50 Z" fill="#3f4a78" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <path d="M62 41 Q66 39 66 44 Q61 45 59 43 Z" fill="#f7eedc" />
          {/* sleek seated body */}
          <ellipse cx="39" cy="55" rx="13.5" ry="12.5" fill="#3f4a78" stroke="#2b2030" strokeWidth="2" />
          {/* chest fluff */}
          <path d="M32 48 L39 58 L46 48 Z" fill="#f7eedc" stroke="#2b2030" strokeWidth="1.4" strokeLinejoin="round" />
          {/* big pointed ears */}
          <polygon points="24,31 19,11 35,23" fill="#3f4a78" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="23,26 21,15 31,23" fill="#e9b44c" opacity="0.85" />
          <polygon points="54,31 59,11 43,23" fill="#3f4a78" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="55,26 57,15 47,23" fill="#e9b44c" opacity="0.85" />
          {/* head */}
          <circle cx="39" cy="34" r="14" fill="#3f4a78" stroke="#2b2030" strokeWidth="2" />
          {/* golden crescent forehead */}
          <path d="M36 25 A4 4 0 1 0 42 25 A3 3 0 1 1 36 25 Z" fill="#f5ca5c" />
          {/* glowing amber eyes */}
          <ellipse cx="33.5" cy="34.5" rx="2.6" ry="3.2" fill="#f5ca5c" stroke="#2b2030" strokeWidth="1.2" />
          <circle cx="33" cy="33.5" r="1" fill="#ffffff" />
          <ellipse cx="44.5" cy="34.5" rx="2.6" ry="3.2" fill="#f5ca5c" stroke="#2b2030" strokeWidth="1.2" />
          <circle cx="44" cy="33.5" r="1" fill="#ffffff" />
          <path d="M36.5 40 Q39 42 41.5 40" fill="none" stroke="#f7eedc" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );

    case "teacup_cat":
    default:
      return (
        <g>
          {/* ceramic cup handle */}
          <path d="M55 46 Q64 46 64 54 Q64 61 54 61" fill="none" stroke="#f7eedc" strokeWidth="5" strokeLinecap="round" />
          <path d="M55 46 Q64 46 64 54 Q64 61 54 61" fill="none" stroke="#2b2030" strokeWidth="2" strokeLinecap="round" />
          {/* kitten head peeking out */}
          <polygon points="26,33 23,19 35,27" fill="#e99052" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="54,33 57,19 45,27" fill="#e99052" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="40" cy="34" r="13.5" fill="#e99052" stroke="#2b2030" strokeWidth="2" />
          {/* tabby stripes */}
          <path d="M40 21 L40 26 M35 22 L36 26 M45 22 L44 26" stroke="#c8622a" strokeWidth="2" strokeLinecap="round" />
          {/* glossy kitten eyes */}
          <circle cx="34.5" cy="34" r="2.6" fill="#2b2030" />
          <circle cx="33.7" cy="33" r="1" fill="#ffffff" />
          <circle cx="45.5" cy="34" r="2.6" fill="#2b2030" />
          <circle cx="44.7" cy="33" r="1" fill="#ffffff" />
          <ellipse cx="40" cy="37.5" rx="6" ry="4" fill="#fdf1e2" />
          <polygon points="39,36 41,36 40,37.8" fill="#e58a82" />
          <path d="M37 39 Q38.5 40.5 40 39 Q41.5 40.5 43 39" fill="none" stroke="#2b2030" strokeWidth="1.4" strokeLinecap="round" />
          {/* warm cream teacup */}
          <path d="M23 44 L57 44 L54 62 Q52 69 40 69 Q28 69 26 62 Z" fill="#f7eedc" stroke="#2b2030" strokeWidth="2" strokeLinejoin="round" />
          <line x1="25" y1="48" x2="55" y2="48" stroke="#e9b44c" strokeWidth="2" />
          {/* little paws resting on rim */}
          <ellipse cx="32" cy="44" rx="3.8" ry="2.6" fill="#fdf1e2" stroke="#2b2030" strokeWidth="1.6" />
          <ellipse cx="48" cy="44" rx="3.8" ry="2.6" fill="#fdf1e2" stroke="#2b2030" strokeWidth="1.6" />
        </g>
      );
  }
}

/* ------------------------------------------------------------------ */
/* 1. Stargazing Constellation Connect                                 */
/* ------------------------------------------------------------------ */

export function StargazingPanel({
  completedIds,
  tokens,
  aimed,
  progress,
  wrongNotice,
  justUnlocked,
  onResetStroke,
  onDismissUnlocked,
  onClose,
}: {
  completedIds: string[];
  tokens: number;
  aimed: boolean;
  progress: { drawn: number; total: number } | null;
  wrongNotice: boolean;
  justUnlocked: ConstellationDef | null;
  onResetStroke: () => void;
  onDismissUnlocked: () => void;
  onClose: () => void;
}) {
  const lockedOn = aimed && !wrongNotice;

  return (
    <aside
      role="dialog"
      aria-label="Rooftop Stargazing"
      className="pointer-events-none flex h-full w-full max-w-[560px] flex-col items-center justify-end gap-2"
    >
      {/* Pure optical telescope eyepiece crosshair pinned at exact viewport center / NDC (0, 0) */}
      <div className="pointer-events-none fixed inset-0 grid place-items-center">
        <div
          className={cn(
            "relative grid h-[min(56vh,410px)] w-[min(56vh,410px)] place-items-center rounded-full border-2 shadow-[0_0_0_9999px_rgba(14,11,26,0.28)] transition-colors duration-150",
            wrongNotice ? "border-tomato" : lockedOn ? "border-[#ffe799]" : "border-mustard/55",
          )}
        >
          <div className="h-[88%] w-[88%] rounded-full border border-dashed border-[#ffe799]/25" />
          <div
            className={cn(
              "absolute h-7 w-7 rounded-full border-2 transition-all duration-150",
              wrongNotice
                ? "scale-110 border-tomato"
                : lockedOn
                  ? "scale-110 border-[#ffe799] shadow-[0_0_12px_rgba(255,231,153,0.85)]"
                  : "border-mustard/65",
            )}
          />
          <div
            className={cn(
              "absolute h-1.5 w-1.5 rounded-full transition-colors",
              wrongNotice ? "bg-tomato" : lockedOn ? "bg-[#ffe799]" : "bg-mustard/80",
            )}
          />
          {lockedOn && (
            <span className="absolute top-[calc(50%+22px)] rounded-full border border-ink bg-mustard px-2 py-0.5 text-[10px] font-extrabold text-ink">
              Aligned · Click
            </span>
          )}
        </div>
      </div>

      {/* Bottom compact status / unlock bar — top sky stays 100% unobstructed */}
      <div className="paper anim-rise pointer-events-auto relative z-10 mt-auto w-full rounded-[20px] px-4 py-2.5">
        {justUnlocked ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-[16.5px] font-semibold leading-tight">{justUnlocked.name}</p>
                <span className="rounded-full border border-ink bg-mustard px-2 py-0.5 text-[10.5px] font-extrabold">
                  +6 Energy · +2 Tokens
                </span>
                {completedIds.length >= CONSTELLATIONS.length && (
                  <span className="rounded-full border border-ink bg-tomato px-2 py-0.5 text-[10.5px] font-extrabold text-paper">
                    All 6 Charted · Meteor Shower!
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-soft">{justUnlocked.note}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  onDismissUnlocked();
                }}
                className="press shrink-0 rounded-xl border-[1.5px] border-ink bg-mustard px-3 py-1.5 text-[12px] font-extrabold text-ink"
              >
                Continue
              </button>
              <button
                type="button"
                aria-label="Close stargazing"
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-paper-deep"
              >
                <Icon name="x" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-semibold text-ink-soft">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-ink bg-mustard/65 px-2.5 py-0.5 text-[11px] font-extrabold text-ink">
                {completedIds.length}/{CONSTELLATIONS.length} Charted · {tokens} Tokens
              </span>
              {wrongNotice ? (
                <span className="font-extrabold text-tomato">Not quite that shape — try again!</span>
              ) : progress ? (
                <span className="text-ink">
                  {progress.drawn}/{progress.total} lines connected
                </span>
              ) : (
                <span>Scan the sky &amp; connect bright star clusters</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {progress && progress.drawn > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    sound.click();
                    onResetStroke();
                  }}
                  className="rounded-full border-[1.5px] border-ink bg-white/80 px-2.5 py-0.5 text-[11px] font-extrabold text-ink hover:bg-paper-deep"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                aria-label="Close stargazing"
                onClick={onClose}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors hover:bg-paper-deep"
              >
                <Icon name="x" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Cozy Memory Match                                                */
/* ------------------------------------------------------------------ */

interface CardTile {
  uid: number;
  def: MemoryCardDef;
  flipped: boolean;
  matched: boolean;
}

function buildDeck(pairCount: number): CardTile[] {
  const chosen = MEMORY_CARDS.slice(0, pairCount);
  const raw = [...chosen, ...chosen];
  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  return raw.map((def, uid) => ({ uid, def, flipped: false, matched: false }));
}

export function MemoryMatchPanel({
  bestMoves,
  tokens,
  flipCardRef,
  onSyncCards,
  onWin,
  onClose,
}: {
  bestMoves: number | null;
  tokens: number;
  flipCardRef?: { current: ((idx: number) => void) | null };
  onSyncCards?: (cards: MemoryCardView[] | null) => void;
  onWin: (moves: number) => void;
  onClose: () => void;
}) {
  const [pairCount, setPairCount] = useState<6 | 8>(6);
  const [dealId, setDealId] = useState(0);
  const [cards, setCards] = useState<CardTile[]>(() => buildDeck(6));
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const timerRef = useRef<number | null>(null);
  const onSyncRef = useRef(onSyncCards);
  onSyncRef.current = onSyncCards;

  const clearCompareTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearCompareTimer, [clearCompareTimer]);

  const startNew = (nextPairs: 6 | 8 = pairCount) => {
    clearCompareTimer();
    sound.click();
    setPairCount(nextPairs);
    setDealId((d) => d + 1);
    setCards(buildDeck(nextPairs));
    setPicked([]);
    setMoves(0);
    setWon(false);
  };

  const flipCard = (idx: number) => {
    if (won || picked.length >= 2 || !cards[idx] || cards[idx].flipped || cards[idx].matched) return;
    sound.pop();
    const nextCards = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    const nextPicked = [...picked, idx];
    setCards(nextCards);
    setPicked(nextPicked);

    if (nextPicked.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const [a, b] = nextPicked;
      if (nextCards[a].def.id === nextCards[b].def.id) {
        sound.rhythmNote(2);
        const solved = nextCards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
        setCards(solved);
        setPicked([]);
        if (solved.every((c) => c.matched)) {
          setWon(true);
          sound.sparkle();
          onWin(nextMoves);
        }
      } else {
        timerRef.current = window.setTimeout(() => {
          setCards((cur) => cur.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)));
          setPicked([]);
          timerRef.current = null;
        }, 620);
      }
    }
  };

  if (flipCardRef) flipCardRef.current = flipCard;

  useEffect(() => {
    onSyncRef.current?.(
      cards.map((c) => ({
        id: `${dealId}-${c.uid}-${c.def.id}`,
        def: c.def,
        open: c.flipped || c.matched,
        matched: c.matched,
      })),
    );
  }, [dealId, cards]);

  useEffect(() => {
    return () => {
      if (flipCardRef) flipCardRef.current = null;
      onSyncRef.current?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside
      role="dialog"
      aria-label="Cozy Memory Match"
      className="pointer-events-none flex h-full w-full max-w-[460px] flex-col items-center justify-between gap-2"
    >
      {/* Top compact tabletop bar */}
      <div className="paper anim-rise pointer-events-auto flex w-full flex-wrap items-center justify-between gap-2 rounded-[20px] px-4 py-2.5">
        <div>
          <h2 className="font-display text-[21px] font-semibold italic leading-none">Memory Match</h2>
          <p className="mt-1 text-[11.5px] font-semibold text-ink-soft">
            Moves: {moves} {bestMoves !== null ? `· Best: ${bestMoves}` : ""} · {tokens} Tokens
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {([6, 8] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => startNew(n)}
              className={cn(
                "rounded-full border-[1.5px] border-ink px-2.5 py-1 text-[11px] font-extrabold",
                pairCount === n ? "bg-mustard text-ink" : "bg-white/75 text-ink-soft hover:bg-paper-deep",
              )}
            >
              {n === 6 ? "4×3" : "4×4"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => startNew(pairCount)}
            className="rounded-full border-[1.5px] border-ink bg-white/80 px-2.5 py-1 text-[11px] font-extrabold hover:bg-paper-deep"
          >
            Shuffle
          </button>
          <button
            type="button"
            aria-label="Close memory match"
            onClick={onClose}
            className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-paper-deep"
          >
            <Icon name="x" />
          </button>
        </div>
      </div>

      {/* Bottom status / win banner — leaves the 3D wooden table completely unobstructed */}
      {won ? (
        <div className="paper anim-pop pointer-events-auto flex w-full items-center justify-between gap-2 rounded-[20px] px-4 py-2.5">
          <div>
            <p className="font-display text-[15px] font-semibold">Cleared in {moves} moves!</p>
            <p className="text-[11.5px] font-semibold text-ink-soft">+6 Energy · +2 Rooftop Tokens</p>
          </div>
          <button
            type="button"
            onClick={() => startNew(pairCount)}
            className="press rounded-xl border-[1.5px] border-ink bg-tomato px-3 py-1.5 text-[12px] font-extrabold text-paper"
          >
            Play Again
          </button>
        </div>
      ) : (
        <div className="paper pointer-events-auto rounded-full px-3.5 py-1 text-[11.5px] font-semibold text-ink-soft">
          Click cards on the table to flip &amp; match
        </div>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Lo-Fi Rhythm Tap (30s Chill 3-Lane Rhythm)                      */
/* ------------------------------------------------------------------ */

interface RhythmNote {
  id: number;
  lane: 0 | 1 | 2;
  hitAtMs: number;
  status: "pending" | "hit" | "missed";
}

const SONG_DURATION_MS = 30000;
const TRAVEL_MS = 1650;
const LANE_KEYS = ["A / J", "S / K", "D / L"] as const;

function generateChart(): RhythmNote[] {
  const notes: RhythmNote[] = [];
  let t = 1450;
  let lastLane = 0;
  let id = 0;
  while (t < SONG_DURATION_MS - 1100) {
    const stepChoices = [620, 620, 480, 760];
    const dt = stepChoices[id % stepChoices.length];
    const shift = Math.random() < 0.7 ? 1 : 2;
    const lane = ((lastLane + shift) % 3) as 0 | 1 | 2;
    notes.push({ id: id++, lane, hitAtMs: t, status: "pending" });
    lastLane = lane;
    t += dt;
  }
  return notes;
}

export function RhythmTapPanel({
  bestScore,
  tokens,
  onFinish,
  onClose,
}: {
  bestScore: number;
  tokens: number;
  onFinish: (score: number, maxCombo: number) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"ready" | "playing" | "done">("ready");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [notes, setNotes] = useState<RhythmNote[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [judge, setJudge] = useState<{ text: string; key: number } | null>(null);
  const [pressedLanes, setPressedLanes] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [laneFx, setLaneFx] = useState<{ lane: 0 | 1 | 2; kind: "perfect" | "good" | "miss"; key: number } | null>(null);
  const fxTimerRef = useRef<number | null>(null);

  const stateRef = useRef<{
    notes: RhythmNote[];
    startTs: number;
    score: number;
    combo: number;
    maxCombo: number;
    finished: boolean;
  }>({ notes: [], startTs: 0, score: 0, combo: 0, maxCombo: 0, finished: false });

  const rafRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (fxTimerRef.current !== null) window.clearTimeout(fxTimerRef.current);
    };
  }, []);

  const setLanePressed = useCallback((lane: 0 | 1 | 2, down: boolean) => {
    setPressedLanes((cur) => {
      if (cur[lane] === down) return cur;
      const next: [boolean, boolean, boolean] = [...cur] as [boolean, boolean, boolean];
      next[lane] = down;
      return next;
    });
  }, []);

  const startRound = () => {
    sound.click();
    const chart = generateChart();
    stateRef.current = {
      notes: chart,
      startTs: performance.now(),
      score: 0,
      combo: 0,
      maxCombo: 0,
      finished: false,
    };
    setNotes(chart);
    setElapsedMs(0);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setJudge(null);
    setLaneFx(null);
    setPressedLanes([false, false, false]);
    setPhase("playing");
  };

  useEffect(() => {
    if (phase !== "playing") return;
    let active = true;
    const tick = (now: number) => {
      if (!active) return;
      const s = stateRef.current;
      const elapsed = now - s.startTs;
      let changed = false;
      for (const n of s.notes) {
        if (n.status === "pending" && elapsed - n.hitAtMs > 230) {
          n.status = "missed";
          s.combo = 0;
          changed = true;
        }
      }
      if (changed) {
        setCombo(0);
        setNotes([...s.notes]);
      }
      setElapsedMs(elapsed);

      if (elapsed >= SONG_DURATION_MS) {
        if (!s.finished) {
          s.finished = true;
          setPhase("done");
          sound.sparkle();
          onFinish(s.score, s.maxCombo);
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, onFinish]);

  const tapLane = useCallback(
    (lane: 0 | 1 | 2) => {
      if (phase !== "playing") return;

      const s = stateRef.current;
      const elapsed = performance.now() - s.startTs;
      let bestIdx = -1;
      let bestDiff = Infinity;
      for (let i = 0; i < s.notes.length; i++) {
        const n = s.notes[i];
        if (n.status !== "pending" || n.lane !== lane) continue;
        const diff = Math.abs(n.hitAtMs - elapsed);
        if (diff <= 230 && diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }

      if (fxTimerRef.current !== null) window.clearTimeout(fxTimerRef.current);

      if (bestIdx >= 0) {
        s.notes[bestIdx].status = "hit";
        sound.rhythmNote(lane);
        const perfect = bestDiff <= 95;
        s.combo += 1;
        if (s.combo > s.maxCombo) s.maxCombo = s.combo;
        s.score += perfect ? 35 + s.combo * 2 : 20 + s.combo;
        setScore(s.score);
        setCombo(s.combo);
        setMaxCombo(s.maxCombo);
        setNotes([...s.notes]);
        setJudge({ text: perfect ? "Perfect!" : "Good!", key: elapsed });
        setLaneFx({ lane, kind: perfect ? "perfect" : "good", key: elapsed });
      } else {
        sound.click();
        if (s.combo > 0) {
          s.combo = 0;
          setCombo(0);
        }
        setJudge({ text: "Miss", key: elapsed });
        setLaneFx({ lane, kind: "miss", key: elapsed });
      }

      fxTimerRef.current = window.setTimeout(() => {
        setLaneFx(null);
        fxTimerRef.current = null;
      }, 260);
    },
    [phase],
  );

  useEffect(() => {
    if (phase !== "playing") {
      setPressedLanes([false, false, false]);
      return;
    }
    const laneForKey = (k: string): 0 | 1 | 2 | null => {
      if (k === "a" || k === "j") return 0;
      if (k === "s" || k === "k") return 1;
      if (k === "d" || k === "l") return 2;
      return null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const lane = laneForKey(e.key.toLowerCase());
      if (lane !== null) {
        setLanePressed(lane, true);
        tapLane(lane);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const lane = laneForKey(e.key.toLowerCase());
      if (lane !== null) setLanePressed(lane, false);
    };
    const onBlur = () => setPressedLanes([false, false, false]);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [phase, tapLane, setLanePressed]);

  const secsLeft = Math.max(0, Math.ceil((SONG_DURATION_MS - elapsedMs) / 1000));
  const rank = score >= 900 ? "S" : score >= 550 ? "A" : score >= 250 ? "B" : "C";
  const rankPct = Math.min(100, (score / 1000) * 100);
  const songPct = phase === "done" ? 100 : Math.min(100, (elapsedMs / SONG_DURATION_MS) * 100);
  const paddedScore = String(score).padStart(6, "0");
  const highwayColors = ["#ff7052", "#ffd166", "#7de0a6"] as const;

  return (
    <aside
      role="dialog"
      aria-label="Lo-Fi Rhythm Tap"
      className="paper anim-rise pointer-events-auto flex max-h-full w-full max-w-[680px] flex-col rounded-[26px] bg-[#161229] text-[#f7eedc]"
    >
      {/* Project SEKAI-inspired Top Stage HUD */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1e1838] px-4 py-3 rounded-t-[24px] sm:px-5">
        {/* Left: Rank diamond + Score bar */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid h-10 w-10 rotate-45 place-items-center rounded-lg border-2 font-display text-[19px] font-bold shadow",
              rank === "S"
                ? "border-[#ffe57f] bg-mustard text-ink"
                : rank === "A"
                  ? "border-[#ff9b7d] bg-tomato text-paper"
                  : rank === "B"
                    ? "border-[#9de8bd] bg-sage text-paper"
                    : "border-[#9fb4ff] bg-[#2f355c] text-[#f7eedc]",
            )}
          >
            <span className="-rotate-45 leading-none">{rank}</span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#b8c7f2]">Score</span>
              <span className="font-mono text-[19px] font-extrabold leading-none tracking-wider text-white">
                {paddedScore}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="relative h-2 w-36 overflow-hidden rounded-full bg-white/15 sm:w-44">
                <div
                  className="h-full bg-gradient-to-r from-[#7de0a6] via-[#ffd166] to-[#ff7052] transition-[width] duration-150"
                  style={{ width: `${rankPct}%` }}
                />
              </div>
              <span className="text-[9.5px] font-extrabold text-white/60">C · B · A · S</span>
            </div>
          </div>
        </div>

        {/* Right: Song progress, Best, Tokens & Close */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] font-extrabold text-mustard">
              {phase === "playing" ? `${secsLeft}s left` : phase === "done" ? "Finished" : "30s Set"} · Best {Math.max(bestScore, score)}
            </p>
            <div className="mt-1 flex items-center justify-end gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/15">
                <div className="h-full bg-[#7ce8ff] transition-[width] duration-150" style={{ width: `${songPct}%` }} />
              </div>
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-extrabold">
                🪙 {tokens}
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close rhythm game"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[#f7eedc] transition-colors hover:bg-white/20"
          >
            <Icon name="x" />
          </button>
        </div>
      </header>

      {/* Main 3D Perspective Stage */}
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div
          className="relative flex h-[min(60vh,430px)] min-h-[320px] flex-col overflow-hidden rounded-[20px] border border-white/15"
          style={{
            background:
              "radial-gradient(circle at 20% 22%, rgba(124,232,255,0.16) 0, transparent 38%), radial-gradient(circle at 82% 28%, rgba(255,112,82,0.16) 0, transparent 42%), linear-gradient(180deg, #120e24 0%, #241b42 62%, #312352 100%)",
          }}
        >
          {/* Floating Combo Counter on Right Side */}
          {phase === "playing" && combo >= 2 && (
            <div key={`cmb-${combo}`} className="anim-pop pointer-events-none absolute right-5 top-1/3 z-20 text-center sm:right-8">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.26em] text-[#7ce8ff]">Combo</p>
              <p
                className="font-display text-[46px] font-bold italic leading-none text-white"
                style={{ textShadow: "0 0 18px rgba(124,232,255,0.7)" }}
              >
                {combo}
              </p>
            </div>
          )}

          {/* Center Floating Judgment Word (PERFECT / GREAT / MISS) */}
          {phase === "playing" && (laneFx || judge) && (
            <div
              key={`jdg-${laneFx?.key ?? judge?.key}`}
              className="anim-pop pointer-events-none absolute bottom-[26%] left-1/2 z-20 -translate-x-1/2 text-center"
            >
              <span
                className={cn(
                  "font-display text-[26px] font-extrabold italic tracking-wider sm:text-[32px]",
                  (laneFx?.kind ?? (judge?.text === "Perfect!" ? "perfect" : judge?.text === "Good!" ? "good" : "miss")) === "perfect"
                    ? "text-[#ffe373]"
                    : (laneFx?.kind ?? "good") === "good"
                      ? "text-[#7de0a6]"
                      : "text-white/65",
                )}
                style={{ textShadow: "0 2px 12px rgba(0,0,0,0.65)" }}
              >
                {laneFx
                  ? laneFx.kind === "perfect"
                    ? "PERFECT"
                    : laneFx.kind === "good"
                      ? "GREAT"
                      : "MISS"
                  : judge?.text.toUpperCase()}
              </span>
            </div>
          )}

          {/* Perspective Highway Viewport */}
          <div className="relative flex-1 overflow-hidden" style={{ perspective: "460px" }}>
            <div
              className="mx-auto h-full w-[92%] max-w-[460px] border-x-2 border-[#7ce8ff]/45 bg-[#120f24]/65 shadow-[0_0_32px_rgba(124,232,255,0.16)]"
              style={{ transform: "rotateX(36deg)", transformOrigin: "50% 88%" }}
            >
              {/* 3 Perspective Lanes + Key Light Beams */}
              <div className="relative grid h-full grid-cols-3">
                {([0, 1, 2] as const).map((lane) => {
                  const pressed = pressedLanes[lane];
                  const fx = laneFx?.lane === lane ? laneFx : null;
                  const col = highwayColors[lane];
                  return (
                    <div key={lane} className="relative border-r border-white/15 last:border-r-0">
                      {/* Full-lane light beam on key/pad press */}
                      <div
                        className="pointer-events-none absolute inset-0 transition-opacity duration-75"
                        style={{
                          opacity: pressed ? 0.42 : 0,
                          background: `linear-gradient(180deg, transparent 5%, ${col} 92%)`,
                        }}
                      />
                      {/* Judgment pad flash */}
                      <div
                        className="pointer-events-none absolute inset-x-1.5 h-5 -translate-y-1/2 rounded-md border transition-transform duration-75"
                        style={{
                          top: "86%",
                          borderColor: pressed || fx ? col : "rgba(255,255,255,0.35)",
                          backgroundColor: pressed ? `${col}77` : "rgba(255,255,255,0.08)",
                          boxShadow: fx && fx.kind !== "miss" ? `0 0 20px ${col}` : undefined,
                          transform: `translateY(-50%) scale(${pressed ? 1.06 : 1})`,
                        }}
                      />
                    </div>
                  );
                })}

                {/* Luminous Crystal Judgment Line */}
                <div
                  className="pointer-events-none absolute inset-x-0 h-[3px] -translate-y-1/2 bg-gradient-to-r from-[#7ce8ff] via-white to-[#7ce8ff]"
                  style={{ top: "86%", boxShadow: "0 0 14px rgba(124,232,255,0.85)" }}
                />

                {/* Wide Glowing Bar Notes rushing down highway */}
                {phase === "playing" &&
                  notes.map((n) => {
                    if (n.status !== "pending") return null;
                    const progress = 1 - (n.hitAtMs - elapsedMs) / TRAVEL_MS;
                    if (progress < -0.04 || progress > 1.14) return null;
                    const yPct = progress * 86;
                    const leftPct = n.lane * 33.333 + 16.666;
                    const col = highwayColors[n.lane];
                    return (
                      <div
                        key={n.id}
                        className="pointer-events-none absolute h-4 w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
                        style={{
                          left: `${leftPct}%`,
                          top: `${yPct}%`,
                          background: `linear-gradient(180deg, #ffffff 0%, ${col} 45%, ${col} 100%)`,
                          boxShadow: `0 0 16px ${col}`,
                        }}
                      />
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Start / Finish Stage Overlays */}
          {phase === "ready" && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#120e24]/82 px-6 text-center">
              <p className="font-display text-[26px] font-semibold italic text-white">Rooftop Synth Stage</p>
              <p className="mt-1.5 max-w-[340px] text-[13px] text-[#cfd8ff]">
                Hit glowing bars on the crystal line using <strong className="text-white">A / S / D</strong>,{" "}
                <strong className="text-white">J / K / L</strong>, or tapping the stage pads below.
              </p>
              <button
                type="button"
                onClick={startRound}
                className="press mt-5 rounded-2xl border-2 border-ink bg-mustard px-6 py-2.5 text-[14px] font-extrabold text-ink shadow"
              >
                Start 30s Chill Track
              </button>
            </div>
          )}

          {phase === "done" && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#120e24]/88 px-6 text-center">
              <span className="rounded-full border border-mustard/60 bg-mustard/20 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-widest text-mustard">
                Rank {rank} Clear
              </span>
              <p className="mt-2 font-display text-[28px] font-semibold italic text-white">Stage Clear!</p>
              <p className="mt-1 text-[14px] font-bold text-[#cfe0ff]">
                Score {score} · Max Combo {maxCombo}
              </p>
              <p className="mt-1 text-[12.5px] font-semibold text-[#7de0a6]">
                +8 Energy · +{score >= 250 ? 3 : 2} Rooftop Tokens
              </p>
              <button
                type="button"
                onClick={startRound}
                className="press mt-4 rounded-2xl border-2 border-ink bg-tomato px-5 py-2 text-[13.5px] font-extrabold text-paper"
              >
                Encore (Play Again)
              </button>
            </div>
          )}

          {/* Large Tactile Bottom Keycap Pads */}
          <div className="relative z-20 grid h-[56px] shrink-0 grid-cols-3 gap-2 border-t border-white/15 bg-[#110d20] p-2">
            {([0, 1, 2] as const).map((lane) => {
              const down = pressedLanes[lane];
              const col = highwayColors[lane];
              return (
                <button
                  key={lane}
                  type="button"
                  onPointerDown={() => {
                    setLanePressed(lane, true);
                    tapLane(lane);
                  }}
                  onPointerUp={() => setLanePressed(lane, false)}
                  onPointerLeave={() => setLanePressed(lane, false)}
                  onPointerCancel={() => setLanePressed(lane, false)}
                  style={down ? { backgroundColor: col, color: "#161229", boxShadow: `0 0 18px ${col}` } : undefined}
                  className={cn(
                    "flex items-center justify-center rounded-xl border border-white/20 text-[13px] font-extrabold tracking-wider transition-transform duration-75",
                    down ? "scale-[0.95]" : "bg-white/10 text-white hover:bg-white/15",
                  )}
                >
                  <span
                    className="mr-2 inline-block h-3 w-3 rounded-full border border-black/30"
                    style={{ backgroundColor: down ? "#161229" : col }}
                  />
                  {LANE_KEYS[lane]}
                </button>
              );
            })}
          </div>
        </div>

        <p className="pt-2.5 text-center text-[11.5px] font-semibold text-white/65">
          Score 250+ (Rank B) for +3 Rooftop Tokens · Press Esc to exit
        </p>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Retro Capsule Machine & Chibi / Mascot Shelf                     */
/* ------------------------------------------------------------------ */

export function CapsuleMachinePanel({
  rooftop,
  stars,
  onPull,
  onToggleDesk,
  onToggleCompanion,
  onClose,
}: {
  rooftop: RooftopSave;
  stars: number;
  onPull: (payWithStar: boolean) => { trinket: TrinketDef; isNew: boolean } | null;
  onToggleDesk: (id: string) => void;
  onToggleCompanion: (id: string) => void;
  onClose: () => void;
}) {
  const [cranking, setCranking] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [result, setResult] = useState<{ trinket: TrinketDef; isNew: boolean } | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const pullTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pullTimerRef.current !== null) window.clearTimeout(pullTimerRef.current);
    };
  }, []);

  const canUseTokens = rooftop.tokens >= 2;
  const canUseStar = stars >= 1;

  const triggerPull = (payWithStar: boolean) => {
    if (cranking) return;
    const outcome = onPull(payWithStar);
    if (!outcome) return;
    sound.gachaCrank();
    setCranking(true);
    setResult(null);
    pullTimerRef.current = window.setTimeout(() => {
      setCranking(false);
      setResult(outcome);
      setInspectId(outcome.trinket.id);
      setRevealKey((k) => k + 1);
      sound.sparkle();
      pullTimerRef.current = null;
    }, 1050);
  };

  const inspected = useMemo(
    () => TRINKETS.find((t) => t.id === (inspectId ?? result?.trinket.id ?? null)) ?? null,
    [inspectId, result],
  );
  const ownedInspected = inspected ? rooftop.trinkets.includes(inspected.id) : false;

  return (
    <aside
      role="dialog"
      aria-label="Rooftop Capsule Machine"
      className="paper anim-slide pointer-events-auto flex max-h-full w-full flex-col rounded-[26px] sm:w-[420px]"
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 className="font-display text-[25px] font-semibold italic leading-none">Capsule Machine</h2>
          <p className="mt-1.5 text-[12px] font-semibold text-ink-soft">
            {rooftop.trinkets.length}/{TRINKETS.length} collected · {rooftop.tokens} Tokens · {stars} ★
          </p>
        </div>
        <button
          type="button"
          aria-label="Close capsule machine"
          onClick={onClose}
          className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-paper-deep"
        >
          <Icon name="x" />
        </button>
      </header>

      {/* Pull & Reveal stage */}
      <div className="px-4 pt-3 sm:px-5">
        <div
          className="relative flex min-h-[154px] items-center gap-3.5 rounded-[20px] border-[1.5px] border-ink p-3.5 transition-colors"
          style={{ backgroundColor: inspected && !cranking ? inspected.bg : "#f0e6d2" }}
        >
          {cranking ? (
            <div className="flex w-full flex-col items-center justify-center py-3">
              <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="h-11 w-11 animate-bounce rounded-full border-2 border-ink bg-gradient-to-b from-tomato from-50% to-paper to-50% shadow" />
              </div>
              <p className="mt-2 font-display text-[15px] font-semibold">Cranking… capsule dropping!</p>
            </div>
          ) : inspected ? (
            <>
              <div
                key={`fig-${revealKey}-${inspected.id}`}
                className="anim-pop grid h-[92px] w-[92px] shrink-0 place-items-center rounded-2xl border-[1.5px] border-ink bg-white/85"
              >
                <TrinketFigure id={inspected.id} size={80} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-ink bg-white/90 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
                    {inspected.style === "chibi" ? "Chibi Doll" : "Pocket Critter"}
                  </span>
                  {result?.trinket.id === inspected.id && (
                    <span
                      className={cn(
                        "anim-pop rounded-full border border-ink px-2 py-0.5 text-[10px] font-extrabold",
                        result.isNew ? "bg-tomato text-paper" : "bg-mustard text-ink",
                      )}
                    >
                      {result.isNew ? "NEW!" : "Duplicate · +1 Token"}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-display text-[17.5px] font-semibold leading-tight">{inspected.name}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink/85">{inspected.flavor}</p>
                {ownedInspected && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        sound.click();
                        onToggleDesk(inspected.id);
                      }}
                      className={cn(
                        "rounded-lg border border-ink px-2 py-0.5 text-[10.5px] font-extrabold transition-colors",
                        rooftop.deskTrinket === inspected.id
                          ? "bg-sage text-paper"
                          : "bg-white/85 text-ink hover:bg-mustard/50",
                      )}
                    >
                      {rooftop.deskTrinket === inspected.id ? "On Desk ✓" : "Place on Desk"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sound.click();
                        onToggleCompanion(inspected.id);
                      }}
                      className={cn(
                        "rounded-lg border border-ink px-2 py-0.5 text-[10.5px] font-extrabold transition-colors",
                        rooftop.companionTrinket === inspected.id
                          ? "bg-tomato text-paper"
                          : "bg-white/85 text-ink hover:bg-mustard/50",
                      )}
                    >
                      {rooftop.companionTrinket === inspected.id ? "Following ✓" : "Follow Me"}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex w-full flex-col items-center justify-center py-4 text-center">
              <p className="font-display text-[16.5px] font-semibold">Turn the brass crank</p>
              <p className="mt-1 text-[12px] text-ink-soft">
                Pull cute 2D acrylic standees to display on your bookshelf, study desk, or beside you!
              </p>
            </div>
          )}
        </div>

        {/* Crank buttons */}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canUseTokens || cranking}
            onClick={() => triggerPull(false)}
            className={cn(
              "press flex-1 rounded-xl border-[1.5px] border-ink px-3 py-2 text-[12.5px] font-extrabold transition-opacity",
              canUseTokens ? "bg-tomato text-paper" : "cursor-not-allowed bg-paper-deep text-ink/45",
            )}
          >
            Pull Capsule (2 Tokens)
          </button>
          <button
            type="button"
            disabled={!canUseStar || cranking}
            onClick={() => triggerPull(true)}
            title="Optionally trade 1 Focus Star for a capsule"
            className={cn(
              "press rounded-xl border-[1.5px] border-ink px-3 py-2 text-[12.5px] font-extrabold",
              canUseStar ? "bg-mustard text-ink" : "cursor-not-allowed bg-paper-deep text-ink/45",
            )}
          >
            1 ★ Star Pull
          </button>
        </div>
      </div>

      {/* 12-slot shelf collection */}
      <div className="scroll-soft mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-ink-soft">
          Collection Shelf ({rooftop.trinkets.length}/{TRINKETS.length})
        </p>
        <div className="grid grid-cols-4 gap-2">
          {TRINKETS.map((t) => {
            const owned = rooftop.trinkets.includes(t.id);
            const selected = inspected?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!owned}
                onClick={() => {
                  sound.click();
                  setResult(null);
                  setInspectId(t.id);
                }}
                style={owned ? { backgroundColor: t.bg } : undefined}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border-[1.5px] p-1.5 text-center transition-transform",
                  owned
                    ? selected
                      ? "border-ink ring-2 ring-tomato/70"
                      : "border-ink hover:-translate-y-0.5"
                    : "cursor-default border-dashed border-ink/35 bg-white/40",
                )}
              >
                {owned ? (
                  <>
                    <TrinketFigure id={t.id} size={46} />
                    <span className="mt-0.5 line-clamp-1 text-[10px] font-extrabold text-ink">{t.name}</span>
                  </>
                ) : (
                  <div className="flex h-[62px] flex-col items-center justify-center text-ink/35">
                    <span className="font-display text-[18px] font-semibold">?</span>
                    <span className="text-[9px] font-bold">Locked</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Standalone Collection Shelf (Accessible from Anywhere)           */
/* ------------------------------------------------------------------ */

export function CollectionPanel({
  rooftop,
  onToggleDesk,
  onToggleCompanion,
  onClose,
}: {
  rooftop: RooftopSave;
  onToggleDesk: (id: string) => void;
  onToggleCompanion: (id: string) => void;
  onClose: () => void;
}) {
  const [inspectId, setInspectId] = useState<string | null>(() => rooftop.deskTrinket ?? rooftop.companionTrinket ?? rooftop.trinkets[0] ?? null);
  const inspected = useMemo(() => TRINKETS.find((t) => t.id === inspectId) ?? null, [inspectId]);
  const ownedSelected = inspected ? rooftop.trinkets.includes(inspected.id) : false;

  return (
    <aside
      role="dialog"
      aria-label="Standee Collection"
      className="paper anim-rise pointer-events-auto flex max-h-full w-full flex-col rounded-[26px] sm:w-[440px]"
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 className="font-display text-[25px] font-semibold italic leading-none">Standee Collection</h2>
          <p className="mt-1.5 text-[12px] font-semibold text-ink-soft">
            {rooftop.trinkets.length}/{TRINKETS.length} collected · {rooftop.tokens} Tokens
          </p>
        </div>
        <button
          type="button"
          aria-label="Close collection"
          onClick={onClose}
          className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-paper-deep"
        >
          <Icon name="x" />
        </button>
      </header>

      <div className="px-4 pt-3 sm:px-5">
        <div
          className="flex min-h-[126px] items-center gap-3.5 rounded-[20px] border-[1.5px] border-ink p-3.5"
          style={{ backgroundColor: inspected && ownedSelected ? inspected.bg : "#f0e6d2" }}
        >
          {inspected && ownedSelected ? (
            <>
              <div className="grid h-[86px] w-[86px] shrink-0 place-items-center rounded-2xl border-[1.5px] border-ink bg-white/85">
                <TrinketFigure id={inspected.id} size={74} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[17.5px] font-semibold leading-tight">{inspected.name}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink/85">{inspected.flavor}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      sound.click();
                      onToggleDesk(inspected.id);
                    }}
                    className={cn(
                      "rounded-lg border border-ink px-2.5 py-1 text-[11px] font-extrabold transition-colors",
                      rooftop.deskTrinket === inspected.id
                        ? "bg-sage text-paper"
                        : "bg-white/85 text-ink hover:bg-mustard/50",
                    )}
                  >
                    {rooftop.deskTrinket === inspected.id ? "On Desk ✓" : "Place on Desk"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sound.click();
                      onToggleCompanion(inspected.id);
                    }}
                    className={cn(
                      "rounded-lg border border-ink px-2.5 py-1 text-[11px] font-extrabold transition-colors",
                      rooftop.companionTrinket === inspected.id
                        ? "bg-tomato text-paper"
                        : "bg-white/85 text-ink hover:bg-mustard/50",
                    )}
                  >
                    {rooftop.companionTrinket === inspected.id ? "Following ✓" : "Follow Me"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full py-3 text-center">
              <p className="font-display text-[16px] font-semibold">No standee selected yet</p>
              <p className="mt-1 text-[12px] text-ink-soft">
                Climb the study loft ladder to the rooftop Capsule Machine to pull acrylic standees!
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="scroll-soft mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="grid grid-cols-4 gap-2">
          {TRINKETS.map((t) => {
            const owned = rooftop.trinkets.includes(t.id);
            const selected = inspected?.id === t.id;
            const onDesk = rooftop.deskTrinket === t.id;
            const following = rooftop.companionTrinket === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!owned}
                onClick={() => {
                  sound.click();
                  setInspectId(t.id);
                }}
                style={owned ? { backgroundColor: t.bg } : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-xl border-[1.5px] p-1.5 text-center transition-transform",
                  owned
                    ? selected
                      ? "border-ink ring-2 ring-tomato/70"
                      : "border-ink hover:-translate-y-0.5"
                    : "cursor-default border-dashed border-ink/35 bg-white/40",
                )}
              >
                {(onDesk || following) && (
                  <span className="absolute right-1 top-1 rounded-full border border-ink bg-mustard px-1 text-[8px] font-extrabold leading-tight">
                    {following ? "Follow" : "Desk"}
                  </span>
                )}
                {owned ? (
                  <>
                    <TrinketFigure id={t.id} size={46} />
                    <span className="mt-0.5 line-clamp-1 text-[10px] font-extrabold text-ink">{t.name}</span>
                  </>
                ) : (
                  <div className="flex h-[62px] flex-col items-center justify-center text-ink/35">
                    <span className="font-display text-[18px] font-semibold">?</span>
                    <span className="text-[9px] font-bold">Locked</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
