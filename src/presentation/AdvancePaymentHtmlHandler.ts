import { GetAdvancePaymentsUseCase } from '../usecase/GetAdvancePaymentsUseCase';
import { AddAdvancePaymentUseCase } from '../usecase/AddAdvancePaymentUseCase';
import { DeleteAdvancePaymentUseCase } from '../usecase/DeleteAdvancePaymentUseCase';
import { CalculateSettlementUseCase } from '../usecase/CalculateSettlementUseCase';
import { Payer } from '../domain/model/Payer';

/**
 * 建て替え記録HTMLアプリのハンドラー
 */
export class AdvancePaymentHtmlHandler {
  constructor(
    private readonly getPaymentsUseCase: GetAdvancePaymentsUseCase,
    private readonly addPaymentUseCase: AddAdvancePaymentUseCase,
    private readonly deletePaymentUseCase: DeleteAdvancePaymentUseCase,
    private readonly calculateSettlementUseCase: CalculateSettlementUseCase
  ) {}

  /**
   * 今月の建て替え記録一覧を取得（クライアント側から呼ばれる）
   */
  getPayments(): any[] {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const payments = this.getPaymentsUseCase.execute(year, month);

    return payments.map((payment) => ({
      id: payment.getId(),
      date: payment.getFormattedDate(),
      payer: payment.getPayer().getValue(),
      amount: payment.getAmount().getValue(),
      memo: payment.getMemo(),
    }));
  }

  /**
   * 精算計算（クライアント側から呼ばれる）
   */
  getSettlement(): any {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const result = this.calculateSettlementUseCase.execute(year, month);

    return {
      husbandTotal: result.husbandTotal.getValue(),
      wifeTotal: result.wifeTotal.getValue(),
      settlementAmount: result.settlementAmount.getValue(),
      settlementPayer: result.settlementPayer?.getValue() || null,
    };
  }

  /**
   * 建て替え記録を追加（クライアント側から呼ばれる）
   */
  addPayment(date: string, payer: string, amount: number, memo: string): void {
    const payerObj = Payer.fromString(payer);
    const dateObj = new Date(date);
    this.addPaymentUseCase.execute(dateObj, payerObj, amount, memo);
  }

  /**
   * 建て替え記録を削除（クライアント側から呼ばれる）
   */
  deletePayment(id: string): void {
    this.deletePaymentUseCase.execute(id);
  }
}
