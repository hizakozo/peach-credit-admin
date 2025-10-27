import { Money } from '../domain/model/Money';
/**
 * クレジットカードリポジトリの実装
 * Zaim API を使用してクレジットカード情報を取得
 */
export class CreditCardRepositoryImpl {
    constructor(zaimApiDriver) {
        this.zaimApiDriver = zaimApiDriver;
        this.CARD_NAME_KEYWORDS = ['楽天', 'カード'];
    }
    /**
     * 指定された年月のクレジットカード利用金額を取得
     */
    async getMonthlyAmount(yearMonth) {
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
    findActiveRakutenCard(accounts) {
        return accounts.find(account => account.active === 1 &&
            account.name &&
            this.CARD_NAME_KEYWORDS.every(keyword => account.name.includes(keyword)));
    }
    /**
     * 指定されたカードの取引をフィルタ
     * from_account_id または to_account_id が一致する取引を抽出
     */
    filterCardTransactions(transactions, cardId) {
        return transactions.filter(transaction => {
            var _a, _b;
            const fromId = ((_a = transaction.from_account_id) === null || _a === void 0 ? void 0 : _a.toString()) || '';
            const toId = ((_b = transaction.to_account_id) === null || _b === void 0 ? void 0 : _b.toString()) || '';
            return fromId === cardId || toId === cardId;
        });
    }
    /**
     * 指定年月の取引をフィルタ
     */
    filterByYearMonth(transactions, yearMonth) {
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
    calculateTotalAmount(transactions) {
        return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    }
}
