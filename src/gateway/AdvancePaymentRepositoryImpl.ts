import { IAdvancePaymentRepository } from '../domain/repository/IAdvancePaymentRepository';
import { AdvancePayment } from '../domain/model/AdvancePayment';
import { Money } from '../domain/model/Money';
import { Payer } from '../domain/model/Payer';
import { SpreadsheetDriver, SpreadsheetRow } from '../driver/SpreadsheetDriver';

/**
 * 建て替え記録リポジトリの実装
 * SpreadsheetDriver を使ってデータを永続化
 */
export class AdvancePaymentRepositoryImpl implements IAdvancePaymentRepository {
  constructor(private readonly spreadsheetDriver: SpreadsheetDriver) {}

  /**
   * SpreadsheetRow を AdvancePayment に変換
   */
  private rowToAdvancePayment(row: SpreadsheetRow): AdvancePayment {
    return new AdvancePayment(
      row.id,
      new Date(row.date),
      Payer.fromString(row.payer),
      new Money(row.amount),
      row.memo
    );
  }

  /**
   * AdvancePayment を SpreadsheetRow に変換
   */
  private advancePaymentToRow(payment: AdvancePayment): SpreadsheetRow {
    return {
      id: payment.getId(),
      date: payment.getFormattedDate(),
      payer: payment.getPayer().getValue(),
      amount: payment.getAmount().getValue(),
      memo: payment.getMemo(),
      createdAt: new Date().toISOString(),
    };
  }

  findAll(): AdvancePayment[] {
    const rows = this.spreadsheetDriver.getAllRows();
    return rows.map((row) => this.rowToAdvancePayment(row));
  }

  findByYearMonth(year: number, month: number): AdvancePayment[] {
    const all = this.findAll();
    return all.filter((payment) => payment.isInMonth(year, month));
  }

  findByDateRange(startDate: Date, endDate: Date): AdvancePayment[] {
    const all = this.findAll();
    return all.filter((payment) => {
      const paymentDate = payment.getDate();
      return paymentDate >= startDate && paymentDate <= endDate;
    });
  }

  add(payment: AdvancePayment): void {
    const row = this.advancePaymentToRow(payment);
    this.spreadsheetDriver.appendRow(row);
  }

  delete(id: string): void {
    this.spreadsheetDriver.deleteRowById(id);
  }
}
