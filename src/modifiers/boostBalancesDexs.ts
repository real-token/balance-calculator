import { BigNumber } from "bignumber.js";
import { DexValue, Network } from "../configs/constantes.js";
import { i18n } from "../i18n/index.js";
import { SourceBalancesREG } from "../types/REG.types.js";
import { DexBoostConfig, NormalizeOptions } from "../types/inputModles.types.js";
import { logInTerminal } from "../utils/lib.js";
import { applyV3Boost } from "../utils/v3BoostCalculator.js";

/**
 * Modifie les balances des DEX en fonction des options spécifiées
 * @param data Données d'entrée de type SourceBalancesREG[]
 * @param options Options de boost des balances des DEX
 * @returns Données modifiées de type SourceBalancesREG[]
 */
export function boostBalancesDexs(
  data: SourceBalancesREG[],
  options: NormalizeOptions["boostBalancesDexs"]
): SourceBalancesREG[] {
  console.info(i18n.t("modifiers.infoApplyModifier", { modifier: "boosBalancesDexs" }), options);

  // Si aucune option de boost n'est fournie, retourner les données inchangées
  if (!options || Object.keys(options).length === 0) {
    console.warn(i18n.t("modifiers.warnNoOptions", { modifier: "boosBalancesDexs" }));
    return data;
  }

  // Parcourir chaque utilisateur
  return data.map((user) => {
    // Parcourir chaque réseau dans les balances de l'utilisateur
    for (const network in user.sourceBalance) {
      const dexs = user.sourceBalance[network as Network]?.dexs;
      if (!dexs || Object.keys(dexs).length === 0) continue;

      // Parcourir chaque DEX dans le réseau
      for (const dex in dexs) {
        const dexOptions = options[dex as DexValue];
        if (!dexs[dex as DexValue]?.length || !dexOptions) continue;

        const dexBalances = dexs[dex as DexValue]!;

        // Appliquer le boost à chaque balance du DEX
        dexBalances.forEach((balance) => {
          // Garder une référence à la balance équivalente REG originale pour mettre à jour les totaux
          const oldEquivalentREG = balance.equivalentREG;
          let newEquivalentREG = balance.equivalentREG;

          // Déterminer si c'est une position v3 (présence des champs spécifiques v3)
          const isV3ConfigValide = isV3Config(dexOptions);

          const isV3Position =
            balance.isActive !== undefined &&
            isV3ConfigValide &&
            ((balance.tickLower !== undefined &&
              balance.tickUpper !== undefined &&
              balance.currentTick !== undefined) ||
              (balance.minPrice !== undefined && balance.maxPrice !== undefined && balance.currentPrice !== undefined));

          // Vérifier si les données de la balance sont complètes pour une position v3
          if (!isV3Position && isV3ConfigValide) {
            console.error(i18n.t("modifiers.errorDataBalanceNotComplete", { balanceID: balance.positionId }));
            throw new Error(i18n.t("modifiers.errorDataBalanceNotComplete", { balanceID: balance.positionId }));
          }

          // Appliquer le boost selon le type de configuration et de position
          if (isV3Position && isV3ConfigValide) {
            const v3Config = dexOptions.v3;
            const baseBoostREG = dexOptions.default["REG"] ?? dexOptions.default["*"] ?? 1;
            const baseBoost = dexOptions.default[balance.tokenSymbol] || dexOptions.default["*"] || 1;

            const valueLower = v3Config.sourceValue === "tick" ? balance.tickLower : balance.minPrice;
            const valueUpper = v3Config.sourceValue === "tick" ? balance.tickUpper : balance.maxPrice;
            const currentValue =
              v3Config.sourceValue === "tick" ? balance.currentTick : parseFloat(balance.currentPrice ?? "0");

            if (
              v3Config.priceRangeMode === "linear" ||
              v3Config.priceRangeMode === "exponential" ||
              v3Config.priceRangeMode === "step"
            ) {
              logInTerminal("debug", [
                "DEBUG position",
                balance.positionId,
                balance.tokenSymbol,
                "isActive",
                balance.isActive,
                "balance equivalentREG",
                balance.equivalentREG,
                "baseBoost",
                baseBoost,
                "baseBoostREG",
                baseBoostREG,
                "factorREGtoOtherToken",
                baseBoost / baseBoostREG,
              ]);

              // Si mode proximity, passer null pour valueLower ou valueUpper selon tokenPosition
              let effectiveValueLower: number | null = valueLower || 0;
              let effectiveValueUpper: number | null = valueUpper || 0;

              if (v3Config.boostMode === "proximity") {
                // Si la position est active et tokenPosition est défini,
                // ajuster les bornes pour la liquidité unilatérale.
                // Pour les positions inactives, TOUJOURS utiliser valueLower et valueUpper de la position.
                if (balance.isActive && balance.tokenPosition !== undefined) {
                  if (balance.tokenPosition === 0) {
                    // Token0: Liquidity from currentValue to valueUpper
                    // Passer null pour valueLower
                    effectiveValueLower = null;
                  } else if (balance.tokenPosition === 1) {
                    // Token1: Liquidity from valueLower to currentValue
                    // Passer null pour valueUpper
                    effectiveValueUpper = null;
                  }
                }
                // Si la position est inactive, effectiveValueLower et effectiveValueUpper
                // conserveront les valeurs de valueLower et valueUpper de la position.

                // Cas d'une position active
                const cv = currentValue || 0;
                const vl = valueLower || 0;
                const vu = valueUpper || 0;

                logInTerminal("debug", [
                  "DEBUG position v3 proximity START",
                  "tokenPosition",
                  balance.tokenPosition,
                  "currentValue",
                  cv,
                  "valueLower",
                  vl,
                  "valueUpper",
                  vu,
                  "effectiveValueLower",
                  effectiveValueLower,
                  "effectiveValueUpper",
                  effectiveValueUpper,
                ]);
              }

              newEquivalentREG = applyV3Boost(
                baseBoost / baseBoostREG,
                balance.equivalentREG,
                balance.isActive || false,
                effectiveValueLower,
                effectiveValueUpper,
                currentValue || 0,
                v3Config
              );
            } else {
              // Appliquer le facteur de boost simple si priceRangeMode = "none" ou non défini
              console.info(i18n.t("modifiers.infoApplyModifier", { modifier: "nonePriceRange" }));
              newEquivalentREG = new BigNumber(balance.equivalentREG).multipliedBy(baseBoost).toString(10);
            }
          } else {
            // Fallback sur les positions non-v3
            // Déterminer quel multiplicateur appliquer
            let boostFactor = 1; // Valeur par défaut si aucun boost n'est applicable

            if (Array.isArray(dexOptions)) {
              // Ancien format de configuration [tokensToApply, boostFactors]
              const [tokensToApply, boostFactors] = dexOptions;
              const symbolIndex = tokensToApply.includes(balance.tokenSymbol)
                ? tokensToApply.indexOf(balance.tokenSymbol)
                : tokensToApply.indexOf("*");

              if (symbolIndex >= 0) {
                boostFactor = boostFactors[symbolIndex];
              }
            } else if (dexOptions.default) {
              // Nouveau format avec configuration default
              boostFactor = dexOptions.default[balance.tokenSymbol] || dexOptions.default["*"] || 1;
            }

            // Appliquer le facteur de boost
            newEquivalentREG = new BigNumber(balance.equivalentREG).multipliedBy(boostFactor).toString(10);
          }

          // Mettre à jour la balance avec la nouvelle valeur
          logInTerminal("debug", [
            "DEBUG FINALISED boost",
            balance.positionId,
            balance.tokenSymbol,
            "newEquivalentREG",
            newEquivalentREG,
          ]);
          balance.equivalentREG = newEquivalentREG;

          // Mettre à jour les totaux
          updateTotals(user, network as Network, oldEquivalentREG, newEquivalentREG, balance.tokenSymbol === "REG");
        });
      }
    }

    return user;
  });
}

/**
 * Vérifie si une configuration de DEX est un objet format avec options v3
 * @param config Configuration de DEX
 * @returns true si c'est une configuration au nouveau format avec les champs v3 et default définis
 */
function isV3Config(config: DexBoostConfig | [string[], number[]]): config is DexBoostConfig & {
  v3: NonNullable<DexBoostConfig["v3"]>;
  default: NonNullable<DexBoostConfig["default"]>;
} {
  if (Array.isArray(config)) {
    return false;
  }
  // Vérifie la présence et la validité des champs requis pour V3Config
  if (config && typeof config === "object" && config.v3 && config.default) {
    // Ici, vous pourriez ajouter des vérifications plus granulaires sur la structure de config.v3 et config.default si nécessaire
    return true;
  }
  // Optionnel: logguer si la configuration est partiellement correcte mais ne passe pas la validation stricte
  if (config && typeof config === "object" && (!config.v3 || !config.default)) {
    console.warn(i18n.t("modifiers.warnV3ConfigPartialCorrectConfig"), config);
  }
  return false;
}

/**
 * Met à jour les totaux des balances après application d'un boost
 * @param user Utilisateur dont les balances sont modifiées
 * @param network Réseau concerné
 * @param oldValue Ancienne valeur équivalente REG
 * @param newValue Nouvelle valeur équivalente REG
 * @param isRegToken Si le token concerné est REG
 */
function updateTotals(
  user: SourceBalancesREG,
  network: Network,
  oldValue: string,
  newValue: string,
  isRegToken: boolean
) {
  const networkMaj = network.charAt(0).toUpperCase() + network.slice(1);
  const totalBalanceKey = isRegToken ? "totalBalanceREG" : "totalBalanceEquivalentREG";
  const totalBalanceKeyNetwork = isRegToken ? `totalBalanceReg${networkMaj}` : `totalBalanceEquivalentReg${networkMaj}`;

  // Mettre à jour le total du réseau
  user[totalBalanceKeyNetwork] = new BigNumber(user[totalBalanceKeyNetwork])
    .minus(oldValue)
    .plus(newValue)
    .toString(10);

  // Mettre à jour le total global par type
  user[totalBalanceKey] = new BigNumber(user[totalBalanceKey]).minus(oldValue).plus(newValue).toString(10);

  // Mettre à jour le total général
  user.totalBalance = new BigNumber(user.totalBalance).minus(oldValue).plus(newValue).toString(10);
}
