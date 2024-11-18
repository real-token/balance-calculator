import { askChoiseListe, askUseTempFile, askUseconfirm } from "./utils/inquirer.js";

import fs, { readFileSync } from "fs";
import path from "path";
import { extractBaseName, formatDate, getTempJsonFiles, getUtcOffset, jsonToCsv } from "./utils/lib.js";

import { i18n } from "./i18n/index.js";
import { taskCalculatePowerVotingREG } from "./tasks/CalculatePowerVotingREG.js";
import { taskClassementREG } from "./tasks/ClassementREG.js";
import { taskGetAddressOwnRealToken } from "./tasks/GetAddressOwnRealToken.js";
import { taskGetBalancesREG } from "./tasks/GetBalancesREG.js";
import { AskTask } from "./types/generic.types.js";

// Définir la langue par défaut (peut venir d'une variable d'environnement)
import dotenv from "dotenv";

// Charger les variables d'environnement
dotenv.config();
i18n.setLocale((process.env.LOCALE as "fr" | "en") || "fr");

// Gestion des erreurs non capturées
process.on("uncaughtException", (error) => {
  console.error(i18n.t("common.errors.notGenerated"), error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(i18n.t("common.errors.promiseRejection"), reason);
});

// Vérifier si la clé API de The Graph est définie
if (!process.env.THEGRAPH_API_KEY) {
  throw new Error(i18n.t("common.errors.apiKeyMissing", { service: "The Graph" }));
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
  const task = await askChoiseListe(i18n.t("common.errors.askTask"), askTask);

  // Gestion des fichiers temporaires
  const outDir = path.join(__dirname, "..", "outDatas");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const tempFiles = await getTempJsonFiles(outDir);
  const tempData =
    tempFiles.length > 0 && (await askUseconfirm(i18n.t("common.errors.askUseTempFile"), true))
      ? await fs.promises.readFile(path.join(outDir, await askUseTempFile(tempFiles)), "utf-8")
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
    console.warn(i18n.t("common.errors.warnTaskNotImplemented", { task }));
  }

  if (!result) return;

  // Traitement du résultat
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const filename = extractBaseName(result) + formatDate(now, timeZone) + "_" + getUtcOffset(now);

  const jsonFilename = path.join(outDir, `${filename}.json`);
  const csvFilename = path.join(outDir, `${filename}.csv`);

  const contentFiles = readFileSync(result, "utf-8");
  const parsed = JSON.parse(contentFiles);
  const csv = jsonToCsv(parsed);

  // Sauvegarder les résultats en JSON et CSV
  await Promise.all([fs.promises.rename(result, jsonFilename), fs.promises.writeFile(csvFilename, csv)]);

  console.info(i18n.t("common.errors.infoJsonFileGenerated"), jsonFilename);
  console.info(i18n.t("common.errors.infoCsvFileGenerated"), csvFilename);
}

main();
