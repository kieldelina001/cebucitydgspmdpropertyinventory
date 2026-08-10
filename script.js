// 🔑 Google Sheets Cloud Gateway Architecture
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

// =========================================================================
// 🛠️ MANUAL EXPORT TABLE ADJUSTMENT CONFIGURATION
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
    { display: "Transfer Certificate of Title Page 2", key: "transfer_cert2" }
];

// =========================================================================
// DISPLAY / SHEET HEADER CONFIGURATION
// =========================================================================
const displayHeaders = [
    "Article no./ TCT no.",
    "Description",
    "Acquisition Date",
    "Unit Value",
    "Remarks",
    "Type",
    "Photo 1",
    "Photo 2",
    "Map Coordinates",
    "Tax Declaration",
    "Transfer Certificate of Title Page 1",
    "Transfer Certificate of Title Page 2",
    "UPDATED BY",
    "LAST UPDATE"
];

const targetHeadersLowercase = [
    "article/item",
    "description",
    "acquisition date",
    "unit value",
    "remarks",
    "type",
    "photo 1",
    "photo 2",
    "map coordinates",
    "tax declaration",
    "transfer_cert1",
    "transfer_cert2",
    "updated by",
    "last update"
];

const popupOrderLowercase = [
    "article/item",
    "description",
    "acquisition date",
    "unit value",
    "remarks",
    "type"
];

// =========================================================================
// GLOBAL VARIABLES
// =========================================================================
let inventoryData = [];
let currentFilteredData = [];
let rawHeaders = [];
let headerMapping = {};
let activeEditIndex = null;
let parsedUniqueRemarks = [];
let isAppInitialized = false;
let modalModified = false;

// Preserve page position when modal/upload/edit is used
let modalOpenedScrollY = 0;
let modalActionTaken = false;

// Modal Photo Gallery State
let modalPhotos = [];
let currentPhotoIndex = 0;

// Pagination
let currentPage = 1;
const itemsPerPage = 50;

// Prevent duplicate event handlers
let systemHandlersBound = false;

// =========================================================================
// DOM ELEMENTS
// =========================================================================
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

// Dashboard
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

// Modal
const editModal = document.getElementById('editModal');
const modalFormContainer = document.getElementById('modalFormContainer');
const modalEditBtn = document.getElementById('modalEditBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCloseX = document.getElementById('modalCloseX');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');

// Tooltip
const tooltip = document.getElementById('imagePreviewTooltip');
const tooltipImg = document.getElementById('imagePreviewTooltipImg');

// =========================================================================
// LOADING OVERLAY
// =========================================================================
let loadingOverlay = document.getElementById('dynamicLoadingOverlay');

if (!loadingOverlay) {

    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dynamicLoadingOverlay';

    loadingOverlay.innerHTML = `
        <div style="
            text-align:center;
            color:#ffffff !important;
            font-family:Arial,sans-serif !important;
            z-index:100000 !important;
        ">
            <div style="
                width:80px !important;
                height:80px !important;
                border:8px solid rgba(255,255,255,0.2) !important;
                border-radius:50% !important;
                border-top-color:#28a745 !important;
                animation:spin 0.4s linear infinite !important;
                margin:0 auto 20px auto !important;
                box-shadow:0 0 20px rgba(40,167,69,0.6) !important;
            "></div>

            <div id="loadingOverlayText" style="
                font-size:20px !important;
                font-weight:bold !important;
                color:#ffffff !important;
                text-shadow:1px 1px 5px rgba(0,0,0,0.5) !important;
            ">
                Connecting...
            </div>
        </div>
    `;

    Object.assign(loadingOverlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'none',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '99999',
        transition: 'opacity 0.2s ease'
    });

    const styleSheet = document.createElement("style");

    styleSheet.innerText = `
        @keyframes spin {
            0% {
                transform: rotate(0deg);
            }
            100% {
                transform: rotate(360deg);
            }
        }
    `;

    document.head.appendChild(styleSheet);
    document.body.appendChild(loadingOverlay);
}

function showLoading(msg) {

    const textEl = document.getElementById('loadingOverlayText');

    if (textEl) {
        textEl.textContent = msg;
    }

    loadingOverlay.style.setProperty(
        'display',
        'flex',
        'important'
    );
}

function hideLoading() {

    if (loadingOverlay) {
        loadingOverlay.style.setProperty(
            'display',
            'none',
            'important'
        );
    }
}

// =========================================================================
// CUSTOM OPERATOR NAME MODAL
// =========================================================================
let customNameModal = document.getElementById('customNameModal');

if (!customNameModal) {

    customNameModal = document.createElement('div');
    customNameModal.id = 'customNameModal';

    customNameModal.innerHTML = `
        <div style="
            background:#ffffff !important;
            padding:30px !important;
            border-radius:8px !important;
            box-shadow:0 4px 20px rgba(0,0,0,0.3) !important;
            width:90% !important;
            max-width:400px !important;
            box-sizing:border-box !important;
            text-align:center !important;
            font-family:Arial,sans-serif !important;
        ">

            <label style="
                font-size:18px !important;
                font-weight:bold !important;
                color:#333333 !important;
                display:block !important;
                margin-bottom:15px !important;
            ">
                Enter Your Name to Log This Change:
            </label>

            <input
                type="text"
                id="custom-operator-input"
                value="Noel Rie N. Deliña"
                placeholder="Your Name"
                style="
                    width:100% !important;
                    padding:12px !important;
                    font-size:16px !important;
                    border:1px solid #ccc !important;
                    border-radius:4px !important;
                    margin-bottom:20px !important;
                    box-sizing:border-box !important;
                "
            />

            <div style="
                display:flex !important;
                gap:10px !important;
                justify-content:center !important;
            ">

                <button
                    id="customCancelNameBtn"
                    style="
                        background:#6c757d !important;
                        color:white !important;
                        border:none !important;
                        padding:10px 20px !important;
                        border-radius:4px !important;
                        cursor:pointer !important;
                        font-weight:bold !important;
                        font-size:14px !important;
                    "
                >
                    Cancel
                </button>

                <button
                    id="customConfirmNameBtn"
                    style="
                        background:#28a745 !important;
                        color:white !important;
                        border:none !important;
                        padding:10px 20px !important;
                        border-radius:4px !important;
                        cursor:pointer !important;
                        font-weight:bold !important;
                        font-size:14px !important;
                    "
                >
                    Confirm & Publish
                </button>

            </div>
        </div>
    `;

    Object.assign(customNameModal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'none',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '99999'
    });

    document.body.appendChild(customNameModal);
}

// =========================================================================
// BACK TO TOP
// =========================================================================
window.addEventListener('scroll', () => {

    const backToTopBtn =
        document.getElementById('backToTopBtn');

    if (!backToTopBtn) return;

    if (
        document.body.scrollTop > 300 ||
        document.documentElement.scrollTop > 300
    ) {

        backToTopBtn.style.visibility = "visible";
        backToTopBtn.style.opacity = "1";

    } else {

        backToTopBtn.style.visibility = "hidden";
        backToTopBtn.style.opacity = "0";

    }

});

// =========================================================================
// LOGIN HANDLER
// IMPORTANT: ORIGINAL USERNAME/PASSWORD ARE UNCHANGED
// USERNAME = ADMIN
// PASSWORD = 1234567890
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {

    const loginBtn =
        document.getElementById('loginBtn');

    const userIn =
        document.getElementById('usernameIn');

    const passIn =
        document.getElementById('passwordIn');

    const loginErr =
        document.getElementById('loginError');

    const backToTopBtn =
        document.getElementById('backToTopBtn');

    function executeLogin(event) {

        if (event) {
            event.preventDefault();
        }

        const username =
            userIn ? userIn.value : '';

        const password =
            passIn ? passIn.value : '';

        // DO NOT CHANGE THESE CREDENTIALS
        if (
            username === 'ADMIN' &&
            password === '1234567890'
        ) {

            if (loginErr) {
                loginErr.textContent = '';
            }

            const loginScreen =
                document.getElementById('loginScreen');

            const mainApp =
                document.getElementById('mainApp');

            if (loginScreen) {
                loginScreen.style.display = 'none';
            }

            if (mainApp) {
                mainApp.style.display = 'block';
            }

            try {

                setupSystemEventHandlers();

            } catch (handlerError) {

                console.error(
                    'System handler initialization error:',
                    handlerError
                );

                if (loginErr) {
                    loginErr.textContent =
                        'System initialization error. Check browser console.';
                }

                return;
            }

            loadInventoryFromGoogleSheets();

        } else {

            if (loginErr) {
                loginErr.textContent =
                    'Invalid Username or Password';
            }

        }
    }

    if (loginBtn) {

        loginBtn.addEventListener(
            'click',
            executeLogin
        );

    }

    if (userIn) {

        userIn.addEventListener(
            'keypress',
            (e) => {

                if (e.key === 'Enter') {
                    executeLogin(e);
                }

            }
        );

    }

    if (passIn) {

        passIn.addEventListener(
            'keypress',
            (e) => {

                if (e.key === 'Enter') {
                    executeLogin(e);
                }

            }
        );

    }

    if (backToTopBtn) {

        backToTopBtn.addEventListener(
            'click',
            () => {

                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });

            }
        );

    }

    // Pagination
    if (prevPageBtn) {

        prevPageBtn.addEventListener(
            'click',
            () => {

                if (currentPage > 1) {

                    renderTable(
                        currentFilteredData,
                        currentPage - 1
                    );

                    const tableSection =
                        document.querySelector('.table-section');

                    if (tableSection) {

                        window.scrollTo({
                            top:
                                tableSection.offsetTop - 20,
                            behavior: 'smooth'
                        });

                    }

                }

            }
        );

    }

    if (nextPageBtn) {

        nextPageBtn.addEventListener(
            'click',
            () => {

                const totalPages =
                    Math.ceil(
                        currentFilteredData.length /
                        itemsPerPage
                    );

                if (currentPage < totalPages) {

                    renderTable(
                        currentFilteredData,
                        currentPage + 1
                    );

                    const tableSection =
                        document.querySelector('.table-section');

                    if (tableSection) {

                        window.scrollTo({
                            top:
                                tableSection.offsetTop - 20,
                            behavior: 'smooth'
                        });

                    }

                }

            }
        );

    }

    // =========================================================================
    // IMAGE HOVER PREVIEW
    // =========================================================================
    document.addEventListener(
        'mouseover',
        function(e) {

            if (
                e.target &&
                e.target.classList.contains(
                    'hover-preview-img'
                )
            ) {

                const srcToUse =
                    e.target.src;

                if (
                    srcToUse &&
                    tooltip &&
                    tooltipImg
                ) {

                    tooltipImg.src =
                        srcToUse;

                    tooltip.style.display =
                        'block';

                }

            }

        }
    );

    document.addEventListener(
        'mousemove',
        function(e) {

            if (
                e.target &&
                e.target.classList.contains(
                    'hover-preview-img'
                ) &&
                tooltip &&
                tooltip.style.display === 'block'
            ) {

                let x =
                    e.clientX + 15;

                let y =
                    e.clientY + 15;

                const tooltipRect =
                    tooltip.getBoundingClientRect();

                if (
                    x + tooltipRect.width >
                    window.innerWidth
                ) {

                    x =
                        e.clientX -
                        tooltipRect.width -
                        15;

                }

                if (
                    y + tooltipRect.height >
                    window.innerHeight
                ) {

                    y =
                        e.clientY -
                        tooltipRect.height -
                        15;

                }

                tooltip.style.left =
                    x + 'px';

                tooltip.style.top =
                    y + 'px';

            }

        }
    );

    document.addEventListener(
        'mouseout',
        function(e) {

            if (
                e.target &&
                e.target.classList.contains(
                    'hover-preview-img'
                ) &&
                tooltip &&
                tooltipImg
            ) {

                tooltip.style.display =
                    'none';

                tooltipImg.src = '';

            }

        }
    );

});

// =========================================================================
// LOAD INVENTORY FROM GOOGLE SHEETS
// =========================================================================
async function loadInventoryFromGoogleSheets() {

    if (statusBanner) {

        statusBanner.style.backgroundColor =
            "#fff3cd";

        statusBanner.style.color =
            "#856404";

        statusBanner.textContent =
            "Connecting to Google Sheets Live Datastream...";

    }

    showLoading(
        "Syncing live spreadsheet grid..."
    );

    try {

        const response =
            await fetch(
                GOOGLE_SHEET_CSV_URL +
                "&t=" +
                Date.now(),
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                "Could not connect to online Sheet feed."
            );

        }

        const rawCsvText =
            await response.text();

        Papa.parse(
            rawCsvText,
            {
                header: true,
                skipEmptyLines: true,

                complete: function(results) {

                    try {

                        if (
                            results.data &&
                            results.data.length > 0
                        ) {

                            rawHeaders =
                                Object.keys(
                                    results.data[0]
                                );

                            headerMapping = {};

                            targetHeadersLowercase.forEach(
                                target => {

                                    const actualKey =
                                        rawHeaders.find(
                                            h => {

                                                const normH =
                                                    String(h)
                                                        .toLowerCase()
                                                        .trim();

                                                const normT =
                                                    target
                                                        .toLowerCase()
                                                        .trim();

                                                if (
                                                    normT ===
                                                    'transfer_cert1' &&
                                                    normH.includes(
                                                        'transfer'
                                                    ) &&
                                                    normH.includes(
                                                        '1'
                                                    )
                                                ) {
                                                    return true;
                                                }

                                                if (
                                                    normT ===
                                                    'transfer_cert2' &&
                                                    normH.includes(
                                                        'transfer'
                                                    ) &&
                                                    normH.includes(
                                                        '2'
                                                    )
                                                ) {
                                                    return true;
                                                }

                                                if (
                                                    normT ===
                                                    'article/item' &&
                                                    (
                                                        normH.includes(
                                                            'article'
                                                        ) ||
                                                        normH.includes(
                                                            'tct'
                                                        ) ||
                                                        normH.includes(
                                                            'item'
                                                        )
                                                    )
                                                ) {
                                                    return true;
                                                }

                                                return (
                                                    normH.includes(
                                                        normT
                                                    ) ||
                                                    normT.includes(
                                                        normH
                                                    )
                                                );

                                            }
                                        );

                                    headerMapping[target] =
                                        actualKey || target;

                                }
                            );

                            inventoryData =
                                results.data.map(
                                    (row, idx) => {

                                        row._rowId =
                                            idx;

                                        return row;

                                    }
                                );

                            initializeSystemUI();

                        } else {

                            throw new Error(
                                "Target dataset sheet contains no metrics."
                            );

                        }

                        hideLoading();

                    } catch (parseError) {

                        hideLoading();

                        console.error(
                            "Sheet parsing error:",
                            parseError
                        );

                        if (statusBanner) {

                            statusBanner.style.backgroundColor =
                                "#f8d7da";

                            statusBanner.style.color =
                                "#721c24";

                            statusBanner.textContent =
                                "Error processing Google Sheets data.";

                        }

                    }

                },

                error: function(parseError) {

                    hideLoading();

                    console.error(
                        "PapaParse error:",
                        parseError
                    );

                    if (statusBanner) {

                        statusBanner.style.backgroundColor =
                            "#f8d7da";

                        statusBanner.style.color =
                            "#721c24";

                        statusBanner.textContent =
                            "Error reading Google Sheets data.";

                    }

                }

            }
        );

    } catch (err) {

        hideLoading();

        if (statusBanner) {

            statusBanner.style.backgroundColor =
                "#f8d7da";

            statusBanner.style.color =
                "#721c24";

            statusBanner.textContent =
                "Connection Error: Check Sheet spreadsheet access permission configuration.";

        }

        console.error(
            "Google Sheets connection error:",
            err
        );

    }

}

// =========================================================================
// INITIALIZE SYSTEM UI
// =========================================================================
function initializeSystemUI() {

    if (statusBanner) {

        statusBanner.style.backgroundColor =
            "#d4edda";

        statusBanner.style.color =
            "#155724";

        statusBanner.innerHTML =
            `<span class="live-animated-text">
                ✅ Connected to Google Sheets: Live View Active.
            </span>`;

    }

    if (searchInput)
        searchInput.disabled = false;

    if (searchButton)
        searchButton.disabled = false;

    if (exportButton)
        exportButton.disabled = false;

    if (exportFilteredButton)
        exportFilteredButton.disabled = false;

    if (remarksFilter)
        remarksFilter.disabled = false;

    if (typeFilter)
        typeFilter.disabled = false;

    if (photoFilter)
        photoFilter.disabled = false;

    if (searchInput)
        searchInput.placeholder =
            "Type keywords...";

    populateDropdown(
        'remarks',
        remarksFilter,
        '-- All Remarks --'
    );

    populateDropdown(
        'type',
        typeFilter,
        '-- All Types --'
    );

    renderHeaders(
        displayHeaders
    );

    calculateStaticDashboardTotals(
        inventoryData
    );

    if (!isAppInitialized) {

        currentFilteredData = [];

        if (tableBody) {

            tableBody.innerHTML =
                `<tr>
                    <td colspan="${displayHeaders.length}"
                        class="no-data">
                        Data loaded successfully.
                        Apply a filter or search to view records.
                    </td>
                </tr>`;

        }

        if (foundCountDisplay) {

            foundCountDisplay.textContent =
                `(0 items displayed)`;

        }

        updatePaginationUI(0);

        isAppInitialized = true;

    } else {

        executeSearch(true);

    }

}

// =========================================================================
// POPULATE FILTER DROPDOWN
// =========================================================================
function populateDropdown(
    type,
    selectEl,
    placeholderText
) {

    if (!selectEl) return;

    const previousSelection =
        selectEl.value;

    selectEl.innerHTML =
        `<option value="ALL">
            ${placeholderText}
        </option>`;

    const sheetKey =
        headerMapping[type];

    if (!sheetKey) return;

    const elements =
        new Set();

    inventoryData.forEach(
        row => {

            const val =
                String(
                    row[sheetKey] || ''
                ).trim();

            if (val) {
                elements.add(val);
            }

        }
    );

    const sorted =
        Array.from(elements).sort();

    if (type === 'remarks') {
        parsedUniqueRemarks =
            sorted;
    }

    sorted.forEach(
        val => {

            const opt =
                document.createElement(
                    'option'
                );

            opt.value = val;
            opt.textContent = val;

            selectEl.appendChild(
                opt
            );

        }
    );

    if (
        previousSelection &&
        Array.from(
            selectEl.options
        ).some(
            opt =>
                opt.value ===
                previousSelection
        )
    ) {

        selectEl.value =
            previousSelection;

    }

}

// =========================================================================
// RENDER TABLE HEADERS
// =========================================================================
function renderHeaders(headers) {

    if (!tableHeaderRow) return;

    tableHeaderRow.innerHTML = '';

    headers.forEach(
        header => {

            const th =
                document.createElement('th');

            th.textContent =
                header;

            tableHeaderRow.appendChild(
                th
            );

        }
    );

}// =========================================================================
// RENDER TABLE
// =========================================================================
function renderTable(data, page = 1) {

    if (!tableBody) return;

    currentFilteredData = data || [];

    const totalItems =
        currentFilteredData.length;

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                totalItems /
                itemsPerPage
            )
        );

    currentPage =
        Math.min(
            Math.max(1, page),
            totalPages
        );

    const startIndex =
        (currentPage - 1) *
        itemsPerPage;

    const endIndex =
        Math.min(
            startIndex +
            itemsPerPage,
            totalItems
        );

    const pageData =
        currentFilteredData.slice(
            startIndex,
            endIndex
        );

    tableBody.innerHTML = '';

    if (foundCountDisplay) {

        foundCountDisplay.textContent =
            `(${totalItems.toLocaleString()} items found)`;

    }

    if (pageData.length === 0) {

        tableBody.innerHTML =
            `<tr>
                <td
                    colspan="${displayHeaders.length}"
                    class="no-data"
                >
                    No matching records found.
                </td>
            </tr>`;

        updatePaginationUI(
            totalItems
        );

        return;
    }

    pageData.forEach(
        row => {

            const tr =
                document.createElement('tr');

            tr.dataset.rowId =
                row._rowId;

            tr.style.cursor =
                'pointer';

            // -------------------------------------------------------------
            // ROW CLICK -> PROPERTY DETAILS
            // -------------------------------------------------------------
            tr.addEventListener(
                'click',
                function() {

                    openPopUp(
                        row._rowId
                    );

                }
            );

            displayHeaders.forEach(
                displayHeader => {

                    const td =
                        document.createElement('td');

                    const lower =
                        displayHeader
                            .toLowerCase()
                            .trim();

                    const sheetKey =
                        headerMapping[lower];

                    let value =
                        sheetKey
                            ? row[sheetKey]
                            : '';

                    value =
                        value === undefined ||
                        value === null
                            ? ''
                            : String(value).trim();

                    // -----------------------------------------------------
                    // PHOTO 1 / PHOTO 2
                    // -----------------------------------------------------
                    if (
                        lower === 'photo 1' ||
                        lower === 'photo 2'
                    ) {

                        if (
                            value &&
                            /^https?:\/\//i.test(
                                value
                            )
                        ) {

                            const img =
                                document.createElement(
                                    'img'
                                );

                            img.src =
                                value;

                            img.alt =
                                displayHeader;

                            img.className =
                                'hover-preview-img';

                            img.style.maxWidth =
                                '70px';

                            img.style.maxHeight =
                                '50px';

                            img.style.objectFit =
                                'cover';

                            img.style.cursor =
                                'pointer';

                            img.addEventListener(
                                'click',
                                function(e) {

                                    e.stopPropagation();

                                    openImageViewer(
                                        value
                                    );

                                }
                            );

                            td.appendChild(
                                img
                            );

                        } else {

                            td.textContent =
                                value || '—';

                        }

                    // -----------------------------------------------------
                    // MAP COORDINATES
                    // -----------------------------------------------------
                    } else if (
                        lower ===
                        'map coordinates'
                    ) {

                        if (value) {

                            const mapLink =
                                document.createElement(
                                    'a'
                                );

                            mapLink.href =
                                'https://www.google.com/maps/search/?api=1&query=' +
                                encodeURIComponent(
                                    value
                                );

                            mapLink.target =
                                '_blank';

                            mapLink.rel =
                                'noopener noreferrer';

                            mapLink.textContent =
                                value;

                            mapLink.addEventListener(
                                'click',
                                e =>
                                    e.stopPropagation()
                            );

                            td.appendChild(
                                mapLink
                            );

                        } else {

                            td.textContent =
                                '—';

                        }

                    // -----------------------------------------------------
                    // DOCUMENT LINKS
                    // -----------------------------------------------------
                    } else if (
                        lower ===
                            'tax declaration' ||
                        lower ===
                            'transfer certificate of title page 1' ||
                        lower ===
                            'transfer certificate of title page 2'
                    ) {

                        if (
                            value &&
                            /^https?:\/\//i.test(
                                value
                            )
                        ) {

                            const a =
                                document.createElement(
                                    'a'
                                );

                            a.href =
                                value;

                            a.target =
                                '_blank';

                            a.rel =
                                'noopener noreferrer';

                            a.textContent =
                                'Open';

                            a.addEventListener(
                                'click',
                                e =>
                                    e.stopPropagation()
                            );

                            td.appendChild(
                                a
                            );

                        } else {

                            td.textContent =
                                value || '—';

                        }

                    } else {

                        td.textContent =
                            value || '—';

                    }

                    tr.appendChild(td);

                }
            );

            tableBody.appendChild(
                tr
            );

        }
    );

    updatePaginationUI(
        totalItems
    );

}

// =========================================================================
// PAGINATION UI
// =========================================================================
function updatePaginationUI(totalItems) {

    if (!paginationContainer) return;

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                totalItems /
                itemsPerPage
            )
        );

    if (pageIndicator) {

        pageIndicator.textContent =
            `Page ${currentPage} of ${totalPages}`;

    }

    if (prevPageBtn) {

        prevPageBtn.disabled =
            currentPage <= 1;

    }

    if (nextPageBtn) {

        nextPageBtn.disabled =
            currentPage >= totalPages ||
            totalItems === 0;

    }

    if (totalItems === 0) {

        paginationContainer.style.display =
            'none';

    } else {

        paginationContainer.style.display =
            'flex';

    }

}

// =========================================================================
// DASHBOARD TOTALS
// =========================================================================
function calculateStaticDashboardTotals(
    items
) {

    const total =
        items.length;

    let existing = 0;
    let notFound = 0;
    let verification = 0;
    let withPhotos = 0;
    let taxDeclaration = 0;

    const typeCounts = {
        building: 0,
        assetmod: 0,
        flood: 0,
        hospital: 0,
        land: 0,
        market: 0,
        otherinfra: 0,
        otherland: 0,
        otherstruct: 0,
        park: 0,
        road: 0,
        school: 0,
        slaughterhouse: 0,
        water: 0
    };

    items.forEach(
        row => {

            const remarks =
                String(
                    row[
                        headerMapping.remarks
                    ] || ''
                )
                    .trim()
                    .toLowerCase();

            const type =
                String(
                    row[
                        headerMapping.type
                    ] || ''
                )
                    .trim()
                    .toLowerCase();

            const photo1 =
                String(
                    row[
                        headerMapping['photo 1']
                    ] || ''
                ).trim();

            const photo2 =
                String(
                    row[
                        headerMapping['photo 2']
                    ] || ''
                ).trim();

            const taxDec =
                String(
                    row[
                        headerMapping[
                            'tax declaration'
                        ]
                    ] || ''
                ).trim();

            // -------------------------------------------------------------
            // REMARKS
            // -------------------------------------------------------------
            if (
                remarks.includes('existing')
            ) {

                existing++;

            } else if (
                remarks.includes('not found') ||
                remarks.includes('notfound')
            ) {

                notFound++;

            } else if (
                remarks.includes(
                    'verification'
                )
            ) {

                verification++;

            }

            // -------------------------------------------------------------
            // PHOTOS
            // -------------------------------------------------------------
            if (
                photo1 ||
                photo2
            ) {

                withPhotos++;

            }

            // -------------------------------------------------------------
            // TAX DECLARATION
            // -------------------------------------------------------------
            if (taxDec) {

                taxDeclaration++;

            }

            // -------------------------------------------------------------
            // TYPE
            // -------------------------------------------------------------
            if (
                type.includes('building')
            ) {

                typeCounts.building++;

            } else if (
                type.includes('asset')
            ) {

                typeCounts.assetmod++;

            } else if (
                type.includes('flood')
            ) {

                typeCounts.flood++;

            } else if (
                type.includes('hospital')
            ) {

                typeCounts.hospital++;

            } else if (
                type === 'land' ||
                type.includes('land')
            ) {

                typeCounts.land++;

            } else if (
                type.includes('market')
            ) {

                typeCounts.market++;

            } else if (
                type.includes('infra')
            ) {

                typeCounts.otherinfra++;

            } else if (
                type.includes('park')
            ) {

                typeCounts.park++;

            } else if (
                type.includes('road')
            ) {

                typeCounts.road++;

            } else if (
                type.includes('school')
            ) {

                typeCounts.school++;

            } else if (
                type.includes(
                    'slaughter'
                )
            ) {

                typeCounts.slaughterhouse++;

            } else if (
                type.includes('water')
            ) {

                typeCounts.water++;

            } else if (
                type.includes('structure')
            ) {

                typeCounts.otherstruct++;

            } else if (
                type.includes('other land')
            ) {

                typeCounts.otherland++;

            }

        }
    );

    if (countTotal)
        countTotal.textContent =
            total.toLocaleString();

    if (countExisting)
        countExisting.textContent =
            existing.toLocaleString();

    if (countNotFound)
        countNotFound.textContent =
            notFound.toLocaleString();

    if (countVerification)
        countVerification.textContent =
            verification.toLocaleString();

    if (countWithPhotos)
        countWithPhotos.textContent =
            withPhotos.toLocaleString();

    if (countTaxDec)
        countTaxDec.textContent =
            taxDeclaration.toLocaleString();

    if (countBuilding)
        countBuilding.textContent =
            typeCounts.building;

    if (countAssetMod)
        countAssetMod.textContent =
            typeCounts.assetmod;

    if (countFlood)
        countFlood.textContent =
            typeCounts.flood;

    if (countHospital)
        countHospital.textContent =
            typeCounts.hospital;

    if (countLand)
        countLand.textContent =
            typeCounts.land;

    if (countMarket)
        countMarket.textContent =
            typeCounts.market;

    if (countOtherInfra)
        countOtherInfra.textContent =
            typeCounts.otherinfra;

    if (countOtherLand)
        countOtherLand.textContent =
            typeCounts.otherland;

    if (countOtherStruct)
        countOtherStruct.textContent =
            typeCounts.otherstruct;

    if (countPark)
        countPark.textContent =
            typeCounts.park;

    if (countRoad)
        countRoad.textContent =
            typeCounts.road;

    if (countSchool)
        countSchool.textContent =
            typeCounts.school;

    if (countSlaughterhouse)
        countSlaughterhouse.textContent =
            typeCounts.slaughterhouse;

    if (countWater)
        countWater.textContent =
            typeCounts.water;

}

// =========================================================================
// SEARCH / FILTER
// =========================================================================
function executeSearch(
    preservePage = false
) {

    const searchTerm =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : '';

    const selectedRemarks =
        remarksFilter
            ? remarksFilter.value
            : 'ALL';

    const selectedType =
        typeFilter
            ? typeFilter.value
            : 'ALL';

    const selectedPhoto =
        photoFilter
            ? photoFilter.value
            : 'ALL';

    let filtered =
        inventoryData.filter(
            row => {

                // ---------------------------------------------------------
                // SEARCH
                // ---------------------------------------------------------
                let matchesSearch = true;

                if (searchTerm) {

                    matchesSearch =
                        rawHeaders.some(
                            header => {

                                const val =
                                    String(
                                        row[
                                            header
                                        ] || ''
                                    )
                                        .toLowerCase();

                                return val.includes(
                                    searchTerm
                                );

                            }
                        );

                }

                if (!matchesSearch)
                    return false;

                // ---------------------------------------------------------
                // REMARKS
                // ---------------------------------------------------------
                if (
                    selectedRemarks !==
                    'ALL'
                ) {

                    const value =
                        String(
                            row[
                                headerMapping.remarks
                            ] || ''
                        ).trim();

                    if (
                        value !==
                        selectedRemarks
                    ) {

                        return false;

                    }

                }

                // ---------------------------------------------------------
                // TYPE
                // ---------------------------------------------------------
                if (
                    selectedType !==
                    'ALL'
                ) {

                    const value =
                        String(
                            row[
                                headerMapping.type
                            ] || ''
                        ).trim();

                    if (
                        value !==
                        selectedType
                    ) {

                        return false;

                    }

                }

                // ---------------------------------------------------------
                // PHOTO FILTER
                // ---------------------------------------------------------
                if (
                    selectedPhoto !==
                    'ALL'
                ) {

                    const p1 =
                        String(
                            row[
                                headerMapping[
                                    'photo 1'
                                ]
                            ] || ''
                        ).trim();

                    const p2 =
                        String(
                            row[
                                headerMapping[
                                    'photo 2'
                                ]
                            ] || ''
                        ).trim();

                    const hasPhoto =
                        !!(p1 || p2);

                    if (
                        selectedPhoto ===
                            'WITH_PHOTO' &&
                        !hasPhoto
                    ) {

                        return false;

                    }

                    if (
                        selectedPhoto ===
                            'WITHOUT_PHOTO' &&
                        hasPhoto
                    ) {

                        return false;

                    }

                }

                return true;

            }
        );

    currentFilteredData =
        filtered;

    if (!preservePage) {
        currentPage = 1;
    }

    renderTable(
        filtered,
        currentPage
    );

}

// =========================================================================
// OPEN PROPERTY DETAILS POPUP
// =========================================================================
function openPopUp(rowId) {

    const numericRowId =
        Number(rowId);

    const rowIndex =
        inventoryData.findIndex(
            row =>
                Number(row._rowId) ===
                numericRowId
        );

    if (rowIndex === -1) {

        console.error(
            'Property row not found:',
            rowId
        );

        return;

    }

    activeEditIndex =
        rowIndex;

    modalModified = false;
    modalActionTaken = false;

    modalOpenedScrollY =
        window.scrollY ||
        window.pageYOffset ||
        0;

    const row =
        inventoryData[
            activeEditIndex
        ];

    if (!modalFormContainer) return;

    modalFormContainer.innerHTML = '';

    // -------------------------------------------------------------
    // TITLE / ITEM IDENTIFIER
    // -------------------------------------------------------------
    const itemKey =
        headerMapping[
            'article/item'
        ];

    const itemCode =
        String(
            row[itemKey] || ''
        ).trim();

    const modalTitle =
        document.createElement(
            'div'
        );

    modalTitle.style.cssText =
        `
            margin-bottom:18px;
            padding:12px;
            background:#f1f3f5;
            border-radius:6px;
            font-weight:bold;
            color:#212529;
        `;

    modalTitle.innerHTML =
        `
            <div style="font-size:12px;color:#6c757d;">
                PROPERTY IDENTIFIER
            </div>

            <div style="font-size:20px;color:#212529;">
                ${escapeHtml(
                    itemCode ||
                    'Unknown Item'
                )}
            </div>
        `;

    modalFormContainer.appendChild(
        modalTitle
    );

    // -------------------------------------------------------------
    // PROPERTY FIELDS
    // -------------------------------------------------------------
    popupOrderLowercase.forEach(
        lowerKey => {

            const sheetKey =
                headerMapping[
                    lowerKey
                ];

            const value =
                String(
                    row[sheetKey] || ''
                );

            const wrapper =
                document.createElement(
                    'div'
                );

            wrapper.className =
                'modal-field';

            wrapper.style.marginBottom =
                '12px';

            const label =
                document.createElement(
                    'label'
                );

            const displayLabel =
                displayHeaders.find(
                    h =>
                        h.toLowerCase()
                            .trim() ===
                        lowerKey
                ) ||
                lowerKey;

            label.textContent =
                displayLabel;

            label.style.display =
                'block';

            label.style.fontWeight =
                'bold';

            label.style.marginBottom =
                '5px';

            const input =
                document.createElement(
                    lowerKey ===
                    'remarks'
                        ? 'select'
                        : 'input'
                );

            input.dataset.field =
                lowerKey;

            input.dataset.sheetKey =
                sheetKey || '';

            input.className =
                'modal-edit-field';

            input.value =
                value;

            input.disabled =
                true;

            input.style.width =
                '100%';

            input.style.boxSizing =
                'border-box';

            input.style.padding =
                '9px';

            input.style.border =
                '1px solid #ced4da';

            input.style.borderRadius =
                '4px';

            if (
                lowerKey ===
                'remarks'
            ) {

                const allValues =
                    new Set(
                        parsedUniqueRemarks
                    );

                if (
                    value &&
                    !allValues.has(value)
                ) {

                    allValues.add(
                        value
                    );

                }

                input.innerHTML =
                    '';

                Array.from(
                    allValues
                )
                    .sort()
                    .forEach(
                        remark => {

                            const option =
                                document.createElement(
                                    'option'
                                );

                            option.value =
                                remark;

                            option.textContent =
                                remark;

                            input.appendChild(
                                option
                            );

                        }
                    );

                input.value =
                    value;

            }

            input.addEventListener(
                'change',
                () => {

                    modalModified =
                        true;

                }
            );

            wrapper.appendChild(
                label
            );

            wrapper.appendChild(
                input
            );

            modalFormContainer.appendChild(
                wrapper
            );

        }
    );

    // -------------------------------------------------------------
    // PHOTO GALLERY
    // -------------------------------------------------------------
    createModalPhotoGallery(
        row
    );

    if (editModal) {

        editModal.style.display =
            'flex';

    }

}

// =========================================================================
// PHOTO GALLERY IN PROPERTY DETAILS
// =========================================================================
function createModalPhotoGallery(
    row
) {

    const existing =
        document.getElementById(
            'modalPhotoGallery'
        );

    if (existing) {
        existing.remove();
    }

    const gallery =
        document.createElement(
            'div'
        );

    gallery.id =
        'modalPhotoGallery';

    gallery.style.cssText =
        `
            margin-top:20px;
            border-top:1px solid #ddd;
            padding-top:15px;
        `;

    const title =
        document.createElement(
            'div'
        );

    title.textContent =
        'Property Photos';

    title.style.cssText =
        `
            font-weight:bold;
            font-size:16px;
            margin-bottom:10px;
        `;

    gallery.appendChild(
        title
    );

    modalPhotos = [];

    const photo1 =
        String(
            row[
                headerMapping[
                    'photo 1'
                ]
            ] || ''
        ).trim();

    const photo2 =
        String(
            row[
                headerMapping[
                    'photo 2'
                ]
            ] || ''
        ).trim();

    if (
        photo1 &&
        /^https?:\/\//i.test(
            photo1
        )
    ) {

        modalPhotos.push(
            photo1
        );

    }

    if (
        photo2 &&
        /^https?:\/\//i.test(
            photo2
        )
    ) {

        modalPhotos.push(
            photo2
        );

    }

    if (
        modalPhotos.length === 0
    ) {

        const noPhoto =
            document.createElement(
                'div'
            );

        noPhoto.textContent =
            'No photos uploaded.';

        noPhoto.style.color =
            '#6c757d';

        gallery.appendChild(
            noPhoto
        );

    } else {

        const photoContainer =
            document.createElement(
                'div'
            );

        photoContainer.style.cssText =
            `
                display:flex;
                flex-wrap:wrap;
                gap:10px;
            `;

        modalPhotos.forEach(
            (src, index) => {

                const img =
                    document.createElement(
                        'img'
                    );

                img.src =
                    src;

                img.alt =
                    'Property Photo ' +
                    (index + 1);

                img.style.cssText =
                    `
                        width:120px;
                        height:90px;
                        object-fit:cover;
                        border-radius:6px;
                        border:1px solid #ccc;
                        cursor:pointer;
                    `;

                img.addEventListener(
                    'click',
                    () => {

                        openImageViewer(
                            src
                        );

                    }
                );

                photoContainer.appendChild(
                    img
                );

            }
        );

        gallery.appendChild(
            photoContainer
        );

    }

    if (modalFormContainer) {

        modalFormContainer.appendChild(
            gallery
        );

    }

}

// =========================================================================
// ESCAPE HTML
// =========================================================================
function escapeHtml(value) {

    return String(value)
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&#039;'
        );

}

// =========================================================================
// IMAGE VIEWER
// =========================================================================
function openImageViewer(
    imageUrl
) {

    let viewer =
        document.getElementById(
            'inventoryImageViewer'
        );

    if (!viewer) {

        viewer =
            document.createElement(
                'div'
            );

        viewer.id =
            'inventoryImageViewer';

        viewer.style.cssText =
            `
                position:fixed;
                inset:0;
                background:rgba(0,0,0,0.88);
                display:flex;
                align-items:center;
                justify-content:center;
                z-index:100001;
                padding:30px;
                box-sizing:border-box;
            `;

        viewer.innerHTML =
            `
                <button
                    id="inventoryImageViewerClose"
                    style="
                        position:absolute;
                        top:20px;
                        right:25px;
                        background:#fff;
                        border:none;
                        border-radius:50%;
                        width:42px;
                        height:42px;
                        font-size:25px;
                        cursor:pointer;
                        z-index:2;
                    "
                >
                    ×
                </button>

                <img
                    id="inventoryImageViewerImg"
                    src=""
                    alt="Property Photo"
                    style="
                        max-width:95vw;
                        max-height:90vh;
                        object-fit:contain;
                        border-radius:6px;
                        box-shadow:0 0 30px rgba(0,0,0,0.5);
                    "
                />
            `;

        document.body.appendChild(
            viewer
        );

        document
            .getElementById(
                'inventoryImageViewerClose'
            )
            .addEventListener(
                'click',
                () => {

                    viewer.style.display =
                        'none';

                }
            );

        viewer.addEventListener(
            'click',
            e => {

                if (
                    e.target ===
                    viewer
                ) {

                    viewer.style.display =
                        'none';

                }

            }
        );

    }

    const image =
        document.getElementById(
            'inventoryImageViewerImg'
        );

    if (image) {
        image.src =
            imageUrl;
    }

    viewer.style.display =
        'flex';

}

// =========================================================================
// REFRESH DATA WHILE PRESERVING POSITION
// =========================================================================
async function refreshInventoryPreservePosition(
    savedScrollY = null
) {

    const position =
        savedScrollY !== null
            ? savedScrollY
            : modalOpenedScrollY;

    const searchValue =
        searchInput
            ? searchInput.value
            : '';

    const remarksValue =
        remarksFilter
            ? remarksFilter.value
            : 'ALL';

    const typeValue =
        typeFilter
            ? typeFilter.value
            : 'ALL';

    const photoValue =
        photoFilter
            ? photoFilter.value
            : 'ALL';

    try {

        await loadInventoryFromGoogleSheets();

    } finally {

        requestAnimationFrame(
            () => {

                requestAnimationFrame(
                    () => {

                        if (searchInput)
                            searchInput.value =
                                searchValue;

                        if (remarksFilter)
                            remarksFilter.value =
                                remarksValue;

                        if (typeFilter)
                            typeFilter.value =
                                typeValue;

                        if (photoFilter)
                            photoFilter.value =
                                photoValue;

                        executeSearch(
                            true
                        );

                        window.scrollTo(
                            0,
                            position
                        );

                    }
                );

            }
        );

    }

}

// =========================================================================
// CLOSE PROPERTY MODAL
// =========================================================================
function closePropertyModal(
    shouldRefresh = false
) {

    const savedScrollY =
        modalOpenedScrollY;

    if (editModal) {

        editModal.style.display =
            'none';

    }

    activeEditIndex =
        null;

    modalModified =
        false;

    if (shouldRefresh) {

        refreshInventoryPreservePosition(
            savedScrollY
        );

    } else {

        requestAnimationFrame(
            () => {

                window.scrollTo(
                    0,
                    savedScrollY
                );

            }
        );

    }

}

// =========================================================================
// ENABLE EDIT MODE
// =========================================================================
function enableModalEditMode() {

    if (!modalFormContainer)
        return;

    const fields =
        modalFormContainer.querySelectorAll(
            '.modal-edit-field'
        );

    fields.forEach(
        field => {

            field.disabled =
                false;

        }
    );

    if (modalEditBtn) {

        modalEditBtn.style.display =
            'none';

    }

    if (modalSaveBtn) {

        modalSaveBtn.style.display =
            'inline-block';

    }

    modalModified =
        false;

}

// =========================================================================
// GET ACTIVE ITEM CODE
// =========================================================================
function getActiveItemCode() {

    if (
        activeEditIndex === null ||
        !inventoryData[
            activeEditIndex
        ]
    ) {

        return '';

    }

    const row =
        inventoryData[
            activeEditIndex
        ];

    const key =
        headerMapping[
            'article/item'
        ];

    return String(
        row[key] || ''
    ).trim();

}

// =========================================================================
// BUILD UPLOAD URL
// =========================================================================
function buildUploadUrl(
    itemCode
) {

    const cleanItem =
        String(
            itemCode || ''
        ).trim();

    if (!cleanItem) {

        return GOOGLE_APPS_SCRIPT_URL;

    }

    return (
        GOOGLE_APPS_SCRIPT_URL +
        '?itemCode=' +
        encodeURIComponent(
            cleanItem
        )
    );

}

// =========================================================================
// UPLOAD BUTTON
// IMPORTANT: SENDS THE SELECTED ITEM TO GOOGLE APPS SCRIPT
// =========================================================================
function handleUploadPhoto() {

    const itemCode =
        getActiveItemCode();

    if (!itemCode) {

        alert(
            'Unable to identify this property. The Article/Item or TCT number is missing.'
        );

        return;

    }

    modalActionTaken =
        true;

    modalOpenedScrollY =
        window.scrollY ||
        window.pageYOffset ||
        modalOpenedScrollY;

    const uploadUrl =
        buildUploadUrl(
            itemCode
        );

    console.log(
        'Opening upload page:',
        uploadUrl
    );

    // Close modal first
    if (editModal) {

        editModal.style.display =
            'none';

    }

    /*
     * IMPORTANT:
     * The itemCode is now included in the URL.
     *
     * Google Apps Script can read it using:
     *
     * e.parameter.itemCode
     *
     * This fixes:
     *
     * Item: Unknown Item
     */

    window.open(
        uploadUrl,
        '_blank',
        'noopener,noreferrer'
    );

}

// =========================================================================
// PREPARE UPDATE DATA
// =========================================================================
function getModalUpdateValues() {

    const values = {};

    if (!modalFormContainer)
        return values;

    const fields =
        modalFormContainer.querySelectorAll(
            '.modal-edit-field'
        );

    fields.forEach(
        field => {

            const fieldKey =
                field.dataset.field;

            if (!fieldKey)
                return;

            values[fieldKey] =
                field.value;

        }
    );

    return values;

}// =========================================================================
// TRANSMIT UPDATE TO GOOGLE APPS SCRIPT
// =========================================================================
async function transmitUpdateToCloud(
    remark,
    user
) {

    if (
        activeEditIndex === null ||
        !inventoryData[activeEditIndex]
    ) {

        alert(
            'No property is currently selected.'
        );

        return false;

    }

    const row =
        inventoryData[
            activeEditIndex
        ];

    const itemCode =
        String(
            row[
                headerMapping[
                    'article/item'
                ]
            ] || ''
        ).trim();

    if (!itemCode) {

        alert(
            'Unable to identify the selected property. Article/Item or TCT number is missing.'
        );

        return false;

    }

    const timestamp =
        new Date().toISOString();

    if (statusBanner) {

        statusBanner.style.backgroundColor =
            '#fff3cd';

        statusBanner.style.color =
            '#856404';

        statusBanner.textContent =
            'Publishing update to Google Sheets...';

    }

    showLoading(
        'Publishing property update...'
    );

    /*
     * IMPORTANT:
     * Google Apps Script reads POST values through
     * e.parameter.
     *
     * Therefore we use URLSearchParams instead
     * of sending JSON.
     */
    const params =
        new URLSearchParams();

    params.append(
        'article',
        itemCode
    );

    params.append(
        'itemCode',
        itemCode
    );

    params.append(
        'remarks',
        remark || ''
    );

    params.append(
        'updatedby',
        user || ''
    );

    params.append(
        'timestamp',
        timestamp
    );

    try {

        const response =
            await fetch(
                GOOGLE_APPS_SCRIPT_URL,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/x-www-form-urlencoded;charset=UTF-8'
                    },

                    body:
                        params.toString()
                }
            );

        const responseText =
            await response.text();

        console.log(
            'Google Apps Script response:',
            responseText
        );

        /*
         * Update the local row immediately.
         * This prevents the Google Sheets CSV cache
         * from making the old value appear again.
         */
        const remarksKey =
            headerMapping[
                'remarks'
            ];

        const updatedByKey =
            headerMapping[
                'updated by'
            ];

        const lastUpdateKey =
            headerMapping[
                'last update'
            ];

        if (remarksKey) {

            row[remarksKey] =
                remark || '';

        }

        if (updatedByKey) {

            row[updatedByKey] =
                user || '';

        }

        if (lastUpdateKey) {

            row[lastUpdateKey] =
                timestamp;

        }

        if (statusBanner) {

            statusBanner.style.backgroundColor =
                '#d4edda';

            statusBanner.style.color =
                '#155724';

            statusBanner.textContent =
                '✅ Update published successfully.';

        }

        hideLoading();

        return true;

    } catch (error) {

        hideLoading();

        console.error(
            'Google Apps Script update error:',
            error
        );

        if (statusBanner) {

            statusBanner.style.backgroundColor =
                '#f8d7da';

            statusBanner.style.color =
                '#721c24';

            statusBanner.textContent =
                'Connection error while publishing update.';

        }

        alert(
            'The update could not be sent to Google Sheets.\n\n' +
            'Please check your internet connection and Google Apps Script deployment.'
        );

        return false;

    }

}

// =========================================================================
// SAVE ALL MODAL CHANGES
// =========================================================================
async function saveModalChanges(
    user
) {

    if (
        activeEditIndex === null ||
        !inventoryData[activeEditIndex]
    ) {

        alert(
            'No property is currently selected.'
        );

        return false;

    }

    const values =
        getModalUpdateValues();

    const row =
        inventoryData[
            activeEditIndex
        ];

    const itemCode =
        String(
            row[
                headerMapping[
                    'article/item'
                ]
            ] || ''
        ).trim();

    if (!itemCode) {

        alert(
            'Unable to identify the selected property.'
        );

        return false;

    }

    const timestamp =
        new Date().toISOString();

    showLoading(
        'Saving property changes...'
    );

    if (statusBanner) {

        statusBanner.style.backgroundColor =
            '#fff3cd';

        statusBanner.style.color =
            '#856404';

        statusBanner.textContent =
            'Saving property changes to Google Sheets...';

    }

    const params =
        new URLSearchParams();

    // -------------------------------------------------------------
    // REQUIRED IDENTIFIERS
    // -------------------------------------------------------------
    params.append(
        'article',
        itemCode
    );

    params.append(
        'itemCode',
        itemCode
    );

    params.append(
        'updatedby',
        user || ''
    );

    params.append(
        'timestamp',
        timestamp
    );

    // -------------------------------------------------------------
    // SEND REMARKS
    // -------------------------------------------------------------
    if (
        values.hasOwnProperty(
            'remarks'
        )
    ) {

        params.append(
            'remarks',
            values.remarks
        );

    }

    // -------------------------------------------------------------
    // SEND OTHER EDITABLE VALUES
    // -------------------------------------------------------------
    Object.keys(values).forEach(
        key => {

            if (
                key === 'remarks'
            ) {
                return;
            }

            params.append(
                key,
                values[key] || ''
            );

        }
    );

    try {

        const response =
            await fetch(
                GOOGLE_APPS_SCRIPT_URL,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/x-www-form-urlencoded;charset=UTF-8'
                    },

                    body:
                        params.toString()
                }
            );

        const responseText =
            await response.text();

        console.log(
            'Google Apps Script save response:',
            responseText
        );

        // -------------------------------------------------------------
        // UPDATE LOCAL DATA IMMEDIATELY
        // -------------------------------------------------------------
        Object.keys(values).forEach(
            key => {

                const sheetKey =
                    headerMapping[key];

                if (
                    sheetKey &&
                    row.hasOwnProperty(
                        sheetKey
                    )
                ) {

                    row[sheetKey] =
                        values[key];

                }

            }
        );

        const updatedByKey =
            headerMapping[
                'updated by'
            ];

        const lastUpdateKey =
            headerMapping[
                'last update'
            ];

        if (updatedByKey) {

            row[updatedByKey] =
                user || '';

        }

        if (lastUpdateKey) {

            row[lastUpdateKey] =
                timestamp;

        }

        modalModified =
            false;

        hideLoading();

        if (statusBanner) {

            statusBanner.style.backgroundColor =
                '#d4edda';

            statusBanner.style.color =
                '#155724';

            statusBanner.textContent =
                '✅ Property changes saved successfully.';

        }

        /*
         * Close the modal and refresh.
         * The scroll position is preserved.
         */
        closePropertyModal(
            true
        );

        return true;

    } catch (error) {

        hideLoading();

        console.error(
            'Save changes error:',
            error
        );

        if (statusBanner) {

            statusBanner.style.backgroundColor =
                '#f8d7da';

            statusBanner.style.color =
                '#721c24';

            statusBanner.textContent =
                'Connection error while saving changes.';

        }

        alert(
            'Unable to save the property changes.\n\n' +
            'Please check your connection and try again.'
        );

        return false;

    }

}

// =========================================================================
// CUSTOM NAME MODAL
// =========================================================================
function showCustomNameModal() {

    return new Promise(
        resolve => {

            const input =
                document.getElementById(
                    'custom-operator-input'
                );

            const cancelBtn =
                document.getElementById(
                    'customCancelNameBtn'
                );

            const confirmBtn =
                document.getElementById(
                    'customConfirmNameBtn'
                );

            if (!customNameModal) {

                resolve(null);

                return;

            }

            if (input) {

                input.value =
                    'Noel Rie N. Deliña';

            }

            customNameModal.style.display =
                'flex';

            setTimeout(
                () => {

                    if (input) {

                        input.focus();

                        input.select();

                    }

                },
                50
            );

            const cleanup =
                () => {

                    customNameModal.style.display =
                        'none';

                    if (cancelBtn) {

                        cancelBtn.onclick =
                            null;

                    }

                    if (confirmBtn) {

                        confirmBtn.onclick =
                            null;

                    }

                };

            if (cancelBtn) {

                cancelBtn.onclick =
                    () => {

                        cleanup();

                        resolve(null);

                    };

            }

            if (confirmBtn) {

                confirmBtn.onclick =
                    () => {

                        const name =
                            input
                                ? input.value.trim()
                                : '';

                        if (!name) {

                            alert(
                                'Please enter your name.'
                            );

                            if (input) {
                                input.focus();
                            }

                            return;

                        }

                        cleanup();

                        resolve(
                            name
                        );

                    };

            }

        }
    );

}

// =========================================================================
// SETUP SYSTEM EVENT HANDLERS
// =========================================================================
function setupSystemEventHandlers() {

    if (systemHandlersBound) {
        return;
    }

    systemHandlersBound =
        true;

    // =========================================================================
    // SEARCH BUTTON
    // =========================================================================
    if (searchButton) {

        searchButton.addEventListener(
            'click',
            () => {

                executeSearch(
                    false
                );

            }
        );

    }

    // =========================================================================
    // SEARCH ENTER KEY
    // =========================================================================
    if (searchInput) {

        searchInput.addEventListener(
            'keypress',
            e => {

                if (
                    e.key ===
                    'Enter'
                ) {

                    e.preventDefault();

                    executeSearch(
                        false
                    );

                }

            }
        );

        searchInput.addEventListener(
            'input',
            () => {

                if (
                    searchInput.value
                        .trim()
                        .length === 0
                ) {

                    executeSearch(
                        false
                    );

                }

            }
        );

    }

    // =========================================================================
    // REMARKS FILTER
    // =========================================================================
    if (remarksFilter) {

        remarksFilter.addEventListener(
            'change',
            () => {

                executeSearch(
                    false
                );

            }
        );

    }

    // =========================================================================
    // TYPE FILTER
    // =========================================================================
    if (typeFilter) {

        typeFilter.addEventListener(
            'change',
            () => {

                executeSearch(
                    false
                );

            }
        );

    }

    // =========================================================================
    // PHOTO FILTER
    // =========================================================================
    if (photoFilter) {

        photoFilter.addEventListener(
            'change',
            () => {

                executeSearch(
                    false
                );

            }
        );

    }

    // =========================================================================
    // EXPORT ALL CSV
    // =========================================================================
    if (exportButton) {

        exportButton.addEventListener(
            'click',
            () => {

                if (
                    !inventoryData ||
                    inventoryData.length === 0
                ) {

                    alert(
                        'There is no inventory data to export.'
                    );

                    return;

                }

                try {

                    const exportRows =
                        inventoryData.map(
                            row => {

                                const output =
                                    {};

                                EXPORT_TABLE_CONFIG.forEach(
                                    config => {

                                        const key =
                                            headerMapping[
                                                config.key
                                            ];

                                        output[
                                            config.display
                                        ] =
                                            key
                                                ? row[key] || ''
                                                : '';

                                    }
                                );

                                return output;

                            }
                        );

                    const csv =
                        Papa.unparse(
                            exportRows
                        );

                    const blob =
                        new Blob(
                            [csv],
                            {
                                type:
                                    'text/csv;charset=utf-8;'
                            }
                        );

                    const url =
                        URL.createObjectURL(
                            blob
                        );

                    const a =
                        document.createElement(
                            'a'
                        );

                    a.href =
                        url;

                    a.download =
                        'real_estate_inventory.csv';

                    document.body.appendChild(
                        a
                    );

                    a.click();

                    a.remove();

                    URL.revokeObjectURL(
                        url
                    );

                } catch (error) {

                    console.error(
                        'CSV export error:',
                        error
                    );

                    alert(
                        'Unable to export CSV.'
                    );

                }

            }
        );

    }

    // =========================================================================
    // EXPORT FILTERED CSV
    // =========================================================================
    if (exportFilteredButton) {

        exportFilteredButton.addEventListener(
            'click',
            () => {

                if (
                    !currentFilteredData ||
                    currentFilteredData.length === 0
                ) {

                    alert(
                        'There are no filtered records to export.'
                    );

                    return;

                }

                try {

                    const exportRows =
                        currentFilteredData.map(
                            row => {

                                const output =
                                    {};

                                EXPORT_TABLE_CONFIG.forEach(
                                    config => {

                                        const key =
                                            headerMapping[
                                                config.key
                                            ];

                                        output[
                                            config.display
                                        ] =
                                            key
                                                ? row[key] || ''
                                                : '';

                                    }
                                );

                                return output;

                            }
                        );

                    const csv =
                        Papa.unparse(
                            exportRows
                        );

                    const blob =
                        new Blob(
                            [csv],
                            {
                                type:
                                    'text/csv;charset=utf-8;'
                            }
                        );

                    const url =
                        URL.createObjectURL(
                            blob
                        );

                    const a =
                        document.createElement(
                            'a'
                        );

                    a.href =
                        url;

                    a.download =
                        'filtered_real_estate_inventory.csv';

                    document.body.appendChild(
                        a
                    );

                    a.click();

                    a.remove();

                    URL.revokeObjectURL(
                        url
                    );

                } catch (error) {

                    console.error(
                        'Filtered CSV export error:',
                        error
                    );

                    alert(
                        'Unable to export filtered CSV.'
                    );

                }

            }
        );

    }

    // =========================================================================
    // PROPERTY MODAL EDIT BUTTON
    // =========================================================================
    if (modalEditBtn) {

        modalEditBtn.addEventListener(
            'click',
            () => {

                modalActionTaken =
                    true;

                enableModalEditMode();

            }
        );

    }

    // =========================================================================
    // PROPERTY MODAL SAVE BUTTON
    // =========================================================================
    if (modalSaveBtn) {

        modalSaveBtn.addEventListener(
            'click',
            async () => {

                modalActionTaken =
                    true;

                const operator =
                    await showCustomNameModal();

                if (!operator) {
                    return;
                }

                await saveModalChanges(
                    operator
                );

            }
        );

    }

    // =========================================================================
    // UPLOAD PHOTO BUTTON
    // =========================================================================
    if (uploadPhotoBtn) {

        uploadPhotoBtn.addEventListener(
            'click',
            () => {

                handleUploadPhoto();

            }
        );

    }

    // =========================================================================
    // CLOSE BUTTON
    // =========================================================================
    if (modalCloseBtn) {

        modalCloseBtn.addEventListener(
            'click',
            () => {

                /*
                 * If Edit or Upload was clicked,
                 * refresh the data but keep the same
                 * page/scroll position.
                 */
                const needsRefresh =
                    modalActionTaken ||
                    modalModified;

                closePropertyModal(
                    needsRefresh
                );

            }
        );

    }

    // =========================================================================
    // X BUTTON
    // =========================================================================
    if (modalCloseX) {

        modalCloseX.addEventListener(
            'click',
            () => {

                const needsRefresh =
                    modalActionTaken ||
                    modalModified;

                closePropertyModal(
                    needsRefresh
                );

            }
        );

    }

    // =========================================================================
    // CLICK OUTSIDE MODAL
    // =========================================================================
    if (editModal) {

        editModal.addEventListener(
            'click',
            e => {

                if (
                    e.target ===
                    editModal
                ) {

                    const needsRefresh =
                        modalActionTaken ||
                        modalModified;

                    closePropertyModal(
                        needsRefresh
                    );

                }

            }
        );

    }

    // =========================================================================
    // ESC KEY
    // =========================================================================
    document.addEventListener(
        'keydown',
        e => {

            if (
                e.key === 'Escape'
            ) {

                // Close image viewer first
                const viewer =
                    document.getElementById(
                        'inventoryImageViewer'
                    );

                if (
                    viewer &&
                    viewer.style.display !==
                        'none'
                ) {

                    viewer.style.display =
                        'none';

                    return;

                }

                // Then close property modal
                if (
                    editModal &&
                    editModal.style.display ===
                        'flex'
                ) {

                    const needsRefresh =
                        modalActionTaken ||
                        modalModified;

                    closePropertyModal(
                        needsRefresh
                    );

                }

            }

        }
    );

}

// =========================================================================
// GLOBAL ERROR PROTECTION
// =========================================================================
window.addEventListener(
    'error',
    function(event) {

        console.error(
            'Application JavaScript error:',
            event.error ||
            event.message
        );

    }
);

window.addEventListener(
    'unhandledrejection',
    function(event) {

        console.error(
            'Unhandled Promise rejection:',
            event.reason
        );

    }
);

// =========================================================================
// INITIAL PAGE STATE
// =========================================================================
document.addEventListener(
    'DOMContentLoaded',
    () => {

        const loginScreen =
            document.getElementById(
                'loginScreen'
            );

        const mainApp =
            document.getElementById(
                'mainApp'
            );

        // Keep login screen visible initially
        if (loginScreen) {

            loginScreen.style.display =
                'flex';

        }

        if (mainApp) {

            mainApp.style.display =
                'none';

        }

        // Disable application controls until login
        [
            searchInput,
            searchButton,
            exportButton,
            exportFilteredButton,
            remarksFilter,
            typeFilter,
            photoFilter
        ].forEach(
            element => {

                if (element) {

                    element.disabled =
                        true;

                }

            }
        );

    }
);
