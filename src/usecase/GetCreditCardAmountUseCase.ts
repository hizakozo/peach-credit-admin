import { ICreditCardRepository } from '../domain/repository/ICreditCardRepository';
import { SettlementCalculator } from '../domain/service/SettlementCalculator';
import { MonthlySettlement } from '../domain/model/MonthlySettlement';
import { YearMonth } from '../domain/model/YearMonth';

/**
 * クレジットカード利用金額取得ユースケース
 * 指定された年月のクレジットカード利用金額を取得し、夫婦で分割した精算情報を返す
 */
export class GetCreditCardAmountUseCase {
  constructor(
    private readonly creditCardRepository: ICreditCardRepository,
    private readonly settlementCalculator: SettlementCalculator
  ) {}

  /**
   * クレジットカード利用金額を取得して精算情報を作成
   * @param yearMonth 対象年月
   * @returns 月次精算情報
   */
  async execute(yearMonth: YearMonth): Promise<MonthlySettlement> {
    // 1. クレジットカード利用金額を取得
    const totalAmount = await this.creditCardRepository.getMonthlyAmount(yearMonth);

    // 2. 夫婦で分割して精算情報を作成
    const settlement = this.settlementCalculator.calculate(yearMonth, totalAmount);

    return settlement;
  }
}
