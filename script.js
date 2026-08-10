// 🔑 Google Sheets Cloud Gateway Architecture
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

// =========================================================================
// 🛠️ MANUAL EXPORT TABLE ADJUSTMENT CONFIGURATION 🛠️
// Adjust the items below to change which columns appear in the "Export Searched" HTML file.
// 'display' is the column header text shown in the generated export table.
// 'key' is the internal lowercase identifier matching your spreadsheet columns.
// Simply delete or comment out a line to remove that column from the export.
// =========================================================================
const EXPORT_TABLE_CONFIG = [
    { display: "Article no./ TCT no.", key: "article/item" },
    { display: "Description", key: "description" },
    { display: "Remarks", key: "remarks" },
    { display: "Type", key: "type" },
    { display: "Photo 1", key: "photo 1" },
    { display: "Photo 2", key: "photo 2" },
    { display: "Map Coordinates", key: "map coordinates" },
    { display: "Tax Declaration", key: "tax declaration" },
    { display: "Transfer Certificate of Title Page 1", key: "transfer_cert1" },
    { display: "Transfer Certificate of Title Page 2", key: "transfer_cert2" },
];
// =========================================================================

const displayHeaders = ["Article no./ TCT no.", "Description", "Acquisition Date", "Unit Value", "Remarks", "Type", "Photo 1", "Photo 2", "Map Coordinates", "Tax Declaration", "Transfer Certificate of Title Page 1", "Transfer Certificate of Title Page 2", "UPDATED BY", "LAST UPDATE"];
const targetHeadersLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type", "photo 1", "photo 2", "map coordinates", "tax declaration", "transfer_cert1", "transfer_cert2", "updated by", "last update"];
const popupOrderLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type"]; 

let inventoryData = []; 
let currentFilteredData = []; 
let rawHeaders = [];       
let headerMapping = {}; 
let activeEditIndex = null; 
let parsedUniqueRemarks = []; 
let isAppInitialized = false; 
let modalModified = false;

// Modal Photo Gallery State
let modalPhotos = [];
let currentPhotoIndex = 0;

// Pagination Variables
let currentPage = 1;
const itemsPerPage = 50;

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const exportButton = document.getElementById('exportButton');
const exportFilteredButton = document.getElementById('exportFilteredButton');
const remarksFilter = document.getElementById('remarksFilter');
const typeFilter = document.getElementById('typeFilter');
const photoFilter = document.getElementById('photoFilter');
const tableHeaderRow = document.getElementById('tableHeaderRow');
const tableBody = document.getElementById('tableBody');
const statusBanner = document.getElementById('statusBanner');
const foundCountDisplay = document.getElementById('foundCountDisplay'); 

// Pagination Elements
const paginationContainer = document.getElementById('paginationContainer');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageIndicator = document.getElementById('pageIndicator');

// Dashboard elements
const countTotal = document.getElementById('countTotal');
const countExisting = document.getElementById('countExisting');
const countNotFound = document.getElementById('countNotFound');
const countVerification = document.getElementById('countVerification');
const countWithPhotos = document.getElementById('countWithPhotos');
const countTaxDec = document.getElementById('countTaxDec'); 

const countBuilding = document.getElementById('countBuilding');
const countAssetMod = document.getElementById('countAssetMod'); 
const countFlood = document.getElementById('countFlood');
const countHospital = document.getElementById('countHospital');
const countLand = document.getElementById('countLand');
const countMarket = document.getElementById('countMarket');
const countOtherInfra = document.getElementById('countOtherInfra');
const countOtherLand = document.getElementById('countOtherLand');
const countOtherStruct = document.getElementById('countOtherStruct');
const countPark = document.getElementById('countPark');
const countRoad = document.getElementById('countRoad');
const countSchool = document.getElementById('countSchool');
const countSlaughterhouse = document.getElementById('countSlaughterhouse');
const countWater = document.getElementById('countWater');

// Modal elements
const editModal = document.getElementById('editModal');
const modalFormContainer = document.getElementById('modalFormContainer');
const modalEditBtn = document.getElementById('modalEditBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCloseX = document.getElementById('modalCloseX'); 
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn'); 

// Tooltip Elements
const tooltip = document.getElementById('imagePreviewTooltip');
const tooltipImg = document.getElementById('imagePreviewTooltipImg');

// ⏳ LOADING OVERLAY GENERATOR
let loadingOverlay = document.getElementById('dynamicLoadingOverlay');
if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dynamicLoadingOverlay';
    loadingOverlay.innerHTML = `
    <div style="text-align: center; color: #ffffff !important; font-family: Arial, sans-serif !important; z-index: 100000 !important;">
        <div style="width: 80px !important; height: 80px !important; border: 8px solid rgba(255,255,255,0.2) !important; border-radius: 50% !important; border-top-color: #28a745 !important; animation: spin 0.4s linear infinite !important; margin: 0 auto 20px auto !important; box-shadow: 0 0 20px rgba(40, 167, 69, 0.6) !important;"></div>
        <div id="loadingOverlayText" style="font-size: 20px !important; font-weight: bold !important; color: #ffffff !important; text-shadow: 1px 1px 5px rgba(0,0,0,0.5) !important;">Connecting...</div>
    </div>
`;
    Object.assign(loadingOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'none', justifyContent: 'center',
        alignItems: 'center', zIndex: '99999', transition: 'opacity 0.2s ease'
    });
    const styleSheet = document.createElement("style");
    styleSheet.innerText = "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
    document.head.appendChild(styleSheet);
    document.body.appendChild(loadingOverlay);
}

function showLoading(msg) {
    const textEl = document.getElementById('loadingOverlayText');
    if (textEl) textEl.textContent = msg;
    loadingOverlay.style.setProperty('display', 'flex', 'important');
}

function hideLoading() {
    loadingOverlay.style.setProperty('display', 'none', 'important');
}

// 🎯 NAME POPUP MODAL GENERATOR
let customNameModal = document.getElementById('customNameModal');
if (!customNameModal) {
    customNameModal = document.createElement('div');
    customNameModal.id = 'customNameModal';
    customNameModal.innerHTML = `
        <div style="background: #ffffff !important; padding: 30px !important; border-radius: 8px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important; width: 90% !important; max-width: 400px !important; box-sizing: border-box !important; text-align: center !important; font-family: Arial, sans-serif !important;">
            <label style="font-size: 18px !important; font-weight: bold !important; color: #333333 !important; display: block !important; margin-bottom: 15px !important;">Enter Your Name to Log This Change:</label>
            <input type="text" id="custom-operator-input" value="Noel Rie N. Deliña" placeholder="Your Name" style="width: 100% !important; padding: 12px !important; font-size: 16px !important; border: 1px solid #ccc !important; border-radius: 4px !important; margin-bottom: 20px !important; box-sizing: border-box !important;" />
            <div style="display: flex !important; gap: 10px !important; justify-content: center !important;">
                <button id="customCancelNameBtn" style="background: #6c757d !important; color: white !important; border: none !important; padding: 10px 20px !important; border-radius: 4px !important; cursor: pointer !important; font-weight: bold !important; font-size: 14px !important;">Cancel</button>
                <button id="customConfirmNameBtn" style="background: #28a745 !important; color: white !important; border: none !important; padding: 10px 20px !important; border-radius: 4px !important; cursor: pointer !important; font-weight: bold !important; font-size: 14px !important;">Confirm & Publish</button>
            </div>
        </div>
    `;
    Object.assign(customNameModal.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'none', justifyContent: 'center',
        alignItems: 'center', zIndex: '9999Here is the complete structural code to convert a Google Apps Script into a pop-up window (a modal dialog) within Google Workspace. 

Because the original code wasn't included in your message, I have built this fully functional framework tailored for a Real Estate Inventory layout. You can copy and paste this directly, and then insert your existing HTML and server-side functions where indicated to retain all your current functionality. 

### `Code.gs` (Server-Side)
This file handles the menu creation and triggers the pop-up window.

```javascript
// Creates a custom menu when the document or spreadsheet is opened
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Inventory Tools')
      .addItem('Open Property Details', 'showPropertyDetailsPopup')
      .addToUi();
}

// Function to trigger the pop-up window
function showPropertyDetailsPopup() {
  // 'Popup' refers to the name of your HTML file (Popup.html)
  var htmlOutput = HtmlService.createHtmlOutputFromFile('Popup')
      .setWidth(600)  // Adjust the width of the pop-up
      .setHeight(500) // Adjust the height of the pop-up
      .setSandboxMode(HtmlService.SandboxMode.IFRAME); 

  // Displays the pop-up with a specific title
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Property Details');
}

// ---------------------------------------------------------
// PASTE YOUR EXISTING SERVER-SIDE FUNCTIONS BELOW THIS LINE
// ---------------------------------------------------------

/* Example:
function getMyData() {
  return "Data successfully loaded";
}
*/
