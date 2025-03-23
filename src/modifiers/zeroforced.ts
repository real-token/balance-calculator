import { BigNumber } from "bignumber.js";
import { i18n } from "../i18n/index.js";
import { SourceBalancesREG } from "../types/REG.types.js";
import { NormalizeOptions } from "../types/inputModles.types.js";

/**
 * Met à zéro le pouvoir de vote si le total est inférieur à une valeur seuil
 * @param data Données d'entrée de type SourceBalancesREG[]
 * @param threshold Valeur seuil en dessous de laquelle le pouvoir de vote sera mis à zéro
 * @returns Données de type SourceBalancesREG[] avec totalBalance modifié si nécessaire
 */
export function zeroforced(data: SourceBalancesREG[], threshold: NormalizeOptions["zeroforced"]): SourceBalancesREG[] {
  console.info(i18n.t("modifiers.infoApplyModifier", { modifier: "zeroforced" }), threshold);

  // Si aucun seuil n'est fourni, retourner les données inchangées
  if (!threshold || typeof threshold !== "number" || threshold <= 0) {
    return data;
  }

  // Appliquer la règle de mise à zéro pour chaque utilisateur
  return data.map((item: SourceBalancesREG) => {
    // Créer une copie de l'objet item
    const newItem = { ...item };

    // Vérifier si le pouvoir de vote est inférieur au seuil
    const currentBalance = new BigNumber(item.totalBalance);
    if (currentBalance.isLessThan(threshold)) {
      // Mettre à zéro le pouvoir de vote
      newItem.totalBalance = "0";

      // Mettre également à zéro les autres valeurs de balance totale pour cohérence
      newItem.totalBalanceREG = "0";
      newItem.totalBalanceEquivalentREG = "0";
    }

    return newItem;
  });
}
