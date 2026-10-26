// 🔑 Google Sheets Cloud Gateway Architecture
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxSCW2ZeIFBJaQ3qts8oNeWVxHDGMt4FOqQgTk4bswbbhfzi_e5prVc0-QWDKo2j7tIJg/exec";
// 🔐 Must match API_SECRET in code.gs exactly. Generate your own long random
// string (e.g. from https://www.uuidgenerator.net/) and put the same value
// in both places.
const API_SECRET = "VI6kXmmpx4NS1LlUUiOjKcgkpra7ImBzIDUahtjBDFo";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
// 🔧 UPDATED: Google Sign-In is now used purely for identity (no Drive scope requested),
// so the inventory sheet is read from its PUBLIC CSV export link instead of the
// OAuth-gated Drive API export. Share this spreadsheet as "Anyone with the link - Viewer".
const SPREADSHEET_GID = "0"; // Change this if your inventory data isn't on the first tab
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${SPREADSHEET_GID}`;

// 🔐 NEW: "Authorized Accounts" Google Sheet used to gate login access.
// This sheet must be shared as "Anyone with the link - Viewer" (or Published to the web)
// so it can be read as CSV without requiring the visitor's OAuth Drive permissions.
// Tab name: "Authorized Accounts" (gid=0) | Required column header: "Gmail Account"
const AUTHORIZED_ACCOUNTS_SHEET_ID = "1uWrtQB2wc65lHe-w1RkxvUuZTbRpjnqLMVkYbxas2I8";
const AUTHORIZED_ACCOUNTS_GID = "0";
const AUTHORIZED_ACCOUNTS_CSV_URL = `https://docs.google.com/spreadsheets/d/${AUTHORIZED_ACCOUNTS_SHEET_ID}/export?format=csv&gid=${AUTHORIZED_ACCOUNTS_GID}`;

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
    { display: "Transfer Certificate (TCT) P1", key: "transfer_cert1" },
    { display: "Transfer Certificate (TCT) P2", key: "transfer_cert2" },
];
// =========================================================================

const displayHeaders = ["Article no./ TCT no.", "Description", "Notes", "Unit Value", "Remarks", "Type", "Photo 1", "Photo 2", "Map Coordinates", "Tax Declaration", "Transfer Certificate (TCT) P1", "Transfer Certificate (TCT) P2", "UPDATED BY", "LAST UPDATE"];
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
let tokenClient;
let accessToken = null;
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
let activeUnidFilter = 'ALL'; // 'ALL' | 'UNID_BUILDING' | 'UNID_LAND' | 'ID_BUILDING' | 'ID_LAND'
let countUnidBuilding, countUnidLand;

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
    countUnidBuilding = document.getElementById('countUnidBuilding');
    countUnidLand = document.getElementById('countUnidLand');
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
        <div class="ux-loader-card" role="status" aria-live="polite">
            <span class="ux-spinner"></span>
            <span id="loadingOverlayText">Connecting...</span>
        </div>
    `;
        Object.assign(loadingOverlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(11, 31, 58, 0.45)', backdropFilter: 'blur(4px)', webkitBackdropFilter: 'blur(4px)', display: 'none', justifyContent: 'center',
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
        if (accessToken && (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300)) {
            backToTopBtn.style.visibility = "visible";
            backToTopBtn.style.opacity = "1";
        } else {
            backToTopBtn.style.visibility = "hidden";
            backToTopBtn.style.opacity = "0";
        }
    }
});

// 🔄 LOGIN SCREEN STATE (idle / waiting for Google popup / verifying / error)
let loginWaitTimer = null;
function setLoginState(state, msg) {
    const btn = document.getElementById('customLoginBtn');
    const box = document.querySelector('.login-box');
    const err = document.getElementById('loginError');
    clearTimeout(loginWaitTimer);
    if (!btn || !box || !err) return;

    btn.dataset.defaultHtml = btn.dataset.defaultHtml || btn.innerHTML;
    const busy = (state === 'waiting' || state === 'verifying');
    box.classList.toggle('is-waiting', busy);
    btn.disabled = busy;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');

    if (state === 'waiting') {
        btn.innerHTML = '<span class="login-spinner"></span>Waiting for Google sign-in\u2026';
        err.className = 'error-msg info';
        err.textContent = 'Complete the sign-in in the Google window that just opened.';
        // If nothing happens for a while (popup hidden behind the page), let the user try again
        loginWaitTimer = setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<span class="login-spinner"></span>Reopen Google sign-in';
            err.textContent = "Don't see the Google window? Click the button to reopen it.";
        }, 10000);
    } else if (state === 'verifying') {
        btn.innerHTML = '<span class="login-spinner"></span>Verifying account access\u2026';
        err.className = 'error-msg info';
        err.textContent = '';
    } else {
        btn.innerHTML = btn.dataset.defaultHtml;
        err.className = 'error-msg';
        err.textContent = (state === 'error' && msg) ? msg : '';
    }
}

function requestGoogleLogin(client) {
    setLoginState('waiting');
    try { client.requestAccessToken(); }
    catch (e) { setLoginState('error', 'Could not open Google sign-in. Please try again.'); }
}

// 🔐 SECURE INITIALIZER & GOOGLE IDENTITY TOKEN INTEGRATION (ROBUST 1-CLICK FIX)
function getOrCreateTokenClient() {
    if (!tokenClient && window.google && google.accounts && google.accounts.oauth2) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '84591548482-rfv15nf99g7nsdtlr3i57ms0fuln28s3.apps.googleusercontent.com',
            // 🔧 UPDATED: Removed 'drive.readonly' - Google Sign-In is now identity-only
            // (this is what was triggering the "Google hasn't verified this app" warning).
            scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    accessToken = tokenResponse.access_token;
                    const loginErr = document.getElementById('loginError');
                    setLoginState('verifying');

                    // 🔑 NEW LOGIN FLOW:
                    // 1. Get the signed-in Gmail account
                    // 2. Check it against the "Authorized Accounts" Google Sheet
                    // 3. Authorized -> Main Page | Not Authorized -> Request Access | Sheet unreachable -> back to Login
                    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    })
                    .then(res => res.json())
                    .then(profile => {
                        if (!profile || !profile.email) {
                            throw new Error('Could not retrieve your Google account email.');
                        }

                        loggedInUser = profile.email; // <--- Saves email globally
                        const operatorInput = document.getElementById('custom-operator-input');
                        if (operatorInput) {
                            operatorInput.value = profile.email;
                            operatorInput.disabled = true;
                        }

                        // 🔎 NEW: Check the "Authorized Accounts" sheet for this Gmail account
                        return checkAuthorizedAccount(profile.email);
                    })
                    .then(isAuthorized => {
                        setLoginState('idle');

                        if (isAuthorized) {
                            // ✅ Authorized -> Main Page
                            const loginScreen = document.getElementById('loginScreen');
                            const mainApp = document.getElementById('mainApp');
                            if (loginScreen) loginScreen.style.display = 'none';
                            if (mainApp) mainApp.style.display = 'block';

                            setupSystemEventHandlers();
                            loadInventoryFromGoogleSheets();
                        } else {
                            // 🚫 Not Authorized -> Request Access
                            showAccessDeniedModal(loggedInUser);
                        }
                    })
                    .catch(err => {
                        // ⚠️ Cannot reach/read the Authorized Accounts sheet, or lost session -> Log In Again
                        console.error('Authorization check failed:', err);
                        accessToken = null;
                        setLoginState('error', 'Could not verify account access (Authorized Accounts sheet unreachable). Please log in again.');
                    });
                } else {
                    setLoginState('error', 'Google Sign-In authorization failed.');
                }
            },
            // Popup closed by the user, or blocked by the browser
            error_callback: (err) => {
                const type = err && err.type;
                if (type === 'popup_closed') {
                    setLoginState('idle');
                } else if (type === 'popup_failed_to_open') {
                    setLoginState('error', 'Your browser blocked the Google sign-in window. Please allow pop-ups for this site and try again.');
                } else {
                    setLoginState('error', 'Google Sign-In was interrupted. Please try again.');
                }
            }
        });
    }
    return tokenClient;
}

// =========================================================================
// 🔎 NEW: AUTHORIZED ACCOUNTS SHEET CHECK
// Reads the public "Authorized Accounts" Google Sheet as CSV and checks
// whether the given Gmail account exists in the "Gmail Account" column.
// Resolves true/false when the sheet is reachable and parsed successfully.
// Rejects (throws) when the sheet cannot be reached/read at all, which the
// caller treats as "cannot access Google Sheet" -> back to the login screen.
// =========================================================================
function checkAuthorizedAccount(email) {
    return fetch(AUTHORIZED_ACCOUNTS_CSV_URL, { cache: 'no-store' })
        .then(res => {
            if (!res.ok) {
                throw new Error('Unable to reach the Authorized Accounts sheet (HTTP ' + res.status + ').');
            }
            return res.text();
        })
        .then(csvText => {
            return new Promise((resolve, reject) => {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: function(results) {
                        if (!results || !results.data) {
                            reject(new Error('Authorized Accounts sheet returned no data.'));
                            return;
                        }

                        // Find the "Gmail Account" column regardless of exact header casing/whitespace
                        const headerKeys = (results.meta && results.meta.fields) 
                            ? results.meta.fields 
                            : (results.data[0] ? Object.keys(results.data[0]) : []);

                        const gmailKey = headerKeys.find(h => h && h.toLowerCase().trim() === 'gmail account')
                            || headerKeys.find(h => h && h.toLowerCase().includes('gmail'));

                        if (!gmailKey) {
                            reject(new Error('Could not find the "Gmail Account" column in the Authorized Accounts sheet.'));
                            return;
                        }

                        const normalizedEmail = String(email || '').trim().toLowerCase();
                        const isAuthorized = results.data.some(row =>
                            String(row[gmailKey] || '').trim().toLowerCase() === normalizedEmail
                        );
                        resolve(isAuthorized);
                    },
                    error: function(err) {
                        reject(err);
                    }
                });
            });
        });
}

// =========================================================================
// 🚫 NEW: ACCESS DENIED MODAL (Request Access) for accounts not found
// in the Authorized Accounts sheet. Reuses the existing #accessModal markup.
// =========================================================================
function showAccessDeniedModal(email) {
    const modal = document.getElementById("accessModal");
    const modalText = document.getElementById("accessModalText");
    const submitBtn = document.getElementById("submitRequestBtn");
    const closeBtn = document.getElementById("closeModalBtn");
    const noteInput = document.getElementById("requestNotesInput");

    if (!modal || !modalText || !submitBtn || !closeBtn) return;

    if (noteInput) {
        noteInput.style.display = "block";
        noteInput.value = "";
    }

    submitBtn.style.display = "inline-block";
    closeBtn.textContent = "Cancel";
    closeBtn.style.background = "#6c757d";
    closeBtn.style.color = "white";

    modalText.innerHTML = "Your Gmail account (<b>" + escapeHtml(email) + "</b>) does not have access to view the Webapp.<br><br>Would you like to send an access request?";
    modal.style.display = "flex";

    submitBtn.onclick = function() {
        let noteValue = "No note provided";
        if (noteInput) {
            noteValue = noteInput.value.trim() || "No note provided";
            noteInput.value = "";
        }

        modalText.innerHTML = `
            <div style="text-align: center;">
                <h3 style="margin-top:0; margin-bottom: 12px; color: #155724; font-size: 22px;">✅ Request Access Sent</h3>
                <p style="margin:0; line-height: 1.6; font-size: 15px; color: #333;">
                    Your request has been successfully sent. Please wait for admin approval or contact <b>639282199308</b> for follow-up.
                </p>
            </div>
        `;

        if (noteInput) noteInput.style.display = "none";
        submitBtn.style.display = "none";
        closeBtn.textContent = "OK";
        closeBtn.style.background = "#28a745";
        closeBtn.style.color = "white";

        const requestUrl = GOOGLE_APPS_SCRIPT_URL + "?action=requestAccess&email=" + encodeURIComponent(email) + "&name=" + encodeURIComponent(email) + "&notes=" + encodeURIComponent(noteValue);
        fetch(requestUrl, { method: 'GET', mode: 'no-cors' }).catch(err => console.error("Access request silent failure:", err));
    };

    closeBtn.onclick = function() {
        modal.style.display = "none";

        // Route back to the login screen when the access-denied modal is closed
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        if (loginScreen) loginScreen.style.display = '';
        if (mainApp) mainApp.style.display = 'none';

        // Reset modal back to original prompt state when closed
        setTimeout(() => {
            modalText.innerHTML = "<h3 style='margin-top:0; margin-bottom: 10px; color: #155724;'>✅ Request Access Sent</h3><p style='margin:0; line-height: 1.5;'>Your request has been successfully sent. Please wait for admin approval or contact <b>639282199308</b> for follow-up.</p>";
            submitBtn.style.display = "inline-block";
            closeBtn.textContent = "Cancel";
            closeBtn.style.background = "#6c757d";

            if (noteInput) {
                noteInput.value = "";
                noteInput.style.display = "block";
            }
        }, 300);
    };

    // Quietly clear the failed session (no Session Expired modal for access-denied cases)
    performLogout(true);
}

// 🖱️ DASHBOARD CARD CLICK HANDLERS
// 🖱️ DASHBOARD CARD CLICK HANDLERS
function setupDashboardClickHandlers() {
    
    // 🧹 NEW: Helper function to clear search and dropdowns
    function resetAllFilters() {
        if (searchInput) searchInput.value = '';
        if (remarksFilter) remarksFilter.value = 'ALL';
        if (typeFilter) typeFilter.value = 'ALL';
        if (photoFilter) photoFilter.value = 'ALL';
        activeUnidFilter = 'ALL';
        
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
        { id: 'countBuilding', keyword: 'BUILDING', unid: 'ID_BUILDING' },
        { id: 'countUnidBuilding', keyword: null, unid: 'UNID_BUILDING' },
        { id: 'countAssetMod', keyword: 'BUILDING MODIFICATION' }, // Changed from 'ASSET'
        { id: 'countFlood', keyword: 'FLOOD' },
        { id: 'countHospital', keyword: 'HOSPITAL' },
        { id: 'countLand', keyword: 'LAND', unid: 'ID_LAND' },
        { id: 'countUnidLand', keyword: null, unid: 'UNID_LAND' },
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
                    if (item.unid && item.unid.startsWith('ID_')) activeUnidFilter = item.unid;
                    if (item.unid === 'UNID_BUILDING' && typeFilter) typeFilter.value = '__UNID_BUILDING__';
                    if (item.unid === 'UNID_LAND' && typeFilter) typeFilter.value = '__UNID_LAND__';
                    if (item.keyword && typeFilter) {
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

    // Try initializing immediately if the script is already loaded
    getOrCreateTokenClient();

    const loginBtn = document.getElementById('customLoginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            let client = getOrCreateTokenClient();
            if (client) {
                const loginErr = document.getElementById('loginError');
                if (loginErr) loginErr.textContent = '';
                requestGoogleLogin(client);
            } else {
                // Fallback: If Google GSI script is still loading, retry after 500ms automatically
                const loginErr = document.getElementById('loginError');
                if (loginErr) loginErr.textContent = 'Connecting to Google Sign-In, please wait...';
                
                setTimeout(() => {
                    client = getOrCreateTokenClient();
                    if (client) {
                        if (loginErr) loginErr.textContent = '';
                        requestGoogleLogin(client);
                    } else {
                        if (loginErr) loginErr.textContent = 'Google Sign-In failed to load. Please check your network connection or refresh.';
                    }
                }, 600);
            }
        });
    }

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

// 🌐 Image URL Resolver (Public Link - no Drive scope required)
async function fetchAuthorizedImage(driveUrl) {
    if (!driveUrl || typeof driveUrl !== 'string') return null;
    const match = driveUrl.match(/[-\w]{25,}/);
    if (!match) return driveUrl; 

    const fileId = match[0];
    if (imageCache[fileId]) return imageCache[fileId];

    // 🔧 UPDATED: Login no longer requests Drive access. Uploaded photos are already
    // shared "Anyone with the link - Viewer" (see processUpload in the Apps Script),
    // so we just resolve the public full-resolution link directly - no token needed.
    const publicUrl = getDirectImageUrl(driveUrl, 'view');
    imageCache[fileId] = publicUrl;
    return publicUrl;
}

async function loadInventoryFromGoogleSheets(retainPage = false) {
    if (statusBanner) {
        statusBanner.style.backgroundColor = "#fff3cd";
        statusBanner.style.color = "#856404";
        statusBanner.textContent = "Connecting to Google Sheets Live Datastream...";
    }
    showLoading("Syncing live spreadsheet grid...");

    try {
        // 🔧 UPDATED: No OAuth header needed - the inventory sheet is read via its
        // public CSV export link (no Drive scope is requested during login anymore).
        const response = await fetch(GOOGLE_SHEET_CSV_URL, { cache: 'no-store' });
        
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
        if (statusBanner) {
            statusBanner.style.backgroundColor = "#f8d7da";
            statusBanner.style.color = "#721c24";
            statusBanner.textContent = "Connection Error: Check Sheet spreadsheet access permission configuration.";
        }
        console.error(err);

        // ✅ NEW: Check if the counter exists
        const hasCounter = sessionStorage.getItem('accessCounter');

        if (accessToken && loggedInUser !== "System User") {
            if (!hasCounter) {
                // 🚫 SCENARIO A: Not Authorized & No Counter -> Goto Request Access
                const modal = document.getElementById("accessModal");
                const modalText = document.getElementById("accessModalText");
    const submitBtn = document.getElementById("submitRequestBtn");
    const closeBtn = document.getElementById("closeModalBtn");
    
    // Grab your existing textarea by its exact ID
    const noteInput = document.getElementById("requestNotesInput");

    // Ensure the textarea is visible and empty when the modal first opens
    if (noteInput) {
        noteInput.style.display = "block";
        noteInput.value = "";
    }

    // Keep your dynamic text structure
    modalText.innerHTML = "Your Gmail account (<b>" + loggedInUser + "</b>) does not have access to view the Webapp.<br><br>Would you like to send an access request?";
    modal.style.display = "flex";

   submitBtn.onclick = function() {
        // 1. Capture the note value
        let noteValue = "No note provided";
        if (noteInput) {
            noteValue = noteInput.value.trim() || "No note provided";
            noteInput.value = ""; // Reset input in the background for next time
        }

        // 2. Target the entire modal content area or update both title and text together
        const modalHeader = document.querySelector('.access-modal-header') || modalText.parentElement;
        
        // Update the content to show the clean success state with your phone number text
        modalText.innerHTML = `
            <div style="text-align: center;">
                <h3 style="margin-top:0; margin-bottom: 12px; color: #155724; font-size: 22px;">✅ Request Access Sent</h3>
                <p style="margin:0; line-height: 1.6; font-size: 15px; color: #333;">
                    Your request has been successfully sent. Please wait for admin approval or contact <b>639282199308</b> for follow-up.
                </p>
            </div>
        `;
        
        // 3. Hide the text area input
        if (noteInput) {
            noteInput.style.display = "none";
        }

        // 4. Update buttons: Hide 'Submit', change 'Cancel' to a green 'OK' button
        submitBtn.style.display = "none";
        closeBtn.textContent = "OK";
        closeBtn.style.background = "#28a745"; 
        closeBtn.style.color = "white";

        // 5. Prepare the URL for Apps Script
        const requestUrl = GOOGLE_APPS_SCRIPT_URL + "?action=requestAccess&email=" + encodeURIComponent(loggedInUser) + "&name=" + encodeURIComponent(loggedInUser) + "&notes=" + encodeURIComponent(noteValue);

      // 6. Trigger the request silently using fetch (bypasses iframe blocks)
        fetch(requestUrl, { method: 'GET', mode: 'no-cors' }).catch(err => console.error("Access request silent failure:", err));
    };

closeBtn.onclick = function() {
        modal.style.display = "none";
        
        // NEW: Route the user back to the login screen when they close the access denied modal
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        if (loginScreen) loginScreen.style.display = '';
        if (mainApp) mainApp.style.display = 'none';
        
        // Reset modal back to original prompt state when closed
        setTimeout(() => {
            modalText.innerHTML = "<h3 style='margin-top:0; margin-bottom: 10px; color: #155724;'>✅ Request Access Sent</h3><p style='margin:0; line-height: 1.5;'>Your request has been successfully sent. Please wait for admin approval or contact <b>639282199308</b> for follow-up.</p>";
            submitBtn.style.display = "inline-block";
            closeBtn.textContent = "Cancel";
            closeBtn.style.background = "#6c757d";
            
            if (noteInput) {
                noteInput.value = "";
                noteInput.style.display = "block";
            }
        }, 300);
    };

    // NEW: Pass 'true' to performLogout so it doesn't trigger the Session Expired modal
                performLogout(true); 
            
            } else {
                // ⚠️ SCENARIO B: Have Counter (Session Expired) -> Goto Log In Again
                performLogout(false);
            }

        } else {
            toastAlert("Connection failed or you have been logged out from Google. Please log in again.");
    // Normal logout for actual session disconnections
    performLogout(false); 
        }
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
    refreshInsuranceCards(); // 🔄 auto-refresh insurance cards on every launch/data load
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

    // Add "Unidentified Buildings" / "Unidentified Lands" to the Type dropdown (placed right after Building / Land)
    if (type === 'type') {
        const addUnid = (afterName, value, label) => {
            const opt = document.createElement('option');
            opt.value = value; opt.textContent = label;
            const anchor = Array.from(selectEl.options).find(o => o.value.toUpperCase().trim() === afterName);
            if (anchor && anchor.nextSibling) selectEl.insertBefore(opt, anchor.nextSibling);
            else selectEl.appendChild(opt);
        };
        addUnid('BUILDING', '__UNID_BUILDING__', 'UNIDENTIFIED BUILDINGS');
        addUnid('LAND', '__UNID_LAND__', 'UNIDENTIFIED LANDS');
    }

    // NEW: Add an "Insured" option to the Remarks dropdown (based on Notes-derived insurance status)
    if (type === 'remarks') {
        const insuredOpt = document.createElement('option');
        insuredOpt.value = '__INSURED__';
        insuredOpt.textContent = 'BUILDING INSURANCE';
        selectEl.appendChild(insuredOpt);
    }

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


// =========================================================================
// 🛡️ INSURANCE STATUS HELPER (single source of truth)
// Scans a row's Notes, finds the coverage END date, compares it with TODAY's
// date and returns one of:
//   'NOT_INSURED' | 'INSURED' (active) | 'EXPIRING' (<= 30 days left)
//   | 'EXPIRED' (end date already passed) | 'NONE'
// "Expiring Soon" on the dashboard = EXPIRING + EXPIRED.
// =========================================================================
const INSURANCE_EXPIRING_DAYS = 30;
const MONTH_LOOKUP = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

function extractDatesFromText(text) {
    const dates = [];
    let m;

    // "March 5, 2026", "Mar. 5 2026", "March 5th, 2026"
    const reMDY = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi;
    while ((m = reMDY.exec(text)) !== null) {
        dates.push(new Date(+m[3], MONTH_LOOKUP[m[1].toLowerCase()], +m[2]));
    }

    // "5 March 2026"
    const reDMY = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s+(\d{4})\b/gi;
    while ((m = reDMY.exec(text)) !== null) {
        dates.push(new Date(+m[3], MONTH_LOOKUP[m[2].toLowerCase()], +m[1]));
    }

    // "2026-03-05"
    const reISO = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
    while ((m = reISO.exec(text)) !== null) {
        dates.push(new Date(+m[1], +m[2] - 1, +m[3]));
    }

    // "03/05/2026" (MM/DD/YYYY; swapped automatically if the first number is > 12)
    const reNum = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g;
    while ((m = reNum.exec(text)) !== null) {
        let a = +m[1], b = +m[2];
        if (a > 12) { const t = a; a = b; b = t; }
        dates.push(new Date(+m[3], a - 1, b));
    }

    return dates.filter(d => !isNaN(d.getTime()));
}

function getInsuranceStatus(notesVal) {
    const notes = String(notesVal || '');
    const upper = notes.toUpperCase();

    if (upper.includes('NOT INSURED')) return 'NOT_INSURED';
    if (!upper.includes('BUILDING INSURED')) return 'NONE';

    // Only look at the text from "Coverage" onward (falls back to the whole note)
    const covIdx = notes.search(/coverage/i);
    const scope = covIdx >= 0 ? notes.slice(covIdx) : notes;

    const dates = extractDatesFromText(scope);
    if (dates.length === 0) return 'INSURED'; // No readable date -> keep as insured

    // Coverage end date = the latest date found (handles "start - end" and renewals)
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Compare whole days: today at 00:00 vs. the end date at 00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((endDate.getTime() - today.getTime()) / 86400000);

    if (daysLeft < 0) return 'EXPIRED';
    if (daysLeft <= INSURANCE_EXPIRING_DAYS) return 'EXPIRING';
    return 'INSURED';
}

// =========================================================================
// 🔄 AUTO-REFRESH: INSURED (ACTIVE) / NOT INSURED / EXPIRING-EXPIRED cards
// Recomputes the three insurance cards from the loaded data using TODAY's
// date. Runs every time the app launches (after login + data load), whenever
// the tab/app becomes visible again, and automatically at midnight so the
// counts never go stale.
// =========================================================================
function refreshInsuranceCards() {
    if (!Array.isArray(inventoryData) || inventoryData.length === 0) return;

    const nKey = headerMapping['notes'];
    let insured = 0, notInsured = 0, expiring = 0;

    inventoryData.forEach(row => {
        const status = getInsuranceStatus(row[nKey]);
        if (status === 'NOT_INSURED') notInsured++;
        else if (status === 'EXPIRING' || status === 'EXPIRED') expiring++;
        else if (status === 'INSURED') insured++;
    });

    const elInsured = document.getElementById('countInsured');
    const elNotInsured = document.getElementById('countNotInsured');
    const elExpiring = document.getElementById('countExpiring');
    if (elInsured) elInsured.textContent = insured;
    if (elNotInsured) elNotInsured.textContent = notInsured;
    if (elExpiring) elExpiring.textContent = expiring;

    const cardExpiringEl = document.getElementById('cardExpiring');
    if (cardExpiringEl) cardExpiringEl.classList.toggle('has-alerts', expiring > 0);

    // If an insurance filter is active, re-apply it so the table matches the new counts
    if (typeof activeInsuranceFilter !== 'undefined' && activeInsuranceFilter !== 'ALL' && isAppInitialized) {
        executeSearch(false);
    }
}

// Refresh when the user comes back to the tab / app window
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && accessToken) refreshInsuranceCards();
});
window.addEventListener('focus', () => {
    if (accessToken) refreshInsuranceCards();
});

// Refresh automatically right after midnight (date rollover can expire policies)
let insuranceDayStamp = new Date().toDateString();
setInterval(() => {
    const todayStamp = new Date().toDateString();
    if (todayStamp !== insuranceDayStamp) {
        insuranceDayStamp = todayStamp;
        if (accessToken) refreshInsuranceCards();
    }
}, 60 * 1000);

// Has a Tax Declaration or any Transfer Certificate (TCT P1 / P2)?
function hasOwnershipDocs(row) {
    return ['tax declaration', 'transfer_cert1', 'transfer_cert2'].some(k => {
        const hk = headerMapping[k];
        return hk && row[hk] && String(row[hk]).trim() !== '';
    });
}

// Returns 'BUILDING' / 'LAND' when the row is a plain Building or Land type with NO Tax Declaration and NO TCT, else null.
// (Building Modifications, School, Hospital, Other Land, etc. are not affected.)
function getUnidKind(row) {
    const t = String(row[headerMapping['type']] || '').toUpperCase().trim();
    if (hasOwnershipDocs(row)) return null;
    if (t.includes('BUILDING MOD') || t.includes('ASSET MOD') || t.includes('SCHOOL') || t.includes('HOSPITAL') ||
        t.includes('MARKET') || t.includes('OTHER') || t.includes('PARK') || t.includes('PLAZA') || t.includes('MONUMENT')) return null;
    if (t.includes('LAND') || t === 'LOT') return 'LAND';
    if (t.includes('FLOOD') || t.includes('WATER') || t.includes('ROAD') || t.includes('SLAUGHTERHOUSE')) return null;
    if (t.includes('BUILDING')) return 'BUILDING';
    return null;
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
        'Building': 0, 'Unidentified Buildings': 0, 'Unidentified Lands': 0, 'Building Modifications': 0, 'Flood Control': 0, 
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
        // Every row is scanned and its coverage end date is compared with today's date.
        // Expired AND about-to-expire policies are both counted under "Expiring Soon".
        const insStatus = getInsuranceStatus(row[nKey]);
        if (insStatus === 'NOT_INSURED') {
            notInsuredCount++;
        } else if (insStatus === 'EXPIRING' || insStatus === 'EXPIRED') {
            expiringCount++;
        } else if (insStatus === 'INSURED') {
            insuredCount++;
        }
// --------------------------------



        
        const unidKind = getUnidKind(row);
        if (unidKind === 'BUILDING') { stats['Unidentified Buildings']++; return; }
        if (unidKind === 'LAND') { stats['Unidentified Lands']++; return; }

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
    if(countUnidBuilding) countUnidBuilding.textContent = stats['Unidentified Buildings'];
    if(countUnidLand) countUnidLand.textContent = stats['Unidentified Lands'];
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

    // ⚠️ Animate the Expiring / Expired card only while there is something to warn about
    const cardExpiringEl = document.getElementById('cardExpiring');
    if (cardExpiringEl) cardExpiringEl.classList.toggle('has-alerts', expiringCount > 0);
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
            if (remF === '__INSURED__') {
                // "BUILDING INSURANCE" option in Remarks dropdown - finds ALL buildings with an insurance record
                // (Active + Expiring + Expired). Only "NOT INSURED" and rows with no insurance note are excluded.
                const insStatus = getInsuranceStatus(row[nKey]);
                matchRem = (insStatus === 'INSURED' || insStatus === 'EXPIRING' || insStatus === 'EXPIRED');
            } else {
                matchRem = (String(row[rKey] || '') === remF);
            }
        }
        
        if (typF === '__UNID_BUILDING__') {
            matchType = (getUnidKind(row) === 'BUILDING');
        } else if (typF === '__UNID_LAND__') {
            matchType = (getUnidKind(row) === 'LAND');
        } else if (typF !== 'ALL') {
            // Plain Building / Land selections exclude the unidentified ones (they have their own options)
            matchType = (String(row[tKey] || '') === typF) && getUnidKind(row) === null;
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
            const status = getInsuranceStatus(row[nKey]);
            // "Expiring Soon" card also includes policies that are already expired
            matchInsurance = (activeInsuranceFilter === 'EXPIRING')
                ? (status === 'EXPIRING' || status === 'EXPIRED')
                : (status === activeInsuranceFilter);
        }
        // ------------------------------------
        let matchUnid = true;
        if (activeUnidFilter !== 'ALL') {
            const kind = getUnidKind(row);
            const t = String(row[tKey] || '').toUpperCase();
            if (activeUnidFilter === 'UNID_BUILDING') matchUnid = (kind === 'BUILDING');
            else if (activeUnidFilter === 'UNID_LAND') matchUnid = (kind === 'LAND');
            else if (activeUnidFilter === 'ID_BUILDING') matchUnid = (kind === null && t.includes('BUILDING') && !t.includes('MOD') && !t.includes('SCHOOL') && !t.includes('OTHER') && !t.includes('ASSET'));
            else if (activeUnidFilter === 'ID_LAND') matchUnid = (kind === null && (t.includes('LAND') || t === 'LOT') && !t.includes('OTHER'));
        }
        return matchText && matchRem && matchType && matchPhoto && matchInsurance && matchUnid;
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
        { key: 'transfer_cert1', label: 'Transfer Certificate (TCT) P1' },
        { key: 'transfer_cert2', label: 'Transfer Certificate (TCT) P2' }
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
        // Open the new tab right away (inside the click) so the browser doesn't block it
        const photoTab = window.open('', '_blank');
        const objectUrl = await fetchAuthorizedImage(currentImg.url);
        const finalUrl = objectUrl || currentImg.url;

        if (photoTab) {
            // Show the photo scaled to fit the whole tab (no scrolling, no cropping)
            photoTab.document.write(
                '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
                '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
                '<title>' + escapeHtml(currentImg.label) + '</title>' +
                '<style>' +
                'html, body { margin: 0; width: 100%; height: 100%; background: #0b1424; overflow: hidden; }' +
                'body { display: flex; align-items: center; justify-content: center; }' +
                'img { max-width: 100vw; max-height: 100vh; width: auto; height: auto; object-fit: contain; display: block; }' +
                '</style></head><body>' +
                '<img src="' + escapeHtml(finalUrl) + '" alt="' + escapeHtml(currentImg.label) + '">' +
                '</body></html>'
            );
            photoTab.document.close();
        } else {
            // Fallback if the browser blocked the tab: original behavior
            const a = document.createElement('a');
            a.href = finalUrl;
            a.download = `property_photo_${currentPhotoIndex + 1}.jpg`;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
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
    params.append('secret', API_SECRET);
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
            showToast('Changes submitted — refreshing the latest data.', 'success');
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

// =========================================================================
// 📸 IN-APP UPLOAD PHOTOS WINDOW (replaces the old UploadForm.html popup)
// =========================================================================
const UP_SLOTS = {
    1: { key: 'photo 1',         label: 'Structure Photo 1' },
    2: { key: 'photo 2',         label: 'Structure Photo 2' },
    3: { key: 'map coordinates', label: 'Map Coordinates' },
    4: { key: 'tax declaration', label: 'Tax Declaration' }
};
let upFiles = { 1: null, 2: null, 3: null, 4: null };
let upExistingUrls = { 1: '', 2: '', 3: '', 4: '' };
let upItemCode = '';
let upBusy = false;
let upWired = false;

function upEl(id) { return document.getElementById(id); }
function upFmtSize(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

function upCheckReady() {
    const n = Object.values(upFiles).filter(f => f !== null).length;
    const hasName = upEl('upUploader').value.trim() !== '';
    const btn = upEl('upSubmitBtn');
    const wasDisabled = btn.disabled;
    btn.disabled = upBusy || !(n > 0 && hasName);
    upEl('upCount').textContent = n === 0 ? 'No photos selected' : n + (n === 1 ? ' photo' : ' photos') + ' ready to upload';
    btn.classList.toggle('ready', !btn.disabled && wasDisabled);
}

function upSetStatus(cls, text) {
    const st = upEl('upStatus');
    st.className = 'up-status ' + cls;
    st.textContent = text;
}

function upProgress(mode, pct) {
    const p = upEl('upProgress'), bar = upEl('upBar');
    p.classList.toggle('on', mode !== 'off');
    p.classList.toggle('indet', mode === 'indet');
    bar.style.width = mode === 'det' ? Math.max(4, pct) + '%' : '';
}

function upRefreshSlotUI(i) {
    const hasNew = !!upFiles[i];
    const state = upEl('upState' + i);
    const has = upExistingUrls[i] && String(upExistingUrls[i]).trim() !== '';
    upEl('upCard' + i).classList.toggle('ready', hasNew);
    if (hasNew) { state.className = 'up-state new'; state.textContent = has ? 'Will replace' : 'New'; }
    else if (has) { state.className = 'up-state has'; state.textContent = 'Uploaded ✓'; }
    else { state.className = 'up-state none'; state.textContent = 'Empty'; }
    const link = upEl('upExisting' + i);
    link.hidden = !has;
}

function upResetSlot(i) {
    upFiles[i] = null;
    upEl('upFile' + i).value = '';
    const pick = upEl('upPick' + i);
    pick.classList.remove('has-file', 'drag');
    const img = pick.querySelector('img');
    if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    img.removeAttribute('src');
    pick.querySelector('.up-fname').textContent = '';
    upRefreshSlotUI(i);
}

function upSetFile(i, f) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { showToast('Please choose an image file.', 'error'); return; }
    const pick = upEl('upPick' + i);
    const img = pick.querySelector('img');
    if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    upFiles[i] = f;
    img.src = URL.createObjectURL(f);
    pick.classList.add('has-file');
    pick.querySelector('.up-fname').textContent = f.name + ' · ' + upFmtSize(f.size);
    upRefreshSlotUI(i);
    upCheckReady();
}

// Shrinks large phone photos before sending (small requests, faster upload).
// Falls back to the original file if the browser can't decode it.
function upPrepareImage(file) {
    const MAX_DIM = 1800, QUALITY = 0.85;
    const readRaw = () => new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve({ base64: String(fr.result).split(',')[1], type: file.type || 'image/jpeg', name: file.name });
        fr.onerror = () => reject(new Error('Could not read "' + file.name + '".'));
        fr.readAsDataURL(file);
    });
    return new Promise(resolve => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                let w = img.naturalWidth, h = img.naturalHeight;
                const scale = Math.min(1, MAX_DIM / Math.max(w, h));
                w = Math.round(w * scale); h = Math.round(h * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
                URL.revokeObjectURL(url);
                resolve({ base64: dataUrl.split(',')[1], type: 'image/jpeg', name: file.name.replace(/\.[^.]+$/, '') + '.jpg' });
            } catch (e) { URL.revokeObjectURL(url); readRaw().then(resolve, () => resolve(null)); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); readRaw().then(resolve, () => resolve(null)); };
        img.src = url;
    });
}

function upWireOnce() {
    if (upWired) return;
    upWired = true;
    [1, 2, 3, 4].forEach(i => {
        const input = upEl('upFile' + i), pick = upEl('upPick' + i);
        input.addEventListener('change', () => {
            if (input.files && input.files[0]) upSetFile(i, input.files[0]);
            else { upResetSlot(i); upCheckReady(); }
        });
        upEl('upRemove' + i).addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); upResetSlot(i); upCheckReady(); });
        upEl('upExisting' + i).addEventListener('click', e => {
            e.preventDefault();
            const u = String(upExistingUrls[i] || '').trim();
            if (u) window.open(getDirectImageUrl(u) || u, '_blank', 'noopener');
        });
        ['dragenter', 'dragover'].forEach(ev => pick.addEventListener(ev, e => { e.preventDefault(); if (!upBusy) pick.classList.add('drag'); }));
        ['dragleave', 'drop'].forEach(ev => pick.addEventListener(ev, e => { e.preventDefault(); pick.classList.remove('drag'); }));
        pick.addEventListener('drop', e => {
            if (upBusy) return;
            const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (f) upSetFile(i, f);
        });
    });
    upEl('upSubmitBtn').addEventListener('click', upStartUpload);
    upEl('upCancelBtn').addEventListener('click', closeUploadWindow);
    upEl('upCloseX').addEventListener('click', closeUploadWindow);
    upEl('uploadPhotosOverlay').addEventListener('mousedown', e => {
        if (e.target === upEl('uploadPhotosOverlay')) closeUploadWindow();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && upEl('uploadPhotosOverlay').style.display === 'flex') closeUploadWindow();
    });
}

function openUploadWindow() {
    if (activeEditIndex === null) return;
    const itemData = inventoryData.find(r => r._rowId === activeEditIndex);
    if (!itemData) return;
    upWireOnce();

    upItemCode = String(itemData[headerMapping['article/item']] || 'Unknown');
    upEl('upItemCode').textContent = upItemCode;
    upEl('upUploader').value = loggedInUser || '';
    upEl('upUploaderLabel').textContent = loggedInUser || 'Unknown user';
    [1, 2, 3, 4].forEach(i => {
        const k = headerMapping[UP_SLOTS[i].key];
        upExistingUrls[i] = k ? String(itemData[k] || '').trim() : '';
        upResetSlot(i);
    });
    upBusy = false;
    upEl('upDone').classList.remove('on');
    upEl('upSubmitBtn').classList.remove('busy');
    upEl('upSubmitLabel').textContent = 'Upload & Save Links';
    upEl('upCancelBtn').disabled = false;
    upEl('upCloseX').disabled = false;
    upProgress('off');
    upSetStatus('', '');
    upCheckReady();

    const ov = upEl('uploadPhotosOverlay');
    ov.style.display = 'flex';
    void ov.offsetWidth;              // let the browser register the start state
    ov.classList.add('up-open');
}

function closeUploadWindow(instant) {
    if (upBusy) return; // don't allow closing mid-upload
    const ov = upEl('uploadPhotosOverlay');
    ov.classList.remove('up-open');
    setTimeout(() => {
        if (!ov.classList.contains('up-open')) {
            ov.style.display = 'none';
            [1, 2, 3, 4].forEach(upResetSlot);
        }
    }, instant === true ? 0 : 260);
}

async function upStartUpload() {
    const uploader = upEl('upUploader').value.trim();
    const chosen = [1, 2, 3, 4].filter(i => upFiles[i]);
    if (!uploader || chosen.length === 0) {
        toastAlert('Please select at least one photo before submitting.');
        return;
    }
    const article0 = upItemCode;
    const rowId0 = activeEditIndex;

    upBusy = true;
    const btn = upEl('upSubmitBtn');
    btn.disabled = true; btn.classList.add('busy');
    upEl('upSubmitLabel').textContent = 'Uploading…';
    upEl('upCancelBtn').disabled = true;
    upEl('upCloseX').disabled = true;
    upProgress('det', 4);
    upSetStatus('loading', 'Preparing images…');

    try {
        const params = new URLSearchParams();
        params.append('action', 'uploadPhotos');
        params.append('secret', API_SECRET);
        params.append('itemCode', article0);
        params.append('updatedby', uploader);
        let done = 0;
        for (const i of chosen) {
            const p = await upPrepareImage(upFiles[i]);
            if (!p) throw new Error('Could not read "' + upFiles[i].name + '".');
            params.append('photo' + i + 'Data', p.base64);
            params.append('photo' + i + 'Type', p.type);
            params.append('photo' + i + 'Name', p.name);
            done++;
            upProgress('det', 4 + (done / chosen.length) * 40);
            upSetStatus('loading', 'Preparing images… (' + done + '/' + chosen.length + ')');
        }

        upProgress('indet');
        upSetStatus('loading', 'Uploading to Drive & updating the sheet row… this may take a moment.');

        let result = null;
        try {
            const resp = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                body: params.toString(),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            result = await resp.json();
        } catch (e) {
            // The browser may be unable to read the reply even though the request
            // went through. Do NOT resend (it would create duplicate files).
            result = null;
        }
        if (result && result.success === false) throw new Error(result.message || 'Upload was rejected.');

        // success animation
        upProgress('off');
        upEl('upDoneSub').textContent = (result && result.message ? result.message.replace(/^✅\s*/, '') : 'Photos uploaded') + ' — syncing the sheet…';
        upEl('upDone').classList.add('on');
        modalModified = true;
        await new Promise(r => setTimeout(r, 1300));
        upBusy = false;
        closeUploadWindow();

        // Reload from the sheet (it can lag a few seconds), then refresh the open details window
        const slotKeys = chosen.map(i => headerMapping[UP_SLOTS[i].key]).filter(Boolean);
        const old = inventoryData.find(r => r._rowId === rowId0);
        const before = {};
        slotKeys.forEach(k => { before[k] = old ? String(old[k] || '') : ''; });
        let changed = false;
        for (let n = 0; n < 6 && !changed; n++) {
            await new Promise(r => setTimeout(r, n === 0 && result ? 800 : 2500));
            await loadInventoryFromGoogleSheets(true);
            const fresh = inventoryData.find(r => String(r[headerMapping['article/item']] || '') === article0);
            changed = !!(fresh && slotKeys.some(k => String(fresh[k] || '') !== before[k]));
            if (changed && editModal && editModal.style.display === 'flex') openPopUp(fresh._rowId);
        }
        if (changed) showToast('Photos for ' + article0 + ' are now showing.', 'success');
        else toastAlert('Uploaded, but the sheet has not updated yet. Reopen this record in a moment.');
    } catch (err) {
        console.error(err);
        upBusy = false;
        btn.classList.remove('busy');
        upEl('upSubmitLabel').textContent = 'Upload & Save Links';
        upEl('upCancelBtn').disabled = false;
        upEl('upCloseX').disabled = false;
        upProgress('off');
        upSetStatus('error', 'Upload error: ' + (err && err.message ? err.message : err));
        upCheckReady();
    }
}

function closeModal() {
    animateOut(editModal, closeModalNow);
}

function closeModalNow() {
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
    activeUnidFilter = 'ALL';

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
        activeUnidFilter = 'ALL';

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
    if(typeFilter) typeFilter.addEventListener('change', () => { activeUnidFilter = 'ALL'; executeSearch(true); });
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
            if(!nameVal) { toastAlert("Authorization Denied: Operator name required."); return; }
            if (customNameModal) customNameModal.style.display = 'none';
            finalizeSaveData(nameVal);
        });
    }
}

function downloadDatasetCSV(data, filenamePrefix) {
    if(!data || data.length === 0) {
        toastAlert("Export Nullified: No dataset active for export.");
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

// =========================================================================
// 🌐 Export Searched (standalone HTML with photos downloaded & embedded)
// Photos download in parallel, are resized, and failures are reported.
// =========================================================================
const EXPORT_IMAGE_MAX_PX = 800;   // longest side of each embedded photo
const EXPORT_JPEG_QUALITY = 0.75;  // 0.5 = smaller, 0.9 = sharper
const EXPORT_CONCURRENCY = 6;      // parallel downloads (try 4-8)

// Resize an image Blob and return a JPEG data URL.
// If the browser can't decode it, falls back to the original, unresized data URL.
function exportBlobToDataUrl(blob) {
    const readRaw = () => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });

    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            try {
                let w = img.naturalWidth, h = img.naturalHeight;
                const scale = Math.min(1, EXPORT_IMAGE_MAX_PX / Math.max(w, h));
                w = Math.max(1, Math.round(w * scale));
                h = Math.max(1, Math.round(h * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff'; // avoids black background on transparent PNGs
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(objectUrl);
                resolve(canvas.toDataURL('image/jpeg', EXPORT_JPEG_QUALITY));
            } catch (e) {
                URL.revokeObjectURL(objectUrl);
                readRaw().then(resolve).catch(() => resolve(null));
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            readRaw().then(resolve).catch(() => resolve(null));
        };
        img.src = objectUrl;
    });
}

// Fetch one Drive photo and return an embeddable data URL, or null on failure.
// Never returns an online URL, so a successful result always works offline.
async function getBase64ImageFromUrl(imageUrl) {
    if (!imageUrl) return null;
    try {
        const candidates = [
            getDirectImageUrl(imageUrl, 'view'),
            getDirectImageUrl(imageUrl, 'thumbnail')
        ].filter(Boolean);

        for (const url of candidates) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const blob = await response.blob();
                if (!blob.type.startsWith('image/')) continue; // e.g. an HTML error page
                const dataUrl = await exportBlobToDataUrl(blob);
                if (dataUrl) return dataUrl;
            } catch (e) {
                // try the next candidate
            }
        }
    } catch (e) {
        console.warn("Photo embedding failed:", e);
    }
    return null;
}

// Run async task functions with at most `limit` running at once.
async function exportRunPool(tasks, limit, onDone) {
    let next = 0;
    let done = 0;
    async function worker() {
        while (next < tasks.length) {
            const i = next++;
            await tasks[i]();
            done++;
            if (onDone) onDone(done, tasks.length);
        }
    }
    const workers = [];
    for (let k = 0; k < Math.min(limit, tasks.length); k++) workers.push(worker());
    await Promise.all(workers);
}

function isExportPhotoKey(tKey) {
    return tKey.includes('photo') || tKey.includes('map coordinates') ||
           tKey.includes('tax declaration') || tKey.includes('transfer_cert');
}

// 🌐 Export Searched HTML with Photos Downloaded & Embedded as Base64
async function downloadSearchedHTML(data) {
    if (!data || data.length === 0) {
        toastAlert("Export Nullified: No dataset active for export.");
        return;
    }

    // ---- Pass 1: collect every unique photo link in the export ----
    const uniqueLinks = new Set();
    for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < EXPORT_TABLE_CONFIG.length; j++) {
            const tKey = EXPORT_TABLE_CONFIG[j].key;
            if (!isExportPhotoKey(tKey)) continue;
            const resolvedKey = headerMapping[tKey];
            const val = resolvedKey ? String(data[i][resolvedKey] || '').trim() : '';
            if (val !== '') uniqueLinks.add(val);
        }
    }

    const links = Array.from(uniqueLinks);

    // Big exports can exhaust browser memory; let the user decide.
    if (links.length > 300) {
        const proceed = confirm(
            `This export has ${links.length} photos. Very large single-file reports may be slow ` +
            `or crash the browser tab.\n\nTip: use "Export Searched" on smaller groups.\n\nContinue anyway?`
        );
        if (!proceed) return;
    }

    // ---- Pass 2: download all photos in parallel ----
    const photoMap = new Map(); // link -> data URL (or null if failed)
    const tasks = links.map(link => async () => {
        photoMap.set(link, await getBase64ImageFromUrl(link));
    });

    showLoading(`Downloading photos... 0 / ${links.length}`);
    await exportRunPool(tasks, EXPORT_CONCURRENCY, (done, total) => {
        showLoading(`Downloading photos... ${done} / ${total}`);
    });

    // ---- Pass 3: build the table ----
    showLoading("Building report...");
    let failedCount = 0;
    const failedItems = new Set();
    let tableRowsHTML = '';

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const itemKey = headerMapping['article/item'];
        const itemName = itemKey ? String(row[itemKey] || '').trim() : '';
        tableRowsHTML += `<tr><td class="col-no">${i + 1}</td>`;

        for (let j = 0; j < EXPORT_TABLE_CONFIG.length; j++) {
            const col = EXPORT_TABLE_CONFIG[j];
            const tKey = col.key;
            const resolvedKey = headerMapping[tKey];
            const val = resolvedKey ? String(row[resolvedKey] || '') : '';

            if (isExportPhotoKey(tKey)) {
                const link = val.trim();
                if (link === '') {
                    tableRowsHTML += `<td style="text-align: center; color: #64748b; font-style: italic;">No Photo</td>`;
                } else {
                    const dataUrl = photoMap.get(link);
                    if (dataUrl) {
                        tableRowsHTML += `<td style="text-align: center;"><img src="${dataUrl}" style="height: 250px; max-width: 250px; width: auto; object-fit: contain; border: 1px solid #94a3b8; border-radius: 4px; display: block; margin: 0 auto;" /></td>`;
                    } else {
                        failedCount++;
                        failedItems.add(itemName || `Row ${i + 1}`);
                        tableRowsHTML += `<td style="text-align: center; color: #b91c1c; font-style: italic;">Photo not downloaded</td>`;
                    }
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

    let headersHTML = '<th class="col-no">No.</th>';
    EXPORT_TABLE_CONFIG.forEach(col => {
        headersHTML += `<th>${col.display}</th>`;
    });

    const failNote = failedCount > 0
        ? `<br><span style="color:#b91c1c;">&#9888; ${failedCount} photo(s) could not be downloaded and are marked in the table.</span>`
        : '';

    const headerHTML = await exportBuildHeader(
        'Real Estate Inventory Report',
        `Exported On: ${new Date().toLocaleString()} &bull; Total Records: ${data.length}${failNote}`
    );

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
${EXPORT_HEADER_CSS}
        @media print {
            body { margin: 10px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th { background-color: #cbd5e1 !important; }
        }
    </style>
</head>
<body>
    ${headerHTML}
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
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    hideLoading();

    if (failedCount > 0) {
        const list = Array.from(failedItems).slice(0, 10).join(', ');
        const more = failedItems.size > 10 ? ` and ${failedItems.size - 10} more` : '';
        toastAlert(
            `Report saved, but ${failedCount} photo(s) could not be downloaded and will NOT show offline.\n\n` +
            `Affected items: ${list}${more}\n\nCheck your connection or the photo sharing settings, then export again.`
        );
    }
}

// =========================================================================
// 🏛️ REPORT HEADER LOGOS (Cebu City seal + DGS) for the exported reports
// Logos are embedded as base64 so they still show when the downloaded
// report is opened or printed from the Downloads folder.
// =========================================================================
const EXPORT_LOGO_LEFT  = 'Ph_seal_cebucity.png';
const EXPORT_LOGO_RIGHT = 'dgs_logo.png';
const EXPORT_LOGO_SIZE_PX = 60; // small logo size on the printed page

async function exportLoadLogo(src) {
    try {
        const res = await fetch(src);
        if (!res.ok) return '';
        const blob = await res.blob();
        return await new Promise((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => resolve('');
            r.readAsDataURL(blob);
        });
    } catch (e) {
        return src; // fallback: relative link (works if the report sits next to the image files)
    }
}

// Returns the CSS + the HTML for the header row (logo | title + meta | logo)
async function exportBuildHeader(titleText, metaHTML) {
    const [left, right] = await Promise.all([
        exportLoadLogo(EXPORT_LOGO_LEFT),
        exportLoadLogo(EXPORT_LOGO_RIGHT)
    ]);
    const img = (src, alt) => src
        ? `<img class="report-logo" src="${src}" alt="${alt}" onerror="this.style.visibility='hidden'">`
        : `<span class="report-logo"></span>`;
    return `<div class="report-header">
        ${img(left, 'Cebu City Seal')}
        <div class="report-header-text">
            <h1>${titleText}</h1>
            <div class="report-meta">${metaHTML}</div>
        </div>
        ${img(right, 'DGS Logo')}
    </div>`;
}

const EXPORT_HEADER_CSS = `
        .report-header { display: flex; align-items: center; justify-content: center; gap: 18px; margin-bottom: 15px; }
        .report-header-text { flex: 1; text-align: center; }
        .report-header-text h1 { margin: 0 0 5px 0; }
        .report-header-text .report-meta { margin-bottom: 0; }
        .report-logo { width: ${EXPORT_LOGO_SIZE_PX}px; height: ${EXPORT_LOGO_SIZE_PX}px; object-fit: contain; flex: 0 0 auto; display: block; }
        th.col-no, td.col-no { width: 40px; min-width: 40px; text-align: center; font-weight: bold; white-space: nowrap; }`;

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
            let client = getOrCreateTokenClient();
            if (client) { setLoginState('idle'); requestGoogleLogin(client); }
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
    if (accessToken) {
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
    if (accessToken && window.google) {
        google.accounts.oauth2.revoke(accessToken, () => {});
    }
    
    // 2. Clear credentials and stop the idle timeout timer
    accessToken = null;
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
            btn.style.display = (accessToken && isMainAppVisible) ? 'block' : 'none';
        }
    }, 1000);
});
// =========================================================================

// =========================================================================
// 🛡️ ADMIN PANEL (front-end)
// Only shown to ADMIN_EMAIL. Lets the admin:
//   • view / add / edit / delete Gmail accounts in "Authorized Accounts"
//   • review pending access requests (Accept -> Authorized Accounts, Deny -> marked "Denied" in the sheet, then hidden)
//   • delete a property photo (Drive file + sheet link) from the photo viewer
// NOTE: hiding the buttons here is cosmetic only — the Apps Script backend
// (handleAdminAction in code.gs) independently verifies the admin's Google
// token, so nobody else can use these actions.
// Self-contained: it does not modify any existing function.
// =========================================================================
(function () {
    const ADMIN_EMAIL = "kieldelina001@gmail.com";
    const acc = { headers: [], emailCol: 0, rows: [], editingRow: null };
    const req = { headers: [], emailCol: 2, rows: [], loaded: false };
    let busy = false;
    let els = null;
    let confirmCb = null;
    let toastTimer = null;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function isAdminSession() {
        return !!accessToken && String(loggedInUser || '').trim().toLowerCase() === ADMIN_EMAIL;
    }

    async function adminCall(action, extra) {
        const params = new URLSearchParams();
        params.append('secret', API_SECRET);
        params.append('action', action);
        params.append('token', accessToken);
        Object.keys(extra || {}).forEach(k => params.append(k, extra[k]));

        const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: params.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); }
        catch (e) {
            throw new Error(/unauthorized/i.test(text)
                ? 'Unauthorized: API secret mismatch.'
                : 'Unexpected server response. Re-deploy the Apps Script web app as a NEW VERSION and try again.');
        }
        if (!json.success) throw new Error(json.message || 'Request failed.');
        return json;
    }

    // ---------------------------------------------------------------- UI HELPERS
    function toast(msg, type) {
        if (!els) return;
        clearTimeout(toastTimer);
        els.toast.className = 'adm-toast' + (msg ? ' on ' + (type || 'info') : '');
        els.toast.querySelector('.adm-toast-msg').textContent = msg || '';
        if (msg) toastTimer = setTimeout(() => { els.toast.classList.remove('on'); }, type === 'error' ? 7000 : 3800);
    }

    function setBusy(b) {
        busy = b;
        if (!els) return;
        els.panel.classList.toggle('is-busy', b);
        els.panel.querySelectorAll('button, input').forEach(el => { el.disabled = b; });
    }

    function askConfirm(opts, cb) {
        els.cfTitle.textContent = opts.title;
        els.cfText.innerHTML = opts.html;
        els.cfOk.textContent = opts.ok;
        els.cfOk.className = 'adm-btn ' + (opts.danger ? 'adm-red' : 'adm-green');
        els.cf.classList.add('on');
        confirmCb = cb;
        els.cfOk.focus();
    }
    function closeConfirm() { els.cf.classList.remove('on'); confirmCb = null; }

    function initials(email) {
        const n = String(email || '?').split('@')[0].replace(/[^a-zA-Z0-9]+/g, ' ').trim();
        const p = n.split(' ');
        return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
    }

    // ---------------------------------------------------------------- REQUESTS
    function statusColIdx() {
        return req.headers.findIndex(h => /^\s*(status|reviewed on)\s*$/i.test(h || ''));
    }
    function hiddenReqCols() {
        const hidden = {};
        req.headers.forEach((h, i) => { if (/^\s*(status|reviewed on)\s*$/i.test(h || '')) hidden[i] = true; });
        return hidden;
    }
    function reqStatus(r) {
        if (r.denied === true) return 'denied';
        if (r.status) return String(r.status).toLowerCase();
        const i = req.headers.findIndex(h => /^\s*status\s*$/i.test(h || ''));
        return i >= 0 ? String(r.values[i] || '').trim().toLowerCase() : '';
    }
    function isPending(r) {
        if (r.authorized) return false;
        const st = reqStatus(r);
        return st !== 'denied' && st !== 'approved';
    }
    function pendingRows() { return req.rows.filter(isPending); }

    function applyRequests(p) {
        req.headers = p.headers || [];
        req.emailCol = (p.emailCol == null) ? 2 : p.emailCol;
        req.rows = p.rows || [];
        req.loaded = true;
        render();
    }

    function renderRequests() {
        const rows = pendingRows().reverse(); // newest first
        els.reqBadge.textContent = rows.length;
        els.reqBadge.className = 'adm-badge' + (rows.length ? ' hot' : '');
        els.reqSub.textContent = rows.length
            ? rows.length + ' waiting for your decision'
            : 'No pending requests';

        if (!req.loaded) { els.reqBody.innerHTML = '<div class="adm-empty">Loading requests…</div>'; return; }
        if (!rows.length) {
            els.reqBody.innerHTML = '<div class="adm-empty"><div class="adm-empty-ic">✓</div><b>You\'re all caught up</b><span>New access requests will appear here.</span></div>';
            return;
        }

        const hidden = hiddenReqCols();
        const cols = req.headers.map((h, i) => i).filter(i => !hidden[i]);
        let html = '<table><thead><tr>' +
            cols.map(i => '<th>' + esc(req.headers[i] || ('Column ' + (i + 1))) + '</th>').join('') +
            '<th class="adm-th-act">Decision</th></tr></thead><tbody>';

        rows.forEach(r => {
            const email = (r.values[req.emailCol] || '').trim();
            html += '<tr>';
            cols.forEach(c => {
                const v = r.values[c] || '';
                if (c === req.emailCol) {
                    html += '<td><div class="adm-user"><span class="adm-avatar">' + esc(initials(email)) + '</span><span class="adm-email">' + esc(email) + '</span></div></td>';
                } else {
                    html += '<td class="' + (v ? '' : 'adm-muted') + '">' + (v ? esc(v) : '—') + '</td>';
                }
            });
            html += '<td class="adm-act"><div class="adm-btngrp">' +
                '<button class="adm-btn adm-green" data-ract="approve" data-row="' + r.row + '" data-email="' + esc(email) + '">✓ Accept</button>' +
                '<button class="adm-btn adm-red-o" data-ract="deny" data-row="' + r.row + '" data-email="' + esc(email) + '">✕ Deny</button>' +
                '</div></td></tr>';
        });
        html += '</tbody></table>';
        els.reqBody.innerHTML = html;
    }

    // ---------------------------------------------------------------- ACCOUNTS
    function applyAccounts(p) {
        acc.headers = p.headers || [];
        acc.emailCol = p.emailCol || 0;
        acc.rows = p.rows || [];
        acc.editingRow = null;
        render();
    }

    function renderAccounts() {
        const q = els.search.value.trim().toLowerCase();
        const rows = acc.rows.filter(r => !q || r.values.some(v => String(v).toLowerCase().includes(q)));
        els.count.textContent = rows.length + (q ? ' of ' + acc.rows.length : '');

        let html = '<table><thead><tr><th style="width:44px;">#</th>' +
            acc.headers.map((h, i) => '<th>' + esc(h || ('Column ' + (i + 1))) + '</th>').join('') +
            '<th class="adm-th-act">Actions</th></tr></thead><tbody>';

        if (rows.length === 0) {
            html += '<tr><td colspan="' + (acc.headers.length + 2) + '" class="adm-muted" style="text-align:center;padding:26px;">No accounts found.</td></tr>';
        }

        rows.forEach((r, idx) => {
            const isEditing = acc.editingRow === r.row;
            const emailVal = r.values[acc.emailCol] || '';
            const isAdminRow = emailVal.trim().toLowerCase() === ADMIN_EMAIL;
            html += '<tr><td class="adm-muted">' + (idx + 1) + '</td>';
            acc.headers.forEach((h, c) => {
                const v = r.values[c] || '';
                if (c === acc.emailCol && isEditing) {
                    html += '<td><input type="email" class="adm-edit-input" id="admEditInput" value="' + esc(v) + '"></td>';
                } else if (c === acc.emailCol) {
                    html += '<td><div class="adm-user"><span class="adm-avatar sm">' + esc(initials(v)) + '</span><span class="adm-email">' + esc(v) + '</span>' +
                        (isAdminRow ? '<span class="adm-tag">ADMIN</span>' : '') + '</div></td>';
                } else {
                    html += '<td>' + esc(v) + '</td>';
                }
            });
            if (isEditing) {
                html += '<td class="adm-act"><div class="adm-btngrp"><button class="adm-btn adm-green" data-act="save" data-row="' + r.row + '">Save</button>' +
                        '<button class="adm-btn adm-gray" data-act="cancel">Cancel</button></div></td>';
            } else if (isAdminRow) {
                html += '<td class="adm-act"><span class="adm-muted" style="font-size:12px;">Protected</span></td>';
            } else {
                html += '<td class="adm-act"><div class="adm-btngrp"><button class="adm-btn adm-ghost" data-act="edit" data-row="' + r.row + '">Edit</button>' +
                        '<button class="adm-btn adm-red-o" data-act="delete" data-row="' + r.row + '">Delete</button></div></td>';
            }
            html += '</tr>';
        });
        html += '</tbody></table>';
        els.table.innerHTML = html;

        const inp = document.getElementById('admEditInput');
        if (inp) { inp.focus(); inp.select(); }
    }

    // ---------------------------------------------------------------- COMMON
    function render() {
        if (!els) return;
        renderRequests();
        renderAccounts();
    }

    async function loadAll(msg) {
        setBusy(true);
        toast('Loading…', 'info');
        let errMsg = '';
        try { applyAccounts(await adminCall('adminList')); } catch (err) { errMsg = err.message; }
        try { applyRequests(await adminCall('adminRequests')); }
        catch (err) { errMsg = errMsg || ('Access requests: ' + err.message); }
        setBusy(false);
        render();
        if (errMsg) toast(errMsg, 'error'); else toast(msg || '', 'ok');
    }

    async function runWrite(action, extra) {
        setBusy(true);
        toast('Saving to Google Sheet…', 'info');
        try {
            const p = await adminCall(action, extra);
            if (action === 'adminApproveRequest' || action === 'adminDenyRequest') {
                if (p.accounts) applyAccounts(p.accounts);
                applyRequests(p);
            } else {
                applyAccounts(p);
            }
            toast(p.message || 'Done.', 'ok');
            return true;
        } catch (err) {
            toast(err.message, 'error');
            return false;
        } finally { setBusy(false); render(); }
    }

    function findRow(rowNum) { return acc.rows.find(r => r.row === Number(rowNum)); }

    function onPanelClick(e) {
        const btn = e.target.closest('button');
        if (!btn || busy) return;

        const ract = btn.getAttribute('data-ract');
        if (ract) {
            const row = btn.getAttribute('data-row');
            const email = btn.getAttribute('data-email') || '';
            if (ract === 'approve') {
                runWrite('adminApproveRequest', { row: row, email: email });
            } else if (ract === 'deny') {
                askConfirm({
                    title: 'Deny access request?',
                    html: '<b>' + esc(email) + '</b> will be marked <b>Denied</b> in the Request Access sheet and removed from this list. The record is kept in the sheet.',
                    ok: 'Deny request', danger: true
                }, () => runWrite('adminDenyRequest', { row: row, email: email }));
            }
            return;
        }

        const act = btn.getAttribute('data-act');
        const rowNum = btn.getAttribute('data-row');
        const r = rowNum ? findRow(rowNum) : null;
        if (act === 'edit' && r) { acc.editingRow = r.row; render(); }
        else if (act === 'cancel') { acc.editingRow = null; render(); toast('', 'info'); }
        else if (act === 'save' && r) {
            const input = document.getElementById('admEditInput');
            runWrite('adminUpdate', { row: r.row, oldEmail: (r.values[acc.emailCol] || '').trim(), email: input ? input.value.trim() : '' });
        }
        else if (act === 'delete' && r) {
            const em = (r.values[acc.emailCol] || '').trim();
            askConfirm({
                title: 'Remove this account?',
                html: '<b>' + esc(em) + '</b> will be removed from Authorized Accounts and will no longer be able to open the web app.',
                ok: 'Remove account', danger: true
            }, () => runWrite('adminDelete', { row: r.row, email: em }));
        }
    }

    async function onAdd() {
        const email = els.addInput.value.trim();
        if (!email) { toast('Enter an email address to add.', 'error'); return; }
        const ok = await runWrite('adminAdd', { email: email });
        if (ok) els.addInput.value = '';
    }

    function buildUI() {
        const style = document.createElement('style');
        style.textContent = `
        #adminOpenBtn{position:fixed;top:20px;right:130px;background:linear-gradient(180deg,#1b3a63,#0b1f3a);color:#fff;border:none;padding:10px 18px;border-radius:999px;font:600 13px Inter,sans-serif;letter-spacing:.3px;cursor:pointer;box-shadow:0 4px 12px rgba(11,31,58,.35);z-index:999999;display:none;transition:transform .15s,box-shadow .15s;}
        #adminOpenBtn:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(11,31,58,.4);}
        #adminOverlay{position:fixed;inset:0;background:rgba(11,31,58,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;z-index:300000;padding:16px;box-sizing:border-box;}
        #adminPanel{--b:#2b83cf;position:relative;background:#f8fafc;border-radius:18px;width:100%;max-width:1020px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.35);font-family:Inter,'Segoe UI',Arial,sans-serif;color:#0f172a;overflow:hidden;animation:admPop .26s cubic-bezier(.16,1,.3,1);}
        @keyframes admPop{from{opacity:0;transform:translateY(10px) scale(.97);}to{opacity:1;transform:none;}}
        #adminPanel.is-busy{cursor:progress;}
        #adminPanel .adm-head{display:flex;align-items:center;gap:14px;padding:18px 24px;background:linear-gradient(135deg,#0b1f3a,#1b3a63);color:#fff;}
        #adminPanel .adm-head-ic{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:20px;}
        #adminPanel .adm-head h3{margin:0;font-size:18px;font-weight:800;letter-spacing:-.01em;}
        #adminPanel .adm-head p{margin:2px 0 0;font-size:12.5px;color:#b9cdea;}
        #adminPanel .adm-head-sp{flex:1;}
        #adminPanel .adm-iconbtn{background:rgba(255,255,255,.12);border:none;color:#fff;height:36px;min-width:36px;padding:0 12px;border-radius:10px;font:600 13px Inter,sans-serif;cursor:pointer;transition:background .15s;}
        #adminPanel .adm-iconbtn:hover:not(:disabled){background:rgba(255,255,255,.24);}
        #adminPanel .adm-iconbtn:disabled{opacity:.5;cursor:not-allowed;}
        #adminPanel .adm-body{padding:20px 24px 24px;overflow:auto;display:flex;flex-direction:column;gap:20px;}
        #adminPanel .adm-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 1px 2px rgba(15,23,42,.05);overflow:hidden;}
        #adminPanel .adm-card-head{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #eef2f7;flex-wrap:wrap;}
        #adminPanel .adm-card-head h4{margin:0;font-size:15px;font-weight:800;color:#0b1f3a;letter-spacing:-.01em;display:flex;align-items:center;gap:10px;}
        #adminPanel .adm-card-sub{font-size:12.5px;color:#64748b;}
        #adminPanel .adm-badge{min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;}
        #adminPanel .adm-badge.hot{background:#f59e0b;color:#3b2a04;}
        #adminPanel .adm-pill{font-size:12px;font-weight:700;color:#1d6fb8;background:#e3effa;padding:3px 10px;border-radius:999px;}
        #adminPanel .adm-tools{display:flex;gap:10px;flex-wrap:wrap;padding:14px 20px;background:#f8fafc;border-bottom:1px solid #eef2f7;}
        #adminPanel .adm-tools .adm-add{display:flex;gap:8px;flex:2;min-width:260px;}
        #adminPanel .adm-grow{flex:1;min-width:150px;}
        #adminPanel input[type=email],#adminPanel input[type=search]{padding:0 12px;height:38px;border:1px solid #cbd5e1;border-radius:10px;font:14px Inter,sans-serif;box-sizing:border-box;background:#fff;color:#0f172a;transition:border-color .15s,box-shadow .15s;}
        #adminPanel input:focus{outline:none;border-color:#2b83cf;box-shadow:0 0 0 3px rgba(43,131,207,.18);}
        #adminPanel .adm-btn{border:1px solid transparent;color:#fff;height:34px;padding:0 14px;border-radius:9px;cursor:pointer;font:600 13px Inter,sans-serif;white-space:nowrap;transition:transform .12s,box-shadow .12s,background .12s,color .12s;}
        #adminPanel .adm-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 10px rgba(15,23,42,.18);}
        #adminPanel .adm-btn:active:not(:disabled){transform:scale(.97);}
        #adminPanel .adm-btn:disabled{opacity:.5;cursor:not-allowed;}
        #adminPanel .adm-green{background:linear-gradient(180deg,#22c55e,#16a34a);}
        #adminPanel .adm-red{background:linear-gradient(180deg,#ef4444,#dc2626);}
        #adminPanel .adm-red-o{background:#fff;color:#dc2626;border-color:#fca5a5;}
        #adminPanel .adm-red-o:hover:not(:disabled){background:#fee2e2;}
        #adminPanel .adm-gray{background:#64748b;}
        #adminPanel .adm-ghost{background:#fff;color:#1d6fb8;border-color:#b6d4f0;}
        #adminPanel .adm-ghost:hover:not(:disabled){background:#e3effa;}
        #adminPanel .adm-primary{background:linear-gradient(180deg,#2b83cf,#1d6fb8);height:38px;}
        #adminPanel .adm-scroll{overflow:auto;}
        #adminPanel .adm-scroll.req{max-height:280px;}
        #adminPanel .adm-scroll.acc{max-height:320px;}
        #adminPanel table{width:100%;border-collapse:collapse;font-size:13.5px;}
        #adminPanel th{background:#f1f5f9;text-align:left;padding:10px 16px;position:sticky;top:0;z-index:1;border-bottom:1px solid #e2e8f0;color:#475569;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;white-space:nowrap;}
        #adminPanel td{padding:11px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b;word-break:break-word;vertical-align:middle;}
        #adminPanel tbody tr{transition:background .12s;}
        #adminPanel tbody tr:hover{background:#f1f7fd;}
        #adminPanel tbody tr:last-child td{border-bottom:none;}
        #adminPanel .adm-th-act,#adminPanel .adm-act{text-align:right;white-space:nowrap;width:1%;}
        #adminPanel .adm-btngrp{display:inline-flex;gap:8px;}
        #adminPanel .adm-muted{color:#94a3b8;}
        #adminPanel .adm-user{display:flex;align-items:center;gap:10px;}
        #adminPanel .adm-avatar{flex:none;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#57a1e0,#1d6fb8);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;}
        #adminPanel .adm-avatar.sm{width:28px;height:28px;font-size:11px;background:linear-gradient(135deg,#94a3b8,#64748b);}
        #adminPanel .adm-email{font-weight:600;}
        #adminPanel .adm-tag{background:#e0e7ff;color:#3730a3;font-size:10px;padding:2px 8px;border-radius:999px;font-weight:700;letter-spacing:.5px;}
        #adminPanel .adm-edit-input{width:100%;min-width:200px;}
        #adminPanel .adm-empty{display:flex;flex-direction:column;align-items:center;gap:4px;padding:30px 16px;color:#64748b;font-size:13px;text-align:center;}
        #adminPanel .adm-empty b{color:#0b1f3a;font-size:14px;}
        #adminPanel .adm-empty-ic{width:44px;height:44px;border-radius:50%;background:#dcfce7;color:#16a34a;font-size:22px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-bottom:6px;}
        #adminPanel .adm-toast{position:absolute;left:50%;bottom:18px;transform:translate(-50%,16px);opacity:0;pointer-events:none;background:#0b1f3a;color:#fff;padding:11px 18px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 10px 30px rgba(15,23,42,.35);max-width:88%;transition:opacity .2s,transform .25s cubic-bezier(.16,1,.3,1);z-index:5;border-left:4px solid #57a1e0;}
        #adminPanel .adm-toast.on{opacity:1;transform:translate(-50%,0);}
        #adminPanel .adm-toast.ok{border-left-color:#22c55e;}
        #adminPanel .adm-toast.error{border-left-color:#ef4444;background:#7f1d1d;}
        #adminPanel .adm-cf{position:absolute;inset:0;background:rgba(11,31,58,.45);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:10;padding:16px;}
        #adminPanel .adm-cf.on{display:flex;}
        #adminPanel .adm-cf-box{background:#fff;border-radius:16px;padding:24px;max-width:400px;width:100%;box-shadow:0 20px 50px rgba(15,23,42,.35);animation:admPop .2s cubic-bezier(.16,1,.3,1);}
        #adminPanel .adm-cf-box h5{margin:0 0 8px;font-size:17px;font-weight:800;color:#0b1f3a;}
        #adminPanel .adm-cf-box p{margin:0 0 20px;font-size:13.5px;line-height:1.55;color:#475569;}
        #adminPanel .adm-cf-actions{display:flex;justify-content:flex-end;gap:10px;}
        @media (max-width:640px){#adminOpenBtn{right:20px;top:12px;} #adminPanel .adm-body{padding:14px;} #adminPanel .adm-head{padding:14px 16px;} #adminPanel .adm-head p{display:none;}}
        @media (prefers-reduced-motion:reduce){#adminPanel,#adminPanel .adm-cf-box{animation:none;} #adminPanel .adm-toast{transition:none;}}
        `;
        document.head.appendChild(style);

        const openBtn = document.createElement('button');
        openBtn.id = 'adminOpenBtn';
        openBtn.textContent = '⚙️ Admin Panel';
        document.body.appendChild(openBtn);

        const overlay = document.createElement('div');
        overlay.id = 'adminOverlay';
        overlay.innerHTML = `
        <div id="adminPanel" role="dialog" aria-modal="true" aria-label="Admin Panel">
            <div class="adm-head">
                <div class="adm-head-ic">🛡️</div>
                <div><h3>Admin Panel</h3><p>Manage who can access the Real Estate Inventory</p></div>
                <div class="adm-head-sp"></div>
                <button class="adm-iconbtn" id="adminRefreshBtn" title="Refresh">↻ Refresh</button>
                <button class="adm-iconbtn" id="adminCloseBtn" title="Close" style="font-size:20px;">&times;</button>
            </div>
            <div class="adm-body">
                <section class="adm-card">
                    <div class="adm-card-head">
                        <h4>📨 Access Requests <span class="adm-badge" id="admReqBadge">0</span></h4>
                        <span class="adm-card-sub" id="admReqSub"></span>
                    </div>
                    <div class="adm-scroll req" id="admReqBody"></div>
                </section>

                <section class="adm-card">
                    <div class="adm-card-head">
                        <h4>👥 Authorized Accounts <span class="adm-pill" id="adminCount">0</span></h4>
                    </div>
                    <div class="adm-tools">
                        <div class="adm-add">
                            <input type="email" id="adminAddInput" class="adm-grow" placeholder="Add Gmail account (e.g. name@gmail.com)">
                            <button class="adm-btn adm-primary" id="adminAddBtn">＋ Add Email</button>
                        </div>
                        <input type="search" id="adminSearchInput" class="adm-grow" placeholder="Search accounts…">
                    </div>
                    <div class="adm-scroll acc" id="adminTable"></div>
                </section>
            </div>

            <div class="adm-toast" id="adminToast"><span class="adm-toast-msg"></span></div>
            <div class="adm-cf" id="adminConfirm">
                <div class="adm-cf-box">
                    <h5 id="adminCfTitle"></h5>
                    <p id="adminCfText"></p>
                    <div class="adm-cf-actions">
                        <button class="adm-btn adm-gray" id="adminCfCancel">Cancel</button>
                        <button class="adm-btn adm-red" id="adminCfOk">Confirm</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.appendChild(overlay);

        els = {
            openBtn: openBtn,
            overlay: overlay,
            panel: document.getElementById('adminPanel'),
            table: document.getElementById('adminTable'),
            reqBody: document.getElementById('admReqBody'),
            reqBadge: document.getElementById('admReqBadge'),
            reqSub: document.getElementById('admReqSub'),
            search: document.getElementById('adminSearchInput'),
            addInput: document.getElementById('adminAddInput'),
            count: document.getElementById('adminCount'),
            toast: document.getElementById('adminToast'),
            cf: document.getElementById('adminConfirm'),
            cfTitle: document.getElementById('adminCfTitle'),
            cfText: document.getElementById('adminCfText'),
            cfOk: document.getElementById('adminCfOk')
        };

        openBtn.addEventListener('click', () => {
            if (!isAdminSession()) return;
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            req.loaded = false;
            render();
            loadAll('');
        });
        document.getElementById('adminCloseBtn').addEventListener('click', closeAdmin);
        overlay.addEventListener('mousedown', e => { if (e.target === overlay && !busy) closeAdmin(); });
        document.getElementById('adminAddBtn').addEventListener('click', onAdd);
        els.addInput.addEventListener('keydown', e => { if (e.key === 'Enter') onAdd(); });
        document.getElementById('adminRefreshBtn').addEventListener('click', () => loadAll('Refreshed.'));
        els.search.addEventListener('input', renderAccounts);
        els.reqBody.addEventListener('click', onPanelClick);
        els.table.addEventListener('click', onPanelClick);
        document.getElementById('adminCfCancel').addEventListener('click', closeConfirm);
        els.cfOk.addEventListener('click', () => { const cb = confirmCb; closeConfirm(); if (cb) cb(); });
        els.cf.addEventListener('mousedown', e => { if (e.target === els.cf) closeConfirm(); });
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (els.cf.classList.contains('on')) closeConfirm();
                else if (!busy) closeAdmin();
            }
        });
        els.table.addEventListener('keydown', e => {
            if (e.target && e.target.id === 'admEditInput') {
                if (e.key === 'Enter') {
                    const r = findRow(acc.editingRow);
                    if (r) runWrite('adminUpdate', { row: r.row, oldEmail: (r.values[acc.emailCol] || '').trim(), email: e.target.value.trim() });
                } else if (e.key === 'Escape') { e.stopPropagation(); acc.editingRow = null; render(); }
            }
        });
    }

    function closeAdmin() {
        if (!els) return;
        els.overlay.style.display = 'none';
        document.body.style.overflow = '';
        acc.editingRow = null;
        closeConfirm();
        toast('', 'info');
    }

    // ---------------------------------------------------------------- PHOTO DELETE
    // The photo viewer (renderModalPhotoViewer) rebuilds its buttons every time,
    // so we watch for it and add a Delete button next to "Download Photo"
    // when the admin is signed in. Regular users never get this button.
    async function deleteCurrentPhoto(btn) {
        const photo = modalPhotos[currentPhotoIndex];
        if (!photo || activeEditIndex === null) return;
        const item = inventoryData.find(r => r._rowId === activeEditIndex);
        if (!item) return;
        const articleKey = headerMapping['article/item'];
        const itemCode = String(item[articleKey] || '').trim();

        if (!confirm('Delete "' + photo.label + '" for item ' + itemCode + '?\n\nThe file will be removed from Google Drive (moved to Trash) and unlinked from the sheet.')) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Deleting...';
        try {
            await adminCall('adminDeletePhoto', { itemCode: itemCode, url: photo.url, photoKey: photo.key });

            const mapped = headerMapping[photo.key];
            if (mapped) item[mapped] = '';
            try { delete imageCache[photo.url]; } catch (e) {}

            modalPhotos.splice(currentPhotoIndex, 1);
            if (currentPhotoIndex >= modalPhotos.length) currentPhotoIndex = Math.max(0, modalPhotos.length - 1);
            modalModified = true; // closing the modal refreshes the table from the sheet
            renderModalPhotoViewer();
        } catch (err) {
            toastAlert('Could not delete photo: ' + err.message);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    function injectPhotoDeleteButtons() {
        if (!isAdminSession()) return;
        document.querySelectorAll('.photo-actions-container').forEach(container => {
            if (container.querySelector('.adm-photo-del')) return;
            const b = document.createElement('button');
            b.className = 'photo-action-btn adm-photo-del';
            b.textContent = '🗑️ Delete Photo';
            b.style.background = '#dc2626';
            b.style.color = '#ffffff';
            b.style.borderColor = '#dc2626';
            b.addEventListener('click', (e) => { e.stopPropagation(); deleteCurrentPhoto(b); });
            container.appendChild(b);
        });
    }

    window.addEventListener('DOMContentLoaded', () => {
        buildUI();

        const watchTarget = document.getElementById('editModal') || document.body;
        new MutationObserver(injectPhotoDeleteButtons).observe(watchTarget, { childList: true, subtree: true });

        // Show the Admin button only while the admin is logged in and the main app is visible
        setInterval(() => {
            const mainApp = document.getElementById('mainApp');
            const mainVisible = mainApp && mainApp.style.display !== 'none';
            const show = isAdminSession() && mainVisible;
            els.openBtn.style.display = show ? 'block' : 'none';
            if (!show && els.overlay.style.display === 'flex') closeAdmin();
        }, 1000);
    });
})();


// =========================================================================
// 🛡️ INSURANCE TAB + DETAILS WINDOW
// Uses the SAME inventoryData already loaded by the app (no extra fetch).
// =========================================================================
(function () {
    const LABEL = { INSURED: 'Insured', EXPIRING: 'Expiring', EXPIRED: 'Expired', NOT_INSURED: 'Not Insured' };
    const COLOR = { INSURED: '#16a34a', EXPIRING: '#f59e0b', EXPIRED: '#dc2626', NOT_INSURED: '#94a3b8' };
    const HINT  = { INSURED: 'Coverage in force', EXPIRING: 'Ends within 30 days', EXPIRED: 'Coverage has lapsed', NOT_INSURED: 'No policy on record' };
    let statusFilter = 'ALL', sortKey = 'days', sortDir = 1, records = [], insFilteredRows = [];
    let playing = false, playTimer = null;
    function countUp(el, to) {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches || to === 0) { el.textContent = to; return; }
        const t0 = performance.now(), dur = 650;
        (function step(now) {
            const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
            el.textContent = Math.round(to * e);
            if (p < 1) requestAnimationFrame(step);
        })(t0);
    }
    function playEntrance() {
        const v = $('insuranceView');
        playing = true; v.classList.remove('ins-play'); void v.offsetWidth; v.classList.add('ins-play');
        clearTimeout(playTimer);
        playTimer = setTimeout(() => { playing = false; v.classList.remove('ins-play'); }, 1600);
    }
    const $ = id => document.getElementById(id);
    const fmtDate = d => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Shown when an insured record's Notes don't name an insurer
    const DEFAULT_INSURER = 'GSIS';
    // Known insurers (edit/add names here). First match found in the Notes wins.
    const INSURER_KEYWORDS = [
        [/\bgovernment\s+service\s+insurance\s+system\b/i, 'GSIS'],
        [/\bGSIS\b/i, 'GSIS'],
        [/\bmalayan\b/i, 'Malayan Insurance'],
        [/\bstandard\s+insurance\b/i, 'Standard Insurance'],
        [/\bpioneer\b/i, 'Pioneer Insurance'],
        [/\bmapfre\b/i, 'Mapfre Insular'],
        [/\bucpb\b/i, 'UCPB General Insurance'],
        [/\bprudential\s+guarantee\b/i, 'Prudential Guarantee'],
        [/\bphilippine\s+charter\b/i, 'Philippine Charter Insurance']
    ];
    function parseInsurer(notes) {
        // 1) labelled:  "Insurer: GSIS"
        let m = notes.match(/(?:insurer|insurance\s*company|insured\s*by|underwriter|provider)\s*[:\-]\s*(.+?)(?=\s*(?:[.;,|]\s*)?(?:policy|coverage)\b|\s*[.;|]\s|$)/i);
        if (m && m[1].trim()) return m[1].trim();
        // 2) a known insurer name anywhere in the notes
        for (const [re, name] of INSURER_KEYWORDS) { if (re.test(notes)) return name; }
        // 3) whatever sits between "BUILDING INSURED" and "Policy"/"Coverage"
        m = notes.match(/building\s+insured\W*(.*?)(?=\s*(?:policy|coverage)\b|$)/i);
        if (m) {
            const t = m[1].replace(/^[\s.,:;\-–—]+|[\s.,:;\-–—]+$/g, '');
            if (t && t.length <= 40) return t;
        }
        return '-';
    }
    function parsePolicy(notes) {
        // "Policy Id 6300563296", "Policy ID: 6300563296", "Policy No. GS-30241", "Policy # 123"
        const m = notes.match(/policy\s*(?:id|no\.?|number|#)\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]*)/i);
        return m ? m[1].trim() : '-';
    }

    // Sum Insured: read from Notes ("Sum Insured: 10,000,000"), else fall back to the Unit Value column
    function parseAmount(txt) {
        const m = String(txt || '').match(/-?\d[\d,]*(?:\.\d+)?/);
        if (!m) return null;
        const n = parseFloat(m[0].replace(/,/g, ''));
        return isNaN(n) ? null : n;
    }
    function parseSumInsured(notes, unitValue) {
        const m = notes.match(/sum\s*insured\s*[:\-]?\s*(?:php|p|\u20b1)?\s*(\d[\d,]*(?:\.\d+)?)/i);
        if (m) return parseFloat(m[1].replace(/,/g, ''));
        return parseAmount(unitValue);
    }
    const fmtPeso = n => n === null || n === undefined ? '-'
        : '\u20b1 ' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ---- 📎 POLICY COPY (stored in Google Drive, link kept in the "Policy Copy" column of the sheet) ----
    const POLICY_MAX_MB = 8;
    function policyHeader() {
        return (Array.isArray(rawHeaders) ? rawHeaders : []).find(h => /policy\s*copy/i.test(String(h))) || null;
    }
    function getPolicyCopyUrl(row) {
        const h = policyHeader();
        const v = h ? String(row[h] || '').trim() : '';
        return /[-\w]{25,}/.test(v) ? v : '';
    }
    const policyFileId = url => { const m = String(url || '').match(/[-\w]{25,}/); return m ? m[0] : ''; };
    const fileToBase64 = file => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1]);
        fr.onerror = () => rej(new Error('Could not read the selected file.'));
        fr.readAsDataURL(file);
    });

    async function uploadPolicyCopy(recordId, file, statusEl) {
        const row = inventoryData.find(x => x._rowId === recordId);
        if (!row || !file) return;
        if (file.size > POLICY_MAX_MB * 1024 * 1024) { toastAlert('File is too large. Maximum is ' + POLICY_MAX_MB + ' MB.'); return; }
        if (!(file.type === 'application/pdf' || /^image\//.test(file.type))) { toastAlert('Please choose a PDF or an image file.'); return; }
        const article = String(row[headerMapping['article/item']] || '');
        const article0 = article;
        showLoading('Uploading policy copy to Google Drive...');
        try {
            const data = await fileToBase64(file);
            const params = new URLSearchParams();
            params.append('action', 'uploadPolicyCopy');
            params.append('secret', API_SECRET);
            params.append('article', article);
            params.append('updatedby', loggedInUser || '');
            params.append('timestamp', new Date().toLocaleString());
            params.append('fileName', file.name);
            params.append('mimeType', file.type || 'application/octet-stream');
            params.append('fileData', data);
            let confirmed = false, linked = 0;
            try {
                const resp = await fetch(GOOGLE_APPS_SCRIPT_URL, { method: 'POST', body: params.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                const j = await resp.json();
                if (j && j.ok === false) throw new Error(j.error || 'Upload was rejected.');
                confirmed = !!(j && j.ok);
                linked = (j && j.linked) || 0;
            } catch (e) {
                if (e && e.message && !/fetch|network|json|unexpected/i.test(e.message)) throw e;
                // The browser couldn't read the reply, but the request was still sent.
                // Do NOT resend (it would create a duplicate file) - verify by re-reading the sheet below.
            }
            hideLoading();
showToast(linked > 0
                ? 'Policy copy uploaded and also linked to ' + linked + ' other item' + (linked === 1 ? '' : 's') + ' with the same Policy ID — syncing the sheet.'
                : 'Policy copy uploaded — syncing the sheet.', 'success');
            // Reload from the sheet (it can lag a few seconds) until the new link shows up
            let found = false;
            for (let i = 0; i < 6 && !found; i++) {
                await new Promise(r => setTimeout(r, i === 0 && confirmed ? 800 : 2500));
                await loadInventoryFromGoogleSheets(true);
                const fresh = inventoryData.find(x => String(x[headerMapping['article/item']] || '') === article0);
                found = !!(fresh && getPolicyCopyUrl(fresh));
                if (found) { render(); openDetail(fresh._rowId); }
            }
            if (!found) toastAlert('Uploaded, but the sheet has not updated yet. Reopen this record in a moment.');
        } catch (err) {
            hideLoading();
            console.error(err);
            toastAlert('Policy copy upload failed: ' + (err && err.message ? err.message : err));
        }
    }

    function details(row) {
        const notes = String(row[headerMapping['notes']] || '');
        const status = getInsuranceStatus(notes);
        if (status === 'NONE') return null;
        let end = null, days = null;
        if (status !== 'NOT_INSURED') {
            const i = notes.search(/coverage/i);
            const ds = extractDatesFromText(i >= 0 ? notes.slice(i) : notes);
            if (ds.length) {
                end = new Date(Math.max(...ds.map(d => d.getTime()))); end.setHours(0, 0, 0, 0);
                const t = new Date(); t.setHours(0, 0, 0, 0);
                days = Math.round((end - t) / 86400000);
            }
        }
        return {
            id: row._rowId, status, end, days, notes,
            insurer: (function () { const p = parseInsurer(notes); return p !== '-' ? p : (status === 'NOT_INSURED' ? '-' : DEFAULT_INSURER); })(),
            policy: parsePolicy(notes),
            sumInsured: parseSumInsured(notes, row[headerMapping['unit value']]),
            policyUrl: getPolicyCopyUrl(row),
            article: String(row[headerMapping['article/item']] || ''),
            description: String(row[headerMapping['description']] || '')
        };
    }
    const timeLeft = r => r.days === null ? '-' : r.days < 0 ? Math.abs(r.days) + ' days overdue' : r.days + ' days remaining';

    function render() {
        if (!$('insKpis') || !Array.isArray(inventoryData) || !inventoryData.length) return;
        records = inventoryData.map(details).filter(Boolean);
        const c = { INSURED: 0, EXPIRING: 0, EXPIRED: 0, NOT_INSURED: 0 };
        records.forEach(r => { c[r.status]++; });
        const total = records.length || 1;

        const alerts = c.EXPIRING + c.EXPIRED;
        $('insTabBadge').textContent = alerts > 0 ? alerts : '';
        $('insTabBadge').classList.toggle('has-expired', c.EXPIRED > 0);

        $('insKpis').innerHTML = Object.keys(LABEL).map((k, i) =>
            `<div class="ins-cell" style="--i:${i}"><button class="ins-kpi ${k === 'EXPIRING' && c[k] ? 'alert' : ''} ${k === 'EXPIRED' && c[k] ? 'alert-red' : ''} ${statusFilter === k ? 'on' : ''}" data-s="${k}" style="--c:${COLOR[k]}">
                <div class="t">${k === 'EXPIRED' && c[k] ? '<span class="ins-bell">🔔</span> ' : ''}${LABEL[k]}</div><div class="v" data-n="${c[k]}">${c[k]}</div><div class="h">${HINT[k]}</div></button></div>`).join('');
        if (playing) $('insKpis').querySelectorAll('.v').forEach(el => countUp(el, Number(el.dataset.n)));
        $('insKpis').querySelectorAll('.ins-kpi').forEach(b => b.onclick = () => {
            statusFilter = statusFilter === b.dataset.s ? 'ALL' : b.dataset.s;
            $('insStatus').value = statusFilter; render();
        });
        $('insBar').innerHTML = Object.keys(LABEL).map(k => `<i style="width:${c[k] / total * 100}%;background:${COLOR[k]}" title="${LABEL[k]}: ${c[k]}"></i>`).join('');
        $('insLegend').innerHTML = Object.keys(LABEL).map(k => `<span><b style="background:${COLOR[k]}"></b>${LABEL[k]} (${c[k]})</span>`).join('');
        $('insHealthPct').textContent = Math.round(c.INSURED / total * 100) + '% fully covered';

        const q = ($('insSearch').value || '').trim().toLowerCase();
        const rows = records.filter(r => (statusFilter === 'ALL' || r.status === statusFilter) &&
            (!q || [r.article, r.description, r.insurer, r.policy, r.notes].join(' ').toLowerCase().includes(q)));
        const val = r => sortKey === 'days' ? (r.days === null ? 1e9 : r.days)
                       : sortKey === 'end' ? (r.end ? r.end.getTime() : 1e15)
                       : String(r[sortKey] || '').toLowerCase();
        rows.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * sortDir; });

        insFilteredRows = rows; // remembered for "Export Searched"
        $('insCount').textContent = rows.length + ' of ' + records.length;
        $('insBody').innerHTML = rows.length ? rows.map((r, ri) => {
            const cls = r.days === null ? '' : r.days < 0 ? 'neg' : r.days <= INSURANCE_EXPIRING_DAYS ? 'warn' : '';
            const dtxt = r.days === null ? '-' : r.days < 0 ? Math.abs(r.days) + ' days overdue' : r.days + ' days';
            return `<tr data-id="${r.id}" style="--r:${Math.min(ri, 14)}"><td>${escapeHtml(r.article)}</td><td>${escapeHtml(r.description)}</td>
                <td><span class="ins-badge ins-b-${r.status}">${LABEL[r.status]}</span></td><td>${escapeHtml(r.insurer)}</td>
                <td>${r.end ? fmtDate(r.end) : '-'}</td><td class="ins-days ${cls}">${dtxt}</td><td>${escapeHtml(r.notes)}</td></tr>`;
        }).join('') : '<tr><td colspan="7" class="no-data">No insurance records match the current filters.</td></tr>';
        $('insBody').querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => openDetail(Number(tr.dataset.id)));
    }

    // Opens the policy copy in a new tab, scaled to fit the whole tab (same look as the
    // inventory tab's "Download Photo"). If the file isn't an image (e.g. a PDF), the tab
    // falls back to the Drive viewer.
    function openPolicyCopyTab(url) {
        const fid = policyFileId(url);
        if (!fid) return;
        const imgUrl = getDirectImageUrl(url, 'view') || ('https://lh3.googleusercontent.com/d/' + fid);
        const viewUrl = 'https://drive.google.com/file/d/' + fid + '/preview';
        const tab = window.open('', '_blank');
        if (!tab) { window.open(viewUrl, '_blank'); return; }
        tab.document.write(
            '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
            '<title>Policy Copy</title>' +
            '<style>html,body{margin:0;width:100%;height:100%;background:#0b1424;overflow:hidden;}' +
            'body{display:flex;align-items:center;justify-content:center;}' +
            'img{max-width:100vw;max-height:100vh;width:auto;height:auto;object-fit:contain;display:block;}</style></head><body>' +
            '<img src="' + escapeHtml(imgUrl) + '" alt="Policy Copy" onerror="location.replace(\'' + viewUrl + '\')">' +
            '</body></html>'
        );
        tab.document.close();
    }

    // Right-hand viewer panel: same dark panel + pill Download button as Property Details
    function policyViewerHTML(r) {
        const fid = policyFileId(r.policyUrl);
        if (!fid) {
            return '<div style="color:#94a3b8;font-style:italic;display:flex;height:100%;align-items:center;justify-content:center;text-align:center;">No policy copy uploaded yet for this record.</div>';
        }
        return `<div class="modal-photo-container">
                <div class="photo-actions-container">
                    <button type="button" class="photo-action-btn" id="insPolicyDownloadBtn">Download Policy Copy</button>
                </div>
                <img id="insPolicyImg" alt="Policy Copy" src="${escapeHtml(getDirectImageUrl(r.policyUrl, 'view') || ('https://lh3.googleusercontent.com/d/' + fid))}">
            </div>
            <div class="photo-caption">Policy Copy</div>`;
    }

    // ---- Insurance details window — same format as the inventory tab's "Property Details" ----
    function openDetail(id) {
        const r = records.find(x => x.id === id);
        if (!r) return;
        const fid = policyFileId(r.policyUrl);
        const field = (label, value, kind, rows) => {
            const v = escapeHtml(value == null ? '' : String(value));
            const inp = kind === 'area'
                ? `<textarea rows="${rows || 3}" disabled>${v}</textarea>`
                : `<input type="text" value="${v}" disabled>`;
            return `<div class="modal-field"><label>${escapeHtml(label)}</label>${inp}</div>`;
        };
        const box = $('insDetail');
        box.classList.add('ins-detail-wide');
        box.innerHTML = `
            <button type="button" class="close-x-btn" id="insDetailX">&times;</button>
            <div class="modal-header">Insurance Details</div>
            <div class="modal-flex-layout">
                <div class="modal-fields-side">
                    ${field('Article no./ TCT no.', r.article)}
                    ${field('Description', r.description, 'area', 7)}
                    ${field('Status', LABEL[r.status])}
                    ${field('Insurer', r.insurer)}
                    ${field('Policy ID', r.policy)}
                    ${field('Sum Insured', fmtPeso(r.sumInsured))}
                    ${field('Coverage End', r.end ? fmtDate(r.end) : '-')}
                    ${field('Time Left', timeLeft(r))}
                    ${field('Notes', r.notes, 'area', 3)}
                </div>
                <div class="modal-photo-side" id="insPolicySide">${policyViewerHTML(r)}</div>
            </div>
            <div class="modal-actions">
                <input type="file" id="insPolicyFile" accept="application/pdf,image/*" style="display:none;">
                <button type="button" class="modal-btn btn-upload" id="insPolicyUploadBtn" style="display:inline-block;">${fid ? 'Replace Policy Copy' : 'Upload Policy Copy'}</button>
                <button type="button" class="modal-btn btn-edit" id="insOpenRecord">Open Property Record</button>
                <button type="button" class="modal-btn btn-close" id="insDetailClose">Close</button>
            </div>`;
        $('insDetailClose').onclick = closeDetail;
        $('insDetailX').onclick = closeDetail;
        const pcDl = $('insPolicyDownloadBtn');
        if (pcDl) pcDl.onclick = () => openPolicyCopyTab(r.policyUrl);
        // Photos show as an image (same method as the inventory tab). If the file can't be
        // shown as an image (e.g. a PDF), fall back to the Drive viewer.
        const pcImg = $('insPolicyImg');
        if (pcImg) pcImg.onerror = () => {
            const fr = document.createElement('iframe');
            fr.src = 'https://drive.google.com/file/d/' + fid + '/preview';
            fr.title = 'Policy Copy';
            fr.style.cssText = 'width:100%;height:100%;min-height:470px;border:0;border-radius:8px;background:#0b1424;margin-top:34px;';
            pcImg.replaceWith(fr);
        };
        const pcBtn = $('insPolicyUploadBtn'), pcInput = $('insPolicyFile');
        pcBtn.onclick = () => pcInput.click();
        pcInput.onchange = () => { const f = pcInput.files && pcInput.files[0]; if (f) uploadPolicyCopy(r.id, f); pcInput.value = ''; };
        $('insOpenRecord').onclick = () => { closeDetail(); openPopUp(id); };
        $('insDetailOverlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        // Size the Description / Notes boxes to fit all their text (no inner scrollbar).
        // Must run after the window is visible, otherwise scrollHeight is 0.
        fitInsTextareas();
        requestAnimationFrame(fitInsTextareas);
        setTimeout(fitInsTextareas, 150);
    }
    function fitInsTextareas() {
        const root = $('insDetail');
        if (!root) return;
        root.querySelectorAll('.modal-field textarea').forEach(t => {
            t.rows = 1;                       // drop the fixed row count, otherwise it acts as a minimum height
            t.style.overflow = 'hidden';
            t.style.resize = 'none';
            t.style.minHeight = '0';
            t.style.height = '0px';           // collapse first so scrollHeight = real text height
            const cs = getComputedStyle(t);
            const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
            const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
            const h = t.scrollHeight;         // text + padding
            t.style.height = (cs.boxSizing === 'border-box' ? h + border : h - pad) + 'px';
        });
    }
    window.addEventListener('resize', () => {
        const ov = $('insDetailOverlay');
        if (ov && ov.style.display === 'flex') fitInsTextareas();
    });
    function closeDetail() {
        animateOut($('insDetailOverlay'), () => {
            $('insDetailOverlay').style.display = 'none';
            // Don't unlock page scroll if the property popup was just opened from this window
            if (!editModal || editModal.style.display !== 'flex') document.body.style.overflow = '';
        });
    }

    async function exportInsuranceHTML() {
        const data = insFilteredRows;
        if (!data || data.length === 0) {
            toastAlert("Export Nullified: No dataset active for export.");
            return;
        }
        const BADGE = { INSURED: ['#dcfce7', '#166534'], EXPIRING: ['#fef3c7', '#92400e'], EXPIRED: ['#fee2e2', '#991b1b'], NOT_INSURED: ['#e2e8f0', '#334155'] };
        const cols = ['No.', 'Article no./ TCT no.', 'Description', 'Status', 'Insurer', 'Coverage End', 'Days Left', 'Notes'];
        const rowsHTML = data.map((r, idx) => {
            const dtxt = r.days === null ? '-' : r.days < 0 ? Math.abs(r.days) + ' days overdue' : r.days + ' days';
            const dcolor = r.days === null ? '#0f172a' : r.days < 0 ? '#dc2626' : r.days <= INSURANCE_EXPIRING_DAYS ? '#b45309' : '#0f172a';
            const b = BADGE[r.status] || BADGE.NOT_INSURED;
            return '<tr>' +
                '<td class="col-no">' + (idx + 1) + '</td>' +
                '<td>' + escapeHtml(r.article) + '</td>' +
                '<td>' + escapeHtml(r.description) + '</td>' +
                '<td><span style="background:' + b[0] + ';color:' + b[1] + ';padding:3px 10px;border-radius:999px;font-weight:bold;font-size:12px;white-space:nowrap;">' + escapeHtml(LABEL[r.status]) + '</span></td>' +
                '<td>' + escapeHtml(r.insurer) + '</td>' +
                '<td style="white-space:nowrap;">' + (r.end ? escapeHtml(fmtDate(r.end)) : '-') + '</td>' +
                '<td style="white-space:nowrap;font-weight:bold;color:' + dcolor + ';">' + escapeHtml(dtxt) + '</td>' +
                '<td>' + escapeHtml(r.notes) + '</td></tr>';
        }).join('');

        const statusSel = $('insStatus') ? $('insStatus').value : 'ALL';
        const q = ($('insSearch').value || '').trim();
        const filterNote = [
            statusSel !== 'ALL' ? 'Status: ' + (LABEL[statusSel] || statusSel) : '',
            q ? 'Search: "' + q + '"' : ''
        ].filter(Boolean).join(' &bull; ');

        const headerHTML = await exportBuildHeader(
            'Insurance Register Report',
            `Exported On: ${new Date().toLocaleString()} &bull; Total Records: ${data.length}${filterNote ? '<br>' + filterNote : ''}`
        );

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Searched Insurance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        h1 { text-align: center; color: #0f172a; text-transform: uppercase; font-size: 24px; margin-bottom: 5px; }
        .report-meta { text-align: center; font-size: 14px; color: #334155; margin-bottom: 25px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; background: white; }
        th, td { border: 1px solid #64748b; padding: 10px 12px; text-align: left; font-size: 14px; line-height: 1.4; word-break: break-word; color: #0f172a; vertical-align: middle; }
        th { background-color: #cbd5e1 !important; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
        tr:nth-child(even) { background-color: #f8fafc; }
${EXPORT_HEADER_CSS}
        @media print { body { margin: 10px; } tr { page-break-inside: avoid; } th { background-color: #cbd5e1 !important; } }
    </style>
</head>
<body>
    ${headerHTML}
    <table>
        <thead><tr>${cols.map(c => c === 'No.' ? '<th class="col-no">No.</th>' : '<th>' + c + '</th>').join('')}</tr></thead>
        <tbody>${rowsHTML}</tbody>
    </table>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Searched_Insurance_Report_${new Date().toISOString().slice(0, 10)}.html`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        showToast('Insurance report exported — check your downloads folder.', 'success');
    }

    function switchTab(tab) {
        const ins = tab === 'insurance';
        const showEl = ins ? $('insuranceView') : $('inventoryView');
        $('inventoryView').style.display = ins ? 'none' : '';
        $('insuranceView').style.display = ins ? 'block' : 'none';
        $('tabInventory').classList.toggle('active', !ins);
        $('tabInsurance').classList.toggle('active', ins);
        showEl.classList.remove('view-enter'); void showEl.offsetWidth; showEl.classList.add('view-enter');
        if (ins) { if (paginationContainer) paginationContainer.style.display = 'none'; playEntrance(); render(); }
        else { updatePaginationUI(Math.ceil(currentFilteredData.length / itemsPerPage)); playInventory(); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ================= INVENTORY TAB MOTION =================
    function invNumbers() {
        document.querySelectorAll('#inventoryView .dash-card .dash-value, #inventoryView .type-card .dash-value').forEach(el => {
            const n = parseInt(String(el.textContent).replace(/,/g, ''), 10);
            if (!isNaN(n)) countUp(el, n);
        });
    }
    let invTimer = null;
    function playInventory() {
        const v = $('inventoryView');
        if (!v) return;
        v.classList.remove('inv-play'); void v.offsetWidth; v.classList.add('inv-play');
        invNumbers();
        clearTimeout(invTimer);
        invTimer = setTimeout(() => v.classList.remove('inv-play'), 2400);
    }
    function invAlerts() {
        const toNum = el => el ? (parseInt(String(el.textContent).replace(/,/g, ''), 10) || 0) : 0;
        const nf = document.getElementById('countNotFound'), fv = document.getElementById('countVerification');
        if (nf && nf.closest('.dash-card')) nf.closest('.dash-card').classList.toggle('inv-alert-red', toNum(nf) > 0);
        if (fv && fv.closest('.dash-card')) fv.closest('.dash-card').classList.toggle('inv-alert-amber', toNum(fv) > 0);
    }
    function invIndexCards() {
        document.querySelectorAll('#inventoryView .dashboard-row .dash-card').forEach((el, i) => el.style.setProperty('--i', i));
        document.querySelectorAll('#inventoryView .type-card').forEach((el, i) => el.style.setProperty('--i', i));
    }

    // Replay the entrance whenever fresh totals are calculated (login / data reload)
    const baseTotals = calculateStaticDashboardTotals;
    calculateStaticDashboardTotals = function (items) {
        baseTotals(items);
        invIndexCards(); invAlerts();
        if ($('inventoryView') && $('inventoryView').style.display !== 'none') playInventory();
    };
    // Stagger the table rows every time the table is rebuilt (search, filter, paging)
    const baseRenderTable = renderTable;
    renderTable = function (data, page) {
        baseRenderTable(data, page);
        document.querySelectorAll('#tableBody tr').forEach((tr, i) => tr.style.setProperty('--r', Math.min(i, 14)));
    };

    function init() {
        if (!$('tabInsurance')) return;
        invIndexCards();
        $('tabInventory').onclick = () => switchTab('inventory');
        $('tabInsurance').onclick = () => switchTab('insurance');
        $('insSearch').oninput = render;
        $('insStatus').onchange = () => { statusFilter = $('insStatus').value; render(); };
        $('insReset').onclick = () => { statusFilter = 'ALL'; $('insSearch').value = ''; $('insStatus').value = 'ALL'; render(); };
        document.querySelectorAll('#insTable th[data-k]').forEach(th => th.onclick = () => {
            sortDir = sortKey === th.dataset.k ? -sortDir : 1; sortKey = th.dataset.k; render();
        });
        // Export Searched: HTML report with exactly the columns/rows shown in the
        // Insurance Register table (after search + status filters). No photos.
        $('insExportButton').onclick = exportInsuranceHTML;
        $('insDetailOverlay').addEventListener('mousedown', e => { if (e.target === $('insDetailOverlay')) closeDetail(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && $('insDetailOverlay').style.display === 'flex') closeDetail();
        });
    }

    // Keep the tab live whenever the app refreshes (data load, focus, midnight rollover)
    const baseRefresh = refreshInsuranceCards;
    refreshInsuranceCards = function () { baseRefresh(); render(); };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();


// =========================================================================
// 🔒 HIDE FLOATING BUTTONS WHEN LOGGED OUT / ON LOGIN SCREEN
// Toggles a body class (see .app-locked in index.html). Does not modify any
// existing function.
// =========================================================================
(function () {
    function syncLockState() {
        const mainApp = document.getElementById('mainApp');
        const appVisible = mainApp && mainApp.style.display !== 'none';
        document.body.classList.toggle('app-locked', !(accessToken && appVisible));
    }
    window.addEventListener('DOMContentLoaded', () => {
        syncLockState();
        const mainApp = document.getElementById('mainApp');
        if (mainApp) new MutationObserver(syncLockState).observe(mainApp, { attributes: true, attributeFilter: ['style'] });
        setInterval(syncLockState, 250);
    });
})();


// =========================================================================
// ✨ UX POLISH LAYER
// Toasts, skeleton loading, sliding tab indicator, animated modal close,
// clearable search boxes, active-filter chips, empty states, table fades.
// =========================================================================
function uxReduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// ---------- Toast notifications (replace alert boxes) ----------
const UX_TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.4v.1"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.4v.1"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5M12 7.6v.1"/></svg>'
};

function removeToast(t, instant) {
    if (!t || t._gone) return;
    t._gone = true;
    clearTimeout(t._timer);
    if (instant || uxReduced()) { t.remove(); return; }
    t.classList.add('out');
    setTimeout(() => t.remove(), 220);
}

function showToast(message, type, duration) {
    type = UX_TOAST_ICONS[type] ? type : 'info';
    duration = duration || (type === 'error' || type === 'warning' ? 7000 : 4200);
    let host = document.getElementById('toastHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'toastHost';
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
    }
    while (host.children.length >= 4) removeToast(host.firstElementChild, true);

    const t = document.createElement('div');
    t.className = 'ux-toast ux-toast-' + type;
    t.style.setProperty('--dur', duration + 'ms');
    t.innerHTML = '<span class="ux-toast-ic">' + UX_TOAST_ICONS[type] + '</span><div class="ux-toast-msg"></div>' +
                  '<button type="button" class="ux-toast-x" aria-label="Dismiss">&times;</button><i class="ux-toast-bar"></i>';
    t.querySelector('.ux-toast-msg').textContent = String(message);
    t.querySelector('.ux-toast-x').addEventListener('click', () => removeToast(t));

    let remaining = duration, startedAt = Date.now();
    const start = () => { startedAt = Date.now(); t.classList.remove('paused'); t._timer = setTimeout(() => removeToast(t), remaining); };
    const pause = () => { clearTimeout(t._timer); remaining -= Date.now() - startedAt; t.classList.add('paused'); };
    t.addEventListener('mouseenter', pause);
    t.addEventListener('mouseleave', start);
    host.appendChild(t);
    start();
    return t;
}

// Drop-in replacement for alert(): picks a sensible toast type and duration
function toastAlert(msg) {
    const m = String(msg == null ? '' : msg);
    const type = /could not be downloaded|log in again|session/i.test(m) ? 'warning' : 'error';
    showToast(m, type, Math.min(14000, 4000 + m.length * 45));
}

// ---------- Animated close for modals ----------
function animateOut(el, done, ms) {
    ms = ms || 170;
    if (!el || el.style.display === 'none' || getComputedStyle(el).display === 'none' || uxReduced()) { done(); return; }
    if (el._closing) return;
    el._closing = true;
    el.classList.add('is-closing');
    setTimeout(() => { el.classList.remove('is-closing'); el._closing = false; done(); }, ms);
}

(function () {
    const $ = id => document.getElementById(id);
    const ease = 'cubic-bezier(.16,1,.3,1)';

    // ---------- 1. Skeleton loading + soft sync indicator ----------
    const baseShowLoading = showLoading, baseHideLoading = hideLoading;

    function skRows(cols, rows) {
        let html = '';
        for (let i = 0; i < rows; i++) {
            html += '<tr class="sk-row">';
            for (let j = 0; j < cols; j++) html += '<td><span class="sk-line" style="width:' + (38 + ((i * 37 + j * 53) % 52)) + '%"></span></td>';
            html += '</tr>';
        }
        return html;
    }
    function skeletonize(tb, cols, rows) {
        if (!tb) return;
        if (!tb.querySelector('.sk-row')) tb.__skPrev = tb.innerHTML;
        tb.innerHTML = skRows(cols, rows);
    }
    function ensureSyncUI() {
        if (!$('uxProgress')) {
            const bar = document.createElement('div'); bar.id = 'uxProgress'; bar.setAttribute('aria-hidden', 'true');
            document.body.appendChild(bar);
            const pill = document.createElement('div'); pill.id = 'uxSyncPill'; pill.setAttribute('role', 'status');
            pill.innerHTML = '<span class="ux-spinner"></span><span id="uxSyncText"></span>';
            document.body.appendChild(pill);
        }
    }
    function startSoftSync(msg) {
        ensureSyncUI();
        const initial = !isAppInitialized;
        document.body.classList.add('is-syncing');
        if (initial) document.body.classList.add('is-initial-load');
        $('uxSyncText').textContent = msg || 'Syncing…';
        $('uxProgress').classList.add('on');
        $('uxSyncPill').classList.add('on');
        if (initial) {
            skeletonize($('tableBody'), displayHeaders.length, 7);
            skeletonize($('insBody'), 7, 5);
        }
    }
    function endSoftSync() {
        document.body.classList.remove('is-syncing', 'is-initial-load');
        if ($('uxProgress')) { $('uxProgress').classList.remove('on'); $('uxSyncPill').classList.remove('on'); }
        ['tableBody', 'insBody'].forEach(id => {
            const tb = $(id);
            if (tb && tb.querySelector('.sk-row')) { tb.innerHTML = tb.__skPrev || ''; tb.__skPrev = null; }
        });
    }
    showLoading = function (msg) {
        if (/^\s*(syncing|connecting)/i.test(msg || '')) { startSoftSync(msg); return; }
        baseShowLoading(msg);
    };
    hideLoading = function () { endSoftSync(); baseHideLoading(); };

    // ---------- 4. Sliding tab indicator ----------
    function placeIndicator(first) {
        const tabs = document.querySelector('.app-tabs'), ind = $('tabIndicator');
        const act = document.querySelector('.app-tab.active');
        if (!tabs || !ind || !act || !act.offsetWidth) return;
        ind.style.width = act.offsetWidth + 'px';
        ind.style.transform = 'translateX(' + act.offsetLeft + 'px)';
        tabs.classList.add('has-indicator');
        if (first) requestAnimationFrame(() => requestAnimationFrame(() => ind.classList.add('ready')));
    }
    function initTabIndicator() {
        const tabs = document.querySelector('.app-tabs');
        if (!tabs) return;
        placeIndicator(true);
        document.querySelectorAll('.app-tab').forEach(t => new MutationObserver(() => placeIndicator(false)).observe(t, { attributes: true, attributeFilter: ['class'] }));
        if (window.ResizeObserver) new ResizeObserver(() => placeIndicator(false)).observe(tabs);
        window.addEventListener('resize', () => placeIndicator(false));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeIndicator(false));
    }

    // ---------- 8. Clearable search inputs + busy export buttons ----------
    function makeClearable(input, onClear) {
        if (!input || input.closest('.clearable')) return;
        const wrap = document.createElement('span');
        wrap.className = 'clearable';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'clear-x'; b.setAttribute('aria-label', 'Clear search'); b.innerHTML = '&times;';
        wrap.appendChild(b);
        const sync = () => wrap.classList.toggle('has-value', !!input.value);
        input.addEventListener('input', sync);
        b.addEventListener('click', () => { input.value = ''; sync(); input.focus(); onClear(); });
        wrap._sync = sync; sync();
    }
    function initBusyButtons() {
        document.addEventListener('click', e => {
            const b = e.target.closest && e.target.closest('#exportButton, #exportFilteredButton, #insExportButton');
            if (!b) return;
            b.classList.add('btn-busy');
            setTimeout(() => b.classList.remove('btn-busy'), 900);
        }, true);
        setInterval(() => document.querySelectorAll('.clearable').forEach(w => w._sync && w._sync()), 300);
    }

    // ---------- 9. Active-filter chips ----------
    function selText(sel) { const o = sel.options[sel.selectedIndex]; return o ? o.textContent.trim() : sel.value; }
    function renderChips(host, list, onClearAll) {
        if (!host) return;
        const sig = list.map(c => c.key + '|' + c.label).join('~');
        if (host.__sig === sig) return;
        const prev = host.__keys || new Set();
        host.__sig = sig; host.__keys = new Set(list.map(c => c.key));
        host.innerHTML = '';
        host.classList.toggle('has-chips', list.length > 0);
        list.forEach(c => {
            const el = document.createElement('span');
            el.className = 'chip' + (prev.has(c.key) ? '' : ' chip-new');
            const txt = document.createElement('span'); txt.className = 'chip-txt'; txt.textContent = c.label; txt.title = c.label;
            const x = document.createElement('button'); x.type = 'button'; x.innerHTML = '&times;';
            x.setAttribute('aria-label', 'Remove filter: ' + c.label);
            x.addEventListener('click', c.clear);
            el.appendChild(txt); el.appendChild(x); host.appendChild(el);
        });
        if (list.length > 1) {
            const a = document.createElement('button'); a.type = 'button'; a.className = 'chip-clear-all'; a.textContent = 'Clear all';
            a.addEventListener('click', onClearAll); host.appendChild(a);
        }
    }

    // Inventory chips
    const INV_INS_LABEL = { INSURED: 'Insured', NOT_INSURED: 'Not insured', EXPIRING: 'Expiring soon' };
    const INV_UNID_LABEL = { ID_BUILDING: 'Buildings with Tax Dec / TCT', ID_LAND: 'Lands with Tax Dec / TCT' };
    function invNothingLeft() {
        return !(searchInput && searchInput.value.trim()) && (!remarksFilter || remarksFilter.value === 'ALL') &&
               (!typeFilter || typeFilter.value === 'ALL') && (!photoFilter || photoFilter.value === 'ALL') &&
               activeInsuranceFilter === 'ALL' && activeUnidFilter === 'ALL';
    }
    function invFinishClear() {
        if (invNothingLeft() && resetFiltersButton) resetFiltersButton.click(); else executeSearch(true);
    }
    function invChipList() {
        const l = [];
        const q = searchInput ? searchInput.value.trim() : '';
        if (q) l.push({ key: 'q', label: 'Search: “' + q + '”', clear: () => { searchInput.value = ''; invFinishClear(); } });
        if (remarksFilter && remarksFilter.value !== 'ALL') l.push({ key: 'rem', label: 'Remarks: ' + selText(remarksFilter), clear: () => { remarksFilter.value = 'ALL'; invFinishClear(); } });
        if (typeFilter && typeFilter.value !== 'ALL') l.push({ key: 'type', label: 'Type: ' + selText(typeFilter), clear: () => { typeFilter.value = 'ALL'; activeUnidFilter = 'ALL'; invFinishClear(); } });
        if (activeUnidFilter in INV_UNID_LABEL) l.push({ key: 'unid', label: INV_UNID_LABEL[activeUnidFilter], clear: () => { activeUnidFilter = 'ALL'; invFinishClear(); } });
        if (photoFilter && photoFilter.value !== 'ALL') l.push({ key: 'media', label: 'Media: ' + selText(photoFilter), clear: () => { photoFilter.value = 'ALL'; invFinishClear(); } });
        if (activeInsuranceFilter !== 'ALL') l.push({ key: 'ins', label: 'Insurance: ' + (INV_INS_LABEL[activeInsuranceFilter] || activeInsuranceFilter), clear: () => {
            activeInsuranceFilter = 'ALL';
            document.querySelectorAll('.ins-card').forEach(c => { c.style.transform = 'scale(1)'; c.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; c.style.backgroundColor = '#f8f9fa'; });
            const cb = $('clearInsFilterBtn'); if (cb) cb.style.display = 'none';
            invFinishClear();
        } });
        return l;
    }
    function updateInvChips() {
        renderChips($('invChips'), invChipList(), () => { if (resetFiltersButton) resetFiltersButton.click(); });
    }
    const baseExecuteSearch = executeSearch;
    executeSearch = function () {
        const out = baseExecuteSearch.apply(this, arguments);
        updateInvChips();
        return out;
    };

    // Insurance chips
    function updateInsChips() {
        const host = $('insChips'); if (!host) return;
        const l = [];
        const q = $('insSearch') ? $('insSearch').value.trim() : '';
        if (q) l.push({ key: 'q', label: 'Search: “' + q + '”', clear: () => { $('insSearch').value = ''; $('insSearch').dispatchEvent(new Event('input')); } });
        if ($('insStatus') && $('insStatus').value !== 'ALL') l.push({ key: 'st', label: 'Status: ' + selText($('insStatus')), clear: () => { $('insStatus').value = 'ALL'; $('insStatus').dispatchEvent(new Event('change')); } });
        renderChips(host, l, () => $('insReset').click());
    }

    // ---------- 10. Empty states ----------
    const ES_BASE = '<rect x="14" y="10" width="64" height="76" rx="8" fill="#eaf3fb" stroke="#bcd6ee" stroke-width="2"/><rect x="26" y="26" width="30" height="5" rx="2.5" fill="#bcd6ee"/><rect x="26" y="40" width="42" height="5" rx="2.5" fill="#d3e5f5"/><rect x="26" y="54" width="36" height="5" rx="2.5" fill="#d3e5f5"/><circle cx="82" cy="58" r="20" fill="#fff" stroke="#2b83cf" stroke-width="5"/><path d="M97 73l14 14" stroke="#2b83cf" stroke-width="6" stroke-linecap="round"/>';
    const ES_NONE  = '<svg viewBox="0 0 120 96" fill="none" aria-hidden="true">' + ES_BASE + '<path d="M75 51l14 14M89 51L75 65" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/></svg>';
    const ES_READY = '<svg viewBox="0 0 120 96" fill="none" aria-hidden="true">' + ES_BASE + '<circle cx="74" cy="58" r="2.6" fill="#94a3b8"/><circle cx="82" cy="58" r="2.6" fill="#94a3b8"/><circle cx="90" cy="58" r="2.6" fill="#94a3b8"/></svg>';
    function emptyHTML(icon, title, sub, buttons) {
        return '<div class="empty-state">' + icon + '<div class="es-title">' + title + '</div><div class="es-sub">' + sub + '</div>' +
               (buttons ? '<div class="es-actions">' + buttons + '</div>' : '') + '</div>';
    }
    function enhanceEmpty(tb, kind) {
        const td = tb.querySelector('td.no-data:not([data-ux])');
        if (!td) return;
        const txt = td.textContent || '';
        if (/no (insurance )?records match/i.test(txt)) {
            td.dataset.ux = '1';
            td.innerHTML = emptyHTML(ES_NONE, 'No matching records', 'Nothing fits the current search or filters. Try different keywords, or clear the filters to start over.',
                '<button type="button" class="es-btn" data-es="clear">Clear filters</button>');
            td.querySelector('[data-es="clear"]').addEventListener('click', () => { (kind === 'ins' ? $('insReset') : resetFiltersButton).click(); });
        } else if (/data loaded successfully/i.test(txt)) {
            td.dataset.ux = '1';
            td.innerHTML = emptyHTML(ES_READY, 'Ready when you are', 'Search above, pick a filter, or click a dashboard card to view records.',
                '<button type="button" class="es-btn secondary" data-es="all">Show all records</button>');
            td.querySelector('[data-es="all"]').addEventListener('click', () => executeSearch(true));
        }
    }

    // ---------- 5. Table fade on rebuild + count-pill pulse ----------
    function watchTables() {
        [['tableBody', 'inv'], ['insBody', 'ins']].forEach(([id, kind]) => {
            const tb = $(id); if (!tb) return;
            let raf = 0;
            new MutationObserver(() => {
                enhanceEmpty(tb, kind);
                if (kind === 'ins') updateInsChips();
                if (tb.querySelector('.sk-row') || uxReduced() || !tb.animate) return;
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => tb.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 220, easing: ease }));
            }).observe(tb, { childList: true });
        });
        ['foundCountDisplay', 'insCount'].forEach(id => {
            const el = $(id); if (!el || !el.animate) return;
            if (id === 'foundCountDisplay') el.style.display = 'inline-block';
            new MutationObserver(() => { if (!uxReduced()) el.animate([{ transform: 'scale(.92)', opacity: .4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: ease }); })
                .observe(el, { childList: true, characterData: true, subtree: true });
        });
    }

    // ---------- Success toasts for exports ----------
    const baseCSV = downloadDatasetCSV;
    downloadDatasetCSV = function (data, prefix) {
        const ok = data && data.length;
        const r = baseCSV.apply(this, arguments);
        if (ok) showToast('Export ready — the full inventory CSV was downloaded.', 'success');
        return r;
    };
    const baseHTMLExport = downloadSearchedHTML;
    downloadSearchedHTML = async function (data) {
        const ok = data && data.length;
        const r = await baseHTMLExport.apply(this, arguments);
        if (ok) showToast('Report exported — check your downloads folder.', 'success');
        return r;
    };

    // ---------- Init ----------
    function init() {
        initTabIndicator();
        initBusyButtons();
        makeClearable($('searchInput'), invFinishClear);
        makeClearable($('insSearch'), () => { $('insSearch').dispatchEvent(new Event('input')); });
        watchTables();
        if ($('resetFiltersButton')) $('resetFiltersButton').addEventListener('click', () => setTimeout(updateInvChips, 0));
        if ($('insSearch')) $('insSearch').addEventListener('input', updateInsChips);
        if ($('insStatus')) $('insStatus').addEventListener('change', updateInsChips);
        if ($('insReset')) $('insReset').addEventListener('click', () => setTimeout(updateInsChips, 0));
        updateInvChips(); updateInsChips();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
