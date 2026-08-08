# CLAUDE.md — スタンプ切り出しくん (linesk)

AIアシスタント（Claude / Codex 等）向けの引き継ぎメモ。作業前に必ず読むこと。

## このアプリについて

- 1枚の画像からLINEスタンプを切り出す静的Webアプリ。**販売中の製品**
- Vite + React 19 + TypeScript。画像データはすべてブラウザ内（IndexedDB / localStorage）で処理・保存し、外部送信しない設計
- 例外は AI 翻訳のみ（ユーザー自身の Gemini API キーでユーザーが明示的にボタンを押したときだけ実行）
- 姉妹アプリ「絵文字切り出しくん」（ https://github.com/yayoi333/lineek ）とコードベースがほぼ同じ。**バグ修正はたいてい両方のリポジトリに必要**

## オーナーとの作業ルール（必読）

- オーナー（yayoi / あきるさん）は非エンジニア。説明は専門用語を噛み砕いた日本語で
- **指示された箇所以外のコードを変更しない**。気づいた改善点は実装せず提案として列挙する
- **main への push = 即・本番公開**（GitHub Pages が自動デプロイ）。push は必ず本人のOKを得てから
- 基本フロー: ローカル修正 → lint/build/ブラウザ検証 → localhost で本人確認 → OK → push

## 技術メモ・罠

### デプロイ
- `.github/workflows/deploy.yml` が main への push で GitHub Pages（ https://yayoi333.github.io/linesk/ ）へ自動デプロイ
- デプロイ最終段が「Deployment failed, try again later」で失敗することがある → `gh run rerun <run-id>`（`--failed` ではなく**全体再実行**）で直る
- push 後は本番URLのバンドルに変更が入ったことまで確認するのが通例

### 同一オリジン問題（重要）
- linesk と lineek は同じ yayoi333.github.io に同居し、**localStorage / IndexedDB を共有する**
- IndexedDB: linesk = `stamp-cutter-db` / lineek = `emoji-cutter-db`（2026-07 に分離済み。それ以前は共有されていて上書き事故が起きていた）
- アクセス認証フラグ: linesk = `auth_verified` / lineek = `auth_verified_ek`
- Gemini APIキー（`gemini_api_key_enc` / `gemini_api_key_k`）は**意図的に共有**（両アプリで同じキーが使える）
- **新しい localStorage キーや DB 名を追加するときは、相手アプリと衝突しないか必ず確認すること**

### アクセス制御
- URL の `#access=<キー>` を SHA-256 ハッシュで照合（平文キーはコードに置かない。App.tsx の `VALID_HASH`）
- 一度認証したら localStorage に記憶され、以降はキーなしURLでも開ける
- ローカル検証時のバイパス: `localStorage.setItem('auth_verified', 'true')`

### APIキーの暗号化保存
- `lib/storage.ts` の `saveApiKey` / `loadApiKey` / `removeApiKey`（Web Crypto AES-GCM）
- 旧形式の平文 `gemini_api_key` は読み込み時に自動で暗号化形式へ移行される
- これは簡易的な難読化。根本対策（Tailwind CDN の同梱化・SRI・CSP）は未対応 → 残タスク参照

### メイン/タブ画像の編集（過去に起きたバグ）
- メイン/タブ画像の編集結果は stamps ではなく `mainConfig` / `tabConfig` に保存される（消しゴム編集後の画像は `customDataUrl`）
- 編集モーダル（StampEditorModal）を開くときは `customDataUrl` / `flipH` / `flipV` / `mainImageLayerOrder` を stamp にマージして渡す（App.tsx の CanvasPreview onClick 参照）
- これを怠ると「編集して完了したのに、開き直すと編集前に戻る」バグが再発する

### 削除と保存
- スタンプ削除（handleDeleteStamp）は自動保存に頼らず**即時に saveProject を呼ぶ**こと。自動保存は stamps が空のときや復元直後のスキップ期間中は動かない

### ローカル開発
- `npm install` → `npm run dev`。base が `/linesk/` なので URL は http://localhost:3000/linesk/
- `npm run lint`（= tsc --noEmit）と `npm run build` は両方通る状態を保つこと
- オーナーのPC（OneDrive 配下）ではビルドがまれに exit -1073740791 でクラッシュする → `dist` を削除して再実行で直る

### 動作確認手順
- README.md の「セキュリティ・データ保護に関する動作確認手順」を参照

## 残タスク（2026-07-04 時点）

1. Tailwind CDN の同梱化 → linesk は2026-07-05完了。残りのアプリは linesk リポジトリの TAILWIND_MIGRATION.md のレシピどおりに実施すること
2. リポジトリ Private 化の判断（無料プランでは Private + Pages 不可 → GitHub Pro 月$4 か、他ホスティングへ引っ越し）— オーナー判断待ち
3. 保存失敗がユーザーに通知されない箇所の改善（コンソールにしか出ない）などレビュー指摘の小物
