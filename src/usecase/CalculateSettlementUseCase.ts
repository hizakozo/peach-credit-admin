import { IAdvancePaymentRepository } from '../domain/repository/IAdvancePaymentRepository';
import { Money } from '../domain/model/Money';
import { Payer } from '../domain/model/Payer';

/**
 * 精算結果DTO
 */
export interface SettlementResult {
  husbandTotal: Money;
  wifeTotal: Money;
  settlementAmount: Money;
  settlementPayer: Payer | null; // nullの場合は差額なし
}

/**
 * 精算計算ユースケース
 */
export class CalculateSettlementUseCase {
  constructor(private readonly repository: IAdvancePaymentRepository) {}

  /**
   * 指定された年月の精算を計算
   * 多く払った方から少なく払った方への精算額を計算
   */
  execute(year: number, month: number): SettlementResult {
    const payments = this.repository.findByYearMonth(year, month);

    let husbandTotal = 0;
    let wifeTotal = 0;

    for (const payment of payments) {
      const amount = payment.getAmount().getValue();
      if (payment.getPayer().equals(Payer.HUSBAND)) {
        husbandTotal += amount;
      } else if (payment.getPayer().equals(Payer.WIFE)) {
        wifeTotal += amount;
      }
    }

    // 差額を計算
    const diff = Math.abs(husbandTotal - wifeTotal);

    // 多く払った方を判定
    let settlementPayer: Payer | null = null;
    if (husbandTotal > wifeTotal) {
      settlementPayer = Payer.WIFE; // 妻が夫に払う
    } else if (wifeTotal > husbandTotal) {
      settlementPayer = Payer.HUSBAND; // 夫が妻に払う
    }

    return {
      husbandTotal: new Money(husbandTotal),
      wifeTotal: new Money(wifeTotal),
      settlementAmount: new Money(diff),
      settlementPayer,
    };
  }
}
