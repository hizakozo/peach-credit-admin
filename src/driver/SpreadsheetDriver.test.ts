import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpreadsheetDriver, SpreadsheetRow } from './SpreadsheetDriver';

// Mock GAS globals
const mockSheet = {
  getLastRow: vi.fn(),
  getRange: vi.fn(),
  appendRow: vi.fn(),
  deleteRow: vi.fn(),
  getSheetByName: vi.fn(),
  insertSheet: vi.fn(),
  setFontWeight: vi.fn(),
};

const mockSpreadsheet = {
  getSheetByName: vi.fn(),
  insertSheet: vi.fn(),
};

global.SpreadsheetApp = {
  openById: vi.fn().mockReturnValue(mockSpreadsheet),
} as any;

const mockGetProperty = vi.fn().mockReturnValue('test-spreadsheet-id');

global.PropertiesService = {
  getScriptProperties: vi.fn().mockReturnValue({
    getProperty: mockGetProperty,
  }),
} as any;

describe('SpreadsheetDriver', () => {
  let driver: SpreadsheetDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProperty.mockReturnValue('test-spreadsheet-id');
    mockSpreadsheet.getSheetByName.mockReturnValue(mockSheet);
    driver = new SpreadsheetDriver();
  });

  describe('constructor', () => {
    it('should throw error if SPREADSHEET_ID is not set', () => {
      mockGetProperty.mockReturnValue('');
      expect(() => new SpreadsheetDriver()).toThrow('SPREADSHEET_ID is not set in script properties');
    });
  });

  describe('getAllRows', () => {
    it('should return empty array when sheet has no data', () => {
      mockSheet.getLastRow.mockReturnValue(1); // ヘッダーのみ

      const rows = driver.getAllRows();

      expect(rows).toEqual([]);
    });

    it('should return all rows', () => {
      mockSheet.getLastRow.mockReturnValue(3); // ヘッダー + 2行
      mockSheet.getRange.mockReturnValue({
        getValues: vi.fn().mockReturnValue([
          ['1', '2025-10-15', '夫', 1000, 'ランチ代', '2025-10-15T10:00:00Z'],
          ['2', '2025-10-16', '妻', 2000, '交通費', '2025-10-16T11:00:00Z'],
        ]),
      });

      const rows = driver.getAllRows();

      expect(rows).toEqual([
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
      ]);
    });
  });

  describe('appendRow', () => {
    it('should append row to sheet', () => {
      const row: SpreadsheetRow = {
        id: '1',
        date: '2025-10-15',
        payer: '夫',
        amount: 1000,
        memo: 'ランチ代',
        createdAt: '2025-10-15T10:00:00Z',
      };

      driver.appendRow(row);

      expect(mockSheet.appendRow).toHaveBeenCalledWith([
        '1',
        '2025-10-15',
        '夫',
        1000,
        'ランチ代',
        '2025-10-15T10:00:00Z',
      ]);
    });
  });

  describe('deleteRowById', () => {
    it('should delete row by id', () => {
      mockSheet.getLastRow.mockReturnValue(3); // ヘッダー + 2行
      mockSheet.getRange.mockReturnValue({
        getValues: vi.fn().mockReturnValue([['1'], ['2']]),
      });

      driver.deleteRowById('2');

      expect(mockSheet.deleteRow).toHaveBeenCalledWith(3); // 2行目 (0-indexed: 2, + header: 3)
    });

    it('should do nothing if id not found', () => {
      mockSheet.getLastRow.mockReturnValue(3);
      mockSheet.getRange.mockReturnValue({
        getValues: vi.fn().mockReturnValue([['1'], ['2']]),
      });

      driver.deleteRowById('999');

      expect(mockSheet.deleteRow).not.toHaveBeenCalled();
    });

    it('should do nothing if sheet has no data', () => {
      mockSheet.getLastRow.mockReturnValue(1); // ヘッダーのみ

      driver.deleteRowById('1');

      expect(mockSheet.deleteRow).not.toHaveBeenCalled();
    });
  });
});
