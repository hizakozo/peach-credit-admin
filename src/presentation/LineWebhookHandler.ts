import { GetCreditCardAmountUseCase } from '../usecase/GetCreditCardAmountUseCase';
import { LineMessagingDriver } from '../driver/LineMessagingDriver';
import { YearMonth } from '../domain/model/YearMonth';
import { IAdvancePaymentRepository } from '../domain/repository/IAdvancePaymentRepository';

/**
 * LINE Webhook リクエストを処理するハンドラー
 */
export class LineWebhookHandler {
  constructor(
    private readonly getCreditCardAmountUseCase: GetCreditCardAmountUseCase,
    private readonly advancePaymentRepository: IAdvancePaymentRepository,
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
        // メッセージから年月を抽出
        const yearMonth = this.extractYearMonth(messageText);
        const settlement = await this.getCreditCardAmountUseCase.execute(yearMonth);
        responseMessage = settlement.formatMessage();
      } else if (messageText.includes('建て替え')) {
        // 月指定があれば記録を返す、なければURLを返す
        if (this.hasMonthSpecification(messageText)) {
          responseMessage = this.formatAdvancePaymentRecords(messageText);
        } else {
          // 建て替え記録HTMLアプリのURLを返信
          try {
            const webAppUrl = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
            if (webAppUrl) {
              responseMessage = `建て替え記録アプリ:\n${webAppUrl}`;
            } else {
              responseMessage = '建て替え記録アプリのURLが設定されていません。\nGASエディタでsetupWebAppUrlを実行してください。';
            }
          } catch (error) {
            Logger.log(`Error getting web app URL: ${error}`);
            responseMessage = '建て替え記録アプリのURL取得に失敗しました。';
          }
        }
      } else if (messageText.toLowerCase().includes('hello')) {
        responseMessage = 'hello';
      }

      // 該当するトリガーの場合のみ返信
      if (responseMessage !== null) {
        this.lineMessagingDriver.replyMessage(replyToken, responseMessage);
      }
    } catch (error: any) {
      Logger.log(`Error in LineWebhookHandler: ${error}`);

      // エラー情報をLINEに返信
      try {
        const json = JSON.parse(postData);
        const event = json.events[0];
        if (event && event.replyToken) {
          const errorMessage = `エラーが発生しました:\n\n${error}\n\nStack:\n${error.stack || 'スタックトレースなし'}`;
          this.lineMessagingDriver.replyMessage(event.replyToken, errorMessage);
        }
      } catch (replyError) {
        Logger.log(`Failed to send error message: ${replyError}`);
      }
    }
  }

  /**
   * メッセージから年月を抽出
   * - 「支払い」のみ → 今月
   * - 「支払い10月」「支払10月」 → 今年の指定月
   * - 「支払い2024年10月」 → 指定年月
   */
  private extractYearMonth(messageText: string): YearMonth {
    const now = new Date();
    const currentYear = now.getFullYear();

    // 「YYYY年MM月」のパターン（例: 2024年10月）
    const yearMonthMatch = messageText.match(/(\d{4})年(\d{1,2})月/);
    if (yearMonthMatch) {
      const year = parseInt(yearMonthMatch[1], 10);
      const month = parseInt(yearMonthMatch[2], 10);
      return new YearMonth(year, month);
    }

    // 「MM月」のパターン（例: 10月）
    const monthMatch = messageText.match(/(\d{1,2})月/);
    if (monthMatch) {
      const month = parseInt(monthMatch[1], 10);
      return new YearMonth(currentYear, month);
    }

    // パターンにマッチしない場合は今月
    return YearMonth.fromDate(now);
  }

  /**
   * メッセージに月の指定があるかチェック
   */
  private hasMonthSpecification(messageText: string): boolean {
    return /(\d{4})年(\d{1,2})月/.test(messageText) || /(\d{1,2})月/.test(messageText);
  }

  /**
   * 建て替え記録を整形して返す
   * 例: 「建て替え10月」→ 8月26日〜9月25日の記録
   */
  private formatAdvancePaymentRecords(messageText: string): string {
    // メッセージから支払い月を抽出
    const paymentMonth = this.extractYearMonth(messageText);
    const paymentYear = paymentMonth.getYear();
    const paymentMonthNum = paymentMonth.getMonth();

    // 締め日は25日なので、支払い月の2ヶ月前の26日から1ヶ月前の25日までの記録を取得
    // 例: 10月支払い分 → 8月26日〜9月25日
    const startDate = new Date(paymentYear, paymentMonthNum - 2, 26);
    const endDate = new Date(paymentYear, paymentMonthNum - 1, 25);

    // 建て替え記録を取得
    const payments = this.advancePaymentRepository.findByDateRange(startDate, endDate);

    if (payments.length === 0) {
      return `【${paymentMonth.format()}支払い分】\n建て替え記録がありません。`;
    }

    // 支払い者ごとの合計を計算
    let husbandTotal = 0;
    let wifeTotal = 0;

    payments.forEach((payment) => {
      const amount = payment.getAmount().getValue();
      if (payment.getPayer().getValue() === '夫') {
        husbandTotal += amount;
      } else {
        wifeTotal += amount;
      }
    });

    // 清算額を計算
    const diff = Math.abs(husbandTotal - wifeTotal);
    const halfDiff = Math.floor(diff / 2);

    // レスポンスメッセージを構築
    let message = `📝 建て替え記録\n【${paymentMonth.format()}支払い分】\n`;
    message += `期間: ${this.formatDate(startDate)} 〜 ${this.formatDate(endDate)}\n\n`;
    message += '--- 記録 ---\n';

    payments.forEach((payment) => {
      const dateStr = payment.getFormattedDate();
      const payer = payment.getPayer().getValue();
      const amount = payment.getAmount().format();
      const memo = payment.getMemo();
      message += `${dateStr} ${payer === '夫' ? '👨' : '👩'} ${amount}\n${memo}\n\n`;
    });

    message += '--- 合計 ---\n';
    message += `👨 夫: ${this.formatMoney(husbandTotal)}\n`;
    message += `👩 妻: ${this.formatMoney(wifeTotal)}\n\n`;
    message += '--- 清算 ---\n';

    if (husbandTotal > wifeTotal) {
      message += `👩 妻 → 👨 夫: ${this.formatMoney(halfDiff)}`;
    } else if (wifeTotal > husbandTotal) {
      message += `👨 夫 → 👩 妻: ${this.formatMoney(halfDiff)}`;
    } else {
      message += '差額なし';
    }

    return message;
  }

  /**
   * Date を YYYY-MM-DD 形式にフォーマット
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 金額を円表記にフォーマット
   */
  private formatMoney(amount: number): string {
    return `${amount.toLocaleString()}円`;
  }
}
