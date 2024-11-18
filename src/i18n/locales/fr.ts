export default {
  tasks: {
    getBalancesREG: {
      noJsonFiles: "Aucun fichier JSON trouvé dans le dossier outDatas",
      availableFiles: "Fichiers JSON disponibles:",
      processingTimestamp: "INFO: Traitement pour le timestamp {{timestamp}}, {{date}}",
      numberOfHolders: "Info: nombre de détenteurs: {{count}}",
      numberOfHoldersTemporaryFile: "Nombre de détenteurs chargés du fichier temporaire:",
      urlGraphQL: "INFO: URL GraphQL",
      askUseMock: "Utiliser des données de test mock ?",
      askDexsNetwork: "Pour quels réseaux allons-nous extraire les soldes des DEX et portefeuilles ?",
      askDexs: "Voulez-vous extraire les soldes pour les DEX ?",
      askDexsForNetwork: "Pour le réseau {{network}}, pour quels DEX voulez-vous extraire les soldes ?",
      askUrlGraphQL: "Quelle URL GraphQL utiliser pour le réseau {{network}} ?",
    },
    calculatePowerVoting: {
      noJsonFiles: "Aucun fichier JSON trouvé dans le dossier outDatas",
      invalidVotingPower: "Valeur de pouvoir de vote invalide pour l'adresse {{address}}: {{value}}",
      askModel: "Quel modèle d'entrée voulez-vous utiliser ?",
      infoModelAutoDetected: "Modèle d'entrée détecté automatiquement : {{model}}",
      askPowerVotingModel: "Quel modèle de calcul de pouvoir de vote voulez-vous utiliser ?",
      askPreviousDataPowerVotingJsonFile:
        "Quel fichier contien les datas de pouvoir de vote précedemment utilisées pour mettre à jour le pouvoir de vote ?",
      askBatchSize: "Quelle taille de lot voulez-vous utiliser pour la transaction on-chain ?",
      messageBatchSizeError: "La taille du lot doit être un nombre entier!",
      warnPowerVotingValue: "Valeur de pouvoir de vote invalide pour l'adresse {{address}}: {{value}}",
      warnPowerVotingTraitment: "Erreur lors du traitement du pouvoir de vote pour l'adresse {{address}}: {{error}}",
    },
    classementREG: {
      noJsonFiles:
        "Aucun fichier JSON trouvé dans le dossier outDatas, veuillez d'abord exécuter la tâche GetBalancesREG",
      infoJsonFileAvailable: "Fichiers JSON disponibles:",
      messageEchec: "Veuillez entrer un nombre entier positif ou 'all'.",
      askTopN: "Combien de top holders voulez-vous afficher (all ou nombre) ?",
    },
    getAddressOwnRealToken: {
      askDateRange: "Dates de début et de fin:",
      currentTimestamp: "Timestamp en cours de traitement:",
      infoNumberOfHolders: "Nombre de détenteurs uniques:",
    },
  },
  common: {
    errors: {
      apiKeyMissing: "La clé API de {{service}} n'est pas définie dans le fichier .env",
      notGenerated: "Erreur non générée",
      promiseRejection: "Promesse rejetée non gérée :",
      warnTaskNotImplemented: "La tâche {{task}} n'est pas encore implémentée.",
    },
    infos: {
      infoJsonFileGenerated: "Fichier JSON créé à l'emplacement : \n",
      infoCsvFileGenerated: "Fichier CSV créé à l'emplacement : \n",
      infoFileNotFound: "Fichier introuvable : {{filePath}}",
    },
    ask: {
      askTask: "Quelle tâche voulez-vous exécuter ?",
      askUseTempFile: "Voulez-vous utiliser un fichier temporaire pour reprendre ?",
    },
  },
  utils: {
    graphql: {
      askUrlGraphQL: "Quelle URL GraphQL utiliser pour le réseau {{network}} ?",
      infoDexProcessing: "Le DEX {{dex}} sur {{network}} est en cours de traitement",
      warnNoFunctionForDex: "WARNING: Aucune fonction de récupération des soldes n'a été trouvée pour le DEX {{dex}}",
      timeQuery: "Query pour {{dex}} sur {{network}}",
      errorDexOrNetworkNotFound:
        "Error: DEX or NETWORK not found or not implemented : DEX->{{dex}} on {{network}} network",
      infoQueryStart: "Info: Début de client.request(query)",
      infoQueryEnd: "Info: Fin de client.request(query)",
      infoQueryMockData: "Info: MAJ_MOCK_DATA",
      errorQueryFailed: "La requête a échoué après 3 tentatives :",
      errorGraphNotSync:
        "Le graph est désynchronisé. Le graph a indexé jusqu'au bloc numéro {{indexedBlockNumber}}, mais les données pour le bloc numéro {{requestedBlockNumber}} ne sont pas encore disponibles, il y as une différance de {{difference}} blocs.\n\nVérifier l'indexation avant de continuer.",
      askRetry: "Voulez-vous recommencer une série de tentatives ?",
      errorQueryFailedAfterRetry: "La requête à échoué, il reste {{retries}} tentatives, pause de {{delayTime}}s :",
    },
    inquirer: {
      askTokenAddresses: "Quels tokens voulez-vous utiliser?",
      askDateRange: "Entrez la date de début UTC (format YYYY-MM-DD) :",
      askDateRangeEnd: "Entrez la date de fin UTC (format YYYY-MM-DD) :",
      askSnapshotTime: "Entrez le timestamp de snapshot (format HH:MM:SS) :",
      askContinue: "Voulez-vous continuer ?",
      askMessageValidateRange: "Veuillez entrer une date valide UTC au format YYYY-MM-DD",
      askMessageValidateTime: "Veuillez entrer une heure UTC valide au format HH:MM:SS",
      askUseTempFile: "Quelle fichier voulez vous utiliser ?",
      askMessageValidateCheckbox: "Veuillez sélectionner au moins une option.",
      askCustomUrl: "Quelle es l'url custom ?",
      askMessageValidateCustomUrl: "Veuillez entrer une url valide (http://... ou https://...)",
    },
    lib: {
      infoAskBlockNumber: "Entrez le numéro de bloc (format nombre entier) :",
      errorApiUrlNotFound: `Aucune URL d'API n'a été trouvée pour le réseau "{{network}}"`,
      errorApiKeyNotFound: `La clé API pour le réseau "{{network}}" n'est pas définie ou incorrect ({{apiKey}})`,
      errorApiRequestFailed: `La requête à échoué après 3 tentatives, pause de {{delayTime}}s :`,
      errorApiRequestFailedAfterRetry: `La requête ({{apiUrl}}) a échoué "{{attempt}}" fois , réessayer dans {{delayTime}} seconde...`,
      errorGetBlockNumberFromTimestamp: `Toutes les tentatives de requête pour obtenir le block number a partir d'un timestemp ont échoué`,
      errorKeyFactory: `Option de cas non reconnue : "{{caseOption}}"`,
      errorTokenNotFoundInPool: `Token non trouvé dans le pool : {{token}}`,
      errorTokenNotMatchPool: `Tokens ne correspondent pas au pool : {{fromToken}} et {{toToken}}`,
    },
    queryDexs: {
      infoUseMockData: "Info: Utilisation des données mockées pour {{dex}}",
      infoDexOrNetworkNotFound: "INFO: Configuration manquante pour le réseau {{network}}",
      infoQueryStart: "\nInfo: Démarrage de la requête {{dex}} sur {{network}}",
      infoQueryEnd: "Info: Fin de la requête {{dex}} sur {{network}}",
      errorNoFunctionForDex: `WARNING: Aucune fonction de récupération des soldes n'a été trouvée pour le DEX {{dex}}`,
      errorQueryFailed: "La requête a échoué après plusieurs tentatives :",
      errorCalculateTokenEquivalent: "Erreur lors du calcul de l'équivalence {{token}} en REG :",
      warnFileNotFound: `WARNING: getRegBalances{{dexName}} -> dexConfigs.mockData "{{mockData}}", le fichier correspondant n'existe pas.`,
      infoGetRegBalances: `INFO: getRegBalances{{dexName}} -> dexConfigs is undefined for "{{network}}"`,
      errorQueryNotFound: `Query "{{operationName}}" not found in the GraphQL document`,
      errorQueryPool: `Une erreur est survenue lors des 3 tentatives de requêtes pool_query : {{pool_id}}:`,
      errorPoolNotFound: `les pools {{pool_id}} n'ont pas été trouvées`,
      errorQueryPosition: `Une erreur est survenue lors des 3 tentatives de requêtes position_query pour les pools : {{pool_id}}:`,
      infoQueryPosition: `les pools {{pool_id}} n'ont pas de positions ouvert`,
      warnPoolNoPosition: `le pool {{pool_id}} n'ont pas de positions ouvert`,
      infoTickToPrice: `\nINFO: prix courant={{price}} pool {{pool_id}} {{token1}} pour {{token0}} fee {{feeTier}}% au tick {{tick}}`,
      infoInOutRange: `{{isActive}} : {{owner}} position {{id}} dans l'intervalle [{{tick_lower}},{{tick_upper}}]: {{adjusted_amount1}} {{token1}} et {{adjusted_amount0}} {{token0}} au prix courant`,
      infoInactivePosition: `Au Total (y compris les positions inactives): {{total_amount0}} {{token0}} et {{total_amount1}} {{token1}}`,
      infoTotalLiquidity: `Liquidité totale des positions actives: {{active_positions_liquidity}} (doit être égal à {{poolLiquidity}})`,
    },
  },
  models: {
    normalize: {
      infoNormalizer: "INFO: Normalisation des données avec le modèle {{model}}",
      infoApplyModifier: "INFO: Application du modifier {{modifier}}",
      infoNoOptions: "Aucune options passer au normalizer, applique la normalisation par défaut",
    },
  },
  modifiers: {
    infoApplyModifier: "Début de {{modifier}}",
  },
};
