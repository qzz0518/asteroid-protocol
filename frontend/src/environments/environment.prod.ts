export const environment = {
  production: true,
  domain: 'asteroidprotocol.io',
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
          receiver: "",
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
          receiver: "",
          denom: "uatom",
          amount: "0"
        },
        mint: {
          receiver: "",
          denom: "uatom",
          amount: "0"
        },
        transfer: {
          receiver: "",
          denom: "uatom",
          amount: "0"
        },
        list: {
          receiver: "",
          denom: "uatom",
          amount: "0",
          minTradeSize: 0.000001,
        },
        buy: {
          receiver: "neutron162mdca7dfk2rpqlv0hhc6sepnvwdxv5ympu766",
          denom: "uatom",
          amount: "0.02", // Default 2%
          type: "dynamic-percent"
        },
        delist: {
          receiver: "",
          denom: "uatom",
          amount: "0"
        },
      },
    },
    chain: {
      gasLimit: "12000000"
    }
  },
  api: {
    endpoint: 'https://api.asteroidprotocol.io/v1/graphql',
    wss: 'wss://api.asteroidprotocol.io/v1/graphql',
    explorer: 'https://www.mintscan.io/cosmos/tx/',
    simulateEndpoint: "https://cosmos-rest.cosmos-apis.com",
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
