import { z } from 'zod';

export const StatSchema = z.number().min(3).max(25);

export enum CharacterStatus {
  CRIADO = 'criado',
  UTILIZADO = 'utilizado',
  AGUARDANDO_VALIDACAO = 'aguardando_validacao',
  APROVADO = 'aprovado',
  REJEITADO = 'rejeitado',
  DISTRIBUICAO_LIBERADA = 'distribuicao_liberada',
  FICHA_FINALIZADA = 'ficha_finalizada',
  BLOQUEADO = 'bloqueado',
  ARQUIVADO = 'arquivado'
}

export type StatType = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface CharacterAttributes {
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  WIS: number;
  CHA: number;
}

export interface RollResult {
  dice: number[];
  dropped: number;
  total: number;
}

export interface CharacterRolls {
  raw: number[];
  details?: RollResult[];
  rerollUsed: boolean;
  timestamp: number;
}

export interface Character {
  id: string;
  name: string;
  raceId: string;
  code: string;
  status: CharacterStatus;
  rolls: CharacterRolls | null;
  draftRolls?: CharacterRolls | null;
  attributes: CharacterAttributes | null;
  userId: string | null;
  masterId: string | null;
  playerDisplayName?: string;
  playerEmail?: string;
  playerPhoto?: string;
  campaignId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Code {
  id: string;
  code: string;
  status: 'active' | 'expired' | 'invalid' | 'used';
  tag?: string;
  createdAt: number;
  expiresAt?: number;
  usageLimit: number;
  usageCount: number;
}

export interface Race {
  id: string;
  parentId?: string; // If this is a subrace
  name: string;
  bonuses: Partial<CharacterAttributes>;
  description?: string;
  source?: string;
  choiceCount?: number;
  choiceBonus?: number;
  choiceBonuses?: number[];
  choiceExclude?: StatType[];
  isActive?: boolean;
}
