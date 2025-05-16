import { BigNumber } from "bignumber.js";
import { i18n } from "../i18n/index.js";
import { logInTerminal } from "./lib.js";

const DEFAULT_BOOST_FACTOR = 1;

/**
 * Valeurs disponibles pour les formules de boost
 */
export const BoostFormulaValues = {
  LINEAR: "linear",
  EXPONENTIAL: "exponential",
  STEP: "step",
  NONE: "none",
} as const;

/**
 * Types de formules de boost disponibles pour les positions v3
 */
export type BoostFormulaType = (typeof BoostFormulaValues)[keyof typeof BoostFormulaValues];

/**
 * Valeurs disponibles pour les modes de calcul du boost
 */
export const BoostModeValues = {
  CENTERED: "centered",
  PROXIMITY: "proximity",
} as const;

/**
 * Types de modes de calcul du boost
 */
export type BoostModeType = (typeof BoostModeValues)[keyof typeof BoostModeValues];

/**
 * Types de valeurs source pour les calculs
 */
export const SourceValueValues = {
  TICK: "tick",
  PRICE_DECIMALS: "priceDecimals",
} as const;

/**
 * Type de valeur source pour les calculs
 */
export type SourceValue = (typeof SourceValueValues)[keyof typeof SourceValueValues];

/**
 * Paramètres pour le calcul du boost des positions v3
 */
export interface V3BoostParams {
  /**
   * commun à tous les modes
   */
  sourceValue: SourceValue;

  // Type de formule à appliquer sur la plage de prix
  priceRangeMode: BoostFormulaType;

  // Mode de calcul du boost
  boostMode?: BoostModeType;

  // Boost maximum (au centre ou au prix actuel selon le mode)
  maxBoost?: number;

  // Boost minimum (aux extrémités ou loin du prix selon le mode)
  minBoost?: number;

  // Exposant pour la formule exponentielle
  exponent?: number;

  // Paliers pour le mode "step" (pourcentage de 0 à 1, boost) exemple: [[0.5, 1], [0.75, 2]]
  // en mode Centered, les paliers représentent le pourcentage de la plage de prix où le boost est appliqué
  // en mode Proximity, les paliers représentent le nombre de tranches (ou "slices" distance du prix) où le boost est appliqué
  steps?: Array<[number, number]>;

  /**
   * Spécifique au mode "centered"
   */
  rangeWidthFactor?: number; // Facteur d'influence de la largeur de la plage (plus c'est grand, moins la largeur compte)
  inactiveBoost?: number; // Boost de base pour les positions inactives (hors plage de prix) en mode centered

  /**
   * Spécifique au mode "proximity"
   */
  sliceWidth?: number; // Optionnel: taille de chaque tranche (par defaut = 1 si sourceValue = tick, 0.1 si sourceValue = priceDecimals)
  decaySlices?: number; // Obligatoire: nombre de tranches pour atteindre minBoost depuis maxBoost (valeur par défaut si up/down non spécifiés)
  decaySlicesDown?: number; // Obligatoire: nombre de tranches pour atteindre minBoost depuis maxBoost (du prix vers le bas)
  decaySlicesUp?: number; // Obligatoire: nombre de tranches pour atteindre minBoost depuis maxBoost (du prix vers le haut)
  outOfRangeEnabled?: boolean; // Optionnel: définir si on calcule pour les positions hors range (par defaut = true)
}

/**
 * Calcule le facteur de boost pour une position v3 en fonction de ses paramètres
 * @param isActive Si la position est active (dans la plage de prix actuelle)
 * @param valueLower Valeur inférieure de la position (null si token0 en mode proximity)
 * @param valueUpper Valeur supérieure de la position (null si token1 en mode proximity)
 * @param currentValue Valeur actuelle du prix
 * @param params Paramètres de boost
 * @returns Facteur multiplicateur à appliquer
 */
export function calculateV3Boost(
  isActive: boolean,
  valueLower: number | null,
  valueUpper: number | null,
  currentValue: number,
  params: V3BoostParams
): number {
  if (params.priceRangeMode === "none") {
    return DEFAULT_BOOST_FACTOR;
  }

  // Si le mode est "proximity", utiliser l'algorithme basé sur la proximité
  if (params.boostMode === "proximity") {
    return calculateProximityBoost(isActive, valueLower, valueUpper, currentValue, params);
  }

  // Sinon, utiliser l'algorithme classique basé sur le centrage (mode "centered" par défaut)
  return calculateCenteredBoost(isActive, valueLower!, valueUpper!, currentValue, params);
}

/**
 * Calcule le boost selon l'approche de centrage (position bien centrée autour du prix)
 * @param isActive Si la position est active (dans la plage de prix actuelle)
 * @param valueLower Valeur inférieure de la position (null si token0)
 * @param valueUpper Valeur supérieure de la position (null si token1)
 * @param currentValue Valeur actuelle du prix
 * @param params Paramètres de boost
 * @returns Facteur de boost calculé
 */
function calculateCenteredBoost(
  isActive: boolean,
  valueLower: number,
  valueUpper: number,
  currentValue: number,
  params: V3BoostParams
): number {
  // Si la position n'est pas active, on applique uniquement le boost inactif
  if (!isActive) {
    return params.inactiveBoost || params.minBoost || DEFAULT_BOOST_FACTOR;
  }

  const rangeWidthFactor = params.rangeWidthFactor ?? 1;
  const maxBoost = params.maxBoost!;
  const minBoost = params.minBoost!;
  const exponent = params.exponent!;

  // Calcul de la largeur de la plage
  const valueWidth = valueUpper - valueLower;
  logInTerminal("debug", ["valueWidth", valueWidth]);
  // Calcul de la position relative du prix actuel dans la plage (de 0 à 1)
  // 0 = extrême bord inférieur, 0.5 = centre, 1 = extrême bord supérieur
  const relativePosition = (currentValue - valueLower) / valueWidth;
  logInTerminal("debug", ["relativePosition", relativePosition]);
  // Calcul du centrage (0 = bord, 1 = centre)
  // Cette formule transforme les valeurs [0,1] en [0,1,0] avec un pic à 0.5
  const centeredness = 1 - Math.abs(relativePosition - 0.5) * 2;
  logInTerminal("debug", ["centeredness", centeredness]);
  // Calcul du modificateur de largeur de plage
  const rangeWidthFactorBoost =
    rangeWidthFactor >= 0
      ? Math.max(1, valueWidth / rangeWidthFactor)
      : Math.max(1, (rangeWidthFactor / valueWidth) * -1);

  logInTerminal("debug", ["rangeWidthFactorBoost", rangeWidthFactorBoost]);

  // Calcul du boost en fonction du mode sélectionné
  let boost: number;

  switch (params.priceRangeMode) {
    case "linear":
      // Variation linéaire du boost entre edge (fin de la plage) et center (centre de la plage)
      boost = minBoost + centeredness * (maxBoost - minBoost);
      logInTerminal("debug", [
        "linear",
        `minBoost(${minBoost}) + centeredness(${centeredness}) * (maxBoost(${maxBoost}) - minBoost(${minBoost})) = boost (${boost})`,
      ]);
      break;

    case "exponential":
      // Variation exponentielle qui accentue davantage le boost au centre
      boost = minBoost + Math.pow(centeredness, exponent) * (maxBoost - minBoost);
      logInTerminal("debug", [
        "exponential",
        `minBoost(${minBoost}) + Math.pow(centeredness(${centeredness}), exponent(${exponent})) * (maxBoost(${maxBoost}) - minBoost(${minBoost})) = boost ${boost}`,
      ]);
      break;

    case "step":
      // Division de la plage en zones avec des boosts différents
      boost = minBoost; // Valeur par défaut

      if (params.steps && Array.isArray(params.steps)) {
        // Créer une copie triée des paliers du plus élevé au plus bas pour s'arrêter au premier qui correspond
        const sortedSteps = [...params.steps].sort((a, b) => b[0] - a[0]);

        logInTerminal("debug", ["step mode", "centeredness", centeredness, "sortedSteps", sortedSteps]);

        // Trouver le premier palier dont le seuil est inférieur au centrage actuel
        for (const [threshold, boostValue] of sortedSteps) {
          if (centeredness >= threshold) {
            boost = boostValue;
            logInTerminal("debug", ["step mode applied", "threshold", threshold, "boostValue", boostValue]);
            break; // On s'arrête au premier palier qui correspond
          }
        }
      }

      logInTerminal("debug", ["step mode", "pre-range boost", boost, "rangeWidthFactor", rangeWidthFactor]);
      break;

    default:
      boost = maxBoost;
  }

  // Application du modificateur de largeur de plage et du boost de base pour positions actives
  logInTerminal("debug", [
    "boost:",
    boost,
    "rangeWidthFactorBoost:",
    rangeWidthFactorBoost,
    "finalBoost function calculateCenteredBoost:",
    boost * rangeWidthFactorBoost,
  ]);
  return boost * rangeWidthFactorBoost;
}

/**
 * Calcule le boost selon l'approche de proximité (proximité de la liquidité avec le prix actuel)
 * @param isActive Si la position est active (dans la plage de prix actuelle)
 * @param valueLower Valeur inférieure de la position (null si token0)
 * @param valueUpper Valeur supérieure de la position (null si token1)
 * @param currentValue Valeur actuelle du prix
 * @param params Paramètres de boost
 * @returns Facteur de boost calculé
 */
function calculateProximityBoost(
  isActive: boolean,
  valueLower: number | null,
  valueUpper: number | null,
  currentValue: number,
  params: V3BoostParams
): number {
  logInTerminal("debug", [
    "calculateProximityBoost",
    "isActive",
    isActive,
    "valueLower",
    valueLower,
    "valueUpper",
    valueUpper,
    "currentValue",
    currentValue,
  ]);

  const maxBoost = params.maxBoost!;
  const minBoost = params.minBoost!;

  // Si currentValue est en dehors de la position, on vérifie si on veut quand même le calculer
  const outOfRangeEnabled = params.outOfRangeEnabled !== false; // true par défaut

  // Gestion explicite du cas où la position est inactive (hors de la plage de prix)
  if (!isActive) {
    if (!outOfRangeEnabled) {
      return params.inactiveBoost || minBoost || DEFAULT_BOOST_FACTOR; // Si outOfRangeEnabled est désactivé, retourner inactiveBoost ou minBoost
    }

    // Si la position est inactive mais qu'on veut calculer le boost quand même,
    // on prendra en compte la proximité par rapport à la borne la plus proche
  }

  // Taille de chaque tranche (dépend du type de source: tick ou prix)
  const sliceWidth = params.sliceWidth || (params.sourceValue === "tick" ? 1 : 0.1);

  // Paramètres de décroissance du boost (nombre de tranches pour atteindre minBoost depuis maxBoost)
  const decaySlicesDown = params.decaySlicesDown || params.decaySlices!;
  const decaySlicesUp = params.decaySlicesUp || params.decaySlices!;

  // Conversion en BigNumber pour éviter les problèmes de précision
  const bnCurrentValue = new BigNumber(currentValue);
  const bnSliceWidth = new BigNumber(sliceWidth);

  const bnLowerValue = new BigNumber(valueLower!);
  const bnUpperValue = new BigNumber(valueUpper!);

  // Pour les prix hors plage, on utilisera la borne la plus proche comme point de référence
  let bnEffectiveReferencePoint: BigNumber;
  let direction: number;

  if (!isActive) {
    // Si le prix est inférieur ou supérieur à la plage de prix
    if (bnCurrentValue.isGreaterThan(bnLowerValue)) {
      const isOutOfRange = bnCurrentValue.isGreaterThan(
        bnCurrentValue.minus(bnSliceWidth.multipliedBy(decaySlicesDown))
      );
      logInTerminal("debug", ["isOutOfRange lower", isOutOfRange]);
      if (isOutOfRange) {
        return minBoost;
      }
      bnEffectiveReferencePoint = bnLowerValue;
      direction = -1; // Direction de prix vers la borne inférieure
    } else {
      const isOutOfRange = bnCurrentValue.isLessThan(bnCurrentValue.plus(bnSliceWidth.multipliedBy(decaySlicesUp)));
      logInTerminal("debug", ["isOutOfRange upper", isOutOfRange]);
      if (isOutOfRange) {
        return minBoost;
      }
      // Sinon, le prix est supérieur à la borne supérieure, on prend la borne supérieure
      bnEffectiveReferencePoint = bnUpperValue;
      direction = 1; // Direction de prix vers la borne supérieure
    }
  } else {
    // Si le prix est dans la plage, calculer par rapport à la borne spécifiée
    bnEffectiveReferencePoint = valueLower === null ? bnUpperValue : bnLowerValue;
    direction = valueLower === null ? 1 : -1;
  }

  // Largeur totale de la liquidité pertinente
  const bnTotalLiquidityWidth = bnCurrentValue.minus(bnEffectiveReferencePoint).abs();
  if (bnTotalLiquidityWidth.isZero()) {
    return bnCurrentValue.isEqualTo(bnEffectiveReferencePoint) ? maxBoost : minBoost;
  }

  // Nombre total de tranches théoriques dans cette liquidité
  const bnTotalSlicesInLiquidity = bnTotalLiquidityWidth.dividedBy(bnSliceWidth).decimalPlaces(0, BigNumber.ROUND_CEIL);
  const totalSlicesInLiquidity = bnTotalSlicesInLiquidity.toNumber();
  // if (totalSlicesInLiquidity <= 0) return minBoost;

  logInTerminal("debug", ["Total Slices in Liquidity Range", totalSlicesInLiquidity]);
  logInTerminal("debug", ["Mode de décroissance", params.priceRangeMode]);
  let bnTotalBoostAccumulated = new BigNumber(0);
  const bnDecaySlices = direction === 1 ? new BigNumber(decaySlicesUp) : new BigNumber(decaySlicesDown);

  for (let i = 0; i < totalSlicesInLiquidity; i++) {
    let actualSlicePortion = new BigNumber(1); // Par défaut, la tranche est complète

    // Déterminer les bornes de la tranche actuelle
    const bnIterationSliceStart = bnCurrentValue.plus(new BigNumber(i * direction).multipliedBy(bnSliceWidth));
    let bnIterationSliceEnd = bnIterationSliceStart.plus(new BigNumber(direction).multipliedBy(bnSliceWidth));

    // Ajuster la portion de la première tranche (i=0) si elle est partiellement inactive
    if (i === 0 && !isActive) {
      // Si nous sommes au début et que la position est inactive, calculer la portion active de la tranche
      if (direction === 1) {
        logInTerminal("debug", [
          "direction === 1",
          "bnLowerValue",
          bnLowerValue,
          "bnCurrentValue",
          bnCurrentValue,
          "bnIterationSliceEnd",
          bnIterationSliceEnd,
          "bnCurrentValue.isLessThan(bnLowerValue)",
          bnCurrentValue.isLessThan(bnLowerValue),
          "bnIterationSliceEnd.isGreaterThan(bnLowerValue)",
          bnIterationSliceEnd.isGreaterThan(bnLowerValue),
        ]);
        // Vérifier si la tranche actuelle chevauche la plage de la position
        if (bnCurrentValue.isLessThan(bnLowerValue) && bnIterationSliceEnd.isGreaterThan(bnLowerValue)) {
          // La borne inférieure est dans cette tranche - ajuster la portion depuis la borne
          actualSlicePortion = bnIterationSliceEnd.minus(bnLowerValue).dividedBy(bnSliceWidth);
        }
      } else {
        // direction === -1
        if (bnCurrentValue.isGreaterThan(bnLowerValue) && bnIterationSliceEnd.isGreaterThan(bnLowerValue)) {
          // La borne supérieure est dans cette tranche - ajuster la portion depuis la borne
          actualSlicePortion = bnUpperValue.minus(bnIterationSliceEnd).dividedBy(bnSliceWidth);
        }
      }
    }

    // Ajuster la fin de la dernière tranche pour ne pas dépasser effectiveReferencePoint
    if (direction === 1 && bnIterationSliceEnd.isGreaterThan(bnEffectiveReferencePoint)) {
      actualSlicePortion = bnEffectiveReferencePoint.minus(bnIterationSliceStart).dividedBy(bnSliceWidth);
      bnIterationSliceEnd = bnEffectiveReferencePoint;
    } else if (direction === -1 && bnIterationSliceEnd.isLessThan(bnEffectiveReferencePoint)) {
      actualSlicePortion = bnIterationSliceStart.minus(bnEffectiveReferencePoint).dividedBy(bnSliceWidth);
      bnIterationSliceEnd = bnEffectiveReferencePoint;
    }

    // Si actualSlicePortion est <= 0, on arrête
    if (actualSlicePortion.isLessThanOrEqualTo(0)) break;

    // slicesAway est maintenant simplement 'i' car on part de currentValue
    const slicesAway = i;

    const decayFormula = params.priceRangeMode;
    // Pour les positions hors plage, on ajuste le boost de manière à ce qu'il décroisse plus rapidement
    let sliceBoostNum: number;
    if (!isActive) {
      // Si on est hors plage et que outOfRangeEnabled est true, on applique une décroissance plus rapide
      if (new BigNumber(slicesAway).isGreaterThanOrEqualTo(bnDecaySlices.dividedBy(2))) {
        sliceBoostNum = minBoost;
      } else {
        const decayProgress = new BigNumber(slicesAway).multipliedBy(2).dividedBy(bnDecaySlices);

        switch (decayFormula) {
          case BoostFormulaValues.EXPONENTIAL:
            // Formule exponentielle: minBoost + (maxBoost - minBoost) * (1 - progress)^exponent
            sliceBoostNum = new BigNumber(minBoost)
              .plus(
                new BigNumber(maxBoost)
                  .minus(minBoost)
                  .multipliedBy(new BigNumber(1).minus(decayProgress).pow(params.exponent!))
              )
              .toNumber();

            break;

          case BoostFormulaValues.STEP:
            // Par défaut : minBoost si aucun palier ne correspond
            sliceBoostNum = minBoost;

            // Trier les paliers du plus grand seuil au plus petit
            const sortedSteps = [...params.steps!].sort((a, b) => b[0] - a[0]);

            logInTerminal("debug", [
              "proximity step mode",
              "decayProgress",
              decayProgress.toNumber(),
              "sortedSteps",
              sortedSteps,
            ]);

            // Trouver le premier palier dont le seuil est inférieur ou égal au decayProgress
            for (const [threshold, boostValue] of sortedSteps) {
              if (decayProgress.isLessThanOrEqualTo(threshold)) {
                sliceBoostNum = boostValue;
                logInTerminal("debug", ["proximity step applied", "threshold", threshold, "boostValue", boostValue]);
                break;
              }
            }

            break;

          case BoostFormulaValues.LINEAR:
          default:
            // Par défaut, formule linéaire
            sliceBoostNum = new BigNumber(maxBoost)
              .minus(new BigNumber(maxBoost).minus(minBoost).multipliedBy(decayProgress))
              .toNumber();
            break;
        }
      }
    } else {
      // Calcul normal pour les positions dans la plage active
      if (new BigNumber(slicesAway).isGreaterThanOrEqualTo(bnDecaySlices)) {
        sliceBoostNum = minBoost;
      } else {
        const decayProgress = new BigNumber(slicesAway).dividedBy(bnDecaySlices);

        switch (decayFormula) {
          case BoostFormulaValues.EXPONENTIAL:
            // Formule exponentielle: minBoost + (maxBoost - minBoost) * (1 - progress)^exponent
            sliceBoostNum = new BigNumber(minBoost)
              .plus(
                new BigNumber(maxBoost)
                  .minus(minBoost)
                  .multipliedBy(new BigNumber(1).minus(decayProgress).pow(params.exponent!))
              )
              .toNumber();
            logInTerminal("debug", [
              "exponential mode",
              "decayProgress",
              decayProgress.toNumber(),
              "sliceBoostNum",
              sliceBoostNum,
            ]);
            break;

          case BoostFormulaValues.STEP:
            // Par défaut : minBoost si aucun palier ne correspond
            sliceBoostNum = minBoost;

            // Trier les paliers du plus grand seuil au plus petit
            const sortedSteps = [...params.steps!].sort((a, b) => a[0] - b[0]);

            // Trouver le premier palier dont le seuil est inférieur ou égal au decayProgress
            for (const [threshold, boostValue] of sortedSteps) {
              if (decayProgress.isLessThanOrEqualTo(threshold)) {
                sliceBoostNum = boostValue;
                logInTerminal("debug", [
                  "proximity step applied",
                  "threshold",
                  threshold,
                  "decayProgress",
                  decayProgress.toNumber(),
                  "boostValue",
                  boostValue,
                ]);
                break;
              }
            }

            break;

          case BoostFormulaValues.LINEAR:
          default:
            // Par défaut, formule linéaire
            sliceBoostNum = new BigNumber(maxBoost)
              .minus(new BigNumber(maxBoost).minus(minBoost).multipliedBy(decayProgress))
              .toNumber();
            break;
        }
      }
    }

    // On accumule le boost, pondéré par la portion réelle de la tranche
    bnTotalBoostAccumulated = bnTotalBoostAccumulated.plus(
      new BigNumber(sliceBoostNum).multipliedBy(actualSlicePortion)
    );

    logInTerminal("debug", [
      `Slice #${i}: Start ${bnIterationSliceStart.toNumber()}, End ${bnIterationSliceEnd.toNumber()}, Portion ${actualSlicePortion.toNumber()}, Away ${slicesAway}, Boost ${sliceBoostNum}`,
      `AccumulatedBoost ${bnTotalBoostAccumulated.toNumber()}`,
    ]);
  }

  // L'averageBoost est la somme des boosts pondérés divisée par le nombre total de tranches *théoriques*
  const averageBoost = bnTotalBoostAccumulated.dividedBy(bnTotalSlicesInLiquidity).toNumber();

  logInTerminal("debug", ["Average Boost", averageBoost]);
  return averageBoost;
}

/**
 * Calcule le boost total à appliquer à une position v3
 * @param tokenBalance Balance de tokens dans la position
 * @param isActive Si la position est active
 * @param valueLower Valeur inférieure
 * @param valueUpper Valeur supérieure
 * @param currentValue Valeur actuelle
 * @param params Paramètres de boost
 * @returns La balance boostée
 */
export function applyV3Boost(
  factorREGtoOtherToken: number,
  tokenBalance: string,
  isActive: boolean,
  valueLower: number | null,
  valueUpper: number | null,
  currentValue: number,
  params: V3BoostParams
): string {
  // Vérifier si les paramètres de boost sont valides pour le mode sélectionné
  if (!validateV3BoostParamsForBoostFormula(params, valueLower, valueUpper, isActive)) {
    throw new Error(i18n.t("boostV3Pools.errorInvalidBoostParams", { modeName: params.priceRangeMode }));
  }

  const balance = new BigNumber(tokenBalance);
  const boostFactor = calculateV3Boost(isActive, valueLower, valueUpper, currentValue, params) * factorREGtoOtherToken;
  logInTerminal("debug", ["boostFactor applay", boostFactor, "factorREGtoOtherToken", factorREGtoOtherToken]);
  return balance.multipliedBy(boostFactor).toString(10);
}

/**
 * Vérifie si les paramètres de boost sont valides pour le mode sélectionné
 * @param params Paramètres de boost
 * @param valueLower Valeur inférieure
 * @param valueUpper Valeur supérieure
 * @param isActive Si la position est active
 */
function validateV3BoostParamsForBoostFormula(
  params: V3BoostParams,
  valueLower: number | null,
  valueUpper: number | null,
  isActive: boolean
): boolean {
  if (params.priceRangeMode === "none") {
    return true;
  }

  logInTerminal("debug", [
    "validateV3BoostParamsForBoostFormula params.boostMode",
    params.boostMode,
    !params.boostMode,
    !Object.values(BoostModeValues).includes(params.boostMode as BoostModeType),
  ]);

  /***************************
   * Vérifications des modes *
   ***************************/

  // Vérifier si la valeur source est valide
  if (!params.sourceValue || !Object.values(SourceValueValues).includes(params.sourceValue as SourceValue)) {
    console.error(
      i18n.t("boostV3Pools.errorInvalidParams", {
        paramsName: "sourceValue",
        paramsValue: params.sourceValue || "undefined",
      })
    );
    return false;
  }

  // Vérifier si le paramètre mode de boost est valide
  if (!params.boostMode || !Object.values(BoostModeValues).includes(params.boostMode as BoostModeType)) {
    console.error(
      i18n.t("boostV3Pools.errorInvalidParams", {
        paramsName: "boostMode",
        paramsValue: params.boostMode || "undefined",
      })
    );
    return false;
  }

  // Vérifier les paramètres supplémentaires si priceRangeMode est défini
  if (params.priceRangeMode) {
    // Vérifier si la formule de décroissance est valide
    if (!Object.values(BoostFormulaValues).includes(params.priceRangeMode as BoostFormulaType)) {
      console.error(
        i18n.t("boostV3Pools.errorInvalidParams", {
          paramsName: "priceRangeMode",
          paramsValue: params.priceRangeMode,
        })
      );
      return false;
    }
  }

  /*******************************************
   * Vérifications spécifiques au boost mode *
   *******************************************/

  // Vérification des paramètres communs pour le mode "centered"
  if (params.boostMode === BoostModeValues.CENTERED) {
    // Vérifier si les valeurs de valueLower et valueUpper sont null, seulement un des deux peut être null
    if (valueLower === null || valueUpper === null) {
      if (valueLower === null) {
        console.error(
          i18n.t("boostV3Pools.errorValue", {
            nameVariable: "valueLower",
            value: valueLower,
          })
        );
      }

      if (valueUpper === null) {
        console.error(
          i18n.t("boostV3Pools.errorValue", {
            nameVariable: "valueUpper",
            value: valueUpper,
          })
        );
      }
      return false;
    }
  }

  // Vérification des paramètres communs pour le mode "proximity"
  if (params.boostMode === BoostModeValues.PROXIMITY) {
    // Vérifier si les valeurs de valueLower et valueUpper sont null, seulement un des deux peut être null
    const lowerNull = valueLower === null;
    const upperNull = valueUpper === null;

    // Si les deux valeurs sont null, on retourne false
    if ((isActive && lowerNull === upperNull) || (!isActive && (lowerNull || upperNull))) {
      console.error(
        i18n.t("boostV3Pools.errorValue", {
          nameVariable: "valueLower/valueUpper",
          value: `${lowerNull}/${upperNull}`,
        })
      );
      return false;
    }

    // Vérifier si les valeurs decaySlicesDown, decaySlicesUp et decaySlices sont valides
    if (
      params.priceRangeMode === BoostFormulaValues.LINEAR ||
      params.priceRangeMode === BoostFormulaValues.EXPONENTIAL
    ) {
      const decaySlicesValue = params.decaySlices;
      if ((!decaySlicesValue || decaySlicesValue <= 0) && (!params.decaySlicesDown || !params.decaySlicesUp)) {
        console.error(
          i18n.t("boostV3Pools.errorInvalidParams", {
            paramsName: "decaySlices",
            paramsValue: decaySlicesValue ?? "undefined or <=0",
          })
        );
        return false;
      }

      const decaySlicesDownValue = params.decaySlicesDown ?? decaySlicesValue;
      const decaySlicesUpValue = params.decaySlicesUp ?? decaySlicesValue;
      if (!decaySlicesDownValue || decaySlicesDownValue <= 0) {
        console.error(
          i18n.t("boostV3Pools.errorInvalidParams", {
            paramsName: "decaySlicesDown",
            paramsValue: decaySlicesDownValue ?? "undefined or <=0",
          })
        );
        return false;
      }
      if (!decaySlicesUpValue || decaySlicesUpValue <= 0) {
        console.error(
          i18n.t("boostV3Pools.errorInvalidParams", {
            paramsName: "decaySlicesUp",
            paramsValue: decaySlicesUpValue ?? "undefined or <=0",
          })
        );
        return false;
      }
    }
  }

  /*************************************************
   *  Vérifications spécifiques au priceRangeMode  *
   *************************************************/

  // Vérification des paramètres communs pour le mode "linear"
  if (params.priceRangeMode === BoostFormulaValues.LINEAR) {
    // maxBoost est obligatoire et doit être supérieur à 0
    const maxBoostValue = params.maxBoost;
    if (!maxBoostValue || maxBoostValue <= 0) {
      console.error(
        i18n.t("boostV3Pools.errorInvalidParams", {
          paramsName: "maxBoost",
          paramsValue: maxBoostValue ?? "undefined or <=0",
        })
      );
      return false;
    }

    // minBoost est obligatoire et doit être supérieur à 0
    const minBoostValue = params.minBoost;
    if (!minBoostValue || minBoostValue <= 0) {
      console.error(
        i18n.t("boostV3Pools.errorInvalidParams", {
          paramsName: "minBoost",
          paramsValue: minBoostValue ?? "undefined or <=0",
        })
      );
      return false;
    }

    if (params.boostMode === BoostModeValues.CENTERED) {
      // rangeWidthFactor est facultatif, si utiliser il doit être supérieur ou inférieur à 0
      if (params.rangeWidthFactor === 0) {
        console.error(
          i18n.t("boostV3Pools.errorInvalidParams", {
            paramsName: "rangeWidthFactor",
            paramsValue: params.rangeWidthFactor ?? "undefined or =0",
          })
        );
        return false;
      }
    }
  }

  // Vérification des paramètres communs pour le mode "exponential"
  if (params.priceRangeMode === BoostFormulaValues.EXPONENTIAL) {
    // maxBoost est obligatoire et doit être supérieur à 0
    const maxBoostValue = params.maxBoost;
    if (!maxBoostValue || maxBoostValue <= 0) {
      console.error(
        i18n.t("boostV3Pools.errorInvalidParams", {
          paramsName: "maxBoost",
          paramsValue: maxBoostValue ?? "undefined or <=0",
        })
      );
      return false;
    }

    // minBoost est obligatoire et doit être supérieur à 0
    const minBoostValue = params.minBoost;
    if (!minBoostValue || minBoostValue <= 0) {
      console.error(
        i18n.t("boostV3Pools.errorInvalidParams", {
          paramsName: "minBoost",
          paramsValue: minBoostValue ?? "undefined or <=0",
        })
      );
      return false;
    }

    if (!params.exponent || params.exponent <= 0) {
      console.error(
        i18n.t("boostV3Pools.errorInvalidParams", {
          paramsName: "exponent",
          paramsValue: params.exponent ?? "undefined or <=0",
        })
      );
      return false;
    }

    if (params.boostMode === BoostModeValues.CENTERED) {
      // rangeWidthFactor est facultatif, si utiliser il doit être supérieur ou inférieur à 0
      if (params.rangeWidthFactor === 0) {
        console.error(
          i18n.t("boostV3Pools.errorInvalidParams", {
            paramsName: "rangeWidthFactor",
            paramsValue: params.rangeWidthFactor ?? "undefined or =0",
          })
        );
        return false;
      }
    }
  }

  // Vérification des paramètres communs pour le mode "step"
  if (params.priceRangeMode === BoostFormulaValues.STEP) {
    // Vérifier si le paramètre steps est valide
    if (
      !params.steps ||
      !Array.isArray(params.steps) ||
      !params.steps.every(
        (step) =>
          Array.isArray(step) &&
          step.length === 2 &&
          typeof step[0] === "number" &&
          step[0] >= 0 &&
          step[0] <= 1 &&
          typeof step[1] === "number"
      )
    ) {
      console.error(
        i18n.t("boostV3Pools.errorInvalidParams", {
          paramsName: "steps",
          paramsValue: params.steps ?? "undefined or not an array",
        })
      );
      return false;
    }

    // minBoost est obligatoire et doit être supérieur à 0
    const minBoostValue = params.minBoost;
    if (!minBoostValue || minBoostValue <= 0) {
      console.error(
        i18n.t("boostV3Pools.errorInvalidParams", {
          paramsName: "minBoost",
          paramsValue: minBoostValue ?? "undefined or <=0",
        })
      );
      return false;
    }
  }

  return true;
}
