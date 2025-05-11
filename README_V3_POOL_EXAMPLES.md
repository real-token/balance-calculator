# Exemples de configuration et calculs pour pools v3 (USDC/REG)

## Introduction

Ce document illustre, à travers des exemples concrets, l'impact des différents paramètres de configuration des boosts pour les pools v3 (Uniswap/Sushiswap v3) sur un pool USDC/REG, avec un prix du REG fixé à **1$**. Chaque scénario présente une position extrême, le détail des paramètres utilisés, les étapes de calcul du boost (pour les modes "centered" et "proximity"), et une analyse de l'influence des paramètres.

## Structure et typage des paramètres

La configuration des boosts pour les pools v3 est définie par un ensemble de paramètres typés. Voici la structure attendue:

```typescript
interface V3BoostParams {
  // Type de formule à appliquer sur la plage de prix (pour mode "centered")
  priceRangeMode: BoostFormulaType; // "none", "linear", "exponential", "step"

  // Mode de calcul du boost
  boostMode?: BoostModeType; // "centered" ou "proximity"

  // Boost de base pour les positions actives (dans la plage de prix)
  activeBoost?: number;

  // Boost de base pour les positions inactives (hors plage de prix)
  inactiveBoost?: number;

  // Autres paramètres optionnels selon le mode...
  centerBoost?: number;
  edgeBoost?: number;
  exponent?: number;
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
```

**Important:** Si un paramètre optionnel n'est pas précisé dans la configuration, il prendra automatiquement la valeur **1** par défaut.

Consulter la suite du document pour connaitre les paramètres a utiliser en fonction du mode de boost choisi

Le paramètre principal déteminant es **priceRangeMode**, il détermine la logique principale de calcule du boost

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

Lorsque le paramètre `priceRangeMode` est défini sur `"none"` dans le fichier de configuration `optionsModifiers.ts`, le système applique **uniquement les multiplicateurs par défaut** sans tenir compte de la plage de prix. C'est le mode de calcul utilisé par défaut pour les pools autres que les pools concentré, où les fournisseurs de liquidité ne peuvent pas définir de plage de prix spécifique.

### Fonctionnement

Dans ce mode, le calcul est simplifié et utilise directement les multiplicateurs de base définis pour chaque token, les autres paramètres sont ignoré:

```text
// Pour toutes les positions actives et inactive
boost = multiplicateur_token × token quantity

```

### Exemples de calcul

En utilisant les données des scénarios disponibles dans `balancesREG_mock_examples.json` et avec les paramètres suivants définis dans `optionsModifiers.ts`:

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

---

## Mode "priceRangeMode: linear"

## Conclusion

- Les positions actives, centrées et avec une plage étroite sont très fortement valorisées.
- Les positions inactives ou très éloignées du prix actuel sont fortement pénalisées, quel que soit le mode.
- Le mode "proximity" valorise plus finement la liquidité réellement disponible autour du prix actuel.
- Le paramètre `rangeWidthFactor` permet de favoriser les positions avec une plage étroite.

---

**N'hésitez pas à adapter les paramètres selon la politique de gouvernance souhaitée !**

🎯 Pour toute question, ouvrez une issue ou contactez l'équipe.
