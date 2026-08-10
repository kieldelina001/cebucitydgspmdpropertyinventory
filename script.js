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

// Upload Modal Elements (Added)
const uploadModal = document.getElementById('uploadModal');
const uploadIframe = document.getElementById('uploadIframe');
const closeUploadModalBtn = document.getElementById('closeUploadModalBtn');

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

async function loadInventoryFromGoogleSheets(retainPage = false) {
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
                    initializeSystemUI(retainPage);
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

function initializeSystemUI(retainPage = false) {
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
        // If retainPage is true, executeSearch(false) prevents resetting the page number to 1
        executeSearch(!retainPage);
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
    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const remF = remarksFilter ? remarksFilter.value : 'ALL';
    const typF = typeFilter ? typeFilter.value : 'ALL';
    const phoF = photoFilter ? photoFilter.value : 'ALL';
    
    const rKey = headerMapping['remarks'];
    const tKey = headerMapping['type'];
    const pKey1 = headerMapping['photo 1'];
    const pKey2 = headerMapping['photo 2'];
    const pKey3 = headerMapping['map coordinates'];
    const pKey4 = headerMapping['tax declaration'];
    const pKey5 = headerMapping['transfer_cert1'];
    const pKey6 = headerMapping['transfer_cert2'];
    
    const pKeys = [pKey1, pKey2, pKey3];
    const taxKeys = [pKey4, pKey5, pKey6];

    currentFilteredData = inventoryData.filter(row => {
        let matchText = true, matchRem = true, matchType = true, matchPhoto = true;
        
        if (term) {
            matchText = targetHeadersLowercase.some(k => {
                const mk = headerMapping[k];
                return mk && String(row[mk] || '').toLowerCase().includes(term);
            });
        }
        
        if (remF !== 'ALL') {
            matchRem = (String(row[rKey] || '') === remF);
        }
        
        if (typF !== 'ALL') {
            matchType = (String(row[tKey] || '') === typF);
        }
        
        if (phoF !== 'ALL') {
            const hasAnyMedia = pKeys.some(k => row[k] && row[k].trim() !== '');
            const hasTaxDec = taxKeys.some(k => row[k] && row[k].trim() !== '');
            if (phoF === 'WITH_PHOTO') matchPhoto = hasAnyMedia;
            if (phoF === 'NO_PHOTO') matchPhoto = !hasAnyMedia;
            if (phoF === 'WITH_TAX_DEC') matchPhoto = hasTaxDec;
        }
        
        return matchText && matchRem && matchType && matchPhoto;
    });

    if (foundCountDisplay) foundCountDisplay.textContent = `(${currentFilteredData.length} records active)`;
    
    if (resetPage) currentPage = 1;
    renderTable(currentFilteredData, currentPage);
}

// 🖼️ MODAL HANDLING & EDIT
function openPopUp(rowId, clickedPhotoKey = null) {
    activeEditIndex = rowId;
    const itemData = inventoryData.find(r => r._rowId === rowId);
    if (!itemData) return;

    modalFormContainer.innerHTML = '';
    
    const flexWrapper = document.createElement('div');
    flexWrapper.className = 'modal-flex-layout';
    
    const fieldsSide = document.createElement('div');
    fieldsSide.className = 'modal-fields-side';
    
    const photoSide = document.createElement('div');
    photoSide.className = 'modal-photo-side';
    photoSide.id = 'modalPhotoSide'; 

    // --- POPULATE FIELDS ---
    popupOrderLowercase.forEach(tKey => {
        const mappedKey = headerMapping[tKey];
        const val = mappedKey ? (itemData[mappedKey] || '') : '';
        
        const fDiv = document.createElement('div');
        fDiv.className = 'modal-field';
        
        const lbl = document.createElement('label');
        lbl.textContent = mappedKey || tKey;
        
        let inp;
        if(tKey === 'remarks') {
            inp = document.createElement('select');
            inp.id = 'modal_' + tKey;
            inp.disabled = true;
            let found = false;
            parsedUniqueRemarks.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r; opt.textContent = r;
                if(r === val) { opt.selected = true; found = true; }
                inp.appendChild(opt);
            });
            if(val && !found) {
                const opt = document.createElement('option');
                opt.value = val; opt.textContent = val;
                opt.selected = true;
                inp.appendChild(opt);
            }
        } else if(tKey === 'description') {
            inp = document.createElement('textarea');
            inp.id = 'modal_' + tKey;
            inp.value = val;
            inp.rows = 8;
            inp.disabled = true;
        } else {
            inp = document.createElement('input');
            inp.type = 'text';
            inp.id = 'modal_' + tKey;
            inp.value = val;
            inp.disabled = true;
        }
        
        fDiv.appendChild(lbl);
        fDiv.appendChild(inp);
        fieldsSide.appendChild(fDiv);
    });

    // --- POPULATE MULTIPLE PHOTOS FOR VIEWER ---
    modalPhotos = [];
    const photoKeysDef = [
        { key: 'photo 1', label: 'Photo 1' },
        { key: 'photo 2', label: 'Photo 2' },
        { key: 'map coordinates', label: 'Map Coordinates' },
        { key: 'tax declaration', label: 'Tax Declaration' },
        { key: 'transfer_cert1', label: 'Transfer Certificate of Title Page 1' },
        { key: 'transfer_cert2', label: 'Transfer Certificate of Title Page 2' }
    ];

    photoKeysDef.forEach(p => {
        const mappedKey = headerMapping[p.key];
        if (mappedKey && itemData[mappedKey] && itemData[mappedKey].trim() !== '') {
            const val = itemData[mappedKey].trim();
            if (val.startsWith('http') || val.length > 0) {
                modalPhotos.push({ label: p.label, url: val, key: p.key });
            }
        }
    });

    currentPhotoIndex = 0;
    if (clickedPhotoKey) {
        const foundIndex = modalPhotos.findIndex(mp => mp.key === clickedPhotoKey);
        if (foundIndex !== -1) {
            currentPhotoIndex = foundIndex;
        }
    }
    
    flexWrapper.appendChild(fieldsSide);
    flexWrapper.appendChild(photoSide);
    modalFormContainer.appendChild(flexWrapper);
    
    renderModalPhotoViewer();

    modalModified = false; // Reset modification tracker on fresh open
    modalEditBtn.style.display = 'inline-block';
    modalSaveBtn.style.display = 'none';
    uploadPhotoBtn.style.display = 'inline-block';
    editModal.style.display = 'flex';
}

function renderModalPhotoViewer() {
    const photoSide = document.getElementById('modalPhotoSide');
    if (!photoSide) return;
    photoSide.innerHTML = ''; 

    if (modalPhotos.length === 0) {
        photoSide.innerHTML = `<div style="color: #64748b; font-style: italic; display: flex; height: 100%; align-items: center; justify-content: center;">No visual media documented for this asset.</div>`;
        return;
    }

    const currentImg = modalPhotos[currentPhotoIndex];
    const viewUrl = getDirectImageUrl(currentImg.url, 'view') || currentImg.url;
    const thumbUrl = getDirectImageUrl(currentImg.url, 'thumbnail') || currentImg.url;
    
    const photoContainer = document.createElement('div');
    photoContainer.className = 'modal-photo-container';

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'photo-actions-container';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'photo-action-btn';
    downloadBtn.innerHTML = `View Photo`;
    downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = viewUrl;
        a.download = `property_photo_${currentPhotoIndex + 1}.jpg`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    actionsContainer.appendChild(downloadBtn);

    photoContainer.appendChild(actionsContainer);

    if (modalPhotos.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'photo-nav-btn photo-prev-btn';
        prevBtn.innerHTML = '&#10094;'; 
        prevBtn.onclick = (e) => { e.stopPropagation(); navigatePhoto(-1); };
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'photo-nav-btn photo-next-btn';
        nextBtn.innerHTML = '&#10095;'; 
        nextBtn.onclick = (e) => { e.stopPropagation(); navigatePhoto(1); };
        
        photoContainer.appendChild(prevBtn);
        photoContainer.appendChild(nextBtn);
    }

    const imgEl = document.createElement('img');
    imgEl.src = viewUrl;
    imgEl.alt = currentImg.label;
    imgEl.onerror = function() {
        this.onerror = function() {
            this.src = currentImg.url;
        };
        this.src = thumbUrl;
    };

    photoContainer.appendChild(imgEl);
    photoSide.appendChild(photoContainer);

    const caption = document.createElement('div');
    caption.className = 'photo-caption';
    caption.textContent = `${currentImg.label} (${currentPhotoIndex + 1} of ${modalPhotos.length})`;
    photoSide.appendChild(caption);
}

function navigatePhoto(dir) {
    if (modalPhotos.length <= 1) return;
    currentPhotoIndex += dir;
    if (currentPhotoIndex < 0) currentPhotoIndex = modalPhotos.length - 1;
    if (currentPhotoIndex >= modalPhotos.length) currentPhotoIndex = 0;
    renderModalPhotoViewer();
}

function enableEditMode() {
    popupOrderLowercase.forEach(tKey => {
        const el = document.getElementById('modal_' + tKey);
        if (el && tKey !== 'article/item') el.disabled = false;
    });
    modalModified = true;
    modalEditBtn.style.display = 'none';
    modalSaveBtn.style.display = 'inline-block';
}

function triggerSaveProcess() {
    document.getElementById('custom-operator-input').value = 'Noel Rie N. Deliña';
    customNameModal.style.display = 'flex';
}

function finalizeSaveData(operatorName) {
    if (activeEditIndex === null) return;
    const itemData = inventoryData.find(r => r._rowId === activeEditIndex);
    if (!itemData) return;
    
    let payload = {
        rowId: activeEditIndex + 2, 
        updates: {},
        updatedBy: operatorName
    };
    
    let hasChanges = false;
    popupOrderLowercase.forEach(tKey => {
        if(tKey === 'article/item') return;
        const el = document.getElementById('modal_' + tKey);
        const mappedKey = headerMapping[tKey];
        if (el && mappedKey) {
            const newVal = el.value.trim();
            if (newVal !== (itemData[mappedKey] || '').trim()) {
                payload.updates[mappedKey] = newVal;
                itemData[mappedKey] = newVal; 
                hasChanges = true;
            }
        }
    });

    if (hasChanges) {
        showLoading("Transmitting modified datasets to Google Cloud...");
        const updateMappedKey = headerMapping['updated by'];
        const dateMappedKey = headerMapping['last update'];
        if(updateMappedKey) itemData[updateMappedKey] = operatorName;
        if(dateMappedKey) itemData[dateMappedKey] = new Date().toLocaleString();

        fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(res => {
            hideLoading();
            if(res.success) {
                alert("Cloud Sync Successful: Data modifications permanently applied.");
                // Let closeModal handle the background refresh to keep the page state
                closeModal();
            } else {
                alert("Sync Failure: " + (res.error || "Unknown Network Exception"));
            }
        })
        .catch(err => {
            hideLoading();
            alert("Fatal Error: Cloud Server unreachable.");
            console.error(err);
        });
    } else {
        alert("Integrity Check: No changes detected in the matrix.");
        closeModal();
    }
}

// 🌐 OPENS UPLOAD WINDOW IN IFRAME MODAL
function openUploadWindow() {
    if (activeEditIndex === null) return;
    const itemData = inventoryData.find(r => r._rowId === activeEditIndex);
    if (!itemData) return;

    // Pull exact Item ID required by GAS
    const articleKey = headerMapping['article/item'];
    const itemCode = itemData[articleKey] || 'Unknown';

    // Append ?itemCode= to deployment URL
    const uploadUrl = GOOGLE_APPS_SCRIPT_URL + "?itemCode=" + encodeURIComponent(itemCode);
    
    // Launch within the iframe inside the modal wrapper
    if (uploadIframe && uploadModal) {
        uploadIframe.src = uploadUrl;
        uploadModal.style.display = 'flex';
        modalModified = true; // Mark as modified so the table syncs the new photos upon closing
    }
}

// 🌐 CLOSES UPLOAD IFRAME MODAL
function closeUploadModal() {
    if (uploadModal) {
        uploadModal.style.display = 'none';
    }
    if (uploadIframe) {
        uploadIframe.src = ''; // Clear source to stop media loads in the background
    }
}

// 🌐 REFRESHES IN PLACE ON CLOSE (FOR PROPERTY DETAILS)
function closeModal() {
    editModal.style.display = 'none';
    
    // If photos were uploaded or data was edited, refresh sheets but keep the current page
    if (modalModified) {
        loadInventoryFromGoogleSheets(true);
    }
    
    activeEditIndex = null;
    modalModified = false;
}

function setupSystemEventHandlers() {
    if(searchButton) searchButton.addEventListener('click', () => executeSearch(true));
    if(searchInput) searchInput.addEventListener('keypress', e => { if(e.key === 'Enter') executeSearch(true); });
    
    if(remarksFilter) remarksFilter.addEventListener('change', () => executeSearch(true));
    if(typeFilter) typeFilter.addEventListener('change', () => executeSearch(true));
    if(photoFilter) photoFilter.addEventListener('change', () => executeSearch(true));
    
    if(exportButton) exportButton.addEventListener('click', () => downloadDatasetCSV(inventoryData, 'Full_Inventory'));
    if(exportFilteredButton) exportFilteredButton.addEventListener('click', () => downloadSearchedHTML(currentFilteredData));
    
    // Upload event binding modified here
    if(uploadPhotoBtn) uploadPhotoBtn.addEventListener('click', openUploadWindow); 
    
    if(modalEditBtn) modalEditBtn.addEventListener('click', enableEditMode);
    if(modalSaveBtn) modalSaveBtn.addEventListener('click', triggerSaveProcess);
    if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if(modalCloseX) modalCloseX.addEventListener('click', closeModal); 
    if(closeUploadModalBtn) closeUploadModalBtn.addEventListener('click', closeUploadModal);
    
    document.getElementById('customCancelNameBtn').addEventListener('click', () => {
        customNameModal.style.display = 'none';
    });
    
    document.getElementById('customConfirmNameBtn').addEventListener('click', () => {
        const nameVal = document.getElementById('custom-operator-input').value.trim();
        if(!nameVal) { alert("Authorization Denied: Operator name required."); return; }
        customNameModal.style.display = 'none';
        finalizeSaveData(nameVal);
    });
}

function downloadDatasetCSV(data, filenamePrefix) {
    if(!data || data.length === 0) {
        alert("Export Nullified: No dataset active for export.");
        return;
    }
    const headerRow = rawHeaders.join(",");
    const rows = data.map(r => rawHeaders.map(h => `"${(r[h] || '').replace(/"/g, '""')}"`).join(","));
    const csvContent = [headerRow, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filenamePrefix}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 🌐 Restored & Optimized HTML Export Function with Larger Photos & High-Contrast Print-Ready Text
function downloadSearchedHTML(data) {
    if(!data || data.length === 0) {
        alert("Export Nullified: No dataset active for export.");
        return;
    }

    let tableRowsHTML = '';
    data.forEach(row => {
        tableRowsHTML += '<tr>';
        // USE THE NEW CONFIGURATION ARRAY HERE
        EXPORT_TABLE_CONFIG.forEach(col => {
            const tKey = col.key;
            const resolvedKey = headerMapping[tKey];
            const val = resolvedKey ? (row[resolvedKey] || '') : '';
            
            if (tKey.includes('photo') || tKey.includes('map coordinates') || tKey.includes('tax declaration') || tKey.includes('transfer_cert')) {
                if (val.trim() !== '') {
                    const viewUrl = getDirectImageUrl(val, 'view') || val;
                    const thumbUrl = getDirectImageUrl(val, 'thumbnail') || val;
                    tableRowsHTML += `<td style="text-align: center;"><img src="${viewUrl}" onerror="this.onerror=null; this.src='${thumbUrl}';" style="height: 250px; max-width: 250px; width: auto; object-fit: contain; border: 1px solid #94a3b8; border-radius: 4px; display: block; margin: 0 auto;" /></td>`;
                } else {
                    tableRowsHTML += `<td style="text-align: center; color: #64748b; font-style: italic;">No Photo</td>`;
                }
            } else {
            // 💡 Custom sizing specifically for the Description column
            let styleAttr = "";
            if (tKey === "description") {
                styleAttr = ' style="width: 200px; min-width: 190px;"';
            }
            tableRowsHTML += `<td${styleAttr}>${escapeHtml(val)}</td>`;
        }
        });
        tableRowsHTML += '</tr>';
    });

    let headersHTML = '';
    // USE THE NEW CONFIGURATION ARRAY HERE
    EXPORT_TABLE_CONFIG.forEach(col => {
        headersHTML += `<th>${col.display}</th>`;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Searched Inventory Report</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            color: #0f172a; 
            background: #ffffff; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        h1 { 
            text-align: center; 
            color: #0f172a; 
            text-transform: uppercase; 
            font-size: 24px;
            margin-bottom: 5px;
        }
        .report-meta {
            text-align: center;
            font-size: 14px;
            color: #334155;
            margin-bottom: 25px;
            font-weight: bold;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
            background: white; 
        }
        th, td { 
            border: 1px solid #64748b; 
            padding: 10px 12px; 
            text-align: left; 
            font-size: 16px; 
            line-height: 1.4;
            word-break: break-word; 
            color: #0f172a;
            vertical-align: middle;
        }
        th { 
            background-color: #cbd5e1 !important; 
            color: #0f172a;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.5px;
        }
        tr:nth-child(even) {
            background-color: #f8fafc;
        }
        @media print {
            body { margin: 10px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th { background-color: #cbd5e1 !important; }
        }
    </style>
</head>
<body>
    <h1>Real Estate Inventory Report</h1>
    <div class="report-meta">
        Exported On: ${new Date().toLocaleString()} &bull; Total Records: ${data.length}
    </div>
    <table>
        <thead>
            <tr>${headersHTML}</tr>
        </thead>
        <tbody>
            ${tableRowsHTML}
        </tbody>
    </table>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Searched_Inventory_Report_${new Date().toISOString().slice(0,10)}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
