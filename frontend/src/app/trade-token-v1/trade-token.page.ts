import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from 'src/environments/environment';
import { order_by, Subscription} from '../core/types/zeus';
import { Chain } from '../core/helpers/zeus';
import { ShortenAddressPipe } from '../core/pipe/shorten-address.pipe';
import { HumanSupplyPipe } from '../core/pipe/human-supply.pipe';
import { TokenDecimalsPipe } from '../core/pipe/token-with-decimals.pipe';
import { UtcToLocalPipe } from '../core/pipe/utc-to-local.pipe';
import { CFT20Service } from '../core/metaprotocol/cft20.service';
import { TransactionFlowModalPage } from '../transaction-flow-modal/transaction-flow-modal.page';
import { WalletService } from '../core/service/wallet.service';
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { TableModule } from 'primeng/table';
import { PriceService } from '../core/service/price.service';
import { SellModalPage } from '../sell-modal/sell-modal.page';
import { WalletRequiredModalPage } from '../wallet-required-modal/wallet-required-modal.page';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
@Component({
  selector: 'app-trade-token',
  templateUrl: './trade-token.page.html',
  styleUrls: ['./trade-token.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ShortenAddressPipe, RouterLink, DatePipe, HumanSupplyPipe, TokenDecimalsPipe, TableModule, UtcToLocalPipe]
})
export class TradeTokenPage implements OnInit {
  selectedSection: string = 'buy';
  activityData: any[] = [];
  chart!: Chart;
  perMintLimit!: number;
  @ViewChild('priceChart') priceChart!: ElementRef;

  indexerDelaySeconds: number = 0;
  private intervalId: any;
  isLoading = false;
  token: any;
  positions: any;
  explorerTxUrl: string = environment.api.explorer;
  tokenLaunchDate: Date;
  tokenIsLaunched: boolean = false;
  baseTokenUSD: number = 0.00;
  walletAddress: string = '';

  constructor(private activatedRoute: ActivatedRoute, private protocolService: CFT20Service, private modalCtrl: ModalController, private alertController: AlertController, private walletService: WalletService, private priceService: PriceService,private http: HttpClient) {
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
    this.updateIndexerDelay();
    this.intervalId = setInterval(() => {
      this.updateIndexerDelay();
    }, 2000);
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
    const positionsResult = await chain('query')({
      token_open_position: [
        {
          where: {
            _and: [
              {
                token: {
                  ticker: {
                    _eq: this.activatedRoute.snapshot.params["quote"].toUpperCase()
                  }
                }
              },
              {
                is_cancelled: {
                  _eq: false
                }
              },
              {
                is_filled: {
                  _eq: false
                }
              }
            ]
          }
        }, {
          id: true,
          token: {
            ticker: true,
          },
          seller_address: true,
          ppt: true,
          amount: true,
          total: true,
          is_cancelled: false,
          is_filled: false,
          date_created: true
        }
      ]
    });

    this.positions = positionsResult.token_open_position;

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
        }
      ]
    }).on(({ status }) => {
      this.baseTokenUSD = status[0].base_token_usd;
    });

    wsChain('subscription')({
      token: [
        {
          where: {
            ticker: {
              _eq: this.activatedRoute.snapshot.params["quote"].toUpperCase()
            }
          }
        }, {
          id: true,
          name: true,
          ticker: true,
          decimals: true,
          content_path: true,
          last_price_base: true,
          volume_24_base: true,
        }
      ]
    }).on(({ token }) => {
      this.token = token[0];
    });

    wsChain('subscription')({
      token_open_position: [
        {
          where: {
            _and: [
              {
                token: {
                  ticker: {
                    _eq: this.activatedRoute.snapshot.params["quote"].toUpperCase()
                  }
                }
              },
              {
                is_cancelled: {
                  _eq: false
                }
              },
              {
                is_filled: {
                  _eq: false
                }
              }
            ]
          }
        }, {
          id: true,
          token: {
            ticker: true,
          },
          seller_address: true,
          ppt: true,
          amount: true,
          total: true,
          is_cancelled: false,
          is_filled: false,
          date_created: true,
        }
      ]
    }).on(({ token_open_position }) => {
      this.positions = token_open_position;
    });

    this.isLoading = false;
  }

  private updateIndexerDelay() {
    const query = { query: "query { status { date_updated } }" };
    this.http.post(environment.api.endpoint, query)
      .subscribe((response: any) => {
        const serverTime = new Date(response.data.status[0].date_updated);
        const currentTime = new Date();
        const utcCurrentTime = new Date(currentTime.getTime() + currentTime.getTimezoneOffset() * 60000);
        this.indexerDelaySeconds = Math.abs((utcCurrentTime.getTime() - serverTime.getTime()) / 1000);
      });
  }
  async buy(orderNumber: number) {

    const chain = Chain(environment.api.endpoint)
    const position = await chain('query')({
      token_open_position: [
        {
          where: {
            id: {
              _eq: orderNumber
            }
          }
        }, {
          id: true,
          token: {
            ticker: true,
          },
          seller_address: true,
          ppt: true,
          amount: true,
          total: true,
          is_cancelled: true,
          is_filled: true,
        }
      ]
    });

    // TODO: If cancelled or filled, show error message


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

    const totaluatom: bigint = position.token_open_position[0].total as bigint;

    const purchaseMessage = {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: MsgSend.encode({
        fromAddress: (await this.walletService.getAccount()).address,
        toAddress: position.token_open_position[0].seller_address,
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
      to_address: position.token_open_position[0].seller_address,
      amount: [
        {
          denom: "uatom",
          amount: totaluatom.toString(),
        }
      ],
    }

    // Calculate the trading fee
    let overrideFee = environment.fees.protocol.cft20.buy.amount;
    if (environment.fees.protocol.cft20.buy.type == 'dynamic-percent') {
      const feePercentage = parseFloat(environment.fees.protocol.cft20.buy.amount);
      const fee = parseInt(totaluatom.toString()) * feePercentage;
      overrideFee = fee.toString();
    }

    // Construct metaprotocol memo message
    const params = new Map([
      ["tic", this.token.ticker],
      ["ord", orderNumber],
    ]);
    const urn = this.protocolService.buildURN(environment.chain.chainId, 'buy', params);
    const modal = await this.modalCtrl.create({
      keyboardClose: true,
      backdropDismiss: false,
      component: TransactionFlowModalPage,
      componentProps: {
        urn,
        metadata: null,
        data: null,
        routerLink: ['/app/wallet/token', this.token.ticker],
        resultCTA: 'View transaction',
        metaprotocol: 'cft20',
        metaprotocolAction: 'buy',
        messages: [purchaseMessage],
        messagesJSON: [purchaseMessageJSON],
        overrideFee,
      }
    });
    modal.present();
  }

  async cancel(orderNumber: number) {
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
      ["tic", this.token.ticker],
      ["ord", orderNumber],
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
        routerLink: ['/app/wallet/token', this.token.ticker],
        resultCTA: 'View transaction',
        metaprotocol: 'cft20',
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

  formatAddress(address: string): string {
    return `${address.substring(0, 12)} ... ${address.substring(address.length - 5)}`;
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

    this.http.post(environment.api.endpoint, JSON.stringify(body), { headers })
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
}
