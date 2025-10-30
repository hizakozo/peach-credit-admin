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
      try {
        Logger.log(`[LineMessagingDriver] Sending message: ${message}`);
        Logger.log(`[LineMessagingDriver] replyToken: ${replyToken}`);
        const lineToken = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
        Logger.log(`[LineMessagingDriver] LINE_CHANNEL_ACCESS_TOKEN exists: ${!!lineToken}`);
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
        const response = UrlFetchApp.fetch(this.LINE_URL, options);
        Logger.log(`[LineMessagingDriver] Response code: ${response.getResponseCode()}`);
        Logger.log(`[LineMessagingDriver] Response: ${response.getContentText()}`);
      } catch (error) {
        Logger.log(`[LineMessagingDriver] Error: ${error}`);
        Logger.log(`[LineMessagingDriver] Stack: ${error.stack || "No stack"}`);
        throw error;
      }
    }
  }
  class SpreadsheetDriver {
    constructor() {
      this.sheetName = "AdvancePayments";
      this.spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || "";
      if (!this.spreadsheetId) {
        throw new Error("SPREADSHEET_ID is not set in script properties");
      }
    }
    /**
     * シートを取得（存在しない場合は作成）
     */
    getOrCreateSheet() {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      let sheet = spreadsheet.getSheetByName(this.sheetName);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(this.sheetName);
        sheet.appendRow(["ID", "Date", "Payer", "Amount", "Memo", "CreatedAt"]);
        sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
      }
      return sheet;
    }
    /**
     * 全ての行を取得
     */
    getAllRows() {
      const sheet = this.getOrCreateSheet();
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return [];
      }
      const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      return data.map((row) => ({
        id: String(row[0]),
        date: String(row[1]),
        payer: String(row[2]),
        amount: Number(row[3]),
        memo: String(row[4]),
        createdAt: String(row[5])
      }));
    }
    /**
     * 行を追加
     */
    appendRow(row) {
      const sheet = this.getOrCreateSheet();
      sheet.appendRow([
        row.id,
        row.date,
        row.payer,
        row.amount,
        row.memo,
        row.createdAt
      ]);
    }
    /**
     * 指定されたIDの行を削除
     */
    deleteRowById(id) {
      const sheet = this.getOrCreateSheet();
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return;
      }
      const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]) === id) {
          sheet.deleteRow(i + 2);
          return;
        }
      }
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
  class AdvancePayment {
    constructor(id, date, payer, amount, memo) {
      this.id = id;
      this.date = date;
      this.payer = payer;
      this.amount = amount;
      this.memo = memo;
    }
    getId() {
      return this.id;
    }
    getDate() {
      return this.date;
    }
    getPayer() {
      return this.payer;
    }
    getAmount() {
      return this.amount;
    }
    getMemo() {
      return this.memo;
    }
    /**
     * 日付を "YYYY-MM-DD" 形式で取得
     */
    getFormattedDate() {
      const year = this.date.getFullYear();
      const month = String(this.date.getMonth() + 1).padStart(2, "0");
      const day = String(this.date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    /**
     * 指定された年月の記録かどうかを判定
     */
    isInMonth(year, month) {
      return this.date.getFullYear() === year && this.date.getMonth() + 1 === month;
    }
  }
  const _Payer = class _Payer {
    constructor(value) {
      this.value = value;
    }
    getValue() {
      return this.value;
    }
    equals(other) {
      return this.value === other.value;
    }
    /**
     * 文字列から Payer を生成
     */
    static fromString(value) {
      if (value === "夫") return _Payer.HUSBAND;
      if (value === "妻") return _Payer.WIFE;
      throw new Error(`Invalid payer value: ${value}`);
    }
  };
  _Payer.HUSBAND = new _Payer("夫");
  _Payer.WIFE = new _Payer("妻");
  let Payer = _Payer;
  class AdvancePaymentRepositoryImpl {
    constructor(spreadsheetDriver) {
      this.spreadsheetDriver = spreadsheetDriver;
    }
    /**
     * SpreadsheetRow を AdvancePayment に変換
     */
    rowToAdvancePayment(row) {
      return new AdvancePayment(
        row.id,
        new Date(row.date),
        Payer.fromString(row.payer),
        new Money(row.amount),
        row.memo
      );
    }
    /**
     * AdvancePayment を SpreadsheetRow に変換
     */
    advancePaymentToRow(payment) {
      return {
        id: payment.getId(),
        date: payment.getFormattedDate(),
        payer: payment.getPayer().getValue(),
        amount: payment.getAmount().getValue(),
        memo: payment.getMemo(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    findAll() {
      const rows = this.spreadsheetDriver.getAllRows();
      return rows.map((row) => this.rowToAdvancePayment(row));
    }
    findByYearMonth(year, month) {
      const all = this.findAll();
      return all.filter((payment) => payment.isInMonth(year, month));
    }
    findByDateRange(startDate, endDate) {
      const all = this.findAll();
      return all.filter((payment) => {
        const paymentDate = payment.getDate();
        return paymentDate >= startDate && paymentDate <= endDate;
      });
    }
    add(payment) {
      const row = this.advancePaymentToRow(payment);
      this.spreadsheetDriver.appendRow(row);
    }
    delete(id) {
      this.spreadsheetDriver.deleteRowById(id);
    }
  }
  class MonthlySettlement {
    constructor(yearMonth, creditCardTotal, husbandAmount, wifeAmount) {
      this.yearMonth = yearMonth;
      this.creditCardTotal = creditCardTotal;
      this.husbandAmount = husbandAmount;
      this.wifeAmount = wifeAmount;
    }
    getYearMonth() {
      return this.yearMonth;
    }
    getCreditCardTotal() {
      return this.creditCardTotal;
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

【${this.yearMonth.format()}支払い分】

カード合計: ${this.creditCardTotal.format()}

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
      return new MonthlySettlement(yearMonth, totalAmount, halfAmount, halfAmount);
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
  class GetAdvancePaymentsUseCase {
    constructor(repository) {
      this.repository = repository;
    }
    /**
     * 指定された年月の建て替え記録を取得
     */
    execute(year, month) {
      return this.repository.findByYearMonth(year, month);
    }
  }
  class AddAdvancePaymentUseCase {
    constructor(repository) {
      this.repository = repository;
    }
    /**
     * 建て替え記録を追加
     */
    execute(date, payer, amount, memo) {
      const id = Date.now().toString();
      const payment = new AdvancePayment(
        id,
        date,
        payer,
        new Money(amount),
        memo
      );
      this.repository.add(payment);
    }
  }
  class DeleteAdvancePaymentUseCase {
    constructor(repository) {
      this.repository = repository;
    }
    /**
     * 建て替え記録を削除
     */
    execute(id) {
      this.repository.delete(id);
    }
  }
  class CalculateSettlementUseCase {
    constructor(repository) {
      this.repository = repository;
    }
    /**
     * 指定された年月の精算を計算
     * 多く払った方から少なく払った方への精算額を計算
     */
    execute(year, month) {
      const payments = this.repository.findByYearMonth(year, month);
      let husbandTotal = 0;
      let wifeTotal = 0;
      for (const payment of payments) {
        const amount = payment.getAmount().getValue();
        if (payment.getPayer().equals(Payer.HUSBAND)) {
          husbandTotal += amount;
        } else if (payment.getPayer().equals(Payer.WIFE)) {
          wifeTotal += amount;
        }
      }
      const diff = Math.abs(husbandTotal - wifeTotal);
      let settlementPayer = null;
      if (husbandTotal > wifeTotal) {
        settlementPayer = Payer.WIFE;
      } else if (wifeTotal > husbandTotal) {
        settlementPayer = Payer.HUSBAND;
      }
      return {
        husbandTotal: new Money(husbandTotal),
        wifeTotal: new Money(wifeTotal),
        settlementAmount: new Money(diff),
        settlementPayer
      };
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
    constructor(getCreditCardAmountUseCase, advancePaymentRepository, lineMessagingDriver) {
      this.getCreditCardAmountUseCase = getCreditCardAmountUseCase;
      this.advancePaymentRepository = advancePaymentRepository;
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
          const yearMonth = this.extractYearMonth(messageText);
          const settlement = await this.getCreditCardAmountUseCase.execute(yearMonth);
          responseMessage = settlement.formatMessage();
        } else if (messageText.includes("建て替え")) {
          if (this.hasMonthSpecification(messageText)) {
            responseMessage = this.formatAdvancePaymentRecords(messageText);
          } else {
            try {
              const webAppUrl = PropertiesService.getScriptProperties().getProperty("WEB_APP_URL");
              if (webAppUrl) {
                responseMessage = `建て替え記録アプリ:
${webAppUrl}`;
              } else {
                responseMessage = "建て替え記録アプリのURLが設定されていません。\nGASエディタでsetupWebAppUrlを実行してください。";
              }
            } catch (error) {
              Logger.log(`Error getting web app URL: ${error}`);
              responseMessage = "建て替え記録アプリのURL取得に失敗しました。";
            }
          }
        } else if (messageText.toLowerCase().includes("hello")) {
          responseMessage = "hello";
        }
        if (responseMessage !== null) {
          this.lineMessagingDriver.replyMessage(replyToken, responseMessage);
        }
      } catch (error) {
        Logger.log(`Error in LineWebhookHandler: ${error}`);
        try {
          const json = JSON.parse(postData);
          const event = json.events[0];
          if (event && event.replyToken) {
            const errorMessage = `エラーが発生しました:

${error}

Stack:
${error.stack || "スタックトレースなし"}`;
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
    extractYearMonth(messageText) {
      const now = /* @__PURE__ */ new Date();
      const currentYear = now.getFullYear();
      const yearMonthMatch = messageText.match(/(\d{4})年(\d{1,2})月/);
      if (yearMonthMatch) {
        const year = parseInt(yearMonthMatch[1], 10);
        const month = parseInt(yearMonthMatch[2], 10);
        return new YearMonth(year, month);
      }
      const monthMatch = messageText.match(/(\d{1,2})月/);
      if (monthMatch) {
        const month = parseInt(monthMatch[1], 10);
        return new YearMonth(currentYear, month);
      }
      return YearMonth.fromDate(now);
    }
    /**
     * メッセージに月の指定があるかチェック
     */
    hasMonthSpecification(messageText) {
      return /(\d{4})年(\d{1,2})月/.test(messageText) || /(\d{1,2})月/.test(messageText);
    }
    /**
     * 建て替え記録を整形して返す
     * 例: 「建て替え10月」→ 8月26日〜9月25日の記録
     */
    formatAdvancePaymentRecords(messageText) {
      const paymentMonth = this.extractYearMonth(messageText);
      const paymentYear = paymentMonth.getYear();
      const paymentMonthNum = paymentMonth.getMonth();
      const startDate = new Date(paymentYear, paymentMonthNum - 2, 26);
      const endDate = new Date(paymentYear, paymentMonthNum - 1, 25);
      const payments = this.advancePaymentRepository.findByDateRange(startDate, endDate);
      if (payments.length === 0) {
        return `【${paymentMonth.format()}支払い分】
建て替え記録がありません。`;
      }
      let husbandTotal = 0;
      let wifeTotal = 0;
      payments.forEach((payment) => {
        const amount = payment.getAmount().getValue();
        if (payment.getPayer().getValue() === "夫") {
          husbandTotal += amount;
        } else {
          wifeTotal += amount;
        }
      });
      const diff = Math.abs(husbandTotal - wifeTotal);
      const halfDiff = Math.floor(diff / 2);
      let message = `📝 建て替え記録
【${paymentMonth.format()}支払い分】
`;
      message += `期間: ${this.formatDate(startDate)} 〜 ${this.formatDate(endDate)}

`;
      message += "--- 記録 ---\n";
      payments.forEach((payment) => {
        const dateStr = payment.getFormattedDate();
        const payer = payment.getPayer().getValue();
        const amount = payment.getAmount().format();
        const memo = payment.getMemo();
        message += `${dateStr} ${payer === "夫" ? "👨" : "👩"} ${amount}
${memo}

`;
      });
      message += "--- 合計 ---\n";
      message += `👨 夫: ${this.formatMoney(husbandTotal)}
`;
      message += `👩 妻: ${this.formatMoney(wifeTotal)}

`;
      message += "--- 清算 ---\n";
      if (husbandTotal > wifeTotal) {
        message += `👩 妻 → 👨 夫: ${this.formatMoney(halfDiff)}`;
      } else if (wifeTotal > husbandTotal) {
        message += `👨 夫 → 👩 妻: ${this.formatMoney(halfDiff)}`;
      } else {
        message += "差額なし";
      }
      return message;
    }
    /**
     * Date を YYYY-MM-DD 形式にフォーマット
     */
    formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    /**
     * 金額を円表記にフォーマット
     */
    formatMoney(amount) {
      return `${amount.toLocaleString()}円`;
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
  class AdvancePaymentHtmlHandler {
    constructor(getPaymentsUseCase, addPaymentUseCase, deletePaymentUseCase, calculateSettlementUseCase) {
      this.getPaymentsUseCase = getPaymentsUseCase;
      this.addPaymentUseCase = addPaymentUseCase;
      this.deletePaymentUseCase = deletePaymentUseCase;
      this.calculateSettlementUseCase = calculateSettlementUseCase;
    }
    /**
     * 今月の建て替え記録一覧を取得（クライアント側から呼ばれる）
     */
    getPayments() {
      const now = /* @__PURE__ */ new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const payments = this.getPaymentsUseCase.execute(year, month);
      return payments.map((payment) => ({
        id: payment.getId(),
        date: payment.getFormattedDate(),
        payer: payment.getPayer().getValue(),
        amount: payment.getAmount().getValue(),
        memo: payment.getMemo()
      }));
    }
    /**
     * 精算計算（クライアント側から呼ばれる）
     */
    getSettlement() {
      var _a;
      const now = /* @__PURE__ */ new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const result = this.calculateSettlementUseCase.execute(year, month);
      return {
        husbandTotal: result.husbandTotal.getValue(),
        wifeTotal: result.wifeTotal.getValue(),
        settlementAmount: result.settlementAmount.getValue(),
        settlementPayer: ((_a = result.settlementPayer) == null ? void 0 : _a.getValue()) || null
      };
    }
    /**
     * 建て替え記録を追加（クライアント側から呼ばれる）
     */
    addPayment(date, payer, amount, memo) {
      const payerObj = Payer.fromString(payer);
      const dateObj = new Date(date);
      this.addPaymentUseCase.execute(dateObj, payerObj, amount, memo);
    }
    /**
     * 建て替え記録を削除（クライアント側から呼ばれる）
     */
    deletePayment(id) {
      this.deletePaymentUseCase.execute(id);
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
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>建て替え記録</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; margin-bottom: 20px; color: #333; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; color: #555; font-size: 14px; }
    input, select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    button { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    button:hover { background-color: #0056b3; }
    button.delete { background-color: #dc3545; padding: 5px 10px; font-size: 12px; }
    button.delete:hover { background-color: #c82333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f8f9fa; font-weight: 600; color: #333; }
    .settlement { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 20px; }
    .settlement-title { font-weight: 600; margin-bottom: 10px; color: #333; }
    .settlement-result { font-size: 18px; color: #007bff; margin-top: 5px; }
    .loading { text-align: center; padding: 20px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <h1 id="title">建て替え記録</h1>
    <form id="add-form">
      <div class="form-group">
        <label>日付</label>
        <input type="date" id="date" required>
      </div>
      <div class="form-group">
        <label>支払者</label>
        <select id="payer" required>
          <option value="夫">夫</option>
          <option value="妻">妻</option>
        </select>
      </div>
      <div class="form-group">
        <label>金額</label>
        <input type="number" id="amount" required min="0" step="1">
      </div>
      <div class="form-group">
        <label>メモ</label>
        <input type="text" id="memo" required placeholder="例: ランチ代">
      </div>
      <button type="submit">追加</button>
    </form>
    <div class="settlement" id="settlement">
      <div class="loading">精算情報を読み込み中...</div>
    </div>
    <table>
      <thead>
        <tr><th>日付</th><th>支払者</th><th>金額</th><th>メモ</th><th></th></tr>
      </thead>
      <tbody id="payment-list">
        <tr><td colspan="5" class="loading">記録を読み込み中...</td></tr>
      </tbody>
    </table>
  </div>
  <script>
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    document.getElementById('title').textContent = \`建て替え記録 - \${year}年\${month}月\`;
    document.getElementById('date').valueAsDate = now;

    function loadPayments() {
      google.script.run.withSuccessHandler(function(payments) {
        const tbody = document.getElementById('payment-list');
        if (payments.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999;">記録がありません</td></tr>';
        } else {
          tbody.innerHTML = payments.map(p => \`
            <tr>
              <td>\${p.date}</td>
              <td>\${p.payer}</td>
              <td>\${p.amount.toLocaleString()}円</td>
              <td>\${p.memo}</td>
              <td><button class="delete" onclick="deletePayment('\${p.id}')">削除</button></td>
            </tr>
          \`).join('');
        }
      }).withFailureHandler(function(error) {
        alert('読み込みエラー: ' + error.message);
      }).getPayments();
    }

    function loadSettlement() {
      google.script.run.withSuccessHandler(function(result) {
        const div = document.getElementById('settlement');
        let message = \`
          <div class="settlement-title">今月の精算</div>
          <div>夫: \${result.husbandTotal.toLocaleString()}円</div>
          <div>妻: \${result.wifeTotal.toLocaleString()}円</div>
        \`;
        if (result.settlementPayer) {
          message += \`<div class="settlement-result">\${result.settlementPayer}が\${result.settlementAmount.toLocaleString()}円を支払う</div>\`;
        } else {
          message += \`<div class="settlement-result">精算不要</div>\`;
        }
        div.innerHTML = message;
      }).withFailureHandler(function(error) {
        document.getElementById('settlement').innerHTML = '<div>精算情報の読み込みに失敗しました</div>';
      }).getSettlement();
    }

    function deletePayment(id) {
      if (!confirm('この記録を削除しますか？')) return;
      google.script.run.withSuccessHandler(function() {
        loadPayments();
        loadSettlement();
      }).withFailureHandler(function(error) {
        alert('削除エラー: ' + error.message);
      }).deletePayment(id);
    }

    document.getElementById('add-form').addEventListener('submit', function(e) {
      e.preventDefault();
      const date = document.getElementById('date').value;
      const payer = document.getElementById('payer').value;
      const amount = parseInt(document.getElementById('amount').value);
      const memo = document.getElementById('memo').value;
      google.script.run.withSuccessHandler(function() {
        document.getElementById('add-form').reset();
        document.getElementById('date').valueAsDate = new Date();
        loadPayments();
        loadSettlement();
      }).withFailureHandler(function(error) {
        alert('追加エラー: ' + error.message);
      }).addPayment(date, payer, amount, memo);
    });

    loadPayments();
    loadSettlement();
  <\/script>
</body>
</html>`;
    return HtmlService.createHtmlOutput(htmlContent).setTitle("建て替え記録").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  function testWriteToSheet() {
    try {
      const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
      Logger.log("SPREADSHEET_ID: " + spreadsheetId);
      if (!spreadsheetId) {
        Logger.log("ERROR: SPREADSHEET_ID not set");
        return;
      }
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      Logger.log("Spreadsheet opened: " + spreadsheet.getName());
      let sheet = spreadsheet.getSheetByName("DebugLog");
      if (!sheet) {
        Logger.log("Creating DebugLog sheet...");
        sheet = spreadsheet.insertSheet("DebugLog");
        sheet.appendRow(["Timestamp", "Message"]);
        sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
      }
      const timestamp = (/* @__PURE__ */ new Date()).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      sheet.appendRow([timestamp, "TEST: testWriteToSheet executed successfully"]);
      Logger.log("Successfully wrote to sheet!");
    } catch (error) {
      Logger.log("ERROR: " + error);
      Logger.log("Stack: " + (error.stack || "No stack"));
    }
  }
  function doPost(e) {
    var _a, _b;
    const lineMessagingDriver = new LineMessagingDriver();
    let replyToken = null;
    try {
      Logger.log("doPost called");
      Logger.log("e: " + JSON.stringify(e));
      if (!e || !e.postData || !e.postData.contents) {
        Logger.log("Error: Invalid request data");
        return;
      }
      Logger.log("postData.contents: " + e.postData.contents);
      const json = JSON.parse(e.postData.contents);
      const event = (_a = json.events) == null ? void 0 : _a[0];
      if (!event) {
        Logger.log("No event found");
        return;
      }
      replyToken = event.replyToken;
      const messageText = ((_b = event.message) == null ? void 0 : _b.text) || "";
      Logger.log("messageText: " + messageText);
      Logger.log("replyToken: " + replyToken);
      if (messageText.toLowerCase().includes("hello")) {
        Logger.log("Hello detected, replying synchronously");
        if (replyToken) {
          try {
            const debugInfo = `hello

[DEBUG]
doPost: OK
messageText: ${messageText}
replyToken: ${replyToken}`;
            lineMessagingDriver.replyMessage(replyToken, debugInfo);
            Logger.log("Reply sent");
          } catch (helloError) {
            Logger.log("Error sending hello: " + helloError);
            const errorInfo = `Error sending hello:
${helloError}

Stack:
${helloError.stack || "No stack"}`;
            try {
              lineMessagingDriver.replyMessage(replyToken, errorInfo);
            } catch (e2) {
              Logger.log("Failed to send error: " + e2);
            }
          }
        } else {
          Logger.log("No replyToken available");
        }
        return;
      }
      const zaimApiDriver = new ZaimApiDriver();
      const creditCardRepository = new CreditCardRepositoryImpl(zaimApiDriver);
      const settlementCalculator = new SettlementCalculator();
      const useCase = new GetCreditCardAmountUseCase(creditCardRepository, settlementCalculator);
      const spreadsheetDriver = new SpreadsheetDriver();
      const advancePaymentRepository = new AdvancePaymentRepositoryImpl(spreadsheetDriver);
      const handler = new LineWebhookHandler(useCase, advancePaymentRepository, lineMessagingDriver);
      handler.handleRequest(e.postData.contents);
    } catch (error) {
      Logger.log("Critical error in doPost: " + error);
      Logger.log("Stack: " + (error.stack || "No stack trace"));
      if (replyToken) {
        try {
          const errorMessage = `doPost()でエラー発生:

${error}

Stack:
${error.stack || "スタックトレースなし"}`;
          lineMessagingDriver.replyMessage(replyToken, errorMessage);
        } catch (replyError) {
          Logger.log("Failed to send error to LINE: " + replyError);
        }
      }
    }
  }
  function testHandleZaimMessage() {
    const zaimApiDriver = new ZaimApiDriver();
    const creditCardRepository = new CreditCardRepositoryImpl(zaimApiDriver);
    const settlementCalculator = new SettlementCalculator();
    const useCase = new GetCreditCardAmountUseCase(creditCardRepository, settlementCalculator);
    const handler = new TestHandler(useCase);
    handler.execute();
  }
  function setupSpreadsheetId() {
    const spreadsheetId = "YOUR_SPREADSHEET_ID";
    PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", spreadsheetId);
    Logger.log(`Spreadsheet ID was set: ${spreadsheetId}`);
  }
  function setupWebAppUrl() {
    const webAppUrl = "YOUR_WEB_APP_URL";
    PropertiesService.getScriptProperties().setProperty("WEB_APP_URL", webAppUrl);
    Logger.log(`Web App URL was set: ${webAppUrl}`);
  }
  function getPayments() {
    const spreadsheetDriver = new SpreadsheetDriver();
    const repository = new AdvancePaymentRepositoryImpl(spreadsheetDriver);
    const useCase = new GetAdvancePaymentsUseCase(repository);
    const handler = new AdvancePaymentHtmlHandler(
      useCase,
      new AddAdvancePaymentUseCase(repository),
      new DeleteAdvancePaymentUseCase(repository),
      new CalculateSettlementUseCase(repository)
    );
    return handler.getPayments();
  }
  function getSettlement() {
    const spreadsheetDriver = new SpreadsheetDriver();
    const repository = new AdvancePaymentRepositoryImpl(spreadsheetDriver);
    const useCase = new CalculateSettlementUseCase(repository);
    const handler = new AdvancePaymentHtmlHandler(
      new GetAdvancePaymentsUseCase(repository),
      new AddAdvancePaymentUseCase(repository),
      new DeleteAdvancePaymentUseCase(repository),
      useCase
    );
    return handler.getSettlement();
  }
  function addPayment(date, payer, amount, memo) {
    const spreadsheetDriver = new SpreadsheetDriver();
    const repository = new AdvancePaymentRepositoryImpl(spreadsheetDriver);
    const useCase = new AddAdvancePaymentUseCase(repository);
    const handler = new AdvancePaymentHtmlHandler(
      new GetAdvancePaymentsUseCase(repository),
      useCase,
      new DeleteAdvancePaymentUseCase(repository),
      new CalculateSettlementUseCase(repository)
    );
    handler.addPayment(date, payer, amount, memo);
  }
  function deletePayment(id) {
    const spreadsheetDriver = new SpreadsheetDriver();
    const repository = new AdvancePaymentRepositoryImpl(spreadsheetDriver);
    const useCase = new DeleteAdvancePaymentUseCase(repository);
    const handler = new AdvancePaymentHtmlHandler(
      new GetAdvancePaymentsUseCase(repository),
      new AddAdvancePaymentUseCase(repository),
      useCase,
      new CalculateSettlementUseCase(repository)
    );
    handler.deletePayment(id);
  }
  (function(global) {
    global.doGet = doGet;
    global.doPost = doPost;
    global.testHandleZaimMessage = testHandleZaimMessage;
    global.setupSpreadsheetId = setupSpreadsheetId;
    global.setupWebAppUrl = setupWebAppUrl;
    global.getPayments = getPayments;
    global.getSettlement = getSettlement;
    global.addPayment = addPayment;
    global.deletePayment = deletePayment;
    global.testWriteToSheet = testWriteToSheet;
  })(this);
})();

// Ensure functions are in global scope for GAS
function doGet(e) { return this.doGet(e); }
function doPost(e) { return this.doPost(e); }
function testHandleZaimMessage() { return this.testHandleZaimMessage(); }
function setupSpreadsheetId() { return this.setupSpreadsheetId(); }
function setupWebAppUrl() { return this.setupWebAppUrl(); }
function getPayments() { return this.getPayments(); }
function getSettlement() { return this.getSettlement(); }
function addPayment(a, b, c, d) { return this.addPayment(a, b, c, d); }
function deletePayment(a) { return this.deletePayment(a); }
function testWriteToSheet() { return this.testWriteToSheet(); }
