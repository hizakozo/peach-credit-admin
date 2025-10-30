import { Money } from './Money';
import { YearMonth } from './YearMonth';

/**
 * 月次精算を表す値オブジェクト
 * 対象月と夫婦それぞれの支払い金額を保持
 */
export class MonthlySettlement {
  constructor(
    private readonly yearMonth: YearMonth,
    private readonly creditCardTotal: Money,
    private readonly husbandAmount: Money,
    private readonly wifeAmount: Money
  ) {}

  getYearMonth(): YearMonth {
    return this.yearMonth;
  }

  getCreditCardTotal(): Money {
    return this.creditCardTotal;
  }

  getHusbandAmount(): Money {
    return this.husbandAmount;
  }

  getWifeAmount(): Money {
    return this.wifeAmount;
  }

  /**
   * 合計金額を取得
   */
  getTotalAmount(): Money {
    return new Money(
      this.husbandAmount.getValue() + this.wifeAmount.getValue()
    );
  }

  /**
   * LINE メッセージ形式でフォーマット
   */
  formatMessage(): string {
    return (
      '💳 今月の支払い金額が確定しました\n\n' +
      `【${this.yearMonth.format()}支払い分】\n\n` +
      `カード合計: ${this.creditCardTotal.format()}\n\n` +
      `👨 ${this.husbandAmount.format()}\n` +
      `👩 ${this.wifeAmount.format()}`
    );
  }
}
