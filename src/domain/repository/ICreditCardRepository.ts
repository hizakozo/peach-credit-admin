import { Money } from '../model/Money';
import { YearMonth } from '../model/YearMonth';

/**
 * クレジットカード情報リポジトリのインターフェース
 */
export interface ICreditCardRepository {
  /**
   * 指定された年月のクレジットカード利用金額を取得
   * @param yearMonth 対象年月
   * @returns 利用金額
   */
  getMonthlyAmount(yearMonth: YearMonth): Promise<Money>;
}
