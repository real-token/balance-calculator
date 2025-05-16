# Documentation du système de boost pour pools v3 (REG/USDC)

Cette documentation explique en détail les différents modes de calcul du boost pour les positions de liquidité dans les pools v3 (Uniswap/Sushiswap v3).

## Table des matières

1. [Introduction et structure](./01-introduction.md)
2. Modes de calcul du boost :
   - [Mode "none"](./02-mode-none.md)
   - [Mode "linear"](./03-mode-linear.md)
   - [Mode "exponential"](./04-mode-exponential.md)
   - [Mode "step"](./05-mode-step.md)
3. [Comparaison des modes](./06-comparaison-modes.md)
4. [Annexe : Explications des paramètres importants](./07-annexe-parametres.md)
5. [Calcul des ticks et prix dans Uniswap V3](./08-ticks-et-prix.md)

## Vue d'ensemble

Cette documentation présente des exemples concrets pour comprendre l'impact des différents paramètres de configuration des boosts pour les pools v3 sur un pool USDC/REG, avec un prix du REG généralement à 1$ pour ses exemples.

Chaque mode de calcul est expliqué en détail avec :

- Sa logique et son fonctionnement
- Des exemples de calcul avec résultats attendus
- Une analyse de l'influence des paramètres

L'objectif est de permettre aux développeurs et aux membres de la DAO de comprendre et ajuster la politique de boost selon les objectifs de gouvernance souhaités.
