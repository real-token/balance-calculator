# Balance Calculator

## Introduction

Outil pour calculer et analyser les balances des tokens sur différentes blockchains DEX et autres type de Smart Contracts. Cet outil est spécialement conçu pour :

- **Analyse Multi-DEX** : Récupération et analyse des balances de tokens à travers différents DEX (Honeyswap, Sushiswap, Balancer, SwaprHQ)
- **Support Multi-Chaînes** : Compatible avec plusieurs réseaux blockchain (Gnosis, Ethereum, Polygon)
- **Calcul de Pouvoir de Vote** : Génération de pouvoir de vote a partir de snapshot avec possibilité d'appliquer différents modèles de calcul et modifier les balances
- **Analyse Temporelle** : Capacité d'analyser les balances à différents moments dans le temps (snapshot)
- **Classement des Holders** : Création de classements des détenteurs de tokens
- **Export Flexible** : Génération de rapports au format JSON et CSV

L'outil est particulièrement utile pour :

- Les administrateurs de DAO souhaitant calculer la distribution des droits de vote
- Les analystes cherchant à comprendre la répartition des tokens
- Les développeurs blockchain nécessitant des données précises sur les balances de tokens
- Les auditeurs voulant vérifier les holdings à travers différentes plateformes

## Table des matières

- [Installation](#installation)
- [Configuration](#configuration)
- [Structure du projet](#structure-du-projet)
- [Utilisation](#utilisation)
- [Configuration du calcul de pouvoir de vote](#configuration-du-calcul-de-pouvoir-de-vote)
  - [Options de configuration](#options-de-configuration)
  - [Configuration avancée pour les positions v3](#configuration-avancée-pour-les-positions-v3)
  - [Exemples de configuration](#exemples-de-configuration)
- [Modification de code et ajout de fonctionnalité](#modification-de-code-et-ajout-de-fonctionnalité)
  - [Tache GetBalancesREG](#tache-getbalancesreg)
  - [Tache CalculatePowerVotingREG](#tache-calculatepowervotingreg)
- [Contribution](#contribution)
- [Licence](#licence)
- [Support](#support)
- [TODO](#todo)

## Installation

### Cloner le projet

```bash
git clone [url-du-projet]
```

### utilisation avec nvm

Installer la version LTS de node se trouvant dans le fichier .nvmrc ou utiliser nvm pour gérer les versions de node

```bash
nvm install
```

utiliser la version de node

```bash
nvm use
```

### installation du gestionnaire de paquet yarn

```bash
npm install -g yarn
```

### Installer les dépendances

```bash
yarn install
```

### Créer et configurer le fichier .env

```bash
cp .env.example .env
```

## Configuration

### Variables d'environnement

Modifier la copie du fichier `.env.example` en `.env` à la racine du projet avec les variables suivantes :

1. **The Graph API Key**

   - Visitez [The Graph](https://thegraph.com/studio/)
   - Créez un compte ou connectez-vous
   - Allez dans votre profil > Settings > API Keys
   - Créez une nouvelle clé API
   - Copiez la clé dans votre .env :
     `THEGRAPH_API_KEY=votre_clé_api`

2. **Etherscan API Key**

   - Visitez [Etherscan](https://etherscan.io/apis)
   - Créez un compte ou connectez-vous
   - Allez dans API Keys > Add
   - Créez une nouvelle clé API
   - Copiez la clé dans votre .env :
     `API_KEY_ETHERSCAN=votre_clé_etherscan`

3. **Gnosisscan API Key**

   - Visitez [Gnosisscan](https://gnosisscan.io/)
   - Créez un compte ou connectez-vous
   - Allez dans API Keys > Add
   - Créez une nouvelle clé API
   - Copiez la clé dans votre .env :
     `API_KEY_GNOSISSCAN=votre_clé_gnosisscan`

4. **Polygonscan API Key**

   - Visitez [Polygonscan](https://polygonscan.com/apis)
   - Créez un compte ou connectez-vous
   - Allez dans API Keys > Add
   - Créez une nouvelle clé API
   - Copiez la clé dans votre .env :
     `API_KEY_POLYGONSCAN=votre_clé_polygonscan`

5. **Moralis API Key**

   - Visitez [Moralis](https://developer.moralis.com/)
   - Créez un compte ou connectez-vous
   - Allez dans API Keys
   - Créez une nouvelle clé API
   - Copiez la clé dans votre .env :
     `API_KEY_MORALIS=votre_clé_moralis`

6. **Endpoints supplémentaires (Optionnel)**
   Permet d'utiliser un endpoint Graphql personnalisé qui fourni le bon format de données

   - Ajoutez vos endpoints supplémentaires sous forme de tableau JSON :
     `ENDPOINT_EXTRA=["https://endpoint1.com","https://endpoint2.com"]`

7. **URLs de développement The Graph (Optionnel)**
   Si vous développez avec des endpoints The Graph personnalisés :
   ```
   THE_GRAPH_DEV_URL_REG_GNOSIS="votre_url"
   THE_GRAPH_DEV_URL_REG_ETHEREUM="votre_url"
   THE_GRAPH_DEV_URL_REG_POLYGON="votre_url"
   THE_GRAPH_DEV_URL_GOV_GNOSIS="votre_url"
   ```

Votre fichier .env final devrait ressembler à ceci :

```
API_KEY_GNOSISSCAN="votre_clé_gnosisscan"
API_KEY_ETHERSCAN="votre_clé_etherscan"
API_KEY_POLYGONSCAN="votre_clé_polygonscan"

API_KEY_MORALIS="votre_clé_moralis"

THEGRAPH_API_KEY="votre_clé_thegraph"

# Optionnel

ENDPOINT_EXTRA=["https://endpoint1.com","https://endpoint2.com"]

# The Graph DEV URLs (Optionnel)

THE_GRAPH_DEV_URL_REG_GNOSIS=""
THE_GRAPH_DEV_URL_REG_ETHEREUM=""
THE_GRAPH_DEV_URL_REG_POLYGON=""
THE_GRAPH_DEV_URL_GOV_GNOSIS=""
```

## Structure du projet

```
src/
├── abi/            # Fichiers des ABIs
├── configs/        # Fichiers de configuration
├── graphql/        # Fichiers des requêtes GraphQL
├── mocks/          # Fichiers des mocks
├── models/         # Modèles de données
├── modifiers/      # Modificateurs de balances
├── tasks/          # Tâches principales
├── types/          # Définitions de types TypeScript
├── utils/          # Utilitaires et fonctions communes
└── index.ts        # Point d'entrée
.env                # Variables d'environnement
.env.example        # Exemple de fichier .env
.gitignore          # Fichier ignoré par git
.nvmrc              # Version de node
package.json        # Fichier de configuration de l'application
readme.md           # Documentation
tsconfig.json       # Configuration TypeScript
```

### Dossiers principaux

#### configs/

- `constantes.ts` : Définitions des constantes globales
- `dex.json` : Configuration des DEX
- `optionsModifiers.ts` : Fichier de configuration pour les calculs du pouvoir de vote

#### models/

- `powerVotingModels.ts` : Modèles de calcul du pouvoir de vote
- `inputModels.ts` : Modèles de données d'entrée

#### tasks/

Contient les tâches principales de l'application :

- GetBalancesREG : Récupère les balances REG sur différents DEX et réseaux
- GetAddressOwnRealToken : Liste les adresses possédant des RealTokens
- ClassementREG : Génère un classement des holders REG a partir des snapshot REG
- CalculatePowerVotingREG : Calcule le pouvoir de vote pour chaque adresse a partir des snapshot REG

#### utils/

- `graphql.ts` : Fonctions d'interaction avec TheGraph
- `lib.ts` : Fonctions utilitaires générales
- `queryDexs.ts` : Requêtes spécifiques aux DEX

## Utilisation

```bash
# Démarrer l'application en mode normal
yarn start

# Démarrer l'application en mode écrit dans un fichier logs.log
yarn start:logs
```

### Tâches disponibles

#### GetBalancesREG

Récupère les balances REG sur différents DEX et réseaux.

```bash
# Options disponibles :
- Sélection des réseaux (Gnosis, Ethereum, Polygon)
- Sélection des DEX par réseau
- Période temporelle personnalisable
```

#### GetAddressOwnRealToken

Liste les adresses possédant des RealTokens.

```bash
# Fonctionnalités :
- Sélection des tokens
- Période temporelle personnalisable
- Exclusion d'adresses spécifiques
```

#### ClassementREG

Génère un classement des holders REG a partir des snapshot REG.

```bash
# Options :
- Top N holders configurable
- Filtrage par type de balance
```

#### CalculatePowerVotingREG

Calcule le pouvoir de vote pour chaque adresse a partir des snapshot REG.

```bash
# Caractéristiques :
- Différents modèles de calcul disponibles
- Support des modificateurs de balance
- Génération des datas de transactions par lots de 500
```

## Configuration du calcul de pouvoir de vote

Le fichier `src/configs/optionsModifiers.ts` permet de configurer de manière fine le calcul du pouvoir de vote en appliquant divers multiplicateurs et règles aux balances de tokens.

### Options de configuration

Le fichier de configuration contient les options suivantes :

```typescript
export const optionsModifiers: NormalizeOptions = {
  excludeAddresses?: string[];              // Adresses à exclure du calcul
  boosBalancesDexs?: {...};                 // Configuration des boosts pour les DEX
  boostBalancesIncentivesVault?: number;    // Multiplicateur pour les vault d'incentives (1 = pas de boost)
  boostBalancesWallet?: number;             // Multiplicateur pour les balances de wallet (1 = pas de boost)
  balanceKey?: string | string[];           // Clé(s) de balance à utiliser pour le classement
  zeroforced?: number;                      // Seuil minimal de pouvoir de vote (sinon zéro)
  preProcessing?: (data: any) => any;       // Fonction de pré-traitement optionnelle
};
```

#### Exclusion d'adresses

L'option `excludeAddresses` permet d'exclure certaines adresses du calcul du pouvoir de vote, comme les adresses de contrats, multisigs, ou autres adresses spéciales.

```typescript
excludeAddresses: [
  "0xc49bb05ac57f371bbc30ea0b7b0679343cad71c0", // safe marketing
  "0xa99302f22f646c075413c69f2565fe69b5f5829a", // vault genesis
  // ... autres adresses ...
];
```

#### Configuration de boost pour les DEX

L'option `boosBalancesDexs` permet de configurer des multiplicateurs pour les balances de tokens sur différents DEX. Cette option accepte un objet dont les clés sont les noms des DEX supportés (sushiswap, balancer, honeyswap, swaprhq) et les valeurs peuvent être de deux formats différents.

##### Format traditionnel (tableau)

Le format traditionnel utilise un tableau de deux éléments :

- Le premier élément est un tableau de symboles de tokens
- Le second élément est un tableau de multiplicateurs correspondants

```typescript
balancer: [
  ["REG", "*"],      // Symboles de tokens (où "*" représente tous les autres tokens)
  [4, 2]             // Multiplicateurs correspondants (4x pour REG, 2x pour les autres)
],
```

##### Format objet avec configuration default

Le nouveau format utilise un objet avec une clé `default` qui contient les multiplicateurs par symbole de token :

```typescript
honeyswap: {
  default: {
    "REG": 4,        // Multiplicateur de 4x pour le token REG
    "WXDAI": 2.5,    // Multiplicateur spécifique pour WXDAI
    "*": 2           // Multiplicateur par défaut pour tous les autres tokens
  }
}
```

##### Formats de configuration par DEX

Chaque DEX peut avoir sa propre configuration selon l'un des formats ci-dessus. Les DEX qui supportent les positions v3 (comme SushiSwap v3 et SwapRHQ) peuvent également avoir une configuration avancée avec la clé `v3`.

Exemples de configuration pour différents DEX :

```typescript
boosBalancesDexs: {
  // SushiSwap - Format objet avec config v3
  sushiswap: {
    default: {
      "REG": 4,
      "*": 2
    },
    v3: { ... }  // Configuration avancée pour positions v3
  },

  // Balancer - Format tableau
  balancer: [
    ["REG", "*"],
    [4, 2]
  ],

  // Honeyswap - Format objet simple
  honeyswap: {
    default: {
      "REG": 4,
      "*": 2
    }
  },

  // SwapRHQ - Format objet avec config v3
  swaprhq: {
    default: {
      "REG": 4,
      "*": 2
    },
    v3: { ... }  // Configuration avancée pour positions v3
  }
}
```

##### Impact sur les balances

Lorsqu'un boost est appliqué à une balance de token sur un DEX :

1. Le système identifie d'abord le DEX (sushiswap, balancer, etc.)
2. Il recherche la configuration correspondante
3. Il détermine le multiplicateur approprié en fonction du symbole du token
4. Pour les tokens non spécifiés, le multiplicateur `"*"` est utilisé
5. La valeur `equivalentREG` de la balance est multipliée par ce facteur
6. Les totaux des balances sont mis à jour en conséquence

Par exemple, si un utilisateur a 100 REG sur SushiSwap et que le multiplicateur pour REG est de 4, sa balance effective sera de 400 REG pour le calcul du pouvoir de vote.

##### Combinaison avec les boosts v3

Pour les DEX supportant les positions v3, le système combine les multiplicateurs de token avec le calcul avancé basé sur la position de prix :

1. Le multiplicateur de base est déterminé par le symbole du token
2. Ce multiplicateur est ensuite ajusté selon les paramètres v3 (activité, proximité du prix, etc.)
3. Le résultat final peut être considérablement plus élevé pour les positions optimales

Par exemple, avec une configuration qui favorise les positions actives et centrées, un utilisateur fournissant de la liquidité REG dans une position optimale pourrait voir sa balance multipliée par un facteur x.

### Configuration avancée pour les positions v3

Pour les positions de liquidité v3 (comme celles de SushiSwap v3), le système offre désormais une configuration avancée permettant de calculer le pouvoir de vote en fonction de divers paramètres comme l'activité de la position, sa proximité avec le prix actuel, et la largeur de sa plage de prix.

Le système propose deux modes de calcul du boost:

1. **Mode "centered"** - Récompense les positions dont le prix actuel est proche du centre de leur plage
2. **Mode "proximity"** - Récompense les liquidités en fonction de leur proximité avec le prix actuel

#### Structure de la configuration v3

```typescript
sushiswap: {
  // Configuration de base pour tous les tokens
  default: {
    "REG": 4,   // Multiplicateur pour le token REG
    "*": 2      // Multiplicateur pour tous les autres tokens
  },

  // Configuration spécifique pour les positions v3
  v3: {
    // Mode de calcul du boost
    boostMode: "proximity",     // Options: "centered" ou "proximity"

    // Paramètres communs aux deux modes
    activeBoost: 1.5,           // Multiplicateur de base pour positions actives
    inactiveBoost: 0.5,         // Multiplicateur pour positions inactives
    rangeWidthFactor: 10000,    // Facteur largeur de plage (favorise plages étroites)

    // Paramètres spécifiques au mode "centered"
    priceRangeMode: "exponential", // Type de formule pour le centrage
    centerBoost: 3.0,           // Boost maximal au centre de la plage
    edgeBoost: 0.8,             // Boost minimal aux bords de la plage
    exponent: 2,                // Exposant pour le mode "exponential"

    // Paramètres spécifiques au mode "proximity"
    proximityMode: "exponential", // Type de décroissance
    maxProximityBoost: 3.0,       // Boost maximal au prix actuel
    minProximityBoost: 0.8,       // Boost minimal loin du prix
    decayFactor: 0.3,             // Contrôle la vitesse de décroissance
    numSlices: 100,               // Précision de la simulation

    // Paliers pour le mode "step" (si priceRangeMode="step")
    steps: [
      [0.2, 1.0],  // Paliers pour le mode centrage
      [0.5, 2.0],
      [0.8, 3.0],
      [1.0, 4.0]
    ]
  }
}
```

#### Mode "centered" - Centrage de la position

Le mode "centered" récompense les positions dont le prix actuel est proche du centre de leur plage. Ce mode est idéal pour encourager les fournisseurs de liquidité à créer des positions bien centrées autour du prix du marché.

Fonctionnement:

1. Une position avec le prix au centre exact de sa plage reçoit le boost maximum (`centerBoost`)
2. Une position avec le prix à l'extrémité de sa plage reçoit le boost minimum (`edgeBoost`)
3. Les positions entre les deux reçoivent un boost intermédiaire selon la formule choisie

Formules disponibles (`priceRangeMode`):

- **"linear"** : Décroissance linéaire du centre vers les bords
- **"exponential"** : Décroissance exponentielle (favorise davantage le centre exact)
- **"step"** : Paliers de boost définis par le tableau `steps`
- **"none"** : Aucune variation, utilise simplement les multiplicateurs de tokens

#### Mode "proximity" - Proximité au prix actuel

Le mode "proximity" récompense les liquidités en fonction de leur proximité avec le prix actuel. Ce mode est idéal pour valoriser les liquidités qui sont réellement utiles pour le marché à un moment donné.

Fonctionnement:

1. Les liquidités proches du prix actuel reçoivent le boost maximum (`maxProximityBoost`)
2. Les liquidités éloignées du prix reçoivent le boost minimum (`minProximityBoost`)
3. Les liquidités entre les deux reçoivent un boost intermédiaire selon la formule choisie

Formules disponibles (`proximityMode`):

- **"linear"** : Décroissance linéaire en s'éloignant du prix actuel
- **"exponential"** : Décroissance exponentielle (décroit plus rapidement en s'éloignant)

Le paramètre `decayFactor` contrôle la vitesse de décroissance du boost:

- Valeur plus basse (ex: 0.1) = décroissance rapide (zone d'impact étroite)
- Valeur plus haute (ex: 1.0) = décroissance lente (impact sur une large zone)

Pour les positions inactives (prix hors de la plage), le système calcule un boost basé sur la distance minimale entre la plage et le prix actuel. Ainsi, une position juste en dehors du prix actuel aura un boost plus élevé qu'une position très éloignée.

#### Impact de la largeur de la plage

Dans les deux modes, le paramètre `rangeWidthFactor` permet de favoriser les positions avec une plage de prix étroite (plus précise) :

- Une valeur élevée réduit l'impact de la largeur de la plage
- Une valeur faible augmente l'avantage des positions étroites
- Le boost final est multiplié par `min(1, rangeWidthFactor / tickWidth)`

#### Différences entre les deux modes

Pour illustrer la différence entre les deux modes, considérons ces scénarios :

**Scénario 1 : Position avec plage de 1$ à 10$, prix actuel à 5,5$**

- Mode "centered" : Boost maximal car le prix est au centre de la plage
- Mode "proximity" : Boost moyen car les liquidités à 5,5$ sont boostées mais pas celles à 1$ ou 10$

**Scénario 2 : Position avec plage de 1$ à 10$, prix actuel à 1,5$**

- Mode "centered" : Boost minimal car le prix est proche d'une extrémité
- Mode "proximity" : Boost élevé pour les liquidités proches de 1,5$, boost faible pour celles à 10$

**Scénario 3 : Position avec plage de 0,9$ à 1,1$, prix actuel à 1$**

- Mode "centered" : Boost maximal car le prix est au centre, multiplié par un facteur élevé pour plage étroite
- Mode "proximity" : Boost maximal car toutes les liquidités sont proches du prix, multiplié par le même facteur

**Scénario 4 : Position avec plage de 1$ à 2$, prix actuel à 3$**

- Mode "centered" : Boost inactif fixe
- Mode "proximity" : Boost inactif modulé par la proximité (plus élevé que pour une position à 10$)

### Exemples de configuration

#### 1. Configuration par défaut (comportement historique)

Cette configuration reproduit le comportement historique de l'application, sans formule spéciale pour les positions v3 :

```typescript
sushiswap: {
  default: {
    "REG": 4,   // Multiplicateur pour REG
    "*": 2      // Multiplicateur pour autres tokens
  },
  v3: {
    boostMode: "centered",
    activeBoost: 1,
    inactiveBoost: 1,
    priceRangeMode: "none",
    centerBoost: 1,
    edgeBoost: 1,
    exponent: 1,
    rangeWidthFactor: 10000
  }
}
```

#### 2. Configuration favorisant les positions actives centrées

Cette configuration utilise le mode "centered" et favorise fortement les positions actives bien centrées autour du prix du marché :

```typescript
sushiswap: {
  default: {
    "REG": 4,
    "*": 2
  },
  v3: {
    boostMode: "centered",
    activeBoost: 2.0,            // Positions actives comptent double
    inactiveBoost: 0.5,          // Positions inactives comptent moitié
    priceRangeMode: "exponential", // Formule exponentielle
    centerBoost: 4.0,            // Boost x4 au centre exact
    edgeBoost: 1.0,              // Boost x1 aux extrémités
    exponent: 3,                 // Courbe très accentuée
    rangeWidthFactor: 5000       // Favorise les plages étroites
  }
}
```

#### 3. Configuration favorisant les liquidités utiles au marché

Cette configuration utilise le mode "proximity" pour récompenser les liquidités proches du prix de marché actuel :

```typescript
sushiswap: {
  default: {
    "REG": 4,
    "*": 2
  },
  v3: {
    boostMode: "proximity",
    activeBoost: 2.0,
    inactiveBoost: 0.5,
    proximityMode: "exponential",
    maxProximityBoost: 5.0,       // Boost très élevé au prix actuel
    minProximityBoost: 0.5,       // Boost minimal loin du prix
    decayFactor: 0.2,             // Décroissance rapide (zone étroite)
    rangeWidthFactor: 8000
  }
}
```

#### 4. Configuration avec paliers

Cette configuration utilise le mode "centered" avec des paliers distincts pour le boost :

```typescript
sushiswap: {
  default: {
    "REG": 4,
    "*": 2
  },
  v3: {
    boostMode: "centered",
    activeBoost: 1.0,
    inactiveBoost: 0.2,
    priceRangeMode: "step",
    centerBoost: 1.0,            // Non utilisé en mode step
    edgeBoost: 1.0,              // Valeur par défaut si aucun palier ne correspond
    exponent: 1,                 // Non utilisé en mode step
    rangeWidthFactor: 10000,
    steps: [
      [0.3, 1.0],                // Moins de 30% du centre = x1
      [0.6, 2.0],                // Entre 30% et 60% = x2
      [0.9, 3.0],                // Entre 60% et 90% = x3
      [1.0, 4.0]                 // Plus de 90% = x4
    ]
  }
}
```

## Modification de code et ajout de fonctionnalité

### Tache GetBalancesREG

#### Ajout d'un nouveau DEX

Pour ajouter un nouveau DEX à notre application, suivez les étapes suivantes :

1. **Créez une nouvelle fonction de récupération des soldes** : Cette fonction doit être capable de récupérer les soldes pour le nouveau DEX. Elle doit être définie dans le fichier approprié ("src/utils/queryDeks.ts") et exportée pour pouvoir être utilisée ailleurs dans l'application.

```typescript
// Exemple de fonction de récupération des soldes pour un nouveau DEX
export async function getRegBalancesNewDexExemple(
  configs: any,
  network?: Network,
  timestamp?: number | undefined,
  mock?: boolean | undefined
): Promise<ResponseFunctionGetRegBalances> {
  // Votre code ici...
  return responseformaterNewDexExemple(result);
}
```

2. **Créez une nouvelle fonction de convertion de la réponse** : Cette fonction doit convertir et standardiser la réponse du graph au fromat "ResponseFunctionGetRegBalances" ("src/utils/queryDeks.ts"), utiliser dans la fonction précédente pour formater le return.

```typescript
// Exemple de fonction de formatage de la réponse du graph
function responseformaterNewDexExemple(pairs: any): ResponseFunctionGetRegBalances[] {
  return pairs.map((pair: any) => {
    const totalSupply = pair.totalSupply;
    return {
      poolId: pair.id,
      liquidityPositions: pair.liquidityPositions.map((liquidityPosition: any) => {
        const userLiquidityTokenBalance = liquidityPosition.liquidityTokenBalance;
        const userLiquidityPercentage = userLiquidityTokenBalance / totalSupply;
        return {
          user: {
            id: liquidityPosition.user.id,
          },
          liquidity: [
            {
              tokenId: pair.token0.symbol,
              tokenDecimals: pair.token0.decimals,
              tokenSymbol: pair.token0.symbol,
              tokenBalance: new BigNumber(pair.reserve0).multipliedBy(userLiquidityPercentage).toString(),
            },
            {
              tokenId: pair.token1.symbol,
              tokenDecimals: pair.token1.decimals,
              tokenSymbol: pair.token1.symbol,
              tokenBalance: new BigNumber(pair.reserve1).multipliedBy(userLiquidityPercentage).toString(),
            },
          ],
        };
      }),
    };
  });
}
```

3. **ajouter les infos sur le dex dans le fichier des constantes**
   Compléter l'énim DEX, NETWORK, la constante networkToDexsMap et dexFunctionMap

4. **Completez le fichier de config des dex pour le dex que vous ajoutez**
   ajouter les infos de config dans le fichier "src/configs/dex.json"

5. **Optionel, ajouter un fichier mock pour le dex ajouter**
   le fichier mock permet de faire des test sans devoir faire appel a theGrph

### Tache CalculatePowerVotingREG

#### Ajout de modifier pour le pouvoir de vote

Crée un fichier ts dans le dossier modifiers avec le nom du modifier de la fonction qui sera exporter, un fichier par modifier.
modifier le type `NormalizeOptions` dans le fichier `inputModels.types.ts` avec la clé du modifier.
Crée le code du modifier avec la structure minimum :

```typescript
export function modifierName(
  data: SourceBalancesREG[],
  options: NormalizeOptions["modifierName"]
): SourceBalancesREG[] {
  // Votre code ici...
}
```

Le modifier doit retourner un tableau de `SourceBalancesREG[]` qui es la version modifiée des données d'entrée `data` sans en changer la structure.
ajouter dans le fichier `index.ts` du dossier modifiers la fonction exportée dans le module.

pour utiliser le nouveau modifier, ajouter la clé et la valeur dans le fichier `optionsModifiers.ts`, l'ordre dans le fichier détermine l'ordre d'appel des modifiers, cela peux donc avoir un impact sur le calcul suivant l'ordre des modifiers.

chemain d'appel pour les modifiers:

```typescript
src/tasks/CalculatePowerVotingREG.ts -> (L55) selectedModel.normalize(jsonData, optionsModifiers);
-| src/models/inputModels.ts -> (L42) applyModifiers(datas, options);
--| src/models/inputModels.ts -> (L22) modifiedData = modifiers[key as keyof typeof modifiers](modifiedData, value);
---| src/modifiers/index.ts -> (1 à n) //Appel chaque modifier un a un en fonction de la clé primaire de src/configs/optionsModifiers.ts -> onst optionsModifiers
```

la clé primaire de `optionsModifiers` est primordiale pour effectué l'appel au modifier correspondant, cette clé doit avoir le meme nom que la fonction d'entrée du modifier qui es exportée dans le module `src/modifiers/index.ts`.
L'ordre des clés dans `optionsModifiers` est important, il détermine l'ordre d'appel des modifiers.

#### Ajout de modèle de calcul pour le pouvoir de vote

A rédigé

## Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Push la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## Licence

MIT

## Support

Pour toute question ou problème, veuillez ouvrir une issue dans le repository ou nous contacter sur telegram.

## TODO

- [ ] Rédiger la partie Modification de code et ajout de fonctionnalité -> ajouter modèle de calcul pour le pouvoir de vote
- [ ] Ajouter un logger custom pour retirer les clé api thegraph dans les logs
- [ ] Ajouter la gestion des clés de dex dans le calcule du classement
