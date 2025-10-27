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
/**
 * GAS GET エンドポイント
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function doGet() {
    return HtmlService.createHtmlOutput('<h1>Hello from TypeScript!</h1>');
}
/**
 * LINE Webhook エンドポイント
 * LINEからのメッセージを受信して返信する
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function doPost(e) {
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function testHandleZaimMessage() {
    // 依存関係を組み立て
    const zaimApiDriver = new ZaimApiDriver();
    const creditCardRepository = new CreditCardRepositoryImpl(zaimApiDriver);
    const settlementCalculator = new SettlementCalculator();
    const useCase = new GetCreditCardAmountUseCase(creditCardRepository, settlementCalculator);
    const handler = new TestHandler(useCase);
    // テスト実行
    handler.execute();
}
