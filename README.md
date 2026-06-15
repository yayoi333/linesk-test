<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c3146fc4-0411-43b1-8685-6b7cb6c807b4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Verification notes

- API key storage: save a Gemini API key from the API settings modal, reload the page, and confirm AI translation or AI metadata generation still works. The key is stored in `localStorage` as `gemini_api_key_encrypted`; legacy plaintext `gemini_api_key` is migrated and removed on load.
- Image deletion: delete a sticker from the edit screen, reload, restore the saved project, and confirm the deleted sticker does not return.
- All data deletion: use "データをすべて削除する" from the edit screen, confirm the dialog, reload, and confirm no saved project is offered. This also clears saved materials and the Gemini API key in this browser.
- AI metadata generation: set a Gemini API key, click "AI生成" beside the title/description area, confirm the Google send warning, and confirm Japanese and English metadata fields are filled.

API key encryption is lightweight localStorage protection using Web Crypto. Stronger hardening should bundle external CDN dependencies and add SRI/CSP so injected scripts cannot read browser data.
