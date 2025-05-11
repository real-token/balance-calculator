import { BigNumber } from "bignumber.js";
import { DexValue } from "../configs/constantes.js";
import { V3BoostParams } from "../utils/v3BoostCalculator.js";
import { SourceBalancesREG } from "./REG.types.js";

export interface InputModel {
  normalize: (data: SourceBalancesREG, options?: NormalizeOptions) => Array<InputModelNormalizedData>;
}

export interface InputModelData {
  result: {
    [key in DexValue]: number;
  };
}

/**
 * Configuration des boosts pour les DEX
 */
export interface DexBoostConfig {
  // Configuration de base pour tous les types de DEX
  default?: {
    [tokenSymbol: string]: number; // Multiplicateur pour chaque symbole de token
  };

  // Configuration spécifique pour les DEX v3
  v3?: V3Config;
}

/**
 * Les clés doivent avoir le meme nom que le fichier et la fonction dans le dossier modifiers
 * exemple: balanceKey.ts => balanceKey
 */
export interface NormalizeOptions {
  excludeAddresses?: string[];

  // Nouvelle structure pour les boosts de DEX
  boosBalancesDexs?: {
    [key in DexValue]?: DexBoostConfig | [string[], number[]]; // Support pour l'ancien format pour compatibilité
  };

  boostBalancesIncentivesVault?: number;
  boostBalancesWallet?: number;
  balanceKey?: string | string[];
  zeroforced?: number;
  preProcessing?: (data: any) => any;
  // Ajoutez d'autres options selon vos besoins
}

export interface InputModelNormalizedData {
  address: string;
  balance: BigNumber;
}

/**
 * Configuration avancée pour les positions v3
 */
export type V3Config = V3BoostParams;
