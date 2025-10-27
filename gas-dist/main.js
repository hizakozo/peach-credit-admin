(function() {
  class ZaimApiDriver {
    /**
     * アカウント一覧を取得
     */
    getAccounts() {
      const response = this.callZaimAPI("https://api.zaim.net/v2/home/account", "GET", { mapping: "1" });
      return response.accounts || [];
    }
    /**
     * 取引データを取得
     * @param accountId アカウントID（オプション）
     */
    getTransactions(accountId) {
      const params = { mapping: "1" };
      if (accountId) {
        params.from_account_id = accountId;
      }
      const response = this.callZaimAPI("https://api.zaim.net/v2/home/money", "GET", params);
      return response.money || [];
    }
    /**
     * Zaim API を呼び出す（OAuth 1.0a 認証）
     * @private
     */
    callZaimAPI(url, method, queryParams) {
      const consumerKey = PropertiesService.getScriptProperties().getProperty("ZAIM_CONSUMER_KEY");
      const consumerSecret = PropertiesService.getScriptProperties().getProperty("ZAIM_CONSUMER_SECRET");
      const accessToken = PropertiesService.getScriptProperties().getProperty("ZAIM_ACCESS_TOKEN");
      const accessTokenSecret = PropertiesService.getScriptProperties().getProperty("ZAIM_ACCESS_TOKEN_SECRET");
      if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
        throw new Error("Zaim OAuth credentials not configured in Script Properties");
      }
      const oauthParams = this.generateOAuthParams(consumerKey, accessToken);
      const allParams = { ...oauthParams, ...queryParams };
      const baseString = this.generateSignatureBaseString(method, url, allParams);
      const signature = this.generateSignature(baseString, consumerSecret, accessTokenSecret);
      oauthParams.oauth_signature = signature;
      const authHeader = "OAuth " + Object.keys(oauthParams).sort().map((key) => `${this.percentEncode(key)}="${this.percentEncode(oauthParams[key])}"`).join(", ");
      let requestUrl = url;
      if (Object.keys(queryParams).length > 0) {
        const queryString = Object.keys(queryParams).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`).join("&");
        requestUrl += "?" + queryString;
      }
      const options = {
        method: method === "GET" ? "get" : "post",
        headers: {
          "Authorization": authHeader
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
    generateOAuthParams(consumerKey, token = "") {
      const params = {
        oauth_consumer_key: consumerKey,
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: this.getTimestamp(),
        oauth_nonce: this.generateNonce(),
        oauth_version: "1.0"
      };
      if (token) {
        params.oauth_token = token;
      }
      return params;
    }
    generateSignatureBaseString(method, url, params) {
      const sortedKeys = Object.keys(params).sort();
      const paramString = sortedKeys.map((key) => `${this.percentEncode(key)}=${this.percentEncode(params[key])}`).join("&");
      return `${method}&${this.percentEncode(url)}&${this.percentEncode(paramString)}`;
    }
    generateSignature(baseString, consumerSecret, tokenSecret = "") {
      const signingKey = `${this.percentEncode(consumerSecret)}&${this.percentEncode(tokenSecret)}`;
      const signature = Utilities.computeHmacSignature(
        Utilities.MacAlgorithm.HMAC_SHA_1,
        baseString,
        signingKey
      );
      return Utilities.base64Encode(signature);
    }
    percentEncode(str) {
      return encodeURIComponent(str).replace(/!/g, "%21").replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\*/g, "%2A");
    }
    getTimestamp() {
      return Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3).toString();
    }
    generateNonce() {
      return Utilities.base64Encode(Utilities.getUuid());
    }
  }
  class LineMessagingDriver {
    constructor() {
      this.LINE_URL = "https://api.line.me/v2/bot/message/reply";
    }
    /**
     * LINE にメッセージを返信
     * @param replyToken 返信トークン
     * @param message 送信するメッセージ
     */
    replyMessage(replyToken, message) {
      const lineToken = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
      if (!lineToken) {
        throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured in Script Properties");
      }
      const options = {
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Authorization": "Bearer " + lineToken
        },
        method: "post",
        payload: JSON.stringify({
          replyToken,
          messages: [{
            type: "text",
            text: message
          }]
        })
      };
      UrlFetchApp.fetch(this.LINE_URL, options);
    }
  }
  class Money {
    constructor(amount) {
      if (amount < 0) {
        throw new Error("Amount cannot be negative");
      }
      this.amount = amount;
    }
    getValue() {
      return this.amount;
    }
    /**
     * 金額を指定された数で割る（切り捨て）
     */
    divide(divisor) {
      if (divisor === 0) {
        throw new Error("Cannot divide by zero");
      }
      if (divisor < 0) {
        throw new Error("Divisor must be positive");
      }
      return new Money(Math.floor(this.amount / divisor));
    }
    /**
     * 金額の等価性チェック
     */
    equals(other) {
      return this.amount === other.amount;
    }
    /**
     * 金額を「45,894円」形式でフォーマット
     */
    format() {
      return `${this.amount.toLocaleString("ja-JP")}円`;
    }
  }
  class CreditCardRepositoryImpl {
    constructor(zaimApiDriver) {
      this.zaimApiDriver = zaimApiDriver;
      this.CARD_NAME_KEYWORDS = ["楽天", "カード"];
    }
    /**
     * 指定された年月のクレジットカード利用金額を取得
     */
    async getMonthlyAmount(yearMonth) {
      const accounts = this.zaimApiDriver.getAccounts();
      const rakutenCard = this.findActiveRakutenCard(accounts);
      if (!rakutenCard) {
        throw new Error("Active Rakuten Card not found");
      }
      const allTransactions = this.zaimApiDriver.getTransactions();
      const rakutenCardId = rakutenCard.id.toString();
      const cardTransactions = this.filterCardTransactions(allTransactions, rakutenCardId);
      const monthlyTransactions = this.filterByYearMonth(cardTransactions, yearMonth);
      const totalAmount = this.calculateTotalAmount(monthlyTransactions);
      return new Money(totalAmount);
    }
    /**
     * アクティブな楽天カードを検索
     */
    findActiveRakutenCard(accounts) {
      return accounts.find(
        (account) => account.active === 1 && account.name && this.CARD_NAME_KEYWORDS.every((keyword) => account.name.includes(keyword))
      );
    }
    /**
     * 指定されたカードの取引をフィルタ
     * from_account_id または to_account_id が一致する取引を抽出
     */
    filterCardTransactions(transactions, cardId) {
      return transactions.filter((transaction) => {
        var _a, _b;
        const fromId = ((_a = transaction.from_account_id) == null ? void 0 : _a.toString()) || "";
        const toId = ((_b = transaction.to_account_id) == null ? void 0 : _b.toString()) || "";
        return fromId === cardId || toId === cardId;
      });
    }
    /**
     * 指定年月の取引をフィルタ
     */
    filterByYearMonth(transactions, yearMonth) {
      const targetYear = yearMonth.getYear();
      const targetMonth = yearMonth.getMonth();
      return transactions.filter((transaction) => {
        const [year, month] = transaction.date.split("-").map(Number);
        return year === targetYear && month === targetMonth;
      });
    }
    /**
     * 取引の合計金額を計算
     */
    calculateTotalAmount(transactions) {
      return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    }
  }
  class MonthlySettlement {
    constructor(yearMonth, husbandAmount, wifeAmount) {
      this.yearMonth = yearMonth;
      this.husbandAmount = husbandAmount;
      this.wifeAmount = wifeAmount;
    }
    getYearMonth() {
      return this.yearMonth;
    }
    getHusbandAmount() {
      return this.husbandAmount;
    }
    getWifeAmount() {
      return this.wifeAmount;
    }
    /**
     * 合計金額を取得
     */
    getTotalAmount() {
      return new Money(
        this.husbandAmount.getValue() + this.wifeAmount.getValue()
      );
    }
    /**
     * LINE メッセージ形式でフォーマット
     */
    formatMessage() {
      return `💳 今月の支払い金額が確定しました

【${this.yearMonth.format()}分】

👨 ${this.husbandAmount.format()}
👩 ${this.wifeAmount.format()}`;
    }
  }
  class SettlementCalculator {
    /**
     * 合計金額を夫婦で50%ずつ分割して月次精算を作成
     * @param yearMonth 対象年月
     * @param totalAmount 合計金額
     * @returns 月次精算
     */
    calculate(yearMonth, totalAmount) {
      const halfAmount = totalAmount.divide(2);
      return new MonthlySettlement(yearMonth, halfAmount, halfAmount);
    }
  }
  class GetCreditCardAmountUseCase {
    constructor(creditCardRepository, settlementCalculator) {
      this.creditCardRepository = creditCardRepository;
      this.settlementCalculator = settlementCalculator;
    }
    /**
     * クレジットカード利用金額を取得して精算情報を作成
     * @param yearMonth 対象年月
     * @returns 月次精算情報
     */
    async execute(yearMonth) {
      const totalAmount = await this.creditCardRepository.getMonthlyAmount(yearMonth);
      const settlement = this.settlementCalculator.calculate(yearMonth, totalAmount);
      return settlement;
    }
  }
  class YearMonth {
    constructor(year, month) {
      if (year < 0) {
        throw new Error("Year must be positive");
      }
      if (month < 1 || month > 12) {
        throw new Error("Month must be between 1 and 12");
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
      const paddedMonth = this.month.toString().padStart(2, "0");
      return `${this.year}年${paddedMonth}月`;
    }
  }
  class LineWebhookHandler {
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
        const messageText = ((_a = event.message) == null ? void 0 : _a.text) || "";
        let responseMessage = null;
        if (messageText.includes("支払")) {
          const currentYearMonth = YearMonth.fromDate(/* @__PURE__ */ new Date());
          const settlement = await this.getCreditCardAmountUseCase.execute(currentYearMonth);
          responseMessage = settlement.formatMessage();
        } else if (messageText.toLowerCase().includes("hello")) {
          responseMessage = "hello";
        }
        if (responseMessage !== null) {
          this.lineMessagingDriver.replyMessage(replyToken, responseMessage);
        }
      } catch (error) {
        Logger.log(`Error in LineWebhookHandler: ${error}`);
        throw error;
      }
    }
  }
  class TestHandler {
    constructor(getCreditCardAmountUseCase) {
      this.getCreditCardAmountUseCase = getCreditCardAmountUseCase;
    }
    /**
     * 今月の精算情報を取得してログに出力
     */
    async execute() {
      try {
        Logger.log("=".repeat(60));
        Logger.log("テスト実行開始");
        Logger.log("=".repeat(60));
        const currentYearMonth = YearMonth.fromDate(/* @__PURE__ */ new Date());
        Logger.log(`対象月: ${currentYearMonth.format()}`);
        const settlement = await this.getCreditCardAmountUseCase.execute(currentYearMonth);
        const message = settlement.formatMessage();
        Logger.log("");
        Logger.log("レスポンス:");
        Logger.log(message);
        Logger.log("");
        Logger.log("=".repeat(60));
        return message;
      } catch (error) {
        Logger.log(`エラー発生: ${error}`);
        throw error;
      }
    }
  }
  function generateNonce() {
    return Utilities.base64Encode(Utilities.getUuid());
  }
  function getTimestamp() {
    return Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3).toString();
  }
  function percentEncode(str) {
    return encodeURIComponent(str).replace(/!/g, "%21").replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\*/g, "%2A");
  }
  function generateOAuthParams(consumerKey, token = "") {
    const params = {
      oauth_consumer_key: consumerKey,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: getTimestamp(),
      oauth_nonce: generateNonce(),
      oauth_version: "1.0"
    };
    if (token) {
      params.oauth_token = token;
    }
    return params;
  }
  function generateSignatureBaseString(method, url, params) {
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`).join("&");
    return `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
  }
  function generateSignature(baseString, consumerSecret, tokenSecret = "") {
    const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
    const signature = Utilities.computeHmacSignature(
      Utilities.MacAlgorithm.HMAC_SHA_1,
      baseString,
      signingKey
    );
    return Utilities.base64Encode(signature);
  }
  function callZaimAPI(url, method, queryParams) {
    const driver = new ZaimApiDriver();
    return driver["callZaimAPI"](url, method, queryParams);
  }
  function getZaimAccounts() {
    const driver = new ZaimApiDriver();
    return driver.getAccounts();
  }
  function getZaimMoney(accountId) {
    const driver = new ZaimApiDriver();
    return driver.getTransactions(accountId);
  }
  function startOAuthFlow() {
    const consumerKey = PropertiesService.getScriptProperties().getProperty("ZAIM_CONSUMER_KEY");
    const consumerSecret = PropertiesService.getScriptProperties().getProperty("ZAIM_CONSUMER_SECRET");
    if (!consumerKey || !consumerSecret) {
      Logger.log("エラー: ZAIM_CONSUMER_KEYとZAIM_CONSUMER_SECRETをScript Propertiesに設定してください");
      return;
    }
    const callbackUrl = "oob";
    const requestTokenUrl = "https://api.zaim.net/v2/auth/request";
    const oauthParams = generateOAuthParams(consumerKey);
    oauthParams.oauth_callback = callbackUrl;
    const baseString = generateSignatureBaseString("POST", requestTokenUrl, oauthParams);
    const signature = generateSignature(baseString, consumerSecret, "");
    oauthParams.oauth_signature = signature;
    const authHeader = "OAuth " + Object.keys(oauthParams).sort().map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`).join(", ");
    const options = {
      method: "post",
      headers: {
        "Authorization": authHeader
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
    const params = parseQueryString(responseText);
    const requestToken = params.oauth_token;
    const requestTokenSecret = params.oauth_token_secret;
    if (!requestToken || !requestTokenSecret) {
      Logger.log("エラー: Request Tokenの取得に失敗しました");
      Logger.log(responseText);
      return;
    }
    PropertiesService.getScriptProperties().setProperty("ZAIM_REQUEST_TOKEN_SECRET", requestTokenSecret);
    const authorizeUrl = `https://auth.zaim.net/users/auth?oauth_token=${requestToken}`;
    Logger.log("=".repeat(60));
    Logger.log("Step 1 完了: Request Token取得成功");
    Logger.log("=".repeat(60));
    Logger.log("");
    Logger.log("【次のステップ】");
    Logger.log("");
    Logger.log("1. 以下のURLをブラウザで開いて、Zaimアプリケーションを認証してください：");
    Logger.log("");
    Logger.log(authorizeUrl);
    Logger.log("");
    Logger.log("2. 認証後、Zaimのページに「認証コード」が表示されます。");
    Logger.log("");
    Logger.log("3. GASエディタで「runCompleteOAuthFlow」関数を開いて、以下の値を編集：");
    Logger.log("");
    Logger.log(`   oauth_token: ${requestToken}`);
    Logger.log("   oauth_verifier: (Zaimで表示された認証コード)");
    Logger.log("");
    Logger.log("4. runCompleteOAuthFlowを実行ボタンで実行してください");
    Logger.log("");
    Logger.log("=".repeat(60));
  }
  function runCompleteOAuthFlow() {
    {
      Logger.log("エラー: oauth_tokenとoauth_verifierの値を編集してください");
      return;
    }
  }
  function completeOAuthFlow(oauthToken, oauthVerifier) {
    const consumerKey = PropertiesService.getScriptProperties().getProperty("ZAIM_CONSUMER_KEY");
    const consumerSecret = PropertiesService.getScriptProperties().getProperty("ZAIM_CONSUMER_SECRET");
    const requestTokenSecret = PropertiesService.getScriptProperties().getProperty("ZAIM_REQUEST_TOKEN_SECRET");
    if (!consumerKey || !consumerSecret || !requestTokenSecret) {
      Logger.log("エラー: 必要な情報が見つかりません。先にstartOAuthFlowを実行してください。");
      return;
    }
    const accessTokenUrl = "https://api.zaim.net/v2/auth/access";
    const oauthParams = generateOAuthParams(consumerKey, oauthToken);
    oauthParams.oauth_verifier = oauthVerifier;
    const baseString = generateSignatureBaseString("POST", accessTokenUrl, oauthParams);
    const signature = generateSignature(baseString, consumerSecret, requestTokenSecret);
    oauthParams.oauth_signature = signature;
    const authHeader = "OAuth " + Object.keys(oauthParams).sort().map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`).join(", ");
    const options = {
      method: "post",
      headers: {
        "Authorization": authHeader
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
    const params = parseQueryString(responseText);
    const accessToken = params.oauth_token;
    const accessTokenSecret = params.oauth_token_secret;
    if (!accessToken || !accessTokenSecret) {
      Logger.log("エラー: Access Tokenの取得に失敗しました");
      Logger.log(responseText);
      return;
    }
    PropertiesService.getScriptProperties().setProperty("ZAIM_ACCESS_TOKEN", accessToken);
    PropertiesService.getScriptProperties().setProperty("ZAIM_ACCESS_TOKEN_SECRET", accessTokenSecret);
    PropertiesService.getScriptProperties().deleteProperty("ZAIM_REQUEST_TOKEN_SECRET");
    Logger.log("=".repeat(60));
    Logger.log("Step 2 完了: Access Token取得成功！");
    Logger.log("=".repeat(60));
    Logger.log("");
    Logger.log("以下の情報がScript Propertiesに保存されました：");
    Logger.log(`ZAIM_ACCESS_TOKEN: ${accessToken}`);
    Logger.log(`ZAIM_ACCESS_TOKEN_SECRET: ${accessTokenSecret}`);
    Logger.log("");
    Logger.log("これでZaim APIを使用できます！");
    Logger.log("LINEで「zaim」と送信してテストしてください。");
    Logger.log("=".repeat(60));
  }
  function testZaimConnection() {
    try {
      const verifyUrl = "https://api.zaim.net/v2/home/user/verify";
      const userData = callZaimAPI(verifyUrl, "GET", {});
      Logger.log("=".repeat(60));
      Logger.log("Zaim API接続テスト成功！");
      Logger.log("=".repeat(60));
      Logger.log("");
      Logger.log("ユーザー情報:");
      Logger.log(JSON.stringify(userData, null, 2));
      Logger.log("");
      Logger.log("=".repeat(60));
    } catch (error) {
      Logger.log("エラー: Zaim API接続失敗");
      Logger.log(error);
    }
  }
  function debugGetAccounts() {
    try {
      Logger.log("=".repeat(60));
      Logger.log("アカウント一覧取得開始...");
      Logger.log("=".repeat(60));
      const accounts = getZaimAccounts();
      Logger.log("");
      Logger.log("取得結果:");
      Logger.log(JSON.stringify(accounts, null, 2));
      Logger.log("");
      if (accounts.accounts && accounts.accounts.length > 0) {
        Logger.log("アカウント一覧:");
        accounts.accounts.forEach((account) => {
          Logger.log(`- ID: ${account.id}, 名前: ${account.name}`);
        });
        Logger.log("");
        Logger.log("楽天カード検索:");
        const rakutenCard = accounts.accounts.find(
          (account) => account.name && account.name.includes("楽天")
        );
        if (rakutenCard) {
          Logger.log(`✓ 見つかりました！ ID: ${rakutenCard.id}, 名前: ${rakutenCard.name}`);
        } else {
          Logger.log("✗ 楽天カードが見つかりませんでした");
          Logger.log("すべてのアカウント名を確認してください↑");
        }
      } else {
        Logger.log("アカウントが見つかりませんでした");
      }
      Logger.log("");
      Logger.log("=".repeat(60));
    } catch (error) {
      Logger.log("エラー: アカウント一覧取得失敗");
      Logger.log(error);
    }
  }
  function debugGetAllMoney() {
    try {
      Logger.log("=".repeat(60));
      Logger.log("取引データ取得開始（全件）...");
      Logger.log("=".repeat(60));
      const moneyData = getZaimMoney();
      Logger.log("");
      Logger.log("取得結果:");
      Logger.log(JSON.stringify(moneyData, null, 2));
      Logger.log("");
      if (moneyData.money && moneyData.money.length > 0) {
        Logger.log(`取引データ件数: ${moneyData.money.length}件`);
        Logger.log("");
        Logger.log("最新5件:");
        moneyData.money.slice(0, 5).forEach((item, index) => {
          Logger.log(`${index + 1}. ${item.date} | ¥${item.amount} | ${item.comment || item.name || "(no comment)"} | from_account_id: ${item.from_account_id}`);
        });
      } else {
        Logger.log("取引データが見つかりませんでした");
        Logger.log("Zaimに取引データが登録されているか確認してください");
      }
      Logger.log("");
      Logger.log("=".repeat(60));
    } catch (error) {
      Logger.log("エラー: 取引データ取得失敗");
      Logger.log(error);
    }
  }
  function debugGetRakutenMoney() {
    try {
      Logger.log("=".repeat(60));
      Logger.log("楽天カード取引データ取得開始...");
      Logger.log("=".repeat(60));
      const accounts = getZaimAccounts();
      let rakutenCardId;
      if (accounts.accounts) {
        for (const account of accounts.accounts) {
          Logger.log(`チェック中: ID=${account.id}, 名前="${account.name}"`);
          if (account.name && account.name.includes("楽天")) {
            rakutenCardId = account.id.toString();
            Logger.log(`✓ 楽天カード発見: ID=${rakutenCardId}, 名前="${account.name}"`);
            break;
          }
        }
      }
      if (!rakutenCardId) {
        Logger.log("");
        Logger.log("✗ 楽天カードが見つかりませんでした");
        Logger.log("debugGetAccountsを実行してアカウント名を確認してください");
        Logger.log("=".repeat(60));
        return;
      }
      Logger.log("");
      Logger.log(`楽天カードID: ${rakutenCardId}で取引データ取得中...`);
      const moneyData = getZaimMoney(rakutenCardId);
      Logger.log("");
      Logger.log("取得結果:");
      Logger.log(JSON.stringify(moneyData, null, 2));
      Logger.log("");
      if (moneyData.money && moneyData.money.length > 0) {
        Logger.log(`楽天カード取引件数: ${moneyData.money.length}件`);
        Logger.log("");
        Logger.log("最新10件:");
        moneyData.money.slice(0, 10).forEach((item, index) => {
          Logger.log(`${index + 1}. ${item.date} | ¥${item.amount} | ${item.comment || item.name || "(no comment)"}`);
        });
      } else {
        Logger.log("楽天カードの取引データが見つかりませんでした");
        Logger.log("- 楽天カードで取引が登録されているか確認してください");
        Logger.log("- from_account_idが正しいか確認してください（debugGetAllMoneyで確認）");
      }
      Logger.log("");
      Logger.log("=".repeat(60));
    } catch (error) {
      Logger.log("エラー: 楽天カード取引データ取得失敗");
      Logger.log(error);
    }
  }
  function parseQueryString(queryString) {
    const params = {};
    const pairs = queryString.split("&");
    for (const pair of pairs) {
      const [key, value] = pair.split("=");
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
    return params;
  }
  function setupConsumerCredentials(consumerKey, consumerSecret) {
    PropertiesService.getScriptProperties().setProperty("ZAIM_CONSUMER_KEY", consumerKey);
    PropertiesService.getScriptProperties().setProperty("ZAIM_CONSUMER_SECRET", consumerSecret);
    Logger.log("Consumer KeyとSecretをScript Propertiesに保存しました");
    Logger.log(`ZAIM_CONSUMER_KEY: ${consumerKey}`);
    Logger.log("");
    Logger.log("次にstartOAuthFlowを実行してください");
  }
  if (typeof globalThis !== "undefined") {
    globalThis.startOAuthFlow = startOAuthFlow;
    globalThis.runCompleteOAuthFlow = runCompleteOAuthFlow;
    globalThis.completeOAuthFlow = completeOAuthFlow;
    globalThis.testZaimConnection = testZaimConnection;
    globalThis.debugGetAccounts = debugGetAccounts;
    globalThis.debugGetAllMoney = debugGetAllMoney;
    globalThis.debugGetRakutenMoney = debugGetRakutenMoney;
    globalThis.setupConsumerCredentials = setupConsumerCredentials;
  }
  function doGet() {
    return HtmlService.createHtmlOutput("<h1>Hello from TypeScript!</h1>");
  }
  function doPost(e) {
    const zaimApiDriver = new ZaimApiDriver();
    const lineMessagingDriver = new LineMessagingDriver();
    const creditCardRepository = new CreditCardRepositoryImpl(zaimApiDriver);
    const settlementCalculator = new SettlementCalculator();
    const useCase = new GetCreditCardAmountUseCase(creditCardRepository, settlementCalculator);
    const handler = new LineWebhookHandler(useCase, lineMessagingDriver);
    handler.handleRequest(e.postData.contents);
  }
  function testHandleZaimMessage() {
    const zaimApiDriver = new ZaimApiDriver();
    const creditCardRepository = new CreditCardRepositoryImpl(zaimApiDriver);
    const settlementCalculator = new SettlementCalculator();
    const useCase = new GetCreditCardAmountUseCase(creditCardRepository, settlementCalculator);
    const handler = new TestHandler(useCase);
    handler.execute();
  }
  if (typeof globalThis !== "undefined") {
    globalThis.doGet = doGet;
    globalThis.doPost = doPost;
    globalThis.testHandleZaimMessage = testHandleZaimMessage;
  }
})();
