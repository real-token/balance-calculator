import { DEX, DexConfigs, DexValue, NETWORK, Network, TOKEN_ADDRESS } from "../configs/constantes.js";

/**
 * Types de base pour les tokens supportés
 */
export type SupportedToken = `${TOKEN_ADDRESS}`;

/**
 * Types pour les réseaux et DEX supportés
 */
export type SupportedNetwork = keyof typeof NETWORK;
export type SupportedDex = keyof typeof DEX;

/**
 * Configuration d'un DEX spécifique
 */
export interface DexConfig {
  /** Liste des identifiants des pools de liquidité */
  pool_id: string[];
  /** URL de l'API GraphQL pour ce DEX */
  graphUrl: string;
  /** Nom du fichier de données simulées pour les tests */
  mockData: string;
  /** Type de DEX (v2 ou v3) */
  dexType: "v2" | "v3";
}

/**
 * Configuration des DEX pour un réseau spécifique
 * Utilise les valeurs de l'enum DEX pour garantir la cohérence
 */
export type NetworkDexConfig = {
  [K in SupportedDex]?: DexConfig;
};

/**
 * Configuration globale des réseaux
 * Utilise les valeurs de l'enum NETWORK pour garantir la cohérence
 */
export type NetworkConfig = {
  [K in SupportedNetwork]: NetworkDexConfig;
};

/**
 * Structure principale du fichier de configuration
 */
export interface DexConfiguration {
  network: NetworkConfig;
}

/**
 * Type pour les résultats des requêtes DEX
 */
export interface DexQueryResult {
  poolId: string;
  dexName: string;
  liquidityPositions: {
    user: {
      id: string;
    };
    liquidity: {
      tokenId: SupportedToken;
      tokenDecimals: number;
      tokenSymbol: string;
      tokenBalance: string;
      equivalentREG: string;
    }[];
  }[];
}

/**
 * Type pour les fonctions de requête DEX
 */
export type DexQueryFunction = (
  dexConfigs: DexConfigs,
  network: Network,
  timestamp?: number,
  mock?: boolean,
  targetAddress?: string
) => Promise<ResponseFunctionGetRegBalances[]>;

export type DexFunctionMapping = {
  [key in DexValue]: DexQueryFunction;
};

/**
 * Type utilitaire pour les URLs des APIs
 * Utilise les valeurs string littérales de l'enum NETWORK
 */
export type NetworkApiUrls = {
  [K in `${NETWORK}`]: string;
};

/**
 * Type pour la configuration des blocs de départ
 */
export type NetworkStartBlocks = {
  [K in `${NETWORK}`]: number;
};

export interface DexBalanceResult {
  [dex: string]: ResponseFunctionGetRegBalances[];
}

export interface TokenInfo {
  tokenId: string;
  tokenDecimals: number;
  tokenSymbol: string;
  tokenBalance: string;
  equivalentREG: string;
}

export interface UserPosition {
  user: {
    id: string;
  };
  liquidity: TokenInfo[];
  positionId?: number;
  // Champs spécifiques pour les positions V3
  isActive?: boolean;
  tickLower?: number;
  tickUpper?: number;
  currentTick?: number;
  currentPrice?: string;
  minPrice?: number;
  maxPrice?: number;
  liquidityAmount?: string;
}

export interface ResponseFunctionGetRegBalances {
  poolId: string;
  dexName: string;
  liquidityPositions: UserPosition[];
}
