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
 * !! Adresses à mettre en minuscule (lowerCase)
 */
const excludeAddressREG = [
  "0xc49bb05ac57f371bbc30ea0b7b0679343cad71c0", // safe marketing
  "0xa99302f22f646c075413c69f2565fe69b5f5829a", // vault genesis
  "0x3f2d192f64020da31d44289d62db82ade6abee6c", // tresorie dao timelocker
  "0xe1877d33471e37fe0f62d20e60c469eff83fb4a0", // vault incentives
  "0xba12222222228d8ba445958a75a0704d566bf2c8", // vault balancer
  "0x0212b941cb5c80c9fcda00035d126ac067169e72", // safe dao liquidity
  "0x3a37b789d3117f9b4f92f563358d70336f893e21", // nft collector
  "0x65cfc5514aba2edb84ecde3757c7647d2df4e6af", // nft activity
  "0x91036536da4c5155d1d05ba235b93192d92dae1d", // nft cityzen
  "0xdff7a394bd57593b3caa8f601e0a162bf711655e", // contribution communautaire
  "0x6b85a87d8990e77a86ab16a44b162de48bfb64e9", // provision d'ajustement
  "0x9a760aa1fe631fd9ac0aee0965736121c7c132cc", // mtp onoff ramp
  "0xb65a382e536cf80a792e10b1ff24f3c04845d4a3", // realt gestion budget mtp
  "0x555eb55cbc477aebbe5652d25d0fea04052d3971", // Budget Team RealT sur sablier
  ...getDexPoolAddresses(),
];

/**
 * Options de normalisation, permet de modifier les données avant calcule du pouvoir de vote
 * Appliquer dans l'ordre de l'objet
 */
export const optionsModifiers: NormalizeOptions = {
  excludeAddresses: excludeAddressREG,
  boostBalancesDexs: {
    sushiswap: {
      default: {
        REG: 4, // Multiplicateur de base pour REG
        "*": 2, // Multiplicateur de base pour tous les autres tokens
      },
      // Configuration spécifique pour les pools v3 - Mode centrage (comportement historique amélioré)
      v3: {
        sourceValue: "priceDecimals",
        priceRangeMode: "step",
        boostMode: "proximity",
        // exponent: 3,
        steps: [
          [0.2, 5], // De 0 à 2 tranches (20% de decaySlices) → boost de 5
          [0.5, 3], // De 3è$p0è  à 5 tranches (30% de decaySlices) → boost de 3
          [0.7, 2], // De 6 à 7 tranches (70% de decaySlices) → boost de 2
          [1.0, 1], // De 8 à 10 tranches (100% de decaySlices) → boost de 1
        ],
        maxBoost: 5,
        minBoost: 1,
        sliceWidth: 0.1,
        decaySlicesDown: 10,
        decaySlicesUp: 10,
        //outOfRangeEnabled: true,
      },
    },

    // Configuration pour les autres DEX
    balancer: [
      ["REG", "*"],
      [4, 2],
    ],
    honeyswap: [
      ["REG", "*"],
      [4, 2],
    ],
    swaprhq: {
      default: {
        REG: 4,
        "*": 2,
      },
      // Configuration spécifique pour les pools v3
      v3: {
        sourceValue: "tick",
        priceRangeMode: "none",
      },
    },
  },
  boostBalancesIncentivesVault: 1, // 2 vault locked, 1 vault unlocked
  boostBalancesWallet: 1,
  balanceKey: "totalBalance",
  zeroforced: 1, // Si le pouvoir de vote est inférieur à x, il sera mis à zéro
};
