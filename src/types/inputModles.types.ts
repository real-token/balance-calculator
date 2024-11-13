import { BigNumber } from "bignumber.js";
import { SourceBalancesREG } from "./REG.types.js";
import { DexValue } from "../configs/constantes.js";

export interface InputModel {
  normalize: (data: SourceBalancesREG, options?: NormalizeOptions) => Array<InputModelNormalizedData>;
}

export interface InputModelData {
  result: {
    [key in DexValue]: number;
  };
}

/**
 * Les clés doivent avoir le meme nom que le fichier et la fonction dans le dossier modifiers
 * exemple: balanceKey.ts => balanceKey
 */
export interface NormalizeOptions {
  excludeAddresses?: string[];
  boosBalancesDexs?: {
    [key in DexValue]?: [string[], number[]];
  };
  boostBalancesIncentivesVault?: number;
  boostBalancesWallet?: number;
  balanceKey?: string | string[];
  preProcessing?: (data: any) => any;
  // Ajoutez d'autres options selon vos besoins
}

export interface InputModelNormalizedData {
  address: string;
  balance: BigNumber;
}
