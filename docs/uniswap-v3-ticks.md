# Calcul des Ticks et Prix dans Uniswap V3

## Introduction

Ce document explique comment sont calculés les ticks et prix dans les pools Uniswap V3 dans notre application.

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

Pour une position dans la paire REG/USDC comme celle dans notre exemple de données:

- REG (token0) a 18 décimales
- USDC (token1) a 6 décimales
- La différence est donc (6 - 18) = -12

Prenons un exemple concret d'une position de notre jeu de données:

- `currentTick`: -283600
- `tickLower`: -277200
- `tickUpper`: -263200

### Calcul du prix actuel

```
prixBrut = 1.0001^(-283600) ≈ 0.00000048308581099
prixAjusté = 0.00000048308581099 / 10^(6-18) = 0.00000048308581099 * 10^12 ≈ 0.48308581099
```

Ce qui correspond bien à la valeur "currentPrice": "0.48308581099479686" dans nos données.

### Calcul du prix minimum (tickLower)

```
prixBrut = 1.0001^(-277200) ≈ 0.00000091613368882
prixAjusté = 0.00000091613368882 / 10^(6-18) = 0.00000091613368882 * 10^12 ≈ 0.91613368882
```

Ce qui correspond à la valeur "minPrice": 0.91613368882232 dans nos données.

### Calcul du prix maximum (tickUpper)

```
prixBrut = 1.0001^(-263200) ≈ 0.0000037148452736
prixAjusté = 0.0000037148452736 / 10^(6-18) = 0.0000037148452736 * 10^12 ≈ 3.7148452736
```

Ce qui correspond à la valeur "maxPrice": 3.7148452736021116 dans nos données.

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
