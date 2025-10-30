/**
 * ビルド後処理スクリプト
 * IIFEの戻り値から関数を抽出してグローバルスコープに公開（GAS用）
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../gas-dist/main.js');
let content = fs.readFileSync(filePath, 'utf-8');

// IIFE の最後を修正: void 0 を this に置き換え
content = content.replace(/\}\)\(void 0\);/, '})(this);');

// 追加のグローバル関数定義
const globalFunctions = `
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
`;

const newContent = content + globalFunctions;
fs.writeFileSync(filePath, newContent, 'utf-8');

console.log('✓ Global functions added to gas-dist/main.js');
