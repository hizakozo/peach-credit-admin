import { IAdvancePaymentRepository } from '../domain/repository/IAdvancePaymentRepository';
import { AdvancePayment } from '../domain/model/AdvancePayment';

/**
 * 建て替え記録取得ユースケース
 */
export class GetAdvancePaymentsUseCase {
  constructor(private readonly repository: IAdvancePaymentRepository) {}

  /**
   * 指定された年月の建て替え記録を取得
   */
  execute(year: number, month: number): AdvancePayment[] {
    return this.repository.findByYearMonth(year, month);
  }
}
