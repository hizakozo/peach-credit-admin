import { ICreditCardRepository } from '../domain/repository/ICreditCardRepository';
import { Money } from '../domain/model/Money';
import { YearMonth } from '../domain/model/YearMonth';
import { ZaimApiDriver, ZaimAccount, ZaimTransaction } from '../driver/ZaimApiDriver';

/**
 * クレジットカードリポジトリの実装
 * Zaim API を使用してクレジットカード情報を取得
 */
export class CreditCardRepositoryImpl implements ICreditCardRepository {
  private readonly CARD_NAME_KEYWORDS = ['楽天', 'カード'];

  constructor(private readonly zaimApiDriver: ZaimApiDriver) {}

  /**
   * 指定された年月のクレジットカード利用金額を取得
   */
  async getMonthlyAmount(yearMonth: YearMonth): Promise<Money> {
    // 1. アカウント一覧から楽天カードを検索
    const accounts = this.zaimApiDriver.getAccounts();
    const rakutenCard = this.findActiveRakutenCard(accounts);

    if (!rakutenCard) {
      throw new Error('Active Rakuten Card not found');
    }

    // 2. 全取引データを取得
    const allTransactions = this.zaimApiDriver.getTransactions();

    // 3. 楽天カードの取引をフィルタ
    const rakutenCardId = rakutenCard.id.toString();
    const cardTransactions = this.filterCardTransactions(allTransactions, rakutenCardId);

    // 4. 指定年月の取引をフィルタ
    const monthlyTransactions = this.filterByYearMonth(cardTransactions, yearMonth);

    // 5. 合計金額を計算
    const totalAmount = this.calculateTotalAmount(monthlyTransactions);

    return new Money(totalAmount);
  }

  /**
   * アクティブな楽天カードを検索
   */
  private findActiveRakutenCard(accounts: ZaimAccount[]): ZaimAccount | undefined {
    return accounts.find(account =>
      account.active === 1 &&
      account.name &&
      this.CARD_NAME_KEYWORDS.every(keyword => account.name.includes(keyword))
    );
  }

  /**
   * 指定されたカードの取引をフィルタ
   * from_account_id または to_account_id が一致する取引を抽出
   */
  private filterCardTransactions(
    transactions: ZaimTransaction[],
    cardId: string
  ): ZaimTransaction[] {
    return transactions.filter(transaction => {
      const fromId = transaction.from_account_id?.toString() || '';
      const toId = transaction.to_account_id?.toString() || '';
      return fromId === cardId || toId === cardId;
    });
  }

  /**
   * 指定年月の取引をフィルタ
   */
  private filterByYearMonth(
    transactions: ZaimTransaction[],
    yearMonth: YearMonth
  ): ZaimTransaction[] {
    const targetYear = yearMonth.getYear();
    const targetMonth = yearMonth.getMonth();

    return transactions.filter(transaction => {
      // date は "YYYY-MM-DD" 形式
      const [year, month] = transaction.date.split('-').map(Number);
      return year === targetYear && month === targetMonth;
    });
  }

  /**
   * 取引の合計金額を計算
   */
  private calculateTotalAmount(transactions: ZaimTransaction[]): number {
    return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  }
}
