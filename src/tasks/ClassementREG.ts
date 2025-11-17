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
  const allJsonFiles = await getJsonFiles(dirPath);

  // Filtrer pour les fichiers utilisables pour le classement
  const balanceFiles = allJsonFiles.filter((file) => file.startsWith("balancesREG_"));
  const powerVotingFiles = allJsonFiles.filter((file) => file.startsWith("powerVotingREG-"));
  const classementFiles = allJsonFiles.filter((file) => file.startsWith("classementREG_"));

  const jsonFiles = [
    ...powerVotingFiles.map((f) => ({ file: f, type: "powerVoting" })),
    ...balanceFiles.map((f) => ({ file: f, type: "balances" })),
    ...classementFiles.map((f) => ({ file: f, type: "classement" })),
  ].sort((a, b) => b.file.localeCompare(a.file)); // Trier par ordre décroissant (plus récent en premier)

  // Vérification de l'existence de fichiers JSON appropriés
  if (jsonFiles.length === 0) {
    console.error("❌ Aucun fichier utilisable trouvé.");
    console.log("💡 Fichiers disponibles :", allJsonFiles);
    console.log("💡 Générez d'abord des données avec 'GetBalancesREG' ou 'CalculatePowerVotingREG'");
    return "";
  }

  console.info("📊 Fichiers disponibles pour le classement:");
  jsonFiles.forEach(({ file, type }) => {
    const emoji = type === "powerVoting" ? "⚡" : type === "balances" ? "💰" : "🏆";
    console.info(`  ${emoji} ${file} (${type})`);
  });

  // Demande à l'utilisateur de choisir un fichier JSON
  const selectedFileObj = await askUseTempFile(jsonFiles.map((f) => f.file));
  const selectedFile = jsonFiles.find((f) => f.file === selectedFileObj);
  const jsonFileName = selectedFile?.file || selectedFileObj;
  const fileType = selectedFile?.type || "unknown";

  console.info(`📁 Fichier sélectionné: ${jsonFileName} (type: ${fileType})`);

  // Demande à l'utilisateur le nombre de top holders à afficher
  const topN = await askInput(
    i18n.t("tasks.classementREG.askTopN"),
    {
      regex: /^([0-9]+|all)$/,
      messageEchec: i18n.t("tasks.classementREG.messageEchec"),
    },
    "10"
  );

  // Traitement selon le type de fichier
  let keyUseBalance = "powerVoting"; // par défaut pour les fichiers powerVoting

  if (fileType === "balances") {
    // Lire le fichier JSON pour extraire les clés réelles
    const sampleFilePath = path.join(dirPath, jsonFileName);
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

    // Vérifier la structure du fichier JSON
    if (!sampleData.result || !sampleData.result.balances) {
      console.error("❌ Structure de fichier JSON invalide. Attendu : result.balances");
      return "";
    }

    // Extraire toutes les clés possibles du premier wallet
    const balanceKeys =
      sampleData.result.balances && sampleData.result.balances.length > 0
        ? extractAllPossibleKeys(sampleData.result.balances[0])
        : [];

    console.log("DEBUG balanceKeys", balanceKeys);

    if (balanceKeys.length === 0) {
      console.error(i18n.t("tasks.classementREG.noBalanceKeysFound"));
      return "";
    }

    keyUseBalance = await askChoiseListe(i18n.t("tasks.classementREG.askUseBalance"), {
      value: balanceKeys,
      name: balanceKeys,
    });
  } else if (fileType === "powerVoting") {
    console.info("⚡ Utilisation des données de power voting (pas de sélection de clé nécessaire)");
  } else if (fileType === "classement") {
    console.info("🏆 Utilisation d'un fichier de classement existant");
  }

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

  // Traitement des données selon le type de fichier
  let balances: Array<{ address: string; balance: BigNumber }> = [];

  if (fileType === "powerVoting") {
    // Traitement pour les fichiers de power voting
    if (!jsonData.result || !jsonData.result.powerVoting) {
      console.error("❌ Structure de fichier invalide. Attendu : result.powerVoting");
      return "";
    }

    balances = jsonData.result.powerVoting
      .filter((item: any) => !optionsModifiers?.excludeAddresses?.includes(item.address))
      .map((item: any) => ({
        address: item.address,
        balance: new BigNumber(item.powerVoting || "0"),
      }));
  } else if (fileType === "balances") {
    // Traitement pour les fichiers de balances
    if (!jsonData.result || !jsonData.result.balances) {
      console.error("❌ Structure de fichier invalide. Attendu : result.balances");
      return "";
    }

    balances = jsonData.result.balances
      .filter(
        (item: any) => item.type === "wallet" && !optionsModifiers?.excludeAddresses?.includes(item.walletAddress)
      )
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
  } else if (fileType === "classement") {
    // Traitement pour les fichiers de classement existants
    if (!jsonData.result || !jsonData.result.classementREG) {
      console.error("❌ Structure de fichier invalide. Attendu : result.classementREG");
      return "";
    }

    balances = jsonData.result.classementREG.map((item: any) => ({
      address: item.address,
      balance: new BigNumber(item.balance || "0"),
    }));
  }

  balances.sort((a, b) => b.balance.minus(a.balance).toNumber());

  // Calcul de la somme totale des balances
  const totalBalances = balances.reduce((sum, item) => sum.plus(item.balance), new BigNumber(0));

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
  const classementREG = balances.slice(0, limit).map((item, index) => {
    const percentage = item.balance.dividedBy(totalBalances).multipliedBy(100);

    return {
      rank: index + 1,
      address: item.address,
      balance: item.balance.toFixed(4),
      percentage: percentage.toFixed(2),
    };
  });

  // Écriture du classement dans le fichier de sortie
  writeTempFile(classementREG, pathFile);

  return pathFile;
}
