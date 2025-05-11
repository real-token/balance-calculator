import { BigNumber } from "bignumber.js";

/**
 * Types de formules de boost disponibles pour les positions v3
 */
export type BoostFormulaType = "linear" | "exponential" | "step" | "none";

/**
 * Types de modes de calcul du boost
 */
export type BoostModeType = "centered" | "proximity";

/**
 * Paramètres pour le calcul du boost des positions v3
 */
export interface V3BoostParams {
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
 * @param tickLower Tick inférieur de la position
 * @param tickUpper Tick supérieur de la position
 * @param currentTick Tick actuel du prix
 * @param params Paramètres de boost
 * @returns Facteur multiplicateur à appliquer
 */
export function calculateV3Boost(
  isActive: boolean,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  params: V3BoostParams
): number {
  if (params.priceRangeMode === "none") {
    return 0;
  }

  // Si le mode est "proximity", utiliser l'algorithme basé sur la proximité
  if (params.boostMode === "proximity") {
    return calculateProximityBoost(isActive, tickLower, tickUpper, currentTick, params);
  }

  // Sinon, utiliser l'algorithme classique basé sur le centrage (mode "centered" par défaut)
  return calculateCenteredBoost(isActive, tickLower, tickUpper, currentTick, params);
}

/**
 * Calcule le boost selon l'approche de centrage (position bien centrée autour du prix)
 */
function calculateCenteredBoost(
  isActive: boolean,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  params: V3BoostParams
): number {
  // Si le mode est "none", on applique uniquement le boost actif
  if (params.priceRangeMode === "none") {
    return 0;
  }

  // Si la position n'est pas active, on applique uniquement le boost inactif
  if (!isActive) {
    return 0;
  }

  const activeBoost = params.activeBoost || 1;
  const rangeWidthFactor = params.rangeWidthFactor || 1;
  const centerBoost = params.centerBoost || 1;
  const edgeBoost = params.edgeBoost || 1;
  const exponent = params.exponent || 1;

  // Calcul de la largeur de la plage
  const tickWidth = tickUpper - tickLower;

  // Calcul de la position relative du prix actuel dans la plage (de 0 à 1)
  // 0 = extrême bord inférieur, 0.5 = centre, 1 = extrême bord supérieur
  const relativePosition = (currentTick - tickLower) / tickWidth;

  // Calcul du centrage (0 = bord, 1 = centre)
  // Cette formule transforme les valeurs [0,1] en [0,1,0] avec un pic à 0.5
  const centeredness = 1 - Math.abs(relativePosition - 0.5) * 2;

  // Calcul du modificateur de largeur de plage
  // Plus la plage est étroite, plus le boost est important
  const rangeWidthModifier = Math.min(1, rangeWidthFactor / tickWidth);

  // Calcul du boost en fonction du mode sélectionné
  let boost: number;

  switch (params.priceRangeMode) {
    case "linear":
      // Variation linéaire du boost entre edge et center
      boost = edgeBoost + centeredness * (centerBoost - edgeBoost);
      break;

    case "exponential":
      // Variation exponentielle qui accentue davantage le boost au centre
      boost = edgeBoost + Math.pow(centeredness, exponent) * (centerBoost - edgeBoost);
      break;

    case "step":
      // Division de la plage en zones avec des boosts différents
      boost = edgeBoost; // Valeur par défaut

      if (params.steps && Array.isArray(params.steps)) {
        // Trouver le palier approprié
        for (const [threshold, boostValue] of params.steps) {
          if (centeredness >= threshold) {
            boost = boostValue;
          }
        }
      }
      break;

    default:
      boost = activeBoost;
  }

  // Application du modificateur de largeur de plage et du boost de base pour positions actives
  return boost * rangeWidthModifier;
}

/**
 * Calcule le boost selon l'approche de proximité (proximité de la liquidité avec le prix actuel)
 */
function calculateProximityBoost(
  isActive: boolean,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
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
  const tickWidth = tickUpper - tickLower;

  // Calcul du modificateur de largeur de plage (comme dans le mode centered)
  const rangeWidthModifier = Math.min(1, rangeWidthFactor / tickWidth);

  // Si position inactive, retourner le boost inactif multiplié par le facteur de largeur
  if (!isActive) {
    // Option avancée: calculer le boost en fonction de la distance minimale au prix
    const distanceToRange = Math.min(Math.abs(currentTick - tickLower), Math.abs(currentTick - tickUpper));

    // Plus la position est proche du prix actuel, plus le boost est élevé
    const distanceFactor = Math.exp(-distanceToRange / (tickWidth * decayFactor));
    const inactiveBoostWithDistance = inactiveBoost * (1 + distanceFactor * (maxBoost / inactiveBoost - 1) * 0.5);

    return inactiveBoostWithDistance * rangeWidthModifier;
  }

  // Si la position est active, calculer le boost basé sur la proximité
  let totalBoost = 0;

  // Simulation simplifiée: diviser la position en tranches
  for (let i = 0; i < numSlices; i++) {
    // Position de cette tranche dans la plage
    const tickPosition = tickLower + (tickWidth * i) / numSlices;

    // Distance de cette tranche au prix actuel (en ticks)
    const distance = Math.abs(tickPosition - currentTick);

    // Facteur de décroissance basé sur la distance
    let distanceFactor;
    if (proximityMode === "linear") {
      // Décroissance linéaire
      distanceFactor = Math.max(0, 1 - distance / (tickWidth * decayFactor));
    } else {
      // Décroissance exponentielle
      distanceFactor = Math.exp(-distance / (tickWidth * decayFactor));
    }

    // Boost pour cette tranche
    const sliceBoost = minBoost + (maxBoost - minBoost) * distanceFactor;

    // Accumuler
    totalBoost += sliceBoost;
  }

  // Boost moyen pour toute la position
  const averageBoost = totalBoost / numSlices;

  // Le boost final est le boost moyen multiplié par le modificateur de largeur
  return averageBoost * rangeWidthModifier;
}

/**
 * Calcule le boost total à appliquer à une position v3
 * @param tokenBalance Balance de tokens dans la position
 * @param isActive Si la position est active
 * @param tickLower Tick inférieur
 * @param tickUpper Tick supérieur
 * @param currentTick Tick actuel
 * @param params Paramètres de boost
 * @returns La balance boostée
 */
export function applyV3Boost(
  tokenBalance: string,
  isActive: boolean,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  params: V3BoostParams
): string {
  const balance = new BigNumber(tokenBalance);
  const boostFactor = calculateV3Boost(isActive, tickLower, tickUpper, currentTick, params);

  return balance.multipliedBy(boostFactor).toString(10);
}
