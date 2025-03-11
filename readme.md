# Balance Calculator

## Introduction

Tool for calculating and analyzing token balances across different DEX blockchains and other types of Smart Contracts. This tool is specifically designed for:

- **Multi-DEX Analysis**: Retrieval and analysis of token balances across different DEX (Honeyswap, Sushiswap, Balancer, SwaprHQ)
- **Multi-Chain Support**: Compatible with multiple blockchain networks (Gnosis, Ethereum, Polygon)
- **Voting Power Calculation**: Generation of voting power from snapshots with the ability to apply different calculation models and modify balances
- **Temporal Analysis**: Ability to analyze balances at different points in time (snapshot)
- **Holders Ranking**: Creation of rankings of token holders
- **Flexible Export**: Generation of reports in JSON and CSV format

The tool is particularly useful for:

- DAO administrators wishing to calculate the distribution of voting rights
- Analysts seeking to understand token distribution
- Blockchain developers needing precise data on token balances
- Auditors wanting to verify holdings across different platforms

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Code Modification and Feature Addition](#code-modification-and-feature-addition)
  - [Task GetBalancesREG](#task-getbalancesreg)
  - [Task CalculatePowerVotingREG](#task-calculatepowervotingreg)
- [Contribution](#contribution)
- [License](#license)
- [Support](#support)
- [TODO](#todo)

## Installation

### Clone the project

```bash
git clone [project-url]
```

### Using with nvm

Install the LTS version of node found in the .nvmrc file or use nvm to manage node versions

```bash
nvm install
```

use the node version

```bash
nvm use
```

### Install the yarn package manager

```bash
npm install -g yarn
```

### Install dependencies

```bash
yarn install
```

### Create and configure the .env file

```bash
cp .env.example .env
```

## Configuration

### Environment Variables

Modify the copy of the `.env.example` file to `.env` at the root of the project with the following variables:

1. **The Graph API Key**

   - Visit [The Graph](https://thegraph.com/studio/)
   - Create an account or log in
   - Go to your profile > Settings > API Keys
   - Create a new API key
   - Copy the key into your .env:
     `THEGRAPH_API_KEY=your_api_key`

2. **Etherscan API Key**

   - Visit [Etherscan](https://etherscan.io/apis)
   - Create an account or log in
   - Go to API Keys > Add
   - Create a new API key
   - Copy the key into your .env:
     `API_KEY_ETHERSCAN=your_etherscan_key`

3. **Gnosisscan API Key**

   - Visit [Gnosisscan](https://gnosisscan.io/)
   - Create an account or log in
   - Go to API Keys > Add
   - Create a new API key
   - Copy the key into your .env:
     `API_KEY_GNOSISSCAN=your_gnosisscan_key`

4. **Polygonscan API Key**

   - Visit [Polygonscan](https://polygonscan.com/apis)
   - Create an account or log in
   - Go to API Keys > Add
   - Create a new API key
   - Copy the key into your .env:
     `API_KEY_POLYGONSCAN=your_polygonscan_key`

5. **Moralis API Key**

   - Visit [Moralis](https://developer.moralis.com/)
   - Create an account or log in
   - Go to API Keys
   - Create a new API key
   - Copy the key into your .env:
     `API_KEY_MORALIS=your_moralis_key`

6. **Additional Endpoints (Optional)**

   - Add your additional endpoints as a JSON array:
     `ENDPOINT_EXTRA=["https://endpoint1.com","https://endpoint2.com"]`

7. **The Graph Development URLs (Optional)**
   If you are developing with custom The Graph endpoints:
   ```
   THE_GRAPH_DEV_URL_REG_GNOSIS="your_url"
   THE_GRAPH_DEV_URL_REG_ETHEREUM="your_url"
   THE_GRAPH_DEV_URL_REG_POLYGON="your_url"
   THE_GRAPH_DEV_URL_GOV_GNOSIS="your_url"
   ```

Your final .env file should look like this:

```
API_KEY_GNOSISSCAN="your_gnosisscan_key"
API_KEY_ETHERSCAN="your_etherscan_key"
API_KEY_POLYGONSCAN="your_polygonscan_key"

THEGRAPH_API_KEY="your_thegraph_key"

# Optional

ENDPOINT_EXTRA=["https://endpoint1.com","https://endpoint2.com"]

# The Graph DEV URLs (Optional)

THE_GRAPH_DEV_URL_REG_GNOSIS=""
THE_GRAPH_DEV_URL_REG_ETHEREUM=""
THE_GRAPH_DEV_URL_REG_POLYGON=""
THE_GRAPH_DEV_URL_GOV_GNOSIS=""
```

## Project Structure

```
src/
├── abi/            # ABI files
├── configs/        # Configuration files
├── graphql/        # GraphQL query files
├── mocks/          # Mock files
├── models/         # Data models
├── modifiers/      # Balance modifiers
├── tasks/          # Main tasks
├── types/          # TypeScript type definitions
├── utils/          # Utilities and common functions
└── index.ts        # Entry point
.env                # Environment variables
.env.example        # Example .env file
.gitignore          # Git ignored file
.nvmrc              # Node version
package.json        # Application configuration file
readme.md           # Documentation
tsconfig.json       # TypeScript configuration
```

### Main Folders

#### configs/

- `constants.ts`: Definitions of global constants
- `dex.json`: DEX configuration
- `optionsModifiers.ts`: Configuration file for voting power calculations

#### models/

- `powerVotingModels.ts`: Voting power calculation models
- `inputModels.ts`: Input data models

#### tasks/

Contains the main tasks of the application:

- GetBalancesREG: Retrieves REG balances across different DEX and networks
- GetAddressOwnRealToken: Lists addresses owning RealTokens
- RankingREG: Generates a ranking of REG holders from REG snapshots
- CalculatePowerVotingREG: Calculates voting power for each address from REG snapshots

#### utils/

- `graphql.ts`: Functions for interacting with TheGraph
- `lib.ts`: General utility functions
- `queryDexs.ts`: DEX-specific queries

## Usage

```bash
# Start the application in normal mode
yarn start

# Start the application in log writing mode to a file logs.log
yarn start:logs
```

### Available Tasks

#### GetBalancesREG

Retrieves REG balances across different DEX and networks.

```bash
# Available options:
- Network selection (Gnosis, Ethereum, Polygon)
- DEX selection by network
- Customizable time period
```

#### GetAddressOwnRealToken

Lists addresses owning RealTokens.

```bash
# Features:
- Token selection
- Customizable time period
- Exclusion of specific addresses
```

#### RankingREG

Generates a ranking of REG holders from REG snapshots.

```bash
# Options:
- Configurable Top N holders
- Filtering by balance type
```

#### CalculatePowerVotingREG

Calculates voting power for each address from REG snapshots.

```bash
# Features:
- Different calculation models available
- Support for balance modifiers
- Generation of transaction data in batches of 500
```

## Code Modification and Feature Addition

### Task GetBalancesREG

#### Adding a New DEX

To add a new DEX to our application, follow these steps:

1. **Create a new balance retrieval function**: This function must be able to retrieve balances for the new DEX. It should be defined in the appropriate file ("src/utils/queryDeks.ts") and exported for use elsewhere in the application.

```typescript
// Example of a balance retrieval function for a new DEX
export async function getRegBalancesNewDexExample(
  configs: any,
  network?: Network,
  timestamp?: number | undefined,
  mock?: boolean | undefined
): Promise<ResponseFunctionGetRegBalances> {
  // Your code here...
  return responseFormatterNewDexExample(result);
}
```

2. **Create a new response conversion function**: This function must convert and standardize the response from the graph to the "ResponseFunctionGetRegBalances" format ("src/utils/queryDeks.ts"), used in the previous function to format the return.

```typescript
// Example of a response formatting function from the graph
function responseFormatterNewDexExample(pairs: any): ResponseFunctionGetRegBalances[] {
  return pairs.map((pair: any) => {
    const totalSupply = pair.totalSupply;
    return {
      poolId: pair.id,
      liquidityPositions: pair.liquidityPositions.map((liquidityPosition: any) => {
        const userLiquidityTokenBalance = liquidityPosition.liquidityTokenBalance;
        const userLiquidityPercentage = userLiquidityTokenBalance / totalSupply;
        return {
          user: {
            id: liquidityPosition.user.id,
          },
          liquidity: [
            {
              tokenId: pair.token0.symbol,
              tokenDecimals: pair.token0.decimals,
              tokenSymbol: pair.token0.symbol,
              tokenBalance: new BigNumber(pair.reserve0).multipliedBy(userLiquidityPercentage).toString(),
            },
            {
              tokenId: pair.token1.symbol,
              tokenDecimals: pair.token1.decimals,
              tokenSymbol: pair.token1.symbol,
              tokenBalance: new BigNumber(pair.reserve1).multipliedBy(userLiquidityPercentage).toString(),
            },
          ],
        };
      }),
    };
  });
}
```

3. **Add DEX information in the constants file**
   Complete the DEX, NETWORK, the constant networkToDexsMap, and dexFunctionMap

4. **Complete the DEX configuration file for the added DEX**
   Add configuration information in the "src/configs/dex.json" file

5. **Optionally, add a mock file for the added DEX**
   The mock file allows testing without having to call TheGraph

### Task CalculatePowerVotingREG

#### Adding a Modifier for Voting Power

Create a ts file in the modifiers folder with the name of the modifier function that will be exported, one file per modifier.
Modify the `NormalizeOptions` type in the `inputModels.types.ts` file with the key of the modifier.
Create the code for the modifier with the minimum structure:

```typescript
export function modifierName(
  data: SourceBalancesREG[],
  options: NormalizeOptions["modifierName"]
): SourceBalancesREG[] {
  // Your code here...
}
```

The modifier must return an array of `SourceBalancesREG[]` which is the modified version of the input data `data` without changing its structure.
Add the exported function to the module in the `index.ts` file of the modifiers folder.

To use the new modifier, add the key and value in the `optionsModifiers.ts` file.

#### Adding a Calculation Model for Voting Power

To be written

## Contribution

1. Fork the project
2. Create a branch (`git checkout -b feature/new-feature`)
3. Commit the changes (`git commit -am 'Add new feature'`)
4. Push the branch (`git push origin feature/new-feature`)
5. Create a Pull Request

## License

MIT

## Support

For any questions or issues, please open an issue in the repository or contact us on Telegram.

## TODO

- [ ] Write the Code Modification and Feature Addition section -> add calculation model for voting power
- [ ] Add a custom logger to remove TheGraph API keys from the logs
- [ ] Add the dex keys management in the ranking calculation
