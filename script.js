// 🔑 Google Sheets Cloud Gateway Architecture[cite: 1]
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec";[cite: 1]
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";[cite: 1]
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;[cite: 1]

const displayHeaders = ["Article no./ TCT no.", "Description", "Acquisition Date", "Unit Value", "Remarks", "Type", "Photo 1", "Photo 2", "Map Coordinates", "Tax Declaration", "Transfer Certificate of Title Page 1", "Transfer Certificate of Title Page 2", "UPDATED BY", "LAST UPDATE"];[cite: 1]
const targetHeadersLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type", "photo 1", "photo 2", "map coordinates", "tax declaration", "transfer_cert1", "transfer_cert2", "updated by", "last update"];[cite: 1]
const popupOrderLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type"];[cite: 1]

let inventoryData = [];[cite: 1]
let currentFilteredData = [];[cite: 1]
let rawHeaders = [];[cite: 1]       
let headerMapping = {};[cite: 1]
let activeEditIndex = null;[cite: 1]
let parsedUniqueRemarks = [];[cite: 1]
let isAppInitialized = false;[cite: 1]
let modalModified = false;[cite: 1]

// Modal Photo Gallery State[cite: 1]
let modalPhotos = [];[cite: 1]
let currentPhotoIndex = 0;[cite: 1]

// Pagination Variables[cite: 1]
let currentPage = 1;[cite: 1]
const itemsPerPage = 50;[cite: 1]

const searchInput = document.getElementById('searchInput');[cite: 1]
const searchButton = document.getElementById('searchButton');[cite: 1]
const exportButton = document.getElementById('exportButton');[cite: 1]
const exportFilteredButton = document.getElementById('exportFilteredButton');[cite: 1]
const remarksFilter = document.getElementById('remarksFilter');[cite: 1]
const typeFilter = document.getElementById('typeFilter');[cite: 1]
const photoFilter = document.getElementById('photoFilter');[cite: 1]
const tableHeaderRow = document.getElementById('tableHeaderRow');[cite: 1]
const tableBody = document.getElementById('tableBody');[cite: 1]
const statusBanner = document.getElementById('statusBanner');[cite: 1]
const foundCountDisplay = document.getElementById('foundCountDisplay');[cite: 1]

// Pagination Elements[cite: 1]
const paginationContainer = document.getElementById('paginationContainer');[cite: 1]
const prevPageBtn = document.getElementById('prevPageBtn');[cite: 1]
const nextPageBtn = document.getElementById('nextPageBtn');[cite: 1]
const pageIndicator = document.getElementById('pageIndicator');[cite: 1]

// Dashboard elements[cite: 1]
const countTotal = document.getElementById('countTotal');[cite: 1]
const countExisting = document.getElementById('countExisting');[cite: 1]
const countNotFound = document.getElementById('countNotFound');[cite: 1]
const countVerification = document.getElementById('countVerification');[cite: 1]
const countWithPhotos = document.getElementById('countWithPhotos');[cite: 1]
const countTaxDec = document.getElementById('countTaxDec');[cite: 1]

const countBuilding = document.getElementById('countBuilding');[cite: 1]
const countAssetMod = document.getElementById('countAssetMod');[cite: 1]
const countFlood = document.getElementById('countFlood');[cite: 1]
const countHospital = document.getElementById('countHospital');[cite: 1]
const countLand = document.getElementById('countLand');[cite: 1]
const countMarket = document.getElementById('countMarket');[cite: 1]
const countOtherInfra = document.getElementById('countOtherInfra');[cite: 1]
const countOtherLand = document.getElementById('countOtherLand');[cite: 1]
const countOtherStruct = document.getElementById('countOtherStruct');[cite: 1]
const countPark = document.getElementById('countPark');[cite: 1]
const countRoad = document.getElementById('countRoad');[cite: 1]
const countSchool = document.getElementById('countSchool');[cite: 1]
const countSlaughterhouse = document.getElementById('countSlaughterhouse');[cite: 1]
const countWater = document.getElementById('countWater');[cite: 1]

// Modal elements[cite: 1]
const editModal = document.getElementById('editModal');[cite: 1]
const modalFormContainer = document.getElementById('modalFormContainer');[cite: 1]
const modalEditBtn = document.getElementById('modalEditBtn');[cite: 1]
const modalSaveBtn = document.getElementById('modalSaveBtn');[cite: 1]
const modalCloseBtn = document.getElementById('modalCloseBtn');[cite: 1]
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');[cite: 1]

// Tooltip Elements[cite: 1]
const tooltip = document.getElementById('imagePreviewTooltip');[cite: 1]
const tooltipImg = document.getElementById('imagePreviewTooltipImg');[cite: 1]

// ⏳ LOADING OVERLAY GENERATOR[cite: 1]
let loadingOverlay = document.getElementById('dynamicLoadingOverlay');[cite: 1]
if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');[cite: 1]
    loadingOverlay.id = 'dynamicLoadingOverlay';[cite: 1]
    loadingOverlay.innerHTML = `
    <div style="text-align: center; color: #ffffff !important; font-family: Arial, sans-serif !important; z-index: 100000 !important;">
        <div style="width: 80px !important; height: 80px !important; border: 8px solid rgba(255,255,255,0.2) !important; border-radius: 50% !important; border-top-color: #28a745 !important; animation: spin 0.4s linear infinite !important; margin: 0 auto 20px auto !important; box-shadow: 0 0 20px rgba(40, 167, 69, 0.6) !important;"></div>
        <div id="loadingOverlayText" style="font-size: 20px !important; font-weight: bold !important; color: #ffffff !important; text-shadow: 1px 1px 5px rgba(0,0,0,0.5) !important;">Connecting...</div>
    </div>
`;[cite: 1]
    Object.assign(loadingOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'none', justifyContent: 'center',
        alignItems: 'center', zIndex: '99999', transition: 'opacity 0.2s ease'
    });[cite: 1]
    const styleSheet = document.createElement("style");[cite: 1]
    styleSheet.innerText = "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";[cite: 1]
    document.head.appendChild(styleSheet);[cite: 1]
    document.body.appendChild(loadingOverlay);[cite: 1]
}

function showLoading(msg) {
    const textEl = document.getElementById('loadingOverlayText');[cite: 1]
    if (textEl) textEl.textContent = msg;[cite: 1]
    loadingOverlay.style.setProperty('display', 'flex', 'important');[cite: 1]
}

function hideLoading() {
    loadingOverlay.style.setProperty('display', 'none', 'important');[cite: 1]
}

// 🎯 NAME POPUP MODAL[cite: 1]
let customNameModal = document.getElementById('customNameModal');[cite: 1]
if (!customNameModal) {
    customNameModal = document.createElement('div');[cite: 1]
    customNameModal.id = 'customNameModal';[cite: 1]
    customNameModal.innerHTML = `
        <div style="background: #ffffff !important; padding: 30px !important; border-radius: 8px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important; width: 90% !important; max-width: 400px !important; box-sizing: border-box !important; text-align: center !important; font-family: Arial, sans-serif !important;">
            <label style="font-size: 18px !important; font-weight: bold !important; color: #333333 !important; display: block !important; margin-bottom: 15px !important;">Enter Your Name to Log This Change:</label>
            <input type="text" id="custom-operator-input" value="Noel Rie N. Deliña" placeholder="Your Name" style="width: 100% !important; padding: 12px !important; font-size: 16px !important; border: 1px solid #ccc !important; border-radius: 4px !important; margin-bottom: 20px !important; box-sizing: border-box !important;" />
            <div style="display: flex !important; gap: 10px !important; justify-content: center !important;">
                <button id="customCancelNameBtn" style="background: #6c757d !important; color: white !important; border: none !important; padding: 10px 20px !important; border-radius: 4px !important; cursor: pointer !important; font-weight: bold !important; font-size: 14px !important;">Cancel</button>
                <button id="customConfirmNameBtn" style="background: #28a745 !important; color: white !important; border: none !important; padding: 10px 20px !important; border-radius: 4px !important; cursor: pointer !important; font-weight: bold !important; font-size: 14px !important;">Confirm & Publish</button>
            </div>
        </div>
    `;[cite: 1]
    Object.assign(customNameModal.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'none', justifyContent: 'center',
        alignItems: 'center', zIndex: '99999'
    });[cite: 1]
    document.body.appendChild(customNameModal);[cite: 1]
}

// --- BACK TO TOP SCROLL LISTENER ---[cite: 1]
window.addEventListener('scroll', () => {
    const backToTopBtn = document.getElementById('backToTopBtn');[cite: 1]
    if (backToTopBtn) {
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            backToTopBtn.style.visibility = "visible";[cite: 1]
            backToTopBtn.style.opacity = "1";[cite: 1]
        } else {
            backToTopBtn.style.visibility = "hidden";[cite: 1]
            backToTopBtn.style.opacity = "0";[cite: 1]
        }
    }
});

// 🔐 LOGIN HANDLER & INITIALIZATION[cite: 1]
window.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');[cite: 1]
    const userIn = document.getElementById('usernameIn');[cite: 1]
    const passIn = document.getElementById('passwordIn');[cite: 1]
    const loginErr = document.getElementById('loginError');[cite: 1]
    const backToTopBtn = document.getElementById('backToTopBtn');[cite: 1]

    const executeLogin = () => {
        if (userIn.value === 'ADMIN' && passIn.value === '1234567890') {
            document.getElementById('loginScreen').style.display = 'none';[cite: 1]
            document.getElementById('mainApp').style.display = 'block';[cite: 1]
            
            setupSystemEventHandlers();[cite: 1]
            loadInventoryFromGoogleSheets();[cite: 1]
        } else {
            loginErr.textContent = 'Invalid Username or Password';[cite: 1]
        }
    };

    if (loginBtn) {
        loginBtn.addEventListener('click', executeLogin);[cite: 1]
    }
    
    if (passIn) {
        passIn.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executeLogin();[cite: 1]
        });
    }

    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });[cite: 1]
        });
    }

    // Pagination Listeners[cite: 1]
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                renderTable(currentFilteredData, currentPage - 1);[cite: 1]
                window.scrollTo({ top: document.querySelector('.table-section').offsetTop - 20, behavior: 'smooth' });[cite: 1]
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(currentFilteredData.length / itemsPerPage);[cite: 1]
            if (currentPage < totalPages) {
                renderTable(currentFilteredData, currentPage + 1);[cite: 1]
                window.scrollTo({ top: document.querySelector('.table-section').offsetTop - 20, behavior: 'smooth' });[cite: 1]
            }
        });
    }
    
    // --- HOVER PREVIEW EVENT LISTENERS ---[cite: 1]
    document.addEventListener('mouseover', function(e) {
        if (e.target && e.target.classList.contains('hover-preview-img')) {
            const srcToUse = e.target.src;[cite: 1]
            if (srcToUse) {
                tooltipImg.src = srcToUse;[cite: 1]
                tooltip.style.display = 'block';[cite: 1]
            }
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (e.target && e.target.classList.contains('hover-preview-img') && tooltip.style.display === 'block') {
            let x = e.clientX + 15;[cite: 1]
            let y = e.clientY + 15;[cite: 1]
            
            const tooltipRect = tooltip.getBoundingClientRect();[cite: 1]
            if (x + tooltipRect.width > window.innerWidth) {
                x = e.clientX - tooltipRect.width - 15;[cite: 1]
            }
            if (y + tooltipRect.height > window.innerHeight) {
                y = e.clientY - tooltipRect.height - 15;[cite: 1]
            }
            
            tooltip.style.left = x + 'px';[cite: 1]
            tooltip.style.top = y + 'px';[cite: 1]
        }
    });

    document.addEventListener('mouseout', function(e) {
        if (e.target && e.target.classList.contains('hover-preview-img')) {
            tooltip.style.display = 'none';[cite: 1]
            tooltipImg.src = '';[cite: 1]
        }
    });
});

async function loadInventoryFromGoogleSheets() {
    statusBanner.style.backgroundColor = "#fff3cd";[cite: 1]
    statusBanner.style.color = "#856404";[cite: 1]
    statusBanner.textContent = "Connecting to Google Sheets Live Datastream...";[cite: 1]
    showLoading("Syncing live spreadsheet grid...");[cite: 1]

    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);[cite: 1]
        if (!response.ok) throw new Error("Could not connect to online Sheet feed.");[cite: 1]
        const rawCsvText = await response.text();[cite: 1]

        Papa.parse(rawCsvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (results.data && results.data.length > 0) {
                    rawHeaders = Object.keys(results.data[0]);[cite: 1]
                    headerMapping = {};[cite: 1]
                    
                    targetHeadersLowercase.forEach(target => {
                        const actualKey = rawHeaders.find(h => {
                            const normH = h.toLowerCase().trim();[cite: 1]
                            const normT = target.toLowerCase().trim();[cite: 1]
                            return normH.includes(normT) || normT.includes(normH) || 
                                   (normT === 'article/item' && normH === 'article');[cite: 1]
                        });
                        headerMapping[target] = actualKey || target;[cite: 1]
                    });
                    
                    inventoryData = results.data.map((row, idx) => {
                        row._rowId = idx;[cite: 1]
                        return row;[cite: 1]
                    });
                    initializeSystemUI();[cite: 1]
                } else {
                    throw new Error("Target dataset sheet contains no metrics.");[cite: 1]
                }
                hideLoading();[cite: 1]
            }
        });
    } catch (err) {
        hideLoading();[cite: 1]
        statusBanner.style.backgroundColor = "#f8d7da";[cite: 1]
        statusBanner.style.color = "#721c24";[cite: 1]
        statusBanner.textContent = "Connection Error: Check Sheet spreadsheet access permission configuration.";[cite: 1]
        console.error(err);[cite: 1]
    }
}

function initializeSystemUI() {
    statusBanner.style.backgroundColor = "#d4edda";[cite: 1]
    statusBanner.style.color = "#155724";[cite: 1]
    statusBanner.innerHTML = `<span class="live-animated-text">✅ Connected to Google Sheets: Live View Active.</span>`;[cite: 1]

    if (searchInput) searchInput.disabled = false;[cite: 1]
    if (searchButton) searchButton.disabled = false;[cite: 1]
    if (exportButton) exportButton.disabled = false;[cite: 1]
    if (exportFilteredButton) exportFilteredButton.disabled = false;[cite: 1]
    if (remarksFilter) remarksFilter.disabled = false;[cite: 1]
    if (typeFilter) typeFilter.disabled = false;[cite: 1]
    if (photoFilter) photoFilter.disabled = false;[cite: 1]
    if (searchInput) searchInput.placeholder = "Type keywords...";[cite: 1]

    populateDropdown('remarks', remarksFilter, '-- All Remarks --');[cite: 1]
    populateDropdown('type', typeFilter, '-- All Types --');[cite: 1]
    renderHeaders(displayHeaders);[cite: 1]
    calculateStaticDashboardTotals(inventoryData);[cite: 1]
    
    if (!isAppInitialized) {
        currentFilteredData = [];[cite: 1]
        if(tableBody) {
            tableBody.innerHTML = `<tr><td colspan="${displayHeaders.length}" class="no-data">Data loaded successfully. Apply a filter or search to view records.</td></tr>`;[cite: 1]
        }
        if (foundCountDisplay) {
            foundCountDisplay.textContent = `(0 items displayed)`;[cite: 1]
        }
        updatePaginationUI(0);[cite: 1]
        isAppInitialized = true;[cite: 1]
    } else {
        executeSearch(true);[cite: 1]
    }
}

function populateDropdown(type, selectEl, placeholderText) {
    if(!selectEl) return;[cite: 1]
    const previousSelection = selectEl.value;[cite: 1]
    selectEl.innerHTML = `<option value="ALL">${placeholderText}</option>`;[cite: 1]
    const sheetKey = headerMapping[type];[cite: 1]
    if(!sheetKey) return;[cite: 1]
    
    let elements = new Set();[cite: 1]
    inventoryData.forEach(row => {
        const val = String(row[sheetKey] || '').trim();[cite: 1]
        if(val) elements.add(val);[cite: 1]
    });
    
    const sorted = Array.from(elements).sort();[cite: 1]
    if(type === 'remarks') parsedUniqueRemarks = sorted;[cite: 1]
    
    sorted.forEach(val => {
        const opt = document.createElement('option');[cite: 1]
        opt.value = val; opt.textContent = val;[cite: 1]
        selectEl.appendChild(opt);[cite: 1]
    });

    if(previousSelection && Array.from(selectEl.options).some(opt => opt.value === previousSelection)) {
        selectEl.value = previousSelection;[cite: 1]
    }
}

function renderHeaders(headers) {
    if(!tableHeaderRow) return; tableHeaderRow.innerHTML = '';[cite: 1]
    headers.forEach(h => {
        const th = document.createElement('th');[cite: 1]
        th.textContent = h;[cite: 1]
        tableHeaderRow.appendChild(th);[cite: 1]
    });
}

function getDirectImageUrl(driveLink, requestType = 'view') {
    if (!driveLink || typeof driveLink !== 'string') return null;[cite: 1]
    const match = driveLink.match(/[-\w]{25,}/);[cite: 1] 
    if (match) {
        if (requestType === 'thumbnail') {
            return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w800`;[cite: 1]
        }
        return `https://drive.google.com/uc?export=view&id=${match[0]}`;[cite: 1]
    }
    return null;[cite: 1]
}

function updatePaginationUI(totalPages) {
    if (totalPages <= 1) {
        if (paginationContainer) paginationContainer.style.display = 'none';[cite: 1]
    } else {
        if (paginationContainer) paginationContainer.style.display = 'flex';[cite: 1]
        if (pageIndicator) pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;[cite: 1]
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;[cite: 1]
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;[cite: 1]
    }
}

function renderTable(data, page = 1) {
    if(!tableBody) return; tableBody.innerHTML = '';[cite: 1]
    
    const totalPages = Math.ceil(data.length / itemsPerPage);[cite: 1]
    if (page > totalPages) page = totalPages;[cite: 1]
    if (page < 1) page = 1;[cite: 1]
    currentPage = page;[cite: 1]

    if(data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${displayHeaders.length}" class="no-data">No records match the active matrix search filters.</td></tr>`;[cite: 1]
        updatePaginationUI(0);[cite: 1]
        return;
    }

    const startIndex = (page - 1) * itemsPerPage;[cite: 1]
    const endIndex = startIndex + itemsPerPage;[cite: 1]
    const paginatedData = data.slice(startIndex, endIndex);[cite: 1]

    paginatedData.forEach(row => {
        const tr = document.createElement('tr');[cite: 1]
        tr.setAttribute('data-id', row._rowId);[cite: 1]
        targetHeadersLowercase.forEach(tKey => {
            const td = document.createElement('td');[cite: 1]
            const resolvedKey = headerMapping[tKey];[cite: 1]
            
            if (tKey.includes('photo') || tKey.includes('map coordinates') || tKey.includes('tax declaration') || tKey.includes('transfer_cert')) {
                const url = resolvedKey ? (row[resolvedKey] || '') : '';[cite: 1]
                if (url.trim() !== '') {
                    const viewUrl = getDirectImageUrl(url, 'view') || url;[cite: 1]
                    const thumbUrl = getDirectImageUrl(url, 'thumbnail') || url;[cite: 1]
                    
                    td.innerHTML = `<a href="${url}" target="_blank" onclick="event.stopPropagation();">
                                        <img src="${viewUrl}" onerror="this.onerror=null; this.src='${thumbUrl}';" class="hover-preview-img" alt="Preview" style="height:50px; max-width:80px; object-fit:cover; border:1px solid #ccc; border-radius:4px; cursor:zoom-in;">
                                    </a>`;[cite: 1]
                } else {
                    td.textContent = 'No Photo';[cite: 1]
                }
            } else {
                td.textContent = resolvedKey ? (row[resolvedKey] || '') : '';[cite: 1]
            }
            
            tr.appendChild(td);[cite: 1]
        });
        tr.addEventListener('click', () => openPopUp(row._rowId));[cite: 1]
        tableBody.appendChild(tr);[cite: 1]
    });

    updatePaginationUI(totalPages);[cite: 1]
}

function calculateStaticDashboardTotals(items) {
    if(!countTotal) return;[cite: 1]
    countTotal.textContent = items.length;[cite: 1]
    
    const rKey = headerMapping['remarks'];[cite: 1]
    const tKey = headerMapping['type'];[cite: 1]
    const pKey1 = headerMapping['photo 1'];[cite: 1]
    const pKey2 = headerMapping['photo 2'];[cite: 1]
    const pKey3 = headerMapping['map coordinates'];[cite: 1]
    const pKey4 = headerMapping['tax declaration'];[cite: 1] 
    const pKey5 = headerMapping['transfer_cert1'];[cite: 1] 
    const pKey6 = headerMapping['transfer_cert2'];[cite: 1] 
    
    let activeCount = 0, missingCount = 0, pendingCount = 0, photoCount = 0, taxDecCount = 0;[cite: 1]
    
    let typeCounts = { 
        building: 0, assetMod: 0, flood: 0, hospital: 0, land: 0, market: 0, 
        otherInfra: 0, otherLand: 0, otherStruct: 0, park: 0, 
        road: 0, school: 0, slaughterhouse: 0, water: 0 
    };[cite: 1]
    
    items.forEach(row => {
        const remVal = rKey ? String(row[rKey]).toLowerCase() : '';[cite: 1]
        const typeVal = tKey ? String(row[tKey]).toLowerCase().trim() : '';[cite: 1]
        
        const photoVal1 = pKey1 ? String(row[pKey1] || '').trim() : '';[cite: 1]
        const photoVal2 = pKey2 ? String(row[pKey2] || '').trim() : '';[cite: 1]
        const photoVal3 = pKey3 ? String(row[pKey3] || '').trim() : '';[cite: 1]
        const photoVal4 = pKey4 ? String(row[pKey4] || '').trim() : '';[cite: 1] 
        const photoVal5 = pKey5 ? String(row[pKey5] || '').trim() : '';[cite: 1] 
        const photoVal6 = pKey6 ? String(row[pKey6] || '').trim() : '';[cite: 1] 
        
        if(remVal.includes('existing') || typeVal.includes('existing')) activeCount++;[cite: 1]
        if(remVal.includes('not found')) missingCount++;[cite: 1]
        if(remVal.includes('for verification') || remVal.includes('verification')) pendingCount++;[cite: 1]
        
        if(photoVal4 !== '') taxDecCount++;[cite: 1] 
        if(photoVal1 !== '' || photoVal2 !== '' || photoVal3 !== '' || photoVal4 !== '' || photoVal5 !== '' || photoVal6 !== '') photoCount++;[cite: 1]
        
        if (typeVal.includes('school') || typeVal.includes('school buildings')) {
            typeCounts.school++;[cite: 1]
        } else if (typeVal.includes('building modifications') || typeVal.includes('asset modifications') || typeVal.includes('asset mod')) {
            typeCounts.assetMod++;[cite: 1]
        } else if (typeVal.includes('other infrastructure') || typeVal.includes('other infra')) {
            typeCounts.otherInfra++;[cite: 1]
        } else if (typeVal.includes('other land improvements') || typeVal.includes('other land imp')) {
            typeCounts.otherLand++;[cite: 1]
        } else if (typeVal.includes('other structures') || typeVal.includes('other struct')) {
            typeCounts.otherStruct++;[cite: 1]
        } else if (typeVal.includes('road') || typeVal.includes('road networks')) {
            typeCounts.road++;[cite: 1]
        } else if (typeVal.includes('slaughterhouse') || typeVal.includes('slaughterhoues')) {[cite: 1] 
            typeCounts.slaughterhouse++;[cite: 1]
        } else if (typeVal.includes('water supply systems') || typeVal.includes('water systems') || typeVal.includes('water supply')) {
            typeCounts.water++;[cite: 1]
        } else if (typeVal.includes('building')) {
            typeCounts.building++;[cite: 1]
        } else if (typeVal.includes('flood')) {
            typeCounts.flood++;[cite: 1]
        } else if (typeVal.includes('hospital') || typeVal.includes('health')) {
            typeCounts.hospital++;[cite: 1]
        } else if (typeVal.includes('market')) {
            typeCounts.market++;[cite: 1]
        } else if (typeVal.includes('park') || typeVal.includes('plaza')) {
            typeCounts.park++;[cite: 1]
        } else if (typeVal.includes('land')) {
            typeCounts.land++;[cite: 1]
        }
    });
    
    if(countExisting) countExisting.textContent = activeCount;[cite: 1]
    if(countNotFound) countNotFound.textContent = missingCount;[cite: 1]
    if(countVerification) countVerification.textContent = pendingCount;[cite: 1]
    if(countWithPhotos) countWithPhotos.textContent = photoCount;[cite: 1]
    if(countTaxDec) countTaxDec.textContent = taxDecCount;[cite: 1] 
    
    if(countBuilding) countBuilding.textContent = typeCounts.building;[cite: 1]
    if(countAssetMod) countAssetMod.textContent = typeCounts.assetMod;[cite: 1] 
    if(countFlood) countFlood.textContent = typeCounts.flood;[cite: 1]
    if(countHospital) countHospital.textContent = typeCounts.hospital;[cite: 1]
    if(countLand) countLand.textContent = typeCounts.land;[cite: 1]
    if(countMarket) countMarket.textContent = typeCounts.market;[cite: 1]
    if(countOtherInfra) countOtherInfra.textContent = typeCounts.otherInfra;[cite: 1]
    if(countOtherLand) countOtherLand.textContent = typeCounts.otherLand;[cite: 1]
    if(countOtherStruct) countOtherStruct.textContent = typeCounts.otherStruct;[cite: 1]
    if(countPark) countPark.textContent = typeCounts.park;[cite: 1]
    if(countRoad) countRoad.textContent = typeCounts.road;[cite: 1]
    if(countSchool) countSchool.textContent = typeCounts.school;[cite: 1]
    if(countSlaughterhouse) countSlaughterhouse.textContent = typeCounts.slaughterhouse;[cite: 1]
    if(countWater) countWater.textContent = typeCounts.water;[cite: 1]
}

function openPopUp(rowId) {
    activeEditIndex = rowId;[cite: 1]
    modalModified = false;[cite: 1]
    const itemData = inventoryData.find(r => r._rowId === rowId);[cite: 1]
    if(!modalFormContainer) return;[cite: 1] 
    modalFormContainer.innerHTML = '';[cite: 1]
    
    const flexLayout = document.createElement('div');[cite: 1]
    flexLayout.className = 'modal-flex-layout';[cite: 1]
    
    const fieldsSide = document.createElement('div');[cite: 1]
    fieldsSide.className = 'modal-fields-side';[cite: 1]
    
    popupOrderLowercase.forEach(tKey => {
        const realKey = headerMapping[tKey];[cite: 1]
        const currentVal = realKey ? (itemData[realKey] || '') : '';[cite: 1]
        const idx = targetHeadersLowercase.indexOf(tKey);[cite: 1]
        const labelText = displayHeaders[idx];[cite: 1]
        
        const wrapper = document.createElement('div');[cite: 1]
        wrapper.className = 'modal-field';[cite: 1]
        let fieldEl;[cite: 1]
        
        if(tKey === 'remarks') {
            fieldEl = document.createElement('select');[cite: 1]
            parsedUniqueRemarks.forEach(rem => {
                const opt = document.createElement('option');[cite: 1]
                opt.value = rem; opt.textContent = rem;[cite: 1]
                if(rem === currentVal) opt.selected = true;[cite: 1]
                fieldEl.appendChild(opt);[cite: 1]
            });
            if(!currentVal) {
                const fallbackOpt = document.createElement('option');[cite: 1]
                fallbackOpt.value = ''; fallbackOpt.textContent = '-- Choose Remark --'; fallbackOpt.selected = true;[cite: 1]
                fieldEl.insertBefore(fallbackOpt, fieldEl.firstChild);[cite: 1]
            }
        } else if(tKey === 'description') {
            // 📝 MODIFIED HERE: Increased rows and min-height for expanded description space
            fieldEl = document.createElement('textarea');[cite: 1]
            fieldEl.rows = 8;[cite: 1]
            fieldEl.style.minHeight = '120px';[cite: 1]
            fieldEl.style.resize = 'vertical';[cite: 1]
            fieldEl.value = currentVal;[cite: 1]
        } else {
            fieldEl = document.createElement('input');[cite: 1]
            fieldEl.type = 'text'; fieldEl.value = currentVal;[cite: 1]
        }
        
        fieldEl.id = 'modal-input-' + tKey.replace('/', '');[cite: 1]
        fieldEl.disabled = true;[cite: 1]
        
        const label = document.createElement('label');[cite: 1]
        label.textContent = labelText;[cite: 1]
        wrapper.appendChild(label);[cite: 1] 
        wrapper.appendChild(fieldEl);[cite: 1]
        fieldsSide.appendChild(wrapper);[cite: 1]
    });

    // --- POPULATE MULTIPLE PHOTOS FOR VIEWER ---[cite: 1]
    modalPhotos = [];[cite: 1]
    const photoKeysDef = [
        { key: 'photo 1', label: 'Photo 1' },
        { key: 'photo 2', label: 'Photo 2' },
        { key: 'map coordinates', label: 'Map Coordinates' },
        { key: 'tax declaration', label: 'Tax Declaration' },
        { key: 'transfer_cert1', label: 'Transfer Certificate of Title Page 1' },
        { key: 'transfer_cert2', label: 'Transfer Certificate of Title Page 2' }
    ];[cite: 1]

    photoKeysDef.forEach(p => {
        const mappedKey = headerMapping[p.key];[cite: 1]
        if (mappedKey && itemData[mappedKey] && itemData[mappedKey].trim() !== '') {
            const val = itemData[mappedKey].trim();[cite: 1]
            if (val.startsWith('http')) {
                modalPhotos.push({ label: p.label, url: val });[cite: 1]
            }
        }
    });

    currentPhotoIndex = 0;[cite: 1]

    const photoSide = document.createElement('div');[cite: 1]
    photoSide.className = 'modal-photo-side';[cite: 1]
    
    renderModalPhotoViewer(photoSide);[cite: 1]
    
    flexLayout.appendChild(fieldsSide);[cite: 1]
    flexLayout.appendChild(photoSide);[cite: 1]
    modalFormContainer.appendChild(flexLayout);[cite: 1]
    
    if(uploadPhotoBtn) uploadPhotoBtn.style.display = 'inline-block';[cite: 1]
    if(modalEditBtn) modalEditBtn.style.display = 'inline-block';[cite: 1]
    if(modalSaveBtn) modalSaveBtn.style.display = 'none';[cite: 1]
    if(editModal) editModal.style.display = 'flex';[cite: 1]
}

function renderModalPhotoViewer(container) {
    container.innerHTML = '';[cite: 1]

    if (modalPhotos.length === 0) {
        const noPhotoText = document.createElement('div');[cite: 1]
        noPhotoText.textContent = 'No Photo Available';[cite: 1]
        noPhotoText.style.color = '#64748b';[cite: 1]
        noPhotoText.style.fontStyle = 'italic';[cite: 1]
        noPhotoText.style.textAlign = 'center';[cite: 1]
        container.appendChild(noPhotoText);[cite: 1]
        return;
    }

    const photoContainer = document.createElement('div');[cite: 1]
    photoContainer.className = 'modal-photo-container';[cite: 1]

    const currentPhoto = modalPhotos[currentPhotoIndex];[cite: 1]
    const viewUrl = getDirectImageUrl(currentPhoto.url, 'view') || currentPhoto.url;[cite: 1]
    const thumbUrl = getDirectImageUrl(currentPhoto.url, 'thumbnail') || currentPhoto.url;[cite: 1]

    const imgEl = document.createElement('img');[cite: 1]
    imgEl.src = viewUrl;[cite: 1]
    imgEl.onerror = function() { this.onerror=null; this.src = thumbUrl; };[cite: 1]
    imgEl.alt = currentPhoto.label;[cite: 1]
    imgEl.onclick = () => window.open(currentPhoto.url, '_blank');[cite: 1]
    photoContainer.appendChild(imgEl);[cite: 1]

    if (modalPhotos.length > 1) {
        const prevBtn = document.createElement('button');[cite: 1]
        prevBtn.className = 'photo-nav-btn photo-prev-btn';[cite: 1]
        prevBtn.innerHTML = '&#10094;';[cite: 1]
        prevBtn.title = 'Previous Photo';[cite: 1]
        prevBtn.onclick = (e) => {
            e.stopPropagation();[cite: 1]
            currentPhotoIndex = (currentPhotoIndex - 1 + modalPhotos.length) % modalPhotos.length;[cite: 1]
            renderModalPhotoViewer(container);[cite: 1]
        };

        const nextBtn = document.createElement('button');[cite: 1]
        nextBtn.className = 'photo-nav-btn photo-next-btn';[cite: 1]
        nextBtn.innerHTML = '&#10095;';[cite: 1]
        nextBtn.title = 'Next Photo';[cite: 1]
        nextBtn.onclick = (e) => {
            e.stopPropagation();[cite: 1]
            currentPhotoIndex = (currentPhotoIndex + 1) % modalPhotos.length;[cite: 1]
            renderModalPhotoViewer(container);[cite: 1]
        };

        photoContainer.appendChild(prevBtn);[cite: 1]
        photoContainer.appendChild(nextBtn);[cite: 1]
    }

    container.appendChild(photoContainer);[cite: 1]

    const captionEl = document.createElement('div');[cite: 1]
    captionEl.className = 'photo-caption';[cite: 1]
    captionEl.textContent = `${currentPhoto.label} (${currentPhotoIndex + 1} of ${modalPhotos.length})`;[cite: 1]
    container.appendChild(captionEl);[cite: 1]
}

function setupSystemEventHandlers() {
    if(uploadPhotoBtn) {
        uploadPhotoBtn.addEventListener('click', () => {
            modalModified = true;[cite: 1]
            const activeRecord = inventoryData.find(r => r._rowId === activeEditIndex);[cite: 1]
            const aKey = headerMapping['article/item'];[cite: 1]
            const itemCode = encodeURIComponent(activeRecord[aKey] || 'unknown');[cite: 1]
            window.open(`${GOOGLE_APPS_SCRIPT_URL}?itemCode=${itemCode}`, '_blank');[cite: 1]
        });
    }

    if(modalEditBtn) {
        modalEditBtn.addEventListener('click', () => {
            modalModified = true;[cite: 1]
            const remInput = document.getElementById('modal-input-remarks');[cite: 1]
            if(remInput) remInput.disabled = false;[cite: 1]
            modalEditBtn.style.display = 'none';[cite: 1]
            if(modalSaveBtn) modalSaveBtn.style.display = 'inline-block';[cite: 1]
        });
    }

    if(modalSaveBtn) {
        modalSaveBtn.addEventListener('click', () => {
            modalModified = true;[cite: 1]
            const selection = document.getElementById('modal-input-remarks').value;[cite: 1]
            if(editModal) editModal.style.display = 'none';[cite: 1]
            if(customNameModal) customNameModal.style.display = 'flex';[cite: 1]
            
            document.getElementById('customConfirmNameBtn').onclick = () => {
                let name = document.getElementById('custom-operator-input').value;[cite: 1]
                if(!name || name.trim() === '') name = "Noel Rie N. Deliña";[cite: 1]
                customNameModal.style.display = 'none';[cite: 1]
                transmitUpdateToCloud(selection, name.trim());[cite: 1]
            };
            
            document.getElementById('customCancelNameBtn').onclick = () => {
                customNameModal.style.display = 'none';[cite: 1]
                if(editModal) editModal.style.display = 'flex';[cite: 1]
            };
        });
    }

    if(modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            if(editModal) editModal.style.display = 'none';[cite: 1]
            if (modalModified) {
                loadInventoryFromGoogleSheets();[cite: 1]
            }
        });
    }

    if(exportButton) exportButton.addEventListener('click', () => exportToCSV(inventoryData, "Real_Estate_Inventory_Full"));[cite: 1]
    if(exportFilteredButton) exportFilteredButton.addEventListener('click', () => exportToHTML(currentFilteredData, "Real_Estate_Inventory_Filtered"));[cite: 1]

    if(searchButton) searchButton.addEventListener('click', () => executeSearch(false));[cite: 1]
    if(searchInput) searchInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') executeSearch(false); });[cite: 1]
    if(remarksFilter) remarksFilter.addEventListener('change', () => executeSearch(false));[cite: 1]
    if(typeFilter) typeFilter.addEventListener('change', () => executeSearch(false));[cite: 1]
    if(photoFilter) photoFilter.addEventListener('change', () => executeSearch(false));[cite: 1]
}

function exportToCSV(data, filename) {
    if(data.length === 0) { alert("No data available to export."); return; }[cite: 1]
    
    let csvContent = displayHeaders.join(",") + "\n";[cite: 1]
    
    data.forEach(row => {
        let rowData = targetHeadersLowercase.map(tKey => {
            const resolvedKey = headerMapping[tKey];[cite: 1]
            let val = resolvedKey ? (row[resolvedKey] || '') : '';[cite: 1]
            val = String(val).replace(/"/g, '""');[cite: 1]
            return `"${val}"`;[cite: 1]
        });
        csvContent += rowData.join(",") + "\n";[cite: 1]
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });[cite: 1]
    const link = document.createElement('a');[cite: 1]
    link.href = URL.createObjectURL(blob);[cite: 1]
    link.download = `${filename}_${new Date().getTime()}.csv`;[cite: 1]
    document.body.appendChild(link);[cite: 1] 
    link.click();[cite: 1] 
    document.body.removeChild(link);[cite: 1]
}

function exportToHTML(data, title) {
    if(data.length === 0) { alert("No data available to export."); return; }[cite: 1]
    
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
            th, td { border: 1px solid #cbd5e1; padding: 5px; font-size: 20px; vertical-align: top; overflow-wrap: break-word; }
            th { background-color: #e2e8f0; font-size: 20px; font-weight: bold; }
            tr { page-break-inside: avoid; } 
            
            .photo-cell { text-align: center; vertical-align: middle; }
            img { max-width: 100%; max-height: 400px; object-fit: contain; border-radius: 4px; border: 1px solid #e2e8f0; page-break-inside: avoid; }
            
            th:nth-child(1), td:nth-child(1) { width: 5%; }  
            th:nth-child(2), td:nth-child(2) { width: 12%; } 
            th:nth-child(3), td:nth-child(3) { width: 4%; }  
            th:nth-child(4), td:nth-child(4) { width: 4%; }  
            th:nth-child(5), td:nth-child(5) { width: 6%; }  
            th:nth-child(6), td:nth-child(6) { width: 7%; }  
            th:nth-child(7), td:nth-child(7) { width: 9%; } 
            th:nth-child(8), td:nth-child(8) { width: 9%; } 
            th:nth-child(9), td:nth-child(9) { width: 9%; } 
            th:nth-child(10), td:nth-child(10) { width: 9%; } 
            th:nth-child(11), td:nth-child(11) { width: 9%; } 
            th:nth-child(12), td:nth-child(12) { width: 9%; } 
            th:nth-child(13), td:nth-child(13) { width: 4%; } 
            th:nth-child(14), td:nth-child(14) { width: 4%; } 
            
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
        <table><thead><tr>`;[cite: 1]
    
    displayHeaders.forEach(h => { tableHTML += `<th>${h}</th>`; });[cite: 1]
    tableHTML += `</tr></thead><tbody>`;[cite: 1]
    
    data.forEach(row => {
        tableHTML += `<tr>`;[cite: 1]
        targetHeadersLowercase.forEach(tKey => {
            const resolvedKey = headerMapping[tKey];[cite: 1]
            const val = resolvedKey ? (row[resolvedKey] || '') : '';[cite: 1]
            
            if (tKey.includes('photo') || tKey.includes('map coordinates') || tKey.includes('tax declaration') || tKey.includes('transfer_cert')) {
                const viewUrl = getDirectImageUrl(val, 'view') || val;[cite: 1]
                const thumbUrl = getDirectImageUrl(val, 'thumbnail') || val;[cite: 1]

                if (val.trim() !== '' && val.startsWith('http')) {
                    tableHTML += `<td class="photo-cell"><img src="${viewUrl}" onerror="this.onerror=null; this.src='${thumbUrl}';" /></td>`;[cite: 1]
                } else {
                    tableHTML += `<td class="photo-cell">No Photo</td>`;[cite: 1]
                }
            } else {
                tableHTML += `<td>${val}</td>`;[cite: 1]
            }
        });
        tableHTML += `</tr>`;[cite: 1]
    });
    tableHTML += `</tbody></table></body></html>`;[cite: 1]

    const blob = new Blob([tableHTML], { type: 'text/html;charset=utf-8' });[cite: 1]
    const link = document.createElement('a');[cite: 1]
    link.href = URL.createObjectURL(blob);[cite: 1]
    link.download = `${title}_${new Date().getTime()}.html`;[cite: 1]
    document.body.appendChild(link);[cite: 1] 
    link.click();[cite: 1] 
    document.body.removeChild(link);[cite: 1]
}

async function transmitUpdateToCloud(remark, user) {
    const activeRecord = inventoryData.find(r => r._rowId === activeEditIndex);[cite: 1]
    const aKey = headerMapping['article/item'];[cite: 1]
    const itemCode = String(activeRecord[aKey] || '').trim();[cite: 1]

    const timestamp = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
    });[cite: 1]

    const bodyParams = new URLSearchParams();[cite: 1]
    bodyParams.append("article", itemCode);[cite: 1]
    bodyParams.append("remarks", remark);[cite: 1]
    bodyParams.append("updatedby", user);[cite: 1]
    bodyParams.append("timestamp", timestamp);[cite: 1]

    statusBanner.style.backgroundColor = "#ffeb3b";[cite: 1]
    statusBanner.style.color = "#333";[cite: 1]
    statusBanner.textContent = "Transmitting modifications to Google Apps Script gateway...";[cite: 1]
    showLoading("Publishing updates...");[cite: 1]
    
    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: bodyParams.toString()
        });[cite: 1]
        setTimeout(() => { loadInventoryFromGoogleSheets(); }, 1200);[cite: 1]
    } catch(e) {
        console.error(e);[cite: 1]
        setTimeout(() => { loadInventoryFromGoogleSheets(); }, 1000);[cite: 1]
    }
}

function executeSearch(keepCurrentPage = false) {
    if(!searchInput || !remarksFilter || !typeFilter || !photoFilter) return;[cite: 1]

    const term = searchInput.value.toLowerCase().trim();[cite: 1]
    const remarkSel = remarksFilter.value;[cite: 1]
    const typeSel = typeFilter.value;[cite: 1]
    const photoSel = photoFilter.value;[cite: 1]
    
    const rKey = headerMapping['remarks'];[cite: 1]
    const tKey = headerMapping['type'];[cite: 1]
    const pKey1 = headerMapping['photo 1'];[cite: 1]
    const pKey2 = headerMapping['photo 2'];[cite: 1]
    const pKey3 = headerMapping['map coordinates'];[cite: 1]
    const pKey4 = headerMapping['tax declaration'];[cite: 1] 
    const pKey5 = headerMapping['transfer_cert1'];[cite: 1] 
    const pKey6 = headerMapping['transfer_cert2'];[cite: 1] 
    
    let filtered = inventoryData;[cite: 1]

    if(remarkSel !== "ALL" && rKey) filtered = filtered.filter(row => (row[rKey] || '').trim() === remarkSel);[cite: 1]
    if(typeSel !== "ALL" && tKey) filtered = filtered.filter(row => (row[tKey] || '').trim() === typeSel);[cite: 1]
    
    if(photoSel !== "ALL") {
        filtered = filtered.filter(row => {
            const val1 = pKey1 ? String(row[pKey1] || '').trim() : '';[cite: 1]
            const val2 = pKey2 ? String(row[pKey2] || '').trim() : '';[cite: 1]
            const val3 = pKey3 ? String(row[pKey3] || '').trim() : '';[cite: 1]
            const val4 = pKey4 ? String(row[pKey4] || '').trim() : '';[cite: 1] 
            const val5 = pKey5 ? String(row[pKey5] || '').trim() : '';[cite: 1] 
            const val6 = pKey6 ? String(row[pKey6] || '').trim() : '';[cite: 1] 

            if (photoSel === "WITH_TAX_DEC") {
                return val4 !== '';[cite: 1]
            }

            const hasPhoto = (val1 !== '') || (val2 !== '') || (val3 !== '') || (val4 !== '') || (val5 !== '') || (val6 !== '');[cite: 1]
            return photoSel === "WITH_PHOTO" ? hasPhoto : !hasPhoto;[cite: 1]
        });
    }
    
    if(term) {
        const searchWords = term.split(/\s+/).filter(word => word.length > 0);[cite: 1]
        const requiredMatches = Math.min(searchWords.length, 2);[cite: 1]

        filtered = filtered.filter(row => {
            const rowText = rawHeaders.map(h => String(row[h] || '').toLowerCase()).join(' ');[cite: 1]
            let matchCount = 0;[cite: 1]
            searchWords.forEach(word => {
                if (rowText.includes(word)) {
                    matchCount++;[cite: 1]
                }
            });
            return matchCount >= requiredMatches;[cite: 1]
        });
    }
    
    currentFilteredData = filtered;[cite: 1] 
    
    const targetPage = keepCurrentPage ? currentPage : 1;[cite: 1]
    renderTable(filtered, targetPage);[cite: 1]

    if (foundCountDisplay) {
        foundCountDisplay.textContent = `(${filtered.length} items found)`;[cite: 1]
    }
}
