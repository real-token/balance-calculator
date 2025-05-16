# Introduction aux boosts pour pools v3 (USDC/REG)

## Présentation

Ce document illustre, à travers des exemples concrets, l'impact des différents paramètres de configuration des boosts pour les pools v3 (Uniswap/Sushiswap v3) sur un pool USDC/REG, avec un prix du REG génralement fixé à **1$**. Chaque scénario présente une position extrême, le détail des paramètres utilisés, les étapes de calcul du boost (pour les modes "centered" et "proximity"), et une analyse de l'influence des paramètres.

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
        // Par défaut "centered" si non spécifié explicitement dans la logique d'appel (voir calculateV3Boost)
        boostMode?: BoostModeType;

        // Boost maximum (au centre ou au prix actuel selon le mode)
        maxBoost?: number;

        // Boost minimum (aux extrémités ou loin du prix selon le mode)
        minBoost?: number;

        // Exposant pour la formule exponentielle (mode "exponential")
        exponent?: number;

        // Facteur d'influence de la largeur de la plage (mode "centered")
        // S'il n'est pas fourni, il prend la valeur 1 par défaut dans les calculs (params.rangeWidthFactor ?? 1).
        // Une valeur de 0 est invalide et traitée comme non fournie ou provoque une erreur selon la validation.
        rangeWidthFactor?: number;

        // Boost de base pour les positions inactives (hors plage de prix, mode "centered")
        // Si non défini, utilise `params.minBoost` ou `DEFAULT_BOOST_FACTOR` (1) par défaut.
        inactiveBoost?: number;

        // Paliers pour le mode "step"
        // En mode "centered": [seuilDeCentrage (0 à 1), valeurDeBoost]
        // En mode "proximity": [progressionDeDécroissance (0 à x), valeurDeBoost]
        steps?: Array<[number, number]>;

        // Paramètres spécifiques au mode "proximity"
        // Taille de chaque tranche.
        // Par défaut = 1 si sourceValue = "tick", 0.1 si sourceValue = "priceDecimals".
        sliceWidth?: number;
        // Nombre de tranches pour atteindre minBoost depuis maxBoost.
        // Utilisé si decaySlicesDown et decaySlicesUp ne sont pas spécifiés.
        decaySlices?: number;
        // Nombre de tranches pour atteindre minBoost depuis maxBoost (du prix vers le bas).
        // Requis si decaySlices n'est pas fourni pour le mode proximity avec linear/exponential.
        decaySlicesDown?: number;
        // Nombre de tranches pour atteindre minBoost depuis maxBoost (du prix vers le haut).
        // Requis si decaySlices n'est pas fourni pour le mode proximity avec linear/exponential.
        decaySlicesUp?: number;
        // Définit si on calcule le boost pour les positions hors range (mode "proximity").
        // Par défaut = true (params.outOfRangeEnabled !== false).
        outOfRangeEnabled?: boolean;
      }
    }
  }
}
```

**Important:** Si un paramètre optionnel n'est pas précisé dans la configuration, sa valeur par défaut sera utilisée comme indiqué dans la description de chaque paramètre ci-dessus et dans le code (`src/utils/v3BoostCalculator.ts`). Par exemple, `rangeWidthFactor` dans `calculateCenteredBoost` prend la valeur `1` s'il n'est pas fourni (`params.rangeWidthFactor ?? 1`), ce qui signifie que le `rangeWidthFactorBoost` sera `Math.max(1, valueWidth / 1)`. La largeur de la plage est donc toujours prise en compte dans ce cas. Une valeur de `0` pour `rangeWidthFactor` est considérée comme invalide par la fonction de validation `validateV3BoostParamsForBoostFormula`.

## Chemin d'appel pour le calcul du boost v3

```typescript
| src/tasks/CalculatePowerVotingREG.ts -> (L55) const normalizedData = selectedModel.normalize(jsonData, optionsModifiers);
-| src/models/inputModels.ts -> (L42) datas = applyModifiers(datas, options);
--| src/models/inputModels.ts -> (L22) modifiedData = modifiers[key as keyof typeof modifiers](modifiedData, value);
---| src/modifiers/index.ts -> // Le modifier est appelé en fonction de la clé passée à l'étape précédente
----| src/modifiers/boosBalancesDexs.ts -> (L14) function boostBalancesDexs(data: SourceBalancesREG[], options: NormalizeOptions["boostBalancesDexs"]): SourceBalancesREG[]
```

La fonction `boostBalancesDexs` effectue les calculs des boosts pour chaque type de position en s'adaptant aux types de pools.
L'ordre d'appel des modifiers est déterminé par l'ordre des clés dans l'objet du fichier `src/configs/optionsModifiers.ts`.
L'objet `optionsModifiers` contient en clé primaire les noms des fonction modifiers à appeler et détermine donc l'ordre d'appel des modifiers. Pour le boost des balances des DEX, la clé est `boostBalancesDexs`, c'est un objet dont les clés de second niveau sont les noms des DEX.
Pour les DEX à liquidité concentrée, il y a 2 clés de troisième niveau:

- `default`: pour les calculs de boost traditionnel type v2 (si utilisé comme tel)
- `v3`: pour les paramètres de configuration des boosts v3

Dans le cas des pools concentrés, les clés dans l'objet `v3` varient en fonction du mode de boost choisi et du résultat escompté.
Des exemples sont fournis pour chaque mode de boost.

## Les différents modes priceRangeMode

Le paramètre `priceRangeMode` est le plus important car il détermine la logique fondamentale du calcul des boosts. Ce document détaille chaque mode disponible, ses cas d'usage et son fonctionnement.

### Mode "none"

Mode le plus simple où les boosts appliqués ne dépendent pas de la plage de prix mais simplement du nombre de REG ou tokens équivalents REG. Tous les pools v2 ou similaires utilisent ce mode par défaut. Pour les pools à liquidité concentrée (type Uniswap v3), ce mode sert de référence, mais d'autres modes sont disponibles pour mieux s'adapter aux spécificités de ces pools.

### Mode "linear"

Mode avec une relation linéaire de l'ajustement du boost, les autres paramètres peuvent être utilisés pour ajuster la pente et la portée de la diminution du boost.

### Mode "exponential"

Mode utilisant une fonction exponentielle pour accentuer les différences, semblable au mode "linear" mais avec une diminution du boost en courbe ajustable par les autres paramètres.

### Mode "step"

Mode utilisant des paliers prédéfinis pour attribuer des boosts en fonction du positionnement dans la plage dans les steps. Permet un contrôle précis des niveaux de boost à différentes positions relatives. Permet des stratégies de boost par zone de prix.

## Éléments communs à tous les exemples

Voici les éléments communs à tous les exemples qui sont présentés dans la suite de ce document:

- Fichier de données utilisateur (données d'exemple): `balancesREG_mock_examples.json`
- **Prix du REG** : 1$
- **Prix du USDC** : 1$
- **Token0** : REG (décimales 18)
- **Token1** : USDC (décimales 6)
- **Multiplicateur REG** : 4
- **Multiplicateur USDC** : 2

Les positions inactives auront un facteur de boost soit de 1 par défaut soit la valeur définie par le paramètre `inactiveBoost`.

Le paramètre `sourceValue` permet de définir la valeur source utilisée pour le calcul, il peut être soit `tick` soit `priceDecimals` à définir dans l'objet `v3` (plus d'information sur ce paramètre dans la section dédiée dans l'annexe et dans le chapitre [Calcul des ticks et prix dans Uniswap V3](./08-ticks-et-prix.md)).
