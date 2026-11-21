export interface ConstellationDef {
  id: string;
  name: string;
  zhName: string;
  note: string;
  stars: [number, number][];
  extraEdges?: [number, number][];
}

export const CONSTELLATIONS: ConstellationDef[] = [
  {
    id: "sleeping_cat",
    name: "Sleeping Cat",
    zhName: "睡梦小猫座",
    note: "Curled up above the eaves, dreaming of warm sunbeams.",
    stars: [
      [24, 62],
      [28, 36],
      [38, 22],
      [46, 33],
      [56, 22],
      [65, 38],
      [74, 58],
      [52, 70],
      [24, 62],
    ],
  },
  {
    id: "warm_mug",
    name: "Steam Mug",
    zhName: "热马克杯座",
    note: "A quiet cup kept warm for late-night thoughts.",
    stars: [
      [30, 44],
      [32, 76],
      [62, 76],
      [64, 44],
      [76, 50],
      [74, 66],
      [63, 68],
    ],
    extraEdges: [[0, 3]],
  },
  {
    id: "paper_plane",
    name: "Paper Glider",
    zhName: "纸飞机座",
    note: "Folded from a spare note and tossed into the breeze.",
    stars: [
      [18, 54],
      [82, 24],
      [58, 76],
      [48, 56],
      [18, 54],
    ],
    extraEdges: [[3, 1]],
  },
  {
    id: "crescent_lamp",
    name: "Study Lamp",
    zhName: "月牙台灯座",
    note: "A golden cone of calm above a quiet desk.",
    stars: [
      [34, 78],
      [48, 78],
      [62, 78],
      [48, 78],
      [40, 50],
      [58, 28],
      [72, 38],
    ],
  },
  {
    id: "bookstack",
    name: "Skyward Books",
    zhName: "叠叠书塔座",
    note: "One chapter at a time, stacked toward the moon.",
    stars: [
      [24, 74],
      [74, 74],
      [70, 56],
      [28, 56],
      [34, 38],
      [66, 38],
    ],
  },
  {
    id: "little_sprout",
    name: "Rooftop Sprout",
    zhName: "嫩芽星云",
    note: "Small kindness, watered daily, reaches toward the sky.",
    stars: [
      [50, 82],
      [50, 50],
      [30, 34],
      [44, 24],
      [50, 42],
      [68, 24],
      [74, 42],
    ],
  },
];

/** Deduplicates vertices and builds unique canonical undirected edges [a, b] (a < b) for a constellation. */
export function getConstellationGraph(def: ConstellationDef): {
  stars: [number, number][];
  edges: [number, number][];
} {
  const stars: [number, number][] = [];
  const indexMap: number[] = [];
  const seenPos = new Map<string, number>();

  for (const [u, v] of def.stars) {
    const key = `${u},${v}`;
    let idx = seenPos.get(key);
    if (idx === undefined) {
      idx = stars.length;
      seenPos.set(key, idx);
      stars.push([u, v]);
    }
    indexMap.push(idx);
  }

  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];
  const addEdge = (a0: number, b0: number) => {
    const a = Math.min(a0, b0);
    const b = Math.max(a0, b0);
    if (a === b) return;
    const key = `${a}-${b}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push([a, b]);
    }
  };

  for (let i = 0; i + 1 < def.stars.length; i++) {
    addEdge(indexMap[i], indexMap[i + 1]);
  }
  if (def.extraEdges) {
    for (const [a, b] of def.extraEdges) {
      addEdge(indexMap[a], indexMap[b]);
    }
  }

  return { stars, edges };
}

export interface MemoryCardDef {
  id: string;
  label: string;
  bg: string;
  accent: string;
  symbol: string;
}

export const MEMORY_CARDS: MemoryCardDef[] = [
  { id: "cat", label: "Cat", bg: "#f9e3d8", accent: "#c9704f", symbol: "🐱" },
  { id: "mug", label: "Coffee", bg: "#e4e7f5", accent: "#3f4a78", symbol: "☕" },
  { id: "star", label: "Star", bg: "#fbf0d0", accent: "#c78620", symbol: "⭐" },
  { id: "plant", label: "Leaf", bg: "#e3f0e0", accent: "#4b7c46", symbol: "🪴" },
  { id: "book", label: "Book", bg: "#fae0da", accent: "#c74828", symbol: "📖" },
  { id: "moon", label: "Moon", bg: "#ebe5f7", accent: "#5d4b8e", symbol: "🌙" },
  { id: "note", label: "Music", bg: "#f7e6cf", accent: "#a8682c", symbol: "🎵" },
  { id: "lantern", label: "Lantern", bg: "#fcecd2", accent: "#d1682a", symbol: "🏮" },
];

export type TrinketStyle = "chibi" | "creature";
export type TrinketRarity = "common" | "rare" | "cozy-rare";

export interface TrinketDef {
  id: string;
  name: string;
  zhName: string;
  style: TrinketStyle;
  rarity: TrinketRarity;
  accent: string;
  bg: string;
  flavor: string;
}

export const TRINKETS: TrinketDef[] = [
  {
    id: "dawn_knight",
    name: "Dawn Chibi Knight",
    zhName: "黎明小骑士",
    style: "chibi",
    rarity: "cozy-rare",
    accent: "#4868b2",
    bg: "#e7efff",
    flavor: "Soft silver-blue bangs, navy coat & a tiny golden wing hairpin.",
  },
  {
    id: "mint_scholar",
    name: "Mint Chibi Scholar",
    zhName: "薄荷小贤者",
    style: "chibi",
    rarity: "cozy-rare",
    accent: "#2d8a80",
    bg: "#e2f5f2",
    flavor: "Mint hair, dark teal cloak & a floating cyan star-wisp.",
  },
  {
    id: "star_mage",
    name: "Starlight Apprentice",
    zhName: "星光小法师",
    style: "chibi",
    rarity: "rare",
    accent: "#5963a6",
    bg: "#eceefb",
    flavor: "Wears an oversized starry hat and carries a tiny brass lantern.",
  },
  {
    id: "cloud_traveler",
    name: "Cloudline Traveler",
    zhName: "云端小旅人",
    style: "chibi",
    rarity: "rare",
    accent: "#c9704f",
    bg: "#faece6",
    flavor: "Snug knit scarf, navy beret & a lucky pocket compass.",
  },
  {
    id: "sparky_mouse",
    name: "Spark Cheek Pup",
    zhName: "电光小仓鼠",
    style: "creature",
    rarity: "common",
    accent: "#d99a1e",
    bg: "#fdf4d7",
    flavor: "Plump golden critter whose rosy cheeks crackle with cozy static.",
  },
  {
    id: "leafy_sprout",
    name: "Dewdrop Bulb",
    zhName: "嫩芽小草团",
    style: "creature",
    rarity: "common",
    accent: "#5b8d56",
    bg: "#e6f3e3",
    flavor: "Sunbathes on rooftop planters and wiggles its twin leaves.",
  },
  {
    id: "cream_pup",
    name: "Fluffy Collar Pup",
    zhName: "奶油小睡犬",
    style: "creature",
    rarity: "common",
    accent: "#b86b3a",
    bg: "#faeee2",
    flavor: "A round caramel-and-cream fluffball with a cloud-soft neck ruff.",
  },
  {
    id: "pebble_duck",
    name: "Sighing Duckling",
    zhName: "鹅卵小呆鸭",
    style: "creature",
    rarity: "common",
    accent: "#d4982a",
    bg: "#fcf3d9",
    flavor: "Stares blankly at clouds while hugging its cozy round belly.",
  },
  {
    id: "mochi_ghost",
    name: "Mochi Night Spirit",
    zhName: "麻薯小幽灵",
    style: "creature",
    rarity: "common",
    accent: "#7b6ba8",
    bg: "#f0ecfa",
    flavor: "Soft lavender mochi sprite in a striped bedtime cap.",
  },
  {
    id: "berry_penguin",
    name: "Berry Deck Penguin",
    zhName: "浆果小企鹅",
    style: "creature",
    rarity: "common",
    accent: "#4b719c",
    bg: "#e6eef7",
    flavor: "Chubby little deck-keeper wearing a miniature blush beret.",
  },
  {
    id: "moon_fox",
    name: "Crescent Kit",
    zhName: "月光小狐狸",
    style: "creature",
    rarity: "rare",
    accent: "#3f4a78",
    bg: "#e7eaf6",
    flavor: "Midnight coat speckled with gold crescent markings.",
  },
  {
    id: "teacup_cat",
    name: "Teacup Tabby",
    zhName: "茶杯小橘猫",
    style: "creature",
    rarity: "cozy-rare",
    accent: "#e4572e",
    bg: "#fbe8e2",
    flavor: "A pocket-sized ginger kitten curled inside a warm teacup.",
  },
];

const RARITY_WEIGHT: Record<TrinketRarity, number> = {
  common: 3.0,
  rare: 1.7,
  "cozy-rare": 1.1,
};

/** Pick a capsule trinket, gently favoring ones not yet in the player's collection. */
export function rollTrinket(ownedIds: string[]): TrinketDef {
  const owned = new Set(ownedIds);
  const weights = TRINKETS.map((t) => RARITY_WEIGHT[t.rarity] * (owned.has(t.id) ? 0.55 : 1.45));
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = Math.random() * total;
  for (let i = 0; i < TRINKETS.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return TRINKETS[i];
  }
  return TRINKETS[TRINKETS.length - 1];
}
