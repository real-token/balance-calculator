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
  "0x3A37b789D3117F9B4f92F563358D70336F893E21", // NFT Collector
  "0x65CFC5514ABa2eDB84ecdE3757C7647D2Df4E6Af", // NFT Activity
  "0x91036536da4c5155D1d05bA235B93192d92DaE1d", // NFT Cityzen
  "0xDff7A394Bd57593b3caA8f601e0A162bf711655E", // Contribution Communautaire
  "0x6B85a87d8990e77A86ab16A44b162de48BFb64E9", // Provision D'ajustement
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
