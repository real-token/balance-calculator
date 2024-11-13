import { NormalizeOptions } from "../types/inputModles.types.js";
import dexConfig from "./dex.json" assert { type: "json" };

/**
 * Fonction pour extraire toutes les adresses de pool du fichier de configuration dex.json
 */
const getDexPoolAddresses = () => {
  const addresses: string[] = [];
  Object.values(dexConfig.network).forEach((networks) => {
    Object.values(networks).forEach((dex) => {
      addresses.push(...dex.pool_id.map((address: string) => address.toLowerCase()));
    });
  });
  return addresses;
};

/**
 * Liste des adresses à exclure, combinant les adresses fixes et les pools DEX
 * !! Adresses en minuscule
 */
const excludeAddressREG = [
  "0xc49bb05ac57f371bbc30ea0b7b0679343cad71c0", // Safe Marketing
  "0xa99302f22f646c075413c69f2565fe69b5f5829a", // Vault Genesis
  "0x3f2d192f64020da31d44289d62db82ade6abee6c", // Tresorie DAO Timelocker
  "0xe1877d33471e37fe0f62d20e60c469eff83fb4a0", // Vault incentives
  "0xba12222222228d8ba445958a75a0704d566bf2c8", // Vault Balancer
  "0x0212b941cb5c80c9fcda00035d126ac067169e72", // Safe DAO liquidity
  ...getDexPoolAddresses(),
];

/**
 * Options de normalisation, permet de modifier les données avant calcule du pouvoir de vote
 * Appliquer dans l'ordre de l'objet
 */
export const optionsModifiers: NormalizeOptions = {
  excludeAddresses: excludeAddressREG,
  boosBalancesDexs: {
    sushiswap: [
      ["REG", "*"],
      [1.2, 0.5],
    ],
    balancer: [
      ["REG", "*"],
      [1.2, 0.5],
    ],
    honeyswap: [
      ["REG", "*"],
      [1.2, 0.5],
    ],
    swaprhq: [
      ["REG", "*"],
      [1.2, 0.5],
    ],
  },
  boostBalancesIncentivesVault: 1,
  boostBalancesWallet: 1,
  balanceKey: "totalBalance",
};
