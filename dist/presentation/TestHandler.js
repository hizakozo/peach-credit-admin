import { YearMonth } from '../domain/model/YearMonth';
/**
 * テスト用ハンドラー
 * GAS エディタから直接実行してテストできる
 */
export class TestHandler {
    constructor(getCreditCardAmountUseCase) {
        this.getCreditCardAmountUseCase = getCreditCardAmountUseCase;
    }
    /**
     * 今月の精算情報を取得してログに出力
     */
    async execute() {
        try {
            Logger.log('='.repeat(60));
            Logger.log('テスト実行開始');
            Logger.log('='.repeat(60));
            // 今月の精算情報を取得
            const currentYearMonth = YearMonth.fromDate(new Date());
            Logger.log(`対象月: ${currentYearMonth.format()}`);
            const settlement = await this.getCreditCardAmountUseCase.execute(currentYearMonth);
            const message = settlement.formatMessage();
            Logger.log('');
            Logger.log('レスポンス:');
            Logger.log(message);
            Logger.log('');
            Logger.log('='.repeat(60));
            return message;
        }
        catch (error) {
            Logger.log(`エラー発生: ${error}`);
            throw error;
        }
    }
}
