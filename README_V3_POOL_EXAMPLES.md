# Exemples de configuration et calculs pour pools v3 (USDC/REG)

## Introduction

Ce document illustre, à travers des exemples concrets, l'impact des différents paramètres de configuration des boosts pour les pools v3 (Uniswap/Sushiswap v3) sur un pool USDC/REG, avec un prix du REG fixé à **1$**. Chaque scénario présente une position extrême, le détail des paramètres utilisés, les étapes de calcul du boost (pour les modes "centered" et "proximity"), et une analyse de l'influence des paramètres.

## Structure et typage des paramètres

La configuration des boosts pour les pools v3 est définie par un ensemble de paramètres typés. Voici la structure attendue:

```typescript
{
  [key in DexValue]?: {
    [string[], number[]] //<-Fromat pour les pools v2
    | { //Format pour les pools v3
      default: {
        [tokenSymbol: string]: number; // Multiplicateur pour chaque symbole de token
      };
      v3?: {

        // Type de valeur source pour les calculs (tick ou priceDecimals)
        sourceValue: SourceValue;

        // Type de formule à appliquer sur la plage de prix (linear, exponential, step, none)
        priceRangeMode: BoostFormulaType;

        // Mode de calcul du boost ("centered" ou "proximity")
        boostMode?: BoostModeType;

        // Boost de base pour les positions actives (dans la plage de prix)
        activeBoost?: number;

        // Boost de base pour les positions inactives (hors plage de prix)
        inactiveBoost?: number;

        // Boost au centre de la plage (multiplicateur maximum pour mode centered)
        centerBoost?: number;

        // Boost aux extrémités de la plage (multiplicateur minimum pour mode centered)
        edgeBoost?: number;

        // Exposant pour la formule exponentielle
        exponent?: number;

        // Facteur d'influence de la largeur de la plage (plus c'est grand, moins la largeur compte)
        rangeWidthFactor?: number;

        // Paliers pour le mode "step" (pourcentage de 0 à 1, boost)
        steps?: Array<[number, number]>;

        // Paramètres spécifiques au mode "proximity"
        proximityMode?: BoostFormulaType; // Type de décroissance ("linear", "exponential")
        maxProximityBoost?: number; // Boost maximal au prix actuel
        minProximityBoost?: number; // Boost minimal loin du prix
        decayFactor?: number; // Contrôle la vitesse de décroissance (0.1 = rapide, 1.0 = lente)
        numSlices?: number; // Nombre de tranches pour simuler la répartition de liquidité
      }
    }
  }
}
```

**Important:** Si un paramètre optionnel n'est pas précisé dans la configuration, il prendra automatiquement la valeur **1** par défaut.

Consulter la suite du document pour connaitre les paramètres a utiliser en fonction du mode de boost choisi

Le paramètre principal déteminant es **priceRangeMode**, il détermine la logique principale de calcule du boost

## Chemin d'appel pour le calcule du boost v3

```typescript
| src/tasks/CalculatePowerVotingREG.ts -> (L55) const normalizedData = selectedModel.normalize(jsonData, optionsModifiers);
-| src/models/inputModels.ts -> (L42) datas = applyModifiers(datas, options);
--| src/models/inputModels.ts -> (L22) modifiedData = modifiers[key as keyof typeof modifiers](modifiedData, value);
---| src/modifiers/index.ts -> // Le modifier est appelé en fonction de la clé passer a l'étape précédente
----| src/modifiers/boosBalancesDexs.ts -> (L14) function boostBalancesDexs(data: SourceBalancesREG[], options: NormalizeOptions["boostBalancesDexs"]): SourceBalancesREG[]
```

La fonction `boostBalancesDexs` effectue les calculs des boosts pour chaque type de position en s'addaptent aux types de pools.
L'ordre d'appel des modifiers est déterminer par l'ordre des clés dans l'objet du fichier `src/configs/optionsModifiers.ts`.
l'objet `optionsModifiers` contiens en clé primaire les noms des fonction modifiers à appler et détermine donc l'ordre d'appel des modifiers. Pour le boost des balances des DEX, la clé est `boostBalancesDexs`, c'est un objet dont les clés de seconde niveau sont les noms des DEX.
Pour les DEX a liquidité concentrée, il y as 2 clés de troisième niveau:

- `default`: pour les calcules de boost traditionnel type v2 (si utilisé comme tel)
- `v3`: pour les paramètres de configuration des boosts v3

Dans le cas des pools concentrés, les clés dans l'objet `v3` varie en fonction du mode de boost choisi et du resultat escompté.
Des exemples sont fournis pour chaque mode de boost.

---

## Les différents modes priceRangeMode

Le paramètre `priceRangeMode` est le plus important car il détermine la logique fondamentale du calcul des boosts. Ce document détaille chaque mode disponible, ses cas d'usage et son fonctionnement.

### Mode "none"

Mode le plus simple où les boosts appliqués ne dépendent pas de la plage de prix mais simplement du nombre de REG ou tokens équivalents REG. Tous les pools v2 ou similaires utilisent ce mode par défaut. Pour les pools à liquidité concentrée (type Uniswap v3), ce mode sert de référence, mais d'autres modes sont disponibles pour mieux s'adapter aux spécificités de ces pools.

Ce mode est détaillé avec des exemples concrets dans la section [Mode "priceRangeMode: none"](#mode-pricerangemode-none) plus loin dans ce document.

### Mode "linear"

Mode avec une relation linéaire de l'ajustement du boost, les autres paramètres peuvent etre utilisés pour ajuster la pente et la portée de la diminution du boost.

### Mode "exponential"

Mode utilisant une fonction exponentielle pour accentuer les différences, semblable au mode "linear" mais avec une diminution du boost en courbe ajustable par les autres paramètres.

### Mode "step"

Mode utilisant des paliers prédéfinis pour attribuer des boosts en fonction du positionnement dans la plage dans les steps. Permet un contrôle précis des niveaux de boost à différentes positions relatives. Permet des stratégie de boost par zone de prix.

---

## Elements communs à tous les exemples

Voici les éléments communs à tous les exemples qui sont présentés dans la suite de ce document:

- Fichier de données utilisateur (données d'exemple): `balancesREG_mock_examples.json`

- **Prix du REG** : 1$
- **Prix du USDC** : 1$
- **Token0** : USDC (décimales 6)
- **Token1** : REG (décimales 18)
- **Multiplicateur REG** : 4
- **Multiplicateur USDC** : 2

## Mode "priceRangeMode: none"

Lorsque le paramètre `priceRangeMode` est défini sur `"none"` dans le fichier de configuration `src/configs/optionsModifiers.ts`, le système applique **uniquement les multiplicateurs par défaut** sans tenir compte de la plage de prix. C'est le mode de calcul utilisé par défaut pour les pools autres que les pools concentré, où les fournisseurs de liquidité ne peuvent pas définir de plage de prix spécifique.

### Fonctionnement

Dans ce mode, le calcul est simplifié et utilise directement les multiplicateurs de base définis pour chaque token, les autres paramètres sont ignoré:

```text
// Pour toutes les positions actives et inactive
boost = multiplicateur_token × token quantity

```

### Exemples de calcul

En utilisant les données des scénarios disponibles dans `balancesREG_mock_examples.json` et avec les paramètres suivants définis dans `src/configs/optionsModifiers.ts`:

```typescript
{
  sushiswap: {
    default: {
      REG: 4, // Multiplicateur de base pour REG
      "*": 2 // Multiplicateur de base pour tous les autres tokens
    },
    v3: {
      priceRangeMode: "none",
    }
  }
}
```

#### Scénario 1 (0x111...111): 50% USDC / 50% REG, range 0.5$ à 1.5$

- Position active
- REG: 500 tokens × multiplicateur REG (4) = 2000
- USDC: 500 tokens équivalent REG × multiplicateur USDC (2) = 1000
- **Pouvoir de vote total: 3000**

#### Scénario 2 (0x222...222): 100% USDC, range 0.5$ à 0.99$

- Position inactive
- USDC: 1000 tokens équivalent REG × multiplicateur USDC (2) = 2000
- **Pouvoir de vote total: 2000**

#### Scénario 3 (0x333...333): 100% REG, range 1.01$ à 1.5$

- Position active
- REG: 1000 tokens × multiplicateur REG (4) = 4000
- **Pouvoir de vote total: 4000**

#### Scénario 4 (0x444...444): 100% USDC, range 0.01$ à 0.1$

- Position inactive
- USDC: 1000 tokens équivalent REG × multiplicateur USDC (2) = 2000
- **Pouvoir de vote total: 2000**

#### Scénario 5 (0x555...555): 100% REG, range 100$ à 110$

- Position inactive
- REG: 1000 tokens × multiplicateur REG (4) = 4000
- **Pouvoir de vote total: 4000**

### Analyse

Ce mode simplifié:

- Ne fait aucune distinction basée sur la centralité ou la proximité du prix actuel avec la plage
- Ne tient pas compte de la largeur de la plage
- Ne favorise pas les positions plus stratégiques
- Ne fait pas de distinction entre les positions actives/inactives
- Se concentre principalement sur le type de token fourni (REG vs autres tokens)
- le mode ouvre la porte a des stratégies de boost de pouvoir de vote inéficientes pour la DAO en placant la liquidité dans des zone de prix extrèmes limitant le risque pour les apporteurs de liquidité, mais innutilisable pour les acheteurs et vendeurs de REG.

C'est le mode le plus simple à comprendre, mais il ne récompense pas la liquidité fournie de manière plus stratégique comme le font les modes "centered" et "proximity".

## Mode "priceRangeMode: linear"

Lorsque le paramètre `priceRangeMode` est défini sur `"linear"` dans le fichier de configuration `src/configs/optionsModifiers.ts`, le système de calcul peux entrer dans 2 logiques de calcul en fonction du paramètre `boostMode` :

- `boostMode: centered` : le boost est calculé en fonction du centrage de la plage par rapport au prix actuel
- `boostMode: proximity` : le boost est calculé en fonction de la position relative du prix actuel par rapport au différents tranches de liquidités dans la plage

Les valeurs source utiliser pour le calcul peuvent etre soit `tick` soit `priceDecimals` a définir dans le paramètre `sourceValue` de l'objet `v3`

### Fonctionnement "boostMode: centered"

Dans ce mode, le calcul applique le boost maximum (paramètre `centerBoost`) en fonction du centrage de la plage par rapport au prix actuel.
Plus le prix est proche d'un coté ou de l'autre de la plage, plus le boost est faible (il y as de base pas de limitation sur la largeur de la plage).
Le paramètre `rangeWidthFactor` permet de limiter la largeur maximum ou demander une largeur minimum de la plage(Voir les infos spécifique sur ce paramètre [rangeWidthFactor](#explication-du-parametre-rangewidthfactor-dans-le-calcul-du-boost)).

Les positions inactives auront un facteur de boost soit de 1 par defaut soit la valeur définie par le paramètre `inactiveBoost`.

le paramètre `sourceValue` permet de définir la valeur source utiliser pour le calcul, il peux etre soit `tick` soit `priceDecimals` a définir dans l'objet `v3` (plus d'informaiton sur la parapètre dans la section dédier [sourceValue](#explication-du-parametre-sourcevalue-dans-le-calcul-du-pouvoir-de-vote)).

#### Exemples de calcul

En utilisant les données des scénarios disponibles dans `balancesREG_mock_examples.json` et avec les paramètres suivants définis dans `src/configs/optionsModifiers.ts`:

```typescript
{
  sushiswap: {
    default: {
      REG: 4, // Multiplicateur de base pour REG
      "*": 2 // Multiplicateur de base pour tous les autres tokens
    },
    v3: {
        sourceValue: "priceDecimals",
        priceRangeMode: "linear",
        boostMode: "centered",
        inactiveBoost: 0,
        centerBoost: 5,
        edgeBoost: 1,
    }
  }
}
```

#### Exemples détaillés de calcul de boost pour positions Uniswap V3 🔍

La configuration utilisée pour ces calculs est définie dans `optionsModifiers.ts` :

- `sourceValue: "priceDecimals"` (utilise les prix plutôt que les ticks)
- `priceRangeMode: "linear"` (variation linéaire du boost)
- `boostMode: "centered"` (favorise les positions centrées)
- `inactiveBoost: 0` (pas de boost pour les positions inactives)
- `centerBoost: 5` (boost maximal au centre de la plage)
- `edgeBoost: 1` (boost minimal aux extrémités de la plage)
- `rangeWidthFactor: 10987` (favorise les plages larges, valeur correspondant à la largeur en ticks de la plage du scénario 1)

#### Scénario 1 : 50% USDC / 50% REG, range 0.5$ à 1.5$

##### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 1.0$
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 500 tokens
- Balance USDC équivalent REG: 500 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (1.0 - 0.5) / 1.0 = 0.5
3. **Centrage (centeredness)** = 1 - |0.5 - 0.5| × 2 = 1.0 (position parfaitement centrée)
4. **Facteur de largeur (rangeWidthFactorBoost)** = max(1, 1.0 / 10987 × 10000) = 1.0
5. **Boost linéaire** = 1 + 1.0 × (5 - 1) = 5.0
6. **Boost final** = 5.0 × 1.0 = 5.0

##### Pouvoir de vote :

- REG: 500 × 5.0 (boost) × (4/4) = 2500
- USDC: 500 × 5.0 (boost) × (2/4) = 1250
- **Total : 3750**

#### Scénario 2 : 75% REG / 25% USDC, range 0.5$ à 1.5$

##### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 0.63$ (plus proche de la borne inférieure)
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 655.22 tokens
- Balance USDC: 217.18 tokens (équivalent à 344.78 REG au prix de 0.63$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (0.63 - 0.5) / 1.0 = 0.13
3. **Centrage (centeredness)** = 1 - |0.13 - 0.5| × 2 = 1 - 0.74 = 0.26 (plus proche de l'extrémité)
4. **Facteur de largeur (rangeWidthFactorBoost)** = max(1, 1.0 / 10987 × 10000) = 1.0
5. **Boost linéaire** = 1 + 0.26 × (5 - 1) = 1 + 0.26 × 4 = 1 + 1.04 = 2.04
6. **Boost final** = 2.04 × 1.0 = 2.04

##### Pouvoir de vote :

- REG: 655.22 × 2.04 (boost) × (4/4) = 1336.65
- USDC: 217.18 × 2.04 (boost) × (2/4) = 221.52
- **Total : 1558.17** (arrondi à 1558)

#### Scénario 3 : 25% REG / 75% USDC, range 0.5$ à 1.5$

##### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 1.22$ (plus proche de la moyenne)
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 289.32 tokens
- Balance USDC: 867.44 tokens (équivalent à 710.68 REG au prix de 1.22$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (1.22 - 0.5) / 1.0 = 0.72
3. **Centrage (centeredness)** = 1 - |0.72 - 0.5| × 2 = 1 - 0.44 = 0.56 (moyennement centré)
4. **Facteur de largeur (rangeWidthFactorBoost)** = max(1, 1.0 / 10987 × 10000) = 1.0
5. **Boost linéaire** = 1 + 0.56 × (5 - 1) = 1 + 0.56 × 4 = 1 + 2.24 = 3.24
6. **Boost final** = 3.24 × 1.0 = 3.24

##### Pouvoir de vote :

- REG: 289.32 × 3.24 (boost) × (4/4) = 937.40
- USDC: 867.44 × 3.24 (boost) × (2/4) = 1405.25
- **Total : 2342.65** (arrondi à 2343)

#### Scénario 4 : 100% USDC, range 0.5$ à 0.99$

##### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.5$
- Prix max: 0.99$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

- Position inactive → boost = inactiveBoost = 0

##### Pouvoir de vote :

- USDC: 1000 × 0 (boost) \* factorREGtoOtherToken (2/4) = 0
- **Total : 0**

#### Scénario 5 : 100% REG, range 1.01$ à 1.5$

##### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 1.01$
- Prix max: 1.5$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

- Position inactive → boost = inactiveBoost = 0

##### Pouvoir de vote :

- REG: 1000 × 0 (boost) \* factorREGtoOtherToken (4/4) = 0
- **Total : 0**

#### Scénario 6 : 100% USDC, range 0.01$ à 0.1$

##### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.01$
- Prix max: 0.1$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

- Position inactive → boost = inactiveBoost = 0

##### Pouvoir de vote :

- USDC: 1000 × 0 (boost) \* factorREGtoOtherToken (2/4) = 0
- **Total : 0**

#### Scénario 7 : 100% REG, range 100$ à 110$

##### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 100$
- Prix max: 110$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

- Position inactive → boost = inactiveBoost = 0

##### Pouvoir de vote :

- REG: 1000 × 0 (boost) \* factorREGtoOtherToken (4/4) = 0
- **Total : 0**

#### Résumé des résultats

| Scénario | Description                     | État    | Prix  | Centrage | Boost REG | Boost USDC | Pouvoir de vote |
| -------- | ------------------------------- | ------- | ----- | -------- | --------- | ---------- | --------------- |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$ | Actif   | 1.00$ | 1.00     | 5.00      | 2.50       | 3750            |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$ | Actif   | 0.63$ | 0.26     | 2.04      | 1.02       | 1558            |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$ | Actif   | 1.22$ | 0.56     | 3.24      | 1.62       | 2343            |
| 4        | 100% USDC, 0.5$ à 0.99$         | Inactif | 1.00$ | -        | 0         | 0          | 0               |
| 5        | 100% REG, 1.01$ à 1.5$          | Inactif | 1.00$ | -        | 0         | 0          | 0               |
| 6        | 100% USDC, 0.01$ à 0.1$         | Inactif | 1.00$ | -        | 0         | 0          | 0               |
| 7        | 100% REG, 100$ à 110$           | Inactif | 1.00$ | -        | 0         | 0          | 0               |

**Notes importantes :**

1. Avec `inactiveBoost: 0`, toutes les positions inactives ont un pouvoir de vote nul. Si cette valeur était modifiée (par exemple à 0.5), ces positions conserveraient une partie de leur pouvoir de vote même lorsque le prix est en dehors de leur plage.
2. Bien que le scénario 1 montre une répartition égale entre REG et USDC, il s'agit d'une simplification pour la démonstration. Pour une plage [0.5$ - 1.5$] à un prix de 1.0$, un pool Uniswap V3 contiendrait normalement environ 38.5% REG et 61.5% USDC.
3. Les scénarios 2 et 3 montrent l'impact du prix actuel sur le calcul du centrage et du boost: plus le prix s'éloigne du centre de la plage, plus le boost diminue, même si la plage reste la même.
4. Pour rappel, un REG doit toujours donner du pouvoir de vote, quelle que soit son utilisation. Il est donc généralement préférable de ne pas mettre le paramètre `inactiveBoost` à 0.

### Fonctionnement "boostMode: proximity"

Dans ce mode, le calcul

## Mode "priceRangeMode: exponential"

Lorsque le paramètre `priceRangeMode` est défini sur `"exponential"` dans le fichier de configuration `src/configs/optionsModifiers.ts`, le système de calcul utilise une fonction exponentielle pour accentuer davantage les différences de boost en fonction du centrage.

De même que pour le mode "linear", il peut fonctionner avec deux logiques de calcul en fonction du paramètre `boostMode` :

- `boostMode: centered` : le boost est calculé en fonction du centrage de la plage par rapport au prix actuel, avec une variation exponentielle
- `boostMode: proximity` : le boost est calculé en fonction de la position relative du prix actuel par rapport aux différentes tranches de liquidités dans la plage

### Fonctionnement "boostMode: centered"

Dans ce mode, le calcul applique le boost maximum (paramètre `centerBoost`) au centre exact de la plage de prix, et un boost minimum (paramètre `edgeBoost`) aux extrémités de la plage.

La principale différence avec le mode "linear" est que la variation entre ces deux valeurs suit une courbe exponentielle au lieu d'une ligne droite, ce qui accentue davantage l'avantage d'être proche du centre. Cette variation est contrôlée par le paramètre `exponent` :

- Plus la valeur de `exponent` est élevée, plus la courbe est "abrupte", renforçant l'avantage d'être au centre exact
- Plus la valeur de `exponent` est basse (mais > 1), plus la courbe est "douce", répartissant le boost de manière plus équilibrée

Le paramètre `rangeWidthFactor` fonctionne de la même manière que pour le mode "linear" pour limiter ou valoriser la largeur de la plage.

#### Exemples de calcul

En utilisant les données des scénarios disponibles dans `balancesREG_mock_examples.json` et avec les paramètres suivants définis dans `src/configs/optionsModifiers.ts`:

```typescript
{
  sushiswap: {
    default: {
      REG: 4, // Multiplicateur de base pour REG
      "*": 2 // Multiplicateur de base pour tous les autres tokens
    },
    v3: {
        sourceValue: "priceDecimals",
        priceRangeMode: "exponential",
        boostMode: "centered",
        inactiveBoost: 1,
        centerBoost: 5,
        edgeBoost: 1,
        exponent: 3,
    }
  }
}
```

#### Exemples détaillés de calcul de boost pour positions Uniswap V3 avec mode exponentiel 🔍

La configuration utilisée pour ces calculs est définie dans `optionsModifiers.ts` :

- `sourceValue: "priceDecimals"` (utilise les prix plutôt que les ticks)
- `priceRangeMode: "exponential"` (variation exponentielle du boost)
- `boostMode: "centered"` (favorise les positions centrées)
- `inactiveBoost: 1` (boost minimal pour les positions inactives)
- `centerBoost: 5` (boost maximal au centre de la plage)
- `edgeBoost: 1` (boost minimal aux extrémités de la plage)
- `exponent: 3` (contrôle la courbure de la fonction exponentielle)

#### Scénario 1 : 50% USDC / 50% REG, range 0.5$ à 1.5$

##### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 1.0$
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 500 tokens
- Balance USDC équivalent REG: 500 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (1.0 - 0.5) / 1.0 = 0.5
3. **Centrage (centeredness)** = 1 - |0.5 - 0.5| × 2 = 1.0 (position parfaitement centrée)
4. **Facteur de largeur (rangeWidthFactorBoost)** = max(1, 1.0 / (pas de rangeWidthFactor défini)) = 1.0
5. **Boost exponentiel** = 1 + Math.pow(1.0, 3) × (5 - 1) = 1 + 1.0 × 4 = 5.0
6. **Boost final** = 5.0 × 1.0 = 5.0

##### Pouvoir de vote :

- REG: 500 × 5.0 (boost) × (4/4) = 2500
- USDC: 500 × 5.0 (boost) × (2/4) = 1250
- **Total : 3750**

#### Scénario 2 : 75% REG / 25% USDC, range 0.5$ à 1.5$

##### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 0.63$ (plus proche de la borne inférieure)
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 655.22 tokens
- Balance USDC: 217.18 tokens (équivalent à 344.78 REG au prix de 0.63$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (0.63 - 0.5) / 1.0 = 0.13
3. **Centrage (centeredness)** = 1 - |0.13 - 0.5| × 2 = 1 - 0.74 = 0.26 (plus proche de l'extrémité)
4. **Facteur de largeur (rangeWidthFactorBoost)** = 1.0
5. **Boost exponentiel** = 1 + Math.pow(0.26, 3) × (5 - 1) = 1 + 0.018 × 4 = 1.07
6. **Boost final** = 1.07 × 1.0 = 1.07

##### Pouvoir de vote :

- REG: 655.22 × 1.07 (boost) × (4/4) = 701.09
- USDC: 217.18 × 1.07 (boost) × (2/4) = 116.19
- **Total : 817.28** (arrondi à 817)

#### Scénario 3 : 25% REG / 75% USDC, range 0.5$ à 1.5$

##### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 1.22$ (plus proche de la moyenne)
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 289.32 tokens
- Balance USDC: 867.44 tokens (équivalent à 710.68 REG au prix de 1.22$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (1.22 - 0.5) / 1.0 = 0.72
3. **Centrage (centeredness)** = 1 - |0.72 - 0.5| × 2 = 1 - 0.44 = 0.56 (moyennement centré)
4. **Facteur de largeur (rangeWidthFactorBoost)** = 1.0
5. **Boost exponentiel** = 1 + Math.pow(0.56, 3) × (5 - 1) = 1 + 0.176 × 4 = 1 + 0.704 = 1.70
6. **Boost final** = 1.70 × 1.0 = 1.70

##### Pouvoir de vote :

- REG: 289.32 × 1.70 (boost) × (4/4) = 491.84
- USDC: 867.44 × 1.70 (boost) × (2/4) = 737.32
- **Total : 1229.16** (arrondi à 1229)

#### Scénario 4 : 100% USDC, range 0.5$ à 0.99$

##### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.5$
- Prix max: 0.99$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

##### Pouvoir de vote :

- USDC: 1000 × 1 (boost) × (2/4) = 500
- **Total : 500**

#### Scénario 5 : 100% REG, range 1.01$ à 1.5$

##### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 1.01$
- Prix max: 1.5$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

##### Pouvoir de vote :

- REG: 1000 × 1 (boost) × (4/4) = 1000
- **Total : 1000**

#### Scénario 6 : 100% USDC, range 0.01$ à 0.1$

##### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.01$
- Prix max: 0.1$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

##### Pouvoir de vote :

- USDC: 1000 × 1 (boost) × (2/4) = 500
- **Total : 500**

#### Scénario 7 : 100% REG, range 100$ à 110$

##### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 100$
- Prix max: 110$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

##### Pouvoir de vote :

- REG: 1000 × 1 (boost) × (4/4) = 1000
- **Total : 1000**

#### Résumé des résultats

| Scénario | Description                     | État    | Prix  | Centrage | Boost REG | Boost USDC | Pouvoir de vote |
| -------- | ------------------------------- | ------- | ----- | -------- | --------- | ---------- | --------------- |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$ | Actif   | 1.00$ | 1.00     | 5.00      | 2.50       | 3750            |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$ | Actif   | 0.63$ | 0.26     | 1.07      | 0.54       | 817             |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$ | Actif   | 1.22$ | 0.56     | 1.70      | 0.85       | 1229            |
| 4        | 100% USDC, 0.5$ à 0.99$         | Inactif | 1.00$ | -        | 1         | 0.50       | 500             |
| 5        | 100% REG, 1.01$ à 1.5$          | Inactif | 1.00$ | -        | 1         | 0.50       | 1000            |
| 6        | 100% USDC, 0.01$ à 0.1$         | Inactif | 1.00$ | -        | 1         | 0.50       | 500             |
| 7        | 100% REG, 100$ à 110$           | Inactif | 1.00$ | -        | 1         | 0.50       | 1000            |

**Notes importantes :**

1. Avec `inactiveBoost: 1`, toutes les positions inactives ont un pouvoir de vote égal à leur balance multipliée par le multiplicateur de base du token.
2. Contrairement au mode "linear", l'accentuation exponentielle (avec `exponent: 3`) crée une chute beaucoup plus rapide du boost lorsqu'on s'éloigne du centre exact.
3. On observe cette chute exponentielle clairement dans les scénarios 2 et 3 : malgré un centrage de 0.26 et 0.56 respectivement, leurs boosts (1.07 et 1.70) sont considérablement plus faibles que le boost maximal de 5.0 obtenu au centre parfait.
4. Cette configuration privilégie fortement les positions qui sont précisément centrées autour du prix actuel, ce qui encourage un comportement très stratégique dans le choix des plages de prix.
5. L'exposant 3 utilisé dans la configuration actuelle crée une courbe assez "sévère" - des valeurs plus basses comme 2 créeraient une transition plus douce entre le centre et les bords.

### Fonctionnement "boostMode: proximity"

Dans ce mode, le calcul

---

## Mode "priceRangeMode: step"

Lorsque le paramètre `priceRangeMode` est défini sur `"step"` dans le fichier de configuration `src/configs/optionsModifiers.ts`, le système utilise une approche par paliers pour le calcul du boost. Au lieu d'une variation continue (linéaire ou exponentielle), ce mode divise la plage de prix en zones distinctes avec des niveaux de boost prédéfinis.

### Fonctionnement "boostMode: centered"

Dans ce mode, le calcul du boost est basé sur la distance au centre de la plage (variable `centeredness`), avec des valeurs de boost spécifiques attribuées à différents niveaux de centrage.

#### Principes clés du mode "step":

1. **Paliers de centrage**: Le paramètre `steps` définit des paires `[threshold, boostValue]` où:

   - `threshold` est un seuil de centrage entre 0 et 1 (0 = extrémités, 1 = centre parfait)
   - `boostValue` est le multiplicateur de boost appliqué lorsque le centrage est supérieur ou égal à ce seuil

2. **Application des paliers**: Le système trouve le palier le plus élevé dont le seuil est inférieur ou égal au centrage actuel de la position

3. **Facteur de largeur**: Si `rangeWidthFactor` est défini, il est appliqué comme multiplicateur au boost déterminé par les paliers

#### Exemples de calcul

En utilisant les données des scénarios disponibles dans `balancesREG_mock_examples.json` et avec les paramètres suivants définis dans `src/configs/optionsModifiers.ts`:

```typescript
{
  sushiswap: {
    default: {
      REG: 4, // Multiplicateur de base pour REG
      "*": 2 // Multiplicateur de base pour tous les autres tokens
    },
    v3: {
        sourceValue: "priceDecimals",
        priceRangeMode: "step",
        boostMode: "centered",
        inactiveBoost: 1,
        edgeBoost: 1, // Boost minimal par défaut
        steps: [
          [0.2, 1.5], // Si centrage ≥ 20%, boost = 1.5
          [0.5, 3.0], // Si centrage ≥ 50%, boost = 3.0
          [0.8, 4.0], // Si centrage ≥ 80%, boost = 4.0
          [1.0, 5.0], // Si centrage = 100%, boost = 5.0
        ],
    }
  }
}
```

#### Exemples détaillés de calcul de boost pour positions Uniswap V3 avec mode step 🔍

La configuration utilisée pour ces calculs est définie dans `optionsModifiers.ts` comme indiqué ci-dessus.

#### Scénario 1 : 50% USDC / 50% REG, range 0.5$ à 1.5$

##### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 1.0$
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 500 tokens
- Balance USDC équivalent REG: 500 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (1.0 - 0.5) / 1.0 = 0.5
3. **Centrage (centeredness)** = 1 - |0.5 - 0.5| × 2 = 1.0 (position parfaitement centrée)
4. **Palier applicable** = 1.0 ≥ 1.0 → boost = 5.0
5. **Boost final** = 5.0

##### Pouvoir de vote :

- REG: 500 × 5.0 (boost) × (4/4) = 2500
- USDC: 500 × 5.0 (boost) × (2/4) = 1250
- **Total : 3750**

#### Scénario 2 : 75% REG / 25% USDC, range 0.5$ à 1.5$

##### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 0.63$ (plus proche de la borne inférieure)
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 655.22 tokens
- Balance USDC: 217.18 tokens (équivalent à 344.78 REG au prix de 0.63$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (0.63 - 0.5) / 1.0 = 0.13
3. **Centrage (centeredness)** = 1 - |0.13 - 0.5| × 2 = 1 - 0.74 = 0.26 (plus proche de l'extrémité)
4. **Palier applicable** = 0.26 ≥ 0.2 → boost = 1.5
5. **Boost final** = 1.5

##### Pouvoir de vote :

- REG: 655.22 × 1.5 (boost) × (4/4) = 982.83
- USDC: 217.18 × 1.5 (boost) × (2/4) = 162.89
- **Total : 1145.72** (arrondi à 1146)

#### Scénario 3 : 25% REG / 75% USDC, range 0.5$ à 1.5$

##### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 1.22$ (plus proche de la moyenne)
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 289.32 tokens
- Balance USDC: 867.44 tokens (équivalent à 710.68 REG au prix de 1.22$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (1.22 - 0.5) / 1.0 = 0.72
3. **Centrage (centeredness)** = 1 - |0.72 - 0.5| × 2 = 1 - 0.44 = 0.56 (moyennement centré)
4. **Palier applicable** = 0.56 ≥ 0.5 → boost = 3.0
5. **Boost final** = 3.0

##### Pouvoir de vote :

- REG: 289.32 × 3.0 (boost) × (4/4) = 867.96
- USDC: 867.44 × 3.0 (boost) × (2/4) = 1301.16
- **Total : 2169.12** (arrondi à 2169)

#### Scénario 4 : 100% USDC, range 0.5$ à 0.99$

##### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.5$
- Prix max: 0.99$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

##### Pouvoir de vote :

- USDC: 1000 × 1 (boost) × (2/4) = 500
- **Total : 500**

#### Scénario 5 : 100% REG, range 1.01$ à 1.5$

##### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 1.01$
- Prix max: 1.5$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

##### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

##### Pouvoir de vote :

- REG: 1000 × 1 (boost) × (4/4) = 1000
- **Total : 1000**

#### Résumé des résultats

| Scénario | Description                     | État    | Prix  | Centrage | Palier | Boost REG | Boost USDC | Pouvoir de vote |
| -------- | ------------------------------- | ------- | ----- | -------- | ------ | --------- | ---------- | --------------- |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$ | Actif   | 1.00$ | 1.00     | 1.0    | 5.00      | 2.50       | 3750            |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$ | Actif   | 0.63$ | 0.26     | 0.2    | 1.50      | 0.75       | 1146            |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$ | Actif   | 1.22$ | 0.56     | 0.5    | 3.00      | 1.50       | 2169            |
| 4        | 100% USDC, 0.5$ à 0.99$         | Inactif | 1.00$ | -        | -      | 1.00      | 0.50       | 500             |
| 5        | 100% REG, 1.01$ à 1.5$          | Inactif | 1.00$ | -        | -      | 1.00      | 0.50       | 1000            |
| 6        | 100% USDC, 0.01$ à 0.1$         | Inactif | 1.00$ | -        | -      | 1.00      | 0.50       | 500             |
| 7        | 100% REG, 100$ à 110$           | Inactif | 1.00$ | -        | -      | 1.00      | 0.50       | 1000            |

**Notes importantes :**

1. Le mode step crée une courbe de boost en "escalier" avec des transitions brusques entre les paliers, contrairement aux modes linéaire et exponentiel qui ont des transitions progressives.

2. Ce mode est particulièrement utile pour encourager des comportements spécifiques :

   - On peut créer des "zones cibles" où les fournisseurs de liquidité sont fortement récompensés
   - Il permet de définir des politiques de boost plus précises avec des changements de comportement marqués à certains seuils

3. Dans l'exemple ci-dessus, les paliers sont définis comme suit :

   - Centre exact (100% centré) : boost ×5
   - Zone centrale (≥80% centré) : boost ×4
   - Zone intermédiaire (≥50% centré) : boost ×3
   - Zone périphérique (≥20% centré) : boost ×1.5
   - Extrémités (<20% centré) : boost ×1 (valeur par défaut edgeBoost)

4. Ce mode permet aussi d'implémenter des stratégies "tout ou rien" en définissant des écarts importants entre les paliers.

5. Si un `rangeWidthFactor` est défini, il sera appliqué comme un multiplicateur supplémentaire au boost déterminé par les paliers, permettant de favoriser les plages larges ou étroites selon la valeur choisie.

### Fonctionnement "boostMode: proximity"

Dans ce mode, le calcul

---

## Explication du paramètre `sourceValue` dans le calcul du pouvoir de vote 🔍

### Contexte du problème

Suivant le type de source utiliser un meme calcul pour le scénario 1, où le prix est à 1$ dans une plage de 0.5$ à 1.5$ peux donner des résultats différents, dans ce cas précis, l'utilisateur peux s'atendre à un résultat de centrage de 100% ou 50% suivant la forme du calcul, ça serais une réponse logique et totalement jusitifier dans le cas d'un calcul sur le prix en $.

Toutefois, le calcul baser sur les ticks donnerais pour le meme scénario un résultat de centrage de 63%, cela s'explique par le fait que les ticks suivent une échelle logarithmique.

### Analyse du paramètre `sourceValue` 🧩

Le paramètre `sourceValue` dans `optionsModifiers.ts` joue un rôle crucial car il définit la base de calcul pour le boost :

```javascript
v3: {
  sourceValue: "priceDecimals", // Ou "tick"
  priceRangeMode: "linear",
  // autres paramètres...
}
```

#### Deux modes de calcul possibles :

1. **`sourceValue: "tick"`** :

   - Utilise directement les valeurs de ticks Uniswap (ex: -276324, -283256, -272269)
   - Les ticks suivent une échelle **logarithmique** liée aux prix

2. **`sourceValue: "priceDecimals"`** :
   - Utilise les valeurs de prix (ex: 1.0$, 0.5$, 1.5$)
   - Les prix suivent une échelle **linéaire** arithmétique

### Impact sur les calculs dans `v3BoostCalculator.ts` ⚙️

#### Calculs des valeurs clés

Avec les données du scénario 1 :

- `currentTick` = -276324 (prix actuel de 1.0$)
- `tickLower` = -283256 (prix min de 0.5$)
- `tickUpper` = -272269 (prix max de 1.5$)

##### 1. Avec `sourceValue: "tick"` :

- `valueWidth` = 10987
- `relativePosition` ≈ 0.6309 (63% entre bornes inf. et sup. des ticks)
- `centeredness` ≈ 0.7381 (≠ 1.0)

##### 2. Avec `sourceValue: "priceDecimals"` :

- `valueWidth` = 1.0 (1.5 - 0.5)
- `relativePosition` = 0.5 (1.0 est exactement au milieu de 0.5 et 1.5)
- `centeredness` = 1.0 (position parfaitement centrée)

### Explication de la différence 🤔

La discordance s'explique par la relation `logarithmique` entre ticks et prix dans Uniswap V3 :

```text
prix = 1.0001^tick × facteur_ajustement_décimales
```

En conséquence :

- Le prix central arithmétique (1.0$) correspond au tick -276324
- Le tick central arithmétique (-277762.5) correspond au prix ~0.866$

### Conclusion et recommandations 💡

- Pour un boost basé sur la proximité `arithmétique` au centre de la plage de prix, utilisez `sourceValue: "priceDecimals"`
- Pour un boost tenant compte de la distribution `logarithmique` de la liquidité dans Uniswap V3, utilisez `sourceValue: "tick"`

Le choix du `sourceValue` dépend donc de la logique économique que vous souhaitez appliquer à votre système de boost.

## Explication du paramètre `rangeWidthFactor` dans le calcul du boost 📏

### Définition et rôle

Le paramètre `rangeWidthFactor` est un élément crucial du calcul de boost pour les positions Uniswap V3. Il permet d'ajuster l'importance de la largeur de la plage de prix dans le calcul du multiplicateur final.

```javascript
rangeWidthFactor: 10987, // Valeur en nombre de ticks
```

### Fonctionnement dans le code

Dans `src/utils/v3BoostCalculator.ts`, ce paramètre est utilisé pour calculer le modificateur de largeur de plage :

```javascript
const rangeWidthFactorBoost =
  rangeWidthFactor > 0 ? Math.max(1, valueWidth / rangeWidthFactor) : Math.max(1, (rangeWidthFactor / valueWidth) * -1);
```

### Impact selon la valeur

#### Valeurs positives (favorise les plages larges)

- Définit un seuil minimal de ticks pour obtenir un boost maximum
- Si `valueWidth > rangeWidthFactor` : le boost augmente
- Si `valueWidth < rangeWidthFactor` : le boost est réduit
- Plus la plage est large par rapport au facteur, plus le boost est important

#### Valeurs négatives (favorise les plages étroites)

- Définit un seuil maximal de ticks pour obtenir un boost maximum
- Si `|valueWidth| < |rangeWidthFactor|` : le boost augmente
- Si `|valueWidth| > |rangeWidthFactor|` : le boost est réduit
- Plus la plage est étroite par rapport au facteur, plus le boost est important

### Exemples pratiques

#### Avec rangeWidthFactor positif = 10000

- Position avec largeur de 5000 ticks : boost × (5000/10000) = boost × 0.5
- Position avec largeur de 20000 ticks : boost × (20000/10000) = boost × 2.0

#### Avec rangeWidthFactor négatif = -10000

- Position avec largeur de 5000 ticks : boost × (|-10000|/5000) = boost × 2.0
- Position avec largeur de 20000 ticks : boost × (|-10000|/20000) = boost × 0.5

### Considérations stratégiques 🧠

Le choix de la valeur de `rangeWidthFactor` reflète une stratégie économique :

- **Valeur positive élevée** : encourage les utilisateurs à fournir de la liquidité sur une large plage de prix, contribuant à une meilleure stabilité du marché
- **Valeur négative élevée** : encourage les positions concentrées, ce qui peut être préférable pour maximiser l'efficacité du capital mais peut entraîner une volatilité accrue

! rangeWidthFactor peux ne pas etre défini, dans ce cas il n'y as pas de prise en compte de la largeur de la plage dans le calcul du boost.

### Relation avec sourceValue

Le comportement de `rangeWidthFactor` est directement influencé par le paramètre `sourceValue` :

- Avec `sourceValue: "tick"` : le facteur s'applique aux plages en ticks (échelle logarithmique)
- Avec `sourceValue: "priceDecimals"` : le facteur s'applique aux plages de prix (échelle linéaire)

Cette distinction est importante car une même amplitude de prix peut correspondre à des largeurs de ticks très différentes selon la zone de prix.

---

**N'hésitez pas à adapter les paramètres selon la politique de gouvernance souhaitée !**
