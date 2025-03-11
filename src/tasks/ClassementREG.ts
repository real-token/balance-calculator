import { BigNumber } from "bignumber.js";
import fs, { readFileSync } from "fs";
import path from "path";
import { optionsModifiers } from "../configs/optionsModifiers.js";
import { i18n } from "../i18n/index.js";
import { askChoiseListe, askInput, askUseTempFile } from "../utils/inquirer.js";
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
  const topN = await askInput(
    i18n.t("tasks.classementREG.askTopN"),
    {
      regex: /^([0-9]+|all)$/,
      messageEchec: i18n.t("tasks.classementREG.messageEchec"),
    },
    "10"
  );

  // Lire le fichier JSON pour extraire les clés réelles
  const sampleFilePath = path.join(dirPath, jsonFiles[0]);
  const sampleData = JSON.parse(readFileSync(sampleFilePath, "utf-8"));

  // Fonction pour extraire toutes les clés possibles, y compris les sous-objets
  function extractAllPossibleKeys(obj: any, prefix = ""): string[] {
    if (!obj || typeof obj !== "object") return [];

    let keys: string[] = [];

    // Ajouter les clés de premier niveau qui commencent par "totalBalance"
    Object.keys(obj).forEach((key) => {
      if (key.startsWith("totalBalance")) {
        keys.push(prefix + key);
      }

      // Si c'est sourceBalance, explorer les sous-objets
      if (key === "sourceBalance" && obj[key]) {
        // Parcourir les réseaux
        Object.keys(obj[key]).forEach((network) => {
          const networkObj = obj[key][network];
          if (networkObj) {
            // Ajouter les clés directes du réseau
            if (networkObj.walletBalance) keys.push(`sourceBalance.${network}.walletBalance`);
            if (networkObj.vaultIncentiveV1) keys.push(`sourceBalance.${network}.vaultIncentiveV1`);
            // TODO : ajouter les clés de dex

            // Explorer les DEXs si présents
            if (networkObj.dexs) {
              Object.keys(networkObj.dexs).forEach((dex) => {
                const dexArray = networkObj.dexs[dex];
                if (Array.isArray(dexArray) && dexArray.length > 0) {
                  // Ajouter une entrée pour chaque pool avec son adresse
                  dexArray.forEach((pool, index) => {
                    if (pool.tokenBalance) {
                      keys.push(`sourceBalance.${network}.dexs.${dex}[${index}].tokenBalance (${pool.tokenSymbol})`);
                    }
                    if (pool.equivalentREG) {
                      keys.push(`sourceBalance.${network}.dexs.${dex}[${index}].equivalentREG (${pool.tokenSymbol})`);
                    }
                  });
                }
              });
            }
          }
        });
      }
    });

    return keys;
  }

  // Extraire toutes les clés possibles du premier wallet
  const balanceKeys =
    sampleData.result.balances.length > 0 ? extractAllPossibleKeys(sampleData.result.balances[0]) : [];

  console.log("DEBUG balanceKeys", balanceKeys);

  if (balanceKeys.length === 0) {
    console.error(i18n.t("tasks.classementREG.noBalanceKeysFound"));
    return "";
  }

  const keyUseBalance = await askChoiseListe(i18n.t("tasks.classementREG.askUseBalance"), {
    value: balanceKeys,
    name: balanceKeys,
  });

  // Fonction pour accéder à une valeur via un chemin de propriété (ex: "sourceBalance.gnosis.walletBalance")
  function getValueByPath(obj: any, path: string): any {
    const parts = path.split(".");
    let current = obj;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      // Gérer les tableaux avec index [n]
      if (part.includes("[") && part.includes("]")) {
        const arrayName = part.split("[")[0];
        const indexStr = part.split("[")[1].split("]")[0];
        const index = parseInt(indexStr, 10);

        if (!current[arrayName] || !Array.isArray(current[arrayName]) || !current[arrayName][index]) {
          return "0";
        }

        current = current[arrayName][index];
      } else {
        if (current === undefined || current === null || current[part] === undefined) {
          return "0";
        }
        current = current[part];
      }
    }

    return current || "0";
  }

  // Construction du chemin complet du fichier JSON choisi
  const jsonFilePath = path.join(dirPath, jsonFileName);

  // Définition du chemin du fichier de sortie
  const pathFile = path.join(__dirname, "..", "..", "outDatas/classementREG_tmp.json");

  // Lecture et parsing du fichier JSON
  const jsonData = JSON.parse(readFileSync(jsonFilePath, "utf-8"));

  // Filtrage et mapping des balances
  const balances = jsonData.result.balances
    .filter((item: any) => item.type === "wallet" && !optionsModifiers?.excludeAddresses?.includes(item.walletAddress))
    .map((item: any) => {
      // Extraire la valeur en fonction du chemin de propriété
      let balanceValue;

      // Si c'est une clé simple, l'utiliser directement
      if (!keyUseBalance.includes(".")) {
        balanceValue = item[keyUseBalance];
      } else {
        // Sinon, utiliser la fonction pour accéder au chemin complet
        balanceValue = getValueByPath(item, keyUseBalance.split(" ")[0]); // Enlever la partie descriptive entre parenthèses
      }

      return {
        address: item.walletAddress,
        balance: new BigNumber(balanceValue || "0"),
      };
    });

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
