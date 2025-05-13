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
  // Type de valeur source pour les calculs (tick ou priceDecimals)
  sourceValue: SourceValue;

  // Type de formule à appliquer sur la plage de prix (pour mode "centered")
  priceRangeMode: BoostFormulaType;

  // Mode de calcul du boost ("centered" ou "proximity")
  boostMode?: BoostModeType;

  // Boost de base pour les positions actives (dans la plage de prix)
  activeBoost?: number;

  // Boost de base pour les positions inactives (hors plage de prix)
  inactiveBoost?: number;

  // Boost au centre de la plage (multiplicateur maximum pour mode centered)
  centerBoost?: number;

  // Boost aux extrémités de la plage (multiplicateur minimum pour mode centered)
  edgeBoost?: number;

  // Exposant pour la formule exponentielle
  exponent?: number;

  // Facteur d'influence de la largeur de la plage (plus c'est grand, moins la largeur compte)
  rangeWidthFactor?: number;

  // Paliers pour le mode "step" (pourcentage de 0 à 1, boost)
  steps?: Array<[number, number]>;

  // Paramètres spécifiques au mode "proximity"
  proximityMode?: BoostFormulaType; // Type de décroissance ("linear", "exponential")
  maxProximityBoost?: number; // Boost maximal au prix actuel
  minProximityBoost?: number; // Boost minimal loin du prix
  decayFactor?: number; // Contrôle la vitesse de décroissance (0.1 = rapide, 1.0 = lente)
  numSlices?: number; // Nombre de tranches pour simuler la répartition de liquidité
}

/**
 * Calcule le facteur de boost pour une position v3 en fonction de ses paramètres
 * @param isActive Si la position est active (dans la plage de prix actuelle)
 * @param valueLower Valeur inférieure de la position
 * @param valueUpper Valeur supérieure de la position
 * @param currentValue Valeur actuelle du prix
 * @param params Paramètres de boost
 * @returns Facteur multiplicateur à appliquer
 */
export function calculateV3Boost(
  isActive: boolean,
  valueLower: number,
  valueUpper: number,
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
  return calculateCenteredBoost(isActive, valueLower, valueUpper, currentValue, params);
}

/**
 * Calcule le boost selon l'approche de centrage (position bien centrée autour du prix)
 */
function calculateCenteredBoost(
  isActive: boolean,
  valueLower: number,
  valueUpper: number,
  currentValue: number,
  params: V3BoostParams
): number {
  const inactiveBoost = params.inactiveBoost || DEFAULT_BOOST_FACTOR;
  // Si la position n'est pas active, on applique uniquement le boost inactif
  if (!isActive) {
    return inactiveBoost;
  }

  const activeBoost = params.activeBoost!;
  const rangeWidthFactor = params.rangeWidthFactor ?? 1;
  const centerBoost = params.centerBoost!;
  const edgeBoost = params.edgeBoost!;
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
      boost = edgeBoost + centeredness * (centerBoost - edgeBoost);
      logInTerminal("debug", [
        "linear",
        `edgeBoost(${edgeBoost}) + centeredness(${centeredness}) * (centerBoost(${centerBoost}) - edgeBoost(${edgeBoost})) = boost (${boost})`,
      ]);
      break;

    case "exponential":
      // Variation exponentielle qui accentue davantage le boost au centre
      boost = edgeBoost + Math.pow(centeredness, exponent) * (centerBoost - edgeBoost);
      logInTerminal("debug", [
        "exponential",
        `edgeBoost(${edgeBoost}) + Math.pow(centeredness(${centeredness}), exponent(${exponent})) * (centerBoost(${centerBoost}) - edgeBoost(${edgeBoost})) = boost ${boost}`,
      ]);
      break;

    case "step":
      // Division de la plage en zones avec des boosts différents
      boost = edgeBoost; // Valeur par défaut

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
      boost = activeBoost;
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
 */
function calculateProximityBoost(
  isActive: boolean,
  valueLower: number,
  valueUpper: number,
  currentValue: number,
  params: V3BoostParams
): number {
  const rangeWidthFactor = params.rangeWidthFactor || 1;
  const inactiveBoost = params.inactiveBoost || 1;

  // Configuration par défaut si non spécifiée
  const maxBoost = params.maxProximityBoost || params.centerBoost || 3.0;
  const minBoost = params.minProximityBoost || params.edgeBoost || 0.8;
  const decayFactor = params.decayFactor || 0.3;
  const proximityMode = params.proximityMode || "exponential";
  const numSlices = params.numSlices || 100;

  // Largeur totale de la position en ticks
  const valueWidth = valueUpper - valueLower;

  // Calcul du modificateur de largeur de plage (comme dans le mode centered)
  const rangeWidthFactorBoost = Math.min(1, rangeWidthFactor / valueWidth);

  // Si position inactive, retourner le boost inactif multiplié par le facteur de largeur
  if (!isActive) {
    // Option avancée: calculer le boost en fonction de la distance minimale au prix
    const distanceToRange = Math.min(Math.abs(currentValue - valueLower), Math.abs(currentValue - valueUpper));

    // Plus la position est proche du prix actuel, plus le boost est élevé
    const distanceFactor = Math.exp(-distanceToRange / (valueWidth * decayFactor));
    const inactiveBoostWithDistance = inactiveBoost * (1 + distanceFactor * (maxBoost / inactiveBoost - 1) * 0.5);

    return inactiveBoostWithDistance * rangeWidthFactorBoost;
  }

  // Si la position est active, calculer le boost basé sur la proximité
  let totalBoost = 0;

  // Simulation simplifiée: diviser la position en tranches
  for (let i = 0; i < numSlices; i++) {
    // Position de cette tranche dans la plage
    const valuePosition = valueLower + (valueWidth * i) / numSlices;

    // Distance de cette tranche au prix actuel (en ticks)
    const distance = Math.abs(valuePosition - currentValue);

    // Facteur de décroissance basé sur la distance
    let distanceFactor;
    if (proximityMode === "linear") {
      // Décroissance linéaire
      distanceFactor = Math.max(0, 1 - distance / (valueWidth * decayFactor));
    } else {
      // Décroissance exponentielle
      distanceFactor = Math.exp(-distance / (valueWidth * decayFactor));
    }

    // Boost pour cette tranche
    const sliceBoost = minBoost + (maxBoost - minBoost) * distanceFactor;

    // Accumuler
    totalBoost += sliceBoost;
  }

  // Boost moyen pour toute la position
  const averageBoost = totalBoost / numSlices;

  // Le boost final est le boost moyen multiplié par le modificateur de largeur
  return averageBoost * rangeWidthFactorBoost;
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
  valueLower: number,
  valueUpper: number,
  currentValue: number,
  params: V3BoostParams
): string {
  // Vérifier si les paramètres de boost sont valides pour le mode sélectionné
  if (!validateV3BoostParamsForBoostFormula(params)) {
    throw new Error(i18n.t("boostV3Pools.errorInvalidBoostParams", { modeName: params.priceRangeMode }));
  }

  const balance = new BigNumber(tokenBalance);
  const boostFactor = calculateV3Boost(isActive, valueLower, valueUpper, currentValue, params) * factorREGtoOtherToken;
  logInTerminal("debug", ["boostFactor applay", boostFactor, "factorREGtoOtherToken", factorREGtoOtherToken]);
  return balance.multipliedBy(boostFactor).toString(10);
}

function validateV3BoostParamsForBoostFormula(params: V3BoostParams): boolean {
  if (params.priceRangeMode === "none") {
    return true;
  }

  logInTerminal("debug", [
    "validateV3BoostParamsForBoostFormula params.boostMode",
    params.boostMode,
    !params.boostMode,
    !Object.values(BoostModeValues).includes(params.boostMode as BoostModeType),
  ]);

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

  if (params.priceRangeMode === "linear") {
    if (params.boostMode === "centered") {
      // centerBoost est obligatoire et doit être supérieur à 0
      if (!params.centerBoost || params.centerBoost <= 0) {
        console.error(
          i18n.t("boostV3Pools.errorInvalidParams", {
            paramsName: "centerBoost",
            paramsValue: params.centerBoost ?? "undefined or <=0",
          })
        );
        return false;
      }

      // edgeBoost est obligatoire et doit être supérieur à 0
      if (!params.edgeBoost || params.edgeBoost <= 0) {
        console.error(
          i18n.t("boostV3Pools.errorInvalidParams", {
            paramsName: "edgeBoost",
            paramsValue: params.edgeBoost ?? "undefined or <=0",
          })
        );
        return false;
      }

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
      // Si les paramètres obligatoires sont valides, on retourne true
      return true;
    }
    if (params.boostMode === "proximity") {
    }
  }

  if (params.priceRangeMode === "exponential") {
    if (params.boostMode === "centered") {
      // centerBoost est obligatoire et doit être supérieur à 0
      if (!params.centerBoost || params.centerBoost <= 0) {
        console.error(
          i18n.t("boostV3Pools.errorInvalidParams", {
            paramsName: "centerBoost",
            paramsValue: params.centerBoost ?? "undefined or <=0",
          })
        );
        return false;
      }

      // edgeBoost est obligatoire et doit être supérieur à 0
      if (!params.edgeBoost || params.edgeBoost <= 0) {
        console.error(
          i18n.t("boostV3Pools.errorInvalidParams", {
            paramsName: "edgeBoost",
            paramsValue: params.edgeBoost ?? "undefined or <=0",
          })
        );
        return false;
      }

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

      if (!params.exponent || params.exponent <= 0) {
        console.error(
          i18n.t("boostV3Pools.errorInvalidParams", {
            paramsName: "exponent",
            paramsValue: params.exponent ?? "undefined or <=0",
          })
        );
        return false;
      }

      // Si les paramètres obligatoires sont valides, on retourne true
      return true;
    }
  }

  if (params.priceRangeMode === "step") {
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

    // edgeBoost est obligatoire et doit être supérieur à 0
    if (!params.edgeBoost || params.edgeBoost <= 0) {
      console.error(
        i18n.t("boostV3Pools.errorInvalidParams", {
          paramsName: "edgeBoost",
          paramsValue: params.edgeBoost ?? "undefined or <=0",
        })
      );
      return false;
    }
    return true;
  }

  return false;
}
