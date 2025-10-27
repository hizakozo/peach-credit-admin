/**
 * GAS エントリーポイント
 * TypeScript動作確認用のサンプルコード
 */

// GASグローバル関数として公開
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutput('<h1>Hello from TypeScript!</h1>');
}

/**
 * LINE Webhook エンドポイント
 * LINEからのメッセージを受信して返信する
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function doPost(e: any) {
  const LINE_TOKEN = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  const LINE_URL = 'https://api.line.me/v2/bot/message/reply';

  const json = JSON.parse(e.postData.contents);
  const reply_token = json.events[0].replyToken;
  const messageText = json.events[0].message.text;

  // helloを含むメッセージに対してhelloと返信
  const response = messageText.toLowerCase().includes('hello') ? 'hello' : 'メッセージを受信しました';

  const option: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINE_TOKEN
    },
    method: 'post',
    payload: JSON.stringify({
      replyToken: reply_token,
      messages: [{
        type: 'text',
        text: response
      }]
    })
  };

  UrlFetchApp.fetch(LINE_URL, option);
  return;
}

// テスト用関数
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function testTypeScript(): void {
  Logger.log('TypeScript is working!');
  Logger.log(`Current time: ${new Date().toISOString()}`);
}

// 簡単な値オブジェクトのサンプル
class Money {
  constructor(private readonly amount: number) {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
  }

  getValue(): number {
    return this.amount;
  }

  add(other: Money): Money {
    return new Money(this.amount + other.amount);
  }
}

// テスト実行
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function testMoney(): void {
  const money1 = new Money(1000);
  const money2 = new Money(2000);
  const total = money1.add(money2);

  Logger.log(`Money test: ${money1.getValue()} + ${money2.getValue()} = ${total.getValue()}`);
}
