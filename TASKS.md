# 家計管理自動化システム 実装タスク

## 概要

本ドキュメントでは、CLAUDE.mdに記載された仕様に基づく実装タスクをフェーズ別に整理します。

**優先度の定義:**
- **P0**: MVP必須（最小限の動作に必要）
- **P1**: コア機能（基本的な使用に必要）
- **P2**: 改善・拡張（将来的な拡張や運用改善）

## 実装方針

1. **ボトムアップアプローチ**: Domain層から実装し、外側の層に向かって進める
2. **MVP First**: P0タスクを優先し、早期に動作確認できる状態を目指す
3. **段階的拡張**: 基本機能が動作したら、P1、P2と段階的に機能追加

---

## フェーズ0: 開発環境セットアップ【P0】

### 目的
ローカル開発環境を構築し、GASへのデプロイを可能にする

### タスク

1. **プロジェクト初期化**
   - `npm init`でpackage.json作成
   - TypeScript設定（tsconfig.json）
   - clasp設定（.clasp.json）
   - gitignore設定

2. **clasp環境構築**
   - `clasp login`でGoogleアカウント認証
   - 新規GASプロジェクト作成 or 既存プロジェクトクローン
   - `clasp push`の動作確認

3. **Google Sheets準備**
   - 建て替えデータシートの作成
   - 計算結果シートの作成
   - シートIDの取得と環境変数化

4. **ディレクトリ構造作成**
   - src/domain, usecase, gateway, driver, presentationディレクトリ作成
   - 各ディレクトリに.gitkeepまたはREADME配置

---

## フェーズ1: コアドメイン実装【P0 - MVP】

### 目的
ビジネスロジックの中核となるドメイン層を実装

### タスク

1. **共通値オブジェクト実装**
   - Money（金額）クラス
   - YearMonth（年月）クラス
   - Description（説明）クラス
   - PayerType（負担者種別）クラス

2. **Reimbursement集約実装**
   - Reimbursementエンティティ
   - ReimbursementIdクラス
   - 不変条件のバリデーション

3. **MonthlySettlement集約実装**
   - MonthlySettlementエンティティ
   - ReimbursementSummary（建て替え集計）クラス
   - 不変条件のバリデーション

4. **ドメインサービス実装**
   - SettlementCalculator（精算計算サービス）
   - 計算ロジックの実装とテスト

5. **Repositoryインターフェース定義**
   - IReimbursementRepository
   - IMonthlySettlementRepository

---

## フェーズ2: インフラ層実装【P0】

### 目的
外部システムとの接続とデータ永続化の基盤を構築

### タスク

1. **SpreadsheetDriver実装**
   - Google Sheetsへの基本アクセス機能
   - 行の読み書き、範囲取得
   - データ型変換ユーティリティ

2. **ReimbursementRepositoryImpl実装**
   - SpreadsheetDriverを使用した実装
   - エンティティ ↔ シート行の変換
   - CRUD操作の実装

3. **MonthlySettlementRepositoryImpl実装**
   - SpreadsheetDriverを使用した実装
   - エンティティ ↔ シート行の変換
   - 保存・取得操作の実装

---

## フェーズ3: UseCase層実装【P0/P1】

### 目的
アプリケーションのユースケースを実装

### タスク（P0: MVP必須）

1. **CreateReimbursementUseCase実装**
   - 建て替え記録作成ロジック
   - バリデーションとエラーハンドリング

2. **DeleteReimbursementUseCase実装**
   - 建て替え記録削除ロジック

3. **GetReimbursementsUseCase実装**
   - 月別建て替え一覧取得
   - DTO変換

4. **ExecuteMonthlySettlementUseCase実装（仮実装）**
   - クレカデータを固定値で仮実装
   - 精算計算の実行と保存

### タスク（P1: コア機能）

5. **GetMonthlySettlementUseCase実装**
   - 精算結果取得
   - DTO変換

6. **SendReminderNotificationUseCase実装（仮実装）**
   - メッセージ生成ロジック
   - 送信部分は後で実装

7. **SendSettlementNotificationUseCase実装（仮実装）**
   - メッセージ生成ロジック
   - 送信部分は後で実装

---

## フェーズ4: Presentation層実装【P0/P1】

### 目的
ユーザーインターフェースとスケジューラーを実装

### タスク（P0: MVP必須）

1. **ReimbursementController実装**
   - GAS doGet()エンドポイント
   - HTML画面の表示
   - 建て替え記録のCRUD操作APIエンドポイント

2. **HTML画面実装**
   - 建て替えデータ入力フォーム
   - データ一覧表示
   - 削除ボタン
   - 月選択機能

### タスク（P1: コア機能）

3. **SettlementScheduler実装**
   - 25日トリガーの設定
   - ExecuteMonthlySettlementUseCaseの呼び出し
   - エラーハンドリングとログ

4. **ReminderScheduler実装**
   - 21日トリガーの設定
   - SendReminderNotificationUseCaseの呼び出し
   - エラーハンドリングとログ

---

## フェーズ5: 外部API連携【P1】

### 目的
Zaim APIとLINE Messaging APIとの連携を実装

### タスク

1. **ZaimApiDriver実装**
   - Zaim API認証処理
   - クレジットカード明細取得API
   - レスポンスパース処理
   - エラーハンドリングとリトライ

2. **LineMessagingDriver実装**
   - LINE Messaging API認証
   - メッセージ送信API
   - エラーハンドリング

3. **ExecuteMonthlySettlementUseCaseの完全実装**
   - ZaimApiDriverを使用したクレカデータ取得
   - 仮実装部分を本実装に置き換え

4. **通知UseCaseの完全実装**
   - LineMessagingDriverを使用したメッセージ送信
   - SendReminderNotificationUseCaseの完全実装
   - SendSettlementNotificationUseCaseの完全実装

5. **外部API設定**
   - Zaim APIキーの取得と設定
   - LINE Messaging APIトークンの取得と設定
   - Script Propertiesへの保存

---

## フェーズ6: テスト・デプロイ【P0/P1】

### 目的
品質を確保し、本番環境へデプロイ

### タスク（P0: MVP必須）

1. **手動テスト**
   - 建て替え記録のCRUD操作確認
   - 精算計算の正確性確認
   - HTML画面の動作確認

2. **初回デプロイ**
   - `clasp push`で本番環境にデプロイ
   - トリガー設定（21日、25日）
   - 動作確認

### タスク（P1: コア機能）

3. **統合テスト**
   - Zaim API連携の動作確認
   - LINE通知の送信確認
   - スケジューラーの動作確認

4. **エラーケーステスト**
   - 不正な入力データの処理確認
   - API障害時の挙動確認
   - リトライ処理の確認

---

## フェーズ7: 改善・拡張【P2】

### 目的
運用性の向上と将来的な拡張に備える

### タスク

1. **ロギング機能追加**
   - 実行ログの記録
   - エラーログの記録
   - Google Sheetsへのログ出力

2. **ドメインイベント実装**
   - MonthlySettlementCalculatedイベント
   - ReimbursementCreatedイベント
   - イベントハンドラの実装

3. **再計算機能の実装**
   - 過去月の精算を再計算するUseCase
   - HTML画面に再計算ボタン追加

4. **監視・アラート機能**
   - スケジューラー失敗時のメール通知
   - 異常値検知（金額が極端に大きい等）

5. **ユニットテスト追加**
   - Domain層の単体テスト
   - ドメインサービスのテスト
   - 値オブジェクトのテスト

6. **ドキュメント整備**
   - 運用マニュアル作成
   - トラブルシューティングガイド
   - APIドキュメント

---

## 実装順序の推奨

### ステップ1: 基本機能の実装（P0タスク）
1. フェーズ0: 開発環境セットアップ
2. フェーズ1: コアドメイン実装
3. フェーズ2: インフラ層実装
4. フェーズ3: UseCase層実装（P0のみ）
5. フェーズ4: Presentation層実装（P0のみ）
6. フェーズ6: テスト・デプロイ（P0のみ）

**この時点でMVP完成: 手動でクレカデータを入力すれば精算計算が可能**

### ステップ2: 自動化機能の追加（P1タスク）
1. フェーズ3: UseCase層実装（P1）
2. フェーズ4: Presentation層実装（P1）
3. フェーズ5: 外部API連携
4. フェーズ6: テスト・デプロイ（P1）

**この時点で完全自動化: Zaim連携、LINE通知が動作**

### ステップ3: 改善・拡張（P2タスク）
1. フェーズ7: 改善・拡張

**運用性向上、将来の拡張に備える**

---

## 進捗管理

各タスクの状態を以下で管理：
- [ ] 未着手
- [進行中] 実装中
- [完了] 実装完了
- [保留] 後回し

現在の状態: すべて未着手
