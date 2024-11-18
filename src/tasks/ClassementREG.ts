import { BigNumber } from "bignumber.js";
import fs, { readFileSync } from "fs";
import path from "path";
import { optionsModifiers } from "../configs/optionsModifiers.js";
import { i18n } from "../i18n/index.js";
import { askInput, askUseTempFile } from "../utils/inquirer.js";
import { getJsonFiles } from "../utils/lib.js";

const __dirname = new URL(".", import.meta.url).pathname;

/**
 * Tâche principale pour générer le classement des détenteurs de REG
 * @returns {Promise<string>} Chemin du fichier de sortie
 */
export async function taskClassementREG(): Promise<string> {
  // Définition du chemin du dossier contenant les fichiers de données
  const dirPath = path.join(__dirname, "..", "..", "outDatas");

  // Récupération de la liste des fichiers JSON dans le dossier
  const jsonFiles = await getJsonFiles(dirPath);

  // Vérification de l'existence de fichiers JSON
  if (jsonFiles.length === 0) {
    // TODO: ajouter la possibilité de lancer la génération du fichier JSON et exécuter la suite de la tâche après génération
    console.error(i18n.t("tasks.classementREG.noJsonFiles"));
    return "";
  }

  console.info(i18n.t("tasks.classementREG.infoJsonFileAvailable"), jsonFiles);

  // Demande à l'utilisateur de choisir un fichier JSON
  const jsonFileName = await askUseTempFile(jsonFiles);

  // Demande à l'utilisateur le nombre de top holders à afficher
  const topN = await askInput(i18n.t("tasks.classementREG.askTopN"), {
    regex: /^([0-9]+|all)$/,
    messageEchec: i18n.t("tasks.classementREG.messageEchec"),
  });

  // Construction du chemin complet du fichier JSON choisi
  const jsonFilePath = path.join(dirPath, jsonFileName);

  // Définition du chemin du fichier de sortie
  const pathFile = path.join(__dirname, "..", "..", "outDatas/classementREG_tmp.json");

  // Lecture et parsing du fichier JSON
  const jsonData = JSON.parse(readFileSync(jsonFilePath, "utf-8"));

  // Filtrage et mapping des balances
  const balances = jsonData.result.balances
    .filter((item: any) => item.type === "wallet" && !optionsModifiers?.excludeAddresses?.includes(item.walletAddress))
    .map((item: any) => ({
      address: item.walletAddress,
      balance: new BigNumber(item.totalBalanceREG),
    }));

  balances.sort(
    (
      a: { balance: any },
      b: {
        balance: {
          minus: (arg0: any) => {
            (): any;
            new (): any;
            toNumber: { (): any; new (): any };
          };
        };
      }
    ) => b.balance.minus(a.balance).toNumber()
  );

  // Calcul de la somme totale des balances
  const totalBalances = balances.reduce(
    (sum: { plus: (arg0: any) => any }, item: { balance: any }) => sum.plus(item.balance),
    new BigNumber(0)
  );

  // Détermination de la limite pour le classement
  const limit = topN === "all" ? balances.length : Math.min(parseInt(topN), balances.length);

  /**
   * Fonction pour écrire les données temporaires dans un fichier
   * @param {any} classementREG - Le classement à écrire
   * @param {fs.PathOrFileDescriptor} pathFile - Le chemin du fichier de sortie
   */
  function writeTempFile(classementREG: any, pathFile: fs.PathOrFileDescriptor) {
    fs.writeFileSync(pathFile, JSON.stringify({ result: { classementREG } }, null, 2));
  }

  // Génération du classement
  const classementREG = balances.slice(0, limit).map(
    (
      item: {
        balance: {
          dividedBy: (arg0: any) => {
            (): any;
            new (): any;
            multipliedBy: { (arg0: number): any; new (): any };
          };
          toFixed: (arg0: number) => any;
        };
        address: any;
      },
      index: number
    ) => {
      const percentage = item.balance.dividedBy(totalBalances).multipliedBy(100);

      return {
        rank: index + 1,
        address: item.address,
        balance: item.balance.toFixed(4),
        percentage: percentage.toFixed(2),
      };
    }
  );

  // Écriture du classement dans le fichier de sortie
  writeTempFile(classementREG, pathFile);

  return pathFile;
}
