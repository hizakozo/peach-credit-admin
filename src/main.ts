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
 * OAuth 1.0a Utility Functions
 */

// Generate random nonce
function generateNonce(): string {
  return Utilities.base64Encode(Utilities.getUuid());
}

// Get current Unix timestamp
function getTimestamp(): string {
  return Math.floor(new Date().getTime() / 1000).toString();
}

// Percent encode for OAuth
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

// Generate OAuth 1.0a signature base string
function generateSignatureBaseString(
  method: string,
  url: string,
  params: { [key: string]: string }
): string {
  // Sort parameters alphabetically
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  return `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
}

// Generate HMAC-SHA1 signature
function generateSignature(
  baseString: string,
  consumerSecret: string,
  tokenSecret: string = ''
): string {
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1,
    baseString,
    signingKey
  );
  return Utilities.base64Encode(signature);
}

// Generate OAuth parameters
function generateOAuthParams(
  consumerKey: string,
  token: string = ''
): { [key: string]: string } {
  const params: { [key: string]: string } = {
    oauth_consumer_key: consumerKey,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: getTimestamp(),
    oauth_nonce: generateNonce(),
    oauth_version: '1.0'
  };

  if (token) {
    params.oauth_token = token;
  }

  return params;
}

/**
 * Zaim API Functions
 */

// Call Zaim API with OAuth 1.0a authentication
function callZaimAPI(
  url: string,
  method: string = 'GET',
  queryParams: { [key: string]: string } = {}
): any {
  const consumerKey = PropertiesService.getScriptProperties().getProperty('ZAIM_CONSUMER_KEY');
  const consumerSecret = PropertiesService.getScriptProperties().getProperty('ZAIM_CONSUMER_SECRET');
  const accessToken = PropertiesService.getScriptProperties().getProperty('ZAIM_ACCESS_TOKEN');
  const accessTokenSecret = PropertiesService.getScriptProperties().getProperty('ZAIM_ACCESS_TOKEN_SECRET');

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    throw new Error('Zaim OAuth credentials not configured in Script Properties');
  }

  // Generate OAuth parameters
  const oauthParams = generateOAuthParams(consumerKey, accessToken);

  // Combine OAuth params with query params
  const allParams = { ...oauthParams, ...queryParams };

  // Generate signature
  const baseString = generateSignatureBaseString(method, url, allParams);
  const signature = generateSignature(baseString, consumerSecret, accessTokenSecret);
  oauthParams.oauth_signature = signature;

  // Build Authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  // Build URL with query parameters
  let requestUrl = url;
  if (Object.keys(queryParams).length > 0) {
    const queryString = Object.keys(queryParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');
    requestUrl += '?' + queryString;
  }

  // Make API request
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: method === 'GET' ? 'get' : 'post',
    headers: {
      'Authorization': authHeader
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(requestUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`Zaim API Error (${responseCode}): ${responseText}`);
  }

  return JSON.parse(responseText);
}

// Get Zaim account list
function getZaimAccounts(): any {
  return callZaimAPI('https://api.zaim.net/v2/home/account', 'GET', { mapping: '1' });
}

// Get Zaim money transactions
function getZaimMoney(accountId?: string): any {
  const params: { [key: string]: string } = { mapping: '1' };

  if (accountId) {
    params.from_account_id = accountId;
  }

  return callZaimAPI('https://api.zaim.net/v2/home/money', 'GET', params);
}

/**
 * メッセージハンドラー: Zaim取引データ取得
 */
function handleZaimMessage(): string {
  try {
    // Get account list to find 楽天カード
    const accounts = getZaimAccounts();
    let rakutenCardId: string | undefined;

    Logger.log('アカウント取得完了');
    Logger.log(`アカウント数: ${accounts.accounts ? accounts.accounts.length : 0}`);

    // Find 楽天カード account (active: 1のみ)
    if (accounts.accounts) {
      for (const account of accounts.accounts) {
        Logger.log(`チェック中: ${account.name}, active=${account.active}`);
        if (account.active === 1 &&
            account.name &&
            account.name.includes('楽天') &&
            account.name.includes('カード')) {
          rakutenCardId = account.id.toString();
          Logger.log(`楽天カード発見: ID=${rakutenCardId}, 名前=${account.name}`);
          break;
        }
      }
    }

    if (!rakutenCardId) {
      Logger.log('楽天カードが見つかりませんでした');
      return 'アクティブな楽天カードが見つかりませんでした';
    }

    // Get all money transactions
    Logger.log('取引データ取得開始...');
    const allMoneyData = getZaimMoney();
    Logger.log(`取引データ取得完了: ${allMoneyData.money ? allMoneyData.money.length : 0}件`);

    // Filter by rakutenCardId (from_account_id OR to_account_id)
    const filteredMoney = allMoneyData.money ? allMoneyData.money.filter((item: any) => {
      const fromId = item.from_account_id ? item.from_account_id.toString() : '';
      const toId = item.to_account_id ? item.to_account_id.toString() : '';
      const matched = fromId === rakutenCardId || toId === rakutenCardId;
      if (matched) {
        Logger.log(`マッチ: ${item.date} ${item.amount}円 from=${fromId} to=${toId}`);
      }
      return matched;
    }) : [];

    Logger.log(`フィルタ後: ${filteredMoney.length}件`);

    // Format response
    if (filteredMoney.length > 0) {
      let response = `楽天カード取引データ (${filteredMoney.length}件):\n\n`;
      response += filteredMoney.slice(0, 10).map((item: any) => {
        const modeLabel = item.mode === 'payment' ? '支払' :
                        item.mode === 'income' ? '収入' :
                        item.mode === 'transfer' ? '振替' : item.mode;
        return `${item.date} [${modeLabel}] ¥${item.amount.toLocaleString()}\n${item.place || item.comment || item.name || '(詳細なし)'}`;
      }).join('\n\n');

      if (filteredMoney.length > 10) {
        response += `\n\n...他 ${filteredMoney.length - 10} 件`;
      }
      return response;
    } else {
      return '楽天カードの取引データが見つかりませんでした';
    }
  } catch (error) {
    Logger.log(`エラー発生: ${error}`);
    return `エラーが発生しました: ${error}`;
  }
}

/**
 * メッセージハンドラー: Hello応答
 */
function handleHelloMessage(): string {
  return 'hello';
}

/**
 * メッセージハンドラー: デフォルト応答
 */
function handleDefaultMessage(): string {
  return 'メッセージを受信しました';
}

/**
 * テスト用: Zaim処理を直接実行
 */
function testHandleZaimMessage(): void {
  Logger.log('='.repeat(60));
  Logger.log('Zaimメッセージハンドラーテスト開始');
  Logger.log('='.repeat(60));

  const response = handleZaimMessage();

  Logger.log('');
  Logger.log('レスポンス:');
  Logger.log(response);
  Logger.log('');
  Logger.log('='.repeat(60));
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

  let response: string;

  // メッセージ内容によってハンドラーを呼び分け
  if (messageText.toLowerCase().includes('zaim')) {
    response = handleZaimMessage();
  } else if (messageText.toLowerCase().includes('hello')) {
    response = handleHelloMessage();
  } else {
    response = handleDefaultMessage();
  }

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
