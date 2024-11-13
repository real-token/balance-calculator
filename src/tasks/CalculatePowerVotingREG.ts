import fs from "fs";
import path from "path";
import { askChoiseListe, askUseTempFile } from "../utils/inquirer.js";
import { getJsonFiles } from "../utils/lib.js";
import { PowerVotingModel, calculatePowerVoting, powerVotingModels } from "./../models/powerVotingModels.js";
import { optionsModifiers } from "../configs/optionsModifiers.js";
import { BigNumber } from "bignumber.js";
import { MODE_DEBUG } from "../configs/constantes.js";

const __dirname = new URL(".", import.meta.url).pathname;

/**
 * Tâche principale pour calculer le pouvoir de vote REG
 * @returns {Promise<string>} Chemin du fichier de sortie
 */
export async function taskCalculatePowerVotingREG(): Promise<string> {
  // Définition du chemin du dossier contenant les fichiers de données
  const dirPath = path.join(__dirname, "..", "..", "outDatas");
  const jsonFiles = await getJsonFiles(dirPath);

  if (jsonFiles.length === 0) {
    console.error("Aucun fichier JSON trouvé dans le dossier outDatas");
    return "";
  }

  // Sélection du fichier JSON d'entrée
  const jsonFileName = await askUseTempFile(jsonFiles);
  const jsonFilePath = path.join(dirPath, jsonFileName);
  console.debug("Chemin du fichier JSON d'entrée:", jsonFilePath);
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));

  // Importation et sélection du modèle d'entrée
  const inputModels = await import("./../models/inputModels.js");
  const modelNames = Object.keys(inputModels);

  // Tentative de détection automatique du modèle de données entrantes
  const fileNamePrefix = path.basename(jsonFileName).split("_")[0].toLowerCase();
  let selectedModelName = modelNames.find((name) => name.toLowerCase().startsWith(fileNamePrefix));

  // Si aucun modèle n'est détecté automatiquement, demander à l'utilisateur
  if (!selectedModelName) {
    selectedModelName = await askChoiseListe("Quel modèle d'entrée voulez-vous utiliser ?", {
      value: modelNames,
      name: modelNames,
    });
  } else {
    console.log(`Modèle d'entrée détecté automatiquement : ${selectedModelName}`);
  }

  // Normalisation des données d'entrée
  const selectedModel = inputModels[selectedModelName as keyof typeof inputModels];
  const normalizedData = selectedModel.normalize(jsonData, optionsModifiers);

  // Sélection du modèle de calcul du pouvoir de vote
  const powerVotingModelNames = Object.keys(powerVotingModels);
  const selectedPowerVotingModelName = await askChoiseListe(
    "Quel modèle de calcul de pouvoir de vote voulez-vous utiliser ?",
    { value: powerVotingModelNames, name: powerVotingModelNames }
  );

  const selectedPowerVotingModel: PowerVotingModel =
    powerVotingModels[selectedPowerVotingModelName as keyof typeof powerVotingModels];

  const previousDataPowerVotingJsonFileName = await askChoiseListe(
    "Quel fichier contien les datas de pouvoir de vote précedemment utilisées pour mettre à jour le pouvoir de vote ?",
    { value: jsonFiles, name: jsonFiles }
  );
  const previousDataPowerVotingJsonFilePath = path.join(dirPath, previousDataPowerVotingJsonFileName);
  const previousDataPowerVotingJsonData: {
    tx_datas: Array<Array<Array<string>>>;
  } = JSON.parse(fs.readFileSync(previousDataPowerVotingJsonFilePath, "utf-8"));

  // Calcul du pouvoir de vote
  const powerVotingResults = calculatePowerVoting(
    normalizedData,
    selectedPowerVotingModel,
    previousDataPowerVotingJsonData.tx_datas
  );

  // Formatage des données pour la transaction on-chain
  const BATCH_SIZE = 150; // Taille de chaque lot
  let TotalPowerVoting = new BigNumber(0);

  // Création du tableau complet des données
  const allData = powerVotingResults.map((item): [string, string] => {
    try {
      let powerVoting = new BigNumber(item.powerVoting);

      if (!powerVoting.isFinite() || powerVoting.isNaN()) {
        console.warn(`Valeur de pouvoir de vote invalide pour l'adresse ${item.address}: ${item.powerVoting}`);
        powerVoting = new BigNumber(0);
      }

      const finalValue = powerVoting
        .decimalPlaces(18, BigNumber.ROUND_DOWN)
        .multipliedBy(new BigNumber(10).pow(18))
        .integerValue(BigNumber.ROUND_DOWN);

      TotalPowerVoting = TotalPowerVoting.plus(finalValue);

      return [item.address, finalValue.toString(10)];
    } catch (error: any) {
      console.warn(`Erreur lors du traitement du pouvoir de vote pour l'adresse ${item.address}: ${error.message}`);
      return [item.address, "0"];
    }
  });

  // Division en lots
  const batchesDatasTx = [];
  for (let i = 0; i < allData.length; i += BATCH_SIZE) {
    batchesDatasTx.push(allData.slice(i, i + BATCH_SIZE));
  }

  // Formatage du résultat final
  const formattedResults = {
    result: {
      powerVoting: powerVotingResults.map((item) => ({
        address: item.address,
        powerVoting: item.powerVoting.toString(10),
      })),
    },
    tx_datas: batchesDatasTx,
    totalPowerVoting: TotalPowerVoting.dividedBy(new BigNumber(10).pow(18)).toString(10),
  };

  // Écriture des résultats dans un fichier de sortie
  const outputPath = path.join(dirPath, `powerVotingREG-${selectedModelName}-${selectedPowerVotingModelName}_tmp.json`);
  fs.writeFileSync(outputPath, JSON.stringify(formattedResults, null, 2));

  return outputPath;
}
