import { AdvancePayment } from '../model/AdvancePayment';

/**
 * 建て替え記録リポジトリのインターフェース
 * Gateway層で実装される
 */
export interface IAdvancePaymentRepository {
  /**
   * 全ての建て替え記録を取得
   */
  findAll(): AdvancePayment[];

  /**
   * 指定された年月の建て替え記録を取得
   */
  findByYearMonth(year: number, month: number): AdvancePayment[];

  /**
   * 指定された日付範囲の建て替え記録を取得
   * @param startDate 開始日（含む）
   * @param endDate 終了日（含む）
   */
  findByDateRange(startDate: Date, endDate: Date): AdvancePayment[];

  /**
   * 建て替え記録を追加
   */
  add(payment: AdvancePayment): void;

  /**
   * 建て替え記録を削除
   */
  delete(id: string): void;
}
