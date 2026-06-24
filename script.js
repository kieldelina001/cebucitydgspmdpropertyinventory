// 🔑 Google Sheets Cloud Gateway Architecture
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

const displayHeaders = ["Article", "Description", "Acquisition Date", "Unit Value", "Remarks", "Type", "Photo 1", "Photo 2", "Map Coordinates", "UPDATED BY", "LAST UPDATE"];
const targetHeadersLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type", "photo 1", "photo 2", "map coordinates", "updated by", "last update"];
const popupOrderLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type"]; 

let inventoryData = []; 
let currentFilteredData = []; 
let rawHeaders = [];       
let headerMapping = {}; 
let activeEditIndex = null; 
let parsedUniqueRemarks = []; 
let isAppInitialized = false; // Flag to track startup state

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

// Dashboard elements
const countTotal = document.getElementById('countTotal');
const countExisting = document.getElementById('countExisting');
const countNotFound = document.getElementById('countNotFound');
const countVerification = document.getElementById('countVerification');
const countWithPhotos = document.getElementById('countWithPhotos');
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
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn'); 

// ⏳ LOADING OVERLAY GENERATOR
let loadingOverlay = document.getElementById('dynamicLoadingOverlay');
if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dynamicLoadingOverlay';
    loadingOverlay.innerHTML = `
        <div style="text-align: center; color: #ffffff !important; font-family: Arial, sans-serif !important; z-index: 100000 !important;">
            <div style="width: 60px !important; height: 60px !important; border: 6px solid rgba(255,255,255,0.2) !important; border-radius: 50% !important; border-top-color: #ffffff !important; animation: spin 0.8s linear infinite !important; margin: 0 auto 20px auto !important;"></div>
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

// 🎯 NAME POPUP MODAL
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
        alignItems: 'center', zIndex: '99999'
    });
    document.body.appendChild(customNameModal);
}

window.addEventListener('DOMContentLoaded', () => {
    setupSystemEventHandlers();
    loadInventoryFromGoogleSheets();
});

async function loadInventoryFromGoogleSheets() {
    statusBanner.style.backgroundColor = "#fff3cd";
    statusBanner.style.color = "#856404";
    statusBanner.textContent = "Connecting to Google Sheets Live Datastream...";
    showLoading("Syncing live spreadsheet grid...");

    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        if (!response.ok) throw new Error("Could not connect to online Sheet feed.");
        const rawCsvText = await response.text(); 

        Papa.parse(rawCsvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (results.data && results.data.length > 0) {
                    rawHeaders = Object.keys(results.data[0]);
                    headerMapping = {};
                    
                    targetHeadersLowercase.forEach(target => {
                        const actualKey = rawHeaders.find(h => {
                            const normH = h.toLowerCase().trim();
                            const normT = target.toLowerCase().trim();
                            return normH.includes(normT) || normT.includes(normH) || 
                                   (normT === 'article/item' && normH === 'article');
                        });
                        headerMapping[target] = actualKey || target; 
                    });
                    
                    inventoryData = results.data.map((row, idx) => {
                        row._rowId = idx;
                        return row;
                    });
                    initializeSystemUI();
                } else {
                    throw new Error("Target dataset sheet contains no metrics.");
                }
                hideLoading();
            }
        });
    } catch (err) {
        hideLoading();
        statusBanner.style.backgroundColor = "#f8d7da";
        statusBanner.style.color = "#721c24";
        statusBanner.textContent = "Connection Error: Check Sheet spreadsheet access permission configuration.";
        console.error(err);
    }
}

function initializeSystemUI() {
    statusBanner.style.backgroundColor = "#d4edda";
    statusBanner.style.color = "#155724";
    statusBanner.textContent = "✅ Connected to Google Sheets: Live View Active.";

    if (searchInput) searchInput.disabled = false;
    if (searchButton) searchButton.disabled = false;
    if (exportButton) exportButton.disabled = false;
    if (exportFilteredButton) exportFilteredButton.disabled = false;
    if (remarksFilter) remarksFilter.disabled = false;
    if (typeFilter) typeFilter.disabled = false;
    if (photoFilter) photoFilter.disabled = false;
    if (searchInput) searchInput.placeholder = "Type keywords...";

    populateDropdown('remarks', remarksFilter, '-- All Remarks --');
    populateDropdown('type', typeFilter, '-- All Types --');
    renderHeaders(displayHeaders);
    calculateStaticDashboardTotals(inventoryData);
    
    // Check if this is the very first time the app is loading
    if (!isAppInitialized) {
        currentFilteredData = []; 
        if(tableBody) {
            tableBody.innerHTML = `<tr><td colspan="${displayHeaders.length}" class="no-data">Data loaded successfully. Apply a filter or search to view records.</td></tr>`;
        }
        if (foundCountDisplay) {
            foundCountDisplay.textContent = `(0 items displayed)`;
        }
        isAppInitialized = true;
    } else {
        // If data is reloading (e.g., after saving a change or closing modal), re-apply the current search filters
        executeSearch();
    }
}

function populateDropdown(type, selectEl, placeholderText) {
    if(!selectEl) return;
    const previousSelection = selectEl.value;
    selectEl.innerHTML = `<option value="ALL">${placeholderText}</option>`;
    const sheetKey = headerMapping[type];
    if(!sheetKey) return;
    
    let elements = new Set();
    inventoryData.forEach(row => {
        const val = String(row[sheetKey] || '').trim();
        if(val) elements.add(val);
    });
    
    const sorted = Array.from(elements).sort();
    if(type === 'remarks') parsedUniqueRemarks = sorted;
    
    sorted.forEach(val => {
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = val;
        selectEl.appendChild(opt);
    });

    if(previousSelection && Array.from(selectEl.options).some(opt => opt.value === previousSelection)) {
        selectEl.value = previousSelection;
    }
}

function renderHeaders(headers) {
    if(!tableHeaderRow) return; tableHeaderRow.innerHTML = '';
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        tableHeaderRow.appendChild(th);
    });
}

function getDirectImageUrl(driveLink, sizeString = 'w200-h200') {
    if (!driveLink || typeof driveLink !== 'string') return null;
    const match = driveLink.match(/[-\w]{25,}/); 
    if (match) {
        return `https://drive.google.com/thumbnail?id=${match[0]}&sz=${sizeString}`;
    }
    return null;
}

function renderTable(data) {
    if(!tableBody) return; tableBody.innerHTML = '';
    if(data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${displayHeaders.length}" class="no-data">No records match the active matrix search filters.</td></tr>`;
        return;
    }
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', row._rowId);
        targetHeadersLowercase.forEach(tKey => {
            const td = document.createElement('td');
            const resolvedKey = headerMapping[tKey];
            
            if (tKey.includes('photo') || tKey.includes('map coordinates')) {
                const url = resolvedKey ? (row[resolvedKey] || '') : '';
                if (url.trim() !== '') {
                    const imgUrl = getDirectImageUrl(url, 'w200-h200') || url;
                    td.innerHTML = `<a href="${url}" target="_blank"><img src="${imgUrl}" alt="Preview" style="height:50px; max-width:80px; object-fit:cover; border:1px solid #ccc; border-radius:4px;"></a>`;
                } else {
                    td.textContent = 'No Photo';
                }
            } else {
                td.textContent = resolvedKey ? (row[resolvedKey] || '') : '';
            }
            
            tr.appendChild(td);
        });
        tr.addEventListener('click', () => openPopUp(row._rowId));
        tableBody.appendChild(tr);
    });
}

function calculateStaticDashboardTotals(items) {
    if(!countTotal) return;
    countTotal.textContent = items.length;
    
    const rKey = headerMapping['remarks'];
    const tKey = headerMapping['type'];
    const pKey1 = headerMapping['photo 1'];
    const pKey2 = headerMapping['photo 2'];
    const pKey3 = headerMapping['map coordinates'];
    
    let activeCount = 0, missingCount = 0, pendingCount = 0, photoCount = 0;
    
    let typeCounts = { 
        building: 0, assetMod: 0, flood: 0, hospital: 0, land: 0, market: 0, 
        otherInfra: 0, otherLand: 0, otherStruct: 0, park: 0, 
        road: 0, school: 0, slaughterhouse: 0, water: 0 
    };
    
    items.forEach(row => {
        const remVal = rKey ? String(row[rKey]).toLowerCase() : '';
        const typeVal = tKey ? String(row[tKey]).toLowerCase().trim() : '';
        
        const photoVal1 = pKey1 ? String(row[pKey1] || '').trim() : '';
        const photoVal2 = pKey2 ? String(row[pKey2] || '').trim() : '';
        const photoVal3 = pKey3 ? String(row[pKey3] || '').trim() : '';
        
        if(remVal.includes('existing') || typeVal.includes('existing')) activeCount++;
        if(remVal.includes('not found')) missingCount++;
        if(remVal.includes('for verification') || remVal.includes('verification')) pendingCount++;
        
        if(photoVal1 !== '' || photoVal2 !== '' || photoVal3 !== '') photoCount++;
        
        if (typeVal.includes('school') || typeVal.includes('school buildings')) {
            typeCounts.school++;
        } else if (typeVal.includes('asset modifications') || typeVal.includes('asset mod')) {
            typeCounts.assetMod++;
        } else if (typeVal.includes('other infrastructure') || typeVal.includes('other infra')) {
            typeCounts.otherInfra++;
        } else if (typeVal.includes('other land improvements') || typeVal.includes('other land imp')) {
            typeCounts.otherLand++;
        } else if (typeVal.includes('other structures') || typeVal.includes('other struct')) {
            typeCounts.otherStruct++;
        } else if (typeVal.includes('road') || typeVal.includes('road networks')) {
            typeCounts.road++;
        } else if (typeVal.includes('slaughterhouse') || typeVal.includes('slaughterhoues')) { 
            typeCounts.slaughterhouse++;
        } else if (typeVal.includes('water supply systems') || typeVal.includes('water systems') || typeVal.includes('water supply')) {
            typeCounts.water++;
        } else if (typeVal.includes('building')) {
            typeCounts.building++;
        } else if (typeVal.includes('flood')) {
            typeCounts.flood++;
        } else if (typeVal.includes('hospital') || typeVal.includes('health')) {
            typeCounts.hospital++;
        } else if (typeVal.includes('market')) {
            typeCounts.market++;
        } else if (typeVal.includes('park') || typeVal.includes('plaza')) {
            typeCounts.park++;
        } else if (typeVal.includes('land')) {
            typeCounts.land++;
        }
    });
    
    if(countExisting) countExisting.textContent = activeCount;
    if(countNotFound) countNotFound.textContent = missingCount;
    if(countVerification) countVerification.textContent = pendingCount;
    if(countWithPhotos) countWithPhotos.textContent = photoCount;
    
    if(countBuilding) countBuilding.textContent = typeCounts.building;
    if(countAssetMod) countAssetMod.textContent = typeCounts.assetMod; 
    if(countFlood) countFlood.textContent = typeCounts.flood;
    if(countHospital) countHospital.textContent = typeCounts.hospital;
    if(countLand) countLand.textContent = typeCounts.land;
    if(countMarket) countMarket.textContent = typeCounts.market;
    if(countOtherInfra) countOtherInfra.textContent = typeCounts.otherInfra;
    if(countOtherLand) countOtherLand.textContent = typeCounts.otherLand;
    if(countOtherStruct) countOtherStruct.textContent = typeCounts.otherStruct;
    if(countPark) countPark.textContent = typeCounts.park;
    if(countRoad) countRoad.textContent = typeCounts.road;
    if(countSchool) countSchool.textContent = typeCounts.school;
    if(countSlaughterhouse) countSlaughterhouse.textContent = typeCounts.slaughterhouse;
    if(countWater) countWater.textContent = typeCounts.water;
}

function openPopUp(rowId) {
    activeEditIndex = rowId;
    const itemData = inventoryData.find(r => r._rowId === rowId);
    if(!modalFormContainer) return; modalFormContainer.innerHTML = '';
    
    popupOrderLowercase.forEach(tKey => {
        const realKey = headerMapping[tKey];
        const currentVal = realKey ? (itemData[realKey] || '') : '';
        const idx = targetHeadersLowercase.indexOf(tKey);
        const labelText = displayHeaders[idx];
        
        const wrapper = document.createElement('div');
        wrapper.className = 'modal-field';
        let fieldEl;
        
        if(tKey === 'remarks') {
            fieldEl = document.createElement('select');
            parsedUniqueRemarks.forEach(rem => {
                const opt = document.createElement('option');
                opt.value = rem; opt.textContent = rem;
                if(rem === currentVal) opt.selected = true;
                fieldEl.appendChild(opt);
            });
            if(!currentVal) {
                const fallbackOpt = document.createElement('option');
                fallbackOpt.value = ''; fallbackOpt.textContent = '-- Choose Remark --'; fallbackOpt.selected = true;
                fieldEl.insertBefore(fallbackOpt, fieldEl.firstChild);
            }
        } else if(tKey === 'description') {
            fieldEl = document.createElement('textarea');
            fieldEl.rows = 4; fieldEl.value = currentVal;
        } else {
            fieldEl = document.createElement('input');
            fieldEl.type = 'text'; fieldEl.value = currentVal;
        }
        
        fieldEl.id = 'modal-input-' + tKey.replace('/', '');
        fieldEl.disabled = true;
        
        const label = document.createElement('label');
        label.textContent = labelText;
        wrapper.appendChild(label); wrapper.appendChild(fieldEl);
        modalFormContainer.appendChild(wrapper);
    });
    
    if(uploadPhotoBtn) uploadPhotoBtn.style.display = 'inline-block';
    if(modalEditBtn) modalEditBtn.style.display = 'inline-block';
    if(modalSaveBtn) modalSaveBtn.style.display = 'none';
    if(editModal) editModal.style.display = 'flex';
}

function setupSystemEventHandlers() {
    if(uploadPhotoBtn) {
        uploadPhotoBtn.addEventListener('click', () => {
            const activeRecord = inventoryData.find(r => r._rowId === activeEditIndex);
            const aKey = headerMapping['article/item'];
            const itemCode = encodeURIComponent(activeRecord[aKey] || 'unknown');
            window.open(`${GOOGLE_APPS_SCRIPT_URL}?itemCode=${itemCode}`, '_blank');
        });
    }

    if(modalEditBtn) {
        modalEditBtn.addEventListener('click', () => {
            const remInput = document.getElementById('modal-input-remarks');
            if(remInput) remInput.disabled = false;
            modalEditBtn.style.display = 'none';
            if(modalSaveBtn) modalSaveBtn.style.display = 'inline-block';
        });
    }

    if(modalSaveBtn) {
        modalSaveBtn.addEventListener('click', () => {
            const selection = document.getElementById('modal-input-remarks').value;
            if(editModal) editModal.style.display = 'none';
            if(customNameModal) customNameModal.style.display = 'flex';
            
            document.getElementById('customConfirmNameBtn').onclick = () => {
                let name = document.getElementById('custom-operator-input').value;
                if(!name || name.trim() === '') name = "Noel Rie N. Deliña";
                customNameModal.style.display = 'none';
                transmitUpdateToCloud(selection, name.trim());
            };
            
            document.getElementById('customCancelNameBtn').onclick = () => {
                customNameModal.style.display = 'none';
                if(editModal) editModal.style.display = 'flex';
            };
        });
    }

    if(modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            if(editModal) editModal.style.display = 'none';
            loadInventoryFromGoogleSheets();
        });
    }

    if(exportButton) exportButton.addEventListener('click', () => exportToCSV(inventoryData, "Real_Estate_Inventory_Full"));
    if(exportFilteredButton) exportFilteredButton.addEventListener('click', () => exportToHTML(currentFilteredData, "Real_Estate_Inventory_Filtered"));

    if(searchButton) searchButton.addEventListener('click', executeSearch);
    if(searchInput) searchInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') executeSearch(); });
    if(remarksFilter) remarksFilter.addEventListener('change', executeSearch);
    if(typeFilter) typeFilter.addEventListener('change', executeSearch);
    if(photoFilter) photoFilter.addEventListener('change', executeSearch);
}

// EXPORT TO EXCEL/CSV
function exportToCSV(data, filename) {
    if(data.length === 0) { alert("No data available to export."); return; }
    
    let csvContent = displayHeaders.join(",") + "\n";
    
    data.forEach(row => {
        let rowData = targetHeadersLowercase.map(tKey => {
            const resolvedKey = headerMapping[tKey];
            let val = resolvedKey ? (row[resolvedKey] || '') : '';
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
        });
        csvContent += rowData.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().getTime()}.csv`;
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}

// EXPORT TO HTML (Visual & Print Optimized)
function exportToHTML(data, title) {
    if(data.length === 0) { alert("No data available to export."); return; }
    
    let tableHTML = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; background-color: #f8fafc; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { color: #1e293b; margin: 0; text-transform: uppercase; font-size: 24px; }
            .print-btn { display: block; margin: 0 auto 20px; padding: 10px 20px; font-size: 14px; font-weight: bold; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
            
            table { width: 100%; border-collapse: collapse; background-color: white; table-layout: fixed; word-wrap: break-word; }
            th, td { border: 1px solid #cbd5e1; padding: 5px; font-size: 14px; vertical-align: top; overflow-wrap: break-word; }
            th { background-color: #e2e8f0; font-size: 15px; font-weight: bold; }
            tr { page-break-inside: avoid; } 
            
            .photo-cell { text-align: center; vertical-align: middle; }
            img { max-width: 100%; max-height: 400px; object-fit: contain; border-radius: 4px; border: 1px solid #e2e8f0; page-break-inside: avoid; }
            
            /* Column Width Constraints to accommodate 14px font and prioritize Images */
            th:nth-child(1), td:nth-child(1) { width: 6%; }  /* Article */
            th:nth-child(2), td:nth-child(2) { width: 18%; } /* Description */
            th:nth-child(3), td:nth-child(3) { width: 8%; }  /* Acquisition Date */
            th:nth-child(4), td:nth-child(4) { width: 6%; }  /* Unit Value */
            th:nth-child(5), td:nth-child(5) { width: 7%; }  /* Remarks */
            th:nth-child(6), td:nth-child(6) { width: 8%; }  /* Type */
            th:nth-child(7), td:nth-child(7) { width: 13%; } /* Photo 1 */
            th:nth-child(8), td:nth-child(8) { width: 13%; } /* Photo 2 */
            th:nth-child(9), td:nth-child(9) { width: 13%; } /* Map Coordinates */
            th:nth-child(10), td:nth-child(10) { width: 5%; } /* UPDATED BY */
            th:nth-child(11), td:nth-child(11) { width: 5%; } /* LAST UPDATE */
            
            @media print { 
                @page { size: landscape; margin: 5mm; }
                .print-btn { display: none; } 
                body { background-color: white; margin: 0; }
            }
        </style>
    </head>
    <body>
        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <div class="header"><h1>${title}</h1><p>Generated on ${new Date().toLocaleDateString()}</p></div>
        <table><thead><tr>`;
    
    displayHeaders.forEach(h => { tableHTML += `<th>${h}</th>`; });
    tableHTML += `</tr></thead><tbody>`;
    
    data.forEach(row => {
        tableHTML += `<tr>`;
        targetHeadersLowercase.forEach(tKey => {
            const resolvedKey = headerMapping[tKey];
            const val = resolvedKey ? (row[resolvedKey] || '') : '';
            if (tKey.includes('photo') || tKey.includes('map coordinates')) {
                const imgUrl = getDirectImageUrl(val, 'w1000-h1000') || val;
                if (imgUrl.trim() !== '' && imgUrl.startsWith('http')) {
                    tableHTML += `<td class="photo-cell"><img src="${imgUrl}" /></td>`;
                } else {
                    tableHTML += `<td class="photo-cell">No Photo</td>`;
                }
            } else {
                tableHTML += `<td>${val}</td>`;
            }
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table></body></html>`;

    const blob = new Blob([tableHTML], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}_${new Date().getTime()}.html`;
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}

async function transmitUpdateToCloud(remark, user) {
    const activeRecord = inventoryData.find(r => r._rowId === activeEditIndex);
    const aKey = headerMapping['article/item'];
    const itemCode = String(activeRecord[aKey] || '').trim();

    const timestamp = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
    });

    const bodyParams = new URLSearchParams();
    bodyParams.append("article", itemCode);
    bodyParams.append("remarks", remark);
    bodyParams.append("updatedby", user);
    bodyParams.append("timestamp", timestamp);

    statusBanner.style.backgroundColor = "#ffeb3b";
    statusBanner.style.color = "#333";
    statusBanner.textContent = "Transmitting modifications to Google Apps Script gateway...";
    showLoading("Publishing updates...");
    
    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: bodyParams.toString()
        });
        setTimeout(() => { loadInventoryFromGoogleSheets(); }, 1200);
    } catch(e) {
        console.error(e);
        setTimeout(() => { loadInventoryFromGoogleSheets(); }, 1000);
    }
}

function executeSearch() {
    if(!searchInput || !remarksFilter || !typeFilter || !photoFilter) return;

    const term = searchInput.value.toLowerCase().trim();
    const remarkSel = remarksFilter.value;
    const typeSel = typeFilter.value;
    const photoSel = photoFilter.value;
    
    const rKey = headerMapping['remarks'];
    const tKey = headerMapping['type'];
    const pKey1 = headerMapping['photo 1'];
    const pKey2 = headerMapping['photo 2'];
    const pKey3 = headerMapping['map coordinates'];
    
    let filtered = inventoryData;

    if(remarkSel !== "ALL" && rKey) filtered = filtered.filter(row => (row[rKey] || '').trim() === remarkSel);
    if(typeSel !== "ALL" && tKey) filtered = filtered.filter(row => (row[tKey] || '').trim() === typeSel);
    
    if(photoSel !== "ALL") {
        filtered = filtered.filter(row => {
            const hasPhoto = (pKey1 && String(row[pKey1] || '').trim() !== '') ||
                             (pKey2 && String(row[pKey2] || '').trim() !== '') ||
                             (pKey3 && String(row[pKey3] || '').trim() !== '');
            return photoSel === "WITH_PHOTO" ? hasPhoto : !hasPhoto;
        });
    }
    
    if(term) {
        const searchWords = term.split(/\s+/).filter(word => word.length > 0);
        const requiredMatches = Math.min(searchWords.length, 2);

        filtered = filtered.filter(row => {
            const rowText = rawHeaders.map(h => String(row[h] || '').toLowerCase()).join(' ');
            let matchCount = 0;
            searchWords.forEach(word => {
                if (rowText.includes(word)) {
                    matchCount++;
                }
            });
            return matchCount >= requiredMatches;
        });
    }
    
    currentFilteredData = filtered; 
    renderTable(filtered);

    if (foundCountDisplay) {
        foundCountDisplay.textContent = `(${filtered.length} items found)`;
    }
}
