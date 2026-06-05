// 🔑 Google Sheets Cloud Gateway Architecture
// REPLACE THIS URL AFTER YOU DEPLOY YOUR NEW APP SCRIPT
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const BACKUP_FILE_NAME = "real_estate_inventory_backup.csv"; 

// Updated to include PhotoLink
const displayHeaders = ["Article", "Description", "Acquisition Date", "Unit Value", "Remarks", "Type", "PhotoLink", "UPDATED BY", "LAST UPDATE"];
const targetHeadersLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type", "photolink", "updated by", "last update"];
const popupOrderLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type"]; 

let inventoryData = []; 
let rawHeaders = [];       
let headerMapping = {}; 
let activeEditIndex = null; 
let parsedUniqueRemarks = []; 

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const exportButton = document.getElementById('exportButton');
const remarksFilter = document.getElementById('remarksFilter');
const typeFilter = document.getElementById('typeFilter');
const photoFilter = document.getElementById('photoFilter');
const tableHeaderRow = document.getElementById('tableHeaderRow');
const tableBody = document.getElementById('tableBody');
const statusBanner = document.getElementById('statusBanner');
const searchResultCount = document.getElementById('searchResultCount'); // NEW: Added Reference

// Dashboard 1 Elements
const countTotal = document.getElementById('countTotal');
const countExisting = document.getElementById('countExisting');
const countNotFound = document.getElementById('countNotFound');
const countVerification = document.getElementById('countVerification');
const countWithPhotos = document.getElementById('countWithPhotos');

// Dashboard 2 Elements
const typeDashboardContainer = document.getElementById('typeDashboardContainer'); // NEW: Added Reference

const editModal = document.getElementById('editModal');
const modalFormContainer = document.getElementById('modalFormContainer');
const modalEditBtn = document.getElementById('modalEditBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn'); 

// ⏳ FOOLPROOF LOADING OVERLAY GENERATOR
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
        alignItems: 'center', zIndex: '999999', transition: 'opacity 0.2s ease'
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

// 🎯 DYNAMIC DEAD-CENTER CUSTOM NAME POPUP
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
                        const actualKey = rawHeaders.find(h => h.toLowerCase().trim().includes(target));
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
    if (remarksFilter) remarksFilter.disabled = false;
    if (typeFilter) typeFilter.disabled = false;
    if (photoFilter) photoFilter.disabled = false;
    if (searchInput) searchInput.placeholder = "Type keywords...";

    populateDropdown('remarks', remarksFilter, '-- All Remarks --');
    populateDropdown('type', typeFilter, '-- All Types --');
    renderHeaders(displayHeaders);
    calculateStaticDashboardTotals(inventoryData);
    calculateTypeDashboardTotals(inventoryData); // NEW: Build the Type Dashboard
    executeSearch();
}

function populateDropdown(type, selectEl, placeholderText) {
    if(!selectEl) return;
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
}

function renderHeaders(headers) {
    if(!tableHeaderRow) return; tableHeaderRow.innerHTML = '';
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        if (h.toLowerCase().includes('description')) th.className = 'col-description';
        else if (h.toLowerCase().includes('remarks')) th.className = 'col-remarks';
        else if (h.toLowerCase().includes('type')) th.className = 'col-type'; 
        else th.className = 'col-other';
        tableHeaderRow.appendChild(th);
    });
}

/** Helper to parse a drive link and return a direct viewable thumbnail URL */
function getDirectImageUrl(driveLink) {
    if (!driveLink || typeof driveLink !== 'string') return null;
    const match = driveLink.match(/[-\w]{25,}/); // extracts Drive file ID
    if (match) {
        return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w200-h200`;
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
            
            // Photo Preview Logic
            if (tKey === 'photolink') {
                const url = resolvedKey ? (row[resolvedKey] || '') : '';
                if (url.trim() !== '') {
                    const imgUrl = getDirectImageUrl(url) || url;
                    td.innerHTML = `<a href="${url}" target="_blank"><img src="${imgUrl}" alt="Preview" style="height:50px; max-width:80px; object-fit:cover; border:1px solid #ccc; border-radius:4px;"></a>`;
                } else {
                    td.textContent = 'No Photo';
                }
                td.className = 'col-other';
            } else {
                td.textContent = resolvedKey ? (row[resolvedKey] || '') : '';
                if (tKey.includes('description')) td.className = 'col-description';
                else if (tKey.includes('remarks')) td.className = 'col-remarks';
                else if (tKey.includes('type')) td.className = 'col-type'; 
                else td.className = 'col-other';
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
    const pKey = headerMapping['photolink'];
    
    let activeCount = 0, missingCount = 0, pendingCount = 0, photoCount = 0;
    
    items.forEach(row => {
        const remVal = rKey ? String(row[rKey]).toLowerCase() : '';
        const typeVal = tKey ? String(row[tKey]).toLowerCase() : '';
        const photoVal = pKey ? String(row[pKey] || '').trim() : '';
        
        if(remVal.includes('existing') || typeVal.includes('existing')) activeCount++;
        if(remVal.includes('not found')) missingCount++;
        if(remVal.includes('for verification') || remVal.includes('verification')) pendingCount++;
        
        // Count entries with non-empty Photo links
        if(photoVal !== '') photoCount++;
    });
    
    if(countExisting) countExisting.textContent = activeCount;
    if(countNotFound) countNotFound.textContent = missingCount;
    if(countVerification) countVerification.textContent = pendingCount;
    if(countWithPhotos) countWithPhotos.textContent = photoCount;
}

// NEW: Dynamically build the "Items by Type" dashboard based on live values
function calculateTypeDashboardTotals(items) {
    if (!typeDashboardContainer) return;
    typeDashboardContainer.innerHTML = ''; // Clear previous entries
    const tKey = headerMapping['type'];
    if (!tKey) return;

    const typeCounts = {};
    
    // Tally up items by their type
    items.forEach(row => {
        let typeVal = String(row[tKey] || '').trim();
        if (!typeVal) typeVal = "Uncategorized"; // Fallback for blank type fields
        typeCounts[typeVal] = (typeCounts[typeVal] || 0) + 1;
    });

    // Sort categories alphabetically
    const sortedTypes = Object.keys(typeCounts).sort();

    // Create a card for each discovered type
    sortedTypes.forEach(type => {
        const count = typeCounts[type];
        const card = document.createElement('div');
        card.className = 'dash-card card-type'; // Apply our new purple styling
        card.innerHTML = `
            <div class="dash-title">${type}</div>
            <div class="dash-value">${count}</div>
        `;
        typeDashboardContainer.appendChild(card);
    });
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
            fieldEl.rows = 3; fieldEl.value = currentVal;
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
            const aKey = headerMapping['article/item'] || headerMapping['article'];
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

    if(modalCloseBtn) modalCloseBtn.addEventListener('click', () => {
        if(editModal) editModal.style.display = 'none';
    });

    if(exportButton) {
        exportButton.addEventListener('click', () => {
            if(inventoryData.length === 0) return;
            const cleanRows = inventoryData.map(r => { const copy = {...r}; delete copy._rowId; return copy; });
            const blob = new Blob([Papa.unparse(cleanRows)], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.setAttribute('href', URL.createObjectURL(blob));
            link.setAttribute('download', BACKUP_FILE_NAME);
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        });
    }

    if(searchButton) searchButton.addEventListener('click', executeSearch);
    if(searchInput) searchInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') executeSearch(); });
    if(remarksFilter) remarksFilter.addEventListener('change', executeSearch);
    if(typeFilter) typeFilter.addEventListener('change', executeSearch);
    if(photoFilter) photoFilter.addEventListener('change', executeSearch);
}

async function transmitUpdateToCloud(remark, user) {
    const activeRecord = inventoryData.find(r => r._rowId === activeEditIndex);
    const aKey = headerMapping['article/item'] || headerMapping['article'];
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
    const pKey = headerMapping['photolink'];
    
    let filtered = inventoryData;
    if(remarkSel !== "ALL" && rKey) filtered = filtered.filter(row => (row[rKey] || '').trim() === remarkSel);
    if(typeSel !== "ALL" && tKey) filtered = filtered.filter(row => (row[tKey] || '').trim() === typeSel);
    
    // Media filtering logic
    if(photoSel !== "ALL" && pKey) {
        filtered = filtered.filter(row => {
            const hasPhoto = String(row[pKey] || '').trim() !== '';
            return photoSel === "WITH_PHOTO" ? hasPhoto : !hasPhoto;
        });
    }
    
    if(term) filtered = filtered.filter(row => rawHeaders.some(h => String(row[h]).toLowerCase().includes(term)));
    
    // NEW: Update the search result badge next to the table
    if (searchResultCount) {
        searchResultCount.style.display = 'inline-block';
        searchResultCount.textContent = `Showing ${filtered.length} of ${inventoryData.length} items`;
    }

    renderTable(filtered);
}
