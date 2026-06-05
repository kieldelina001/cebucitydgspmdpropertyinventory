// 🔑 Google Sheets Cloud Gateway Architecture
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const BACKUP_FILE_NAME = "real_estate_inventory_backup.csv"; 

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

const countTotal = document.getElementById('countTotal');
const countExisting = document.getElementById('countExisting');
const countNotFound = document.getElementById('countNotFound');
const countVerification = document.getElementById('countVerification');
const countWithPhotos = document.getElementById('countWithPhotos');
const foundCountDisplay = document.getElementById('foundCountDisplay');

// Dashboard Type elements (All 13 Categories Retained)
const countBuilding = document.getElementById('countBuilding');
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

const editModal = document.getElementById('editModal');
const modalFormContainer = document.getElementById('modalFormContainer');
const modalEditBtn = document.getElementById('modalEditBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn'); 

// ⏳ FOOLPROOF LOADING OVERLAY
let loadingOverlay = document.getElementById('dynamicLoadingOverlay');
if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dynamicLoadingOverlay';
    loadingOverlay.innerHTML = `<div style="text-align: center; color: white !important; z-index: 100000 !important;"><div style="width: 60px !important; height: 60px !important; border: 6px solid rgba(255,255,255,0.2) !important; border-radius: 50% !important; border-top-color: #ffffff !important; animation: spin 0.8s linear infinite !important; margin: 0 auto 20px auto !important;"></div><div id="loadingOverlayText" style="font-size: 20px !important; font-weight: bold !important;">Connecting...</div></div>`;
    Object.assign(loadingOverlay.style, { position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'none', justifyContent: 'center', alignItems: 'center', zIndex: '999999' });
    const styleSheet = document.createElement("style");
    styleSheet.innerText = "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
    document.head.appendChild(styleSheet);
    document.body.appendChild(loadingOverlay);
}

function showLoading(msg) { const textEl = document.getElementById('loadingOverlayText'); if (textEl) textEl.textContent = msg; loadingOverlay.style.setProperty('display', 'flex', 'important'); }
function hideLoading() { loadingOverlay.style.setProperty('display', 'none', 'important'); }

// Custom Name Modal
let customNameModal = document.getElementById('customNameModal');
if (!customNameModal) {
    customNameModal = document.createElement('div');
    customNameModal.id = 'customNameModal';
    customNameModal.innerHTML = `<div style="background: white !important; padding: 30px !important; border-radius: 8px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important; width: 90% !important; max-width: 400px !important; text-align: center !important;"><label style="font-size: 18px !important; font-weight: bold !important; margin-bottom: 15px !important; display: block !important;">Enter Your Name:</label><input type="text" id="custom-operator-input" value="Noel Rie N. Deliña" style="width: 100% !important; padding: 12px !important; margin-bottom: 20px !important; border: 1px solid #ccc !important;" /><div style="display: flex !important; gap: 10px !important; justify-content: center !important;"><button id="customCancelNameBtn" style="background: #6c757d !important; color: white !important; padding: 10px 20px !important; border: none !important; border-radius: 4px !important; cursor: pointer !important;">Cancel</button><button id="customConfirmNameBtn" style="background: #28a745 !important; color: white !important; padding: 10px 20px !important; border: none !important; border-radius: 4px !important; cursor: pointer !important;">Confirm</button></div></div>`;
    Object.assign(customNameModal.style, { position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'none', justifyContent: 'center', alignItems: 'center', zIndex: '99999' });
    document.body.appendChild(customNameModal);
}

window.addEventListener('DOMContentLoaded', () => { setupSystemEventHandlers(); loadInventoryFromGoogleSheets(); });

async function loadInventoryFromGoogleSheets() {
    statusBanner.style.backgroundColor = "#fff3cd"; statusBanner.textContent = "Connecting...";
    showLoading("Syncing live spreadsheet...");
    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        const rawCsvText = await response.text(); 
        Papa.parse(rawCsvText, {
            header: true, skipEmptyLines: true,
            complete: function(results) {
                if (results.data && results.data.length > 0) {
                    rawHeaders = Object.keys(results.data[0]);
                    headerMapping = {};
                    
                    // Enhanced robust fuzzy-matching logic for column headers
                    targetHeadersLowercase.forEach(target => {
                        const actualKey = rawHeaders.find(h => {
                            const normH = h.toLowerCase().trim();
                            const normT = target.toLowerCase().trim();
                            return normH.includes(normT) || normT.includes(normH) || 
                                   (normT === 'article/item' && normH === 'article');
                        });
                        headerMapping[target] = actualKey || target; 
                    });
                    
                    inventoryData = results.data.map((row, idx) => { row._rowId = idx; return row; });
                    initializeSystemUI();
                }
                hideLoading();
            }
        });
    } catch (err) { hideLoading(); statusBanner.textContent = "Connection Error."; }
}

function initializeSystemUI() {
    statusBanner.style.backgroundColor = "#d4edda"; statusBanner.textContent = "✅ Connected to Google Sheets.";
    populateDropdown('remarks', remarksFilter, '-- All Remarks --');
    populateDropdown('type', typeFilter, '-- All Types --');
    renderHeaders(displayHeaders);
    calculateStaticDashboardTotals(inventoryData);
    executeSearch();
}

function populateDropdown(type, selectEl, placeholderText) {
    if(!selectEl) return;
    selectEl.innerHTML = `<option value="ALL">${placeholderText}</option>`;
    const sheetKey = headerMapping[type];
    if(!sheetKey) return;
    let elements = new Set();
    inventoryData.forEach(row => { const val = String(row[sheetKey] || '').trim(); if(val) elements.add(val); });
    const sorted = Array.from(elements).sort();
    if(type === 'remarks') parsedUniqueRemarks = sorted;
    sorted.forEach(val => { const opt = document.createElement('option'); opt.value = val; opt.textContent = val; selectEl.appendChild(opt); });
}

function renderHeaders(headers) {
    if(!tableHeaderRow) return; tableHeaderRow.innerHTML = '';
    headers.forEach(h => {
        const th = document.createElement('th'); th.textContent = h;
        tableHeaderRow.appendChild(th);
    });
}

function getDirectImageUrl(driveLink) {
    if (!driveLink || typeof driveLink !== 'string') return null;
    const match = driveLink.match(/[-\w]{25,}/); 
    if (match) return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w200-h200`;
    return null;
}

function renderTable(data) {
    if(!tableBody) return; tableBody.innerHTML = '';
    if(data.length === 0) { tableBody.innerHTML = `<tr><td colspan="${displayHeaders.length}" class="no-data">No records match.</td></tr>`; return; }
    data.forEach(row => {
        const tr = document.createElement('tr'); tr.setAttribute('data-id', row._rowId);
        targetHeadersLowercase.forEach(tKey => {
            const td = document.createElement('td');
            const resolvedKey = headerMapping[tKey];
            if (tKey === 'photolink') {
                const url = resolvedKey ? (row[resolvedKey] || '') : '';
                if (url.trim() !== '') td.innerHTML = `<a href="${url}" target="_blank"><img src="${getDirectImageUrl(url) || url}" alt="Preview" style="height:50px; width:80px; object-fit:cover;"></a>`;
                else td.textContent = 'No Photo';
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
    if(!countTotal) return; countTotal.textContent = items.length;
    const rKey = headerMapping['remarks'];
    const tKey = headerMapping['type'];
    const pKey = headerMapping['photolink'];
    let active = 0, missing = 0, pending = 0, photo = 0;
    
    let typeCounts = { 
        building: 0, flood: 0, hospital: 0, land: 0, market: 0, 
        otherInfra: 0, otherLand: 0, otherStruct: 0, park: 0, 
        road: 0, school: 0, slaughterhouse: 0, water: 0 
    };
    
    items.forEach(row => {
        const remVal = rKey ? String(row[rKey]).toLowerCase() : '';
        const typeVal = tKey ? String(row[tKey]).toLowerCase() : '';
        const photoVal = pKey ? String(row[pKey] || '').trim() : '';
        
        if(remVal.includes('existing') || typeVal.includes('existing')) active++;
        if(remVal.includes('not found')) missing++;
        if(remVal.includes('for verification') || remVal.includes('verification')) pending++;
        if(photoVal !== '') photo++;
        
        // Split-matching structures to maintain unique classification bounds
        if(typeVal.includes('school')) typeCounts.school++;
        else if(typeVal.includes('building')) typeCounts.building++; 
        else if(typeVal.includes('flood')) typeCounts.flood++;
        else if(typeVal.includes('hospital') || typeVal.includes('health')) typeCounts.hospital++;
        else if(typeVal.includes('market')) typeCounts.market++;
        else if(typeVal.includes('park') || typeVal.includes('plaza') || typeVal.includes('monument')) typeCounts.park++;
        else if(typeVal.includes('road')) typeCounts.road++;
        else if(typeVal.includes('slaughterhouse')) typeCounts.slaughterhouse++;
        else if(typeVal.includes('water')) typeCounts.water++;
        else if(typeVal.includes('other infrastructure')) typeCounts.otherInfra++;
        else if(typeVal.includes('other land improvement')) typeCounts.otherLand++;
        else if(typeVal.includes('other structure')) typeCounts.otherStruct++;
        else if(typeVal.includes('land')) typeCounts.land++; 
    });
    
    if(countExisting) countExisting.textContent = active;
    if(countNotFound) countNotFound.textContent = missing;
    if(countVerification) countVerification.textContent = pending;
    if(countWithPhotos) countWithPhotos.textContent = photo;
    
    if(countBuilding) countBuilding.textContent = typeCounts.building;
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
        const wrapper = document.createElement('div');
        wrapper.className = 'modal-field';
        const label = document.createElement('label'); label.textContent = displayHeaders[targetHeadersLowercase.indexOf(tKey)];
        const fieldEl = (tKey === 'remarks') ? document.createElement('select') : (tKey === 'description' ? document.createElement('textarea') : document.createElement('input'));
        if(tKey === 'remarks') {
            parsedUniqueRemarks.forEach(rem => { const opt = document.createElement('option'); opt.value = rem; opt.textContent = rem; if(rem === currentVal) opt.selected = true; fieldEl.appendChild(opt); });
        } else {
            fieldEl.value = currentVal;
        }
        fieldEl.id = 'modal-input-' + tKey.replace('/', ''); fieldEl.disabled = true;
        wrapper.appendChild(label); wrapper.appendChild(fieldEl);
        modalFormContainer.appendChild(wrapper);
    });
    if(uploadPhotoBtn) uploadPhotoBtn.style.display = 'inline-block';
    if(modalEditBtn) modalEditBtn.style.display = 'inline-block';
    if(modalSaveBtn) modalSaveBtn.style.display = 'none';
    if(editModal) editModal.style.display = 'flex';
}

function setupSystemEventHandlers() {
    if(modalEditBtn) modalEditBtn.addEventListener('click', () => { document.getElementById('modal-input-remarks').disabled = false; modalEditBtn.style.display = 'none'; modalSaveBtn.style.display = 'inline-block'; });
    if(modalSaveBtn) modalSaveBtn.addEventListener('click', () => { editModal.style.display = 'none'; customNameModal.style.display = 'flex'; });
    document.getElementById('customConfirmNameBtn').onclick = () => { customNameModal.style.display = 'none'; transmitUpdateToCloud(document.getElementById('modal-input-remarks').value, document.getElementById('custom-operator-input').value); };
    document.getElementById('customCancelNameBtn').onclick = () => { customNameModal.style.display = 'none'; editModal.style.display = 'flex'; };
    if(modalCloseBtn) modalCloseBtn.addEventListener('click', () => { editModal.style.display = 'none'; });
    if(exportButton) exportButton.addEventListener('click', () => { const cleanRows = inventoryData.map(r => { const copy = {...r}; delete copy._rowId; return copy; }); const blob = new Blob([Papa.unparse(cleanRows)], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = BACKUP_FILE_NAME; link.click(); });
    searchButton.addEventListener('click', executeSearch);
    [remarksFilter, typeFilter, photoFilter].forEach(f => f.addEventListener('change', executeSearch));
}

// 🚀 FIXED ARCHITECTURE FUNCTION: Resolves Google Redirect Blockades & Column Matching
async function transmitUpdateToCloud(remark, user) {
    const activeRecord = inventoryData.find(r => r._rowId === activeEditIndex);
    if (!activeRecord) {
        console.error("No active property profile loaded.");
        return;
    }
    
    // Safety check fallback to locate key identification parameters dynamically
    const aKey = headerMapping['article/item'] || headerMapping['article'] || Object.keys(activeRecord)[0];
    const itemIdentifierValue = activeRecord[aKey] || '';

    const bodyParams = new URLSearchParams();
    bodyParams.append("article", itemIdentifierValue); 
    bodyParams.append("remarks", remark); 
    bodyParams.append("updatedby", user);
    
    showLoading("Publishing update...");
    try { 
        // Adding mode: "no-cors" avoids strict origin checking failures triggered by 
        // the 302 temporary redirects used across Google macro script environments.
        await fetch(GOOGLE_APPS_SCRIPT_URL, { 
            method: "POST", 
            mode: "no-cors",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: bodyParams.toString()
        }); 
        
        // Re-sync presentation layer
        setTimeout(loadInventoryFromGoogleSheets, 1200); 
    } catch(e) { 
        console.error("Data submission error logged:", e); 
        setTimeout(loadInventoryFromGoogleSheets, 1000); 
    }
}

function executeSearch() {
    const term = searchInput.value.toLowerCase().trim();
    const remarkSel = remarksFilter.value;
    const typeSel = typeFilter.value;
    const photoSel = photoFilter.value;
    let filtered = inventoryData;
    if(remarkSel !== "ALL") filtered = filtered.filter(row => (row[headerMapping['remarks']] || '').trim() === remarkSel);
    if(typeSel !== "ALL") filtered = filtered.filter(row => (row[headerMapping['type']] || '').trim() === typeSel);
    if(photoSel !== "ALL") filtered = filtered.filter(row => (String(row[headerMapping['photolink']] || '').trim() !== '') === (photoSel === "WITH_PHOTO"));
    if(term) filtered = filtered.filter(row => rawHeaders.some(h => String(row[h]).toLowerCase().includes(term)));
    if(foundCountDisplay) foundCountDisplay.textContent = `(Showing ${filtered.length} matching records)`;
    renderTable(filtered);
}
