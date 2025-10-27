/**
 * GAS エントリーポイント
 * Clean Architecture による実装
 */

import { ZaimApiDriver } from './driver/ZaimApiDriver';
import { LineMessagingDriver } from './driver/LineMessagingDriver';
import { CreditCardRepositoryImpl } from './gateway/CreditCardRepositoryImpl';
import { SettlementCalculator } from './domain/service/SettlementCalculator';
import { GetCreditCardAmountUseCase } from './usecase/GetCreditCardAmountUseCase';
import { LineWebhookHandler } from './presentation/LineWebhookHandler';
import { TestHandler } from './presentation/TestHandler';

// Import oauth-helper to include it in bundle
import './oauth-helper';

/**
 * GAS GET エンドポイント
 */
function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutput('<h1>Hello from TypeScript!</h1>');
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

// Export functions to global scope for GAS
if (typeof globalThis !== 'undefined') {
  (globalThis as any).doGet = doGet;
  (globalThis as any).doPost = doPost;
  (globalThis as any).testHandleZaimMessage = testHandleZaimMessage;
}
