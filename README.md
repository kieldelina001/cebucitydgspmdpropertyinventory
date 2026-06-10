# 🏢 Real Estate Inventory Management System

A lightweight, serverless web application built for the **Property Management Division**. This system transforms a Google Spreadsheet into a live, interactive database—allowing users to view, search, filter, export, and update real estate inventory directly from the browser.

## ✨ Key Features

*   **Live Google Sheets Datastream:** Uses `PapaParse` to fetch and parse live CSV data directly from a published Google Sheet. No traditional database required.
*   **Dynamic Dashboard Analytics:** Automatically calculates and displays live counts of properties by status (Existing, Not Found, For Verification, With Pictures) and type (Buildings, Hospitals, Land, Schools, etc.).
*   **Advanced Search & Filtering:** 
    *   Multi-keyword text search.
    *   Dropdown filters for Remarks, Property Types, and Media (Photos).
*   **Secure Cloud Updates:** Utilizes a Google Apps Script (GAS) Web App gateway to process and log user updates (Remarks, Operator Name, Timestamp) back to the Google Sheet.
*   **Export Capabilities:** 
    *   Export the complete dataset to **CSV**.
    *   Export filtered search results to a clean, print-ready **HTML/PDF** report with image previews.
*   **Responsive UI:** Mobile-friendly design with horizontal scrolling for large tables, dynamic loading overlays, and a clean, centered dashboard.

## 🛠️ Tech Stack

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript
*   **Data Parsing:** [PapaParse](https://www.papaparse.com/) (CDN)
*   **Database:** Google Sheets
*   **Backend / API Gateway:** Google Apps Script (GAS)

## 🏗️ Architecture

1.  **Data Read:** The app constructs a direct CSV export URL using the target `SPREADSHEET_ID`. `PapaParse` reads this URL upon page load to generate the table and dashboard.
2.  **Data Write:** When a user updates a property's "Remarks", the app prompts for the operator's name, then sends a `POST` request to the `GOOGLE_APPS_SCRIPT_URL`.
3.  **GAS Handling:** The Google Apps Script receives the POST parameters (`article`, `remarks`, `updatedby`, `timestamp`) and updates the corresponding row in the spreadsheet. 

## 🚀 Setup & Installation

To deploy this project for your own organization, follow these steps:

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/yourusername/real-estate-inventory.git
cd real-estate-inventory
\`\`\`

### 2. Configure Google Sheets
1. Create a Google Sheet with headers matching the expected layout (e.g., *Article/Item, Description, Acquisition Date, Unit Value, Remarks, Type, Photo 1, Photo 2, Map Coordinates, Updated By, Last Update*).
2. Change the sharing settings of the Google Sheet to **"Anyone with the link can view"**.
3. Copy the **Spreadsheet ID** from the URL (the long string of characters between `/d/` and `/edit`).
4. Open `script.js` and replace the `SPREADSHEET_ID` variable with your ID:
   \`\`\`javascript
   const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE";
   \`\`\`

### 3. Configure Google Apps Script (For Updates)
1. In your Google Sheet, go to **Extensions > Apps Script**.
2. Write a `doPost(e)` function to handle the incoming data and update your sheet.
3. Deploy the script as a **Web App**:
   * **Execute as:** Me
   * **Who has access:** Anyone
4. Copy the deployment Web App URL.
5. Open `script.js` and replace the `GOOGLE_APPS_SCRIPT_URL`:
   \`\`\`javascript
   const GOOGLE_APPS_SCRIPT_URL = "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
   \`\`\`

### 4. Run the Application
Since this is a client-side application, you can simply open `index.html` in any modern web browser or host it on platforms like **GitHub Pages**, **Vercel**, or **Netlify**.

## 📸 Image Assets

Ensure the following image files are located in the root directory for the dashboard icons and header to load correctly:
*   `Ph_seal_cebucity.png` (Header Logo)
*   `building.png`, `flood.png`, `hospital.png`, `land.png`, `market.png`, `other.png`, `park.png`, `road.png`, `school.png`, `slaughterhouse.png`, `water.png` (Dashboard Type Icons)

## 👨‍💻 Author

*   **Noel Rie N. Deliña** - *Property Management Division*

## 📜 License

This project is created for internal organizational use. Ensure compliance with your organization's data privacy guidelines when handling real estate data and personal operator details.
