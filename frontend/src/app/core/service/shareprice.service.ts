import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedDataService {
  private _averagePrice: number;

  constructor() {
    this._averagePrice = 0;
  }

  get averagePrice(): number {
    return this._averagePrice;
  }

  set averagePrice(value: number) {
    this._averagePrice = value;
  }
}
