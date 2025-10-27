/**
 * 金額を表す値オブジェクト
 */
export class Money {
  private readonly amount: number;

  constructor(amount: number) {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
    this.amount = amount;
  }

  getValue(): number {
    return this.amount;
  }

  /**
   * 金額を指定された数で割る（切り捨て）
   */
  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Cannot divide by zero');
    }
    if (divisor < 0) {
      throw new Error('Divisor must be positive');
    }
    return new Money(Math.floor(this.amount / divisor));
  }

  /**
   * 金額の等価性チェック
   */
  equals(other: Money): boolean {
    return this.amount === other.amount;
  }

  /**
   * 金額を「45,894円」形式でフォーマット
   */
  format(): string {
    return `${this.amount.toLocaleString('ja-JP')}円`;
  }
}
