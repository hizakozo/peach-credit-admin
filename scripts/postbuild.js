/**
 * ビルド後処理スクリプト
 * GASAppオブジェクトの関数をグローバルスコープに公開
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../gas-dist/main.js');
const content = fs.readFileSync(filePath, 'utf-8');

// グローバル関数を追加
const globalFunctions = `
// Export GasApp functions to global scope for GAS
var doGet = GasApp.doGet;
var doPost = GasApp.doPost;
var testHandleZaimMessage = GasApp.testHandleZaimMessage;
var setupSpreadsheetId = GasApp.setupSpreadsheetId;
var setupWebAppUrl = GasApp.setupWebAppUrl;
var getPayments = GasApp.getPayments;
var getSettlement = GasApp.getSettlement;
var addPayment = GasApp.addPayment;
var deletePayment = GasApp.deletePayment;
`;

const newContent = content + globalFunctions;
fs.writeFileSync(filePath, newContent, 'utf-8');

console.log('✓ Global functions added to gas-dist/main.js');
