/**
 * GAS エントリーポイント
 * Clean Architecture による実装
 */

import { ZaimApiDriver } from './driver/ZaimApiDriver';
import { LineMessagingDriver } from './driver/LineMessagingDriver';
import { SpreadsheetDriver } from './driver/SpreadsheetDriver';
import { CreditCardRepositoryImpl } from './gateway/CreditCardRepositoryImpl';
import { AdvancePaymentRepositoryImpl } from './gateway/AdvancePaymentRepositoryImpl';
import { SettlementCalculator } from './domain/service/SettlementCalculator';
import { GetCreditCardAmountUseCase } from './usecase/GetCreditCardAmountUseCase';
import { GetAdvancePaymentsUseCase } from './usecase/GetAdvancePaymentsUseCase';
import { AddAdvancePaymentUseCase } from './usecase/AddAdvancePaymentUseCase';
import { DeleteAdvancePaymentUseCase } from './usecase/DeleteAdvancePaymentUseCase';
import { CalculateSettlementUseCase } from './usecase/CalculateSettlementUseCase';
import { LineWebhookHandler } from './presentation/LineWebhookHandler';
import { TestHandler } from './presentation/TestHandler';
import { AdvancePaymentHtmlHandler } from './presentation/AdvancePaymentHtmlHandler';

// Import oauth-helper to include it in bundle
import './oauth-helper';

/**
 * GAS GET エンドポイント
 * 建て替え記録HTMLアプリを返す
 */
function doGet(): GoogleAppsScript.HTML.HtmlOutput {
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
  </script>
</body>
</html>`;

  return HtmlService.createHtmlOutput(htmlContent)
    .setTitle('建て替え記録')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * LINE Webhook エンドポイント
 * LINEからのメッセージを受信して返信する
 */
function doPost(e: any): void {
  // 依存関係を組み立て
  const zaimApiDriver = new ZaimApiDriver();
  const lineMessagingDriver = new LineMessagingDriver();
  const creditCardRepository = new CreditCardRepositoryImpl(zaimApiDriver);
  const settlementCalculator = new SettlementCalculator();
  const useCase = new GetCreditCardAmountUseCase(creditCardRepository, settlementCalculator);
  const handler = new LineWebhookHandler(useCase, lineMessagingDriver);

  // リクエストを処理
  handler.handleRequest(e.postData.contents);
}

/**
 * テスト用: 新しいアーキテクチャでZaim処理を実行
 */
function testHandleZaimMessage(): void {
  // 依存関係を組み立て
  const zaimApiDriver = new ZaimApiDriver();
  const creditCardRepository = new CreditCardRepositoryImpl(zaimApiDriver);
  const settlementCalculator = new SettlementCalculator();
  const useCase = new GetCreditCardAmountUseCase(creditCardRepository, settlementCalculator);
  const handler = new TestHandler(useCase);

  // テスト実行
  handler.execute();
}

/**
 * Spreadsheet IDを設定
 * 以下の 'YOUR_SPREADSHEET_ID' をあなたのSpreadsheet IDに書き換えてから
 * GASエディタで一度だけ実行してください
 */
function setupSpreadsheetId(): void {
  const spreadsheetId = 'YOUR_SPREADSHEET_ID'; // ここを書き換える
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheetId);
  Logger.log(`Spreadsheet ID was set: ${spreadsheetId}`);
}

/**
 * WebアプリURLを設定
 * 1. GASをWebアプリとして公開
 * 2. 公開されたURLを以下の 'YOUR_WEB_APP_URL' に書き換える
 * 3. GASエディタで一度だけ実行してください
 */
function setupWebAppUrl(): void {
  const webAppUrl = 'YOUR_WEB_APP_URL'; // ここを書き換える
  PropertiesService.getScriptProperties().setProperty('WEB_APP_URL', webAppUrl);
  Logger.log(`Web App URL was set: ${webAppUrl}`);
}

/**
 * 建て替え記録用のグローバル関数
 * HTMLから google.script.run で呼び出される
 */
function getPayments(): any[] {
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

function getSettlement(): any {
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

function addPayment(date: string, payer: string, amount: number, memo: string): void {
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

function deletePayment(id: string): void {
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

// Export functions to global scope for GAS
if (typeof globalThis !== 'undefined') {
  (globalThis as any).doGet = doGet;
  (globalThis as any).doPost = doPost;
  (globalThis as any).testHandleZaimMessage = testHandleZaimMessage;
  (globalThis as any).setupSpreadsheetId = setupSpreadsheetId;
  (globalThis as any).setupWebAppUrl = setupWebAppUrl;
  (globalThis as any).getPayments = getPayments;
  (globalThis as any).getSettlement = getSettlement;
  (globalThis as any).addPayment = addPayment;
  (globalThis as any).deletePayment = deletePayment;
}
