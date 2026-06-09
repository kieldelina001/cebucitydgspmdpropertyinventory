// 🔑 Google Sheets Cloud Gateway Architecture
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

const displayHeaders = ["Article", "Description", "Acquisition Date", "Unit Value", "Remarks", "Type", "Photo 1", "Photo 2", "Map Coordinates", "UPDATED BY", "LAST UPDATE"];
const targetHeadersLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type", "photo 1", "photo 2", "map coordinates", "updated by", "last update"];
const popupOrderLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type"]; 

let inventoryData = []; 
let rawHeaders = [];       
let headerMapping = {}; 
let activeEditIndex = null; 
let parsedUniqueRemarks = []; 

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const exportButton = document.getElementById('exportButton');
const remarksFilter = document.getElementById('remarksFilter');
const typeFilter = document.getElementById('typeFilter');
const photoFilter = document.getElementById('photoFilter');
const tableHeaderRow = document.getElementById('tableHeaderRow');
const tableBody = document.getElementById('tableBody');
const statusBanner = document.getElementById('statusBanner');
const foundCountDisplay = document.getElementById('foundCountDisplay'); 

// ⏳ Loading Overlay Logic
let loadingOverlay = document.getElementById('dynamicLoadingOverlay');
if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dynamicLoadingOverlay';
    loadingOverlay.innerHTML = `
        <div style="text-align: center; color: #ffffff !important; font-family: Arial, sans-serif !important; z-index: 100000 !important;">
            <div style="width: 60px !important; height: 60px !important; border: 6px solid rgba(255,255,255,0.2) !important; border-radius: 50% !important; border-top-color: #ffffff !important; animation: spin 0.8s linear infinite !important; margin: 0 auto 20px auto !important;"></div>
            <div id="loadingOverlayText" style="font-size: 20px !important; font-weight: bold !important; color: #ffffff !important;">Connecting...</div>
        </div>
    `;
    Object.assign(loadingOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'none', justifyContent: 'center',
        alignItems: 'center', zIndex: '99999'
    });
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

window.addEventListener('DOMContentLoaded', () => {
    setupSystemEventHandlers();
    loadInventoryFromGoogleSheets();
});

async function loadInventoryFromGoogleSheets() {
    showLoading("Syncing live spreadsheet...");
    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        const rawCsvText = await response.text(); 

        Papa.parse(rawCsvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                rawHeaders = Object.keys(results.data[0]);
                headerMapping = {};
                targetHeadersLowercase.forEach(target => {
                    const actualKey = rawHeaders.find(h => {
                        const normH = h.toLowerCase().trim();
                        const normT = target.toLowerCase().trim();
                        return normH.includes(normT) || normT.includes(normH);
                    });
                    headerMapping[target] = actualKey || target; 
                });
                
                inventoryData = results.data.map((row, idx) => ({ ...row, _rowId: idx }));
                initializeSystemUI();
                hideLoading();
            }
        });
    } catch (err) {
        hideLoading();
        console.error(err);
    }
}

function initializeSystemUI() {
    renderHeaders(displayHeaders);
    executeSearch();
}

function renderHeaders(headers) {
    if(!tableHeaderRow) return; tableHeaderRow.innerHTML = '';
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        // Apply class mapping
        if (h.toLowerCase().includes('description')) th.className = 'col-description';
        else if (h.toLowerCase().includes('remarks')) th.className = 'col-remarks';
        else if (h.toLowerCase().includes('last update')) th.className = 'col-last-update'; // Wraps
        else th.className = 'col-other';
        tableHeaderRow.appendChild(th);
    });
}

function getDirectImageUrl(driveLink) {
    if (!driveLink || typeof driveLink !== 'string') return null;
    const match = driveLink.match(/[-\w]{25,}/); 
    return match ? `https://drive.google.com/thumbnail?id=${match[0]}&sz=w200-h200` : null;
}

function renderTable(data) {
    if(!tableBody) return; tableBody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        targetHeadersLowercase.forEach(tKey => {
            const td = document.createElement('td');
            const resolvedKey = headerMapping[tKey];
            
            // Apply text wrapping class for "Last Update"
            if (tKey.includes('last update')) td.className = 'col-last-update';
            else if (tKey.includes('description')) td.className = 'col-description';
            else td.className = 'col-other';

            if (tKey.includes('photo') || tKey.includes('map coordinates')) {
                const url = resolvedKey ? (row[resolvedKey] || '') : '';
                if (url.trim() !== '') {
                    const imgUrl = getDirectImageUrl(url) || url;
                    td.innerHTML = `<a href="${url}" target="_blank"><img src="${imgUrl}" alt="Img" style="height:50px; width:50px; object-fit:cover; border:1px solid #ccc;"></a>`;
                } else {
                    td.textContent = '-';
                }
            } else {
                td.textContent = resolvedKey ? (row[resolvedKey] || '') : '';
            }
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

function setupSystemEventHandlers() {
    // IMAGE-FRIENDLY EXPORT
    if(exportButton) {
        exportButton.addEventListener('click', () => {
            if(inventoryData.length === 0) return;
            let html = `<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${displayHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
            inventoryData.forEach(row => {
                html += '<tr>';
                targetHeadersLowercase.forEach(tKey => {
                    const val = row[headerMapping[tKey]] || '';
                    if (tKey.includes('photo') || tKey.includes('map coordinates')) {
                        const imgUrl = getDirectImageUrl(val) || val;
                        html += `<td>${val ? `<img src="${imgUrl}" width="100" height="100">` : 'No Photo'}</td>`;
                    } else {
                        html += `<td>${val}</td>`;
                    }
                });
                html += '</tr>';
            });
            html += '</tbody></table></body></html>';
            const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "inventory_export.xls";
            link.click();
        });
    }

    if(searchButton) searchButton.addEventListener('click', executeSearch);
    // ... (rest of your event listeners for filtering, etc.)
}

function executeSearch() {
    // ... (Your search filtering logic here)
    renderTable(inventoryData); // Simplified for this snippet
}
