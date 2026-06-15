import { GoogleGenAI } from "@google/genai";

let customApiKey: string | null = null;
const MODEL_NAME = "gemini-3-flash-preview";

export function setGeminiApiKey(key: string) {
  customApiKey = key;
}

function getGeminiApiKey(): string {
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

function resolveApiKey(apiKeyOverride?: string | null): string {
  return apiKeyOverride?.trim() || getGeminiApiKey();
}

function dataUrlToInlineData(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2],
  };
}

export async function translateMeta(
  jaName: string,
  jaDesc: string,
  apiKeyOverride?: string | null
): Promise<{ enName: string; enDesc: string }> {
  const apiKey = resolveApiKey(apiKeyOverride);

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

export async function generateMeta(
  input: {
    imageDataUrl?: string;
    stampCount: number;
    existingMeta: {
      stampNameJa?: string;
      stampDescJa?: string;
      stampNameEn?: string;
      stampDescEn?: string;
    };
  },
  apiKeyOverride?: string | null
): Promise<{ stampNameJa: string; stampDescJa: string; stampNameEn: string; stampDescEn: string }> {
  const apiKey = resolveApiKey(apiKeyOverride);

  if (!apiKey) {
    throw new Error("APIキーが見つかりません。「API設定」ボタンから設定してください。");
  }

  const ai = new GoogleGenAI({ apiKey });
  const inlineData = input.imageDataUrl ? dataUrlToInlineData(input.imageDataUrl) : null;
  const prompt = `You help create LINE sticker metadata.
Generate concise metadata in Japanese and English for a sticker set.

Rules:
1. Return ONLY valid JSON.
2. Use these exact keys: stampNameJa, stampDescJa, stampNameEn, stampDescEn.
3. Japanese title must be 2-40 characters.
4. Japanese description must be 10-160 characters.
5. English title must be 2-40 characters.
6. English description must be 10-160 characters.
7. Keep it natural, friendly, and suitable for LINE Creators Market.
8. Do not mention AI, upload, image analysis, or Google.

Context:
- Number of stickers: ${input.stampCount}
- Existing Japanese title: ${input.existingMeta.stampNameJa || "(empty)"}
- Existing Japanese description: ${input.existingMeta.stampDescJa || "(empty)"}
- Existing English title: ${input.existingMeta.stampNameEn || "(empty)"}
- Existing English description: ${input.existingMeta.stampDescEn || "(empty)"}`;

  const parts: any[] = [{ text: prompt }];
  if (inlineData) {
    parts.push({ inlineData });
  }

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts,
    },
    config: {
      temperature: 0.6,
      maxOutputTokens: 700,
      responseMimeType: "application/json",
    },
  });

  const rawText =
    response.text ||
    response.candidates?.[0]?.content?.parts?.find((part: any) => part.text)?.text ||
    "";

  try {
    const parsed = JSON.parse(rawText.trim());
    return {
      stampNameJa: String(parsed.stampNameJa || "").slice(0, 40),
      stampDescJa: String(parsed.stampDescJa || "").slice(0, 160),
      stampNameEn: String(parsed.stampNameEn || "").slice(0, 40),
      stampDescEn: String(parsed.stampDescEn || "").slice(0, 160),
    };
  } catch (error) {
    console.warn("Metadata generation returned invalid JSON:", rawText, error);
    throw new Error("AI生成結果の読み取りに失敗しました。もう一度お試しください。");
  }
}
