// 🔑 Google Sheets Cloud Gateway Architecture
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxSCW2ZeIFBJaQ3qts8oNeWVxHDGMt4FOqQgTk4bswbbhfzi_e5prVc0-QWDKo2j7tIJg/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
// Update: Changed to the official Google Drive Export endpoint to prevent CORS & redirect issues
const GOOGLE_SHEET_CSV_URL = `https://www.googleapis.com/drive/v3/files/${SPREADSHEET_ID}/export?mimeType=text/csv`;

// =========================================================================
// 🛠️ MANUAL EXPORT TABLE ADJUSTMENT CONFIGURATION 🛠️
// Adjust the items below to change which columns appear in the "Export Searched" HTML file.
// =========================================================================
const EXPORT_TABLE_CONFIG = [
    { display: "Article no./ TCT no.", key: "article/item" },
    { display: "Description", key: "description" },
    { display: "Notes", key: "notes" }, /// add notes
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

const displayHeaders = ["Article no./ TCT no.", "Description", "Notes", "Unit Value", "Remarks", "Type", "Photo 1", "Photo 2", "Map Coordinates", "Tax Declaration", "Transfer Certificate of Title Page 1", "Transfer Certificate of Title Page 2", "UPDATED BY", "LAST UPDATE"];
const targetHeadersLowercase = ["article/item", "description", "notes", "unit value", "remarks", "type", "photo 1", "photo 2", "map coordinates", "tax declaration", "transfer_cert1", "transfer_cert2", "updated by", "last update"];
const popupOrderLowercase = ["article/item", "description", "notes", "unit value", "remarks", "type"]; 

let inventoryData = []; 
let currentFilteredData = []; 
let rawHeaders = [];       
let headerMapping = {}; 
let activeEditIndex = null; 
let parsedUniqueRemarks = []; 
let isAppInitialized = false; 
let modalModified = false;
let loggedInUser = "System User";

// 🔐 GIS Auth Architecture
let accessToken = null;
let authInProgress = false;
let authPopup = null;
let authPollTimer = null;
const AUTH_RETURN_TIMEOUT = 120000;
const imageCache = {}; // Cache image blobs to avoid repeat fetches

// Modal Photo Gallery State
let modalPhotos = [];
let currentPhotoIndex = 0;

// Pagination Variables
let currentPage = 1;
const itemsPerPage = 50;

let searchInput, searchButton, resetFiltersButton, exportButton, exportFilteredButton, remarksFilter, typeFilter, photoFilter, tableHeaderRow, tableBody, statusBanner, foundCountDisplay;
let paginationContainer, prevPageBtn, nextPageBtn, pageIndicator;
let countTotal, countExisting, countNotFound, countVerification, countWithPhotos, countTaxDec;
let countBuilding, countAssetMod, countFlood, countHospital, countLand, countMarket, countOtherInfra, countOtherLand, countOtherStruct, countPark, countRoad, countSchool, countSlaughterhouse, countWater;
let editModal, modalFormContainer, modalEditBtn, modalSaveBtn, modalCloseBtn, modalCloseX, uploadPhotoBtn;
let tooltip, tooltipImg;
let loadingOverlay, customNameModal;
let countInsured, countNotInsured, countExpiring;
let activeInsuranceFilter = 'ALL'; // Tracks which card is currently clicked

function resetAndFilterByItem(filterCategory, clickedValue) {
    // 1. Reset all filters and search inputs to default
    if (searchInput) searchInput.value = "";
    
    // Assuming the default value for your dropdowns is an empty string "" 
    // If your default value is something else, use that (e.g., "-- All Types --")
    if (remarksFilter) remarksFilter.value = ""; 
    if (typeFilter) typeFilter.value = "";
    if (photoFilter) photoFilter.value = "";

    // 2. Set the specific filter to the value of the item clicked
    if (filterCategory === 'type' && typeFilter) {
        typeFilter.value = clickedValue;
    } else if (filterCategory === 'remarks' && remarksFilter) {
        remarksFilter.value = clickedValue;
    }

    // Optional: Reset pagination to page 1 if you have a pagination variable
    // currentPage = 1; 

    // 3. Trigger your search function to update the table based on the new filter
    // Passing 'true' based on your executeSearch(!retainPage) logic
    executeSearch(true); 
}

// ⏳ LOADING OVERLAY GENERATOR
function initUIReferences() {
    searchInput = document.getElementById('searchInput');
    searchButton = document.getElementById('searchButton');
	resetFiltersButton = document.getElementById('resetFiltersButton');
    exportButton = document.getElementById('exportButton');
    exportFilteredButton = document.getElementById('exportFilteredButton');
    remarksFilter = document.getElementById('remarksFilter');
    typeFilter = document.getElementById('typeFilter');
    photoFilter = document.getElementById('photoFilter');
    tableHeaderRow = document.getElementById('tableHeaderRow');
    tableBody = document.getElementById('tableBody');
    statusBanner = document.getElementById('statusBanner');
    foundCountDisplay = document.getElementById('foundCountDisplay'); 

    paginationContainer = document.getElementById('paginationContainer');
    prevPageBtn = document.getElementById('prevPageBtn');
    nextPageBtn = document.getElementById('nextPageBtn');
    pageIndicator = document.getElementById('pageIndicator');

    countTotal = document.getElementById('countTotal');
    countExisting = document.getElementById('countExisting');
    countNotFound = document.getElementById('countNotFound');
    countVerification = document.getElementById('countVerification');
    countWithPhotos = document.getElementById('countWithPhotos');
    countTaxDec = document.getElementById('countTaxDec');
countInsured = document.getElementById('countInsured');
    countNotInsured = document.getElementById('countNotInsured');
	countExpiring = document.getElementById('countExpiring');

    countBuilding = document.getElementById('countBuilding');
    countAssetMod = document.getElementById('countAssetMod'); 
    countFlood = document.getElementById('countFlood');
    countHospital = document.getElementById('countHospital');
    countLand = document.getElementById('countLand');
    countMarket = document.getElementById('countMarket');
    countOtherInfra = document.getElementById('countOtherInfra');
    countOtherLand = document.getElementById('countOtherLand');
    countOtherStruct = document.getElementById('countOtherStruct');
    countPark = document.getElementById('countPark');
    countRoad = document.getElementById('countRoad');
    countSchool = document.getElementById('countSchool');
    countSlaughterhouse = document.getElementById('countSlaughterhouse');
    countWater = document.getElementById('countWater');

    editModal = document.getElementById('editModal');
    modalFormContainer = document.getElementById('modalFormContainer');
    modalEditBtn = document.getElementById('modalEditBtn');
    modalSaveBtn = document.getElementById('modalSaveBtn');
    modalCloseBtn = document.getElementById('modalCloseBtn');
    modalCloseX = document.getElementById('modalCloseX'); 
    uploadPhotoBtn = document.getElementById('uploadPhotoBtn'); 

    tooltip = document.getElementById('imagePreviewTooltip');
    tooltipImg = document.getElementById('imagePreviewTooltipImg');

    loadingOverlay = document.getElementById('dynamicLoadingOverlay');
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
            alignItems: 'center', zIndex: '150000', transition: 'opacity 0.2s ease'
        });
        const styleSheet = document.createElement("style");
        styleSheet.innerText = "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
        document.head.appendChild(styleSheet);
        document.body.appendChild(loadingOverlay);
    }

    customNameModal = document.getElementById('customNameModal');
    if (!customNameModal) {
        customNameModal = document.createElement('div');
        customNameModal.id = 'customNameModal';
        customNameModal.innerHTML = `
            <div style="background: #ffffff !important; padding: 30px !important; border-radius: 8px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important; width: 90% !important; max-width: 400px !important; box-sizing: border-box !important; text-align: center !important; font-family: Arial, sans-serif !important;">
                <label style="font-size: 18px !important; font-weight: bold !important; color: #333333 !important; display: block !important; margin-bottom: 15px !important;">Enter Your Name to Log This Change:</label>
                <input type="text" id="custom-operator-input" value="" placeholder="Your Name" style="width: 100% !important; padding: 12px !important; font-size: 16px !important; border: 1px solid #ccc !important; border-radius: 4px !important; margin-bottom: 20px !important; box-sizing: border-box !important;" />
                <div style="display: flex !important; gap: 10px !important; justify-content: center !important;">
                    <button id="customCancelNameBtn" style="background: #6c757d !important; color: white !important; border: none !important; padding: 10px 20px !important; border-radius: 4px !important; cursor: pointer !important; font-weight: bold !important; font-size: 14px !important;">Cancel</button>
                    <button id="customConfirmNameBtn" style="background: #28a745 !important; color: white !important; border: none !important; padding: 10px 20px !important; border-radius: 4px !important; cursor: pointer !important; font-weight: bold !important; font-size: 14px !important;">Confirm & Publish</button>
                </div>
            </div>
        `;
        Object.assign(customNameModal.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'none', justifyContent: 'center',
            alignItems: 'center', zIndex: '200000'
        });
        document.body.appendChild(customNameModal);
    }
}

function showLoading(msg) {
    const textEl = document.getElementById('loadingOverlayText');
    if (textEl) textEl.textContent = msg;
    if (loadingOverlay) loadingOverlay.style.setProperty('display', 'flex', 'important');
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.setProperty('display', 'none', 'important');
}

// --- BACK TO TOP SCROLL LISTENER ---
window.addEventListener('scroll', () => {
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        // Add accessToken check to ensure it only shows when securely logged in
        if (loggedInUser !== "System User" && (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300)) {
            backToTopBtn.style.visibility = "visible";
            backToTopBtn.style.opacity = "1";
        } else {
            backToTopBtn.style.visibility = "hidden";
            backToTopBtn.style.opacity = "0";
        }
    }
});

// 🔐 CLEAN GOOGLE LOGIN + AUTHORIZED ACCOUNTS CHECK
// Google OAuth/GIS has intentionally been removed from this file.
// The Google Apps Script Web App is used as the authentication gateway.

function getAuthReturnUrl() { return window.location.origin + window.location.pathname; }
function showLoginError(message) { const el=document.getElementById('loginError'); if(el) el.textContent=message||''; }
function showLoginScreen() { const a=document.getElementById('loginScreen'), b=document.getElementById('mainApp'); if(a)a.style.display=''; if(b)b.style.display='none'; }
function showMainApplication() { const a=document.getElementById('loginScreen'), b=document.getElementById('mainApp'); if(a)a.style.display='none'; if(b)b.style.display='block'; }
function cleanupAuthPopup(){ authInProgress=false; if(authPollTimer){clearInterval(authPollTimer);authPollTimer=null;} if(authPopup&&!authPopup.closed){try{authPopup.close();}catch(e){}} authPopup=null; }

function openGoogleLogin(){
    if(authInProgress)return; showLoginError(''); authInProgress=true;
    const authUrl=GOOGLE_APPS_SCRIPT_URL+'?action=auth&returnUrl='+encodeURIComponent(getAuthReturnUrl());
    const w=520,h=700,left=Math.max(0,Math.round((screen.width-w)/2)),top=Math.max(0,Math.round((screen.height-h)/2));
    authPopup=window.open(authUrl,'GoogleAccountLogin',`width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    if(!authPopup){cleanupAuthPopup();showLoginError('Please allow pop-ups for this website, then click Sign in with Google again.');return;}
    const started=Date.now();
    authPollTimer=setInterval(()=>{
        if(!authPopup||authPopup.closed){cleanupAuthPopup();if(loggedInUser==='System User')showLoginError('Google login was cancelled.');return;}
        if(Date.now()-started>AUTH_RETURN_TIMEOUT){cleanupAuthPopup();showLoginError('Google login timed out. Please try again.');}
    },500);
}

function processAuthCallback(){
    const p=new URLSearchParams(window.location.search), state=p.get('auth'); if(!state)return false;
    const email=(p.get('email')||'').trim().toLowerCase(), authorized=p.get('authorized')==='true', message=p.get('message')||'';
    try{window.history.replaceState({},document.title,window.location.origin+window.location.pathname);}catch(e){}
    cleanupAuthPopup();
    if(state==='success'&&email){
        loggedInUser=email;
        const op=document.getElementById('custom-operator-input'); if(op){op.value=email;op.disabled=true;}
        if(!authorized){showAccessRequestModal(email);return true;}
        sessionStorage.setItem('accessCounter','1'); showMainApplication(); setupSystemEventHandlers(); loadInventoryFromGoogleSheets(); resetIdleTimer(); return true;
    }
    showLoginScreen(); showLoginError(message||'Unable to identify the Google account. Please log in again.'); return true;
}

function showAccessRequestModal(email){
    const modal=document.getElementById('accessModal'), text=document.getElementById('accessModalText'), submit=document.getElementById('submitRequestBtn'), close=document.getElementById('closeModalBtn'), note=document.getElementById('requestNotesInput');
    if(!modal||!text||!submit||!close){showLoginError('This account is not authorized, and the access request window is unavailable.');return;}
    if(note){note.style.display='block';note.value='';}
    text.innerHTML='Your Google account (<b>'+escapeHtml(email)+'</b>) is not authorized to access this application.<br><br>Would you like to send an access request?';
    modal.style.display='flex'; submit.style.display='inline-block'; close.textContent='Cancel'; close.style.background='#6c757d'; close.style.color='white';
    submit.onclick=function(){
        const noteValue=note?(note.value.trim()||'No note provided'):'No note provided'; if(note)note.value='';
        text.innerHTML='<div style="text-align:center;"><h3 style="margin-top:0;margin-bottom:12px;color:#155724;font-size:22px;">✅ Request Access Sent</h3><p style="margin:0;line-height:1.6;font-size:15px;color:#333;">Your request has been successfully sent. Please wait for admin approval or contact <b>639282199308</b> for follow-up.</p></div>';
        if(note)note.style.display='none'; submit.style.display='none'; close.textContent='OK'; close.style.background='#28a745';
        const u=GOOGLE_APPS_SCRIPT_URL+'?action=requestAccess&email='+encodeURIComponent(email)+'&name='+encodeURIComponent(email)+'&notes='+encodeURIComponent(noteValue);
        fetch(u,{method:'GET',mode:'no-cors'}).catch(e=>console.error('Access request failure:',e));
    };
    close.onclick=function(){modal.style.display='none';sessionStorage.removeItem('accessCounter');loggedInUser='System User';showLoginScreen();setTimeout(()=>{text.innerHTML='Your Google account does not have permission to access this application.';submit.style.display='inline-block';close.textContent='Cancel';close.style.background='#6c757d';if(note){note.value='';note.style.display='block';}},300);};
}

// Compatibility wrapper for any old HTML references. No Google OAuth is used.
function getOrCreateTokenClient(){return null;}

// 🖱️ DASHBOARD CARD CLICK HANDLERS
// 🖱️ DASHBOARD CARD CLICK HANDLERS
function setupDashboardClickHandlers() {
    
    // 🧹 NEW: Helper function to clear search and dropdowns
    function resetAllFilters() {
        if (searchInput) searchInput.value = '';
        if (remarksFilter) remarksFilter.value = 'ALL';
        if (typeFilter) typeFilter.value = 'ALL';
        if (photoFilter) photoFilter.value = 'ALL';
        
        // Clear insurance UI filter if active
        if (typeof activeInsuranceFilter !== 'undefined') {
            activeInsuranceFilter = 'ALL';
            document.querySelectorAll('.ins-card').forEach(c => {
                c.style.transform = 'scale(1)';
                c.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                c.style.backgroundColor = '#f8f9fa';
            });
            const clearBtn = document.getElementById('clearInsFilterBtn');
            if (clearBtn) clearBtn.style.display = 'none';
        }
    }

   // Helper function to set dropdown value (Exact Match first, then Partial Match)
    function setDropdownByText(selectEl, keyword) {
        if (!selectEl) return false;
        const keyUpper = keyword.toUpperCase().trim();

        // Pass 1: Check for exact matches first (prevents 'STRUCTURE' matching 'INFRASTRUCTURE')
        for (let i = 0; i < selectEl.options.length; i++) {
            const optVal = selectEl.options[i].value.toUpperCase().trim();
            const optText = selectEl.options[i].text.toUpperCase().trim();
            if (optVal === keyUpper || optText === keyUpper) {
                selectEl.selectedIndex = i;
                return true;
            }
        }

        // Pass 2: Partial match fallback if exact match isn't found
        for (let i = 0; i < selectEl.options.length; i++) {
            const optVal = selectEl.options[i].value.toUpperCase();
            const optText = selectEl.options[i].text.toUpperCase();
            if (optVal.includes(keyUpper) || optText.includes(keyUpper)) {
                selectEl.selectedIndex = i;
                return true;
            }
        }
        return false;
    }

    // Helper function to smoothly scroll to the data table
    function scrollToTable() {
        const tableSec = document.querySelector('.table-section');
        if (tableSec) {
            tableSec.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // --- 1. TOTAL PROPERTIES CARD (Reset all filters) ---
    const cardTotal = document.getElementById('countTotal')?.closest('.dash-card');
    if (cardTotal) {
        cardTotal.onclick = () => {
            resetAllFilters(); // Just clear everything
            executeSearch(true);
            scrollToTable();
        };
    }

    // --- 2. STATUS DASHBOARD CARDS ---
    const cardExisting = document.getElementById('countExisting')?.closest('.dash-card');
    if (cardExisting) {
        cardExisting.onclick = () => {
            resetAllFilters(); // Reset everything first!
            if (remarksFilter) {
            const found = setDropdownByText(remarksFilter, 'EXISTING');
            if (!found && searchInput) searchInput.value = 'EXISTING';
        }
            executeSearch(true);
            scrollToTable();
        };
    }

    const cardNotFound = document.getElementById('countNotFound')?.closest('.dash-card');
    if (cardNotFound) {
        cardNotFound.onclick = () => {
            resetAllFilters(); // Reset everything first!
            if (remarksFilter) {
            const found = setDropdownByText(remarksFilter, 'NOT FOUND');
            if (!found && searchInput) searchInput.value = 'NOT FOUND';
        }
            executeSearch(true);
            scrollToTable();
        };
    }

    const cardVerification = document.getElementById('countVerification')?.closest('.dash-card');
    if (cardVerification) {
        cardVerification.onclick = () => {
            resetAllFilters(); // Reset everything first!
            if (remarksFilter) {
            const found = setDropdownByText(remarksFilter, 'VERIFICATION');
            if (!found && searchInput) searchInput.value = 'VERIFICATION';
        }
            executeSearch(true);
            scrollToTable();
        };
    }

const cardTaxDec = document.getElementById('countTaxDec')?.closest('.dash-card');
    if (cardTaxDec) {
        cardTaxDec.onclick = () => {
            resetAllFilters(); // Reset everything first!
            if (photoFilter && photoFilter.options.length > 3) {
                photoFilter.selectedIndex = 3; // Index 3 is "With Tax Declaration"
            }
            executeSearch(true);
            scrollToTable();
        };
    }
	
    const cardPhotos = document.getElementById('countWithPhotos')?.closest('.dash-card');
    if (cardPhotos) {
        cardPhotos.onclick = () => {
            resetAllFilters(); // Reset everything first!
            if (photoFilter && photoFilter.options.length > 1) {
                photoFilter.selectedIndex = 1; 
            }
            executeSearch(true);
            scrollToTable();
        };
    }

   // --- 3. PROPERTY TYPE CARDS (Updated Keywords) ---
    const typeMappings = [
        { id: 'countBuilding', keyword: 'BUILDING' },
        { id: 'countAssetMod', keyword: 'BUILDING MODIFICATION' }, // Changed from 'ASSET'
        { id: 'countFlood', keyword: 'FLOOD' },
        { id: 'countHospital', keyword: 'HOSPITAL' },
        { id: 'countLand', keyword: 'LAND' },
        { id: 'countMarket', keyword: 'MARKET' },
        { id: 'countOtherInfra', keyword: 'OTHER INFRASTRUCTURE' },
        { id: 'countOtherLand', keyword: 'OTHER LAND' },
        { id: 'countOtherStruct', keyword: 'OTHER STRUCTURE' }, // Changed from 'STRUCTURE'
        { id: 'countPark', keyword: 'PARK' },
        { id: 'countRoad', keyword: 'ROAD' },
        { id: 'countSchool', keyword: 'SCHOOL' },
        { id: 'countSlaughterhouse', keyword: 'SLAUGHTERHOUSE' },
        { id: 'countWater', keyword: 'WATER' }
		
    ];

    typeMappings.forEach(item => {
        const countEl = document.getElementById(item.id);
        if (countEl) {
            const card = countEl.closest('.type-card');
            if (card) {
                card.onclick = () => {
                    resetAllFilters(); // Reset everything first!
                    if (typeFilter) {
                        const found = setDropdownByText(typeFilter, item.keyword);
                        if (!found && searchInput) {
                            searchInput.value = item.keyword; 
                        }
                    }
                    executeSearch(true);
                    scrollToTable();
                };
            }
        }
    });
}

function initApp() {
    initUIReferences();
    if (processAuthCallback()) return;
    const loginBtn=document.getElementById('customLoginBtn');
    if(loginBtn) loginBtn.addEventListener('click',openGoogleLogin);

    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

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
    
    document.addEventListener('mouseover', function(e) {
        if (e.target && e.target.classList.contains('hover-preview-img')) {
            const srcToUse = e.target.src;
            if (srcToUse && !srcToUse.includes('svg+xml') && tooltip && tooltipImg) {
                tooltipImg.src = srcToUse;
                tooltip.style.display = 'block';
            }
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (e.target && e.target.classList.contains('hover-preview-img') && tooltip && tooltip.style.display === 'block') {
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
            if (tooltip && tooltipImg) {
                tooltip.style.display = 'none';
                tooltipImg.src = '';
            }
        }
    });
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// 🌐 Secure Image Fetcher (Bypasses Google Drive Blocks)
async function fetchAuthorizedImage(driveUrl){
    if(!driveUrl||typeof driveUrl!=='string')return null;
    const match=driveUrl.match(/[-\w]{25,}/); if(!match)return driveUrl;
    const fileId=match[0]; if(imageCache[fileId])return imageCache[fileId];
    const direct=getDirectImageUrl(driveUrl,'view')||getDirectImageUrl(driveUrl,'thumbnail');
    if(direct)imageCache[fileId]=direct; return direct;
}

async function loadInventoryFromGoogleSheets(retainPage = false) {
    if (statusBanner) {
        statusBanner.style.backgroundColor = "#fff3cd";
        statusBanner.style.color = "#856404";
        statusBanner.textContent = "Connecting to Google Sheets Live Datastream...";
    }
    showLoading("Syncing live spreadsheet grid...");

    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        
        if (!response.ok) throw new Error("Could not connect to online Sheet feed.");
        const rawCsvText = await response.text(); 

        // ✅ NEW: If authorized and no counter exists, put counter for normal use
        if (!sessionStorage.getItem('accessCounter')) {
            sessionStorage.setItem('accessCounter', '1');
        }

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
        if(statusBanner){statusBanner.style.backgroundColor="#f8d7da";statusBanner.style.color="#721c24";statusBanner.textContent="Connection Error: Check Google Sheets access.";}
        console.error(err);
        if(loggedInUser!=="System User") performLogout(false); else {showLoginScreen();showLoginError("Cannot access Google Sheets. Please log in again.");}
    }
}

function initializeSystemUI(retainPage = false) {
    if (statusBanner) {
        statusBanner.style.backgroundColor = "#d4edda";
        statusBanner.style.color = "#155724";
        statusBanner.innerHTML = `<span class="live-animated-text">✅ Connected to Google Sheets: Live View Active.</span>`;
    }

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
	setupDashboardClickHandlers();

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
        executeSearch(!retainPage);
    }
}

function populateDropdown(type, selectEl, placeholderText) {
    // ... [Rest of your code continues normally]
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

// 🖼️ LAZY LOADING OBSERVER FOR TABLE PHOTOS
const tableImageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        // Check if the image has entered the viewport
        if (entry.isIntersecting) {
            const img = entry.target;
            const driveUrl = img.dataset.src;
            
            if (driveUrl) {
                // Fetch the image securely now that it's in view
                fetchAuthorizedImage(driveUrl).then(objectUrl => {
                    if (objectUrl) {
                        img.src = objectUrl;
                        img.alt = "Preview";
                    }
                });
                
                // Stop observing this image once it's processing
                observer.unobserve(img);
            }
        }
    });
}, { 
    rootMargin: "0px 0px 300px 0px" // Starts loading slightly before the user scrolls to it
});


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
                    const imgEl = document.createElement('img');
                    imgEl.className = "hover-preview-img";
                    imgEl.style.height = "50px";
                    imgEl.style.maxWidth = "80px";
                    imgEl.style.objectFit = "cover";
                    imgEl.style.border = "1px solid #ccc";
                    imgEl.style.borderRadius = "4px";
                    imgEl.style.cursor = "zoom-in";
                    imgEl.alt = "Loading...";
                    imgEl.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'%3E%3Ccircle cx='25' cy='25' r='20' fill='none' stroke='%23ccc' stroke-width='4' stroke-dasharray='31.4 31.4'%3E%3CanimateTransform attributeName='transform' type='rotate' from='0 25 25' to='360 25 25' dur='1s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/svg%3E";
                    
                imgEl.onclick = (event) => { event.stopPropagation(); openPopUp(row._rowId, tKey); };
                    
                    // Assign the URL to a data attribute instead of fetching immediately
                    imgEl.dataset.src = url; 
                    td.appendChild(imgEl);

                    // Tell the observer to watch this image placeholder
                    tableImageObserver.observe(imgEl);
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
    const pKey4 = headerMapping['tax declaration'];
const aKey = headerMapping['article/item'];
    const nKey = headerMapping['notes'];
    
    let insuredCount = 0, notInsuredCount = 0, expiringCount = 0;
    
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
        if(row[pKey4] && row[pKey4].trim()!=='') taxdec++;
        
        const typeStr = String(row[tKey] || '').toUpperCase().trim();
// --- BUILDING INSURANCE LOGIC ---
        const notesVal = String(row[nKey] || '');
        const notesUpper = notesVal.toUpperCase();

        if (notesUpper.includes('NOT INSURED')) {
            notInsuredCount++;
        } else if (notesUpper.includes('BUILDING INSURED')) {
            // Regex looks for "Coverage [Date] - [Date]" and extracts the second date
            const dateMatch = notesVal.match(/Coverage\s+.*?\s+-\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
            
            if (dateMatch && dateMatch[1]) {
                const endDate = new Date(dateMatch[1]);
                const currentDate = new Date(); 
                
                // Verify the extracted date is valid
                if (!isNaN(endDate.getTime())) {
                    const timeDiff = endDate.getTime() - currentDate.getTime();
                    const daysDiff = timeDiff / (1000 * 3600 * 24);
                    
                   // 30 days is the threshold for "Almost Expire"
                    if (daysDiff <= 30) {
                        expiringCount++; // Correctly count as Expiring
                    } else {
                        insuredCount++; // Active
                    }
                } else {
                    insuredCount++; // Fallback if date is invalid but says insured
                }
            } else {
                 insuredCount++; // Fallback if no date format is found but says insured
            }
        }
// --------------------------------



        
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
if(countInsured) countInsured.textContent = insuredCount;
    if(countNotInsured) countNotInsured.textContent = notInsuredCount;
	if(countExpiring) countExpiring.textContent = expiringCount;
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
    const pKey4 = headerMapping['tax declaration'];
    const aKey = headerMapping['article/item'];
    const nKey = headerMapping['notes'];
	
    const photo1Or2Keys = [pKey1, pKey2];

    currentFilteredData = inventoryData.filter(row => {
        let matchText = true, matchRem = true, matchType = true, matchPhoto = true, matchInsurance = true;
        
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
            const hasPhoto1Or2 = photo1Or2Keys.some(k => k && row[k] && row[k].trim() !== '');
            const hasTaxDec = pKey4 ? (row[pKey4] && row[pKey4].trim() !== '') : false;
            if (phoF === 'WITH_PHOTO') matchPhoto = hasPhoto1Or2;
            if (phoF === 'NO_PHOTO') matchPhoto = !hasPhoto1Or2;
            if (phoF === 'WITH_TAX_DEC') matchPhoto = hasTaxDec;
        }
       // --- INSURANCE CLICK FILTER LOGIC ---
        if (activeInsuranceFilter !== 'ALL') {
            const notesVal = String(row[nKey] || '');
            const notesUpper = notesVal.toUpperCase();
            let status = 'NONE';
            
            if (notesUpper.includes('NOT INSURED')) {
                status = 'NOT_INSURED';
            } else if (notesUpper.includes('BUILDING INSURED')) {
                const dateMatch = notesVal.match(/Coverage\s+.*?\s+-\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
                if (dateMatch && dateMatch[1]) {
                    const endDate = new Date(dateMatch[1]);
                    if (!isNaN(endDate.getTime())) {
                        const daysDiff = (endDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                        status = daysDiff <= 30 ? 'EXPIRING' : 'INSURED';
                    } else { status = 'INSURED'; }
                } else { status = 'INSURED'; }
            }
            matchInsurance = (status === activeInsuranceFilter);
        }
        // ------------------------------------
        return matchText && matchRem && matchType && matchPhoto && matchInsurance;
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
        inp.rows = 7; // <--- CHANGED FROM 8 TO 7 (less 1 line)
        inp.disabled = true;
    } else if(tKey === 'notes') {
        inp = document.createElement('textarea');
        inp.id = 'modal_' + tKey;
        inp.value = val;
        inp.rows = 3; // <--- ADDED: Sets notes field height to 3 lines
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

    modalModified = false;
    modalEditBtn.style.display = 'inline-block';
    modalSaveBtn.style.display = 'none';
    uploadPhotoBtn.style.display = 'inline-block';
    modalCloseBtn.disabled = false;
    modalCloseBtn.textContent = 'Close'; // <--- ADD THIS LINE
    modalCloseX.disabled = false;
    editModal.style.display = 'flex';
	document.body.style.overflow = 'hidden'; // Locks the background scroll
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
    
    const photoContainer = document.createElement('div');
    photoContainer.className = 'modal-photo-container';

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'photo-actions-container';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'photo-action-btn';
    downloadBtn.innerHTML = `Download Photo`;
    downloadBtn.onclick = async () => {
        const objectUrl = await fetchAuthorizedImage(currentImg.url);
        const a = document.createElement('a');
        a.href = objectUrl || currentImg.url;
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
    imgEl.alt = currentImg.label;
    imgEl.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'%3E%3Ccircle cx='25' cy='25' r='20' fill='none' stroke='%23ccc' stroke-width='4' stroke-dasharray='31.4 31.4'%3E%3CanimateTransform attributeName='transform' type='rotate' from='0 25 25' to='360 25 25' dur='1s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/svg%3E";
    
    fetchAuthorizedImage(currentImg.url).then(objectUrl => {
        if(objectUrl) imgEl.src = objectUrl;
    });

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
        // <--- MODIFIED: Excludes both 'article/item' and 'description' from being enabled
        if (el && tKey !== 'article/item' && tKey !== 'description') {
            el.disabled = false;
        }
    });
    modalModified = true;
    modalEditBtn.style.display = 'none';
    modalSaveBtn.style.display = 'inline-block';
    
    modalCloseBtn.disabled = false;        
    modalCloseBtn.textContent = 'Cancel';  
}

function triggerSaveProcess() {
    finalizeSaveData(loggedInUser); // <--- MODIFIED: Bypasses popup and goes straight to save & refresh
}

function finalizeSaveData(operatorName) {
    if (activeEditIndex === null) return;
    const itemData = inventoryData.find(r => r._rowId === activeEditIndex);
    if (!itemData) return;
    
    const articleKey = headerMapping['article/item'];
    const articleNo = itemData[articleKey] || '';
    const formattedTimestamp = new Date().toLocaleString();

    const params = new URLSearchParams();
    params.append('article', articleNo);
    params.append('updatedby', operatorName);
    params.append('timestamp', formattedTimestamp);
    
    let hasChanges = false;
    popupOrderLowercase.forEach(tKey => {
        if(tKey === 'article/item') return;
        const el = document.getElementById('modal_' + tKey);
        const mappedKey = headerMapping[tKey];
        if (el && mappedKey) {
            const newVal = el.value.trim();
            if (newVal !== (itemData[mappedKey] || '').trim()) {
                params.append(tKey, newVal);
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
        if(dateMappedKey) itemData[dateMappedKey] = formattedTimestamp;

        // Using 'no-cors' mode prevents the browser from throwing a 'Failed to fetch' error
        fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: params.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            mode: 'no-cors' 
        })
        .then(() => {
            // Silently hide the loading screen, close the modal, and refresh
            hideLoading();
            closeModal(); 
        })
        .catch(() => {
            // Even if a background network drop occurs, hide loading, close, and refresh
            hideLoading();
            closeModal();
        });
    } else {
        // If no changes were made, just close the modal
        closeModal(); 
    }
}

function openUploadWindow() {
    if (activeEditIndex === null) return;
    const itemData = inventoryData.find(r => r._rowId === activeEditIndex);
    if (!itemData) return;

    const articleKey = headerMapping['article/item'];
    const itemCode = itemData[articleKey] || 'Unknown';
    const uploadUrl = GOOGLE_APPS_SCRIPT_URL + "?itemCode=" + encodeURIComponent(itemCode);
    
    window.open(uploadUrl, '_blank');
    modalModified = true;
}

function closeModal() {
    if (editModal) editModal.style.display = 'none';
    
    // Unlocks the background scroll
    document.body.style.overflow = ''; 
    
    if (modalModified) {
        loadInventoryFromGoogleSheets(true);
    }
    
    activeEditIndex = null;
    modalModified = false;
}

// --- DASHBOARD CLICK-TO-FILTER FUNCTION ---
function setInsuranceFilter(filterMode, cardId) {
    
    // 🧹 Reset other text and dropdown filters so they don't block the results
    if (searchInput) searchInput.value = '';
    if (remarksFilter) remarksFilter.value = 'ALL';
    if (typeFilter) typeFilter.value = 'ALL';
    if (photoFilter) photoFilter.value = 'ALL';

    // Set insurance filter mode directly
    activeInsuranceFilter = filterMode;

    // Reset styles for all 3 cards
    document.querySelectorAll('.ins-card').forEach(card => {
        card.style.transform = 'scale(1)';
        card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
        card.style.backgroundColor = '#f8f9fa';
    });

    const clearBtn = document.getElementById('clearInsFilterBtn');

    // Highlight the active card
    if (activeInsuranceFilter !== 'ALL') {
        const activeCard = document.getElementById(cardId);
        if (activeCard) {
            activeCard.style.transform = 'scale(1.05)';
            activeCard.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
            activeCard.style.backgroundColor = '#ffffff'; // highlight color
        }
        if (clearBtn) clearBtn.style.display = 'inline';
    } else {
        if (clearBtn) clearBtn.style.display = 'none';
    }

    // Trigger the table update
    executeSearch(true); 
    
    // Smooth scroll down
    const tableSec = document.querySelector('.table-section');
    if (tableSec) tableSec.scrollIntoView({ behavior: 'smooth' });
}

function setupSystemEventHandlers() {
	// Dashboard Filter Click Events
    const cardInsured = document.getElementById('cardInsured');
    const cardNotInsured = document.getElementById('cardNotInsured');
    const cardExpiring = document.getElementById('cardExpiring');
    const clearInsFilterBtn = document.getElementById('clearInsFilterBtn');

    if(cardInsured) cardInsured.onclick = () => setInsuranceFilter('INSURED', 'cardInsured');
    if(cardNotInsured) cardNotInsured.onclick = () => setInsuranceFilter('NOT_INSURED', 'cardNotInsured');
    if(cardExpiring) cardExpiring.onclick = () => setInsuranceFilter('EXPIRING', 'cardExpiring');
    if(clearInsFilterBtn) clearInsFilterBtn.onclick = () => setInsuranceFilter('ALL', '');
if(resetFiltersButton) {
    resetFiltersButton.addEventListener('click', () => {

        // Clear search box
        if (searchInput) {
            searchInput.value = '';
        }

        // Reset all dropdowns to their default option
        if (remarksFilter) {
            remarksFilter.selectedIndex = 0;
        }

        if (typeFilter) {
            typeFilter.selectedIndex = 0;
        }

        if (photoFilter) {
            photoFilter.selectedIndex = 0;
        }

        // Clear insurance filter
        activeInsuranceFilter = 'ALL';

        // Remove insurance card highlighting
        document.querySelectorAll('.ins-card').forEach(card => {
            card.style.transform = 'scale(1)';
            card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            card.style.backgroundColor = '#f8f9fa';
        });

        // Hide insurance clear-filter link
        const clearBtn = document.getElementById('clearInsFilterBtn');
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }

        // Reset pagination
        currentPage = 1;

        // IMPORTANT:
        // Clear the table data instead of showing all records
        currentFilteredData = [];

        // Display 0 records
        if (foundCountDisplay) {
            foundCountDisplay.textContent = '(0 items displayed)';
        }

        // Clear the table and show the default message
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="${displayHeaders.length}" class="no-data">
                        Data loaded successfully. Apply a filter or search to view records.
                    </td>
                </tr>
            `;
        }

        // Reset pagination display
        updatePaginationUI(0);
    });
}
    if(searchInput) searchInput.addEventListener('keypress', e => { if(e.key === 'Enter') executeSearch(true); });
	if(searchButton) searchButton.addEventListener('click', () => executeSearch(true));
    
    if(remarksFilter) remarksFilter.addEventListener('change', () => executeSearch(true));
    if(typeFilter) typeFilter.addEventListener('change', () => executeSearch(true));
    if(photoFilter) photoFilter.addEventListener('change', () => executeSearch(true));
    
    if(exportButton) exportButton.addEventListener('click', () => downloadDatasetCSV(inventoryData, 'Full_Inventory'));
    if(exportFilteredButton) exportFilteredButton.addEventListener('click', () => downloadSearchedHTML(currentFilteredData));
    
    if(uploadPhotoBtn) uploadPhotoBtn.addEventListener('click', openUploadWindow); 
    
    if(modalEditBtn) modalEditBtn.addEventListener('click', enableEditMode);
    if(modalSaveBtn) modalSaveBtn.addEventListener('click', triggerSaveProcess);
    
    if(modalCloseBtn) modalCloseBtn.addEventListener('click', () => {
        if (modalCloseBtn.textContent === 'Cancel') {
            modalModified = false; // Prevents unnecessary data reload
            openPopUp(activeEditIndex); // Re-opens the current item in View Mode
        } else {
            closeModal();
        }
    });
    if(modalCloseX) modalCloseX.addEventListener('click', closeModal); 
    
    const cancelNameBtn = document.getElementById('customCancelNameBtn');
    if (cancelNameBtn) {
        cancelNameBtn.addEventListener('click', () => {
            if (customNameModal) customNameModal.style.display = 'none';
        });
    }
    
    const confirmNameBtn = document.getElementById('customConfirmNameBtn');
    if (confirmNameBtn) {
        confirmNameBtn.addEventListener('click', () => {
            const operatorInput = document.getElementById('custom-operator-input');
            const nameVal = operatorInput ? operatorInput.value.trim() : '';
            if(!nameVal) { alert("Authorization Denied: Operator name required."); return; }
            if (customNameModal) customNameModal.style.display = 'none';
            finalizeSaveData(nameVal);
        });
    }
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

// 🖼️ Helper to Convert Image URL to Base64 Data URL for Offline Inclusion
async function getBase64ImageFromUrl(imageUrl) {
    if (!imageUrl) return '';
    try {
        const match = imageUrl.match(/[-\w]{25,}/);
        let fetchUrl = imageUrl;
        let headers = {};
        // OAuth removed; use the original URL and existing thumbnail fallback.
        
        let response = await fetch(fetchUrl, { headers }).catch(() => null);
        if (!response || !response.ok) {
            const thumbnailFallback = getDirectImageUrl(imageUrl, 'thumbnail') || imageUrl;
            response = await fetch(thumbnailFallback).catch(() => null);
        }
        if (!response || !response.ok) return imageUrl;

        const blob = await response.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(imageUrl);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Base64 image embedding fallback failed:", e);
        return imageUrl;
    }
}

// 🌐 Export Searched HTML with Photos Completely Downloaded & Embedded as Base64
async function downloadSearchedHTML(data) {
    if(!data || data.length === 0) {
        alert("Export Nullified: No dataset active for export.");
        return;
    }

    showLoading("Downloading and embedding photos into standalone report...");

    let tableRowsHTML = '';
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        tableRowsHTML += '<tr>';
        for (let j = 0; j < EXPORT_TABLE_CONFIG.length; j++) {
            const col = EXPORT_TABLE_CONFIG[j];
            const tKey = col.key;
            const resolvedKey = headerMapping[tKey];
            const val = resolvedKey ? (row[resolvedKey] || '') : '';
            
            if (tKey.includes('photo') || tKey.includes('map coordinates') || tKey.includes('tax declaration') || tKey.includes('transfer_cert')) {
                if (val.trim() !== '') {
                    // Fetch and convert image to Base64 so photos are fully embedded and downloaded
                    const base64Img = await getBase64ImageFromUrl(val);
                    tableRowsHTML += `<td style="text-align: center;"><img src="${base64Img}" style="height: 250px; max-width: 250px; width: auto; object-fit: contain; border: 1px solid #94a3b8; border-radius: 4px; display: block; margin: 0 auto;" /></td>`;
                } else {
                    tableRowsHTML += `<td style="text-align: center; color: #64748b; font-style: italic;">No Photo</td>`;
                }
            } else {
                let styleAttr = "";
                if (tKey === "description") {
                    styleAttr = ' style="width: 200px; min-width: 190px;"';
                }
                tableRowsHTML += `<td${styleAttr}>${escapeHtml(val)}</td>`;
            }
        }
        tableRowsHTML += '</tr>';
    }

    hideLoading();

    let headersHTML = '';
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

// =========================================================================
// 🚪 LOGOUT & IDLE TIMEOUT MODULE
// =========================================================================
let idleTimer;
const IDLE_TIME_LIMIT = 30 * 60 * 1000; // 30 minutes in milliseconds

// =========================================================================
// 🔒 SESSION CHECKER FUNCTION
// =========================================================================
function checkSessionStatus() {
    const sessionModal = document.getElementById('sessionExpiredModal');
    
    // 1. Show the blurred modal
    if (sessionModal) {
        sessionModal.style.display = 'flex';
    }

    // 2. Setup the "Log In Again" button behavior
    const reLoginBtn = document.getElementById('reLoginBtn');
    if (reLoginBtn) {
        reLoginBtn.onclick = () => {
            // ✅ NEW: Clear the counter so they start fresh
            sessionStorage.removeItem('accessCounter');
            
            // Hide the blur modal
            sessionModal.style.display = 'none';
            
            // NEW: Ensure the Access Denied modal is completely hidden
            const accessModal = document.getElementById('accessModal');
            if (accessModal) accessModal.style.display = 'none';
            
            // Switch the UI back to the actual login screen
            const loginScreen = document.getElementById('loginScreen');
            const mainApp = document.getElementById('mainApp');
            if (loginScreen) loginScreen.style.display = '';
            if (mainApp) mainApp.style.display = 'none';

            // Optional: Automatically trigger the Google Sign-In popup again
            openGoogleLogin();
        };
    }
}


function performLogout(isAccessDenied = false) {
    // 1. Clear the access token to revoke privileges
    accessToken = null; 
    
    // 2. Stop the timer
    clearTimeout(idleTimer);
    
    // 3. Force hide all floating elements immediately
    const floatingLogoutBtn = document.getElementById('floatingLogoutBtn');
    if (floatingLogoutBtn) floatingLogoutBtn.style.display = 'none';

    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) paginationContainer.style.display = 'none';

    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.style.visibility = 'hidden';
        backToTopBtn.style.opacity = '0';
    }

    // 4. NEW: Only trigger the blurred Logged Out window if it is NOT an access denial
    if (!isAccessDenied) {
        checkSessionStatus();
    }
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    // Only run the idle countdown if the user is currently logged in
    if (loggedInUser !== "System User") {
        idleTimer = setTimeout(performLogout, IDLE_TIME_LIMIT);
    }
}

// Initialize everything once the page loads
window.addEventListener('DOMContentLoaded', () => {
    // --- Create the Floating Logout Button ---
    const logoutBtn = document.createElement('button');
    logoutBtn.innerHTML = 'Log Out';
    logoutBtn.id = 'floatingLogoutBtn';
    
    // Style the button so it floats in the upper right
    Object.assign(logoutBtn.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '5px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
        zIndex: '999999',
        display: 'none', // Hidden by default on the login screen
        transition: 'background-color 0.2s'
    });

    // Add a slight hover effect for better UI
    logoutBtn.onmouseover = () => logoutBtn.style.backgroundColor = '#c82333';
    logoutBtn.onmouseout = () => logoutBtn.style.backgroundColor = '#dc3545';
    
    logoutBtn.addEventListener('click', () => {
    // 1. Securely revoke the Google Access Token
    accessToken = null;
    loggedInUser = "System User";
    sessionStorage.removeItem('accessCounter');
    clearTimeout(idleTimer);
    
    // 3. Hide floating UI components
    document.getElementById('floatingLogoutBtn').style.display = 'none';
    if (document.getElementById('paginationContainer')) {
        document.getElementById('paginationContainer').style.display = 'none';
    }
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.style.visibility = 'hidden';
        backToTopBtn.style.opacity = '0';
    }
    
    // 4. Instantly switch the view back to the Login Screen
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if (loginScreen) loginScreen.style.display = '';
    if (mainApp) mainApp.style.display = 'none';
});
    document.body.appendChild(logoutBtn);

    // --- Setup the Idle Activity Trackers ---
    // Any of these actions will reset the 30-minute timer
    const userActivityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    userActivityEvents.forEach(event => {
        document.addEventListener(event, resetIdleTimer);
    });

// --- Monitor Login State ---
    // Checks every 1 second if the user logged in to display the button, 
    // ensuring we don't have to alter your existing login functions.
    setInterval(() => {
        const btn = document.getElementById('floatingLogoutBtn');
        const mainApp = document.getElementById('mainApp');
        
        if (btn) {
            // Only display if we have an access token AND the main app screen is visible
            const isMainAppVisible = mainApp && mainApp.style.display !== 'none';
            btn.style.display = (loggedInUser !== "System User" && isMainAppVisible) ? 'block' : 'none';
        }
    }, 1000);
});
// =========================================================================
