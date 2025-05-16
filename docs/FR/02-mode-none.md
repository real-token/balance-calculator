# Mode "priceRangeMode: none"

Lorsque le paramètre `priceRangeMode` est défini sur `"none"` dans le fichier de configuration `src/configs/optionsModifiers.ts`, le système applique **uniquement les multiplicateurs par défaut** sans tenir compte de la plage de prix. C'est le mode de calcul utilisé par défaut pour les pools autres que les pools concentrés, où les fournisseurs de liquidité ne peuvent pas définir de plage de prix spécifique.

## Fonctionnement

Dans ce mode, le calcul est simplifié et utilise directement les multiplicateurs de base définis pour chaque token, les autres paramètres sont ignorés:

```text
// Pour toutes les positions actives et inactives
boost = multiplicateur_token × token quantity
```

## Exemples de calcul

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

### Scénario 1 (0x111...111): 50% USDC / 50% REG, range 0.5$ à 1.5$

- Position active (prix actuel: 1.0$)
- REG: 500 tokens × multiplicateur REG (4) = 2000
- USDC: 500 tokens équivalent REG × multiplicateur USDC (2) = 1000
- **Pouvoir de vote total: 3000**

### Scénario 2 (0x222...222): 75% REG / 25% USDC, range 0.5$ à 1.5$

- Position active (prix actuel: 0.63$)
- REG: 655.22 tokens × multiplicateur REG (4) = 2620.88
- USDC: 217.18 tokens (équivalent à 344.78 REG) × multiplicateur USDC (2) = 689.56
- **Pouvoir de vote total: 3310.44**

### Scénario 3 (0x333...333): 25% REG / 75% USDC, range 0.5$ à 1.5$

- Position active (prix actuel: 1.22$)
- REG: 289.32 tokens × multiplicateur REG (4) = 1157.28
- USDC: 867.44 tokens (équivalent à 710.68 REG) × multiplicateur USDC (2) = 1421.36
- **Pouvoir de vote total: 2578.64**

### Scénario 4 (0x444...444): 100% USDC, range 0.5$ à 0.99$

- Position inactive (prix actuel: 1.0$, hors de la plage)
- USDC: 1000 tokens équivalent REG × multiplicateur USDC (2) = 2000
- **Pouvoir de vote total: 2000**

### Scénario 5 (0x555...555): 100% REG, range 1.01$ à 1.5$

- Position inactive (prix actuel: 1.0$, hors de la plage)
- REG: 1000 tokens × multiplicateur REG (4) = 4000
- **Pouvoir de vote total: 4000**

### Scénario 6 (0x666...666): 100% USDC, range 0.01$ à 0.1$

- Position inactive (prix actuel: 1.0$, hors de la plage)
- USDC: 1000 tokens équivalent REG × multiplicateur USDC (2) = 2000
- **Pouvoir de vote total: 2000**

### Scénario 7 (0x777...777): 100% REG, range 100$ à 110$

- Position inactive (prix actuel: 1.0$, hors de la plage)
- REG: 1000 tokens × multiplicateur REG (4) = 4000
- **Pouvoir de vote total: 4000**

### Scénario 8 (0x888...888): 2.4% REG / 97.6% USDC, range 1.05$ à 2.75$

- Position active (prix actuel: 2.7$)
- REG: 8.772 tokens × multiplicateur REG (4) = 35.088
- USDC: 976.28 tokens (équivalent à 361.585 REG) × multiplicateur USDC (2) = 723.17
- **Pouvoir de vote total: 758.26**

## Analyse

Ce mode simplifié:

- Ne fait aucune distinction basée sur la centralité ou la proximité du prix actuel avec la plage
- Ne tient pas compte de la largeur de la plage
- Ne favorise pas les positions plus stratégiques
- Ne fait pas de distinction entre les positions actives/inactives
- Se concentre principalement sur le type de token fourni (REG vs autres tokens)
- Le mode ouvre la porte à des stratégies de boost de pouvoir de vote inefficientes pour la DAO en plaçant la liquidité dans des zones de prix extrêmes limitant le risque pour les apporteurs de liquidité, mais inutilisable pour les acheteurs et vendeurs de REG.

C'est le mode le plus simple à comprendre, mais il ne récompense pas la liquidité fournie de manière plus stratégique comme le font les modes "centered" et "proximity".

## Résumé des résultats

| Scénario | Description                          | État    | Prix  | REG     | USDC    | Pouvoir de vote |
| -------- | ------------------------------------ | ------- | ----- | ------- | ------- | --------------- |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$      | Actif   | 1.00$ | 2000    | 1000    | 3000            |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$      | Actif   | 0.63$ | 2620.88 | 689.56  | 3310.44         |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$      | Actif   | 1.22$ | 1157.28 | 1421.36 | 2578.64         |
| 4        | 100% USDC, 0.5$ à 0.99$              | Inactif | 1.00$ | 0       | 2000    | 2000            |
| 5        | 100% REG, 1.01$ à 1.5$               | Inactif | 1.00$ | 4000    | 0       | 4000            |
| 6        | 100% USDC, 0.01$ à 0.1$              | Inactif | 1.00$ | 0       | 2000    | 2000            |
| 7        | 100% REG, 100$ à 110$                | Inactif | 1.00$ | 4000    | 0       | 4000            |
| 8        | 2.4% REG / 97.6% USDC, 1.05$ à 2.75$ | Actif   | 2.70$ | 35.09   | 723.17  | 758.26          |
