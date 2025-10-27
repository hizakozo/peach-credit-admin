import { GetCreditCardAmountUseCase } from '../usecase/GetCreditCardAmountUseCase';
import { LineMessagingDriver } from '../driver/LineMessagingDriver';
import { YearMonth } from '../domain/model/YearMonth';

/**
 * LINE Webhook リクエストを処理するハンドラー
 */
export class LineWebhookHandler {
  constructor(
    private readonly getCreditCardAmountUseCase: GetCreditCardAmountUseCase,
    private readonly lineMessagingDriver: LineMessagingDriver
  ) {}

  /**
   * LINE からの POST リクエストを処理
   */
  async handleRequest(postData: string): Promise<void> {
    try {
      const json = JSON.parse(postData);
      const event = json.events[0];

      if (!event) {
        return;
      }

      const replyToken = event.replyToken;
      const messageText = event.message?.text || '';

      // メッセージ内容に応じた処理
      let responseMessage: string | null = null;

      if (messageText.includes('支払')) {
        // 今月の精算情報を取得
        const currentYearMonth = YearMonth.fromDate(new Date());
        const settlement = await this.getCreditCardAmountUseCase.execute(currentYearMonth);
        responseMessage = settlement.formatMessage();
      } else if (messageText.toLowerCase().includes('hello')) {
        responseMessage = 'hello';
      }

      // 該当するトリガーの場合のみ返信
      if (responseMessage !== null) {
        this.lineMessagingDriver.replyMessage(replyToken, responseMessage);
      }
    } catch (error) {
      Logger.log(`Error in LineWebhookHandler: ${error}`);
      throw error;
    }
  }
}
