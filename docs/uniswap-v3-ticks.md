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

## Exemple: REG/USDC

Pour la paire REG/USDC:

- REG (token0) a généralement 18 décimales
- USDC (token1) a généralement 6 décimales
- La différence est donc (6 - 18) = -12

Donc:

```
prixAjusté = 1.0001^tick / 10^(-12) = 1.0001^tick * 10^12
```

Mais comme notre application utilise des prix en "token1 par token0" (USDC par REG), nous ajustons la formule:

```
prixAjusté = 1.0001^tick / 10^(6 - 18) = 1.0001^tick * 10^12
```

## Exemples de Calculs

### Exemple 1: Tick = 0

- Prix brut = 1.0001^0 = 1
- Prix ajusté = 1 \* 10^12 / 10^12 = 1 USDC par REG

### Exemple 2: Tick = 6932

- Prix brut = 1.0001^6932 ≈ 1.5
- Prix ajusté = 1.5 \* 10^12 / 10^12 = 1.5 USDC par REG

### Exemple 3: Tick = -46052

- Prix brut = 1.0001^(-46052) ≈ 0.01
- Prix ajusté = 0.01 \* 10^12 / 10^12 = 0.01 USDC par REG

## Implémentation dans l'Application

Dans notre application, nous utilisons le facteur d'échelle `scaleFactor` pour faciliter la conversion entre ticks et prix:

```javascript
const TICK_BASE = 1.0001;
function tick_to_price(tick) {
  return TICK_BASE ** tick;
}

// Calcul du prix ajusté
const current_price = tick_to_price(currentTick);
const adjusted_current_price = current_price / 10 ** (token1Decimals - token0Decimals);

// Le facteur d'échelle est simplement l'inverse de l'ajustement des décimales
const scaleFactor = 1 / 10 ** (token1Decimals - token0Decimals);
```

Pour la paire REG/USDC, avec REG à 18 décimales et USDC à 6 décimales, le `scaleFactor` est égal à 1.0, car la différence des décimales a déjà été prise en compte dans le calcul du prix ajusté.

## Utilisation dans GraphQL

Notre application récupère les données des positions via GraphQL, qui inclut:

- `currentTick`: le tick actuel du pool
- `tickLower`: le tick inférieur de la position
- `tickUpper`: le tick supérieur de la position

Ces valeurs permettent de calculer les prix correspondants à l'aide des formules ci-dessus.

## Vérification des Calculs

Pour vérifier que les ticks correspondent bien aux prix, vous pouvez utiliser:

```javascript
// Vérifier que le prix correspond au tick
const price = 1.0;
const tick = Math.log(price) / Math.log(1.0001); // tick ≈ 0

// Vérifier que le tick correspond au prix
const tick = 0;
const price = 1.0001 ** tick; // price = 1.0
```
