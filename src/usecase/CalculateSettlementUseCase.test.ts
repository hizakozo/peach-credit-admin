import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalculateSettlementUseCase } from './CalculateSettlementUseCase';
import { IAdvancePaymentRepository } from '../domain/repository/IAdvancePaymentRepository';
import { AdvancePayment } from '../domain/model/AdvancePayment';
import { Money } from '../domain/model/Money';
import { Payer } from '../domain/model/Payer';

describe('CalculateSettlementUseCase', () => {
  let useCase: CalculateSettlementUseCase;
  let mockRepository: IAdvancePaymentRepository;

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      findByYearMonth: vi.fn(),
      findByDateRange: vi.fn(),
      add: vi.fn(),
      delete: vi.fn(),
    };

    useCase = new CalculateSettlementUseCase(mockRepository);
  });

  it('should calculate settlement when husband paid more', () => {
    const payments = [
      new AdvancePayment('1', new Date('2025-10-15'), Payer.HUSBAND, new Money(3000), 'ランチ'),
      new AdvancePayment('2', new Date('2025-10-16'), Payer.WIFE, new Money(1000), '交通費'),
    ];

    vi.mocked(mockRepository.findByYearMonth).mockReturnValue(payments);

    const result = useCase.execute(2025, 10);

    expect(result.husbandTotal.equals(new Money(3000))).toBe(true);
    expect(result.wifeTotal.equals(new Money(1000))).toBe(true);
    expect(result.settlementAmount.equals(new Money(2000))).toBe(true);
    expect(result.settlementPayer?.equals(Payer.WIFE)).toBe(true); // 妻が夫に払う
  });

  it('should calculate settlement when wife paid more', () => {
    const payments = [
      new AdvancePayment('1', new Date('2025-10-15'), Payer.HUSBAND, new Money(1000), 'ランチ'),
      new AdvancePayment('2', new Date('2025-10-16'), Payer.WIFE, new Money(5000), '買い物'),
    ];

    vi.mocked(mockRepository.findByYearMonth).mockReturnValue(payments);

    const result = useCase.execute(2025, 10);

    expect(result.husbandTotal.equals(new Money(1000))).toBe(true);
    expect(result.wifeTotal.equals(new Money(5000))).toBe(true);
    expect(result.settlementAmount.equals(new Money(4000))).toBe(true);
    expect(result.settlementPayer?.equals(Payer.HUSBAND)).toBe(true); // 夫が妻に払う
  });

  it('should handle equal payments', () => {
    const payments = [
      new AdvancePayment('1', new Date('2025-10-15'), Payer.HUSBAND, new Money(2000), 'ランチ'),
      new AdvancePayment('2', new Date('2025-10-16'), Payer.WIFE, new Money(2000), '交通費'),
    ];

    vi.mocked(mockRepository.findByYearMonth).mockReturnValue(payments);

    const result = useCase.execute(2025, 10);

    expect(result.husbandTotal.equals(new Money(2000))).toBe(true);
    expect(result.wifeTotal.equals(new Money(2000))).toBe(true);
    expect(result.settlementAmount.equals(new Money(0))).toBe(true);
    expect(result.settlementPayer).toBe(null); // 差額なし
  });

  it('should handle no payments', () => {
    vi.mocked(mockRepository.findByYearMonth).mockReturnValue([]);

    const result = useCase.execute(2025, 10);

    expect(result.husbandTotal.equals(new Money(0))).toBe(true);
    expect(result.wifeTotal.equals(new Money(0))).toBe(true);
    expect(result.settlementAmount.equals(new Money(0))).toBe(true);
    expect(result.settlementPayer).toBe(null);
  });

  it('should sum multiple payments correctly', () => {
    const payments = [
      new AdvancePayment('1', new Date('2025-10-15'), Payer.HUSBAND, new Money(1000), 'ランチ1'),
      new AdvancePayment('2', new Date('2025-10-16'), Payer.HUSBAND, new Money(2000), 'ランチ2'),
      new AdvancePayment('3', new Date('2025-10-17'), Payer.WIFE, new Money(1500), '交通費1'),
      new AdvancePayment('4', new Date('2025-10-18'), Payer.WIFE, new Money(500), '交通費2'),
    ];

    vi.mocked(mockRepository.findByYearMonth).mockReturnValue(payments);

    const result = useCase.execute(2025, 10);

    expect(result.husbandTotal.equals(new Money(3000))).toBe(true);
    expect(result.wifeTotal.equals(new Money(2000))).toBe(true);
    expect(result.settlementAmount.equals(new Money(1000))).toBe(true);
    expect(result.settlementPayer?.equals(Payer.WIFE)).toBe(true);
  });
});
