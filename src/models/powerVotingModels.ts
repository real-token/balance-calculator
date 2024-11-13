import { BigNumber } from "bignumber.js";

/**
 * PowerVotingModel
 * permet de calculer le pouvoir de vote d'un adresse a partir des données d'entrée normalisées
 * @export
 * @interface PowerVotingModel
 */
export interface PowerVotingModel {
  calculate: (balance: BigNumber, totalSupply: BigNumber) => BigNumber;
}

/**
 * powerVotingModels
 * liste des modeles de calcul de pouvoir de vote
 * Les valeurs en entrée peuvent avoir subit un pré traitement, comme par exemple, un boost des balances des dex a l'aide des modifiers
 * @linearModel : calcul de pouvoir de vote linéaire, 1 token = 1 vote
 * @squareRootModel : calcul de pouvoir de vote racine carrée, 1 token = sqrt(token) votes
 * @export
 * @interface PowerVotingModel
 */
export const powerVotingModels: Record<string, PowerVotingModel> = {
  linearModel: {
    calculate: (balance: BigNumber, totalSupply: BigNumber) => {
      return balance;
    },
  },
  squareRootModel: {
    calculate: (balance: BigNumber, totalSupply: BigNumber) => {
      return balance.sqrt().dividedBy(totalSupply.sqrt());
    },
  },
  // Ajoutez d'autres modèles ici si nécessaire
};

/**
 * Calcule le pouvoir de vote pour chaque adresse à partir des données normalisées
 *
 * @param {Array<{ address: string; balance: BigNumber }>} normalizedData - Données normalisées des balances
 * @param {PowerVotingModel} model - Modèle de calcul du pouvoir de vote
 * @param {Array<Array<Array<string>>>} previousData - Données précédentes de pouvoir de vote
 * @param {Object} [option] - Options supplémentaires (non utilisées actuellement)
 * @returns {Array<{ address: string; powerVoting: BigNumber }>} Tableau des pouvoirs de vote calculés
 */
export function calculatePowerVoting(
  normalizedData: Array<{ address: string; balance: BigNumber }>,
  model: PowerVotingModel,
  previousData: Array<Array<Array<string>>>,
  option?: {}
): Array<{ address: string; powerVoting: BigNumber }> {
  // Création d'un ensemble des adresses actuelles
  const currentAddresses = new Set(normalizedData.map((item) => item.address));

  // Récupération des adresses manquantes des données précédentes pour retiréer le pouvoir de vote des adresses qui non plus de REG ou ont été exclues
  const missingAddresses = previousData.flatMap((batch) =>
    batch
      .filter(
        ([address, balance]) =>
          !currentAddresses.has(address) && new BigNumber(balance).gt(0)
      )
      .map(([address]) => ({
        address,
        balance: new BigNumber(0),
      }))
  );

  // Fusion des données normalisées avec les adresses manquantes
  const completeData = [...normalizedData, ...missingAddresses];

  // Calcul de l'offre totale
  const totalSupply = completeData.reduce(
    (sum, item) => sum.plus(item.balance),
    new BigNumber(0)
  );

  // Calcul du pouvoir de vote pour chaque adresse
  return completeData.map((item) => ({
    address: item.address,
    powerVoting: model.calculate(item.balance, totalSupply),
  }));
}
