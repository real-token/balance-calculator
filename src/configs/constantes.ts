import { DexFunctionMapping, NetworkApiUrls, NetworkStartBlocks } from "../types/dexConfig.types.js";
import {
  getRegBalancesBalancer,
  getRegBalancesHoneySwap,
  getRegBalancesSushiSwap,
  getRegBalancesSwaprHQ,
} from "../utils/queryDexs.js";

import dotenv from "dotenv";
dotenv.config();

if (!process.env.THEGRAPH_API_KEY) {
  console.error("THEGRAPH_API_KEY is not set");
  process.exit(1);
}

export const PRINT_QUERY = false;
export const MAJ_MOCK_DATA = false;
export const MODE_DEBUG = false;

export enum TOKEN_ADDRESS {
  REG = "0x0aa1e96d2a46ec6beb2923de1e61addf5f5f1dce",
  USDC = "0xddafbb505ad214d7b80b1f830fccc89b60fb7a83",
  WXDAI = "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d",
}

export enum DEX {
  SUSHISWAP = "sushiswap",
  BALANCER = "balancer",
  HONEYSWAP = "honeyswap",
  SWAPRHQ = "swaprhq",
}

export enum NETWORK {
  GNOSIS = "gnosis",
  ETHEREUM = "ethereum",
  POLYGON = "polygon",
}

export enum NETWORK_ID {
  gnosis = "100",
  ethereum = "1",
  polygon = "137",
}

export type DexConfigs = {
  pool_id: string[];
  graphUrl: string;
  mockData: string;
};

export type Network = `${NETWORK}`;
type NetworkToDexsMap = { [key in Network]: string[] };
type DexFunctionMap = {
  [key: string]: string;
};
export type Dexs = NetworkToDexsMap[keyof NetworkToDexsMap];
export type DexValue = `${DEX}`;
/**
 * Mapping of network to corresponding decentralized exchanges (DEXs).
 */
export const networkToDexsMap: { [key in Network]: string[] } = {
  [NETWORK.GNOSIS]: ["honeyswap", "sushiswap", "balancer", "swaprhq"],
  [NETWORK.ETHEREUM]: [],
  [NETWORK.POLYGON]: [],
};

export const etherscanApiUrls: NetworkApiUrls = {
  [NETWORK.GNOSIS]: "https://api.gnosisscan.io/api",
  [NETWORK.ETHEREUM]: "https://api.etherscan.io/api",
  [NETWORK.POLYGON]: "https://api.polygonscan.com/api",
  // Ajoutez d'autres URL d'API ici...
};

export const moralisApiUrls: NetworkApiUrls = {
  [NETWORK.GNOSIS]: "https://deep-index.moralis.io/api/v2.2/dateToBlock?chain=gnosis",
  [NETWORK.ETHEREUM]: "https://deep-index.moralis.io/api/v2.2/dateToBlock?chain=ethereum",
  [NETWORK.POLYGON]: "https://deep-index.moralis.io/api/v2.2/dateToBlock?chain=polygon",
};

export const theGraphApiUrlsREG = {
  [NETWORK.GNOSIS]: `https://gateway.thegraph.com/api/${process.env.THEGRAPH_API_KEY}/subgraphs/id/22fupmRdXExaL1TmKoefUsfuMe8g17XaPabb3MjmUZJm`,
  [NETWORK.ETHEREUM]: `https://gateway.thegraph.com/api/${process.env.THEGRAPH_API_KEY}/subgraphs/id/3VTw8vHrVY53YgXxXS4WjrD6ax5AtEkX7UMqvo1Sqw6y`,
  [NETWORK.POLYGON]: `https://gateway.thegraph.com/api/${process.env.THEGRAPH_API_KEY}/subgraphs/id/GjgCV7yMu7xrxcUJe4aZXVRM1mK7Dje3R2hW7tKYBj7N`,
};

export const theGraphApiUrlsGov = {
  [NETWORK.GNOSIS]: `https://gateway.thegraph.com/api/${process.env.THEGRAPH_API_KEY}/subgraphs/id/5XjnB5bg5wkccUr3J74Sg5gqSSJpM8aBK1EsJLK9rroz`,
  [NETWORK.ETHEREUM]: "",
  [NETWORK.POLYGON]: "",
};

//Blocs de départ pour la requête REG (block de déploiement)
export const blockStartREG: NetworkStartBlocks = {
  [NETWORK.GNOSIS]: 33690634,
  [NETWORK.ETHEREUM]: 19761520,
  [NETWORK.POLYGON]: 56387750,
  // Ajoutez d'autres blocs de départ ici...
};

// Créez une carte de fonctions pour chaque DEX
/**
 * Map of DEX functions.
 * @typedef {Object} DexFunctionMap
 * @property {Function} honeyswap - Function for HoneySwap DEX.
 * @property {Function} [otherDex] - Function for other DEX (add more DEX functions here).
 */
export const dexFunctionMap: DexFunctionMapping = {
  [DEX.HONEYSWAP]: getRegBalancesHoneySwap,
  [DEX.BALANCER]: getRegBalancesBalancer,
  [DEX.SUSHISWAP]: getRegBalancesSushiSwap,
  [DEX.SWAPRHQ]: getRegBalancesSwaprHQ,
  // Ajoutez d'autres DEX ici...
};
