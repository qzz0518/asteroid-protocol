export const environment = {
  production: false,
  domain: 'localhost:8100',
  limits: {
    maxFileSize: 550000,
  },
  storage: {
    connectedWalletKey: "connectedWallet"
  },
  fees: {
    ibcChannel: "channel-569",
    protocol: {
      inscription: {
        inscribe: {
          receiver: "cosmos1y6338yfh4syssaglcgh3ved9fxhfn0jk4v8qtv",
          denom: "uatom",
          amount: "0"
        },
        transfer: {
          receiver: "",
          denom: "uatom",
          amount: "0"
        },
      },
      cft20: {
        deploy: {
          receiver: "cosmos1y6338yfh4syssaglcgh3ved9fxhfn0jk4v8qtv",
          denom: "uatom",
          amount: "0"
        },
        mint: {
          receiver: "cosmos1y6338yfh4syssaglcgh3ved9fxhfn0jk4v8qtv",
          denom: "uatom",
          amount: "0"
        },
        transfer: {
          receiver: "cosmos1y6338yfh4syssaglcgh3ved9fxhfn0jk4v8qtv",
          denom: "uatom",
          amount: "0"
        },
        list: {
          receiver: "cosmos1y6338yfh4syssaglcgh3ved9fxhfn0jk4v8qtv",
          denom: "uatom",
          amount: "0",
          minTradeSize: 0.000001,
        },
        buy: {
          receiver: "cosmos162mdca7dfk2rpqlv0hhc6sepnvwdxv5yl74uqa",
          denom: "uatom",
          amount: "0.02",
          type: "dynamic-percent"
        },
        reserve: {
          receiver: "cosmos162mdca7dfk2rpqlv0hhc6sepnvwdxv5yl74uqa",
          denom: "uatom",
          amount: "0",
        },
        delist: {
          receiver: "cosmos1y6338yfh4syssaglcgh3ved9fxhfn0jk4v8qtv",
          denom: "uatom",
          amount: "0"
        },
      },
      marketplace: {
        "list.cft20": {
          receiver: "neutron1unc0549k2f0d7mjjyfm94fuz2x53wrx3px0pr55va27grdgmspcqgzfr8p",
          denom: "uatom",
          amount: "0",
          minTradeSize: 0.000001,
          minDepositAbsolute: 0.000001,
          minDepositPercent: 0.01,
          maxDepositPercent: 1,
          minTimeout: 100,
          maxTimeout: 300,
        },
        "buy.cft20": {
          receiver: "neutron1unc0549k2f0d7mjjyfm94fuz2x53wrx3px0pr55va27grdgmspcqgzfr8p",
          denom: "uatom",
          amount: "0.02",
          type: "dynamic-percent",
          minTradeSize: 0.000001,
        },
        "deposit": {
          receiver: "cosmos1y6338yfh4syssaglcgh3ved9fxhfn0jk4v8qtv",
          denom: "uatom",
          amount: "0",
          minTradeSize: 0.000001,
        },
        "delist": {
          receiver: "cosmos1y6338yfh4syssaglcgh3ved9fxhfn0jk4v8qtv",
          denom: "uatom",
          amount: "0",
          minTradeSize: 0.000001,
        }
      }
    },
    chain: {
      gasLimit: "12000000"
    }
  },
  api: {
    endpoint: 'https://api.asteroidprotocol.io/v1/graphql',
    wss: 'wss://api.asteroidprotocol.io/v1/graphql',
    explorer: 'https://www.mintscan.io/cosmos/tx/',
    simulateEndpoint: "https://asteroids-rest-vkjug.ondigitalocean.app/https://rest-cosmoshub.goldenratiostaking.net",
    stargazeNameEndpoint: "https://rest.stargaze-apis.com/cosmwasm/wasm/v1/contract/stars1fx74nkqkw2748av8j7ew7r3xt9cgjqduwn8m0ur5lhe49uhlsasszc5fhr/smart/"
  },
  chain: {
    chainId: "cosmoshub-4",
    chainName: "Cosmos Hub",
    rpc: "https://cosmos-rpc.cosmos-apis.com",
    rest: "https://cosmos-rest.cosmos-apis.com",
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: 'cosmos',
      bech32PrefixAccPub: 'cosmospub',
      bech32PrefixValAddr: 'cosmosval',
      bech32PrefixValPub: 'cosmosvalpub',
      bech32PrefixConsAddr: 'cosmosvalcons',
      bech32PrefixConsPub: 'cosmosvalconsconspub'
    },
    currencies: [
      {
        coinDenom: "ATOM",
        coinMinimalDenom: "uatom",
        coinDecimals: 6,
        coinGeckoId: "cosmos",
      },
    ],
    feeCurrencies: [
      {
        coinDenom: "ATOM",
        coinMinimalDenom: "uatom",
        coinDecimals: 6,
        coinGeckoId: "cosmos",
        gasPriceStep: {
          low: 0.005,
          average: 0.005,
          high: 0.005,
        },
      },
    ],
    stakeCurrency: {
      coinDenom: "ATOM",
      coinMinimalDenom: "uatom",
      coinDecimals: 6,
      coinGeckoId: "cosmos",
    },
  },

};
