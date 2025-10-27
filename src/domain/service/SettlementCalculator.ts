import { Money } from '../model/Money';
import { MonthlySettlement } from '../model/MonthlySettlement';
import { YearMonth } from '../model/YearMonth';

/**
 * 精算計算を行うドメインサービス
 * 合計金額を夫婦で50%ずつに分割する
 */
export class SettlementCalculator {
  /**
   * 合計金額を夫婦で50%ずつ分割して月次精算を作成
   * @param yearMonth 対象年月
   * @param totalAmount 合計金額
   * @returns 月次精算
   */
  calculate(yearMonth: YearMonth, totalAmount: Money): MonthlySettlement {
    // 50%ずつに分割（切り捨て）
    const halfAmount = totalAmount.divide(2);

    return new MonthlySettlement(yearMonth, halfAmount, halfAmount);
  }
}
