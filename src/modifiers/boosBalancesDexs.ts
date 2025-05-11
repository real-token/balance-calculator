import { BigNumber } from "bignumber.js";
import { DexValue, Network } from "../configs/constantes.js";
import { i18n } from "../i18n/index.js";
import { SourceBalancesREG } from "../types/REG.types.js";
import { DexBoostConfig, NormalizeOptions } from "../types/inputModles.types.js";
import { V3BoostParams, applyV3Boost } from "../utils/v3BoostCalculator.js";

/**
 * Modifie les balances des DEX en fonction des options spécifiées
 * @param data Données d'entrée de type SourceBalancesREG[]
 * @param options Options de boost des balances des DEX
 * @returns Données modifiées de type SourceBalancesREG[]
 */
export function boosBalancesDexs(
  data: SourceBalancesREG[],
  options: NormalizeOptions["boosBalancesDexs"]
): SourceBalancesREG[] {
  console.info(i18n.t("modifiers.infoApplyModifier", { modifier: "boosBalancesDexs" }), options);

  // Si aucune option de boost n'est fournie, retourner les données inchangées
  if (!options || Object.keys(options).length === 0) {
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
          const isV3Position =
            balance.isActive !== undefined &&
            balance.tickLower !== undefined &&
            balance.tickUpper !== undefined &&
            balance.currentTick !== undefined;

          // Vérifier si les données de la balance sont complètes pour une position v3
          if (
            !(
              balance.isActive === undefined &&
              balance.tickLower === undefined &&
              balance.tickUpper === undefined &&
              balance.currentTick === undefined
            )
          ) {
            console.error("Data balance is not complete for v3 position", balance);
          }

          // Appliquer le boost selon le type de configuration et de position
          if (isV3Position && isV3Config(dexOptions)) {
            // Configuration v3 avancée
            const v3Config = dexOptions.v3;
            if (v3Config) {
              // Déterminer le boost de base selon le type de token
              let baseBoost = v3Config.activeBoost;
              let baseInactiveBoost = v3Config.inactiveBoost;

              // Si nous avons aussi une configuration default, utiliser le multiplicateur spécifique au token
              if (dexOptions.default) {
                const tokenMultiplier = dexOptions.default[balance.tokenSymbol] || dexOptions.default["*"] || 1;

                // Ajuster les boosts selon le type de token si priceRangeMode est "none"
                if (v3Config.priceRangeMode === "none") {
                  baseBoost = tokenMultiplier;
                  baseInactiveBoost = tokenMultiplier;
                }
              }

              // Convertir la configuration en paramètres pour le calculateur de boost
              const boostParams: V3BoostParams = {
                activeBoost: baseBoost,
                inactiveBoost: baseInactiveBoost,
                priceRangeMode: v3Config.priceRangeMode,
                centerBoost: v3Config.centerBoost,
                edgeBoost: v3Config.edgeBoost,
                exponent: v3Config.exponent,
                rangeWidthFactor: v3Config.rangeWidthFactor,
                steps: v3Config.steps,
              };

              // Appliquer le boost v3 avancé
              newEquivalentREG = applyV3Boost(
                balance.equivalentREG,
                balance.isActive || false,
                balance.tickLower || 0,
                balance.tickUpper || 0,
                balance.currentTick || 0,
                boostParams
              );
            }
          } else {
            // Fallback sur l'ancien système pour les positions non-v3 ou avec config traditionnelle
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
 * Vérifie si une configuration de DEX est au nouveau format avec options v3
 * @param config Configuration de DEX
 * @returns true si c'est une configuration au nouveau format
 */
function isV3Config(config: DexBoostConfig | [string[], number[]]): config is DexBoostConfig {
  return !Array.isArray(config);
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
