import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedDataService {
  private tokenPrices = new Map<string, number>();

  setPrice(token: string, price: number) {
    this.tokenPrices.set(token, price);
  }

  getPrice(token: string): number {
    return this.tokenPrices.get(token) || 0;
  }
}
