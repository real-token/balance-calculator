import { i18n } from "../i18n/index.js";
import { SourceBalancesREG } from "../types/REG.types.js";

/**
 * Modifie la valeur de la clé totalBalance avec la valeur de la clé balanceKey pour chaque portefeuille
 * @param data Données d'entrée de type SourceBalancesREG[]
 * @param balanceKey Clé de balance à utiliser pour remplacer la valeur de totalBalance
 * Peut être une clé unique ou un tableau de clés permettant d'accéder à des données imbriquées
 * @returns Données de type SourceBalancesREG[] avec totalBalance modifié
 */
export function balanceKey(data: SourceBalancesREG[], balanceKey: string | string[]): SourceBalancesREG[] {
  console.info(i18n.t("modifiers.infoApplyModifier", { modifier: "balanceKey" }), balanceKey);
  return data.map((item: SourceBalancesREG) => {
    let selectedBalance: unknown;
    if (typeof balanceKey === "string") {
      selectedBalance = item[balanceKey as keyof SourceBalancesREG];
    } else {
      selectedBalance = balanceKey.reduce((acc: any, key) => {
        return acc && typeof acc === "object" ? acc[key] : undefined;
      }, item);
    }

    // Créer une copie de l'objet item
    const newItem = { ...item };

    // Remplacer la valeur de totalBalance par la valeur sélectionnée
    newItem.totalBalance =
      typeof selectedBalance === "string" ? selectedBalance : String(selectedBalance || "Balance not found");

    return newItem;
  });
}
