# Real Estate Inventory Management System

Developed by **Noel Rie N. Deliña** (Property Management Division)

A lightweight, high-performance web application designed to live-stream, filter, search, and update property inventory records seamlessly using a Google Sheet as a serverless backend database. 

## 🚀 Features

- **Live Datastream Parsing**: Uses `PapaParse` to convert live Google Sheet CSV exports into a fast frontend data model asynchronously.
- **Dynamic Metrics Dashboard**: Tracks inventory health instantly with live stat cards reporting totals for *Existing*, *Not Found*, and *For Verification* flags.
- **Advanced Local Filtering**: Provides an instant global keyword search combined with targeted drop-down filters for *Remarks* and *Property Types*.
- **Interactive Management Modal**: Gives users an option to edit properties, review details, and trigger external image processing modules.
- **Change Attribution Audit Trail**: Features a fallback deadline-pop-up mechanism prompting operators for their name before confirming data submissions to prevent anonymous database overwrites.
- **Local Grid Backup**: Allows users to export a copy of the filtered dataset directly into a localized backup `.csv` file format.

## 🛠️ System Architecture

The application operates as a decoupled client-server web app:
1. **Frontend (`index.html` & `script.js`)**: Serves the primary GUI to the client browser, handling search computations, animations, and data mapping locally.
2. **Database Link (`Google Sheets CSV API`)**: Provides a read-only stream of current asset rows directly into the web app layout.
3. **Write Gateway (`Google Apps Script Web App`)**: Processes inbound CORS-compliant webhook actions (`POST` requests) to parse row targets and commit property mutations cleanly into the sheet.

## 📂 File Structure

```text
├── index.html          # Main application structure, styling layouts, and modal DOM elements
├── script.js           # Core client-side logic, PapaParse connection, local filtering, and API integrations
├── code.gs             # Backend Google Apps Script engine managing automated sheet mutations and image blobs
└── Ph_seal_cebucity.png# Local asset logo representing the city or division entity
