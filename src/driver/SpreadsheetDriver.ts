/**
 * Spreadsheet データ行
 */
export interface SpreadsheetRow {
  id: string;
  date: string; // YYYY-MM-DD
  payer: string; // 夫 or 妻
  amount: number;
  memo: string;
  createdAt: string; // ISO 8601
}

/**
 * Google Spreadsheet へのアクセスを提供するDriver
 */
export class SpreadsheetDriver {
  private readonly spreadsheetId: string;
  private readonly sheetName: string = 'AdvancePayments';

  constructor() {
    this.spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '';
    if (!this.spreadsheetId) {
      throw new Error('SPREADSHEET_ID is not set in script properties');
    }
  }

  /**
   * シートを取得（存在しない場合は作成）
   */
  private getOrCreateSheet(): GoogleAppsScript.Spreadsheet.Sheet {
    const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
    let sheet = spreadsheet.getSheetByName(this.sheetName);

    if (!sheet) {
      // シートが存在しない場合は作成してヘッダーを設定
      sheet = spreadsheet.insertSheet(this.sheetName);
      sheet.appendRow(['ID', 'Date', 'Payer', 'Amount', 'Memo', 'CreatedAt']);
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    }

    return sheet;
  }

  /**
   * 全ての行を取得
   */
  getAllRows(): SpreadsheetRow[] {
    const sheet = this.getOrCreateSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      // ヘッダーのみ、またはデータなし
      return [];
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

    return data.map((row) => ({
      id: String(row[0]),
      date: String(row[1]),
      payer: String(row[2]),
      amount: Number(row[3]),
      memo: String(row[4]),
      createdAt: String(row[5]),
    }));
  }

  /**
   * 行を追加
   */
  appendRow(row: SpreadsheetRow): void {
    const sheet = this.getOrCreateSheet();
    sheet.appendRow([
      row.id,
      row.date,
      row.payer,
      row.amount,
      row.memo,
      row.createdAt,
    ]);
  }

  /**
   * 指定されたIDの行を削除
   */
  deleteRowById(id: string): void {
    const sheet = this.getOrCreateSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return; // データなし
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        sheet.deleteRow(i + 2); // ヘッダー行の分+1、0-indexedの分+1
        return;
      }
    }
  }
}
