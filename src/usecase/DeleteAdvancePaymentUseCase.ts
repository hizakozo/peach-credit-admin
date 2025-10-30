import { IAdvancePaymentRepository } from '../domain/repository/IAdvancePaymentRepository';

/**
 * 建て替え記録削除ユースケース
 */
export class DeleteAdvancePaymentUseCase {
  constructor(private readonly repository: IAdvancePaymentRepository) {}

  /**
   * 建て替え記録を削除
   */
  execute(id: string): void {
    this.repository.delete(id);
  }
}
