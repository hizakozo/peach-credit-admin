# 重要
全ての応答は日本語で行ってください。
実装後は　npm run check でコンパイル確認してエラーを解消してください。
その後は npm run deploy:gas　でデプロイしてください

# 家計管理自動化システム 仕様書

## 概要

夫婦の共有クレジットカード（楽天カード）とその他建て替え費用の割り勘計算を自動化するシステム

## ユーザーストーリー

### US-1: 建て替え分入力催促

- **As** ユーザー
- **I want** 毎月21日にLINEで建て替え分入力の催促を受ける
- **So that** 入力を忘れることなく、期限内にデータを登録できる

### US-2: 建て替え分入力

- **As** ユーザー
- **I want** HTML画面で建て替え分を入力・管理できる
- **So that** 簡単にデータを登録・確認・削除できる

### US-3: 月次計算・通知

- **As** ユーザー
- **I want** 毎月25日に自分の支払い分をLINEで受け取る
- **So that** 支払い金額を即座に確認できる

## 機能要件

### F-1: スケジュール機能

- 毎月21日 9:00にユーザーへLINE催促送信
- 毎月25日 9:00に計算実行＆ユーザーへLINE通知送信

### F-2: HTML管理画面

#### F-2-1: 表示機能

- 月選択（デフォルト：今月）
- 選択月の建て替えデータ一覧表示
- 月合計金額表示

#### F-2-2: 入力機能

- 日付、金額、内容、負担者（夫/妻/共通）の入力
- 入力後の即座反映
- フォームのクリア

#### F-2-3: 削除機能

- 各レコードの削除ボタン
- 削除後の即座反映

### F-3: 計算機能

#### F-3-1: データ取得

- Zaim APIから楽天カード明細取得（前月分）
- スプレッドシートから建て替えデータ取得（前月分）

#### F-3-2: 割り勘計算

- クレカ明細の50%をユーザー負担分として計算
- 建て替え分の負担者別集計
- 最終的なユーザー支払い金額算出

### F-4: LINE通知機能

- **21日**: 催促メッセージ + HTML画面URL
- **25日**: 支払い金額の詳細通知

## 技術要件

### システム構成

- **フロントエンド**: Google Apps Script HTML Service
- **バックエンド**: Google Apps Script
- **データベース**: Google Sheets
- **外部API**: Zaim API, LINE Messaging API
- **スケジューラー**: GAS Time-driven triggers

### 開発環境

#### clasp（Command Line Apps Script Projects）

ローカル開発環境でTypeScript/JavaScriptを使用してGASを開発・デプロイする

**必須コマンド:**

```bash
# claspのインストール
npm install -g @google/clasp

# Googleアカウントでログイン
clasp login

# 既存のGASプロジェクトをクローン
clasp clone <scriptId>

# 新規プロジェクトを作成
clasp create --type standalone --title "家計管理システム"

# ローカルの変更をGASにプッシュ
clasp push

# GASの変更をローカルにプル
clasp pull

# GASエディタをブラウザで開く
clasp open

# デプロイを作成
clasp deploy
```

### データ構造

#### 建て替えデータシート

| 年月 | 日付 | 金額 | 内容 | 負担者 | 作成日時 |
|---|---|---|---|---|---|
| 2024-10 | 15 | 2000 | 水道代 | 共通 | 2024-10-15 10:30 |
| 2024-10 | 16 | 3000 | 電気代 | 夫 | 2024-10-16 11:00 |
| 2024-10 | 17 | 1500 | ガス代 | 妻 | 2024-10-17 09:30 |

#### 計算結果シート

| 年月 | クレカ合計 | 建て替え(夫) | 建て替え(妻) | 建て替え(共通) | 妻支払額 | 計算日時 |
|---|---|---|---|---|---|---|
| 2024-09 | 80000 | 5000 | 3000 | 4000 | 43000 | 2024-10-25 09:00 |
| 2024-08 | 75000 | 4000 | 2000 | 3500 | 40250 | 2024-09-25 09:00 |

### LINEメッセージフォーマット

#### 21日の催促メッセージ

```
💰 建て替え費用の入力リマインダー

今月分の建て替え費用を登録してね！

👉 入力はこちらから
[HTML画面のURL]

※24日までに入力をお願いします
```

#### 25日の計算結果通知メッセージ

```
💳 今月の支払い金額が確定しました

【2024年9月支払い分】

カード合計: 80,000円

👨 40,000円
👩 40,000円

詳しい内訳は管理画面で確認できます
👉 [HTML画面のURL]
```

## DDD設計

### 設計方針

- **言語**: TypeScript
- **アーキテクチャ**: ドメイン駆動設計（DDD）+ Clean Architectureを適用
- **精算の変更**: 月次精算は再計算可能（過去月も建て替えデータの変更に応じて再計算）
- **層分離**: Domain/UseCase/Gateway/Driver/Presentationの5層アーキテクチャ

### 依存性ルール

各層は以下の方向にのみ依存できる（依存性逆転の原則に従う）：

```
Presentation層 → UseCase層 → Domain層
                    ↓          ↑
               Gateway層 → (interface)
                    ↓
                Driver層
```

**ルール:**
- Domain層は他の層に依存しない（最も内側、ビジネスロジックのコア）
- UseCase層はDomain層にのみ依存（Repositoryはinterfaceを通じて使用）
- Gateway層はDomain層のRepositoryインターフェースを実装し、Driver層を使用
- Driver層はどの層にも依存しない（外部システムとの通信のみ）
- Presentation層はUseCase層を呼び出す（Gateway/Driver層を直接呼ばない）

### ディレクトリ構造

```
src/
├── domain/              # ドメイン層（ビジネスロジック）
│   ├── model/
│   │   ├── monthly-settlement/    # 月次精算集約
│   │   │   ├── MonthlySettlement.ts
│   │   │   ├── ReimbursementSummary.ts
│   │   │   └── SettlementStatus.ts
│   │   ├── reimbursement/         # 建て替え記録集約
│   │   │   ├── Reimbursement.ts
│   │   │   ├── ReimbursementId.ts
│   │   │   └── PayerType.ts
│   │   └── shared/                # 共通値オブジェクト
│   │       ├── Money.ts
│   │       ├── YearMonth.ts
│   │       └── Description.ts
│   ├── service/                   # ドメインサービス
│   │   └── SettlementCalculator.ts
│   └── repository/                # リポジトリインターフェース
│       ├── IReimbursementRepository.ts
│       └── IMonthlySettlementRepository.ts
├── usecase/             # ユースケース層（アプリケーションロジック）
│   ├── CreateReimbursementUseCase.ts
│   ├── DeleteReimbursementUseCase.ts
│   ├── GetReimbursementsUseCase.ts
│   ├── ExecuteMonthlySettlementUseCase.ts
│   ├── GetMonthlySettlementUseCase.ts
│   ├── SendReminderNotificationUseCase.ts
│   └── SendSettlementNotificationUseCase.ts
├── gateway/             # ゲートウェイ層（リポジトリ実装）
│   ├── ReimbursementRepositoryImpl.ts
│   └── MonthlySettlementRepositoryImpl.ts
├── driver/              # ドライバー層（外部システム連携）
│   ├── SpreadsheetDriver.ts       # Google Sheets操作
│   ├── ZaimApiDriver.ts           # Zaim API連携
│   └── LineMessagingDriver.ts     # LINE Messaging API連携
└── presentation/        # プレゼンテーション層（エントリーポイント）
    ├── ReimbursementController.ts # HTML画面用コントローラー
    ├── ReminderScheduler.ts       # 21日催促トリガー
    └── SettlementScheduler.ts     # 25日精算トリガー
```

### 集約（Aggregate）

#### 1. MonthlySettlement（月次精算）集約

**責務:**
- 特定月の夫婦間費用精算を計算・管理する
- クレジットカード利用額と建て替え費用から各人の支払額を算出する

**集約ルート:** MonthlySettlement

**構成要素:**
- 対象年月（YearMonth）
- クレジットカード合計額（Money）
- 建て替え費用集計（ReimbursementSummary）
  - 夫負担分
  - 妻負担分
  - 共通負担分
- 夫支払額（Money）
- 妻支払額（Money）
- 計算日時

**不変条件（Invariants）:**
- 夫支払額 + 妻支払額 = クレジットカード合計 + 全建て替え合計
- クレジットカードは夫婦で50%ずつ負担
- 共通負担分は夫婦で50%ずつ分割

**主要操作:**
- `create()` - 新規精算の作成（計算実行）
- `recalculate()` - 精算の再計算（建て替えデータ変更時）

#### 2. Reimbursement（建て替え記録）集約

**責務:**
- 個別の建て替え費用を記録・管理する
- 負担者の種別を保持し、精算計算に必要な情報を提供する

**集約ルート:** Reimbursement

**構成要素:**
- ID（ReimbursementId）
- 年月（YearMonth）
- 日付（1-31）
- 金額（Money）
- 内容説明（Description）
- 負担者種別（PayerType：夫/妻/共通）
- 作成日時

**不変条件:**
- 金額は正の数（0より大きい）
- 負担者は「夫」「妻」「共通」のいずれか
- 日付は1-31の範囲内で年月と整合性がある

**主要操作:**
- `create()` - 新規建て替え記録の作成
- `delete()` - 建て替え記録の削除

### 値オブジェクト（Value Object）

#### Money（金額）
- 金額と通貨（日本円）を表現
- 加算、乗算、50%計算などの演算メソッドを提供
- 負の値を許可しない

#### YearMonth（年月）
- YYYY-MM形式の年月を表現
- 前月取得、年月の比較などのメソッドを提供
- フォーマットのバリデーション

#### PayerType（負担者種別）
- 「夫」「妻」「共通」の3種類
- 各種別の負担割合（夫:妻）を保持
  - 夫: 100:0
  - 妻: 0:100
  - 共通: 50:50
- 金額を夫婦の負担額に分割する計算ロジックを内包

#### Description（内容説明）
- 建て替え内容を表すテキスト
- 空文字を許可しない

#### ReimbursementId
- 建て替え記録の一意識別子
- UUID等で自動生成

#### ReimbursementSummary（建て替え集計）
- 複数の建て替え記録を集計した結果
- 夫負担分、妻負担分、共通負担分の合計額を保持

### ドメインサービス（Domain Service）

#### SettlementCalculator（精算計算サービス）

**責務:**
- クレジットカード合計と建て替え集計から、夫婦それぞれの最終支払額を計算する
- 複雑な計算ロジックを集約の外に切り出し

**計算ロジック:**
1. クレジットカード合計を50%ずつに分割
2. 建て替え費用を負担者別に集計
3. 共通負担分を50%ずつに分割
4. 夫支払額 = クレカ50% + 夫負担分 + 共通50%
5. 妻支払額 = クレカ50% + 妻負担分 + 共通50%

### ユースケース層（UseCase）

#### CreateReimbursementUseCase（建て替え記録作成）
- 入力パラメータから建て替え記録エンティティを生成
- リポジトリを通じて永続化
- 作成結果を返却

#### DeleteReimbursementUseCase（建て替え記録削除）
- IDを受け取り建て替え記録を削除
- リポジトリを通じて削除実行

#### GetReimbursementsUseCase（建て替え記録取得）
- 年月を指定して建て替え記録一覧を取得
- DTO形式で返却

#### ExecuteMonthlySettlementUseCase（月次精算実行）
- 対象年月のクレジットカードデータをZaim APIから取得
- 建て替え記録をリポジトリから取得
- MonthlySettlement集約を生成して計算実行
- 計算結果を永続化

#### GetMonthlySettlementUseCase（精算結果取得）
- 年月を指定して精算結果を取得
- DTO形式で返却

#### SendReminderNotificationUseCase（催促通知送信）
- LINE催促メッセージを生成
- LINE Messaging APIを通じて送信

#### SendSettlementNotificationUseCase（精算結果通知送信）
- 精算結果からLINE通知メッセージを生成
- 夫婦それぞれの支払額を含む通知を送信

### リポジトリ（Repository）

#### IReimbursementRepository（インターフェース）
- `save(reimbursement)` - 建て替え記録の保存
- `delete(id)` - 建て替え記録の削除
- `findByYearMonth(yearMonth)` - 年月で検索
- `findAll()` - 全件取得

#### IMonthlySettlementRepository（インターフェース）
- `save(settlement)` - 精算結果の保存
- `findByYearMonth(yearMonth)` - 年月で検索
- `findAll()` - 全履歴取得

### ゲートウェイ層（Gateway）

リポジトリインターフェースの実装を提供し、ドメイン層とDriver層を仲介する

#### ReimbursementRepositoryImpl
- IReimbursementRepositoryインターフェースの実装
- SpreadsheetDriverを使用して建て替えデータシートにアクセス
- ドメインエンティティとシート行データの相互変換
- ドメイン層への依存性を持たない形でデータ永続化

#### MonthlySettlementRepositoryImpl
- IMonthlySettlementRepositoryインターフェースの実装
- SpreadsheetDriverを使用して計算結果シートにアクセス
- ドメインエンティティとシート行データの相互変換
- 精算履歴の保存と取得

### ドライバー層（Driver）

外部システムやインフラストラクチャとの具体的な通信を担当

#### SpreadsheetDriver
- Google Sheetsへの低レベルアクセスを提供
- シート操作の共通ユーティリティ
- 行の読み書き、範囲指定取得、フィルタリング
- SpreadsheetAppのラッパーとして機能

#### ZaimApiDriver
- Zaim APIとのHTTP通信
- 認証処理（OAuth等）
- 楽天カード明細の取得
- レスポンスのパース処理
- エラーハンドリングとリトライ

#### LineMessagingDriver
- LINE Messaging APIとのHTTP通信
- メッセージ送信API呼び出し
- 送信結果の検証
- エラーハンドリング

### プレゼンテーション層（Presentation）

外部からの入力を受け付け、適切なUseCaseを呼び出す最終エントリーポイント

#### ReimbursementController
- GAS HTML Serviceからのリクエストを受付
- CreateReimbursementUseCaseで建て替え記録を作成
- DeleteReimbursementUseCaseで建て替え記録を削除
- GetReimbursementsUseCaseで一覧を取得してHTMLに返却
- レスポンスJSON生成とエラーハンドリング

#### ReminderScheduler
- GAS Time-driven triggerで毎月21日 9:00に起動
- SendReminderNotificationUseCaseを呼び出し
- LINE催促メッセージ送信を実行
- 実行ログの記録

#### SettlementScheduler
- GAS Time-driven triggerで毎月25日 9:00に起動
- ExecuteMonthlySettlementUseCaseで前月分の精算を実行
- SendSettlementNotificationUseCaseで精算結果を通知
- 実行ログの記録とエラーハンドリング

### ドメインイベント（Domain Event）

#### MonthlySettlementCalculated
- 月次精算が計算された際に発行
- イベントハンドラでLINE通知を実行

#### ReimbursementCreated
- 建て替え記録が作成された際に発行
- 将来的な拡張ポイント（監査ログなど）
