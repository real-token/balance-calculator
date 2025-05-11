import { DEX, NETWORK } from "../configs/constantes.js";

export type RetourREG = {
  [key: string]: any;
  walletAddress: string;
  type: string;
  totalBalanceRegGnosis: string;
  totalBalanceRegEthereum: string;
  totalBalanceRegPolygon: string;
  totalBalanceEquivalentRegGnosis: string;
  totalBalanceEquivalentRegEthereum: string;
  totalBalanceEquivalentRegPolygon: string;
  totalBalanceEquivalentREG: string;
  totalBalanceREG: string;
  totalBalance: string;
  sourceBalance?: {
    [key in NETWORK]?: {
      walletBalance: string;
      vaultIncentiveV1: string;
      dexs?: {
        [key in DEX]?: Array<{
          tokenBalance: string;
          tokenSymbol: string;
          tokenDecimals: number;
          tokenAddress: string;
          poolAddress: string;
          equivalentREG: string;
          positionId?: number;
          isActive?: boolean;
          tickLower?: number;
          tickUpper?: number;
          currentTick?: number;
          currentPrice?: string;
          minPrice?: number;
          maxPrice?: number;
          liquidityAmount?: string;
          votingPower?: string;
          scaleFactor?: number;
          token0Decimals?: number;
          token1Decimals?: number;
          feeTier?: number;
        }>;
      };
    };
  };
};

export type SourceBalancesREG = RetourREG;
