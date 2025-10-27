/**
 * LINE Messaging API との通信を担当するドライバー
 */
export class LineMessagingDriver {
  private readonly LINE_URL = 'https://api.line.me/v2/bot/message/reply';

  /**
   * LINE にメッセージを返信
   * @param replyToken 返信トークン
   * @param message 送信するメッセージ
   */
  replyMessage(replyToken: string, message: string): void {
    const lineToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

    if (!lineToken) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured in Script Properties');
    }

    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ' + lineToken
      },
      method: 'post',
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{
          type: 'text',
          text: message
        }]
      })
    };

    UrlFetchApp.fetch(this.LINE_URL, options);
  }
}
