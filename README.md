# Chelur Crop Portal — prototype package

## Apps Script backend
1. Sign into the Google account that can read both source spreadsheets.
2. Go to https://script.google.com/ and create a project.
3. Paste `Code.gs` into the editor and save.
4. Deploy > New deployment > Web app. Execute as **Me**. Access: **Anyone** (if permitted by your Google account/Workspace policy).
5. Copy the URL ending `/exec`.

## PWA frontend
1. In `app.js`, replace `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE` with the deployed `/exec` URL.
2. Host all frontend files (`index.html`, `app.js`, `manifest.webmanifest`, `sw.js`, `icon.svg`) on an HTTPS static host, such as GitHub Pages or Firebase Hosting.
3. Open the HTTPS URL in Chrome on Android and choose **Install app** / **Add to Home screen**.

## Verified assumptions from the supplied screenshots
Fruit tab GID 1357017405; headers row 1; records A:T: date, buying sheet, receipt, farmer code, farmer, village, A1/B2/C3/D4/E5 quantities, total quantity, FA name, A1/B2/C3/D4/E5 amounts, total amount, average price/kg.
Crop tab GID 1575705622; farmer rows A:M: code, farmer, father, village, DOS, acres, DOFH, DOLH, THD, quantity, crop value, input cost, closing balance. Parser expects FA heading rows in column A with remaining cells blank and numeric farmer codes in column A.

## Before sharing with FAs
Test several farmers against the source sheets, including one with A1/B2 quantities, one with zero purchases, and at least two FA blocks. The Crop Analysis parser may need adjustment if FA heading rows are merged or formatted differently. Data cache is 60 seconds. Set `cacheSeconds:0` in Code.gs for no caching.

The backend executes as the deploying Google account. Anyone with the app URL can read the returned data; don't use this for confidential records. The app does not edit the spreadsheets. PDF currently uses browser Print > Save as PDF; branded multi-page PDF export can be added after validating the data mapping.
