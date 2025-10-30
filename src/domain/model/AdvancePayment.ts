import { Money } from './Money';
import { Payer } from './Payer';

/**
 * 建て替え記録
 */
export class AdvancePayment {
  constructor(
    private readonly id: string,
    private readonly date: Date,
    private readonly payer: Payer,
    private readonly amount: Money,
    private readonly memo: string
  ) {}

  getId(): string {
    return this.id;
  }

  getDate(): Date {
    return this.date;
  }

  getPayer(): Payer {
    return this.payer;
  }

  getAmount(): Money {
    return this.amount;
  }

  getMemo(): string {
    return this.memo;
  }

  /**
   * 日付を "YYYY-MM-DD" 形式で取得
   */
  getFormattedDate(): string {
    const year = this.date.getFullYear();
    const month = String(this.date.getMonth() + 1).padStart(2, '0');
    const day = String(this.date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 指定された年月の記録かどうかを判定
   */
  isInMonth(year: number, month: number): boolean {
    return this.date.getFullYear() === year && this.date.getMonth() + 1 === month;
  }
}
