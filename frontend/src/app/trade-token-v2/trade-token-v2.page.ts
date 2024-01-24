import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from 'src/environments/environment';
import { Chain, Subscription, order_by } from '../core/types/zeus';
import { ShortenAddressPipe } from '../core/pipe/shorten-address.pipe';
import { HumanSupplyPipe } from '../core/pipe/human-supply.pipe';
import { TokenDecimalsPipe } from '../core/pipe/token-with-decimals.pipe';
import { CFT20Service } from '../core/metaprotocol/cft20.service';
import { TransactionFlowModalPage } from '../transaction-flow-modal/transaction-flow-modal.page';
import { WalletService } from '../core/service/wallet.service';
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { TableModule } from 'primeng/table';
import { PriceService } from '../core/service/price.service';
import { SellModalPage } from '../sell-modal/sell-modal.page';
import { WalletRequiredModalPage } from '../wallet-required-modal/wallet-required-modal.page';
import { MarketplaceService } from '../core/metaprotocol/marketplace.service';
import { SortEvent } from 'primeng/api';
import { DateAgoPipe } from '../core/pipe/date-ago.pipe';
import {UtcToLocalPipe} from "../core/pipe/utc-to-local.pipe";
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
@Component({
  selector: 'app-trade-token-v2',
  templateUrl: './trade-token-v2.page.html',
  styleUrls: ['./trade-token-v2.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ShortenAddressPipe, RouterLink, DatePipe, HumanSupplyPipe, TokenDecimalsPipe, TableModule, DateAgoPipe, UtcToLocalPipe]
})
export class TradeTokenV2Page implements OnInit {
  selectedSection: string = 'buy';
  activityData: any[] = [];
  @ViewChild('priceChart') priceChart!: ElementRef;
  chart!: Chart;
  perMintLimit!: number;
  isLoading = false;
  token: any;
  listings: any;
  depositedListings: any;
  explorerTxUrl: string = environment.api.explorer;
  tokenLaunchDate: Date;
  tokenIsLaunched: boolean = false;
  baseTokenUSD: number = 0.00;
  walletAddress: string = '';
  currentBlock: number = 0;
  limit: number = 2000;

  constructor(private activatedRoute: ActivatedRoute, private protocolService: MarketplaceService, private modalCtrl: ModalController, private alertController: AlertController, private walletService: WalletService, private priceService: PriceService,private http: HttpClient) {
    this.tokenLaunchDate = new Date();
  }

  async ngOnInit() {
    this.isLoading = true;
    this.selectedSection = this.activatedRoute.snapshot.queryParams["section"] || 'buy';
    this.loadActivityData();
    const walletConnected = await this.walletService.isConnected();
    if (walletConnected) {
      this.walletAddress = (await this.walletService.getAccount()).address;
    }

    const chain = Chain(environment.api.endpoint)
    const result = await chain('query')({
      token: [
        {
          where: {
            ticker: {
              _eq: this.activatedRoute.snapshot.params["quote"].toUpperCase()
            }
          }
        }, {
          id: true,
          height: true,
          transaction: {
            hash: true
          },
          creator: true,
          current_owner: true,
          name: true,
          ticker: true,
          decimals: true,
          max_supply: true,
          per_mint_limit: true,
          launch_timestamp: true,
          content_path: true,
          content_size_bytes: true,
          circulating_supply: true,
          last_price_base: true,
          volume_24_base: true,
          date_created: true,
        }
      ]
    });

    this.token = result.token[0];
    this.perMintLimit = parseInt(this.token.per_mint_limit);
    const listingsResult = await chain('query')({
      marketplace_cft20_detail: [
        {
          where: {
            token_id: {
              _eq: this.token.id
            },
            marketplace_listing: {
              is_cancelled: {
                _eq: false
              },
              is_filled: {
                _eq: false
              }
            }
          },
          limit: this.limit,
          order_by: [
            {
              ppt: order_by.asc
            }
          ]
        },
        {
          id: true,
          marketplace_listing: {
            seller_address: true,
            total: true,
            depositor_address: true,
            is_deposited: true,
            depositor_timedout_block: true,
            deposit_total: true,
            transaction: {
              hash: true
            },
          },
          ppt: true,
          amount: true,
          date_created: true,
        }
      ]
    });
    this.listings = listingsResult.marketplace_cft20_detail;

    const statusResult = await chain('query')({
      status: [
        {
          where: {
            chain_id: {
              _eq: environment.chain.chainId
            }
          }
        },
        {
          base_token: true,
          base_token_usd: true,
          last_processed_height: true,
        }
      ]
    })
    this.baseTokenUSD = statusResult.status[0].base_token_usd;
    this.currentBlock = statusResult.status[0].last_processed_height;

    const depositListingsResult = await chain('query')({
      marketplace_cft20_detail: [
        {
          where: {
            token_id: {
              _eq: this.token.id
            },
            marketplace_listing: {
              is_cancelled: {
                _eq: false
              },
              is_filled: {
                _eq: false
              },
              is_deposited: {
                _eq: true
              },
              depositor_address: {
                _eq: this.walletAddress
              },
              depositor_timedout_block: {
                _gt: this.currentBlock
              }
            }
          },
          limit: this.limit,
        },
        {
          id: true,
          marketplace_listing: {
            seller_address: true,
            total: true,
            depositor_address: true,
            is_deposited: true,
            depositor_timedout_block: true,
            deposit_total: true,
            transaction: {
              hash: true
            },
          },
          ppt: true,
          amount: true,
          date_created: true,
        }
      ]
    });
    this.depositedListings = depositListingsResult.marketplace_cft20_detail;

    const wsChain = Subscription(environment.api.wss);
    wsChain('subscription')({
      status: [
        {
          where: {
            chain_id: {
              _eq: environment.chain.chainId
            }
          }
        },
        {
          base_token: true,
          base_token_usd: true,
          last_processed_height: true,
        }
      ]
    }).on(({ status }) => {
      this.baseTokenUSD = status[0].base_token_usd;
      this.currentBlock = status[0].last_processed_height;
    });

    wsChain('subscription')({
      marketplace_cft20_detail: [
        {
          where: {
            token_id: {
              _eq: this.token.id
            },
            marketplace_listing: {
              is_cancelled: {
                _eq: false
              },
              is_filled: {
                _eq: false
              },

            }
          },
          limit: this.limit,
        },
        {
          id: true,
          marketplace_listing: {
            seller_address: true,
            total: true,
            depositor_address: true,
            is_deposited: true,
            depositor_timedout_block: true,
            deposit_total: true,
            transaction: {
              hash: true
            },
          },
          ppt: true,
          amount: true,
          date_created: true,
        }
      ]
    }).on(({ marketplace_cft20_detail }) => {
      this.listings = marketplace_cft20_detail;
    });

    wsChain('subscription')({
      marketplace_cft20_detail: [
        {
          where: {
            token_id: {
              _eq: this.token.id
            },
            marketplace_listing: {
              is_cancelled: {
                _eq: false
              },
              is_filled: {
                _eq: false
              },
              is_deposited: {
                _eq: true
              },
              depositor_address: {
                _eq: this.walletAddress
              },
              depositor_timedout_block: {
                _gt: this.currentBlock
              }
            }
          },
          limit: this.limit,
        },
        {
          id: true,
          marketplace_listing: {
            seller_address: true,
            total: true,
            depositor_address: true,
            is_deposited: true,
            depositor_timedout_block: true,
            deposit_total: true,
            transaction: {
              hash: true
            },
          },
          ppt: true,
          amount: true,
          date_created: true,
        }
      ]
    }).on(({ marketplace_cft20_detail }) => {
      this.depositedListings = marketplace_cft20_detail;
    });

    this.isLoading = false;

  }

  async deposit(listingHash: string) {
    const chain = Chain(environment.api.endpoint)
    const listingResult = await chain('query')({
      marketplace_listing: [
        {
          where: {
            transaction: {
              hash: {
                _eq: listingHash
              }
            }
          }
        }, {
          seller_address: true,
          total: true,
          deposit_total: true,
          is_deposited: true,
          is_cancelled: true,
          is_filled: true,
        }
      ]
    });

    if (listingResult.marketplace_listing.length == 0) {
      alert("Listing not found");
      return;
    }
    const listing = listingResult.marketplace_listing[0];

    const deposit: bigint = listing.deposit_total as bigint;

    const purchaseMessage = {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: MsgSend.encode({
        fromAddress: (await this.walletService.getAccount()).address,
        toAddress: listing.seller_address,
        amount: [
          {
            denom: "uatom",
            amount: deposit.toString(),
          }
        ],
      }).finish(),
    }

    const purchaseMessageJSON = {
      '@type': "/cosmos.bank.v1beta1.MsgSend",
      from_address: (await this.walletService.getAccount()).address,
      to_address: listing.seller_address,
      amount: [
        {
          denom: "uatom",
          amount: deposit.toString(),
        }
      ],
    }

    // Construct metaprotocol memo message
    const params = new Map([
      ["h", listingHash],
    ]);
    const urn = this.protocolService.buildURN(environment.chain.chainId, 'deposit', params);
    const modal = await this.modalCtrl.create({
      keyboardClose: true,
      backdropDismiss: false,
      component: TransactionFlowModalPage,
      componentProps: {
        urn,
        metadata: null,
        data: null,
        routerLink: ['/app/market', this.token.ticker],
        resultCTA: 'Back to market',
        metaprotocol: 'marketplace',
        metaprotocolAction: 'deposit',
        messages: [purchaseMessage],
        messagesJSON: [purchaseMessageJSON],
      }
    });
    modal.present();
  }

  async buy(listingHash: string) {
    const chain = Chain(environment.api.endpoint)
    const listingResult = await chain('query')({
      marketplace_listing: [
        {
          where: {
            transaction: {
              hash: {
                _eq: listingHash
              }
            }
          }
        }, {
          seller_address: true,
          total: true,
          deposit_total: true,
          is_deposited: true,
          is_cancelled: true,
          is_filled: true,
        }
      ]
    });

    if (listingResult.marketplace_listing.length == 0) {
      alert("Listing not found");
      return;
    }
    const listing = listingResult.marketplace_listing[0];
    let totaluatom: bigint = listing.total as bigint;
    const additionalFeePercent = environment.fees.additionalFee.percent;
    const additionalFeeAmount = Math.floor(Number(totaluatom) * additionalFeePercent);

    const additionalFeeMessage = {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: MsgSend.encode({
        fromAddress: (await this.walletService.getAccount()).address,
        toAddress: environment.fees.additionalFee.receiver,
        amount: [
          {
            denom: "uatom",
            amount: BigInt(additionalFeeAmount).toString(),
          }
        ],
      }).finish(),
    };


    if (!this.walletService.hasWallet()) {
      // Popup explaining that Keplr is needed and needs to be installed first
      const modal = await this.modalCtrl.create({
        keyboardClose: true,
        backdropDismiss: true,
        component: WalletRequiredModalPage,
        cssClass: 'wallet-required-modal',
      });
      modal.present();
      return;
    }

    const deposit: bigint = listing.deposit_total as bigint;
    if (deposit > totaluatom) {
      // If deposit is greater than total, then just sent 1uatom to complete the transaction
      totaluatom = BigInt(1);
    } else {
      // Subtract deposit amount already sent
      totaluatom -= deposit;
    }
    let decimalTotal = parseFloat(totaluatom.toString()) / 10 ** this.token.decimals;

    const purchaseMessage = {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: MsgSend.encode({
        fromAddress: (await this.walletService.getAccount()).address,
        toAddress: listing.seller_address,
        amount: [
          {
            denom: "uatom",
            amount: totaluatom.toString(),
          }
        ],
      }).finish(),
    }

    const purchaseMessageJSON = {
      '@type': "/cosmos.bank.v1beta1.MsgSend",
      from_address: (await this.walletService.getAccount()).address,
      to_address: listing.seller_address,
      amount: [
        {
          denom: "uatom",
          amount: totaluatom.toString(),
        }
      ],
    }

    // Calculate the trading fee
    let overrideFee = (environment.fees.protocol.marketplace["buy.cft20"] as any).amount;
    if ((environment.fees.protocol.marketplace["buy.cft20"] as any).type == 'dynamic-percent') {
      const feePercentage = parseFloat((environment.fees.protocol.marketplace["buy.cft20"] as any).amount);
      let fee = decimalTotal * feePercentage;
      if (fee < 0.000001) {
        fee = 0.000001;
      }
      fee = fee * 10 ** this.token.decimals;
      overrideFee = fee.toFixed(0);
    }

    // Construct metaprotocol memo message
    const params = new Map([
      ["h", listingHash],
    ]);
    const urn = this.protocolService.buildURN(environment.chain.chainId, 'buy.cft20', params);
    const modal = await this.modalCtrl.create({
      keyboardClose: true,
      backdropDismiss: false,
      component: TransactionFlowModalPage,
      componentProps: {
        urn,
        metadata: null,
        data: null,
        routerLink: ['/app/market', this.token.ticker],
        resultCTA: 'Back to market',
        metaprotocol: 'marketplace',
        metaprotocolAction: 'buy.cft20',
        messages: [purchaseMessage, additionalFeeMessage],
        messagesJSON: [purchaseMessageJSON],
        overrideFee,
      }
    });
    modal.present();
  }

  async cancel(listingHash: string) {
    if (!this.walletService.hasWallet()) {
      // Popup explaining that Keplr is needed and needs to be installed first
      const modal = await this.modalCtrl.create({
        keyboardClose: true,
        backdropDismiss: true,
        component: WalletRequiredModalPage,
        cssClass: 'wallet-required-modal',
      });
      modal.present();
      return;
    }

    // Construct metaprotocol memo message
    const params = new Map([
      ["h", listingHash],
    ]);
    const urn = this.protocolService.buildURN(environment.chain.chainId, 'delist', params);
    const modal = await this.modalCtrl.create({
      keyboardClose: true,
      backdropDismiss: false,
      component: TransactionFlowModalPage,
      componentProps: {
        urn,
        metadata: null,
        data: null,
        routerLink: ['/app/market', this.token.ticker],
        resultCTA: 'Back to market',
        metaprotocol: 'marketplace',
        metaprotocolAction: 'delist',
      }
    });
    modal.present();

  }

  async listSale() {

    const modal = await this.modalCtrl.create({
      keyboardClose: true,
      backdropDismiss: true,
      component: SellModalPage,

      componentProps: {
        ticker: this.token.ticker
      }
    });
    modal.present();
  }

  customSort(event: SortEvent) {
    console.log(event.field);
    if (event.field == 'marketplace_listing.total') {
      event.data?.sort((data1, data2) => {

        let value1 = parseInt(data1["marketplace_listing"].total);
        let value2 = parseInt(data2["marketplace_listing"].total);
        let result = null;

        if (value1 == null && value2 != null) result = -1;
        else if (value1 != null && value2 == null) result = 1;
        else if (value1 == null && value2 == null) result = 0;
        else result = value1 < value2 ? -1 : value1 > value2 ? 1 : 0;

        return event.order as number * result;
      });

    }
    if (event.field == 'marketplace_listing.deposit_total') {
      event.data?.sort((data1, data2) => {

        let value1 = parseInt(data1["marketplace_listing"].deposit_total) / parseInt(data1["marketplace_listing"].total);
        let value2 = parseInt(data2["marketplace_listing"].deposit_total) / parseInt(data2["marketplace_listing"].total);
        let result = null;

        if (value1 == null && value2 != null) result = -1;
        else if (value1 != null && value2 == null) result = 1;
        else if (value1 == null && value2 == null) result = 0;
        else result = value1 < value2 ? -1 : value1 > value2 ? 1 : 0;

        return event.order as number * result;
      });

    }

    event.data?.sort((data1, data2) => {
      let value1 = data1[event.field as string];
      let value2 = data2[event.field as string];
      let result = null;

      if (value1 == null && value2 != null) result = -1;
      else if (value1 != null && value2 == null) result = 1;
      else if (value1 == null && value2 == null) result = 0;
      else if (typeof value1 === 'string' && typeof value2 === 'string') result = value1.localeCompare(value2);
      else result = value1 < value2 ? -1 : value1 > value2 ? 1 : 0;

      return event.order as number * result;
    });
  }

  sectionChanged($event: any) {
    this.selectedSection = $event.detail.value;
    if (this.selectedSection === 'activity') {
      this.loadActivityData();
    }
  }
  createChart(labels: string[], data: number[]) {
    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(this.priceChart.nativeElement, {
      type: 'line', // 您可以更改图表类型，例如 'bar'
      data: {
        labels: labels,
        datasets: [{
          label: 'Price per Mint (USD)',
          data: data,
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
  async loadActivityData() {
    const ticker = this.activatedRoute.snapshot.params["quote"].toUpperCase();
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    const body = {
      query: `
        query {
          token_trade_history(where: { _and: [{ token: { ticker: { _eq: "${ticker}" } } }] }, limit: 1000, order_by: [{ transaction_id: desc }]) {
            amount_base
            buyer_address
            seller_address
            rate
            total_usd
            transaction {
              hash
              date_created
            }
          }
        }
      `
    };

    this.http.post('https://api.asteroidprotocol.io/v1/graphql', JSON.stringify(body), { headers })
      .subscribe({
        next: (data: any) => {
          this.activityData = data.data.token_trade_history;
          const filteredData = this.activityData.filter(item => item.amount_base >= 500000000);
          const groupedData = this.groupDataBy30Minutes(filteredData);
          const sortedGroupedData = new Map([...groupedData.entries()].sort((a, b) => {
            return new Date(a[0]).getTime() - new Date(b[0]).getTime();
          }));
          // 准备图表数据
          const labels = Array.from(sortedGroupedData.keys());
          const r = Array.from(sortedGroupedData.values()).map(group => {
            const totalUsd = group.reduce((sum: any, item: { total_usd: any; }) => sum + item.total_usd, 0);
            const totalAmountBase = group.reduce((sum: any, item: { amount_base: any; }) => sum + item.amount_base, 0);
            return totalUsd / (totalAmountBase / this.perMintLimit);
          });
          this.createChart(labels, r);
        },
        error: (error) => {
          console.error('Error fetching activity data:', error);
        }
      });
  }
  groupDataBy30Minutes(data: any[]) {
    const grouped = new Map();

    data.forEach(item => {
      // 将 UTC 时间转换为本地时间
      let date = new Date(item.transaction.date_created);
      date = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

      // 将时间调整为每30分钟
      date.setMinutes(date.getMinutes() - (date.getMinutes() % 30), 0, 0);
      const key = date.toLocaleString();

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(item);
    });

    return grouped;
  }
  formatAddress(address: string): string {
    return `${address.substring(0, 12)} ... ${address.substring(address.length - 5)}`;
  }
}
