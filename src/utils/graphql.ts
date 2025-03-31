import fs, { readFileSync, writeFileSync } from "fs";
import { DocumentNode } from "graphql";
import { GraphQLClient } from "graphql-request";
import { gql } from "graphql-tag";
import path, { join } from "path";
import {
  DexConfigs,
  DexValue,
  Dexs,
  MAJ_MOCK_DATA,
  Network,
  PRINT_QUERY,
  dexFunctionMap,
  networkToDexsMap,
} from "../configs/constantes.js";
import { i18n } from "../i18n/index.js";
import { DexBalanceResult, ResponseFunctionGetRegBalances } from "../types/dexConfig.types.js";
import { askUseconfirm } from "./inquirer.js";
import { delay, getBlockNumber } from "./lib.js";

const __dirname = new URL(".", import.meta.url).pathname;

interface Token {
  id: string;
  shortName: string;
}

// Définir une interface pour typer l'erreur
interface GraphQLError {
  response?: {
    errors?: Array<{
      message: string;
    }>;
  };
}

interface UniV3Position {
  id: string;
  owner: {
    id: string;
  };
  pool: {
    id: string;
  };
  token0: {
    id: string;
    decimals: number;
    symbol: string;
  };
  token1: {
    id: string;
    decimals: number;
    symbol: string;
  };
  amount0: string;
  amount1: string;
}

/**
 * Création d'un client GraphQL avec une clé API TheGraph
 * @param url
 * @returns
 */
export function createGraphQLClient(url: string): GraphQLClient {
  const apiKey = process.env.THEGRAPH_API_KEY ?? "API-KEY-NOT-FOUND";
  const urlWithApiKey = url.replace("[api-key]", apiKey);
  return new GraphQLClient(urlWithApiKey);
}

/**
 * Lit une requête GraphQL à partir d'un fichier et la parse en DocumentNode.
 * @param filePath - Le chemin vers le fichier GraphQL.
 * @returns La requête GraphQL sous forme de DocumentNode.
 */
export const loadGraphQLQuery = (filePath: string): DocumentNode => {
  const fullPath = path.join(__dirname, "..", "..", filePath);
  try {
    const query = fs.readFileSync(fullPath, "utf-8");
    if (PRINT_QUERY) {
      console.info("Info: Query", query);
    }
    return gql`
      ${query}
    `;
  } catch (error: any) {
    console.error(`Erreur lors de la lecture du fichier GraphQL: ${error.message}`);
    console.info("fullPath:", fullPath);
    throw error;
  }
};

export async function getHoldersOwnRealToken(
  client: GraphQLClient,
  tokenAddresses: string[],
  timestamp: number
): Promise<any> {
  // Construi la requête GraphQL en utilisant les adresses de tokens
  const tokenAddressesQuery = tokenAddresses.map((address) => address);

  // const query = gql`
  // {
  //   tokens(ids: {id_in: [${tokenAddressesQuery}]}) {
  //     shortName
  //     balances(filters: {timestamp: ${timestamp}}) {
  //       addressHolder
  //       total
  //     }
  //   }
  // }
  //   `;

  const query = loadGraphQLQuery("src/graphql/holdersOwnRealtoken.graphql");
  const requestBody = {
    query: query.loc?.source.body ?? "", // Utiliser le corps de la requête
    variables: {
      tokenAddressesQuery,
      timestamp,
    },
  };
  console.info("Info: Start client.request(query)");
  console.time("client.request");
  const data = await makeRequestWithRetry(client, requestBody)
    .then((response) => {
      // Gérer la réponse
      return response;
    })
    .catch((error) => {
      console.error(`La requête a échoué après 3 tentatives :`, error);
    });
  console.info("Info: End client.request(query)");
  console.timeEnd("client.request");

  return data;
}

export async function getRegBalances(
  client: GraphQLClient,
  timestamp: number,
  network: Network,
  targetAddress: string = "all"
): Promise<{ [key: string]: string }> {
  let currentAddressWallet = "0x0000000000000000000000000000000000000000";
  let allData = {};
  const first = 1000;
  const blockNumber = await getBlockNumber(timestamp, network);
  const paramBlockNumber = { number: blockNumber };
  const balance_gt = 0;

  // Si une adresse cible est spécifiée, on la met dans un tableau pour le filtre id_in
  const targetAddressFilter = targetAddress.toLowerCase() === "all" ? [] : [targetAddress.toLowerCase()];

  //Boucle qui permet de récupérer toutes les adresses de wallet avec un solde supérieur à 0 (par 1000)
  while (true) {
    const query = loadGraphQLQuery("src/graphql/balancesREG.graphql");

    const queryBody =
      targetAddressFilter.length == 0
        ? query.loc?.source.body.replace(", id_in: $targetAddress", "")
        : query.loc?.source.body;

    const requestBody = {
      query: queryBody ?? "", // Utiliser le corps de la requête
      variables: {
        first,
        paramBlockNumber,
        currentAddressWallet,
        balance_gt,
        targetAddress: targetAddressFilter,
      },
    };

    // console.debug("requestBody", requestBody);
    console.info(i18n.t("utils.graphql.infoQueryStart", { startWallet: currentAddressWallet }));
    console.time("client.request");

    const response = await makeRequestWithRetry(client, requestBody)
      .then((response) => {
        // Gérer la réponse
        return response;
      })
      .catch((error) => {
        console.error(`La requête a échoué après 3 tentatives :`, error);
      });
    console.info(i18n.t("utils.graphql.infoQueryEnd"));
    console.timeEnd("client.request");

    // console.debug("response", response);

    const accounts = response.accounts;
    allData = accounts.reduce((acc: { [x: string]: any }, account: { id: string | number; balance: string }) => {
      acc[account.id] = account.balance;
      return acc;
    }, allData);

    // Si on filtre par adresse spécifique, on peut sortir de la boucle après la première itération
    if (targetAddressFilter.length > 0 || accounts.length < first) {
      break;
    }

    currentAddressWallet = accounts[accounts.length - 1].id;
  }

  if (MAJ_MOCK_DATA) {
    console.info(i18n.t("utils.graphql.infoQueryMockData"));
    const path = join(__dirname, "..", "mocks", `balancesREG.json`);
    writeFileSync(path, JSON.stringify(allData, null, 2));
  }
  return allData;
}

export async function getRegBalancesByDexs(
  network: Network,
  dexs: Dexs,
  timestamp?: number | undefined,
  mock?: boolean,
  targetAddress: string = "all"
): Promise<DexBalanceResult> {
  const result: DexBalanceResult = {};
  const first = 1000;

  const configs = JSON.parse(readFileSync(join(__dirname, "..", "configs", "dex.json"), "utf-8"));

  for (const dex of dexs) {
    if (networkToDexsMap[network].includes(dex)) {
      console.info(i18n.t("utils.graphql.infoDexProcessing", { dex, network }));
      console.time(i18n.t("utils.graphql.timeQuery", { dex, network }));

      // Obtenez la fonction appropriée pour le DEX actuel
      const getRegBalancesFunction = dexFunctionMap[dex as DexValue];

      // Vérifiez si la fonction existe
      if (!(typeof getRegBalancesFunction === "function")) {
        console.warn(i18n.t("utils.graphql.warnNoFunctionForDex", { dex }));
        result[dex] = [];
        continue;
      }

      result[dex] = await getRegBalancesFunction(
        configs.network[network][dex],
        network,
        timestamp,
        mock,
        targetAddress
      );
      console.timeEnd(i18n.t("utils.graphql.timeQuery", { dex, network }));
    } else {
      console.error(i18n.t("utils.graphql.errorDexOrNetworkNotFound", { dex, network }));
    }
  }
  return result;
}

export async function getRegBalancesVaultIncentives(
  client: GraphQLClient,
  timestamp: number,
  network: Network,
  targetAddress: string = "all"
): Promise<{ [key: string]: string }> {
  let currentAddressWallet = "0x0000000000000000000000000000000000000000";
  let allData = {};
  const first = 1000;
  const blockNumber = await getBlockNumber(timestamp, network);
  const paramBlockNumber = { number: blockNumber };
  const balance_gt = 0;

  // Si une adresse cible est spécifiée, on la met dans un tableau pour le filtre id_in
  const targetAddressFilter = targetAddress.toLowerCase() === "all" ? [] : [targetAddress.toLowerCase()];

  //Boucle qui permet de récupérer toutes les adresses de wallet avec un solde supérieur à 0 (par 1000)
  while (true) {
    const query = loadGraphQLQuery("src/graphql/balancesVaultIncentives.graphql");
    const queryBody =
      targetAddressFilter.length == 0
        ? query.loc?.source.body.replace(", id_in: $targetAddress", "")
        : query.loc?.source.body;

    const requestBody = {
      query: queryBody ?? "", // Utiliser le corps de la requête
      variables: {
        first,
        paramBlockNumber,
        currentAddressWallet,
        balance_gt,
        targetAddress: targetAddressFilter,
      },
    };
    console.info(i18n.t("utils.graphql.infoQueryStart"), { startWallet: currentAddressWallet });
    console.time("client.request");
    const response = await makeRequestWithRetry(client, requestBody)
      .then((response) => {
        // Gérer la réponse
        return response;
      })
      .catch((error) => {
        console.error(`La requête a échoué après 3 tentatives :`, error);
      });
    console.info(i18n.t("utils.graphql.infoQueryEnd"));
    console.timeEnd("client.request");

    const accounts = response.userGlobalStates;
    allData = accounts.reduce((acc: { [x: string]: any }, account: { id: string | number; currentDeposit: string }) => {
      acc[account.id] = account.currentDeposit;
      return acc;
    }, allData);

    // Si on filtre par adresse spécifique, on peut sortir de la boucle après la première itération
    if (targetAddressFilter.length > 0 || accounts.length < first) {
      break;
    }

    currentAddressWallet = accounts[accounts.length - 1].id;
  }
  if (MAJ_MOCK_DATA) {
    console.info(i18n.t("utils.graphql.infoQueryMockData"));
    const path = join(__dirname, "..", "mocks", `balancesVaultIncentivesREG.json`);
    writeFileSync(path, JSON.stringify(allData, null, 2));
  }
  return allData;
}

export async function fetchBalancesByTokenAddress(
  client: GraphQLClient,
  tokenAddresses: string[],
  timestamp: number
): Promise<any> {
  // Construisez votre requête GraphQL en utilisant les adresses de tokens
  const tokenAddressesQuery = tokenAddresses.map((address) => `"${address}"`).join(",");

  const query = `
  {
    tokens(ids: {id_in: [${tokenAddressesQuery}]}) {
      id
      shortName
      balances(filters: {timestamp: ${timestamp}}) {
        id
        addressHolder
        finalized {
          total
          onChain {
            chainId
            externals {
              platform
              addressContract
              balance
            }
          }
        }
      }
    }
  }
    `;
  console.info(i18n.t("utils.graphql.infoQueryStart"));
  const data = await makeRequestWithRetry(client, query)
    .then((response) => {
      // Gérer la réponse
      return response;
    })
    .catch((error) => {
      console.error(`${i18n.t("utils.graphql.errorQueryFailed")}`, error);
    });
  console.info(i18n.t("utils.graphql.infoQueryEnd"));
  console.timeEnd("client.request");

  return data;
}

export async function getListTokensUUID(client: GraphQLClient): Promise<Array<[string, string]>> {
  const query = loadGraphQLQuery("src/graphql/listTokensUUID.graphql");
  const requestBody = {
    query: query.loc?.source.body ?? "", // Utiliser le corps de la requête
    variables: {},
  };
  const data = await makeRequestWithRetry(client, requestBody)
    .then((response) => {
      // Gérer la réponse
      return response;
    })
    .catch((error) => {
      console.error(`${i18n.t("utils.graphql.errorQueryFailed")}`, error);
    });
  console.info(i18n.t("utils.graphql.infoQueryEnd"));
  console.timeEnd("client.request");

  // Assurez-vous que cette ligne correspond à la structure de votre réponse GraphQL
  return data.tokens.map((token: any) => [token.id, token.shortName]);
}

export async function makeRequestWithRetry(
  client: GraphQLClient,
  query: any,
  retries: number = 3,
  delayTime: number = 2000
): Promise<any> {
  let response;
  try {
    // console.log("makeRequestWithRetry bearer", query?.bearer);
    // console.log("makeRequestWithRetry document", query.query);
    // console.log("makeRequestWithRetry variables", query.variables);
    //console.log("makeRequestWithRetry client", JSON.stringify(client, null, 2));
    const headers = query?.bearer ? { Authorization: query?.bearer } : undefined;
    response = await client.request({
      document: query.query,
      variables: query.variables,
      requestHeaders: headers,
    });
  } catch (error: unknown) {
    if (typeof error === "string") {
      console.error("makeRequestWithRetry error", error);
    }
    const graphQLError = error as GraphQLError;
    console.error("graphQLError", JSON.stringify(graphQLError, null, 2));
    if (retries === 1) {
      console.error("Client", JSON.stringify(client, null, 2));
      console.error("Query", query);
      // Vérifier si l'erreur est due à une désynchronisation du graph
      const errorMessage = graphQLError?.response?.errors?.[0]?.message;
      const blockNumberMatch = errorMessage?.match(/indexed up to block number (\d+)/);
      const requestedBlockNumberMatch = errorMessage?.match(/data for block number (\d+)/);

      if (blockNumberMatch && requestedBlockNumberMatch) {
        const indexedBlockNumber = blockNumberMatch[1];
        const requestedBlockNumber = requestedBlockNumberMatch[1];
        console.info(
          `${i18n.t("utils.graphql.errorGraphNotSync", {
            indexedBlockNumber,
            requestedBlockNumber,
            difference: Number(requestedBlockNumber) - Number(indexedBlockNumber),
          })}`
        );
      }

      if (await askUseconfirm(i18n.t("utils.graphql.askRetry"), false)) {
        return await makeRequestWithRetry(client, query, 5, 2000);
      }
      throw error;
    }
    console.error(
      `${i18n.t("utils.graphql.errorQueryFailedAfterRetry", {
        retries: retries - 1,
        delayTime: delayTime / 1000,
      })}`,
      JSON.stringify(client, null, 2)
    );
    await delay(delayTime);
    return await makeRequestWithRetry(client, query, retries - 1, delayTime * 2);
  }
  return response;
}

export async function getRegBalancesUniV3(
  dexConfigs: DexConfigs,
  network: Network,
  timestamp?: number,
  mock?: boolean,
  targetAddress: string = "all"
): Promise<ResponseFunctionGetRegBalances[]> {
  let currentAddressWallet = "0x0000000000000000000000000000000000000000";
  let allData: ResponseFunctionGetRegBalances[] = [];
  const first = 1000;
  const blockNumber = await getBlockNumber(timestamp, network);
  const paramBlockNumber = { number: blockNumber };
  const balance_gt = 0;

  // Création du client GraphQL
  const client = createGraphQLClient(dexConfigs.graphUrl);

  // Si une adresse cible est spécifiée, on la met dans un tableau pour le filtre owner_in
  const targetAddressFilter = targetAddress.toLowerCase() === "all" ? [] : [targetAddress.toLowerCase()];

  //Boucle qui permet de récupérer toutes les adresses de wallet avec un solde supérieur à 0 (par 1000)
  while (true) {
    const query = loadGraphQLQuery("src/graphql/positionsUniV3.graphql");
    const queryBody =
      targetAddressFilter.length == 0
        ? query.loc?.source.body.replace(", owner_in: $targetAddress", "")
        : query.loc?.source.body;

    const requestBody = {
      query: queryBody ?? "", // Utiliser le corps de la requête
      variables: {
        first,
        paramBlockNumber,
        currentAddressWallet,
        balance_gt,
        targetAddress: targetAddressFilter,
      },
    };
    console.info(i18n.t("utils.graphql.infoQueryStart"), { startWallet: currentAddressWallet });
    console.time("client.request");
    const response = await makeRequestWithRetry(client, requestBody)
      .then((response) => {
        // Gérer la réponse
        return response;
      })
      .catch((error) => {
        console.error(`La requête a échoué après 3 tentatives :`, error);
      });
    console.info(i18n.t("utils.graphql.infoQueryEnd"));
    console.timeEnd("client.request");

    const positions = response.positions as UniV3Position[];

    // Filtrer les positions par adresse si nécessaire
    // const filteredPositions = targetAddressFilter
    //   ? positions.filter((position: UniV3Position) => position.owner.id.toLowerCase() === targetAddress.toLowerCase())
    //   : positions;

    // Structurer les données selon le format attendu
    const formattedPositions: ResponseFunctionGetRegBalances[] = positions.map((position: UniV3Position) => ({
      poolId: position.pool.id,
      dexName: "UniV3",
      liquidityPositions: [
        {
          user: {
            id: position.owner.id,
          },
          liquidity: [
            {
              tokenId: position.token0.id,
              tokenDecimals: position.token0.decimals,
              tokenSymbol: position.token0.symbol,
              tokenBalance: position.amount0,
              equivalentREG: "0", // À calculer si nécessaire
            },
            {
              tokenId: position.token1.id,
              tokenDecimals: position.token1.decimals,
              tokenSymbol: position.token1.symbol,
              tokenBalance: position.amount1,
              equivalentREG: "0", // À calculer si nécessaire
            },
          ],
        },
      ],
    }));

    allData = [...allData, ...formattedPositions];

    // Si on filtre par adresse spécifique, on peut sortir de la boucle après la première itération
    if (targetAddressFilter.length > 0 || positions.length < first) {
      break;
    }

    currentAddressWallet = positions[positions.length - 1].id;
  }

  if (MAJ_MOCK_DATA) {
    console.info(i18n.t("utils.graphql.infoQueryMockData"));
    const path = join(__dirname, "..", "mocks", `balancesUniV3REG.json`);
    writeFileSync(path, JSON.stringify(allData, null, 2));
  }
  return allData;
}
