/**
 * Module de récupération des soldes REG
 * Ce module permet d'extraire et de calculer les soldes REG à travers différents réseaux,
 * DEX et portefeuilles pour une période donnée.
 */

import { BigNumber } from "bignumber.js";
import fs, { readFileSync } from "fs";
import path from "path";
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
import { i18n } from "../i18n/index.js";
import { NetworkConfig, TokenInfo } from "../types/dexConfig.types.js";
import { RetourREG } from "../types/REG.types.js";
import {
  createGraphQLClient,
  getRegBalances,
  getRegBalancesByDexs,
  getRegBalancesVaultIncentives,
} from "../utils/graphql.js";
import {
  askChoiseCheckbox,
  askChoiseListe,
  askDateRange,
  askInput,
  askUrls,
  askUseconfirm,
} from "../utils/inquirer.js";
import { readContentFromFile } from "../utils/lib.js";

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

  // Demande de l'adresse à analyser
  const targetAddress = await askInput(
    i18n.t("tasks.getBalancesREG.askTargetAddress"),
    {
      regex: /^(0x[a-fA-F0-9]{40}|all)$/,
      messageEchec: i18n.t("tasks.getBalancesREG.errorInvalidAddress"),
    },
    "all"
  );

  // Conversion des dates en objets Date
  let startDateStr = new Date(`${startDate}T${snapshotTime}:00Z`);
  const endDateStr = new Date(`${endDate}T${snapshotTime}:00Z`);
  const numberOfDays = Math.ceil((endDateStr.getTime() - startDateStr.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const typeSumm = numberOfDays > 1 ? "sum" : "onDay";
  // Boucle principale pour le traitement des données
  while (startDateStr <= endDateStr) {
    const timestamp = Math.floor(startDateStr.getTime() / 1000);

    // Traitement pour chaque réseau sélectionné
    for (const network of networksSelected) {
      console.info(i18n.t("tasks.getBalancesREG.processingTimestamp", { timestamp, date: new Date(timestamp * 1000) }));

      // Traitement des données pour le réseau actuel
      await processNetwork(
        network,
        timestamp,
        allBalancesWallets,
        SelectDex,
        listeSelectedUrlGraph,
        pools_id,
        targetAddress
      );
    }

    // Écriture des données temporaires dans un fichier
    writeTempFile(timestamp, startDateStr, startDate, endDate, snapshotTime, allBalancesWallets, pathFile, typeSumm);

    // Passage au jour suivant
    startDateStr.setDate(startDateStr.getDate() + 1);
  }

  // Si le range est sur plusieurs jours, demander le type de calcul
  if (numberOfDays > 1) {
    const calculationType = await askChoiseListe(i18n.t("tasks.getBalancesREG.askCalculationType"), {
      value: ["sum", "average"],
      name: [i18n.t("tasks.getBalancesREG.calculationTypeSum"), i18n.t("tasks.getBalancesREG.calculationTypeAverage")],
    });

    if (calculationType === "average") {
      // Calcul de la moyenne pour chaque portefeuille
      for (const wallet of allBalancesWallets) {
        calculateAverageBalances(wallet, numberOfDays);
      }
      const timestamp = Math.floor(startDateStr.getTime() / 1000);

      // Écriture des données temporaires dans un fichier
      writeTempFile(timestamp, startDateStr, startDate, endDate, snapshotTime, allBalancesWallets, pathFile, "average");
    }
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
  const mock = await askUseconfirm(i18n.t("tasks.getBalancesREG.askUseMock"), false);
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
    i18n.t("tasks.getBalancesREG.askDexsNetwork"),
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
    const askDexs = await askUseconfirm(`${i18n.t("tasks.getBalancesREG.askDexs")} (${network})`, true);
    if (askDexs) {
      // Si oui, demande quels DEX analyser pour ce réseau
      SelectDex[network] = await askChoiseCheckbox(
        i18n.t("tasks.getBalancesREG.askDexsForNetwork", { network }),
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
  console.info(i18n.t("tasks.getBalancesREG.numberOfHoldersTemporaryFile", { count: result.balances.length }));
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
 * @param targetAddress - Adresse cible à analyser (ou "all" pour toutes les adresses)
 */
async function processNetwork(
  network: Network,
  timestamp: number,
  allBalancesWallets: Array<RetourREG>,
  SelectDex: { [key: string]: string[] },
  listeSelectedUrlGraph: string[],
  pools_id: string[],
  targetAddress: string
) {
  const balancesHolderREG = await fetchBalancesHolderREG(network, timestamp, listeSelectedUrlGraph, targetAddress);
  processWalletBalances(balancesHolderREG, network, allBalancesWallets, pools_id);

  if (network === NETWORK.GNOSIS) {
    await processVaultIncentives(network, timestamp, allBalancesWallets, targetAddress);
  }

  if (SelectDex[network]?.length > 0) {
    await processDexBalances(network, timestamp, SelectDex, allBalancesWallets, targetAddress);
  }
}

/**
 * Récupère les soldes REG des portefeuilles pour un réseau spécifique
 * @param network - Le réseau pour lequel récupérer les soldes (Gnosis, Ethereum, Polygon)
 * @param timestamp - Le timestamp pour lequel récupérer les soldes
 * @param listeSelectedUrlGraph - Liste des URLs GraphQL disponibles pour chaque réseau
 * @param targetAddress - Adresse cible à analyser (ou "all" pour toutes les adresses)
 * @returns Un objet contenant les soldes REG par adresse de portefeuille
 */
async function fetchBalancesHolderREG(
  network: Network,
  timestamp: number,
  listeSelectedUrlGraph: string[],
  targetAddress: string
) {
  // Récupère l'URL GraphQL correspondant au réseau
  const url = await askUrls(
    [listeSelectedUrlGraph[Object.values(NETWORK).indexOf(network as NETWORK)]],
    false,
    i18n.t("tasks.getBalancesREG.askUrlGraphQL", { network })
  );
  console.info(i18n.t("tasks.getBalancesREG.urlGraphQL"), url);

  // Crée un client GraphQL et récupère les soldes
  const client = createGraphQLClient(typeof url === "string" ? url : url[0]);
  return await getRegBalances(client, timestamp, network, targetAddress);
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
  wallet.sourceBalance[network].walletBalance = new BigNumber(wallet.sourceBalance[network].walletBalance)
    .plus(newBalance)
    .toString(10);
}

/**
 * Traite les soldes des incitations de coffre-fort (vault incentives) pour un réseau donné
 * @param network - Le réseau à traiter
 * @param timestamp - Le timestamp pour lequel récupérer les soldes
 * @param allBalancesWallets - Tableau contenant tous les soldes des portefeuilles
 * @param targetAddress - Adresse cible à analyser (ou "all" pour toutes les adresses)
 */
async function processVaultIncentives(
  network: Network,
  timestamp: number,
  allBalancesWallets: Array<RetourREG>,
  targetAddress: string
) {
  // Vérifier et utiliser une URL valide
  const envURL = process.env[`THE_GRAPH_DEV_URL_GOV_${network.toUpperCase()}`] ?? "";
  const urlGraph = /^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/.test(envURL)
    ? envURL
    : theGraphApiUrlsGov[network];

  if (!urlGraph) {
    console.error(i18n.t("utils.lib.errorApiUrlNotFound", { network }));
    return;
  }

  // Création du client GraphQL pour les requêtes
  const client = createGraphQLClient(urlGraph);

  // Récupération des soldes des incitations de coffre-fort
  const balancesVaultIncentives = await getRegBalancesVaultIncentives(client, timestamp, network, targetAddress);

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
            walletBalance: "0",
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
      wallet.sourceBalance[NETWORK.GNOSIS].vaultIncentiveV1 = new BigNumber(
        wallet.sourceBalance[NETWORK.GNOSIS].vaultIncentiveV1
      )
        .plus(vaultIncentiveV1Balance)
        .toString(10);

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
 * @param targetAddress - Adresse cible à analyser (ou "all" pour toutes les adresses)
 */
async function processDexBalances(
  network: Network,
  timestamp: number,
  SelectDex: { [key: string]: string[] },
  allBalancesWallets: Array<RetourREG>,
  targetAddress: string
) {
  // Récupère les soldes des DEX pour le réseau et les DEX sélectionnés
  const balancesDexs = await getRegBalancesByDexs(network, SelectDex[network], timestamp, false, targetAddress);

  // Chargement de la configuration des DEX
  const dexConfigs = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "configs", "dex.json"), "utf-8"));

  // Enregistre les données de débogage si le mode DEBUG est activé
  if (MODE_DEBUG) {
    fs.writeFileSync("debugBalancesDexs.json", JSON.stringify(balancesDexs, null, 2));
  }

  // Parcourt les DEX et leurs pools
  for (const [dex, pools] of Object.entries(balancesDexs)) {
    // Récupère le type de DEX à partir de la configuration
    const dexType = dexConfigs.network[network]?.[dex]?.dexType || "v2";

    for (const pool of pools) {
      // Pour chaque position de liquidité dans le pool
      for (const position of pool.liquidityPositions) {
        const holderAddress = position.user.id;

        // Met à jour le solde DEX pour chaque liquidité
        for (const liquidity of position.liquidity) {
          updateDexBalance(
            network,
            dex as DexValue,
            holderAddress,
            pool.poolId,
            liquidity,
            allBalancesWallets,
            dexType,
            position.positionId
          );
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
 * @param dexType - Type de DEX (v2 ou v3)
 * @param positionId - ID de la position (pour les DEX V3)
 */
function updateDexBalance(
  network: Network,
  dex: DexValue,
  holderAddress: string,
  poolAddress: string,
  liquidity: TokenInfo,
  allBalancesWallets: Array<RetourREG>,
  dexType: "v2" | "v3" = "v2", // Par défaut, on considère que c'est un DEX V2
  positionId?: number
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

  // Vérifier si cette position existe déjà dans le tableau
  // Pour les DEX V3, on vérifie aussi l'ID de position
  const isV3 = dexType === "v3";

  const existingPositionIndex = wallet.sourceBalance[network].dexs![dex].findIndex((pos) => {
    // Condition de base: même pool et même token
    const baseCondition = pos.poolAddress === poolAddress && pos.tokenAddress === liquidity.tokenId;

    // Si c'est un DEX V3 et qu'on a un ID de position, on vérifie aussi l'ID
    if (isV3 && positionId !== undefined) {
      return baseCondition && pos.positionId === positionId;
    }

    return baseCondition;
  });

  if (existingPositionIndex !== -1) {
    // Si la position existe, on additionne les valeurs
    const existingPosition = wallet.sourceBalance[network].dexs![dex][existingPositionIndex];

    // Additionner les balances
    existingPosition.tokenBalance = new BigNumber(existingPosition.tokenBalance)
      .plus(liquidity.tokenBalance ?? "0")
      .toString(10);

    existingPosition.equivalentREG = new BigNumber(existingPosition.equivalentREG)
      .plus(liquidity.equivalentREG ?? "0")
      .toString(10);
  } else {
    // Si la position n'existe pas, on l'ajoute au tableau
    wallet.sourceBalance[network].dexs![dex].push({
      tokenBalance: liquidity.tokenBalance ?? "0",
      tokenSymbol: liquidity.tokenSymbol ?? "undefined",
      tokenAddress: liquidity.tokenId ?? "0x0",
      poolAddress: poolAddress,
      equivalentREG: liquidity.equivalentREG ?? "0",
      positionId: isV3 ? positionId : undefined, // Ajouter l'ID de position uniquement pour les DEX V3
    });
  }

  const isRegToken = liquidity.tokenId === TOKEN_ADDRESS.REG;
  const balanceToAdd = isRegToken ? liquidity.tokenBalance : liquidity.equivalentREG;
  const camelCaseNetwork = network.charAt(0).toUpperCase() + network.slice(1);
  const balanceKey = isRegToken ? `totalBalanceReg${camelCaseNetwork}` : `totalBalanceEquivalentReg${camelCaseNetwork}`;

  wallet[balanceKey] = new BigNumber(wallet[balanceKey]).plus(balanceToAdd).toString(10);

  // Mise à jour conditionnelle de totalBalanceREG et totalBalanceEquivalentREG
  if (isRegToken) {
    wallet.totalBalanceREG = new BigNumber(wallet.totalBalanceREG).plus(balanceToAdd).toString(10);
  } else {
    wallet.totalBalanceEquivalentREG = new BigNumber(wallet.totalBalanceEquivalentREG).plus(balanceToAdd).toString(10);
  }

  // Le totalBalance inclut toujours tout
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
  pathFile: string,
  typeSumm: "sum" | "average" | "onDay"
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
          typeSumm,
        },
      },
      null,
      2
    )
  );
}

/**
 * Calcule la moyenne des soldes sur une période donnée
 * @param wallet - Le portefeuille dont les soldes doivent être moyennés
 * @param numberOfDays - Le nombre de jours de la période
 */
function calculateAverageBalances(wallet: RetourREG, numberOfDays: number) {
  // Moyennes des soldes totaux
  const totalBalanceKeys = [
    "totalBalanceREG",
    "totalBalance",
    "totalBalanceRegGnosis",
    "totalBalanceRegEthereum",
    "totalBalanceRegPolygon",
    "totalBalanceEquivalentRegGnosis",
    "totalBalanceEquivalentRegEthereum",
    "totalBalanceEquivalentRegPolygon",
    "totalBalanceEquivalentREG",
  ] as const;

  for (const key of totalBalanceKeys) {
    wallet[key] = new BigNumber(wallet[key]).dividedBy(numberOfDays).toString(10);
  }

  // Moyennes des soldes par réseau dans sourceBalance
  if (wallet.sourceBalance) {
    for (const network of Object.keys(wallet.sourceBalance)) {
      const networkBalance = wallet.sourceBalance[network as Network];
      if (networkBalance) {
        // Moyenne du solde du portefeuille
        networkBalance.walletBalance = new BigNumber(networkBalance.walletBalance).dividedBy(numberOfDays).toString(10);

        // Moyenne du solde des incentives
        networkBalance.vaultIncentiveV1 = new BigNumber(networkBalance.vaultIncentiveV1)
          .dividedBy(numberOfDays)
          .toString(10);

        // Moyenne des soldes DEX
        if (networkBalance.dexs) {
          for (const dex of Object.keys(networkBalance.dexs)) {
            const dexBalances = networkBalance.dexs[dex as DexValue];
            if (dexBalances) {
              for (const position of dexBalances) {
                position.tokenBalance = new BigNumber(position.tokenBalance).dividedBy(numberOfDays).toString(10);
                position.equivalentREG = new BigNumber(position.equivalentREG).dividedBy(numberOfDays).toString(10);
              }
            }
          }
        }
      }
    }
  }
}
