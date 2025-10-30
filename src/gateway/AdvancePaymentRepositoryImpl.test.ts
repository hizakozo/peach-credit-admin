import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdvancePaymentRepositoryImpl } from './AdvancePaymentRepositoryImpl';
import { SpreadsheetDriver, SpreadsheetRow } from '../driver/SpreadsheetDriver';
import { AdvancePayment } from '../domain/model/AdvancePayment';
import { Money } from '../domain/model/Money';
import { Payer } from '../domain/model/Payer';

describe('AdvancePaymentRepositoryImpl', () => {
  let repository: AdvancePaymentRepositoryImpl;
  let mockSpreadsheetDriver: SpreadsheetDriver;

  beforeEach(() => {
    mockSpreadsheetDriver = {
      getAllRows: vi.fn(),
      appendRow: vi.fn(),
      deleteRowById: vi.fn(),
    } as any;

    repository = new AdvancePaymentRepositoryImpl(mockSpreadsheetDriver);
  });

  describe('findAll', () => {
    it('should return empty array when no data', () => {
      vi.mocked(mockSpreadsheetDriver.getAllRows).mockReturnValue([]);

      const result = repository.findAll();

      expect(result).toEqual([]);
    });

    it('should return all advance payments', () => {
      const mockRows: SpreadsheetRow[] = [
        {
          id: '1',
          date: '2025-10-15',
          payer: '夫',
          amount: 1000,
          memo: 'ランチ代',
          createdAt: '2025-10-15T10:00:00Z',
        },
        {
          id: '2',
          date: '2025-10-16',
          payer: '妻',
          amount: 2000,
          memo: '交通費',
          createdAt: '2025-10-16T11:00:00Z',
        },
      ];

      vi.mocked(mockSpreadsheetDriver.getAllRows).mockReturnValue(mockRows);

      const result = repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].getId()).toBe('1');
      expect(result[0].getPayer().equals(Payer.HUSBAND)).toBe(true);
      expect(result[0].getAmount().equals(new Money(1000))).toBe(true);
      expect(result[1].getId()).toBe('2');
      expect(result[1].getPayer().equals(Payer.WIFE)).toBe(true);
    });
  });

  describe('findByYearMonth', () => {
    it('should return payments for specified year and month', () => {
      const mockRows: SpreadsheetRow[] = [
        {
          id: '1',
          date: '2025-10-15',
          payer: '夫',
          amount: 1000,
          memo: 'ランチ代',
          createdAt: '2025-10-15T10:00:00Z',
        },
        {
          id: '2',
          date: '2025-11-16',
          payer: '妻',
          amount: 2000,
          memo: '交通費',
          createdAt: '2025-11-16T11:00:00Z',
        },
        {
          id: '3',
          date: '2025-10-20',
          payer: '夫',
          amount: 3000,
          memo: '食費',
          createdAt: '2025-10-20T12:00:00Z',
        },
      ];

      vi.mocked(mockSpreadsheetDriver.getAllRows).mockReturnValue(mockRows);

      const result = repository.findByYearMonth(2025, 10);

      expect(result).toHaveLength(2);
      expect(result[0].getId()).toBe('1');
      expect(result[1].getId()).toBe('3');
    });
  });

  describe('add', () => {
    it('should add advance payment to spreadsheet', () => {
      const payment = new AdvancePayment(
        '1',
        new Date('2025-10-15'),
        Payer.HUSBAND,
        new Money(1000),
        'ランチ代'
      );

      repository.add(payment);

      expect(mockSpreadsheetDriver.appendRow).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          date: '2025-10-15',
          payer: '夫',
          amount: 1000,
          memo: 'ランチ代',
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete advance payment by id', () => {
      repository.delete('1');

      expect(mockSpreadsheetDriver.deleteRowById).toHaveBeenCalledWith('1');
    });
  });
});
