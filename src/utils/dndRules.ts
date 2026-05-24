import type { CharacterAttributes, StatType, Race, RollResult } from '@/types';

export function roll4d6DropLowest(): RollResult {
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  const sorted = [...dice].sort((a, b) => a - b);
  const dropped = sorted[0];
  const total = sorted.slice(1).reduce((acc, val) => acc + val, 0);
  return { dice, dropped, total };
}

export const STAT_LABELS: Record<StatType, string> = {
  STR: 'Força',
  DEX: 'Destreza',
  CON: 'Constituição',
  INT: 'Inteligência',
  WIS: 'Sabedoria',
  CHA: 'Carisma'
};

export function calculateModifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

export function getModifierString(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function getStatTier(total: number): string {
  const avg = total / 6;
  if (total < 40) return 'Péssimo';
  if (total < 60) return 'Fraco';
  if (total < 75) return 'Médio';
  if (total < 85) return 'Forte';
  if (total < 95) return 'Épico';
  return 'Monstruoso';
}

export const DICE_ANIMATION_FRAMES = [1, 2, 3, 4, 5, 6];

export const BASE_RACES: Race[] = [
  // ANÃO
  { id: 'dwarf_hill', parentId: 'dwarf', name: 'Anão da Colina', bonuses: { CON: 2, WIS: 1 }, source: 'PHB' },
  { id: 'dwarf_mountain', parentId: 'dwarf', name: 'Anão da Montanha', bonuses: { CON: 2, STR: 2 }, source: 'PHB' },
  
  // ELFO
  { id: 'elf_high', parentId: 'elf', name: 'Alto Elfo', bonuses: { DEX: 2, INT: 1 }, source: 'PHB' },
  { id: 'elf_wood', parentId: 'elf', name: 'Elfo da Floresta', bonuses: { DEX: 2, WIS: 1 }, source: 'PHB' },
  { id: 'elf_drow', parentId: 'elf', name: 'Drow (Elfo Negro)', bonuses: { DEX: 2, CHA: 1 }, source: 'PHB' },
  { id: 'elf_eladrin', parentId: 'elf', name: 'Eladrin', bonuses: { DEX: 2, CHA: 1 }, source: 'MTF/TCoE' },
  { id: 'elf_shadarkai', parentId: 'elf', name: 'Shadar-kai', bonuses: { DEX: 2, CON: 1 }, source: 'MTF/TCoE' },

  // PEQUENINO
  { id: 'halfling_lightfoot', parentId: 'halfling', name: 'Pequenino Pés-Leves', bonuses: { DEX: 2, CHA: 1 }, source: 'PHB' },
  { id: 'halfling_stout', parentId: 'halfling', name: 'Pequenino Robusto', bonuses: { DEX: 2, CON: 1 }, source: 'PHB' },

  // GNOMO
  { id: 'gnome_forest', parentId: 'gnome', name: 'Gnomo da Floresta', bonuses: { INT: 2, DEX: 1 }, source: 'PHB' },
  { id: 'gnome_rock', parentId: 'gnome', name: 'Gnomo das Rochas', bonuses: { INT: 2, CON: 1 }, source: 'PHB' },
  { id: 'gnome_deep', parentId: 'gnome', name: 'Svirfneblin (Gnomo Profundo)', bonuses: { INT: 2, DEX: 1 }, source: 'XGtE/TCoE' },

  // HUMANO
  { id: 'human', name: 'Humano', bonuses: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 }, source: 'PHB' },
  { id: 'human_variant', name: 'Humano Variante', bonuses: {}, choiceCount: 2, choiceBonus: 1, source: 'PHB' },

  // DRACONATO
  { id: 'dragonborn', name: 'Draconato', bonuses: { STR: 2, CHA: 1 }, source: 'PHB' },

  // MEIO-ELFO
  { id: 'half_elf', name: 'Meio-Elfo', bonuses: { CHA: 2 }, choiceCount: 2, choiceBonus: 1, choiceExclude: ['CHA'], source: 'PHB' },

  // MEIO-ORC
  { id: 'half_orc', name: 'Meio-Orc', bonuses: { STR: 2, CON: 1 }, source: 'PHB' },

  // TIEFLING
  { id: 'tiefling_phb', parentId: 'tiefling', name: 'Tiefling (Legado)', bonuses: { CHA: 2, INT: 1 }, source: 'PHB' },
  { id: 'tiefling_bloodline', parentId: 'tiefling', name: 'Tiefling (Linhagem)', bonuses: { CHA: 2 }, choiceCount: 1, choiceBonus: 1, choiceExclude: ['CHA'], source: 'MTF' },
  { id: 'tiefling_zariel', parentId: 'tiefling', name: 'Tiefling (Zariel)', bonuses: { CHA: 2, STR: 1 }, source: 'MTF' },
  { id: 'tiefling_dispater', parentId: 'tiefling', name: 'Tiefling (Dispater)', bonuses: { CHA: 2, DEX: 1 }, source: 'MTF' },

  // OUTROS
  { id: 'aarakocra', name: 'Aarakocra', bonuses: { DEX: 2, WIS: 1 }, source: 'EEPC' },
  
  // GENASI
  { id: 'genasi_air', parentId: 'genasi', name: 'Genasi do Ar', bonuses: { CON: 2, DEX: 1 }, source: 'EEPC' },
  { id: 'genasi_earth', parentId: 'genasi', name: 'Genasi da Terra', bonuses: { CON: 2, STR: 1 }, source: 'EEPC' },
  { id: 'genasi_fire', parentId: 'genasi', name: 'Genasi do Fogo', bonuses: { CON: 2, INT: 1 }, source: 'EEPC' },
  { id: 'genasi_water', parentId: 'genasi', name: 'Genasi da Água', bonuses: { CON: 2, WIS: 1 }, source: 'EEPC' },

  // AASIMAR
  { id: 'aasimar_protector', parentId: 'aasimar', name: 'Aasimar Protetor', bonuses: { CHA: 2, WIS: 1 }, source: 'VGtM' },
  { id: 'aasimar_scourge', parentId: 'aasimar', name: 'Aasimar Flagelo', bonuses: { CHA: 2, CON: 1 }, source: 'VGtM' },
  { id: 'aasimar_fallen', parentId: 'aasimar', name: 'Aasimar Caído', bonuses: { CHA: 2, STR: 1 }, source: 'VGtM' },

  // GITH
  { id: 'gith_yanki', parentId: 'gith', name: 'Githyanki', bonuses: { STR: 2, INT: 1 }, source: 'MTF' },
  { id: 'gith_zerai', parentId: 'gith', name: 'Githzerai', bonuses: { WIS: 2, INT: 1 }, source: 'MTF' },
];

export function getContextualFeedback(stats: number[], raceName: string): string {
  const sum = stats.reduce((a, b) => a + b, 0);
  const max = Math.max(...stats);
  const min = Math.min(...stats);
  
  let feedback = `Seu total de ${sum} indica um personagem `;
  
  if (sum < 60) feedback += "desafiador de se jogar. ";
  else if (sum > 85) feedback += "extremamente dotado! ";
  else feedback += "equilibrado. ";
  
  if (max >= 18) feedback += `Com esse ${max} natural, você será uma força da natureza em sua especialidade. `;
  if (min <= 5) feedback += `CUIDADO: esse ${min} em um atributo vai exigir criatividade para compensar sua maior fraqueza. `;
  
  feedback += `Como ${raceName}, seus instintos naturais vão moldar sua jornada.`;
  
  return feedback;
}
