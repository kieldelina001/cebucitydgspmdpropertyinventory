# 🏢 Real Estate Inventory – DGS Property Management Division

A browser-based, live property inventory system for the **Department of General Services – Property Management Division (DGS PMD)**. It reads property records straight from Google Sheets, lets authorized staff search, review, update, and export them, and tracks insurance coverage across the whole property portfolio.

No build step and no backend server: it is plain HTML, CSS, and JavaScript, with Google Sheets and Google Apps Script as the data layer.

---

## ✨ Features

### 📦 Inventory
- **Live Google Sheets data** – the inventory loads on sign-in, with a status banner showing the connection state.
- **Summary dashboard** – counts for Total Properties, Existing, Not Found, For Verification, With Pictures, and With Tax Declaration.
- **Property type overview** – clickable cards for Buildings, Unidentified Buildings, Asset Modifications, School Buildings, Hospitals, Markets, Parks, Land, Unidentified Land, Flood Control, Water Systems, Roads, Slaughterhouses, and other infrastructure, structures, or land. Clicking a card filters the table.
- **Search and filters** – keyword search plus a Remarks filter and one-click **Reset Filters**.
- **Paginated table** – columns include Article no./TCT no., Description, Notes, Unit Value, Remarks, Type, photos, map coordinates, tax declaration, and transfer certificates.
- **Property Details window** – view and edit a record, with a photo viewer (previous/next navigation and photo download). Saves record who made the update.
- **Photo and document upload** – upload Structure Photo 1 and 2, Map Coordinates, and the Tax Declaration. Images are resized in the browser before upload, with progress and status indicators.

### 🛡️ Insurance
- **Insurance Register** – a dedicated tab, populated from the Inventory data, with its own search (article no., description, insurer, policy ID).
- **Status tracking** – properties are classed as insured, not insured, or expiring or expired. Policy dates are read from text, and anything within **30 days** of expiry is flagged.
- **Dashboard counters and tab badge** – a quick view of coverage without opening the table.
- **Policy copy upload** – attach a copy of the insurance policy to a record.

### 🖨️ Print Queue
- A "shopping basket" for reports: search, add records with **+ Queue**, search something else, add more, then print or download once.
- The queue is independent of table filters, so searching, resetting, or paging never loses it.
- Items are tracked by **Article no./TCT no.**, so the report always uses fresh data even if the sheet reloads.
- A floating counter opens a drawer where you can review, re-order, remove, or clear items, with **Undo**.
- Stored in `sessionStorage`: it survives a page refresh and disappears when the tab is closed, which is safer on shared office computers.

### 📤 Export
- **Full inventory → CSV**.
- **Filtered or queued records → standalone HTML report**, with photos downloaded and embedded, plus agency logos in the header. The report can be opened or printed offline.

### 🔐 Access and Security
- **Google Sign-In** (Google Identity Services).
- **Authorized accounts list** – only emails on an approved Google Sheet can enter. Others see an *Access Denied* window where they can send an access request.
- **Admin approve/deny** flow for access requests.
- **Auto-logout** after 30 minutes of inactivity, with a Session Expired dialog.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Front end | HTML5, CSS3, vanilla JavaScript |
| Data source | Google Sheets (published as CSV) |
| Write-back, uploads, access requests | Google Apps Script web app |
| Authentication | Google Identity Services (OAuth) |
| CSV parsing | [PapaParse](https://www.papaparse.com/) |
| Font | Inter (Google Fonts) |

---

## 📁 Project Structure

```
├── index.html        # Layout, styles, tabs, dashboard, modals
├── script.js         # Core logic: auth, data loading, search, editing, uploads, insurance, export
├── print-queue.js    # Print queue (floating button, drawer, report generation)
├── dgs_logo.png      # Header / favicon / report logo
├── Ph_seal_cebucity.png
└── *.png             # Property type icons (building, land, school, hospital, ...)
```

`print-queue.js` depends on globals from `script.js`, so load it **after** `script.js` (as `index.html` already does).

---

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/<your-username>/<your-repo>.git
   cd <your-repo>
   ```
2. **Configure the data sources** at the top of `script.js`:
   - `GOOGLE_APPS_SCRIPT_URL` – your deployed Apps Script web app
   - `SPREADSHEET_ID` and `SPREADSHEET_GID` – the inventory sheet
   - `AUTHORIZED_ACCOUNTS_SHEET_ID` and `AUTHORIZED_ACCOUNTS_GID` – the approved-users sheet
3. **Set up Google Sign-In** by adding your OAuth client ID and authorized JavaScript origins in the Google Cloud Console.
4. **Run it.** Serve the folder over HTTP rather than opening the file directly:
   ```bash
   python -m http.server 8000
   # then open http://localhost:8000
   ```
   Or deploy to **GitHub Pages** (Settings → Pages) and add that URL to your OAuth authorized origins.

> ⚠️ **Do not commit secrets.** Keep API keys and shared secrets out of a public repository. See the security note below.

---

## ⚙️ Configuration Reference

| Setting (in `script.js`) | Purpose |
|---|---|
| `EXPORT_TABLE_CONFIG` | Columns included in the HTML report |
| `INSURANCE_EXPIRING_DAYS` | Days before expiry to flag a policy (default `30`) |
| `IDLE_TIME_LIMIT` | Inactivity auto-logout (default 30 minutes) |
| `EXPORT_IMAGE_MAX_PX` | Longest side of embedded report photos (default `800`) |
| `EXPORT_JPEG_QUALITY` | Report photo quality (default `0.75`) |
| `EXPORT_CONCURRENCY` | Parallel photo downloads during export (default `6`) |

---

## 🔒 Security Note

This is a client-side app, so anything in the JavaScript is visible to anyone who can open the page. For a public repository:

- Don't hardcode shared secrets in `script.js`. Validate access **server-side** in Apps Script (for example by verifying the signed-in Google user's email against the authorized list) rather than relying on a key in the browser.
- Keep the inventory and authorized-accounts sheets **not publicly shared**, and share them only with the accounts that need them.
- Rotate any secret that has previously been committed, since Git history keeps old versions.

---

## 👤 Author

**Noel Rie N. Deliña**
Department of General Services – Property Management Division

---

## 📄 License

Add a license of your choice (for example MIT), or mark the project as internal use only.
