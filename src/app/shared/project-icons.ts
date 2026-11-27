import {
  LucideApple,
  LucideAward,
  LucideBook,
  LucideBookOpen,
  LucideBot,
  LucideBrain,
  LucideBriefcase,
  LucideBuilding,
  LucideCamera,
  LucideCar,
  LucideChartLine,
  LucideCode,
  LucideDumbbell,
  LucideFactory,
  LucideFileText,
  LucideGavel,
  LucideGlobe,
  LucideGraduationCap,
  LucideHeart,
  LucideHouse,
  LucideLandmark,
  LucideLaptop,
  LucideLeaf,
  LucidePlane,
  LucideRocket,
  LucideShield,
  LucideShoppingCart,
  LucideSparkles,
  LucideTruck,
  LucideUsers,
  LucideWallet,
  LucideWrench,
  LucideZap,
  type LucideIcon,
} from '@lucide/angular';

/**
 * The drawn icons a project can use (`projects.icon`), by Lucide kebab-case name. Only these
 * end up in the bundle: to offer a new icon, add it here (no migration needed).
 */
export const PROJECT_ICONS: Readonly<Record<string, LucideIcon>> = {
  apple: LucideApple,
  award: LucideAward,
  book: LucideBook,
  'book-open': LucideBookOpen,
  bot: LucideBot,
  brain: LucideBrain,
  briefcase: LucideBriefcase,
  building: LucideBuilding,
  camera: LucideCamera,
  car: LucideCar,
  'chart-line': LucideChartLine,
  code: LucideCode,
  dumbbell: LucideDumbbell,
  factory: LucideFactory,
  'file-text': LucideFileText,
  gavel: LucideGavel,
  globe: LucideGlobe,
  'graduation-cap': LucideGraduationCap,
  heart: LucideHeart,
  house: LucideHouse,
  landmark: LucideLandmark,
  laptop: LucideLaptop,
  leaf: LucideLeaf,
  plane: LucidePlane,
  rocket: LucideRocket,
  shield: LucideShield,
  'shopping-cart': LucideShoppingCart,
  sparkles: LucideSparkles,
  truck: LucideTruck,
  users: LucideUsers,
  wallet: LucideWallet,
  wrench: LucideWrench,
  zap: LucideZap,
};

/** The icon for a `projects.icon` value, or null when it is missing or unknown. */
export function projectIcon(name: string | null): LucideIcon | null {
  return name !== null && Object.hasOwn(PROJECT_ICONS, name) ? PROJECT_ICONS[name] : null;
}

/** Up to two initials from the name: "Reply - Fleet" → "RF", "Nutrirea" → "NU". */
export function initials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}
