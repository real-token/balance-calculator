# Calcul des Ticks et Prix dans Uniswap V3

## Introduction

Ce document explique comment sont calculés les ticks et prix dans les pools Uniswap V3 dans notre application. Comprendre ces mécanismes est essentiel pour appréhender le fonctionnement des différents modes de boost présentés dans les chapitres précédents, notamment lorsque le paramètre `sourceValue` est défini sur `"tick"`.

## Relation entre Ticks et Prix

Dans Uniswap V3, les ticks et les prix sont liés par la formule suivante:

```
prixBrut = 1.0001^tick
prixAjusté = prixBrut / 10^(token1Decimals - token0Decimals)
```

Où:

- `tick` est une valeur entière qui représente la position sur l'échelle logarithmique des prix
- `1.0001` est la base (chaque tick représente une variation de prix de 0.01%)
- `token0Decimals` et `token1Decimals` sont les nombres de décimales des tokens dans la paire

## Implémentation dans l'Application

Dans notre application, nous utilisons la fonction `tick_to_price` pour convertir un tick en prix brut:

```javascript
const TICK_BASE = 1.0001;
function tick_to_price(tick) {
  return TICK_BASE ** tick;
}
```

Ensuite, nous calculons le prix ajusté en tenant compte de la différence de décimales entre les tokens:

```javascript
const current_price = tick_to_price(currentTick);
const adjusted_current_price = current_price / 10 ** (decimals1 - decimals0);
```

## Calcul des Prix Minimums et Maximums

Pour une position de liquidité, nous calculons le prix minimum et maximum correspondant aux ticks inférieur et supérieur:

```javascript
minPrice: tick_to_price(tick_lower) / 10 ** (decimals1 - decimals0),
maxPrice: tick_to_price(tick_upper) / 10 ** (decimals1 - decimals0),
```

## Exemple: REG/USDC

Pour une position dans la paire REG/USDC comme celle dans notre exemple de données (correspondant au Scénario 1 de `balancesREG_mock_examples.json`):

- REG (token0) a 18 décimales
- USDC (token1) a 6 décimales
- La différence est donc (6 - 18) = -12

Détails de la position:

- `currentTick`: -276324
- `tickLower`: -283256
- `tickUpper`: -272269

### Calcul du prix actuel

```
prixBrut = 1.0001^(-276324) ≈ 0.0000010
prixAjusté = 0.0000010 / 10^(6-18) = 0.0000010 * 10^12 ≈ 1.0
```

Ce qui correspond bien à la valeur "currentPrice": "1.0" dans nos données.

### Calcul du prix minimum (tickLower)

```
prixBrut = 1.0001^(-283256) ≈ 0.0000005
prixAjusté = 0.0000005 / 10^(6-18) = 0.0000005 * 10^12 ≈ 0.5
```

Ce qui correspond à la valeur "minPrice": 0.5 dans nos données.

### Calcul du prix maximum (tickUpper)

```
prixBrut = 1.0001^(-272269) ≈ 0.0000015
prixAjusté = 0.0000015 / 10^(6-18) = 0.0000015 * 10^12 ≈ 1.5
```

Ce qui correspond à la valeur "maxPrice": 1.5 dans nos données.

## Impact sur le calcul des boosts

### Relation avec le paramètre `sourceValue`

Le paramètre `sourceValue` dans la configuration des boosts peut prendre deux valeurs:

- `"tick"`: Les calculs utilisent directement les valeurs de tick
- `"priceDecimals"`: Les calculs utilisent les prix ajustés en décimales

Lors de l'utilisation de `sourceValue: "tick"`, les valeurs utilisées sont beaucoup plus grandes (en valeur absolue) car elles représentent des positions sur l'échelle logarithmique. Par exemple, une plage de prix de 0.5$ à 1.5$ correspond approximativement à une plage de ticks de -69300 à -58200, soit une largeur d'environ 11000 ticks.

### Conséquences sur les paramètres de boost

Cela a des implications importantes pour la configuration des paramètres:

1. **Pour `sliceWidth`**:

   - Avec `sourceValue: "tick"`, une valeur par défaut de 1 signifie que chaque tranche correspond à une variation de prix de 0.01%
   - Avec `sourceValue: "priceDecimals"`, une valeur par défaut de 0.1 représente directement une variation de prix de 0.1$

2. **Pour `decaySlices` et variantes**:

   - Avec `sourceValue: "tick"`, ces valeurs doivent être beaucoup plus grandes pour couvrir la même plage de prix

3. **Pour `rangeWidthFactor`**:
   - Les plages exprimées en ticks sont numériquement beaucoup plus larges, ce qui peut nécessiter des ajustements du facteur de largeur

## Calcul des Montants de Tokens dans une Position

Notre application calcule également les montants de chaque token dans une position en fonction du tick actuel:

- Si le tick actuel est inférieur au tick minimum (`currentTick < tickLower`), la position est entièrement en token0
- Si le tick actuel est supérieur au tick maximum (`currentTick > tickUpper`), la position est entièrement en token1
- Si le tick actuel est entre les deux (`tickLower <= currentTick <= tickUpper`), la position contient les deux tokens

La fonction `getPositionAmount` dans le code implémente ces calculs en utilisant les formules d'Uniswap V3 basées sur les racines carrées des prix.

## Vérification des Calculs

Pour vérifier qu'un prix correspond bien à un tick, ou inversement:

```javascript
// Conversion de tick à prix
const tick = -283600;
const price = 1.0001 ** tick; // ≈ 0.00000048308581099
const adjustedPrice = price * 10 ** 12; // ≈ 0.48308581099

// Conversion de prix à tick
const adjustedPrice = 0.48308581099;
const price = adjustedPrice / 10 ** 12; // ≈ 0.00000048308581099
const tick = Math.log(price) / Math.log(1.0001); // ≈ -283600
```

## Conclusion

La compréhension du mécanisme de conversion entre ticks et prix est cruciale pour configurer efficacement les paramètres de boost, particulièrement si vous utilisez `sourceValue: "tick"`. Les valeurs numériques pour les ticks sont beaucoup plus grandes et fonctionnent sur une échelle logarithmique, ce qui peut rendre leur manipulation moins intuitive que les prix décimaux.

Pour la plupart des cas d'utilisation, il est recommandé d'utiliser `sourceValue: "priceDecimals"` car cela rend la configuration plus intuitive et directement liée aux prix observables sur le marché.
