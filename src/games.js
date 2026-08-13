// src/games.js — game registry for the multi-store layout
// Each game has its own store with its own packages (diamond_packages.game = slug).
const GAMES = [
  {
    slug: "freefire",
    name: "FREE FIRE",
    emoji: "💎",
    color: "#00d4ff",
    tagline: "Diamonds & membership top-ups",
    unitLabel: "Diamonds",
    // Free Fire only needs UID — never ask for a password.
    accountLabel: "Free Fire UID",
    accountPlaceholder: "e.g. 1234567890",
    accountPattern: "\\d{5,12}",
    accountPatternTitle: "UID must be 5-12 digits",
    needPassword: false,
    passwordNotice: "UID ONLY — NO PASSWORD NEEDED. Never share your game password with anyone.",
  },
  {
    slug: "bloodstrike",
    name: "BLOOD STRIKE",
    emoji: "🔥",
    color: "#ff4757",
    tagline: "Gold & Passes",
    unitLabel: "Gold",
    sections: ["Gold", "Passes"],
    accountLabel: "Blood Strike Player ID",
    accountPlaceholder: "e.g. BS-887654321",
    accountPattern: ".{4,20}",
    accountPatternTitle: "Enter your Blood Strike Player ID",
    needPassword: false,
    passwordNotice: "Player ID ONLY — NO PASSWORD NEEDED.",
  },
  {
    slug: "codm",
    name: "CALL OF DUTY MOBILE",
    emoji: "🎯",
    color: "#ffa502",
    tagline: "COD Points (CP) top-up",
    unitLabel: "CP",
    accountLabel: "CoDM Player ID",
    accountPlaceholder: "e.g. 9988776655",
    accountPattern: "\\d{6,15}",
    accountPatternTitle: "Enter your Call of Duty Mobile Player ID",
    needPassword: false,
    passwordNotice: "Player ID ONLY — NO PASSWORD NEEDED.",
  },
  {
    slug: "madout2",
    name: "MADOUT2",
    emoji: "🚗",
    color: "#7bed9f",
    tagline: "Gems & Passes",
    unitLabel: "Gems",
    sections: ["Gems", "Passes"],
    accountLabel: "MadOut2 Player ID",
    accountPlaceholder: "e.g. MO2-554433221",
    accountPattern: ".{4,20}",
    accountPatternTitle: "Enter your MadOut2 Player ID",
    needPassword: false,
    passwordNotice: "Player ID ONLY — NO PASSWORD NEEDED.",
  },
  {
    slug: "onestate",
    name: "ONESTATE RP",
    emoji: "🏙️",
    color: "#a55eea",
    tagline: "Passes & State Coins",
    unitLabel: "Coins",
    sections: ["Passes", "State Coins"],
    accountLabel: "OneState RP Player ID",
    accountPlaceholder: "e.g. OS-1122334455",
    accountPattern: ".{4,20}",
    accountPatternTitle: "Enter your OneState RP Player ID",
    needPassword: false,
    passwordNotice: "Player ID ONLY — NO PASSWORD NEEDED.",
  },
];

const GAME_MAP = Object.fromEntries(GAMES.map((g) => [g.slug, g]));

function getGame(slug) {
  return GAME_MAP[slug] || null;
}

// Single source of truth for badge display text (icons + label).
// DB stores: popular | best_value | promo | premium | mega
function badgeLabel(badge) {
  switch (badge) {
    case "popular": return "🔥 POPULAR";
    case "best_value": return "⭐ BEST VALUE";
    case "promo": return "🎉 PROMO";
    case "premium": return "👑 PREMIUM";
    case "mega": return "💎 MEGA";
    default: return "";
  }
}

module.exports = { GAMES, GAME_MAP, getGame, badgeLabel };
