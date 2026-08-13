// src/games.js — game registry for the multi-store layout
// Each game has its own store with its own packages (diamond_packages.game = slug).
const GAMES = [
  {
    slug: "freefire",
    name: "FREE FIRE",
    emoji: "💎",
    color: "#00d4ff",
    tagline: "Diamonds & membership top-ups",
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
    tagline: "Diamonds & crates",
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
    tagline: "CP & credits top-up",
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
    tagline: "Coins & gold",
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
    tagline: "Gold & cash top-up",
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

module.exports = { GAMES, GAME_MAP, getGame };
