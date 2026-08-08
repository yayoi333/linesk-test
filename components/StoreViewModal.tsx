import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Play } from 'lucide-react';
import { Stamp, MetaData, ExportConfig, TARGET_WIDTH, TARGET_HEIGHT, MAIN_WIDTH, MAIN_HEIGHT } from '../types';
import { renderAllLayers } from '../lib/zipService';

// LINEクリエイターズマーケットのスタンプ価格帯
const PRICE_OPTIONS = [120, 250, 370, 490, 610];

export interface StoreInfo {
  creator: string;
  copyright: string;
  price: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  meta: MetaData;
  stamps: Stamp[];
  mainConfig: ExportConfig | null;
  storeInfo: StoreInfo;
  onStoreInfoChange: (info: StoreInfo) => void;
}

/**
 * スタンプ1枚を透明背景で描画する（ストアの表示に合わせて背景は白のまま）
 */
const StoreSticker: React.FC<{
  imageUrl: string;
  config: ExportConfig;
  width: number;
  height: number;
}> = ({ imageUrl, config, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let cancelled = false;

    ctx.clearRect(0, 0, width, height);

    const img = new Image();
    img.onload = () => {
      const layerImages = new Map<string, HTMLImageElement>();
      const layerPromises = (config.imageLayers ?? []).map(layer => (
        new Promise<void>((resolve) => {
          const lImg = new Image();
          lImg.onload = () => { layerImages.set(layer.id, lImg); resolve(); };
          lImg.onerror = () => resolve();
          lImg.src = layer.dataUrl;
        })
      ));
      Promise.all(layerPromises).then(() => {
        if (cancelled) return;
        ctx.clearRect(0, 0, width, height);
        renderAllLayers(ctx, img, config, width, height, layerImages);
      });
    };
    img.src = imageUrl;

    return () => { cancelled = true; };
  }, [imageUrl, config, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="w-full h-full" />;
};

/**
 * クリックすると入力欄に変わるテキスト
 */
const EditableText: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}> = ({ value, onChange, placeholder, className = '' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => { onChange(draft.trim()); setEditing(false); };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        placeholder={placeholder}
        className={`border border-primary-400 rounded px-1 outline-none ${className}`}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-text hover:bg-yellow-50 hover:outline hover:outline-1 hover:outline-yellow-300 rounded px-1 ${className}`}
      title="クリックして編集"
    >
      {value || <span className="text-gray-400">{placeholder}</span>}
    </span>
  );
};

export const StoreViewModal: React.FC<Props> = ({
  isOpen, onClose, meta, stamps, mainConfig, storeInfo, onStoreInfoChange
}) => {
  const hasEnglish = !!(meta.stampNameEn?.trim() || meta.stampDescEn?.trim());
  // 日本語・英語の両方があるときは日本語を初期表示にする
  const [lang, setLang] = useState<'ja' | 'en'>('ja');
  // クリック／ホバーで動かすスタンプ
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => { if (isOpen) setLang('ja'); }, [isOpen]);

  if (!isOpen) return null;

  const title = lang === 'en' ? (meta.stampNameEn || meta.stampNameJa) : meta.stampNameJa;
  const desc = lang === 'en' ? (meta.stampDescEn || meta.stampDescJa) : meta.stampDescJa;

  const mainStamp = mainConfig ? stamps.find(s => s.id === mainConfig.id) : null;
  const mainImageUrl = mainConfig
    ? (mainConfig.customDataUrl ?? mainStamp?.dataUrl ?? '')
    : (stamps[0]?.dataUrl ?? '');

  const stampToConfig = (s: Stamp): ExportConfig => ({
    id: s.id,
    scale: s.scale,
    rotation: s.rotation,
    offsetX: s.offsetX,
    offsetY: s.offsetY,
    textObjects: s.textObjects,
    imageLayers: s.imageLayers,
    drawingStrokes: s.drawingStrokes,
    mainImageLayerOrder: s.mainImageLayerOrder ?? 100,
    flipH: s.flipH,
    flipV: s.flipV,
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      {/* ストアの見た目に合わせた動きの再現（静止画スタンプなので疑似的な動き） */}
      <style>{`
        @keyframes storeStickerPop {
          0%   { transform: scale(1) rotate(0deg); }
          25%  { transform: scale(1.12) rotate(-4deg); }
          50%  { transform: scale(0.96) rotate(3deg); }
          75%  { transform: scale(1.06) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .store-sticker-play { animation: storeStickerPop 0.7s ease-in-out; }
        @media (hover: hover) {
          .store-sticker-cell:hover .store-sticker-inner { animation: storeStickerPop 0.7s ease-in-out; }
        }
      `}</style>

      <div className="bg-white w-full h-full sm:h-[95vh] sm:max-w-5xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* ツールバー（プレビュー用。ストアの一部ではない） */}
        <div className="px-3 py-2 border-b bg-gray-50 flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold text-gray-700">ストアビュー</span>
          {hasEnglish && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setLang('ja')}
                className={`text-xs font-bold px-2 py-1 rounded border transition ${lang === 'ja' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-100'}`}
              >日本語</button>
              <button
                onClick={() => setLang('en')}
                className={`text-xs font-bold px-2 py-1 rounded border transition ${lang === 'en' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-100'}`}
              >English</button>
            </div>
          )}
          <span className="hidden sm:inline text-[11px] text-gray-400 ml-2">価格・クリエイター名・コピーライトはクリックで変更できます（プレビュー表示のみ）</span>
          <button onClick={onClose} className="ml-auto p-2 hover:bg-gray-200 rounded-full transition shrink-0" title="閉じる">
            <X size={20} />
          </button>
        </div>

        {/* ストア本体（背景は真っ白） */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            {/* ヘッダー */}
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="shrink-0 mx-auto sm:mx-0">
                <div className="relative w-[240px] h-[240px] flex items-center justify-center">
                  {mainImageUrl ? (
                    <StoreSticker
                      imageUrl={mainImageUrl}
                      config={mainConfig ?? stampToConfig(stamps[0])}
                      width={MAIN_WIDTH}
                      height={MAIN_HEIGHT}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">メイン画像なし</div>
                  )}
                  <div className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-white/90 border border-gray-200 shadow flex items-center justify-center text-gray-500">
                    <Play size={22} className="ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 leading-snug break-words">
                  {title || <span className="text-gray-300">スタンプ名が未入力です</span>}
                </h1>
                <div className="mt-2 text-xs text-[#06C755]">
                  <EditableText
                    value={storeInfo.creator}
                    onChange={(v) => onStoreInfoChange({ ...storeInfo, creator: v })}
                    placeholder="クリエイター名"
                  />
                </div>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
                  {desc || <span className="text-gray-300">説明文が未入力です</span>}
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[#06C755] text-2xl font-bold">￥</span>
                    <select
                      value={storeInfo.price}
                      onChange={(e) => onStoreInfoChange({ ...storeInfo, price: Number(e.target.value) })}
                      className="text-[#06C755] text-2xl font-bold bg-transparent border border-transparent hover:border-gray-300 rounded cursor-pointer outline-none focus:border-primary-400"
                      title="価格を選択"
                    >
                      {PRICE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <span className="text-[11px] text-gray-400">1%還元</span>
                  </div>
                  <div className="ml-auto w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-300">
                    <Heart size={18} />
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <span className="text-sm font-bold text-gray-800 bg-yellow-200 px-1">PayPay決済が利用できるようになりました</span>
                </div>

                <div className="mt-3 flex gap-3">
                  <button type="button" className="flex-1 bg-[#4b5563] text-white font-bold py-3 rounded cursor-default">プレゼントする</button>
                  <button type="button" className="flex-1 bg-[#06C755] text-white font-bold py-3 rounded cursor-default">購入する</button>
                </div>
              </div>
            </div>

            {/* 情報欄 */}
            <div className="mt-8 border-t border-gray-200 pt-4 space-y-2 text-xs text-gray-500">
              <p>スタンプアレンジ/デコレーションに対応</p>
              <p>制作者に提供される情報について</p>
              <p className="leading-relaxed">
                LINEヤフー株式会社はスタンプ/絵文字/着せかえ制作者への売上レポートの提供のために、お客様の購入情報を利用します。
              </p>
            </div>

            {/* スタンプ一覧 */}
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
                {stamps.map(s => (
                  <div
                    key={s.id}
                    className="store-sticker-cell aspect-[37/32] flex items-center justify-center cursor-pointer select-none"
                    onClick={() => {
                      setPlayingId(null);
                      window.setTimeout(() => setPlayingId(s.id), 10);
                    }}
                    title="クリックすると動きます"
                  >
                    <div className={`store-sticker-inner w-full h-full ${playingId === s.id ? 'store-sticker-play' : ''}`}>
                      <StoreSticker
                        imageUrl={s.dataUrl}
                        config={stampToConfig(s)}
                        width={TARGET_WIDTH}
                        height={TARGET_HEIGHT}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {stamps.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">表示できるスタンプがありません</p>
              )}
            </div>

            {/* コピーライト */}
            <div className="mt-8 border-t border-gray-200 pt-4 pb-8 text-xs text-gray-500">
              <EditableText
                value={storeInfo.copyright}
                onChange={(v) => onStoreInfoChange({ ...storeInfo, copyright: v })}
                placeholder="© コピーライトを入力"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
