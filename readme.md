## Ajout d'un nouveau DEX

Pour ajouter un nouveau DEX à notre application, suivez les étapes suivantes :

1. **Créez une nouvelle fonction de récupération des soldes** : Cette fonction doit être capable de récupérer les soldes pour le nouveau DEX. Elle doit être définie dans le fichier approprié ("src/utils/queryDeks.ts") et exportée pour pouvoir être utilisée ailleurs dans l'application.

```typescript
// Exemple de fonction de récupération des soldes pour un nouveau DEX
export async function getRegBalancesNewDexExemple(
  configs: any,
  network?: Network,
  timestamp?: number | undefined,
  mock?: boolean | undefined
): Promise<ResponseFunctionGetRegBalances> {
  // Votre code ici...
  return responseformaterNewDexExemple(result);
}
```

2. **Créez une nouvelle fonction de convertion de la réponse** : Cette fonction doit convertir et standardiser la réponse du graph au fromat "ResponseFunctionGetRegBalances" ("src/utils/queryDeks.ts"), utiliser dans la fonction précédente pour formater le return.

```typescript
// Exemple de fonction de formatage de la réponse du graph
function responseformaterNewDexExemple(
  pairs: any
): ResponseFunctionGetRegBalances[] {
  return pairs.map((pair: any) => {
    const totalSupply = pair.totalSupply;
    return {
      poolId: pair.id,
      liquidityPositions: pair.liquidityPositions.map(
        (liquidityPosition: any) => {
          const userLiquidityTokenBalance =
            liquidityPosition.liquidityTokenBalance;
          const userLiquidityPercentage =
            userLiquidityTokenBalance / totalSupply;
          return {
            user: {
              id: liquidityPosition.user.id,
            },
            liquidity: [
              {
                tokenId: pair.token0.symbol,
                tokenDecimals: pair.token0.decimals,
                tokenSymbol: pair.token0.symbol,
                tokenBalance: new BigNumber(pair.reserve0)
                  .multipliedBy(userLiquidityPercentage)
                  .toString(),
              },
              {
                tokenId: pair.token1.symbol,
                tokenDecimals: pair.token1.decimals,
                tokenSymbol: pair.token1.symbol,
                tokenBalance: new BigNumber(pair.reserve1)
                  .multipliedBy(userLiquidityPercentage)
                  .toString(),
              },
            ],
          };
        }
      ),
    };
  });
}
```

3. **ajouter les infos sur le dex dans le fichier des constantes**
   Compléter l'énim DEX, NETWORK, la constante networkToDexsMap et dexFunctionMap

4. **Completez le fichier de config des dex pour le dex que vous ajoutez**
   ajouter les infos de config dans le fichier "src/configs/dex.json"

5. **Optionel, ajouter un fichier mock pour le dex ajouter**
   le fichier mock permet de faire des test sans devoir faire appel a theGrph
