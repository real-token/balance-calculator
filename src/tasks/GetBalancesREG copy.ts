// Importations nécessaires
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
import { keyFactory, readContentFromFile } from "../utils/lib.js";
import {
  askChoiseCheckbox,
  askDateRange,
  askUrls,
  askUseconfirm,
} from "../utils/inquirer.js";
import { BigNumber } from "bignumber.js";
import {
  createGraphQLClient,
  getRegBalances,
  getRegBalancesByDexs,
  getRegBalancesVaultIncentives,
} from "../utils/graphql.js";

const __dirname = new URL(".", import.meta.url).pathname;

// Fonction principale pour obtenir les soldes REG
export async function taskGetBalancesREG(tempData: string): Promise<string> {
  const networksSelected: Network[] = [];
  const listeSelectedUrlGraph: string[] = [];
  let SelectDex: any = {};

  // Demande à l'utilisateur s'il souhaite utiliser des données de test
  const mock = await askUseconfirm(
    "Utiliser des données de test mock ? (y/N)",
    false
  );
  if (mock) {
    networksSelected.push(NETWORK.GNOSIS);
    SelectDex = networkToDexsMap;
  }

  // Si pas de mock, demande à l'utilisateur de sélectionner les réseaux et DEX
  if (!mock) {
    const networks = await askChoiseCheckbox(
      "Pour quels réseaux allons-nous extraire les soldes des DEX et portefeuilles ?",
      {
        name: [...Object.values(NETWORK)],
        value: [...Object.values(NETWORK)],
      },
      true
    );
    const listeUrlGraph = {
      gnosis:
        process.env.THE_GRAPH_DEV_URL_REG_GNOSIS ??
        theGraphApiUrlsREG[NETWORK.GNOSIS],
      ethereum:
        process.env.THE_GRAPH_DEV_URL_REG_ETHEREUM ??
        theGraphApiUrlsREG[NETWORK.ETHEREUM],
      polygon:
        process.env.THE_GRAPH_DEV_URL_REG_POLYGON ??
        theGraphApiUrlsREG[NETWORK.POLYGON],
    };
    for (const network of networks) {
      networksSelected.push(network as Network);
      listeSelectedUrlGraph.push(listeUrlGraph[network as Network]);
      console.log("debug ", network, networkToDexsMap[network as Network]);
      const askDexs = await askUseconfirm(
        `Voulez-vous extraire les soldes pour les DEX ? (Y/n)`,
        true
      );
      const dexs = askDexs
        ? await askChoiseCheckbox(
            `Pour le réseau ${network}, pour quels DEX voulez-vous extraire les soldes ?`,
            {
              name: networkToDexsMap[network as Network],
              value: networkToDexsMap[network as Network],
            },
            true
          )
        : [];
      SelectDex[network] = dexs;
    }
  }

  // Initialisation des soldes des portefeuilles
  const allBalancesWallets: Array<RetourREG> = [];
  if (tempData !== "") {
    const { result } = JSON.parse(tempData);
    console.info(
      "Nombre de détenteurs chargés du fichier temporaire:",
      result.balances.length
    );
    allBalancesWallets.push(result.balances);
  }

  const pathFile = path.join(
    __dirname,
    "..",
    "..",
    "outDatas",
    "balancesREG_tmp.json"
  );

  // Fonction pour écrire les données temporaires dans un fichier
  function writeTempFile(
    currantTimestemp: any,
    dateCurrant: any,
    dateStart: any,
    dateEnd: any,
    snapshotTime: any,
    balances: any,
    pathFile: fs.PathOrFileDescriptor
  ) {
    fs.writeFileSync(
      pathFile,
      JSON.stringify(
        {
          result: { balances },
          params: {
            currantTimestemp,
            dateCurrant,
            dateStart,
            dateEnd,
            snapshotTime,
          },
        },
        null,
        2
      )
    );
  }

  // Gestion de la reprise du traitement
  const skipAskNewDate = allBalancesWallets.length > 0;
  const constentFiles = skipAskNewDate ? readContentFromFile(pathFile) : false;
  const parsed = constentFiles ? JSON.parse(constentFiles as string) : {};
  console.log("skipAskNewDate", skipAskNewDate, parsed, !!constentFiles);
  //TODO tester la reprise avec le currentTimestemp, actuellement il devrais reprendre depuis le début et pas a l'endroit du crache
  // Demande de la plage de dates pour l'extraction
  const optionTime = skipAskNewDate
    ? {
        skipAsk: skipAskNewDate,
        startDate: parsed.params.dateStart,
        endDate: parsed.params.dateEnd,
        snapshotTime: parsed.params.snapshotTime,
        currantTimestemp: parsed.params.currantTimestemp,
      }
    : {};
  const { startDate, endDate, snapshotTime } = await askDateRange(optionTime);
  console.info("startDate, endDate", startDate, endDate, snapshotTime);
  let startDateStr = new Date(`${startDate}T${snapshotTime}:00Z`);
  const endDateStr = new Date(`${endDate}T${snapshotTime}:00Z`);

  // Chargement des configurations des DEX
  const configs = JSON.parse(
    readFileSync(path.join(__dirname, "..", "configs", "dex.json"), "utf-8")
  );

  // Extraction des IDs des pools
  const pools_id: string[] = Object.values(configs).flatMap(
    (networkConfig: any) => {
      return Object.values(networkConfig)
        .map((dexs: any) => {
          return Object.values(dexs)
            .map((dex: any) => {
              return dex.pool_id.flat();
            })
            .flat();
        })
        .flat();
    }
  );

  let timestamp = 0;

  //TODO optimiser cette boucle pour la rendre plus lisible
  // Boucle principale pour le calcul des soldes
  while (startDateStr <= endDateStr) {
    for (const network of networksSelected) {
      timestamp = Math.floor(startDateStr.getTime() / 1000);
      console.info("INFO: timestamp", timestamp, new Date(timestamp * 1000));
      const debugAddress = "0xf5383bc332e01f066edb84a6647066da02695ea7";
      // Récupération des soldes des portefeuilles REG
      const balancesHolderREG = await (async () => {
        if (mock) {
          console.info(
            "INFO: Exécution des données de test (mock) pour les portefeuilles"
          );
          const fileContent = await fs.promises.readFile(
            path.join(__dirname, "..", "mocks", "balancesWalletsREG.json"),
            "utf8"
          );
          return JSON.parse(fileContent);
        }

        const url = await askUrls(
          [listeSelectedUrlGraph[networksSelected.indexOf(network)]],
          false,
          `Quelle URL GraphQL utiliser pour le réseau "${network}" ?`
        );
        console.info("INFO: URL GraphQL", url);

        const client = createGraphQLClient(
          typeof url === "string" ? url : url[0]
        );
        console.log("client", client);
        return await getRegBalances(client, timestamp, network);
      })();

      // Traitement des soldes des portefeuilles
      const listeHolders: string[] = [];
      for (const addressHolder of Object.keys(await balancesHolderREG)) {
        if (!new BigNumber(balancesHolderREG[addressHolder]).isZero()) {
          const walletIndex = allBalancesWallets.findIndex(
            (wallet) =>
              wallet.walletAddress.toLowerCase() === addressHolder.toLowerCase()
          );
          const newBalance: { [key: string]: string } = {};
          newBalance[network] = new BigNumber(balancesHolderREG[addressHolder])
            .shiftedBy(-18)
            .toString(10);

          listeHolders.push(addressHolder);
          if (debugAddress === addressHolder) {
            console.debug(
              "DEBUG: newBalance",
              debugAddress,
              walletIndex,
              newBalance
            );
          }
          // crée l'objet user si il n'existe pas
          //TODO améloré la création de l'objet avec une création par netork dynamique a partir de la liste NETWORK
          if (walletIndex === -1) {
            allBalancesWallets.push({
              walletAddress: addressHolder,
              type: pools_id.includes(addressHolder)
                ? "liquidityPool"
                : "wallet",
              totalBalanceRegGnosis: newBalance[NETWORK.GNOSIS] ?? "0",
              totalBalanceRegEthereum: newBalance[NETWORK.ETHEREUM] ?? "0",
              totalBalanceRegPolygon: newBalance[NETWORK.POLYGON] ?? "0",
              totalBalanceEquivalentRegGnosis: "0",
              totalBalanceEquivalentRegEthereum: "0",
              totalBalanceEquivalentRegPolygon: "0",
              totalBalanceEquivalentREG: "0",
              totalBalanceREG: newBalance[network] ?? "0",
              totalBalance: newBalance[network] ?? "0",
              sourceBalance: {
                [network]: {
                  walletBalance: newBalance[network],
                  vaultIncentiveV1: "0",
                  dexs: {},
                },
              },
            });
            continue;
          }

          //Calcule les balances cumulé Wallet pour un user qui existe déjà
          const calculateTotalBalance = (networkKey: string) => {
            const key = keyFactory("totalBalanceReg", networkKey, "capitalize");
            return new BigNumber(allBalancesWallets[walletIndex][key])
              .plus(
                newBalance[
                  NETWORK[networkKey.toUpperCase() as keyof typeof NETWORK]
                ] ?? "0"
              )
              .toString(10);
          };

          const totalBalanceRegGnosis = calculateTotalBalance(NETWORK.GNOSIS);
          const totalBalanceRegEthereum = calculateTotalBalance(
            NETWORK.ETHEREUM
          );
          const totalBalanceRegPolygon = calculateTotalBalance(NETWORK.POLYGON);
          const networksBalanceTotal = [...Object.values(NETWORK)].reduce(
            (acc, network) => {
              const networkKey =
                NETWORK[network.toUpperCase() as keyof typeof NETWORK];
              const balance = newBalance[networkKey] ?? "0";
              const oldBalance =
                allBalancesWallets[walletIndex][
                  keyFactory("totalBalanceReg", networkKey, "capitalize")
                ];
              // const oldVaultIncentiveV1 =
              //   allBalancesWallets[walletIndex].sourceBalance?.[network]
              //     ?.vaultIncentiveV1 ?? vaultIncentiveV1;

              if (balance === undefined || isNaN(Number(balance))) {
                return acc; // Skip invalid balances
              }

              return (
                new BigNumber(acc)
                  .plus(balance)
                  .plus(oldBalance)
                  // .plus(oldVaultIncentiveV1)
                  .toString(10)
              );
            },
            "0"
          );

          const totalBalanceREG = networksBalanceTotal;

          const totalBalanceEquivalentRegGnosis =
            allBalancesWallets[walletIndex].totalBalanceEquivalentRegGnosis ??
            "0";
          const totalBalanceEquivalentRegEthereum =
            allBalancesWallets[walletIndex].totalBalanceEquivalentRegEthereum ??
            "0";
          const totalBalanceEquivalentRegPolygon =
            allBalancesWallets[walletIndex].totalBalanceEquivalentRegPolygon ??
            "0";
          const totalBalanceEquivalentREG = new BigNumber(
            totalBalanceEquivalentRegGnosis
          )
            .plus(totalBalanceEquivalentRegEthereum)
            .plus(totalBalanceEquivalentRegPolygon)
            .toString(10);

          const totalBalance = BigNumber(totalBalanceREG)
            .plus(totalBalanceEquivalentREG)
            .toString(10);

          allBalancesWallets[walletIndex]!.sourceBalance![network] = {
            walletBalance: newBalance[network],
            vaultIncentiveV1: "0",
            dexs: {},
          };
          if (debugAddress === addressHolder) {
            console.debug("DEBUG: allBalancesWallets", debugAddress);
          }
          allBalancesWallets[walletIndex] = {
            walletAddress: addressHolder,
            type: allBalancesWallets[walletIndex].type ?? "undefined",
            totalBalanceRegGnosis,
            totalBalanceRegEthereum,
            totalBalanceRegPolygon,
            totalBalanceEquivalentRegGnosis,
            totalBalanceEquivalentRegEthereum,
            totalBalanceEquivalentRegPolygon,
            totalBalanceEquivalentREG,
            totalBalanceREG,
            totalBalance,
            sourceBalance: allBalancesWallets[walletIndex].sourceBalance,
          };
          if (debugAddress === addressHolder) {
            console.debug("DEBUG: allBalancesWallets END", debugAddress);
          }
        }
      }

      console.debug(
        "DEBUG: allBalancesWallets 1",
        network,
        allBalancesWallets.find(
          (wallet) => wallet.walletAddress === debugAddress
        ) ?? "undefined"
      );
      if (network === NETWORK.GNOSIS) {
        // Récupération des balances REG déposés dans le vault incentives
        const balancesVaultIncentives = await (async () => {
          if (network !== NETWORK.GNOSIS) {
            return {};
          }
          const client = createGraphQLClient(
            process.env.THE_GRAPH_DEV_URL_GOV_GNOSIS ??
              theGraphApiUrlsGov[network as Network]
          );
          return await getRegBalancesVaultIncentives(
            client,
            timestamp,
            network
          );
        })();

        // Ajoute les balances vault incentive v1
        for (const addressHolder of Object.keys(balancesVaultIncentives)) {
          const walletIndex = allBalancesWallets.findIndex(
            (wallet) => wallet.walletAddress === addressHolder
          );
          const vaultIncentiveV1Balance = new BigNumber(
            balancesVaultIncentives[addressHolder]
          )
            .shiftedBy(-18)
            .toString(10);

          if (walletIndex === -1) {
            allBalancesWallets.push({
              walletAddress: addressHolder,
              type: pools_id.includes(addressHolder)
                ? "liquidityPool"
                : "wallet",
              totalBalanceRegGnosis: vaultIncentiveV1Balance ?? "0",
              totalBalanceRegEthereum: "0",
              totalBalanceRegPolygon: "0",
              totalBalanceEquivalentRegGnosis: "0",
              totalBalanceEquivalentRegEthereum: "0",
              totalBalanceEquivalentRegPolygon: "0",
              totalBalanceEquivalentREG: "0",
              totalBalanceREG: vaultIncentiveV1Balance ?? "0",
              totalBalance: vaultIncentiveV1Balance ?? "0",
              sourceBalance: {
                [NETWORK.GNOSIS]: {
                  walletBalance: "0",
                  vaultIncentiveV1: vaultIncentiveV1Balance ?? "0",
                  dexs: {},
                },
              },
            });
            continue;
          } else {
            allBalancesWallets[walletIndex].sourceBalance![
              NETWORK.GNOSIS
            ]!.vaultIncentiveV1 = vaultIncentiveV1Balance;

            // met a jour les balances total
            allBalancesWallets[walletIndex] = {
              ...allBalancesWallets[walletIndex],
              totalBalanceRegGnosis: new BigNumber(
                allBalancesWallets[walletIndex].totalBalanceRegGnosis
              )
                .plus(vaultIncentiveV1Balance)
                .toString(10),
              totalBalanceREG: new BigNumber(
                allBalancesWallets[walletIndex].totalBalanceREG
              )
                .plus(vaultIncentiveV1Balance)
                .toString(10),
              totalBalance: new BigNumber(
                allBalancesWallets[walletIndex].totalBalance
              )
                .plus(vaultIncentiveV1Balance)
                .toString(10),
            };
          }
        }

        console.debug(
          "DEBUG: allBalancesWallets 2",
          network,
          allBalancesWallets.find(
            (wallet) => wallet.walletAddress === debugAddress
          )
        );
      }

      //Ajout des données des DEX
      if (SelectDex[network]?.length > 0) {
        const balancesDexs = await (async () => {
          if (mock) {
            console.info(
              "INFO: Exécution des données de test (mock) pour les DEX"
            );
            return await getRegBalancesByDexs(
              network as Network,
              SelectDex[network],
              undefined,
              mock
            );
          }

          console.info("Info: Récupération des soldes sur les DEX");
          return await getRegBalancesByDexs(
            network,
            SelectDex[network],
            timestamp,
            mock
          );
        })();

        if (MODE_DEBUG) {
          fs.writeFileSync(
            "debugBalancesDexs.json",
            JSON.stringify(balancesDexs, null, 2)
          );
        }
        //Boucle sur les Dexs
        for (const dex of Object.keys(balancesDexs)) {
          //Boucle sur les pools d'un Dex
          for (const pool of balancesDexs[dex]) {
            const poolAddress = pool.poolId;
            //Boucle sur les positions d'un pool, position de chaque user
            for (const position of pool.liquidityPositions) {
              const holderAddress = position.user.id;
              const liquiditys = position.liquidity;
              //Boucle sur les liquidités d'un user (tokens dans un pool)
              for (const liquidity of liquiditys) {
                const tokenBalance = liquidity?.tokenBalance ?? "0";
                const equivalentREG = liquidity?.equivalentREG ?? "0";
                const tokenAddress = liquidity?.tokenId ?? "0x0";
                const tokenSymbol = liquidity?.tokenSymbol ?? "undefined";
                if (debugAddress === holderAddress) {
                  console.debug("DEBUG: liquidity", debugAddress, poolAddress);
                } //TODO continuer ici pour chercher pouruqoi nous avons 2 fois l'adresse0xf5383bc332e01f066edb84a6647066da02695ea7 et pas de data de dex
                // cherche l'existance de l'utilisateur déjà créer
                let indexWallet = listeHolders.findIndex(
                  (holder) => holder === holderAddress
                );

                // si l'utilisateur n'existe pas, crée un nouveau sans position dex
                if (indexWallet === -1) {
                  listeHolders.push(holderAddress);
                  allBalancesWallets.push({
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
                  });
                  indexWallet = listeHolders.length - 1;
                }

                // Construire le nom de la clé pour le totalBalance avec le network
                const keyBalanceRegNetwork = keyFactory(
                  "totalBalanceReg",
                  network,
                  "capitalize"
                );

                const keyBalanceEquivRegNetwork = keyFactory(
                  "totalBalanceEquivalentReg",
                  network,
                  "capitalize"
                );

                const allBalancesWallet = allBalancesWallets[indexWallet]; //récupère l'objet user

                const issetDexPosition =
                  !!allBalancesWallet.sourceBalance?.[network]?.dexs?.[
                    dex as DexValue
                  ];
                const isRegToken = liquidity.tokenId === TOKEN_ADDRESS.REG;

                //Crée l'objet dex si il n'existe pas
                if (!issetDexPosition) {
                  allBalancesWallet!.sourceBalance![network]!.dexs![
                    dex as DexValue
                  ] = [];
                }

                allBalancesWallet!.sourceBalance![network]!.dexs![
                  dex as DexValue
                ]!.push({
                  tokenBalance: tokenBalance,
                  tokenSymbol: tokenSymbol,
                  tokenAddress: tokenAddress,
                  poolAddress: poolAddress,
                  equivalentREG: equivalentREG,
                });

                //Calcule les balances total pour REG et Equivalent REG
                if (isRegToken) {
                  //Calcule les balances total pour REG
                  allBalancesWallet[keyBalanceRegNetwork] = new BigNumber(
                    allBalancesWallet[keyBalanceRegNetwork]
                  )
                    .plus(tokenBalance)
                    .toString(10);
                  allBalancesWallet.totalBalanceREG = new BigNumber(
                    allBalancesWallet.totalBalanceREG
                  )
                    .plus(tokenBalance)
                    .toString(10);
                  allBalancesWallet.totalBalance = new BigNumber(
                    allBalancesWallet.totalBalance
                  )
                    .plus(tokenBalance)
                    .toString(10);
                } else {
                  //Calcule les balances total equivalent REG
                  allBalancesWallet[keyBalanceEquivRegNetwork] = new BigNumber(
                    allBalancesWallet[keyBalanceEquivRegNetwork]
                  )
                    .plus(equivalentREG)
                    .toString(10);

                  allBalancesWallet.totalBalanceEquivalentREG = new BigNumber(
                    allBalancesWallet.totalBalanceEquivalentREG
                  )
                    .plus(equivalentREG)
                    .toString(10);

                  allBalancesWallet.totalBalance = new BigNumber(
                    allBalancesWallet.totalBalance
                  )
                    .plus(equivalentREG)
                    .toString(10);
                }

                allBalancesWallets[indexWallet] = allBalancesWallet;
              }
              // console.log("DEBUG  MAJ allBalancesWallets[indexWallet]");
              // console.dir(allBalancesWallets[indexWallet], { depth: null });
            }
          }
        }
      }

      console.debug(
        "DEBUG: allBalancesWallets 3",
        network,
        allBalancesWallets.find(
          (wallet) => wallet.walletAddress === debugAddress
        )
      );
    }
    // Écriture des données dans le fichier temporaire
    console.info("Info: number of holders", allBalancesWallets.length);
    writeTempFile(
      timestamp,
      startDateStr,
      startDate,
      endDate,
      snapshotTime,
      allBalancesWallets,
      pathFile
    );
    startDateStr.setDate(startDateStr.getDate() + 1);
  }

  return pathFile;
}
