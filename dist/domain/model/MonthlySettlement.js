import { Money } from './Money';
/**
 * 月次精算を表す値オブジェクト
 * 対象月と夫婦それぞれの支払い金額を保持
 */
export class MonthlySettlement {
    constructor(yearMonth, husbandAmount, wifeAmount) {
        this.yearMonth = yearMonth;
        this.husbandAmount = husbandAmount;
        this.wifeAmount = wifeAmount;
    }
    getYearMonth() {
        return this.yearMonth;
    }
    getHusbandAmount() {
        return this.husbandAmount;
    }
    getWifeAmount() {
        return this.wifeAmount;
    }
    /**
     * 合計金額を取得
     */
    getTotalAmount() {
        return new Money(this.husbandAmount.getValue() + this.wifeAmount.getValue());
    }
    /**
     * LINE メッセージ形式でフォーマット
     */
    formatMessage() {
        return ('💳 今月の支払い金額が確定しました\n\n' +
            `【${this.yearMonth.format()}分】\n\n` +
            `👨 ${this.husbandAmount.format()}\n` +
            `👩 ${this.wifeAmount.format()}`);
    }
}
