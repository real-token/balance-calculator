import { BigNumber } from "bignumber.js";
import { Network } from "../configs/constantes.js";
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
export function boostBalancesWallet(
  data: SourceBalancesREG[],
  options: NormalizeOptions["boostBalancesWallet"]
): SourceBalancesREG[] {
  console.info(i18n.t("modifiers.infoApplyModifier", { modifier: "boostBalancesWallet" }), options);

  // Si aucune option de boost n'est fournie, retourner les données inchangées
  if (!options || options === 0) {
    return data;
  }

  // Parcourir chaque utilisateur
  return data.map((user) => {
    // Parcourir chaque réseau dans les balances de l'utilisateur
    for (const network in user.sourceBalance) {
      const walletBalance = user.sourceBalance[network as Network]?.walletBalance ?? "0";
      if (!walletBalance || walletBalance === "0") return user;
      const newWalletBalance = new BigNumber(walletBalance).multipliedBy(options).toString(10);

      // Mettre à jour les totaux
      const networkMaj = network.charAt(0).toUpperCase() + network.slice(1);
      const newTotalBalanceRegNetwork = new BigNumber(user[`totalBalanceReg${networkMaj}`])
        .minus(walletBalance)
        .plus(newWalletBalance)
        .toString(10);
      const newTotalBalanceREG = new BigNumber(user.totalBalanceREG)
        .minus(user[`totalBalanceReg${networkMaj}`])
        .plus(newTotalBalanceRegNetwork)
        .toString(10);
      const newTotalBalance = new BigNumber(user.totalBalance)
        .minus(user.totalBalanceREG)
        .plus(newTotalBalanceREG)
        .toString(10);

      user.sourceBalance[network as Network]!.walletBalance = newWalletBalance;
      user[`totalBalanceReg${networkMaj}`] = newTotalBalanceRegNetwork;
      user.totalBalanceREG = newTotalBalanceREG;
      user.totalBalance = newTotalBalance;
    }
    return user;
  });
}
