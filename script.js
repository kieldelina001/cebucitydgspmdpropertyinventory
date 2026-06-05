const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const BACKUP_FILE_NAME = "real_estate_inventory_backup.csv"; 
const displayHeaders = ["Article", "Description", "Acquisition Date", "Unit Value", "Remarks", "Type", "PhotoLink", "UPDATED BY", "LAST UPDATE"];
const targetHeadersLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type", "photolink", "updated by", "last update"];
const popupOrderLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type"]; 

let inventoryData = []; let rawHeaders = []; let headerMapping = {}; let activeEditIndex = null; let parsedUniqueRemarks = []; 

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const exportButton = document.getElementById('exportButton');
const remarksFilter = document.getElementById('remarksFilter');
const typeFilter = document.getElementById('typeFilter');
const photoFilter = document.getElementById('photoFilter');
const tableHeaderRow = document.getElementById('tableHeaderRow');
const tableBody = document.getElementById('tableBody');
const statusBanner = document.getElementById('statusBanner');
const searchResultCount = document.getElementById('searchResultCount'); 
const countTotal = document.getElementById('countTotal');
const countExisting = document.getElementById('countExisting');
const countNotFound = document.getElementById('countNotFound');
const countVerification = document.getElementById('countVerification');
const countWithPhotos = document.getElementById('countWithPhotos');
const typeDashboardContainer = document.getElementById('typeDashboardContainer'); 
const editModal = document.getElementById('editModal');
const modalFormContainer = document.getElementById('modalFormContainer');
const modalEditBtn = document.getElementById('modalEditBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn'); 

window.addEventListener('DOMContentLoaded', () => {
    loadInventoryFromGoogleSheets();
});

async function loadInventoryFromGoogleSheets() {
    statusBanner.textContent = "Connecting to Google Sheets...";
    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        const rawCsvText = await response.text(); 
        Papa.parse(rawCsvText, {
            header: true, skipEmptyLines: true,
            complete: function(results) {
                rawHeaders = Object.keys(results.data[0]);
                targetHeadersLowercase.forEach(target => {
                    headerMapping[target] = rawHeaders.find(h => h.toLowerCase().trim().includes(target)) || target; 
                });
                inventoryData = results.data.map((row, idx) => ({...row, _rowId: idx}));
                initializeSystemUI();
            }
        });
    } catch (err) { statusBanner.textContent = "Connection Error."; }
}

function initializeSystemUI() {
    statusBanner.textContent = "✅ Connected.";
    populateDropdown('remarks', remarksFilter, '-- All Remarks --');
    populateDropdown('type', typeFilter, '-- All Types --');
    renderHeaders(displayHeaders);
    calculateTypeDashboardTotals(inventoryData);
    setupEventHandlers();
    executeSearch();
}

function calculateTypeDashboardTotals(items) {
    const container = document.getElementById('typeDashboardContainer');
    if (!container) return;
    container.innerHTML = ''; 
    
    const tKey = headerMapping['type'];
    const iconMap = {
        "Building": "building.png",
        "Water": "water.png",
        "Slaughterhouse": "slaughterhouse.png",
        "School": "school.png",
        "Road": "road.png",
        "Park": "park.png",
        "Market": "market.png",
        "Land": "land.png",
        "Hospital": "hospital.png"
    };

    const typeCounts = {};
    items.forEach(row => {
        let typeVal = String(row[tKey] || '').trim() || "Other";
        typeCounts[typeVal] = (typeCounts[typeVal] || 0) + 1;
    });

    Object.keys(typeCounts).sort().forEach(type => {
        const iconSrc = iconMap[type] || "other.png";
        const card = document.createElement('div');
        card.className = 'dash-card card-type';
        card.innerHTML = `
            <div class="dash-icon"><img src="${iconSrc}" alt="${type}"></div>
            <div class="dash-info">
                <div class="dash-title">${type}</div>
                <div class="dash-value">${typeCounts[type]}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function setupEventHandlers() {
    searchButton.addEventListener('click', executeSearch);
    exportButton.addEventListener('click', () => {
        const blob = new Blob([Papa.unparse(inventoryData)], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = BACKUP_FILE_NAME;
        link.click();
    });
}

function executeSearch() {
    // Basic search implementation
    const term = searchInput.value.toLowerCase();
    const filtered = inventoryData.filter(row => JSON.stringify(row).toLowerCase().includes(term));
    renderTable(filtered);
}

function renderTable(data) {
    tableBody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        targetHeadersLowercase.forEach(tKey => {
            const td = document.createElement('td');
            td.textContent = row[headerMapping[tKey]] || '';
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

function renderHeaders(headers) {
    tableHeaderRow.innerHTML = '';
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        tableHeaderRow.appendChild(th);
    });
}

function populateDropdown(type, selectEl, placeholderText) {
    const sheetKey = headerMapping[type];
    if(!selectEl || !sheetKey) return;
    const vals = new Set(inventoryData.map(r => r[sheetKey]).filter(v => v));
    vals.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        selectEl.appendChild(opt);
    });
}
