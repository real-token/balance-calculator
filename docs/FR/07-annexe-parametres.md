# Annexe : Explications détaillées des paramètres importants

Cette annexe fournit une explication approfondie des paramètres de configuration utilisés dans les différents modes de calcul du boost pour les pools v3.

## 🔍 Structure de configuration

La configuration des boosts est définie dans le fichier `src/configs/optionsModifiers.ts` et suit la structure suivante :

```typescript
{
  [dexName: string]: { // Par exemple "uniswap", "sushiswap"
    default: {
      [tokenSymbol: string]: number, // Multiplicateurs par défaut
      "*": number // Multiplicateur pour tous les autres tokens
    },
    v3?: { // Configuration spécifique aux pools v3
      sourceValue: "tick" | "priceDecimals", // Source des valeurs pour le calcul
      priceRangeMode: "none" | "linear" | "exponential" | "step", // Mode de calcul
      boostMode: "centered" | "proximity", // Base du calcul
      // Autres paramètres spécifiques au mode
    }
  }
}
```

## 🧩 Paramètres communs à tous les modes

### Paramètres de base

| Paramètre        | Type   | Description                                   | Valeurs typiques                                                   |
| ---------------- | ------ | --------------------------------------------- | ------------------------------------------------------------------ |
| `sourceValue`    | string | Format des valeurs utilisées pour les calculs | `"tick"` (valeurs brutes) ou `"priceDecimals"` (prix en décimales) |
| `priceRangeMode` | string | Mode de calcul du boost                       | `"none"`, `"linear"`, `"exponential"`, `"step"`                    |
| `boostMode`      | string | Base du calcul                                | `"centered"` (centrage) ou `"proximity"` (proximité)               |
| `minBoost`       | number | Boost minimal appliqué                        | Typiquement 1                                                      |
| `maxBoost`       | number | Boost maximal (non utilisé dans le mode step) | Typiquement entre 2 et 10                                          |
| `inactiveBoost`  | number | Boost appliqué aux positions inactives        | Généralement 1                                                     |

### Paramètres pour le calcul centré (`boostMode: "centered"`)

| Paramètre          | Type   | Description                                    | Valeurs typiques                                |
| ------------------ | ------ | ---------------------------------------------- | ----------------------------------------------- |
| `rangeWidthFactor` | number | Multiplicateur basé sur la largeur de la plage | Entre 0 et 1 pour favoriser les plages étroites |
| `exponent`         | number | Exposant pour le mode exponentiel              | Typiquement 2                                   |
| `steps`            | array  | Paliers de boost pour le mode step             | Paires `[threshold, boostValue]`                |

### Paramètres pour le calcul par proximité (`boostMode: "proximity"`)

| Paramètre           | Type    | Description                                        | Valeurs typiques               |
| ------------------- | ------- | -------------------------------------------------- | ------------------------------ |
| `sliceWidth`        | number  | Largeur des tranches pour le calcul                | 0.05 à 0.1 (en unités de prix) |
| `decaySlices`       | number  | Nombre de tranches pour atteindre le boost minimal | 10 à 30                        |
| `decaySlicesUp`     | number  | Tranches de décroissance vers le haut (optionnel)  | Similaire à `decaySlices`      |
| `decaySlicesDown`   | number  | Tranches de décroissance vers le bas (optionnel)   | Similaire à `decaySlices`      |
| `exponent`          | number  | Exposant pour le mode exponentiel                  | 1 à 3                          |
| `outOfRangeEnabled` | boolean | Appliquer le boost aux positions hors plage        | `true` ou `false`              |

## 🔧 Explications détaillées par paramètre

### `sourceValue`

Détermine le format des valeurs utilisées pour les calculs :

- `"tick"` : Utilise les valeurs brutes du tick (format utilisé par Uniswap)
- `"priceDecimals"` : Utilise les prix en format décimal (plus facile à comprendre et configurer)

**Impact :** Affecte principalement comment vous configurez les autres paramètres. Si vous utilisez "priceDecimals", vos valeurs de `sliceWidth` et autres seront en unités de prix.

Pour une explication détaillée sur le calcul des ticks et leur conversion en prix, consultez le chapitre [Calcul des ticks et prix dans Uniswap V3](./08-ticks-et-prix.md).

### `priceRangeMode`

Détermine la méthode mathématique utilisée pour calculer le boost :

- `"none"` : N'applique aucun boost basé sur la plage de prix
- `"linear"` : Variation linéaire du boost
- `"exponential"` : Variation exponentielle du boost
- `"step"` : Boost par paliers

**Impact :** Change fondamentalement comment le boost est calculé et la forme de la courbe de boost.

### `boostMode`

Définit ce qui est mesuré pour déterminer le boost :

- `"centered"` : Mesure le centrage de la plage par rapport au prix actuel
- `"proximity"` : Mesure la proximité de chaque tranche de liquidité par rapport au prix actuel

**Impact :** Change complètement l'approche du calcul. Le mode "centered" considère la position globale, tandis que "proximity" fait une analyse tranche par tranche.

### `minBoost` et `maxBoost`

Définissent les limites inférieure et supérieure du boost :

- `minBoost` : Boost minimal appliqué (généralement 1)
- `maxBoost` : Boost maximal possible (non utilisé directement dans le mode "step")

**Impact :** Déterminent l'amplitude de variation du boost. Plus l'écart est grand, plus l'incitation à suivre la stratégie optimale est forte.

### `rangeWidthFactor`

Multiplicateur appliqué au boost basé sur la largeur relative de la plage :

- Valeur < 1 : Favorise les plages étroites
- Valeur > 1 : Favorise les plages larges
- Valeur = 1 : Pas d'impact de la largeur

**Calcul :** `finalBoost = boost × (targetWidth / actualWidth) ^ rangeWidthFactor`

**Impact :** Permet d'encourager certains types de plages indépendamment du centrage. Particulièrement utile pour favoriser une liquidité plus concentrée.

### `exponent` (Mode exponentiel)

Détermine la courbure de la fonction exponentielle :

- Valeur > 1 : Accentue la différence entre les positions bien et mal placées
- Valeur = 1 : Équivalent au mode linéaire
- Valeur < 1 : Adoucit la courbe (rarement utilisé)

**Impact :** Plus l'exposant est élevé, plus la courbe est "pointue" au centre, récompensant fortement les positions optimales et pénalisant sévèrement les autres.

### `steps` (Mode step)

Tableau de paires `[threshold, boostValue]` définissant les paliers de boost :

- `threshold` : Seuil de centrage (0-1) ou de décroissance selon le mode
- `boostValue` : Valeur de boost à appliquer lorsque le seuil est atteint

**Format :** `[[0.2, 1.5], [0.5, 3], [0.8, 4], [1.0, 5]]`

**Impact :** Permet un contrôle précis sur les niveaux de boost à différents seuils, créant des "zones cibles" spécifiques.

### `sliceWidth` (Mode proximity)

Largeur de chaque tranche utilisée pour le calcul du boost :

- Valeur plus petite : Analyse plus fine, mais calculs plus intensifs
- Valeur plus grande : Calcul plus rapide, mais moins précis

**Impact :** Affecte la précision du calcul de boost. Une valeur trop grande peut créer des "sauts" dans la courbe de boost.

### `decaySlices`, `decaySlicesUp`, `decaySlicesDown` (Mode proximity)

Nombre de tranches à partir du prix actuel avant d'atteindre le boost minimal :

- `decaySlices` : Utilisé dans les deux directions si les autres ne sont pas spécifiés
- `decaySlicesUp` : Spécifique à la direction ascendante (prix > prix actuel)
- `decaySlicesDown` : Spécifique à la direction descendante (prix < prix actuel)

**Impact :** Détermine la "portée" du boost. Des valeurs plus élevées étendent l'effet du boost sur une plus grande plage de prix.

### `outOfRangeEnabled` (Mode proximity)

Détermine si le boost est appliqué aux positions qui sont actuellement hors plage :

- `true` : Les positions hors plage reçoivent un boost calculé
- `false` : Les positions hors plage reçoivent uniquement `inactiveBoost`

**Impact :** Permet de récompenser les positions qui sont temporairement hors plage mais qui pourraient redevenir actives si le prix change légèrement.

## 📊 Exemples de valeurs pour différents scénarios

### Scénario 1 : Favoriser fortement les positions étroites et centrées

```typescript
{
  priceRangeMode: "exponential",
  boostMode: "centered",
  minBoost: 1,
  maxBoost: 10,
  exponent: 3,
  rangeWidthFactor: 0.5,
  inactiveBoost: 0.5
}
```

### Scénario 2 : Encourager une liquidité concentrée près du prix actuel

```typescript
{
  priceRangeMode: "exponential",
  boostMode: "proximity",
  minBoost: 1,
  maxBoost: 8,
  sliceWidth: 0.05,
  decaySlices: 15,
  exponent: 2,
  outOfRangeEnabled: true
}
```

### Scénario 3 : Définir des zones cibles spécifiques

```typescript
{
  priceRangeMode: "step",
  boostMode: "centered",
  minBoost: 1,
  steps: [
    [0.3, 1],  // <30% centré → boost 1
    [0.6, 3],  // ≥60% centré → boost 3
    [0.9, 8]   // ≥90% centré → boost 8
  ],
  inactiveBoost: 0.5
}
```

### Scénario 4 : Créer une "zone tampon" autour du prix actuel

```typescript
{
  priceRangeMode: "step",
  boostMode: "proximity",
  minBoost: 1,
  sliceWidth: 0.1,
  decaySlicesUp: 10,
  decaySlicesDown: 10,
  steps: [
    [0.2, 5],  // ≤2 tranches de distance → boost 5
    [0.5, 3],  // ≤5 tranches de distance → boost 3
    [1.0, 1]   // >5 tranches de distance → boost 1
  ],
  outOfRangeEnabled: false
}
```

## 🔀 Interactions entre les paramètres

### Interaction entre `rangeWidthFactor` et le boost de centrage/proximité

Le `rangeWidthFactor` est appliqué comme multiplicateur après le calcul principal du boost :

```
finalBoost = calculatedBoost × (targetWidth / actualWidth) ^ rangeWidthFactor
```

Où :

- `calculatedBoost` est le boost calculé par le mode choisi (linear, exponential, step)
- `targetWidth` est généralement 1.0 (valeur de référence)
- `actualWidth` est la largeur relative de la plage
- `rangeWidthFactor` est l'exposant appliqué à ce ratio

Un `rangeWidthFactor` de 0.5 signifie qu'une plage deux fois plus large que la référence verra son boost multiplié par 1/√2 ≈ 0.7071.

### Interaction entre `outOfRangeEnabled` et les autres paramètres de proximité

Si `outOfRangeEnabled` est `false`, les positions hors plage ne reçoivent que le boost `inactiveBoost` quelle que soit leur proximité avec le prix actuel.

Si `outOfRangeEnabled` est `true`, les positions partiellement hors plage sont traitées comme des positions normales jusqu'à la limite de leur plage, ce qui peut encourager des positions qui "chevauchent" le prix actuel sans le centrer.

## 📝 Conseils pour le paramétrage

1. **Commencez simple** : Le mode linéaire avec des valeurs modérées est un bon point de départ.
2. **Testez sur des exemples concrets** : Utilisez les scénarios de test pour voir l'impact de vos paramètres.
3. **Changez un paramètre à la fois** : Modifiez les paramètres progressivement pour bien comprendre leur impact.
4. **Attention aux valeurs extrêmes** : Des valeurs trop élevées peuvent créer des disparités excessives de boost.
5. **Considérez le comportement souhaité** : Demandez-vous quelle distribution de liquidité vous souhaitez encourager et ajustez les paramètres en conséquence.

## 🚀 Paramètres recommandés pour débuter

```typescript
{
  priceRangeMode: "linear",
  boostMode: "centered",
  minBoost: 1,
  maxBoost: 5,
  inactiveBoost: 1
}
```

Cette configuration simple offre un bon point de départ avec une augmentation linéaire du boost en fonction du centrage de la position, sans pénaliser les positions inactives. À partir de là, vous pouvez ajuster les paramètres en fonction des besoins spécifiques du pool.
