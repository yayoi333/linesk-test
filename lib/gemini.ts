import { GoogleGenAI } from "@google/genai";

let customApiKey: string | null = null;

export function setGeminiApiKey(key: string) {
  customApiKey = key;
}

function getGeminiApiKey(): string {
  // APIキーは localStorage に暗号化して保存される（lib/storage.ts の saveApiKey/loadApiKey）。
  // ここでは平文の localStorage を直接参照せず、App 側で復号済みのキーが
  // setGeminiApiKey / translateMeta の apiKeyOverride 経由で渡される前提とする。

  // @ts-ignore
  const processEnvKey =
    typeof process !== "undefined"
      ? process.env?.API_KEY
      : undefined;

  const viteEnvKey =
    typeof import.meta !== "undefined"
      ? (import.meta as any).env?.VITE_GEMINI_API_KEY
      : undefined;

  return customApiKey || processEnvKey || viteEnvKey || "";
}

export async function translateMeta(
  jaName: string,
  jaDesc: string,
  apiKeyOverride?: string | null
): Promise<{ enName: string; enDesc: string }> {
  const apiKey = getGeminiApiKey() || apiKeyOverride?.trim();

  if (!apiKey) {
    throw new Error("APIキーが見つかりません。「API設定」ボタンから設定してください。");
  }

  const ai = new GoogleGenAI({ apiKey });

  async function translateText(text: string): Promise<string> {
    if (!text || text.trim() === "") return "";

    const prompt = `You are a professional translator.
Translate the following Japanese into natural English.

Strict Rules:
1. Output ONLY the English translation.
2. Do not include the original text.
3. Do not include any brackets [], tags <>, labels, or notes.
4. Do not wrap the output in quotes.
5. If the input is empty or nonsensical, return an empty string.

Text to translate:
${text}`;

    const MODEL_NAME = "gemini-3-flash-preview";

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          temperature: 0.1,
          maxOutputTokens: 512,
        },
      });

      if (response.text) {
        return response.text.trim();
      }

      const parts = response.candidates?.[0]?.content?.parts;
      const fallbackText = parts?.find((part: any) => part.text)?.text;
      if (fallbackText) {
        return fallbackText.trim();
      }
      return "";
    } catch (error: any) {
      console.warn(`Translation failed for text: "${text.substring(0, 10)}..."`, error);
      let errorMsg = "";
      if (error && typeof error === 'object') {
        errorMsg = error.message || JSON.stringify(error);
      } else {
        errorMsg = String(error);
      }

      if (
        errorMsg.includes("PERMISSION_DENIED") || 
        errorMsg.includes("permission") || 
        errorMsg.includes("403") ||
        errorMsg.includes("not have permission")
      ) {
        throw new Error(
          "APIキーの権限エラー (PERMISSION_DENIED) が発生しました。\n\n" +
          "【主な原因と対策】\n" +
          "1. APIキーに「Generative Language API」へのアクセス権があるか確認してください。Google Cloud Console のAPI制限で制限されている場合があります。\n" +
          "2. APIキーにHTTPリファラー制限やIP制限などのアプリケーション制限がかかっている可能性があります。現在お使いのドメイン（" + (typeof window !== 'undefined' ? window.location.hostname : 'Cloud Run') + "）からのリクエストがブロックされていないか確認するか、一時的に「制限なし」キーをお試しください。\n" +
          "3. Google AI Studio または Google Cloud Console の正しいアカウントで作成された, アクティブなAPIキーであることをご確認ください。"
        );
      }
      throw new Error(errorMsg || "Gemini APIで翻訳に失敗しました。");
    }
  }

  const [enName, enDesc] = await Promise.all([
    translateText(jaName),
    translateText(jaDesc),
  ]);

  return { enName, enDesc };
}