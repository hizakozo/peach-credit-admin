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
   * 建て替え記録を追加
   */
  add(payment: AdvancePayment): void;

  /**
   * 建て替え記録を削除
   */
  delete(id: string): void;
}
