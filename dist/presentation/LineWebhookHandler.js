import { YearMonth } from '../domain/model/YearMonth';
/**
 * LINE Webhook リクエストを処理するハンドラー
 */
export class LineWebhookHandler {
    constructor(getCreditCardAmountUseCase, lineMessagingDriver) {
        this.getCreditCardAmountUseCase = getCreditCardAmountUseCase;
        this.lineMessagingDriver = lineMessagingDriver;
    }
    /**
     * LINE からの POST リクエストを処理
     */
    async handleRequest(postData) {
        var _a;
        try {
            const json = JSON.parse(postData);
            const event = json.events[0];
            if (!event) {
                return;
            }
            const replyToken = event.replyToken;
            const messageText = ((_a = event.message) === null || _a === void 0 ? void 0 : _a.text) || '';
            // メッセージ内容に応じた処理
            let responseMessage;
            if (messageText.toLowerCase().includes('zaim')) {
                // 今月の精算情報を取得
                const currentYearMonth = YearMonth.fromDate(new Date());
                const settlement = await this.getCreditCardAmountUseCase.execute(currentYearMonth);
                responseMessage = settlement.formatMessage();
            }
            else if (messageText.toLowerCase().includes('hello')) {
                responseMessage = 'hello';
            }
            else {
                responseMessage = 'メッセージを受信しました';
            }
            // LINE に返信
            this.lineMessagingDriver.replyMessage(replyToken, responseMessage);
        }
        catch (error) {
            Logger.log(`Error in LineWebhookHandler: ${error}`);
            throw error;
        }
    }
}
