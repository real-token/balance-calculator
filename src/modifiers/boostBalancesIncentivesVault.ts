import { BigNumber } from "bignumber.js";
import { NETWORK } from "../configs/constantes.js";
import { i18n } from "../i18n/index.js";
import { SourceBalancesREG } from "../types/REG.types.js";
import { NormalizeOptions } from "../types/inputModles.types.js";

/**
 * Modifie les balances des DEX en fonction des options spécifiées
 * @param data Données d'entrée de type SourceBalancesREG[]
 * @param options Options de boost des balances des DEX
 * Les options sont de type { [key in DexValue]?: [string[], number[]] }
 * string[] est un tableau de symboles de tokens à booster ou '*' pour tous les tokens
 * number[] est un tableau de facteurs de boost correspondants
 * @returns Données modifiées de type SourceBalancesREG[]
 */
export function boostBalancesIncentivesVault(
  data: SourceBalancesREG[],
  options: NormalizeOptions["boostBalancesIncentivesVault"]
): SourceBalancesREG[] {
  console.info(i18n.t("modifiers.infoApplyModifier", { modifier: "boostBalancesIncentivesVault" }), options);

  // Si aucune option de boost n'est fournie, retourner les données inchangées
  if (!options || options === 0) {
    return data;
  }

  // Parcourir chaque utilisateur
  return data.map((user) => {
    // Parcourir chaque réseau dans les balances de l'utilisateur

    const vaultIncentiveV1 = user.sourceBalance![NETWORK.GNOSIS]?.vaultIncentiveV1 ?? "0";
    if (!vaultIncentiveV1 || vaultIncentiveV1 === "0") return user;
    const newVaultIncentiveV1 = new BigNumber(vaultIncentiveV1).multipliedBy(options).toString(10);

    const newTotalBalanceRegGnosis = new BigNumber(user.totalBalanceRegGnosis)
      .minus(vaultIncentiveV1)
      .plus(newVaultIncentiveV1)
      .toString(10);
    const newTotalBalanceREG = new BigNumber(user.totalBalanceREG)
      .minus(user.totalBalanceRegGnosis)
      .plus(newTotalBalanceRegGnosis)
      .toString(10);
    const newTotalBalance = new BigNumber(user.totalBalance)
      .minus(user.totalBalanceREG)
      .plus(newTotalBalanceREG)
      .toString(10);

    user.totalBalanceRegGnosis = newTotalBalanceRegGnosis;
    user.totalBalanceREG = newTotalBalanceREG;
    user.totalBalance = newTotalBalance;

    return user;
  });
}
