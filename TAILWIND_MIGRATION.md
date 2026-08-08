# Tailwind CDN → 同梱（バンドル）移行レシピ

linesk で実施済み（2026-07-05）。lineek / linedk / lineuk に同じ手順を適用するためのレシピ。
4アプリはほぼ同じ構造なので、このとおりやれば再現できる。**必ず手順9の検証まで行うこと。**

## 背景
- 旧: index.html が `cdn.tailwindcss.com`（Play CDN）を読み込み、インライン `tailwind.config` でテーマ定義
- 問題: CDN 停止・仕様変更で全アプリの見た目が崩れる。本番利用非推奨。XSS 対策（エンジニア指摘の根本対策）としても同梱が必要
- 併せて index.html の `importmap`（esm.sh 参照）も削除する（Vite ビルドでは未使用の残骸）

## 手順

1. `npm install -D tailwindcss@^3.4.0 postcss autoprefixer`
   （**v3 を明示**。Play CDN は v3 相当のため。v4 はビルド方式が違うので使わない）

2. `tailwind.config.js` を新規作成:
   - `content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}']`
   - `theme.extend` には **そのアプリの index.html のインライン tailwind.config にある内容だけを丸写し**する
     （linesk は colors.primary のみ。アプリによって keyframes/animation がある場合はそれも移す。
     余計なものを足さない＝見た目の互換性維持）
   - `export default` 形式（package.json が type:module のため）

3. `postcss.config.js` を新規作成:
   ```js
   export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
   ```

4. `index.css` の**先頭**に追記（既存の内容は残す）:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

5. `index.tsx` に `import './index.css';` を追加

6. `index.html` から削除:
   - `<script src="https://cdn.tailwindcss.com"></script>`
   - インラインの `tailwind.config` スクリプト
   - `<script type="importmap">…</script>`（esm.sh 参照のブロック）
   - `<link rel="stylesheet" href="/index.css">`（bundle 経由になるため）
   - **Google Fonts の link は残す**（キャンバスの文字描画で使うため）

7. `npm run lint`（tsc）と `npm run build` が exit 0 であること
   ※ lineek はルートの残骸ファイルで lint が元から失敗する → include を絞った一時 tsconfig でチェック（lineek/CLAUDE.md 参照）

8. **開発サーバーは必ず再起動**する（起動中のサーバーは新しい postcss/tailwind 設定を読まない。
   再起動しないと「全スタイル消失」に見えて焦るが、設定の読み忘れが原因）

9. 検証（linesk で実施した内容。省略しないこと）:
   - 変更**前**に主要要素の computedStyle（body 背景色・ボタン色・角丸・フォントサイズ等）を記録し、変更後に**完全一致**を確認
   - 任意値クラスが生成されているか: `bg-[#ff00ff]` `text-[#06C755]` `text-[10px]` `animate-[fadeIn…]` などが CSSOM に存在すること
   - 編集画面・編集モーダルまで進んで見た目を確認
   - `performance.getEntriesByType('resource')` で外部ホストが **fonts.googleapis.com / fonts.gstatic.com のみ**になっていること
   - dist/index.html に cdn.tailwindcss.com の script タグと importmap が無いこと

## 注意
- 動的に組み立てた Tailwind クラス（`bg-${color}` みたいなもの）があると JIT が拾えず消える。
  linesk/lineek/linedk/lineuk には無いことを確認済みだが、移行前に必ず grep で確認すること
- `guide.html`（静的な説明ページ）は対象外（独自に CDN を読んでいてもアプリ本体とは別物）
- ビルド後の CSS が 30〜40KB 程度になっていれば正常（旧 index.css は 1KB 未満）
