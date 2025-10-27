/**
 * Zaim OAuth 1.0a 認証ヘルパー
 *
 * 使い方：
 * 1. Script PropertiesにZAIM_CONSUMER_KEYとZAIM_CONSUMER_SECRETを設定
 * 2. startOAuthFlowを実行してURLを取得
 * 3. ブラウザでそのURLにアクセスして認証
 * 4. コールバックURLのパラメータを使ってcompleteOAuthFlowを実行
 */

import { ZaimApiDriver } from './driver/ZaimApiDriver';

/**
 * OAuth ヘルパー関数
 */
function generateNonce(): string {
  return Utilities.base64Encode(Utilities.getUuid());
}

function getTimestamp(): string {
  return Math.floor(new Date().getTime() / 1000).toString();
}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

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

function generateSignatureBaseString(
  method: string,
  url: string,
  params: { [key: string]: string }
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  return `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
}

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

/**
 * Zaim API 呼び出しヘルパー
 */
function callZaimAPI(
  url: string,
  method: string,
  queryParams: { [key: string]: string }
): any {
  const driver = new ZaimApiDriver();
  return driver['callZaimAPI'](url, method, queryParams);
}

function getZaimAccounts(): any {
  const driver = new ZaimApiDriver();
  return driver.getAccounts();
}

function getZaimMoney(accountId?: string): any {
  const driver = new ZaimApiDriver();
  return driver.getTransactions(accountId);
}

/**
 * Step 1: OAuth認証フローを開始
 * Request Tokenを取得して認証URLを表示
 */
function startOAuthFlow(): void {
  const consumerKey = PropertiesService.getScriptProperties().getProperty('ZAIM_CONSUMER_KEY');
  const consumerSecret = PropertiesService.getScriptProperties().getProperty('ZAIM_CONSUMER_SECRET');

  if (!consumerKey || !consumerSecret) {
    Logger.log('エラー: ZAIM_CONSUMER_KEYとZAIM_CONSUMER_SECRETをScript Propertiesに設定してください');
    return;
  }

  // Out of Band (oob) 認証を使用（ブラウザで手動認証）
  const callbackUrl = 'oob';

  // Request Token取得用のパラメータ
  const requestTokenUrl = 'https://api.zaim.net/v2/auth/request';
  const oauthParams = generateOAuthParams(consumerKey);
  oauthParams.oauth_callback = callbackUrl;

  // 署名生成
  const baseString = generateSignatureBaseString('POST', requestTokenUrl, oauthParams);
  const signature = generateSignature(baseString, consumerSecret, '');
  oauthParams.oauth_signature = signature;

  // Authorization headerを構築
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  // Request Token取得
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: {
      'Authorization': authHeader
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(requestTokenUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    Logger.log(`エラー: Request Token取得失敗 (${responseCode}): ${responseText}`);
    return;
  }

  // レスポンスをパース
  const params = parseQueryString(responseText);
  const requestToken = params.oauth_token;
  const requestTokenSecret = params.oauth_token_secret;

  if (!requestToken || !requestTokenSecret) {
    Logger.log('エラー: Request Tokenの取得に失敗しました');
    Logger.log(responseText);
    return;
  }

  // Request Token SecretをScript Propertiesに一時保存
  PropertiesService.getScriptProperties().setProperty('ZAIM_REQUEST_TOKEN_SECRET', requestTokenSecret);

  // 認証URL
  const authorizeUrl = `https://auth.zaim.net/users/auth?oauth_token=${requestToken}`;

  Logger.log('='.repeat(60));
  Logger.log('Step 1 完了: Request Token取得成功');
  Logger.log('='.repeat(60));
  Logger.log('');
  Logger.log('【次のステップ】');
  Logger.log('');
  Logger.log('1. 以下のURLをブラウザで開いて、Zaimアプリケーションを認証してください：');
  Logger.log('');
  Logger.log(authorizeUrl);
  Logger.log('');
  Logger.log('2. 認証後、Zaimのページに「認証コード」が表示されます。');
  Logger.log('');
  Logger.log('3. GASエディタで「runCompleteOAuthFlow」関数を開いて、以下の値を編集：');
  Logger.log('');
  Logger.log(`   oauth_token: ${requestToken}`);
  Logger.log('   oauth_verifier: (Zaimで表示された認証コード)');
  Logger.log('');
  Logger.log('4. runCompleteOAuthFlowを実行ボタンで実行してください');
  Logger.log('');
  Logger.log('='.repeat(60));
}

/**
 * Step 2実行用: OAuth認証フローを完了（GASエディタから実行）
 *
 * 使い方：
 * 1. startOAuthFlowを実行してoauth_tokenを取得
 * 2. ブラウザで認証して認証コードを取得
 * 3. この関数を開いて、以下の値を編集
 * 4. 実行ボタンで実行
 */
function runCompleteOAuthFlow(): void {
  // ここに値を貼り付けて実行してください
  const oauthToken = 'ここにstartOAuthFlowで取得したoauth_tokenを貼り付け';
  const oauthVerifier = 'ここにZaimで取得した認証コードを貼り付け';

  if (oauthToken === 'ここにstartOAuthFlowで取得したoauth_tokenを貼り付け' ||
      oauthVerifier === 'ここにZaimで取得した認証コードを貼り付け') {
    Logger.log('エラー: oauth_tokenとoauth_verifierの値を編集してください');
    return;
  }

  completeOAuthFlow(oauthToken, oauthVerifier);
}

/**
 * Step 2: OAuth認証フローを完了
 * Access Tokenを取得してScript Propertiesに保存
 *
 * @param oauthToken - コールバックURLから取得したoauth_token
 * @param oauthVerifier - コールバックURLから取得したoauth_verifier
 */
function completeOAuthFlow(oauthToken: string, oauthVerifier: string): void {
  const consumerKey = PropertiesService.getScriptProperties().getProperty('ZAIM_CONSUMER_KEY');
  const consumerSecret = PropertiesService.getScriptProperties().getProperty('ZAIM_CONSUMER_SECRET');
  const requestTokenSecret = PropertiesService.getScriptProperties().getProperty('ZAIM_REQUEST_TOKEN_SECRET');

  if (!consumerKey || !consumerSecret || !requestTokenSecret) {
    Logger.log('エラー: 必要な情報が見つかりません。先にstartOAuthFlowを実行してください。');
    return;
  }

  // Access Token取得
  const accessTokenUrl = 'https://api.zaim.net/v2/auth/access';
  const oauthParams = generateOAuthParams(consumerKey, oauthToken);
  oauthParams.oauth_verifier = oauthVerifier;

  // 署名生成（Request Token Secretを使用）
  const baseString = generateSignatureBaseString('POST', accessTokenUrl, oauthParams);
  const signature = generateSignature(baseString, consumerSecret, requestTokenSecret);
  oauthParams.oauth_signature = signature;

  // Authorization headerを構築
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  // Access Token取得
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: {
      'Authorization': authHeader
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(accessTokenUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    Logger.log(`エラー: Access Token取得失敗 (${responseCode}): ${responseText}`);
    return;
  }

  // レスポンスをパース
  const params = parseQueryString(responseText);
  const accessToken = params.oauth_token;
  const accessTokenSecret = params.oauth_token_secret;

  if (!accessToken || !accessTokenSecret) {
    Logger.log('エラー: Access Tokenの取得に失敗しました');
    Logger.log(responseText);
    return;
  }

  // Access TokenをScript Propertiesに保存
  PropertiesService.getScriptProperties().setProperty('ZAIM_ACCESS_TOKEN', accessToken);
  PropertiesService.getScriptProperties().setProperty('ZAIM_ACCESS_TOKEN_SECRET', accessTokenSecret);

  // Request Token Secretを削除
  PropertiesService.getScriptProperties().deleteProperty('ZAIM_REQUEST_TOKEN_SECRET');

  Logger.log('='.repeat(60));
  Logger.log('Step 2 完了: Access Token取得成功！');
  Logger.log('='.repeat(60));
  Logger.log('');
  Logger.log('以下の情報がScript Propertiesに保存されました：');
  Logger.log(`ZAIM_ACCESS_TOKEN: ${accessToken}`);
  Logger.log(`ZAIM_ACCESS_TOKEN_SECRET: ${accessTokenSecret}`);
  Logger.log('');
  Logger.log('これでZaim APIを使用できます！');
  Logger.log('LINEで「zaim」と送信してテストしてください。');
  Logger.log('='.repeat(60));
}

/**
 * テスト用: Zaim API接続確認
 * ユーザー情報を取得して表示
 */
function testZaimConnection(): void {
  try {
    const verifyUrl = 'https://api.zaim.net/v2/home/user/verify';
    const userData = callZaimAPI(verifyUrl, 'GET', {});

    Logger.log('='.repeat(60));
    Logger.log('Zaim API接続テスト成功！');
    Logger.log('='.repeat(60));
    Logger.log('');
    Logger.log('ユーザー情報:');
    Logger.log(JSON.stringify(userData, null, 2));
    Logger.log('');
    Logger.log('='.repeat(60));
  } catch (error) {
    Logger.log('エラー: Zaim API接続失敗');
    Logger.log(error);
  }
}

/**
 * デバッグ用: アカウント一覧を取得
 * 楽天カードのIDを確認
 */
function debugGetAccounts(): void {
  try {
    Logger.log('='.repeat(60));
    Logger.log('アカウント一覧取得開始...');
    Logger.log('='.repeat(60));

    const accounts = getZaimAccounts();

    Logger.log('');
    Logger.log('取得結果:');
    Logger.log(JSON.stringify(accounts, null, 2));
    Logger.log('');

    if (accounts.accounts && accounts.accounts.length > 0) {
      Logger.log('アカウント一覧:');
      accounts.accounts.forEach((account: any) => {
        Logger.log(`- ID: ${account.id}, 名前: ${account.name}`);
      });

      // 楽天カード検索
      Logger.log('');
      Logger.log('楽天カード検索:');
      const rakutenCard = accounts.accounts.find((account: any) =>
        account.name && account.name.includes('楽天')
      );

      if (rakutenCard) {
        Logger.log(`✓ 見つかりました！ ID: ${rakutenCard.id}, 名前: ${rakutenCard.name}`);
      } else {
        Logger.log('✗ 楽天カードが見つかりませんでした');
        Logger.log('すべてのアカウント名を確認してください↑');
      }
    } else {
      Logger.log('アカウントが見つかりませんでした');
    }

    Logger.log('');
    Logger.log('='.repeat(60));
  } catch (error) {
    Logger.log('エラー: アカウント一覧取得失敗');
    Logger.log(error);
  }
}

/**
 * デバッグ用: 取引データを取得（フィルタなし）
 * 全ての取引データを確認
 */
function debugGetAllMoney(): void {
  try {
    Logger.log('='.repeat(60));
    Logger.log('取引データ取得開始（全件）...');
    Logger.log('='.repeat(60));

    const moneyData = getZaimMoney();

    Logger.log('');
    Logger.log('取得結果:');
    Logger.log(JSON.stringify(moneyData, null, 2));
    Logger.log('');

    if (moneyData.money && moneyData.money.length > 0) {
      Logger.log(`取引データ件数: ${moneyData.money.length}件`);
      Logger.log('');
      Logger.log('最新5件:');
      moneyData.money.slice(0, 5).forEach((item: any, index: number) => {
        Logger.log(`${index + 1}. ${item.date} | ¥${item.amount} | ${item.comment || item.name || '(no comment)'} | from_account_id: ${item.from_account_id}`);
      });
    } else {
      Logger.log('取引データが見つかりませんでした');
      Logger.log('Zaimに取引データが登録されているか確認してください');
    }

    Logger.log('');
    Logger.log('='.repeat(60));
  } catch (error) {
    Logger.log('エラー: 取引データ取得失敗');
    Logger.log(error);
  }
}

/**
 * デバッグ用: 楽天カードの取引データを取得
 * 楽天カードIDを指定して取得
 */
function debugGetRakutenMoney(): void {
  try {
    Logger.log('='.repeat(60));
    Logger.log('楽天カード取引データ取得開始...');
    Logger.log('='.repeat(60));

    // アカウント一覧から楽天カードを検索
    const accounts = getZaimAccounts();
    let rakutenCardId: string | undefined;

    if (accounts.accounts) {
      for (const account of accounts.accounts) {
        Logger.log(`チェック中: ID=${account.id}, 名前="${account.name}"`);
        if (account.name && account.name.includes('楽天')) {
          rakutenCardId = account.id.toString();
          Logger.log(`✓ 楽天カード発見: ID=${rakutenCardId}, 名前="${account.name}"`);
          break;
        }
      }
    }

    if (!rakutenCardId) {
      Logger.log('');
      Logger.log('✗ 楽天カードが見つかりませんでした');
      Logger.log('debugGetAccountsを実行してアカウント名を確認してください');
      Logger.log('='.repeat(60));
      return;
    }

    Logger.log('');
    Logger.log(`楽天カードID: ${rakutenCardId}で取引データ取得中...`);

    const moneyData = getZaimMoney(rakutenCardId);

    Logger.log('');
    Logger.log('取得結果:');
    Logger.log(JSON.stringify(moneyData, null, 2));
    Logger.log('');

    if (moneyData.money && moneyData.money.length > 0) {
      Logger.log(`楽天カード取引件数: ${moneyData.money.length}件`);
      Logger.log('');
      Logger.log('最新10件:');
      moneyData.money.slice(0, 10).forEach((item: any, index: number) => {
        Logger.log(`${index + 1}. ${item.date} | ¥${item.amount} | ${item.comment || item.name || '(no comment)'}`);
      });
    } else {
      Logger.log('楽天カードの取引データが見つかりませんでした');
      Logger.log('- 楽天カードで取引が登録されているか確認してください');
      Logger.log('- from_account_idが正しいか確認してください（debugGetAllMoneyで確認）');
    }

    Logger.log('');
    Logger.log('='.repeat(60));
  } catch (error) {
    Logger.log('エラー: 楽天カード取引データ取得失敗');
    Logger.log(error);
  }
}

/**
 * ヘルパー関数: クエリ文字列をパース
 */
function parseQueryString(queryString: string): { [key: string]: string } {
  const params: { [key: string]: string } = {};
  const pairs = queryString.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value);
  }

  return params;
}

/**
 * 手動設定用: Consumer KeyとSecretを設定
 * ZAIM_API.mdの値を使用
 */
function setupConsumerCredentials(consumerKey: string, consumerSecret: string): void {
  PropertiesService.getScriptProperties().setProperty('ZAIM_CONSUMER_KEY', consumerKey);
  PropertiesService.getScriptProperties().setProperty('ZAIM_CONSUMER_SECRET', consumerSecret);

  Logger.log('Consumer KeyとSecretをScript Propertiesに保存しました');
  Logger.log(`ZAIM_CONSUMER_KEY: ${consumerKey}`);
  Logger.log('');
  Logger.log('次にstartOAuthFlowを実行してください');
}

// Export functions to global scope for GAS
if (typeof globalThis !== 'undefined') {
  (globalThis as any).startOAuthFlow = startOAuthFlow;
  (globalThis as any).runCompleteOAuthFlow = runCompleteOAuthFlow;
  (globalThis as any).completeOAuthFlow = completeOAuthFlow;
  (globalThis as any).testZaimConnection = testZaimConnection;
  (globalThis as any).debugGetAccounts = debugGetAccounts;
  (globalThis as any).debugGetAllMoney = debugGetAllMoney;
  (globalThis as any).debugGetRakutenMoney = debugGetRakutenMoney;
  (globalThis as any).setupConsumerCredentials = setupConsumerCredentials;
}
