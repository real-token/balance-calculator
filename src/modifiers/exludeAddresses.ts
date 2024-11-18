import { i18n } from "../i18n/index.js";
import { SourceBalancesREG } from "../types/REG.types.js";

/**
 * Filtre une liste de données en excluant certaines adresses spécifiques
 *
 * Cette fonction permet de filtrer un tableau de données en retirant les entrées
 * dont l'adresse de portefeuille correspond à l'une des adresses à exclure.
 * Les adresses sont comparées en minuscules pour éviter les problèmes de casse.
 *
 * @param data - Tableau d'objets SourceBalancesREG contenant les données à filtrer
 * @param excludeAddresses - Liste des adresses à exclure du résultat
 * @returns Nouveau tableau filtré sans les adresses exclues
 *
 * @example
 * const filteredData = excludeAddresses(data, ['0x123...', '0x456...']);
 */
export function excludeAddresses(data: SourceBalancesREG[], excludeAddresses: string[]): SourceBalancesREG[] {
  console.info(i18n.t("modifiers.infoApplyModifier", { modifier: "excludeAddresses" }), excludeAddresses);
  return data.filter((item) => !excludeAddresses.includes(item.walletAddress.toLowerCase()));
}
