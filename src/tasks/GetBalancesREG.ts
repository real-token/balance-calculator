/**
 * Module de récupération des soldes REG
 * Ce module permet d'extraire et de calculer les soldes REG à travers différents réseaux,
 * DEX et portefeuilles pour une période donnée.
 */

import { RetourREG } from "../types/REG.types.js";
import {
  DexValue,
  MODE_DEBUG,
  NETWORK,
  Network,
  networkToDexsMap,
  theGraphApiUrlsGov,
  theGraphApiUrlsREG,
  TOKEN_ADDRESS,
} from "../configs/constantes.js";
import fs, { readFileSync } from "fs";
import path from "path";
import { readContentFromFile } from "../utils/lib.js";
import { askChoiseCheckbox, askDateRange, askUrls, askUseconfirm } from "../utils/inquirer.js";
import { BigNumber } from "bignumber.js";
import {
  createGraphQLClient,
  getRegBalances,
  getRegBalancesByDexs,
  getRegBalancesVaultIncentives,
} from "../utils/graphql.js";
import { NetworkConfig, TokenInfo } from "../types/dexConfig.types.js";

const __dirname = new URL(".", import.meta.url).pathname;

/**
 * Fonction principale pour obtenir les soldes REG
 * @param tempData - Données temporaires existantes au format JSON
 * @returns Chemin du fichier contenant les résultats
 */
export async function taskGetBalancesREG(tempData: string): Promise<string> {
  // Configuration initiale
  const { networksSelected, SelectDex, listeSelectedUrlGraph } = await setupNetworksAndDexs();
  const allBalancesWallets = initializeBalances(tempData);
  const pathFile = path.join(__dirname, "..", "..", "outDatas", "balancesREG_tmp.json");
  const { startDate, endDate, snapshotTime } = await setupDateRange(allBalancesWallets, pathFile);
  const pools_id = loadPoolIds();

  // Conversion des dates en objets Date
  let startDateStr = new Date(`${startDate}T${snapshotTime}:00Z`);
  const endDateStr = new Date(`${endDate}T${snapshotTime}:00Z`);

  // Boucle principale pour le traitement des données
  while (startDateStr <= endDateStr) {
    const timestamp = Math.floor(startDateStr.getTime() / 1000);

    // Traitement pour chaque réseau sélectionné
    for (const network of networksSelected) {
      console.info("INFO: Traitement pour le timestamp", timestamp, new Date(timestamp * 1000));

      // Traitement des données pour le réseau actuel
      await processNetwork(network, timestamp, allBalancesWallets, SelectDex, listeSelectedUrlGraph, pools_id);
    }

    // Écriture des données temporaires dans un fichier
    writeTempFile(timestamp, startDateStr, startDate, endDate, snapshotTime, allBalancesWallets, pathFile);

    // Passage au jour suivant
    startDateStr.setDate(startDateStr.getDate() + 1);
  }

  // Retourne le chemin du fichier contenant les résultats
  return pathFile;
}

/**
 * Configure les réseaux et DEX à analyser
 * @returns Configuration des réseaux et DEX sélectionnés
 */
async function setupNetworksAndDexs() {
  // Demande à l'utilisateur s'il souhaite utiliser des données de test
  const mock = await askUseconfirm("Utiliser des données de test mock ? (y/N)", false);
  if (mock) {
    // Si mock est activé, retourne une configuration prédéfinie
    return {
      networksSelected: [NETWORK.GNOSIS],
      SelectDex: networkToDexsMap,
      listeSelectedUrlGraph: [],
    };
  }

  // Demande à l'utilisateur de sélectionner les réseaux à analyser
  const networks = await askChoiseCheckbox(
    "Pour quels réseaux allons-nous extraire les soldes des DEX et portefeuilles ?",
    { name: [...Object.values(NETWORK)], value: [...Object.values(NETWORK)] },
    true
  );

  const networksSelected: Network[] = [];
  const listeSelectedUrlGraph: string[] = [];
  const SelectDex: { [key: string]: string[] } = {};

  // Pour chaque réseau sélectionné
  for (const network of networks) {
    networksSelected.push(network as Network);

    // Détermine l'URL du GraphQL à utiliser
    const envURL = process.env[`THE_GRAPH_DEV_URL_REG_${network.toUpperCase()}`] ?? "";
    const urlGraph = /^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/.test(envURL)
      ? envURL
      : theGraphApiUrlsREG[network as Network];
    listeSelectedUrlGraph.push(urlGraph);

    // Demande à l'utilisateur s'il souhaite extraire les soldes pour les DEX
    const askDexs = await askUseconfirm(`Voulez-vous extraire les soldes pour les DEX ? (Y/n)`, true);
    if (askDexs) {
      // Si oui, demande quels DEX analyser pour ce réseau
      SelectDex[network] = await askChoiseCheckbox(
        `Pour le réseau ${network}, pour quels DEX voulez-vous extraire les soldes ?`,
        { name: networkToDexsMap[network as Network], value: networkToDexsMap[network as Network] },
        true
      );
    } else {
      SelectDex[network] = [];
    }
  }

  return { networksSelected, SelectDex, listeSelectedUrlGraph };
}

/**
 * Initialise le tableau des soldes à partir des données temporaires
 * @param tempData - Données temporaires au format JSON
 * @returns Tableau des soldes initialisé
 */
function initializeBalances(tempData: string): Array<RetourREG> {
  if (tempData === "") return [];
  const { result } = JSON.parse(tempData);
  console.info("Nombre de détenteurs chargés du fichier temporaire:", result.balances.length);
  return result.balances;
}

/**
 * Configure la plage de dates pour l'extraction des soldes
 *
 * Cette fonction permet de :
 * - Déterminer si on doit demander une nouvelle plage de dates
 * - Charger les dates depuis un fichier existant si disponible
 * - Configurer les options de temps pour la requête
 *
 * @param allBalancesWallets - Tableau contenant tous les soldes des portefeuilles
 * @param pathFile - Chemin vers le fichier de configuration
 * @returns Les paramètres de dates configurés
 */
async function setupDateRange(allBalancesWallets: Array<RetourREG>, pathFile: string) {
  // Détermine si on doit sauter la demande de nouvelle date
  const skipAskNewDate = allBalancesWallets.length > 0;

  // Charge le contenu du fichier si nécessaire
  const contentFiles = skipAskNewDate ? readContentFromFile(pathFile) : false;
  const parsed = contentFiles ? JSON.parse(contentFiles as string) : {};

  // Configure les options de temps
  const optionTime = skipAskNewDate
    ? {
        skipAsk: skipAskNewDate,
        startDate: parsed.params.dateStart,
        endDate: parsed.params.dateEnd,
        snapshotTime: parsed.params.snapshotTime,
        currantTimestemp: parsed.params.currantTimestemp,
      }
    : {};

  // Retourne la plage de dates configurée
  return await askDateRange(optionTime);
}

/**
 * Charge et extrait tous les identifiants de pools de liquidité depuis le fichier de configuration des DEX
 * Cette fonction permet de:
 * - Lire le fichier de configuration des DEX
 * - Extraire et aplatir tous les IDs de pools de liquidité dans un tableau unique
 * - Supporter une structure de configuration imbriquée (réseau -> DEX -> pools)
 *
 * @returns {string[]} Un tableau contenant tous les identifiants de pools de liquidité uniques
 */
function loadPoolIds(): string[] {
  // Lecture du fichier de configuration des DEX
  const configs: NetworkConfig = JSON.parse(readFileSync(path.join(__dirname, "..", "configs", "dex.json"), "utf-8"));

  // Extraction et aplatissement des IDs de pools à travers la structure imbriquée
  return Object.values(configs).flatMap((networkConfig) =>
    Object.values(networkConfig).flatMap((dexs) => Object.values(dexs).flatMap((dex) => dex.pool_id.flat()))
  );
}

/**
 * Traite les soldes d'un réseau spécifique
 * @param network - Réseau à traiter
 * @param timestamp - Horodatage pour la requête
 * @param allBalancesWallets - Tableau des soldes de tous les portefeuilles
 * @param SelectDex - Map des DEX sélectionnés par réseau
 * @param listeSelectedUrlGraph - Liste des URLs GraphQL
 * @param pools_id - Liste des IDs des pools de liquidité
 */
async function processNetwork(
  network: Network,
  timestamp: number,
  allBalancesWallets: Array<RetourREG>,
  SelectDex: { [key: string]: string[] },
  listeSelectedUrlGraph: string[],
  pools_id: string[]
) {
  const balancesHolderREG = await fetchBalancesHolderREG(network, timestamp, listeSelectedUrlGraph);
  processWalletBalances(balancesHolderREG, network, allBalancesWallets, pools_id);

  if (network === NETWORK.GNOSIS) {
    await processVaultIncentives(network, timestamp, allBalancesWallets);
  }

  if (SelectDex[network]?.length > 0) {
    await processDexBalances(network, timestamp, SelectDex, allBalancesWallets);
  }
}

/**
 * Récupère les soldes REG des portefeuilles pour un réseau spécifique
 * @param network - Le réseau pour lequel récupérer les soldes (Gnosis, Ethereum, Polygon)
 * @param timestamp - Le timestamp pour lequel récupérer les soldes
 * @param listeSelectedUrlGraph - Liste des URLs GraphQL disponibles pour chaque réseau
 * @returns Un objet contenant les soldes REG par adresse de portefeuille
 */
async function fetchBalancesHolderREG(network: Network, timestamp: number, listeSelectedUrlGraph: string[]) {
  // Récupère l'URL GraphQL correspondant au réseau
  const url = await askUrls(
    [listeSelectedUrlGraph[Object.values(NETWORK).indexOf(network as NETWORK)]],
    false,
    `Quelle URL GraphQL utiliser pour le réseau "${network}" ?`
  );
  console.info("INFO: URL GraphQL", url);

  // Crée un client GraphQL et récupère les soldes
  const client = createGraphQLClient(typeof url === "string" ? url : url[0]);
  return await getRegBalances(client, timestamp, network);
}

/**
 * Traite les soldes des portefeuilles pour un réseau spécifique
 * @param balancesHolderREG - Objet contenant les soldes des portefeuilles
 * @param network - Réseau en cours de traitement
 * @param allBalancesWallets - Tableau contenant tous les soldes des portefeuilles
 * @param pools_id - Liste des IDs des pools de liquidité
 */
function processWalletBalances(
  balancesHolderREG: { [key: string]: string },
  network: Network,
  allBalancesWallets: Array<RetourREG>,
  pools_id: string[]
) {
  for (const [addressHolder, balance] of Object.entries(balancesHolderREG)) {
    if (new BigNumber(balance).isZero()) continue;

    const walletIndex = allBalancesWallets.findIndex(
      (wallet) => wallet.walletAddress.toLowerCase() === addressHolder.toLowerCase()
    );

    if (walletIndex === -1) {
      createNewWalletEntry(addressHolder, network, balance, allBalancesWallets, pools_id);
    } else {
      updateExistingWalletEntry(walletIndex, network, balance, allBalancesWallets);
    }
  }
}

/**
 * Crée une nouvelle entrée de portefeuille dans le tableau des soldes
 * @param addressHolder - Adresse du portefeuille
 * @param network - Réseau concerné
 * @param balance - Solde du portefeuille
 * @param allBalancesWallets - Tableau contenant tous les soldes des portefeuilles
 * @param pools_id - Liste des IDs des pools de liquidité
 */
function createNewWalletEntry(
  addressHolder: string,
  network: Network,
  balance: string,
  allBalancesWallets: Array<RetourREG>,
  pools_id: string[]
) {
  pools_id.push("0xBA12222222228d8Ba445958a75a0704d566BF2C8"); //Add balancer vault
  const newBalance = new BigNumber(balance).shiftedBy(-18).toString(10);
  allBalancesWallets.push({
    walletAddress: addressHolder,
    type: pools_id.includes(addressHolder) ? "liquidityPool" : "wallet",
    totalBalanceRegGnosis: network === NETWORK.GNOSIS ? newBalance : "0",
    totalBalanceRegEthereum: network === NETWORK.ETHEREUM ? newBalance : "0",
    totalBalanceRegPolygon: network === NETWORK.POLYGON ? newBalance : "0",
    totalBalanceEquivalentRegGnosis: "0",
    totalBalanceEquivalentRegEthereum: "0",
    totalBalanceEquivalentRegPolygon: "0",
    totalBalanceEquivalentREG: "0",
    totalBalanceREG: newBalance,
    totalBalance: newBalance,
    sourceBalance: {
      [network]: {
        walletBalance: newBalance,
        vaultIncentiveV1: "0",
        dexs: {},
      },
    },
  });
}

/**
 * Met à jour une entrée de portefeuille existante dans le tableau des soldes
 * @param walletIndex - Index du portefeuille dans le tableau
 * @param network - Réseau concerné
 * @param balance - Nouveau solde à ajouter
 * @param allBalancesWallets - Tableau contenant tous les soldes des portefeuilles
 */
function updateExistingWalletEntry(
  walletIndex: number,
  network: Network,
  balance: string,
  allBalancesWallets: Array<RetourREG>
) {
  const wallet = allBalancesWallets[walletIndex];
  const newBalance = new BigNumber(balance).shiftedBy(-18).toString(10);

  const networkKey = NETWORK[network.toUpperCase() as keyof typeof NETWORK];
  const totalBalanceKey = `totalBalanceReg${networkKey.charAt(0).toUpperCase() + networkKey.slice(1)}`;

  // Mise à jour des soldes totaux
  wallet[totalBalanceKey] = new BigNumber(wallet[totalBalanceKey]).plus(newBalance).toString(10);
  wallet.totalBalanceREG = new BigNumber(wallet.totalBalanceREG).plus(newBalance).toString(10);
  wallet.totalBalance = new BigNumber(wallet.totalBalance).plus(newBalance).toString(10);

  // Mise à jour ou création de l'entrée sourceBalance
  if (!wallet.sourceBalance) {
    wallet.sourceBalance = {};
  }
  if (!wallet.sourceBalance[network]) {
    wallet.sourceBalance[network] = { walletBalance: "0", vaultIncentiveV1: "0", dexs: {} };
  }
  wallet.sourceBalance[network].walletBalance = newBalance;
}

/**
 * Traite les soldes des incitations de coffre-fort (vault incentives) pour un réseau donné
 * @param network - Le réseau à traiter
 * @param timestamp - Le timestamp pour lequel récupérer les soldes
 * @param allBalancesWallets - Tableau contenant tous les soldes des portefeuilles
 */
async function processVaultIncentives(network: Network, timestamp: number, allBalancesWallets: Array<RetourREG>) {
  // Création du client GraphQL pour les requêtes
  const client = createGraphQLClient(process.env.THE_GRAPH_DEV_URL_GOV_GNOSIS ?? theGraphApiUrlsGov[network]);

  // Récupération des soldes des incitations de coffre-fort
  const balancesVaultIncentives = await getRegBalancesVaultIncentives(client, timestamp, network);

  // Traitement de chaque solde d'incitation
  for (const [addressHolder, balance] of Object.entries(balancesVaultIncentives)) {
    const walletIndex = allBalancesWallets.findIndex((wallet) => wallet.walletAddress === addressHolder);
    const vaultIncentiveV1Balance = new BigNumber(balance).shiftedBy(-18).toString(10);

    if (walletIndex === -1) {
      // Création d'une nouvelle entrée avec vaultIncentiveV1 uniquement
      allBalancesWallets.push({
        walletAddress: addressHolder,
        type: "wallet",
        totalBalanceRegGnosis: vaultIncentiveV1Balance,
        totalBalanceRegEthereum: "0",
        totalBalanceRegPolygon: "0",
        totalBalanceEquivalentRegGnosis: "0",
        totalBalanceEquivalentRegEthereum: "0",
        totalBalanceEquivalentRegPolygon: "0",
        totalBalanceEquivalentREG: "0",
        totalBalanceREG: vaultIncentiveV1Balance,
        totalBalance: vaultIncentiveV1Balance,
        sourceBalance: {
          [NETWORK.GNOSIS]: {
            walletBalance: "0", // Important: initialiser à 0
            vaultIncentiveV1: vaultIncentiveV1Balance,
            dexs: {},
          },
        },
      });
    } else {
      // Mise à jour d'une entrée existante
      const wallet = allBalancesWallets[walletIndex];

      // S'assurer que la structure sourceBalance existe
      if (!wallet.sourceBalance) {
        wallet.sourceBalance = {};
      }
      if (!wallet.sourceBalance[NETWORK.GNOSIS]) {
        wallet.sourceBalance[NETWORK.GNOSIS] = {
          walletBalance: "0",
          vaultIncentiveV1: "0",
          dexs: {},
        };
      }

      // Mise à jour du solde vaultIncentiveV1
      wallet.sourceBalance[NETWORK.GNOSIS].vaultIncentiveV1 = vaultIncentiveV1Balance;

      // Mise à jour des soldes totaux
      wallet.totalBalanceRegGnosis = new BigNumber(wallet.totalBalanceRegGnosis)
        .plus(vaultIncentiveV1Balance)
        .toString(10);
      wallet.totalBalanceREG = new BigNumber(wallet.totalBalanceREG).plus(vaultIncentiveV1Balance).toString(10);
      wallet.totalBalance = new BigNumber(wallet.totalBalance).plus(vaultIncentiveV1Balance).toString(10);
    }
  }
}

/**
 * Traite les soldes des DEX pour un réseau donné
 * @param network - Le réseau à traiter
 * @param timestamp - Le timestamp pour lequel récupérer les soldes
 * @param SelectDex - Les DEX sélectionnés pour chaque réseau
 * @param allBalancesWallets - Tableau contenant tous les soldes des portefeuilles
 */
async function processDexBalances(
  network: Network,
  timestamp: number,
  SelectDex: { [key: string]: string[] },
  allBalancesWallets: Array<RetourREG>
) {
  // Récupère les soldes des DEX pour le réseau et les DEX sélectionnés
  const balancesDexs = await getRegBalancesByDexs(network, SelectDex[network], timestamp, false);

  // Enregistre les données de débogage si le mode DEBUG est activé
  if (MODE_DEBUG) {
    fs.writeFileSync("debugBalancesDexs.json", JSON.stringify(balancesDexs, null, 2));
  }

  // Parcourt les DEX et leurs pools
  for (const [dex, pools] of Object.entries(balancesDexs)) {
    for (const pool of pools) {
      // Pour chaque position de liquidité dans le pool
      for (const position of pool.liquidityPositions) {
        const holderAddress = position.user.id;
        // Met à jour le solde DEX pour chaque liquidité
        for (const liquidity of position.liquidity) {
          updateDexBalance(network, dex as DexValue, holderAddress, pool.poolId, liquidity, allBalancesWallets);
        }
      }
    }
  }
}

/**
 * Met à jour le solde d'un DEX pour un portefeuille
 * @param network - Réseau concerné
 * @param dex - DEX concerné
 * @param holderAddress - Adresse du détenteur
 * @param poolAddress - Adresse du pool
 * @param liquidity - Informations de liquidité
 * @param allBalancesWallets - Tableau des soldes
 */
function updateDexBalance(
  network: Network,
  dex: DexValue,
  holderAddress: string,
  poolAddress: string,
  liquidity: TokenInfo,
  allBalancesWallets: Array<RetourREG>
) {
  const walletIndex = allBalancesWallets.findIndex((wallet) => wallet.walletAddress === holderAddress);

  // Si le portefeuille n'existe pas, on le crée avec les structures nécessaires
  if (walletIndex === -1) {
    const newWallet: RetourREG = {
      walletAddress: holderAddress,
      type: "wallet",
      totalBalanceRegGnosis: "0",
      totalBalanceRegEthereum: "0",
      totalBalanceRegPolygon: "0",
      totalBalanceEquivalentRegGnosis: "0",
      totalBalanceEquivalentRegEthereum: "0",
      totalBalanceEquivalentRegPolygon: "0",
      totalBalanceEquivalentREG: "0",
      totalBalanceREG: "0",
      totalBalance: "0",
      sourceBalance: {
        [network]: {
          walletBalance: "0",
          vaultIncentiveV1: "0",
          dexs: {},
        },
      },
    };
    allBalancesWallets.push(newWallet);
  }

  const wallet = allBalancesWallets[walletIndex === -1 ? allBalancesWallets.length - 1 : walletIndex];

  // S'assurer que la structure sourceBalance existe
  if (!wallet.sourceBalance) {
    wallet.sourceBalance = {};
  }

  // S'assurer que la structure pour le réseau existe
  if (!wallet.sourceBalance[network]) {
    wallet.sourceBalance[network] = {
      walletBalance: "0",
      vaultIncentiveV1: "0",
      dexs: {},
    };
  }

  // S'assurer que la structure dexs existe
  if (!wallet.sourceBalance[network].dexs) {
    wallet.sourceBalance[network].dexs = {};
  }

  // S'assurer que le tableau pour le DEX existe
  if (!wallet.sourceBalance[network].dexs![dex]) {
    wallet.sourceBalance[network].dexs![dex] = [];
  }

  // Le reste de la fonction reste inchangé...
  wallet.sourceBalance[network].dexs![dex].push({
    tokenBalance: liquidity.tokenBalance ?? "0",
    tokenSymbol: liquidity.tokenSymbol ?? "undefined",
    tokenAddress: liquidity.tokenId ?? "0x0",
    poolAddress: poolAddress,
    equivalentREG: liquidity.equivalentREG ?? "0",
  });

  const isRegToken = liquidity.tokenId === TOKEN_ADDRESS.REG;
  const balanceToAdd = isRegToken ? liquidity.tokenBalance : liquidity.equivalentREG;
  const camelCaseNetwork = network.charAt(0).toUpperCase() + network.slice(1);
  const balanceKey = isRegToken ? `totalBalanceReg${camelCaseNetwork}` : `totalBalanceEquivalentReg${camelCaseNetwork}`;

  wallet[balanceKey] = new BigNumber(wallet[balanceKey]).plus(balanceToAdd).toString(10);
  wallet.totalBalanceREG = new BigNumber(wallet.totalBalanceREG).plus(balanceToAdd).toString(10);
  wallet.totalBalance = new BigNumber(wallet.totalBalance).plus(balanceToAdd).toString(10);
}

/**
 * Écrit les données temporaires dans un fichier
 * @param timestamp - Horodatage actuel
 * @param currentDate - Date courante
 * @param startDate - Date de début
 * @param endDate - Date de fin
 * @param snapshotTime - Heure du snapshot
 * @param balances - Tableau des soldes
 * @param pathFile - Chemin du fichier de sortie
 */
function writeTempFile(
  timestamp: number,
  currentDate: Date,
  startDate: string,
  endDate: string,
  snapshotTime: string,
  balances: Array<RetourREG>,
  pathFile: string
) {
  fs.writeFileSync(
    pathFile,
    JSON.stringify(
      {
        result: { balances },
        params: {
          currantTimestemp: timestamp,
          dateCurrant: currentDate,
          dateStart: startDate,
          dateEnd: endDate,
          snapshotTime,
        },
      },
      null,
      2
    )
  );
}
