// 🔑 Google Sheets Cloud Gateway Architecture
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

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

// --- BACK TO TOP SCROLL LISTENER ---
window.addEventListener('scroll', () => {
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            backToTopBtn.style.visibility = "visible";
            backToTopBtn.style.opacity = "1";
        } else {
            backToTopBtn.style.visibility = "hidden";
            backToTopBtn.style.opacity = "0";
        }
    }
});

// 🔐 LOGIN HANDLER & INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const userIn = document.getElementById('usernameIn');
    const passIn = document.getElementById('passwordIn');
    const loginErr = document.getElementById('loginError');
    const backToTopBtn = document.getElementById('backToTopBtn');

    const executeLogin = () => {
        if (userIn.value === 'ADMIN' && passIn.value === '1234567890') {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            
            setupSystemEventHandlers();
            loadInventoryFromGoogleSheets();
        } else {
            loginErr.textContent = 'Invalid Username or Password';
        }
    };

    if (loginBtn) loginBtn.addEventListener('click', executeLogin);
    
    if (passIn) {
        passIn.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executeLogin();
        });
    }

    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Pagination Listeners
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                renderTable(currentFilteredData, currentPage - 1);
                window.scrollTo({ top: document.querySelector('.table-section').offsetTop - 20, behavior: 'smooth' });
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(currentFilteredData.length / itemsPerPage);
            if (currentPage < totalPages) {
                renderTable(currentFilteredData, currentPage + 1);
                window.scrollTo({ top: document.querySelector('.table-section').offsetTop - 20, behavior: 'smooth' });
            }
        });
    }
    
    // --- HOVER PREVIEW EVENT LISTENERS ---
    document.addEventListener('mouseover', function(e) {
        if (e.target && e.target.classList.contains('hover-preview-img')) {
            const srcToUse = e.target.src;
            if (srcToUse) {
                tooltipImg.src = srcToUse;
                tooltip.style.display = 'block';
            }
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (e.target && e.target.classList.contains('hover-preview-img') && tooltip.style.display === 'block') {
            let x = e.clientX + 15;
            let y = e.clientY + 15;
            
            const tooltipRect = tooltip.getBoundingClientRect();
            if (x + tooltipRect.width > window.innerWidth) {
                x = e.clientX - tooltipRect.width - 15;
            }
            if (y + tooltipRect.height > window.innerHeight) {
                y = e.clientY - tooltipRect.height - 15;
            }
            
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        }
    });

    document.addEventListener('mouseout', function(e) {
        if (e.target && e.target.classList.contains('hover-preview-img')) {
            tooltip.style.display = 'none';
            tooltipImg.src = '';
        }
    });
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
                            
                            if (normT === 'transfer_cert1' && (normH.includes('transfer') && normH.includes('1'))) return true;
                            if (normT === 'transfer_cert2' && (normH.includes('transfer') && normH.includes('2'))) return true;
                            if (normT === 'article/item' && (normH.includes('article') || normH.includes('tct') || normH.includes('item'))) return true;
                            
                            return normH.includes(normT) || normT.includes(normH);
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
    statusBanner.innerHTML = `<span class="live-animated-text">✅ Connected to Google Sheets: Live View Active.</span>`;

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
    
    if (!isAppInitialized) {
        currentFilteredData = []; 
        if(tableBody) {
            tableBody.innerHTML = `<tr><td colspan="${displayHeaders.length}" class="no-data">Data loaded successfully. Apply a filter or search to view records.</td></tr>`;
        }
        if (foundCountDisplay) {
            foundCountDisplay.textContent = `(0 items displayed)`;
        }
        updatePaginationUI(0);
        isAppInitialized = true;
    } else {
        executeSearch(true);
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

function getDirectImageUrl(driveLink, requestType = 'view') {
    if (!driveLink || typeof driveLink !== 'string') return null;
    const match = driveLink.match(/[-\w]{25,}/); 
    if (match) {
        if (requestType === 'thumbnail') {
            return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1600`;
        }
        return `https://lh3.googleusercontent.com/d/${match[0]}`;
    }
    return null;
}

function updatePaginationUI(totalPages) {
    if (totalPages <= 1) {
        if (paginationContainer) paginationContainer.style.display = 'none';
    } else {
        if (paginationContainer) paginationContainer.style.display = 'flex';
        if (pageIndicator) pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
    }
}

function renderTable(data, page = 1) {
    if(!tableBody) return; tableBody.innerHTML = '';
    
    const totalPages = Math.ceil(data.length / itemsPerPage);
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    currentPage = page;

    if(data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${displayHeaders.length}" class="no-data">No records match the active matrix search filters.</td></tr>`;
        updatePaginationUI(0);
        return;
    }

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);

    paginatedData.forEach(row => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', row._rowId);
        targetHeadersLowercase.forEach(tKey => {
            const td = document.createElement('td');
            const resolvedKey = headerMapping[tKey];
            
            if (tKey.includes('photo') || tKey.includes('map coordinates') || tKey.includes('tax declaration') || tKey.includes('transfer_cert')) {
                const url = resolvedKey ? (row[resolvedKey] || '') : '';
                if (url.trim() !== '') {
                    const viewUrl = getDirectImageUrl(url, 'view') || url;
                    const thumbUrl = getDirectImageUrl(url, 'thumbnail') || url;
                    
                    td.innerHTML = `<img src="${viewUrl}" onerror="this.onerror=null; this.src='${thumbUrl}';" class="hover-preview-img" alt="Preview" style="height:50px; max-width:80px; object-fit:cover; border:1px solid #ccc; border-radius:4px; cursor:zoom-in;" onclick="event.stopPropagation(); openPopUp(${row._rowId}, '${tKey}');">`;
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

    updatePaginationUI(totalPages);
}

function calculateStaticDashboardTotals(items) {
    if(!countTotal) return;
    countTotal.textContent = items.length;
    
    const rKey = headerMapping['remarks'];
    const tKey = headerMapping['type'];
    const pKey1 = headerMapping['photo 1'];
    const pKey2 = headerMapping['photo 2'];
    const pKey3 = headerMapping['map coordinates'];
    const pKey4 = headerMapping['tax declaration']; 
    const pKey5 = headerMapping['transfer_cert1'];
    const pKey6 = headerMapping['transfer_cert2'];
    
    let existing = 0, notfound = 0, verify = 0, photos = 0, taxdec = 0;
    
    let stats = {
        'Building': 0, 'Building Modifications': 0, 'Flood Control': 0, 
        'Hospital': 0, 'Land': 0, 'Markets': 0, 'Other Infrastructures': 0, 
        'Other Land Improvements': 0, 'Other Structures': 0, 
        'PARKS PLAZAS AND MONUMENTS': 0, 'Roads': 0, 'School Building': 0, 
        'Slaughterhouse': 0, 'Water Supplies': 0
    };

    items.forEach(row => {
        const rem = String(row[rKey] || '').toUpperCase();
        if(rem.includes('EXISTING')) existing++;
        if(rem.includes('NOT FOUND')) notfound++;
        if(rem.includes('FOR VERIFICATION')) verify++;
        
        if((row[pKey1] && row[pKey1].trim()!=='') || (row[pKey2] && row[pKey2].trim()!=='')) photos++;
        if((row[pKey4] && row[pKey4].trim()!=='') || (row[pKey5] && row[pKey5].trim()!=='') || (row[pKey6] && row[pKey6].trim()!=='')) taxdec++;
        
        const typeStr = String(row[tKey] || '').toUpperCase().trim();
        
        // FLEXIBLE MATCHING IMPLEMENTED HERE: Allows the system to capture variations, plurals, and missing punctuation
        if (typeStr.includes('BUILDING MOD') || typeStr.includes('ASSET MOD')) stats['Building Modifications']++;
        else if (typeStr.includes('SCHOOL')) stats['School Building']++;
        else if (typeStr.includes('HOSPITAL')) stats['Hospital']++;
        else if (typeStr.includes('MARKET')) stats['Markets']++;
        else if (typeStr.includes('OTHER INFRA')) stats['Other Infrastructures']++;
        else if (typeStr.includes('OTHER STRUCT')) stats['Other Structures']++;
        else if (typeStr.includes('PARK') || typeStr.includes('PLAZA') || typeStr.includes('MONUMENT')) stats['PARKS PLAZAS AND MONUMENTS']++;
        else if (typeStr.includes('OTHER LAND')) stats['Other Land Improvements']++;
        else if (typeStr.includes('LAND') || typeStr === 'LOT') stats['Land']++;
        else if (typeStr.includes('FLOOD')) stats['Flood Control']++;
        else if (typeStr.includes('WATER')) stats['Water Supplies']++;
        else if (typeStr.includes('ROAD')) stats['Roads']++;
        else if (typeStr.includes('SLAUGHTERHOUSE')) stats['Slaughterhouse']++;
        else if (typeStr.includes('BUILDING')) stats['Building']++;
    });

    if(countExisting) countExisting.textContent = existing;
    if(countNotFound) countNotFound.textContent = notfound;
    if(countVerification) countVerification.textContent = verify;
    if(countWithPhotos) countWithPhotos.textContent = photos;
    if(countTaxDec) countTaxDec.textContent = taxdec;
    
    if(countBuilding) countBuilding.textContent = stats['Building'];
    if(countAssetMod) countAssetMod.textContent = stats['Building Modifications'];
    if(countFlood) countFlood.textContent = stats['Flood Control'];
    if(countHospital) countHospital.textContent = stats['Hospital'];
    if(countLand) countLand.textContent = stats['Land'];
    if(countMarket) countMarket.textContent = stats['Markets'];
    if(countOtherInfra) countOtherInfra.textContent = stats['Other Infrastructures'];
    if(countOtherLand) countOtherLand.textContent = stats['Other Land Improvements'];
    if(countOtherStruct) countOtherStruct.textContent = stats['Other Structures'];
    if(countPark) countPark.textContent = stats['PARKS PLAZAS AND MONUMENTS'];
    if(countRoad) countRoad.textContent = stats['Roads'];
    if(countSchool) countSchool.textContent = stats['School Building'];
    if(countSlaughterhouse) countSlaughterhouse.textContent = stats['Slaughterhouse'];
    if(countWater) countWater.textContent = stats['Water Supplies'];
}

function executeSearch(resetPage = true) {
    if(!isAppInitialized) return;
    const term = searchInput.value.toLowerCase().trim();
    const remFilt = remarksFilter.value;
    const typeFilt = typeFilter.value;
    const pFilt = photoFilter.value;

    let searchKeys = [];
    if(headerMapping['article/item']) searchKeys.push(headerMapping['article/item']);
    if(headerMapping['description']) searchKeys.push(headerMapping['description']);

    let filtered = inventoryData;

    if(term) {
        filtered = filtered.filter(row => {
            return searchKeys.some(key => String(row[key] || '').toLowerCase().includes(term));
        });
    }
    
    if(remFilt && remFilt !== 'ALL') {
        const k = headerMapping['remarks'];
        filtered = filtered.filter(row => String(row[k] || '') === remFilt);
    }
    if(typeFilt && typeFilt !== 'ALL') {
        const k = headerMapping['type'];
        filtered = filtered.filter(row => String(row[k] || '') === typeFilt);
    }
    
    if (pFilt && pFilt !== 'ALL') {
        const p1 = headerMapping['photo 1'];
        const p2 = headerMapping['photo 2'];
        const p3 = headerMapping['map coordinates'];
        const p4 = headerMapping['tax declaration'];
        const p5 = headerMapping['transfer_cert1'];
        const p6 = headerMapping['transfer_cert2'];
        
        filtered = filtered.filter(row => {
            const hasAnyMedia = (row[p1] && row[p1].trim()!=='') || (row[p2] && row[p2].trim()!=='') || (row[p3] && row[p3].trim()!=='') || (row[p4] && row[p4].trim()!=='') || (row[p5] && row[p5].trim()!=='') || (row[p6] && row[p6].trim()!=='');
            if (pFilt === 'WITH') return hasAnyMedia;
            if (pFilt === 'WITHOUT') return !hasAnyMedia;
            return true;
        });
    }

    currentFilteredData = filtered;
    if(foundCountDisplay) foundCountDisplay.textContent = `(${filtered.length} items found)`;
    
    if (resetPage) currentPage = 1;
    renderTable(filtered, currentPage);
}

function openPopUp(rowId, specificImageKey = null) {
    activeEditIndex = rowId;
    const row = inventoryData.find(r => r._rowId === rowId);
    if (!row) return;

    if(modalFormContainer) modalFormContainer.innerHTML = '';
    modalModified = false;
    modalPhotos = [];

    // Construct Text Detail Container
    const detailContainer = document.createElement('div');
    detailContainer.style.marginBottom = '20px';

    popupOrderLowercase.forEach(tKey => {
        const dKey = displayHeaders[targetHeadersLowercase.indexOf(tKey)];
        const rKey = headerMapping[tKey];
        const val = rKey ? (row[rKey] || '') : '';
        
        const wrap = document.createElement('div');
        wrap.className = 'detail-row';
        wrap.style.marginBottom = '10px';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';

        const lbl = document.createElement('label');
        lbl.textContent = dKey + ":";
        lbl.style.fontWeight = 'bold';
        lbl.style.marginBottom = '5px';
        wrap.appendChild(lbl);
        
        if (tKey === 'remarks') {
            const sel = document.createElement('select');
            sel.dataset.key = rKey;
            sel.disabled = true;
            sel.style.padding = '8px';
            sel.style.border = '1px solid #ccc';
            sel.style.borderRadius = '4px';
            sel.style.background = '#f9f9f9';
            sel.style.width = '100%';
            
            sel.innerHTML = `<option value="">-- No Remarks --</option>`;
            parsedUniqueRemarks.forEach(rmk => {
                const opt = document.createElement('option');
                opt.value = rmk; opt.textContent = rmk;
                sel.appendChild(opt);
            });
            if (val) sel.value = val;
            wrap.appendChild(sel);
        } else {
            const inp = document.createElement('textarea');
            inp.value = val;
            inp.dataset.key = rKey;
            inp.disabled = true;
            inp.style.padding = '8px';
            inp.style.border = '1px solid #ccc';
            inp.style.borderRadius = '4px';
            inp.style.background = '#f9f9f9';
            inp.style.width = '100%';
            inp.style.boxSizing = 'border-box';
            inp.style.resize = 'vertical';
            inp.style.minHeight = '35px';
            if(tKey === 'description' || tKey === 'remarks') inp.style.minHeight = '60px';
            wrap.appendChild(inp);
        }
        
        detailContainer.appendChild(wrap);
    });

    const docKeys = [
        { label: 'Photo 1', tKey: 'photo 1' },
        { label: 'Photo 2', tKey: 'photo 2' },
        { label: 'Map Coordinates', tKey: 'map coordinates' },
        { label: 'Tax Declaration', tKey: 'tax declaration' },
        { label: 'TCT Page 1', tKey: 'transfer_cert1' },
        { label: 'TCT Page 2', tKey: 'transfer_cert2' }
    ];

    docKeys.forEach(doc => {
        const rKey = headerMapping[doc.tKey];
        const val = rKey ? (row[rKey] || '') : '';
        if (val.trim() !== '') {
            modalPhotos.push({
                label: doc.label,
                url: val,
                tKey: doc.tKey
            });
        }
    });

    modalFormContainer.appendChild(detailContainer);

    const galleryContainer = document.createElement('div');
    galleryContainer.id = 'modalGalleryContainer';
    galleryContainer.style.marginTop = '20px';
    galleryContainer.style.textAlign = 'center';
    galleryContainer.style.paddingTop = '20px';
    galleryContainer.style.borderTop = '1px solid #eee';
    galleryContainer.style.position = 'relative';

    if (modalPhotos.length > 0) {
        currentPhotoIndex = 0;
        if (specificImageKey) {
            const foundIdx = modalPhotos.findIndex(p => p.tKey === specificImageKey);
            if (foundIdx !== -1) currentPhotoIndex = foundIdx;
        }

        const labelEl = document.createElement('h4');
        labelEl.id = 'modalGalleryLabel';
        labelEl.style.marginBottom = '15px';
        labelEl.style.color = '#333';
        galleryContainer.appendChild(labelEl);

        const imgEl = document.createElement('img');
        imgEl.id = 'modalGalleryImage';
        imgEl.style.maxWidth = '100%';
        imgEl.style.maxHeight = '400px';
        imgEl.style.objectFit = 'contain';
        imgEl.style.border = '1px solid #ccc';
        imgEl.style.borderRadius = '4px';
        imgEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        imgEl.onerror = function() {
            if(this.src !== getDirectImageUrl(modalPhotos[currentPhotoIndex].url, 'thumbnail')) {
                this.src = getDirectImageUrl(modalPhotos[currentPhotoIndex].url, 'thumbnail');
            } else {
                this.src = modalPhotos[currentPhotoIndex].url;
            }
        };
        galleryContainer.appendChild(imgEl);

        if (modalPhotos.length > 1) {
            const navWrap = document.createElement('div');
            navWrap.style.marginTop = '15px';
            navWrap.style.display = 'flex';
            navWrap.style.justifyContent = 'center';
            navWrap.style.gap = '20px';
            navWrap.style.alignItems = 'center';

            const prevBtn = document.createElement('button');
            prevBtn.textContent = '◀ Previous Media';
            prevBtn.className = 'gallery-nav-btn';
            prevBtn.onclick = () => {
                currentPhotoIndex = (currentPhotoIndex - 1 + modalPhotos.length) % modalPhotos.length;
                updateModalGallery();
            };

            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next Media ▶';
            nextBtn.className = 'gallery-nav-btn';
            nextBtn.onclick = () => {
                currentPhotoIndex = (currentPhotoIndex + 1) % modalPhotos.length;
                updateModalGallery();
            };

            const counterEl = document.createElement('span');
            counterEl.id = 'modalGalleryCounter';
            counterEl.style.fontWeight = 'bold';
            counterEl.style.color = '#666';

            navWrap.appendChild(prevBtn);
            navWrap.appendChild(counterEl);
            navWrap.appendChild(nextBtn);
            galleryContainer.appendChild(navWrap);
            
            const btnStyles = document.createElement('style');
            btnStyles.innerHTML = `.gallery-nav-btn { padding: 8px 15px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer; transition: 0.2s; } .gallery-nav-btn:hover { background: #0056b3; }`;
            galleryContainer.appendChild(btnStyles);
        }

        modalFormContainer.appendChild(galleryContainer);
        updateModalGallery(); 
    } else {
        const noMedia = document.createElement('p');
        noMedia.textContent = "No attachments or photos available for this record.";
        noMedia.style.color = '#777';
        noMedia.style.fontStyle = 'italic';
        galleryContainer.appendChild(noMedia);
        modalFormContainer.appendChild(galleryContainer);
    }

    if(modalEditBtn) modalEditBtn.style.display = 'inline-block';
    if(modalSaveBtn) modalSaveBtn.style.display = 'none';
    if(uploadPhotoBtn) uploadPhotoBtn.style.It looks like you forgot to include the original code! To generate the full copy-paste version with your retained functions, larger photos, and adjusted text, I will need to see the script or markup you are currently working with. 

In the meantime, if your export is HTML/CSS-based, here is the standard approach to enhancing visuals for a report:

### 1. Adjusting Text for Easier Visuals
To make text easier to read in a reporting format, it helps to increase the font size, add line spacing, and use a dark gray rather than a harsh black:
```css
.report-text {
    font-size: 14pt;      /* Larger, print-friendly text */
    line-height: 1.6;     /* Adds breathing room between lines */
    color: #333333;       /* Softer on the eyes */
    font-family: "Helvetica Neue", Arial, sans-serif;
}
