import { IAdvancePaymentRepository } from '../domain/repository/IAdvancePaymentRepository';
import { AdvancePayment } from '../domain/model/AdvancePayment';
import { Money } from '../domain/model/Money';
import { Payer } from '../domain/model/Payer';

/**
 * 建て替え記録追加ユースケース
 */
export class AddAdvancePaymentUseCase {
  constructor(private readonly repository: IAdvancePaymentRepository) {}

  /**
   * 建て替え記録を追加
   */
  execute(date: Date, payer: Payer, amount: number, memo: string): void {
    // 新しいIDを生成（タイムスタンプベース）
    const id = Date.now().toString();

    const payment = new AdvancePayment(
      id,
      date,
      payer,
      new Money(amount),
      memo
    );

    this.repository.add(payment);
  }
}
