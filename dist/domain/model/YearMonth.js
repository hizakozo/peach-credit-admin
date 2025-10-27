/**
 * 年月を表す値オブジェクト
 */
export class YearMonth {
    constructor(year, month) {
        if (year < 0) {
            throw new Error('Year must be positive');
        }
        if (month < 1 || month > 12) {
            throw new Error('Month must be between 1 and 12');
        }
        this.year = year;
        this.month = month;
    }
    /**
     * Date オブジェクトから YearMonth を生成
     */
    static fromDate(date) {
        return new YearMonth(date.getFullYear(), date.getMonth() + 1);
    }
    getYear() {
        return this.year;
    }
    getMonth() {
        return this.month;
    }
    /**
     * 年月の等価性チェック
     */
    equals(other) {
        return this.year === other.year && this.month === other.month;
    }
    /**
     * 「2024年10月」形式でフォーマット
     */
    format() {
        const paddedMonth = this.month.toString().padStart(2, '0');
        return `${this.year}年${paddedMonth}月`;
    }
}
