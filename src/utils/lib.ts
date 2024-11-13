import fs, { readFileSync } from "fs";
import { NETWORK, Network, blockStartREG, etherscanApiUrls } from "../configs/constantes.js";
import axios from "axios";
import dotenv from "dotenv";
import { BigNumber } from "bignumber.js";
import path from "path";
import util from "util";
dotenv.config();
type KeyString = {
  [key: string]: any;
};

const readdir = util.promisify(fs.readdir);

export function jsonToCsv(jsonData: any) {
  let data: any[];
  const resultKey = Object.keys(jsonData.result)[0];
  const resultValue = Object.values(jsonData.result)[0];

  // Vérifie si la valeur est un tableau
  if (Array.isArray(resultValue)) {
    data = resultValue;
  } else {
    data = [resultValue];
  }

  const items = data.map((item: { [x: string]: any }) => flattenObject(item));
  const replacer = (key: any, value: null) => (value === null ? "" : value);

  // Crée l'en-tête en rassemblant toutes les clés uniques de tous les éléments
  const header = Array.from(new Set(items.flatMap(Object.keys)));

  const csv = [
    header.join(","),
    ...items.map((item: KeyString) => header.map((fieldName) => JSON.stringify(item[fieldName], replacer)).join(",")),
  ].join("\r\n");

  return csv;
}

function flattenObject(obj: KeyString, prefix = "") {
  return Object.keys(obj).reduce((acc: KeyString, k) => {
    const pre = prefix.length ? prefix + "->" : "";
    if (Array.isArray(obj[k])) {
      obj[k].forEach((item: {} | null, index: number) => {
        if (typeof item === "object" && item !== null && Object.keys(item).length) {
          Object.assign(acc, flattenObject(item, pre + k + "->" + index));
        } else {
          acc[pre + k + "->" + index] = item;
        }
      });
    } else if (typeof obj[k] === "object" && obj[k] !== null && Object.keys(obj[k]).length) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}
export function readContentFromFile(filePath: string): boolean | string {
  try {
    const content = readFileSync(filePath, "utf-8");
    return content;
  } catch (error) {
    console.info(`Fichier introuvable : ${filePath}`);
    return false;
  }
}

export function splitIntoChunks(source: string[], chunkSize: number): string[][] {
  let index = 0;
  const result: string[][] = [];

  while (index < source.length) {
    const chunk = source.slice(index, index + chunkSize);
    const quotedChunk = chunk.map((value) => `${value}`);
    result.push(quotedChunk);
    index += chunkSize;
  }

  return result;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getBlockNumber(timestamp: number | undefined, network: Network): Promise<number> {
  if (!timestamp) return -1;

  const apiUrl = etherscanApiUrls[network];

  if (!apiUrl || !apiUrl.length) {
    throw new Error(`Aucune URL d'API n'a été trouvée pour le réseau "${network}"`);
  }

  const apiKey =
    network === NETWORK.ETHEREUM
      ? process.env[keyFactory("API_KEY_", "etherscan", "upper")]
      : process.env[keyFactory("API_KEY_", network, "upper", "SCAN")];
  // console.log("DEBUG apiKey", apiKey);

  if (!apiKey || !apiKey.length) {
    throw new Error(`La clé API Etherscan pour le réseau "${network}" n'est pas définie ou incorrect (${apiKey})`);
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.get(apiUrl, {
        params: {
          module: "block",
          action: "getblocknobytime",
          timestamp: timestamp,
          closest: "before",
          apikey: apiKey,
        },
      });

      if (response.data.status !== "1") {
        throw new Error(`La requête a échoué avec le message : ${response.data.message}`);
      }

      //vérifuer que le block est esgal ou plus grand que le block de déploiement
      const blockNumber = Number(response.data.result);
      return blockNumber >= blockStartREG[network] ? blockNumber : blockStartREG[network];
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      console.error(`La requête (${apiUrl}) a échoué "${attempt}" fois , réessayer dans ${attempt} seconde...`);
      await delay(attempt * 1000);
    }
  }
  throw new Error("Toutes les tentatives de requête pour obtenir le block number a partir d'un timestemp ont échoué");
}

export function keyFactory(
  prefix: string,
  suffix: string,
  caseOption: "lower" | "upper" | "capitalize",
  postSuffix?: string
): string {
  let formattedSuffix;

  switch (caseOption) {
    case "lower":
      formattedSuffix = suffix.toLowerCase();
      break;
    case "upper":
      formattedSuffix = suffix.toUpperCase();
      break;
    case "capitalize":
      formattedSuffix = suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase();
      break;
    default:
      throw new Error(`Option de cas non reconnue : "${caseOption}"`);
  }

  return prefix + formattedSuffix + (postSuffix || "");
}

export function calculateTokenEquivalentBalancer(
  pool: any,
  fromToken: string,
  toToken: string,
  amount: string
): string {
  const fromTokenInfo = pool.tokens.find((token: any) => token.address === fromToken);
  const toTokenInfo = pool.tokens.find((token: any) => token.address === toToken);

  // console.log("DEBUG fromTokenInfo", fromTokenInfo);
  // console.log("DEBUG toTokenInfo", toTokenInfo);
  if (!fromTokenInfo || !toTokenInfo) {
    throw new Error("Token not found in the pool");
  }

  const fromBalance = new BigNumber(fromTokenInfo.balance);
  const fromWeight = new BigNumber(fromTokenInfo.weight);
  const toBalance = new BigNumber(toTokenInfo.balance);
  const toWeight = new BigNumber(toTokenInfo.weight);
  const amountBN = new BigNumber(amount);

  // console.log("DEBUG fromBalance", fromBalance.toString(10));
  // console.log("DEBUG fromWeight", fromWeight.toString(10));
  // console.log("DEBUG toBalance", toBalance.toString(10));
  // console.log("DEBUG toWeight", toWeight.toString(10));
  // console.log("DEBUG amountBN", amountBN.toString(10));

  const price = fromBalance.div(fromWeight).div(toBalance.div(toWeight));
  // console.log("DEBUG price", price.toString(10));
  // console.log("DEBUG amountBN * price", amountBN.div(price).toString(10));
  return amountBN.div(price).toString(10);
}

export function calculateTokenEquivalentTypeUniV3(
  pool: any,
  fromToken: string,
  toToken: string,
  amount: string
): string {
  const token0 = pool.token0.id;
  const token1 = pool.token1.id;
  const sqrtPriceX96 = new BigNumber(pool.sqrtPrice);
  const liquidity = new BigNumber(pool.liquidity);

  let price, amountBN, normalizedAmount;
  if (fromToken === token0 && toToken === token1) {
    price = sqrtPriceX96.pow(2).div(new BigNumber(2).pow(192));
    // Normaliser les montants en fonction des décimales des tokens
    amountBN = new BigNumber(amount).multipliedBy(new BigNumber(10).pow(pool.token0.decimals));
    normalizedAmount = amountBN.multipliedBy(price).div(new BigNumber(10).pow(pool.token1.decimals));
  } else if (fromToken === token1 && toToken === token0) {
    price = new BigNumber(2).pow(192).div(sqrtPriceX96.pow(2));
    // Normaliser les montants en fonction des décimales des tokens
    amountBN = new BigNumber(amount).multipliedBy(new BigNumber(10).pow(pool.token1.decimals));
    normalizedAmount = amountBN.multipliedBy(price).div(new BigNumber(10).pow(pool.token0.decimals));
  } else {
    throw new Error("Tokens do not match the pool");
  }

  return normalizedAmount.toString(10);
}

export async function getTempJsonFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir);
  return files.filter((file) => path.extname(file) === ".json" && file.endsWith("_tmp.json"));
}

export async function getJsonFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir);
  return files.filter((file) => path.extname(file) === ".json" && file.endsWith(".json"));
}

export function formatDate(date: Date, timeZone: string): string {
  return date
    .toLocaleString("fr-FR", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/, "$3-$2-$1T$4h$5mn$6");
}

export function getUtcOffset(date: Date): string {
  const offset = date.getTimezoneOffset() / -60;
  const sign = offset >= 0 ? "+" : "-";
  return `utc${sign}${Math.abs(offset).toString().padStart(2, "0")}`;
}

export function extractBaseName(result: string): string {
  const match = result.match(/\/([^\/]*_)tmp\.json$/);
  return match ? match[1] : "";
}

// Ajoute dans un fichier au début ou a la suite les données passées en paramètre
export function logInFile(filePath: string, data: string, append: boolean = false) {
  const mode = append ? "a" : "w";
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode });
}
