import { GetCreditCardAmountUseCase } from '../usecase/GetCreditCardAmountUseCase';
import { AddAdvancePaymentUseCase } from '../usecase/AddAdvancePaymentUseCase';
import { DeleteAdvancePaymentUseCase } from '../usecase/DeleteAdvancePaymentUseCase';
import { LineMessagingDriver } from '../driver/LineMessagingDriver';
import { YearMonth } from '../domain/model/YearMonth';
import { IAdvancePaymentRepository } from '../domain/repository/IAdvancePaymentRepository';
import { Payer } from '../domain/model/Payer';

/**
 * 建て替え記録追加メッセージのパース結果
 */
interface ParsedAdvancePayment {
  date: Date;
  payer: Payer;
  amount: number;
  memo: string;
}

/**
 * LINE Webhook リクエストを処理するハンドラー
 */
export class LineWebhookHandler {
  constructor(
    private readonly getCreditCardAmountUseCase: GetCreditCardAmountUseCase,
    private readonly advancePaymentRepository: IAdvancePaymentRepository,
    private readonly addAdvancePaymentUseCase: AddAdvancePaymentUseCase,
    private readonly deleteAdvancePaymentUseCase: DeleteAdvancePaymentUseCase,
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

      if (messageText.includes('使い方')) {
        // 全体的な使い方を表示
        responseMessage = this.getOverallUsageHelp();
      } else if (messageText.includes('フォーマット')) {
        // 建て替え追加のフォーマットを表示
        responseMessage = this.getAdvancePaymentAdditionHelp();
      } else if (messageText.includes('削除')) {
        // 建て替え記録を削除
        responseMessage = this.handleAdvancePaymentDeletion(messageText);
      } else if (messageText.includes('建て替え追加')) {
        // 建て替え記録を追加
        responseMessage = this.handleAdvancePaymentAddition(messageText);
      } else if (messageText.includes('カード支払い')) {
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
   * - 「カード支払い」のみ → 今月
   * - 「カード支払い10月」 → 今年の指定月
   * - 「カード支払い2024年10月」 → 指定年月
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
      const id = payment.getId();
      const dateStr = payment.getFormattedDate();
      const payer = payment.getPayer().getValue();
      const amount = payment.getAmount().format();
      const memo = payment.getMemo();
      message += `[ID: ${id}]\n${dateStr} ${payer === '夫' ? '👨' : '👩'} ${amount}\n${memo}\n\n`;
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

  /**
   * 建て替え記録追加メッセージをパース
   * フォーマット:
   * - 建て替え追加 支払者 金額 メモ
   * - 建て替え追加 日付 支払者 金額 メモ
   *
   * @returns パース結果、失敗時はnull
   */
  private parseAdvancePaymentMessage(messageText: string): ParsedAdvancePayment | null {
    // 「建て替え追加」を除去
    const content = messageText.replace(/建て替え追加\s*/, '').trim();
    if (!content) {
      return null;
    }

    // 空白で分割
    const parts = content.split(/\s+/);
    if (parts.length < 3) {
      return null; // 最低でも 支払者、金額、メモ が必要
    }

    let dateStr: string | null = null;
    let payerStr: string;
    let amountStr: string;
    let memo: string;

    // 最初の部分が日付かチェック（MM/DD or M/D 形式）
    const datePattern = /^(\d{1,2})\/(\d{1,2})$/;
    const dateMatch = parts[0].match(datePattern);

    if (dateMatch) {
      // 日付指定あり
      dateStr = parts[0];
      if (parts.length < 4) {
        return null; // 日付、支払者、金額、メモ が必要
      }
      payerStr = parts[1];
      amountStr = parts[2];
      memo = parts.slice(3).join(' ');
    } else {
      // 日付指定なし
      payerStr = parts[0];
      amountStr = parts[1];
      memo = parts.slice(2).join(' ');
    }

    // 日付のパース
    let date: Date;
    if (dateStr) {
      const match = dateStr.match(datePattern)!;
      const month = parseInt(match[1], 10);
      const day = parseInt(match[2], 10);
      const now = new Date();
      date = new Date(now.getFullYear(), month - 1, day);
    } else {
      date = new Date(); // 今日
    }

    // 支払者のパース
    let payer: Payer;
    if (payerStr === '夫') {
      payer = Payer.HUSBAND;
    } else if (payerStr === '妻') {
      payer = Payer.WIFE;
    } else {
      return null; // 支払者が無効
    }

    // 金額のパース
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      return null; // 金額が無効
    }

    // メモの検証
    if (!memo || memo.trim() === '') {
      return null; // メモが空
    }

    return { date, payer, amount, memo: memo.trim() };
  }

  /**
   * 全体的な使い方のヘルプメッセージ
   */
  private getOverallUsageHelp(): string {
    let message = '📖 家計管理Bot 使い方\n\n';

    message += '【💳 カード支払い確認】\n';
    message += 'カード支払い → 今月の支払い額を表示\n';
    message += 'カード支払い10月 → 10月の支払い額を表示\n';
    message += 'カード支払い2024年10月 → 指定年月の支払い額を表示\n\n';

    message += '【📝 建て替え記録】\n';
    message += '建て替え → 記録アプリのURLを表示\n';
    message += '建て替え11月 → 11月支払い分の記録を表示\n';
    message += '（期間: 9/26〜10/25）\n\n';

    message += '【➕ 記録追加】\n';
    message += '建て替え追加 夫 1000 ランチ代\n';
    message += '建て替え追加 10/30 妻 2000 買い物\n';
    message += 'フォーマット → 詳しい使い方\n\n';

    message += '【🗑️ 記録削除】\n';
    message += '削除 ${ID} → 指定IDの記録を削除\n';
    message += '（IDは建て替え記録から確認）\n\n';

    message += '【ℹ️ その他】\n';
    message += '使い方 → このメッセージを表示\n';
    message += 'フォーマット → 記録追加の詳細';

    return message;
  }

  /**
   * 建て替え記録追加のヘルプメッセージ
   */
  private getAdvancePaymentAdditionHelp(errorReason?: string): string {
    let message = '📝 建て替え記録の追加方法\n\n';

    if (errorReason) {
      message += `❌ エラー: ${errorReason}\n\n`;
    }

    message += '【フォーマット】\n';
    message += '建て替え追加 支払者 金額 メモ\n';
    message += '建て替え追加 日付 支払者 金額 メモ\n\n';
    message += '【例】\n';
    message += '建て替え追加 夫 1000 ランチ代\n';
    message += '建て替え追加 10/30 妻 2000 買い物\n\n';
    message += '【注意】\n';
    message += '- 支払者: 「夫」または「妻」（必須）\n';
    message += '- 金額: 数字のみ（必須）\n';
    message += '- 日付: MM/DD形式（省略時=今日）\n';
    message += '- メモ: 任意のテキスト（必須）';

    return message;
  }

  /**
   * 建て替え記録を追加
   */
  private handleAdvancePaymentAddition(messageText: string): string {
    // メッセージをパース
    const parsed = this.parseAdvancePaymentMessage(messageText);

    if (!parsed) {
      return this.getAdvancePaymentAdditionHelp('入力形式が正しくありません');
    }

    try {
      // 記録を追加
      this.addAdvancePaymentUseCase.execute(
        parsed.date,
        parsed.payer,
        parsed.amount,
        parsed.memo
      );

      // 成功メッセージ
      const payerIcon = parsed.payer.equals(Payer.HUSBAND) ? '👨' : '👩';
      const dateStr = this.formatDate(parsed.date);
      return `✅ 記録しました\n\n${dateStr} ${payerIcon} ${this.formatMoney(parsed.amount)}\n${parsed.memo}`;
    } catch (error: any) {
      Logger.log(`Error adding advance payment: ${error}`);
      return `❌ 記録の追加に失敗しました\n\n${error}`;
    }
  }

  /**
   * 建て替え記録を削除
   * フォーマット: 削除 ${ID}
   */
  private handleAdvancePaymentDeletion(messageText: string): string {
    // 「削除」を除去してIDを取得
    const id = messageText.replace(/削除\s*/, '').trim();

    if (!id) {
      return '❌ 削除するIDを指定してください\n\n使い方: 削除 ${ID}\n例: 削除 1234567890';
    }

    try {
      // 記録を削除
      this.deleteAdvancePaymentUseCase.execute(id);

      return `✅ 記録を削除しました\n\nID: ${id}`;
    } catch (error: any) {
      Logger.log(`Error deleting advance payment: ${error}`);
      return `❌ 記録の削除に失敗しました\n\nID: ${id}\n\n${error}`;
    }
  }
}
