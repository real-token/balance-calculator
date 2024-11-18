import { BigNumber } from "bignumber.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { DocumentNode, OperationDefinitionNode, print } from "graphql";
import { join } from "path";
import { DexConfigs, MAJ_MOCK_DATA, Network, TOKEN_ADDRESS } from "../configs/constantes.js";
import { i18n } from "../i18n/index.js";
import { ResponseFunctionGetRegBalances } from "../types/dexConfig.types.js";
import { createGraphQLClient, loadGraphQLQuery, makeRequestWithRetry } from "./graphql.js";
import {
  calculateTokenEquivalentBalancer,
  calculateTokenEquivalentTypeUniV3,
  getBlockNumber,
  splitIntoChunks,
} from "./lib.js";

const __dirname = new URL(".", import.meta.url).pathname;

//TODO améliorer les types pour remplacer les any

/**
 * Type représentant la réponse de l'API GraphQL de SushiSwap V3
 * @typedef {Object} ResponseSushiSwapV3GraphALL
 * @property {Object} data - Les données retournées par l'API
 * @property {any} data.pools - Les informations sur les pools de liquidité
 * @property {any} data.positions - Les informations sur les positions des utilisateurs
 */
type ResponseSushiSwapV3GraphALL = { data: { pools: any; positions: any } };

/**
 * Type représentant une position de liquidité sur SushiSwap V3
 * @typedef {Object} PositionSushiSwapV3
 * @property {string} id - Identifiant unique de la position
 * @property {string} owner - Adresse du propriétaire de la position
 * @property {Object} tickLower - Borne inférieure du tick de prix
 * @property {string} tickLower.tickIdx - Index du tick inférieur
 * @property {Object} tickUpper - Borne supérieure du tick de prix
 * @property {string} tickUpper.tickIdx - Index du tick supérieur
 * @property {string} liquidity - Montant de liquidité dans la position
 * @property {Object} pool - Informations sur le pool
 * @property {string} pool.id - Identifiant unique du pool
 */
type PositionSushiSwapV3 = {
  id: string;
  owner: string;
  tickLower: {
    tickIdx: string;
  };
  tickUpper: {
    tickIdx: string;
  };
  liquidity: string;
  pool: {
    id: string;
  };
};

/**
 * Récupère les balances REG sur HoneySwap.
 *
 * Cette fonction interroge l'API GraphQL de HoneySwap pour obtenir les positions de liquidité
 * des utilisateurs dans les pools contenant du REG. Elle peut utiliser des données mockées
 * pour les tests ou le développement.
 *
 * @param {DexConfigs} dexConfigs - Configurations pour HoneySwap (URLs, IDs des pools, etc.)
 * @param {Network} network - Le réseau sur lequel effectuer la requête (ex: Gnosis)
 * @param {number} [timestamp] - Timestamp optionnel pour obtenir les données à un moment précis
 * @param {boolean} [mock] - Si vrai, utilise des données mockées au lieu d'interroger l'API
 *
 * @returns {Promise<ResponseFunctionGetRegBalances[]>} Un tableau de positions de liquidité formatées
 *
 * @throws {Error} Si la requête à l'API échoue après plusieurs tentatives
 */
export async function getRegBalancesHoneySwap(
  dexConfigs: DexConfigs,
  network: Network,
  timestamp?: number | undefined,
  mock?: boolean
): Promise<ResponseFunctionGetRegBalances[]> {
  if (mock) {
    console.info(i18n.t("utils.queryDexs.infoUseMockData", { dex: "HoneySwap" }));
    const data = JSON.parse(readFileSync(join(__dirname, "..", "mocks", `${dexConfigs.mockData}`), "utf-8"));
    return responseformaterHoneySwap(data);
  }

  console.info(i18n.t("utils.queryDexs.infoQueryStart", { dex: "HoneySwap" }));
  if (dexConfigs === undefined) {
    console.info(i18n.t("common.queryDexs.infoDexOrNetworkNotFound", { network }));
    return [];
  }

  const client = createGraphQLClient(dexConfigs.graphUrl);
  const blockNumber = await getBlockNumber(timestamp, network);
  const paramBlockNumber = { number: blockNumber };
  const first = 1000;
  const batchs_pool_ids = splitIntoChunks(dexConfigs.pool_id, first);
  const result: any = [];
  const query = loadGraphQLQuery("src/graphql/balancesHoneySwap.graphql");

  for (const pool_id of batchs_pool_ids) {
    const requestBody = {
      query: query.loc?.source.body ?? "",
      variables: { first, paramBlockNumber, pool_id },
    };

    console.info(i18n.t("utils.queryDexs.infoQueryStart", { dex: "HoneySwap" }));
    console.time("Durée de la requête");

    try {
      const response = await makeRequestWithRetry(client, requestBody);
      result.push(...response.pairs);
    } catch (error) {
      console.error(i18n.t("common.queryDexs.errorQueryFailed"), error);
      throw error;
    }

    console.info(i18n.t("utils.queryDexs.infoQueryEnd", { dex: "HoneySwap" }));
    console.timeEnd("Durée de la requête");
  }

  return responseformaterHoneySwap(result);
}

/**
 * Formate la réponse des paires HoneySwap pour correspondre à la structure attendue.
 *
 * @param {any} pairs - Les données brutes des paires HoneySwap.
 * @returns {ResponseFunctionGetRegBalances[]} Un tableau d'objets formatés contenant les informations de liquidité.
 *
 * @description
 * Cette fonction prend les données brutes des paires HoneySwap et les transforme en un format standardisé.
 * Elle calcule les positions de liquidité pour chaque utilisateur, y compris les soldes de jetons et leurs équivalents en REG.
 * Si MAJ_MOCK_DATA est vrai, elle met également à jour le fichier mock avec les nouvelles données.
 *
 * @example
 * const rawPairs = [...]; // Données brutes des paires HoneySwap
 * const formattedResponse = responseformaterHoneySwap(rawPairs);
 */
function responseformaterHoneySwap(pairs: any): ResponseFunctionGetRegBalances[] {
  if (MAJ_MOCK_DATA) {
    console.info(i18n.t("utils.queryDexs.infoMajMockData"));
    // const dataMaj = { data: { pairs: pairs } };
    const path = join(__dirname, "..", "mocks", `honeyswap.json`);
    writeFileSync(path, JSON.stringify(pairs, null, 2));
  }

  return pairs.map((pair: any) => {
    const totalSupply = pair.totalSupply;
    return {
      poolId: pair.id as string,
      dexName: "HoneySwap",
      liquidityPositions: pair.liquidityPositions.map((liquidityPosition: any) => {
        const userLiquidityTokenBalance = liquidityPosition.liquidityTokenBalance;
        const userLiquidityPercentage = userLiquidityTokenBalance / totalSupply;
        const tokenBalance0 = new BigNumber(pair.reserve0).multipliedBy(userLiquidityPercentage).toString(10);
        const tokenBalance1 = new BigNumber(pair.reserve1).multipliedBy(userLiquidityPercentage).toString(10);
        return {
          user: {
            id: liquidityPosition.user.id as string,
          },
          liquidity: [
            {
              tokenId: pair.token0.id as string,
              tokenDecimals: pair.token0.decimals as number,
              tokenSymbol: pair.token0.symbol as string,
              tokenBalance: tokenBalance0,
              equivalentREG:
                pair.token0.id === TOKEN_ADDRESS.REG
                  ? tokenBalance0
                  : new BigNumber(pair.reserve0)
                      .multipliedBy(pair.token1Price)
                      .multipliedBy(userLiquidityPercentage)
                      .toString(10),
            },
            {
              tokenId: pair.token1.id as string,
              tokenDecimals: pair.token1.decimals as number,
              tokenSymbol: pair.token1.symbol as string,
              tokenBalance: tokenBalance1,
              equivalentREG:
                pair.token1.id === TOKEN_ADDRESS.REG
                  ? tokenBalance1
                  : new BigNumber(pair.reserve1)
                      .multipliedBy(pair.token0Price)
                      .multipliedBy(userLiquidityPercentage)
                      .toString(10),
            },
          ],
        };
      }),
    };
  });
}

/**
 * Récupère les soldes REG sur Balancer pour un réseau donné.
 *
 * @param dexConfigs - Configuration du DEX Balancer
 * @param network - Réseau sur lequel effectuer la requête
 * @param timestamp - Horodatage optionnel pour obtenir les données à un moment spécifique
 * @param mock - Indique s'il faut utiliser des données simulées
 * @returns Une promesse résolvant en un tableau de ResponseFunctionGetRegBalances
 */
export async function getRegBalancesBalancer(
  dexConfigs: DexConfigs,
  network: Network,
  timestamp?: number | undefined,
  mock?: boolean
): Promise<ResponseFunctionGetRegBalances[]> {
  if (mock) {
    console.info(i18n.t("utils.queryDexs.infoUseMockData", { dex: "Balancer" }));
    let data: any;
    if (dexConfigs?.mockData && existsSync(join(__dirname, "..", "mocks", `${dexConfigs?.mockData}`))) {
      data = JSON.parse(readFileSync(join(__dirname, "..", "mocks", `${dexConfigs.mockData}`), "utf-8"));
    } else {
      console.warn(
        `WARNING: getRegBalancesBalancer -> dexConfigs.mockData "${dexConfigs?.mockData}", le fichier correspondant n'existe pas.`
      );
      data = []; // assigner une valeur vide à data
    }
    return responseformaterBalancer(data);
  }
  console.info(i18n.t("utils.queryDexs.infoQueryStart", { dex: "Balancer" }));

  if (dexConfigs === undefined) {
    console.info(`INFO: getRegBalancesBalancer -> dexConfigs is undefined for "${network}"`);
    return [];
  }

  const client = createGraphQLClient(dexConfigs.graphUrl);
  const blockNumber = await getBlockNumber(timestamp, network);
  const paramBlockNumber = { number: blockNumber };
  const first = 1000;
  const batchs_pool_ids = splitIntoChunks(dexConfigs.pool_id, first);
  const result: any = [];
  const query = loadGraphQLQuery("src/graphql/balancesBalancer.graphql");

  for (const pool_id of batchs_pool_ids) {
    const requestBody = {
      query: query.loc?.source.body ?? "", // Utiliser le corps de la requête
      variables: {
        first,
        paramBlockNumber,
        pool_id,
      },
    };
    console.info(i18n.t("utils.queryDexs.infoQueryStart", { dex: "Balancer" }));
    console.time("client.request");
    const response = await makeRequestWithRetry(client, requestBody, 10, 5000)
      .then((response) => {
        // Gérer la réponse
        return response;
      })
      .catch((error) => {
        console.error(i18n.t("common.queryDexs.errorQueryFailed"), error);
      });
    console.info(i18n.t("utils.queryDexs.infoQueryEnd", { dex: "Balancer" }));
    console.timeEnd("client.request");
    result.push(...response.balancers.flatMap((balancer: { pools: any }) => balancer.pools));
  }

  return responseformaterBalancer(result);
}

/**
 * Formate la réponse de l'API Balancer en un format standardisé.
 *
 * @param pairs - Données brutes des paires de tokens
 * @returns Un tableau de ResponseFunctionGetRegBalances formaté
 */
function responseformaterBalancer(pairs: any): ResponseFunctionGetRegBalances[] {
  if (MAJ_MOCK_DATA) {
    console.info(i18n.t("utils.queryDexs.infoMajMockData"));
    const path = join(__dirname, "..", "mocks", `balancer.json`);
    writeFileSync(path, JSON.stringify(pairs, null, 2));
  }

  return pairs.map((pair: any) => {
    const totalSupply = pair.totalShares;

    return {
      poolId: pair.address as string,
      dexName: "Balancer",
      liquidityPositions: pair.shares.map((share: any) => {
        const userLiquidityPercentage = share.balance / totalSupply;
        return {
          user: {
            id: share.userAddress.id as string,
          },
          liquidity: pair.tokens.map((token: any) => {
            const tokenBalance = new BigNumber(token.balance).multipliedBy(userLiquidityPercentage).toString(10);

            // Calculer l'équivalent REG si autre token si non met la blance REG
            let equivalentREG = "0";
            if (token.address === TOKEN_ADDRESS.REG) {
              equivalentREG = tokenBalance;
            } else {
              try {
                equivalentREG = calculateTokenEquivalentBalancer(pair, token.address, TOKEN_ADDRESS.REG, tokenBalance);
              } catch (error) {
                console.error(i18n.t("utils.queryDexs.errorCalculateTokenEquivalent", { token: token.symbol }));
              }
            }

            return {
              tokenId: token.address as string,
              tokenDecimals: token.decimals as number,
              tokenSymbol: token.symbol as string,
              tokenBalance: tokenBalance,
              equivalentREG: equivalentREG,
            };
          }),
        };
      }),
    };
  });
}

/**
 * Appel spécial pour les pools de type uniswap v3
 * utilisation d'une fonction générique pour récupérer les données
 */

/**
 * Fonction générique pour récupérer les données des pools de type uniswap v3
 * @param dexConfigs
 * @param network
 * @param dexName
 * @param timestamp
 * @param mock
 * @returns
 */
async function getRegBalancesTypeUniV3(
  dexConfigs: DexConfigs,
  network: Network,
  dexName: string,
  timestamp?: number | undefined,
  mock?: boolean
): Promise<ResponseFunctionGetRegBalances[]> {
  {
    if (mock) {
      console.info(i18n.t("utils.queryDexs.infoUseMockData", { dex: dexName }));
      let data: ResponseSushiSwapV3GraphALL;
      if (dexConfigs?.mockData && existsSync(join(__dirname, "..", "mocks", `${dexConfigs.mockData}`))) {
        data = JSON.parse(readFileSync(join(__dirname, "..", "mocks", `${dexConfigs.mockData}`), "utf-8"));
      } else {
        console.warn(i18n.t("utils.queryDexs.warnFileNotFound", { dexName, filePath: dexConfigs.mockData }));
        data = { data: { pools: [], positions: [] } }; // assigner une valeur vide à data
      }
      return responseformaterTypeUniV3(data, dexConfigs, dexName);
    }

    console.info(i18n.t("utils.queryDexs.infoQueryStart", { dex: dexName }));

    if (dexConfigs === undefined) {
      console.info(i18n.t("utils.queryDexs.infoGetRegBalances", { dexName, network }));
      return [];
    }

    const first = 1000;
    const batchs_pool_ids = splitIntoChunks(dexConfigs.pool_id, first);
    const POOLs_ID = dexConfigs.pool_id;

    const result: ResponseSushiSwapV3GraphALL = {
      data: { pools: [], positions: [] },
    };
    const client = createGraphQLClient(dexConfigs.graphUrl);
    const blockNumber = await getBlockNumber(timestamp, network);
    const paramBlockNumber = { number: blockNumber };

    const queryDocument = loadGraphQLQuery("src/graphql/balancesTypeUniV3.graphql") as DocumentNode;

    const getQueryBody = (operationName: string): string => {
      const operation = queryDocument.definitions.find(
        (def): def is OperationDefinitionNode => def.kind === "OperationDefinition" && def.name?.value === operationName
      );
      if (!operation) {
        throw new Error(i18n.t("utils.queryDexs.errorQueryNotFound", { operationName }));
      }
      return print(operation);
    };
    const fieldsSearch = dexName === "SushiSwap" ? "fee" : "feeTier";
    const poolsQueryBody = getQueryBody("getPoolsTypeUniV3").replace(fieldsSearch, "");
    const positionsQueryBody = getQueryBody("getPositionsTypeUniV3");

    // console.log("queries", queryDocument);
    // console.log("poolsQuery", poolsQueryBody);
    // console.log("positionsQuery", positionsQueryBody);
    for (const pool_id of batchs_pool_ids) {
      const poolsRequestBody = {
        query: poolsQueryBody,
        variables: {
          first,
          paramBlockNumber,
          pool_id,
        },
      };
      // get pools info
      const dataPools: any = await makeRequestWithRetry(client, poolsRequestBody)
        .then((data) => {
          return data;
        })
        .catch((error) => {
          console.error(i18n.t("utils.queryDexs.errorQueryPool", { pool_id }), error);
        });

      if (dataPools.pools.length === 0) {
        console.error(i18n.t("utils.queryDexs.errorPoolNotFound", { pool_id }));
        //throw new Error("pool not found");
        continue;
      }
      //console.log("dataPools", dataPools.pools);
      result.data.pools.push(...dataPools.pools);

      const dataAllPositions = async () => {
        let positions_id = "0";
        const dataResult: any = { positions: [] };
        while (true) {
          const positionsRequestBody = {
            query: positionsQueryBody,
            variables: {
              first,
              paramBlockNumber,
              positions_id,
              pool_id,
            },
          };

          const data = await makeRequestWithRetry(client, positionsRequestBody)
            .then((data) => {
              return data;
            })
            .catch((error) => {
              console.error(i18n.t("utils.queryDexs.errorQueryPosition", { pool_id }), error);
            });

          // console.log("DEBUG data.positions", data.positions);
          positions_id = data.positions[data.positions.length - 1]?.id ?? "0";
          dataResult.positions.push(...data.positions);
          if (data.positions.length < first) break;
        }

        return dataResult;
      };

      const dataPositions: any = await dataAllPositions();
      // console.log("dataPositions");
      // console.dir(dataPositions, { depth: null });
      if (dataPositions.positions.length === 0) {
        console.info(i18n.t("utils.queryDexs.infoQueryPosition", { pool_id }));
      }

      result.data.positions.push(...dataPositions.positions);
    }

    // console.log("result");
    // console.dir(result, { depth: null });
    return responseformaterTypeUniV3(result, dexConfigs, dexName);
  }
}

/**
 * Formatage des données pour les pools de type uniswap v3
 * @param data
 * @param dexConfigs
 * @param dexName
 * @returns
 */
function responseformaterTypeUniV3(
  data: ResponseSushiSwapV3GraphALL,
  dexConfigs: DexConfigs,
  dexName: string
): ResponseFunctionGetRegBalances[] {
  if (MAJ_MOCK_DATA) {
    console.info(i18n.t("utils.queryDexs.infoMajMockData"));
    // const dataMock = { data: { pairs: data } };
    const path = join(__dirname, "..", "mocks", dexConfigs.mockData);
    writeFileSync(path, JSON.stringify(data, null, 2));
  }
  const dataBalancesResponse: ResponseFunctionGetRegBalances[] = [];
  const TICK_BASE = 1.0001;
  function tick_to_price(tick: number): number {
    return TICK_BASE ** tick;
  }

  function getPositionAmount(
    tick_lower: number,
    tick_upper: number,
    liquidity: number,
    currentTick: number,
    decimals0: number,
    decimals1: number
  ): {
    adjusted_amount0: number;
    adjusted_amount1: number;
    isActive: boolean;
    amount0: number;
    amount1: number;
  } {
    let isActive = false;
    let amount0 = 0;
    let amount1 = 0;

    const sqrt_price = Math.sqrt(TICK_BASE ** currentTick);
    const sqrt_price_lower = Math.sqrt(TICK_BASE ** tick_lower);
    const sqrt_price_upper = Math.sqrt(TICK_BASE ** tick_upper);

    // Utilisation de BigNumber pour une meilleure précision
    const L = new BigNumber(liquidity);

    if (currentTick < tick_lower) {
      // Position entièrement en token0
      amount0 = L.multipliedBy(
        new BigNumber(1).dividedBy(sqrt_price_lower).minus(new BigNumber(1).dividedBy(sqrt_price_upper))
      ).toNumber();
    } else if (currentTick >= tick_upper) {
      // Position entièrement en token1
      amount1 = L.multipliedBy(new BigNumber(sqrt_price_upper).minus(new BigNumber(sqrt_price_lower))).toNumber();
    } else {
      // Position active avec les deux tokens
      amount0 = L.multipliedBy(
        new BigNumber(1).dividedBy(sqrt_price).minus(new BigNumber(1).dividedBy(sqrt_price_upper))
      ).toNumber();
      amount1 = L.multipliedBy(new BigNumber(sqrt_price).minus(new BigNumber(sqrt_price_lower))).toNumber();
      isActive = true;
    }

    // Ajustement des montants avec la précision des decimals
    const adjusted_amount0 = new BigNumber(amount0)
      .dividedBy(new BigNumber(10).pow(decimals0))
      .decimalPlaces(decimals0, BigNumber.ROUND_DOWN)
      .toNumber();

    const adjusted_amount1 = new BigNumber(amount1)
      .dividedBy(new BigNumber(10).pow(decimals1))
      .decimalPlaces(decimals1, BigNumber.ROUND_DOWN)
      .toNumber();

    return {
      adjusted_amount0,
      adjusted_amount1,
      isActive,
      amount0,
      amount1,
    };
  }

  const dataPools = data.data.pools;
  const dataPositions = data.data.positions;

  for (const pool of dataPools) {
    const positions: any = [];
    const poolLiquidity = new BigNumber(pool.liquidity);
    const currentTick = parseInt(pool.tick);
    const token0 = pool.token0.symbol;
    const token1 = pool.token1.symbol;
    const decimals0 = parseInt(pool.token0.decimals);
    const decimals1 = parseInt(pool.token1.decimals);
    const feeTier = dexName === "SushiSwap" ? pool.feeTier / 10 ** 4 : pool.fee / 10 ** 4;

    // Sum up all the active liquidity and total amounts in the pool
    let active_positions_liquidity = 0;
    let total_amount0 = 0;
    let total_amount1 = 0;

    const poolPositions = dataPositions.filter(
      (position: PositionSushiSwapV3) => position.pool.id.toLowerCase() === pool.id.toLowerCase()
    );

    if (poolPositions.length === 0) {
      console.warn(i18n.t("utils.queryDexs.warnPoolNoPosition", { pool_id: pool.id }));
      continue;
    }

    for (const position of poolPositions) {
      const owner = position.owner;
      const tick_lower = parseInt(position.tickLower.tickIdx);
      const tick_upper = parseInt(position.tickUpper.tickIdx);
      const liquidity = parseInt(position.liquidity);
      const id = parseInt(position.id);
      const poolId = position.pool.id;
      positions.push({ tick_lower, tick_upper, liquidity, owner, id, poolId });
    }

    const current_price = tick_to_price(currentTick);
    const current_sqrt_price = tick_to_price(currentTick / 2);
    const adjusted_current_price = current_price / 10 ** (decimals1 - decimals0);
    console.info(
      i18n.t("utils.queryDexs.infoTickToPrice", {
        price: adjusted_current_price.toFixed(6),
        pool_id: pool.id,
        token1,
        token0,
        feeTier,
        tick: currentTick,
      })
    );

    // Print all active positions
    const calculedPositions: any = [];
    for (const { tick_lower, tick_upper, liquidity, owner, id, poolId } of positions.sort(
      (a: { id: number; tick_lower: number }, b: { id: number; tick_lower: number }) => {
        if (a.id === b.id) {
          return a.tick_lower - b.tick_lower;
        }
        return a.id - b.id;
      }
    )) {
      const sa = tick_to_price(tick_lower / 2);
      const sb = tick_to_price(tick_upper / 2);

      const { adjusted_amount0, adjusted_amount1, isActive, amount0, amount1 } = getPositionAmount(
        tick_lower,
        tick_upper,
        liquidity,
        currentTick,
        decimals0,
        decimals1
      );

      total_amount0 += amount0;
      total_amount1 += amount1;
      active_positions_liquidity += liquidity;
      calculedPositions.push({
        owner,
        isActive,
        token0Id: pool.token0.id,
        token1Id: pool.token1.id,
        token0Symbol: pool.token0.symbol,
        token1Symbol: pool.token1.symbol,
        token0Decimals: pool.token0.decimals,
        token1Decimals: pool.token1.decimals,
        adjusted_amount0,
        adjusted_amount1,
      });

      console.info(
        i18n.t("utils.queryDexs.infoInOutRange", {
          isActive: isActive ? "IN RANGE" : "OUT RANGE",
          owner,
          id,
          tick_lower,
          tick_upper,
          adjusted_amount1: adjusted_amount1.toFixed(2),
          token1,
          adjusted_amount0: adjusted_amount0.toFixed(2),
          token0,
        })
      );
    }
    /**
 * `In total (including inactive positions): ${(total_amount0 / 10 ** decimals0).toFixed(2)} ${token0} and ${(
        total_amount1 /
        10 ** decimals1
      ).toFixed(2)} ${token1}`
 */
    console.info(
      i18n.t("utils.queryDexs.infoInactivePosition", {
        total_amount0: (total_amount0 / 10 ** decimals0).toFixed(2),
        token0,
        total_amount1: (total_amount1 / 10 ** decimals1).toFixed(2),
        token1,
      })
    );
    console.info(
      i18n.t("utils.queryDexs.infoTotalLiquidity", {
        active_positions_liquidity,
        poolLiquidity,
      })
    );
    dataBalancesResponse.push({
      poolId: pool.id as string,
      dexName: dexName,
      liquidityPositions: calculedPositions.map((position: any) => {
        return {
          user: {
            id: position.owner as string,
          },
          liquidity: [
            {
              tokenId: position.token0Id as string,
              tokenDecimals: position.token0Decimals as number,
              tokenSymbol: position.token0Symbol as string,
              tokenBalance: position.adjusted_amount0.toString(10),
              equivalentREG:
                position.token0Id === TOKEN_ADDRESS.REG
                  ? position.adjusted_amount0.toString(10)
                  : calculateTokenEquivalentTypeUniV3(
                      pool,
                      position.token0Id,
                      position.token1Id,
                      position.adjusted_amount0
                    ),
            },
            {
              tokenId: position.token1Id as string,
              tokenDecimals: position.token1Decimals as number,
              tokenSymbol: position.token1Symbol as string,
              tokenBalance: position.adjusted_amount1.toString(10),
              equivalentREG:
                position.token1Id === TOKEN_ADDRESS.REG
                  ? position.adjusted_amount1.toString(10)
                  : calculateTokenEquivalentTypeUniV3(
                      pool,
                      position.token1Id,
                      position.token0Id,
                      position.adjusted_amount1
                    ),
            },
          ],
        };
      }),
    });
  }
  return dataBalancesResponse;
}

/**
 * Appel fonction générique uniswap v3 pour sushiSwap
 * @param dexConfigs
 * @param network
 * @param timestamp
 * @param mock
 * @returns
 */
export async function getRegBalancesSushiSwap(
  dexConfigs: DexConfigs,
  network: Network,
  timestamp?: number | undefined,
  mock?: boolean
): Promise<ResponseFunctionGetRegBalances[]> {
  return await getRegBalancesTypeUniV3(dexConfigs, network, "SushiSwap", timestamp, mock);
}

/**
 * Appel fonction générique uniswap v3 pour swaprHQ
 * @param dexConfigs
 * @param network
 * @param timestamp
 * @param mock
 * @returns
 */
export async function getRegBalancesSwaprHQ(
  dexConfigs: DexConfigs,
  network: Network,
  timestamp?: number | undefined,
  mock?: boolean
): Promise<ResponseFunctionGetRegBalances[]> {
  return await getRegBalancesTypeUniV3(dexConfigs, network, "SwaprHQ", timestamp, mock);
}
