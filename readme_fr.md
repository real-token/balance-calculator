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

5. **Endpoints supplémentaires (Optionnel)**
   Permet d'utiliser un endpoint Graphql personnalisé qui fourni le bon format de données

   - Ajoutez vos endpoints supplémentaires sous forme de tableau JSON :
     `ENDPOINT_EXTRA=["https://endpoint1.com","https://endpoint2.com"]`

6. **URLs de développement The Graph (Optionnel)**
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

pour utiliser le nouveau modifier, ajouter la clé et la valeur dans le fichier `optionsModifiers.ts`

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
