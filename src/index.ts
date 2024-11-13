import {
  askChoiseListe,
  askUseTempFile,
  askUseconfirm,
} from "./utils/inquirer.js";

import fs, { readFileSync } from "fs";
import path from "path";
import {
  extractBaseName,
  formatDate,
  getTempJsonFiles,
  getUtcOffset,
  jsonToCsv,
} from "./utils/lib.js";

import { AskTask } from "./types/generic.types.js";
import { taskGetBalancesREG } from "./tasks/GetBalancesREG.js";
import { taskGetAddressOwnRealToken } from "./tasks/GetAddressOwnRealToken.js";
import { taskClassementREG } from "./tasks/ClassementREG.js";
import { taskCalculatePowerVotingREG } from "./tasks/CalculatePowerVotingREG.js";

import dotenv from "dotenv";

// Charger les variables d'environnement
dotenv.config();

// Gestion des erreurs non capturées
process.on("uncaughtException", (error) => {
  console.error("Erreur non gérée :", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Promesse rejetée non gérée :", reason);
});

// Vérifier si la clé API de The Graph est définie
if (!process.env.THEGRAPH_API_KEY) {
  throw new Error(
    "La clé API de The Graph n'est pas définie dans le fichier .env. Veuillez la définir et réessayer."
  );
}

const __dirname = new URL(".", import.meta.url).pathname;

async function main() {
  let result: any;

  // Générer la liste des tâches disponibles
  const tasksDir = path.join(__dirname, "tasks");
  const taskFiles = fs.readdirSync(tasksDir);
  const askTask: AskTask = taskFiles
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
    .reduce(
      (acc: AskTask, file: string) => {
        const taskName = path.basename(file, path.extname(file));
        acc.value.push(taskName);
        acc.name.push(taskName);
        return acc;
      },
      { value: [], name: [] }
    );

  // Demander à l'utilisateur quelle tâche exécuter
  const task = await askChoiseListe(
    "Quelle tâche voulez-vous exécuter ?",
    askTask
  );

  // Gestion des fichiers temporaires
  const outDir = path.join(__dirname, "..", "outDatas");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const tempFiles = await getTempJsonFiles(outDir);
  const tempData =
    tempFiles.length > 0 &&
    (await askUseconfirm(
      `Voulez-vous utiliser un fichier temporaire pour reprendre ? (Y/n)`,
      true
    ))
      ? await fs.promises.readFile(
          path.join(outDir, await askUseTempFile(tempFiles)),
          "utf-8"
        )
      : "";

  // Mapping des tâches disponibles
  const taskMap: Record<string, (tempData: string) => Promise<string>> = {
    GetAddressOwnRealToken: taskGetAddressOwnRealToken,
    GetBalancesREG: taskGetBalancesREG,
    ClassementREG: taskClassementREG,
    CalculatePowerVotingREG: taskCalculatePowerVotingREG,
  };

  // Exécuter la tâche sélectionnée
  if (task in taskMap) {
    result = await taskMap[task as keyof typeof taskMap](tempData);
  } else {
    console.log(`La tâche ${task} n'est pas encore implémentée.`);
  }

  if (!result) return;

  // Traitement du résultat
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const filename =
    extractBaseName(result) +
    formatDate(now, timeZone) +
    "_" +
    getUtcOffset(now);

  const jsonFilename = path.join(outDir, `${filename}.json`);
  const csvFilename = path.join(outDir, `${filename}.csv`);

  const contentFiles = readFileSync(result, "utf-8");
  const parsed = JSON.parse(contentFiles);
  const csv = jsonToCsv(parsed);

  // Sauvegarder les résultats en JSON et CSV
  await Promise.all([
    fs.promises.rename(result, jsonFilename),
    fs.promises.writeFile(csvFilename, csv),
  ]);

  console.info("Fichier JSON créé à l'emplacement : \n", jsonFilename);
  console.info("Fichier CSV créé à l'emplacement : \n", csvFilename);
}

main();
