import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestHandler } from './TestHandler';
import { GetCreditCardAmountUseCase } from '../usecase/GetCreditCardAmountUseCase';
import { CreditCardRepositoryImpl } from '../gateway/CreditCardRepositoryImpl';
import { SettlementCalculator } from '../domain/service/SettlementCalculator';
import { ZaimApiDriver, ZaimAccount, ZaimTransaction } from '../driver/ZaimApiDriver';

// Mock GAS globals
global.Logger = {
  log: vi.fn(),
} as any;

describe('TestHandler Integration Test', () => {
  let testHandler: TestHandler;
  let mockZaimApiDriver: ZaimApiDriver;

  beforeEach(() => {
    // ZaimApiDriver をモック
    mockZaimApiDriver = {
      getAccounts: vi.fn(),
      getTransactions: vi.fn(),
    } as any;

    // 依存関係を組み立て
    const creditCardRepository = new CreditCardRepositoryImpl(mockZaimApiDriver);
    const settlementCalculator = new SettlementCalculator();
    const useCase = new GetCreditCardAmountUseCase(creditCardRepository, settlementCalculator);
    testHandler = new TestHandler(useCase);
  });

  it('should return formatted settlement message for current month', async () => {
    // モックデータを設定
    const mockAccounts: ZaimAccount[] = [
      {
        id: 20669558,
        name: '楽天カード',
        active: 1
      }
    ];

    const mockTransactions: ZaimTransaction[] = [
      {
        id: 1,
        date: '2025-10-27',
        amount: 91789,
        mode: 'transfer',
        from_account_id: 20669558,
        to_account_id: 12345,
        comment: '楽天カードサービス'
      }
    ];

    vi.mocked(mockZaimApiDriver.getAccounts).mockReturnValue(mockAccounts);
    vi.mocked(mockZaimApiDriver.getTransactions).mockReturnValue(mockTransactions);

    // 実行
    const result = await testHandler.execute();

    // 検証
    expect(result).toContain('💳 今月の支払い金額が確定しました');
    expect(result).toContain('【2025年10月分】');
    expect(result).toContain('👨 45,894円');
    expect(result).toContain('👩 45,894円');

    // モックが正しく呼ばれたことを確認
    expect(mockZaimApiDriver.getAccounts).toHaveBeenCalledTimes(1);
    expect(mockZaimApiDriver.getTransactions).toHaveBeenCalledTimes(1);
  });

  it('should filter transactions by account id', async () => {
    const mockAccounts: ZaimAccount[] = [
      {
        id: 20669558,
        name: '楽天カード',
        active: 1
      }
    ];

    const mockTransactions: ZaimTransaction[] = [
      // 楽天カードの取引
      {
        id: 1,
        date: '2025-10-15',
        amount: 50000,
        mode: 'transfer',
        from_account_id: 20669558,
      },
      // 他のカードの取引（除外されるべき）
      {
        id: 2,
        date: '2025-10-16',
        amount: 30000,
        mode: 'payment',
        from_account_id: 99999,
      },
      // 楽天カードの取引（to_account_id）
      {
        id: 3,
        date: '2025-10-17',
        amount: 20000,
        mode: 'transfer',
        to_account_id: 20669558,
      }
    ];

    vi.mocked(mockZaimApiDriver.getAccounts).mockReturnValue(mockAccounts);
    vi.mocked(mockZaimApiDriver.getTransactions).mockReturnValue(mockTransactions);

    const result = await testHandler.execute();

    // 合計は 50000 + 20000 = 70000、半分は 35000
    expect(result).toContain('👨 35,000円');
    expect(result).toContain('👩 35,000円');
  });

  it('should filter transactions by year month', async () => {
    const mockAccounts: ZaimAccount[] = [
      {
        id: 20669558,
        name: '楽天カード',
        active: 1
      }
    ];

    const mockTransactions: ZaimTransaction[] = [
      // 今月（2025-10）の取引
      {
        id: 1,
        date: '2025-10-15',
        amount: 50000,
        mode: 'transfer',
        from_account_id: 20669558,
      },
      // 先月（2025-09）の取引（除外されるべき）
      {
        id: 2,
        date: '2025-09-28',
        amount: 30000,
        mode: 'transfer',
        from_account_id: 20669558,
      },
      // 来月（2025-11）の取引（除外されるべき）
      {
        id: 3,
        date: '2025-11-01',
        amount: 20000,
        mode: 'transfer',
        from_account_id: 20669558,
      }
    ];

    vi.mocked(mockZaimApiDriver.getAccounts).mockReturnValue(mockAccounts);
    vi.mocked(mockZaimApiDriver.getTransactions).mockReturnValue(mockTransactions);

    const result = await testHandler.execute();

    // 今月の取引のみ: 50000 / 2 = 25000
    expect(result).toContain('👨 25,000円');
    expect(result).toContain('👩 25,000円');
  });

  it('should throw error when rakuten card is not found', async () => {
    const mockAccounts: ZaimAccount[] = [
      {
        id: 12345,
        name: 'その他のカード',
        active: 1
      }
    ];

    vi.mocked(mockZaimApiDriver.getAccounts).mockReturnValue(mockAccounts);
    vi.mocked(mockZaimApiDriver.getTransactions).mockReturnValue([]);

    await expect(testHandler.execute()).rejects.toThrow('Active Rakuten Card not found');
  });

  it('should handle zero transactions', async () => {
    const mockAccounts: ZaimAccount[] = [
      {
        id: 20669558,
        name: '楽天カード',
        active: 1
      }
    ];

    const mockTransactions: ZaimTransaction[] = [];

    vi.mocked(mockZaimApiDriver.getAccounts).mockReturnValue(mockAccounts);
    vi.mocked(mockZaimApiDriver.getTransactions).mockReturnValue(mockTransactions);

    const result = await testHandler.execute();

    expect(result).toContain('👨 0円');
    expect(result).toContain('👩 0円');
  });
});
