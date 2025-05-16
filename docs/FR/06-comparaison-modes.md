# Comparaison des différents modes de calcul du boost

Ce document présente une analyse comparative des différents modes de calcul du boost disponibles pour les pools V3, afin de vous aider à choisir le mode le plus adapté à votre stratégie.

## Vue d'ensemble des modes disponibles

| Mode          | Description                                                                 | Cas d'usage idéal                                                |
| ------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `none`        | Applique uniquement les multiplicateurs par défaut                          | Pools où la plage de prix n'est pas un facteur déterminant       |
| `linear`      | Variation linéaire du boost en fonction du centrage ou de la proximité      | Récompense graduelle et proportionnelle                          |
| `exponential` | Variation exponentielle du boost en fonction du centrage ou de la proximité | Forte récompense pour les positions optimales                    |
| `step`        | Paliers de boost avec transitions nettes entre niveaux                      | Encourager des comportements spécifiques avec des seuils définis |

## 🔄 Comparaison : boostMode "centered"

Dans le mode "centered", le boost est calculé en fonction du centrage de la plage de prix par rapport au prix actuel.

| Aspect                 | Linear                                                       | Exponential                                                   | Step                                                            |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------- |
| **Formule de base**    | `boost = minBoost + (maxBoost - minBoost) × centeredness`    | `boost = minBoost + (maxBoost - minBoost) × centeredness^2`   | Paliers prédéfinis: `[[seuil1, boost1], [seuil2, boost2], ...]` |
| **Courbe de boost**    | Augmentation linéaire du boost des extrémités vers le centre | Augmentation lente près des extrémités, rapide près du centre | "Escalier" avec transitions brusques entre les paliers          |
| **Avantage principal** | Équitable et prévisible                                      | Récompense fortement les positions bien centrées              | Contrôle précis des seuils et des comportements encouragés      |
| **Scénario idéal**     | Pour une approche équilibrée                                 | Pour favoriser fortement les positions centrées               | Pour définir des "zones cibles" spécifiques                     |

### Visualisation comparative des courbes de boost (centered)

Pour une plage de [0.5$ - 1.5$] avec un prix actuel de 1.0$ et les paramètres:

- Linear: `minBoost: 1, maxBoost: 5`
- Exponential: `minBoost: 1, maxBoost: 5`
- Step: `minBoost: 1, steps: [[0.2, 1.5], [0.5, 3], [0.8, 4], [1.0, 5]]`

```
Boost ↑
5.0 |                *                 * (Step à centrage = 1.0)
    |               /
4.0 |              /                   * (Step à centrage ≥ 0.8)
    |             /
3.0 |          __/                     * (Step à centrage ≥ 0.5)
    |        ./
2.0 |      ./
    |    ./                            * (Step à centrage ≥ 0.2)
1.0 |*--/                              * (Step à centrage < 0.2)
    |
    +----------------------------------→ Centrage
      0.0               0.5         1.0

    — Linear (ligne droite)
    .. Exponential (courbe)
    ** Step (escalier)
```

## 🔄 Comparaison : boostMode "proximity"

Dans le mode "proximity", le boost est calculé en fonction de la distance entre le prix actuel et chaque tranche de liquidité.

| Aspect              | Linear                                                              | Exponential                                            | Step                                                            |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| **Principe**        | Décroissance linéaire jusqu'à `minBoost` sur `decaySlices` tranches | Décroissance exponentielle jusqu'à `minBoost`          | Paliers de boost définis à différentes distances                |
| **Paramètres clés** | `sliceWidth`, `decaySlices` (ou `decaySlicesUp`/`decaySlicesDown`)  | Mêmes paramètres + `exponent`                          | `sliceWidth`, `decaySlices` + `steps`                           |
| **Avantage**        | Dégradation prévisible du boost avec la distance                    | Forte valorisation des tranches proches du prix actuel | Contrôle exact du boost à chaque niveau de distance             |
| **Cas d'usage**     | Pour une diminution régulière de la valeur des tranches éloignées   | Pour favoriser fortement les tranches les plus proches | Pour créer des "zones de liquidité" avec des valeurs distinctes |

### Visualisation comparative (proximity)

Pour une configuration avec:

- `sliceWidth: 0.05`
- `decaySlices: 20` (1$ de distance)
- Linear: `minBoost: 1, maxBoost: 5`
- Exponential: `minBoost: 1, maxBoost: 5, exponent: 2`
- Step: `minBoost: 1, steps: [[0.25, 5], [0.5, 3], [0.75, 2], [1.0, 1]]`

```
Boost ↑
5.0 |*
    | \
    |  \
    |   \
4.0 |    \
    |     \
    |      \
3.0 |       \********************     * (Step à decayProgress ≤ 0.25)
    |        .                  *
    |         .                 *
2.0 |          .                ***** * (Step à decayProgress ≤ 0.5)
    |           ..               *
    |             ...            *
1.0 |                ............***** * (Step à decayProgress ≤ 0.75)
    |                                 * (Step à decayProgress ≤ 1.0)
    +----------------------------------→ Distance (en tranches)
      0            5       10      20

    — Linear (ligne droite)
    .. Exponential (courbe)
    ** Step (escalier)
```

## Tableau comparatif des paramètres

| Paramètre          | Linear                   | Exponential              | Step                       | Description                                      |
| ------------------ | ------------------------ | ------------------------ | -------------------------- | ------------------------------------------------ |
| `priceRangeMode`   | "linear"                 | "exponential"            | "step"                     | Mode de calcul du boost                          |
| `boostMode`        | "centered" / "proximity" | "centered" / "proximity" | "centered" / "proximity"   | Base de calcul du boost                          |
| `minBoost`         | ✓                        | ✓                        | ✓                          | Boost minimal                                    |
| `maxBoost`         | ✓                        | ✓                        | ❌ (implicite via `steps`) | Boost maximal                                    |
| `rangeWidthFactor` | ✓                        | ✓                        | ✓                          | Facteur de boost basé sur la largeur de la plage |
| `inactiveBoost`    | ✓                        | ✓                        | ✓                          | Boost pour positions inactives                   |
| `sliceWidth`       | ✓ (proximity)            | ✓ (proximity)            | ✓ (proximity)              | Largeur des tranches de calcul                   |
| `decaySlices`      | ✓ (proximity)            | ✓ (proximity)            | ✓ (proximity)              | Tranches de décroissance                         |
| `exponent`         | ❌                       | ✓                        | ❌                         | Exposant pour calcul exponentiel                 |
| `steps`            | ❌                       | ❌                       | ✓                          | Paliers de boost `[threshold, boostValue]`       |

## Recommandations selon les objectifs

| Objectif                                               | Mode recommandé                | Justification                                                   |
| ------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------- |
| Favoriser les plages étroites centrées                 | Exponential (centered)         | Récompense fortement le centrage parfait                        |
| Assurer une liquidité concentrée près du prix actuel   | Linear/Exponential (proximity) | Valorise les tranches proches du prix actuel                    |
| Créer des "zones cibles" spécifiques                   | Step (centered)                | Permet de définir des zones précises avec des boosts prédéfinis |
| Encourager une liquidité profonde dans certaines zones | Step (proximity)               | Définit des paliers de récompense par distance                  |
| Approche simple et équilibrée                          | Linear (centered)              | Variation progressive et intuitive du boost                     |

## Exemple de configuration pratique pour les différents modes

### Mode Linear (centered)

```typescript
{
  priceRangeMode: "linear",
  boostMode: "centered",
  minBoost: 1,
  maxBoost: 5,
  inactiveBoost: 1
}
```

### Mode Exponential (centered)

```typescript
{
  priceRangeMode: "exponential",
  boostMode: "centered",
  minBoost: 1,
  maxBoost: 5,
  exponent: 2,
  inactiveBoost: 1
}
```

### Mode Step (centered)

```typescript
{
  priceRangeMode: "step",
  boostMode: "centered",
  minBoost: 1,
  steps: [
    [0.2, 1.5], // ≥20% centré → boost 1.5
    [0.5, 3],   // ≥50% centré → boost 3
    [0.8, 4],   // ≥80% centré → boost 4
    [1.0, 5]    // 100% centré → boost 5
  ],
  inactiveBoost: 1
}
```

### Mode Linear (proximity)

```typescript
{
  priceRangeMode: "linear",
  boostMode: "proximity",
  minBoost: 1,
  maxBoost: 5,
  sliceWidth: 0.05,
  decaySlices: 20,
  outOfRangeEnabled: true
}
```

### Mode Exponential (proximity)

```typescript
{
  priceRangeMode: "exponential",
  boostMode: "proximity",
  minBoost: 1,
  maxBoost: 5,
  exponent: 2,
  sliceWidth: 0.05,
  decaySlices: 20,
  outOfRangeEnabled: true
}
```

### Mode Step (proximity)

```typescript
{
  priceRangeMode: "step",
  boostMode: "proximity",
  minBoost: 1,
  sliceWidth: 0.05,
  decaySlices: 20,
  steps: [
    [0.25, 5], // ≤25% de la distance max → boost 5
    [0.5, 3],  // ≤50% de la distance max → boost 3
    [0.75, 2], // ≤75% de la distance max → boost 2
    [1.0, 1]   // ≤100% de la distance max → boost 1
  ],
  outOfRangeEnabled: true
}
```

## Conclusion

Le choix entre les différents modes de calcul de boost dépend principalement de l'objectif recherché pour la distribution de liquidité dans le pool:

- Le mode **linear** offre une progression régulière et prévisible, adaptée aux cas où l'on souhaite une répartition équilibrée des récompenses.
- Le mode **exponential** favorise fortement les positions optimales, créant une incitation plus marquée à suivre le comportement souhaité.
- Le mode **step** permet un contrôle précis sur des seuils spécifiques, utile pour créer des "zones cibles" clairement définies.

Pour une première configuration, le mode linear est souvent un bon point de départ, plus facile à comprendre et à ajuster. Les modes exponential et step peuvent ensuite être utilisés pour affiner la stratégie de distribution des boosts selon les besoins spécifiques du pool.

**Note importante:** Quelle que soit la stratégie de boost choisie, une bonne compréhension du mécanisme de conversion entre ticks et prix est essentielle pour configurer efficacement les paramètres, particulièrement si vous utilisez `sourceValue: "tick"`. Pour plus de détails, consultez le chapitre [Calcul des ticks et prix dans Uniswap V3](./08-ticks-et-prix.md).
