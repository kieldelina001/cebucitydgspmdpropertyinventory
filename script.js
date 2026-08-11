// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
// Google Sheet CSV export link for the DGS Real Estate Inventory
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8/gviz/tq?tqx=out:csv';

let allInventoryData = [];
let filteredInventoryData = [];
let currentViewingItem = null;
let currentPhotoIndex = 0;
let currentPhotosList = [];

let currentPage = 1;
const rowsPerPage = 25;

// ==========================================
// GOOGLE AUTHENTICATION (GIS) HANDLERS
// ==========================================

// Handles the secure token response from Google Sign-In
function handleCredentialResponse(response) {
    try {
        const responsePayload = parseJwt(response.credential);
        const userEmail = responsePayload.email;
        const userName = responsePayload.name;

        console.log("Successfully authenticated as:", userEmail);

        // Hide login screen and reveal main application container
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';

        // Initialize application listeners and fetch live data
        setupSystemEventHandlers();
        loadInventoryFromGoogleSheets();

    } catch (error) {
        console.error("Authentication parsing error:", error);
        document.getElementById('loginError').textContent = "Failed to authenticate Google credentials.";
    }
}

// Helper function to securely decode the Google ID JWT token
function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        var code = ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        return '%' + code;
    }).join(''));
    return JSON.parse(jsonPayload);
}

// ==========================================
// DATA LOADING & PARSING
// ==========================================

function loadInventoryFromGoogleSheets() {
    const statusBanner = document.getElementById('statusBanner');
    statusBanner.innerHTML = '<span class="live-animated-text">🟢 Connecting to Google Sheets Live Stream...</span>';

    Papa.parse(SHEET_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            if (results.data && results.data.length > 0) {
                allInventoryData = results.data;
                filteredInventoryData = [...allInventoryData];
                
                statusBanner.innerHTML = `<span style="color: #28a745;">✅ Live Connection Active. Loaded ${allInventoryData.length} property records.</span>`;
                
                populateFilterDropdowns();
                updateDashboardMetrics();
                renderTableHeaders();
                renderTableData();
            } else {
                statusBanner.innerHTML = '<span style="color: #dc3545;">⚠️ Connected, but no records were found in the sheet.</span>';
            }
        },
        error: function(error) {
            console.error('CSV Parsing Error:', error);
            statusBanner.innerHTML = '<span style="color: #dc3545;">❌ Error connecting to live data stream. Please check network connection.</span>';
        }
    });
}

// ==========================================
// DASHBOARD & METRICS
// ==========================================

function updateDashboardMetrics() {
    const total = allInventoryData.length;
    let existing = 0;
    let notFound = 0;
    let verification = 0;
    let withPhotos = 0;
    let taxDec = 0;

    let typesCount = {
        building: 0,
        assetmod: 0,
        school: 0,
        hospital: 0,
        market: 0,
        otherInfra: 0,
        otherStruct: 0,
        park: 0,
        land: 0,
        otherLand: 0,
        flood: 0,
        water: 0,
        road: 0,
        slaughterhouse: 0
    };

    allInventoryData.forEach(row => {
        // Normalize column checks (handles variations in naming)
        const remarks = (row['Remarks'] || row['REMARKS'] || '').toUpperCase();
        const photos = (row['Photos'] || row['PHOTOS'] || row['Image'] || '').trim();
        const tdec = (row['Tax Dec'] || row['TAX DEC'] || row['Tax Declaration'] || '').trim();
        const type = (row['Type'] || row['TYPE'] || row['Property Type'] || '').toLowerCase();

        if (remarks.includes('EXISTING')) existing++;
        if (remarks.includes('NOT FOUND')) notFound++;
        if (remarks.includes('VERIFICATION') || remarks.includes('FOR VERIFICATION')) verification++;
        
        if (photos !== '' && photos.toLowerCase() !== 'n/a') withPhotos++;
        if (tdec !== '' && tdec.toLowerCase() !== 'n/a') taxDec++;

        // Type categorization matching card IDs
        if (type.includes('building modification')) typesCount.assetmod++;
        else if (type.includes('school')) typesCount.school++;
        else if (type.includes('hospital')) typesCount.hospital++;
        else if (type.includes('market')) typesCount.market++;
        else if (type.includes('park') || type.includes('plaza')) typesCount.park++;
        else if (type.includes('flood')) typesCount.flood++;
        else if (type.includes('water')) typesCount.water++;
        else if (type.includes('road')) typesCount.road++;
        else if (type.includes('slaughterhouse')) typesCount.slaughterhouse++;
        else if (type.includes('building')) typesCount.building++;
        else if (type.includes('land improvement')) typesCount.otherLand++;
        else if (type.includes('land')) typesCount.land++;
        else if (type.includes('infrastructure')) typesCount.otherInfra++;
        else typesCount.otherStruct++;
    });

    document.getElementById('countTotal').textContent = total;
    document.getElementById('countExisting').textContent = existing;
    document.getElementById('countNotFound').textContent = notFound;
    document.getElementById('countVerification').textContent = verification;
    document.getElementById('countWithPhotos').textContent = withPhotos;
    document.getElementById('countTaxDec').textContent = taxDec;

    document.getElementById('countBuilding').textContent = typesCount.building;
    document.getElementById('countAssetMod').textContent = typesCount.assetmod;
    document.getElementById('countSchool').textContent = typesCount.school;
    document.getElementById('countHospital').textContent = typesCount.hospital;
    document.getElementById('countMarket').textContent = typesCount.market;
    document.getElementById('countOtherInfra').textContent = typesCount.otherInfra;
    document.getElementById('countOtherStruct').textContent = typesCount.otherStruct;
    document.getElementById('countPark').textContent = typesCount.park;
    document.getElementById('countLand').textContent = typesCount.land;
    document.getElementById('countOtherLand').textContent = typesCount.otherLand;
    document.getElementById('countFlood').textContent = typesCount.flood;
    document.getElementById('countWater').textContent = typesCount.water;
    document.getElementById('countRoad').textContent = typesCount.road;
    document.getElementById('countSlaughterhouse').textContent = typesCount.slaughterhouse;
}

// ==========================================
// FILTERS & DROPDOWNS
// ==========================================

function populateFilterDropdowns() {
    const remarksSet = new Set();
    const typeSet = new Set();

    allInventoryData.forEach(row => {
        for (let key in row) {
            const upperKey = key.toUpperCase();
            if (upperKey.includes('REMARK') && row[key]) remarksSet.add(row[key].trim());
            if (upperKey.includes('TYPE') && row[key]) typeSet.add(row[key].trim());
        }
    });

    const remarksFilter = document.getElementById('remarksFilter');
    remarksFilter.innerHTML = '<option value="ALL">-- All Remarks --</option>';
    Array.from(remarksSet).sort().forEach(rem => {
        const opt = document.createElement('option');
        opt.value = rem;
        opt.textContent = rem;
        remarksFilter.appendChild(opt);
    });

    const typeFilter = document.getElementById('typeFilter');
    typeFilter.innerHTML = '<option value="ALL">-- All Types --</option>';
    Array.from(typeSet).sort().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeFilter.appendChild(opt);
    });
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const selectedRemark = document.getElementById('remarksFilter').value;
    const selectedType = document.getElementById('typeFilter').value;
    const selectedMedia = document.getElementById('photoFilter').value;

    filteredInventoryData = allInventoryData.filter(row => {
        // Keyword Search across all row values
        let matchesSearch = false;
        if (!searchTerm) {
            matchesSearch = true;
        } else {
            for (let key in row) {
                if (row[key] && row[key].toString().toLowerCase().includes(searchTerm)) {
                    matchesSearch = true;
                    break;
                }
            }
        }

        // Remarks Filter
        let matchesRemark = true;
        if (selectedRemark !== 'ALL') {
            matchesRemark = false;
            for (let key in row) {
                if (key.toUpperCase().includes('REMARK') && row[key] && row[key].trim() === selectedRemark) {
                    matchesRemark = true;
                    break;
                }
            }
        }

        // Type Filter
        let matchesType = true;
        if (selectedType !== 'ALL') {
            matchesType = false;
            for (let key in row) {
                if (key.toUpperCase().includes('TYPE') && row[key] && row[key].trim() === selectedType) {
                    matchesType = true;
                    break;
                }
            }
        }

        // Media Filter
        let matchesMedia = true;
        const photoVal = (row['Photos'] || row['PHOTOS'] || '').trim();
        const taxDecVal = (row['Tax Dec'] || row['TAX DEC'] || '').trim();
        
        if (selectedMedia === 'WITH_PHOTO') {
            matchesMedia = (photoVal !== '' && photoVal.toLowerCase() !== 'n/a');
        } else if (selectedMedia === 'NO_PHOTO') {
            matchesMedia = (photoVal === '' || photoVal.toLowerCase() === 'n/a');
        } else if (selectedMedia === 'WITH_TAX_DEC') {
            matchesMedia = (taxDecVal !== '' && taxDecVal.toLowerCase() !== 'n/a');
        }

        return matchesSearch && matchesRemark && matchesType && matchesMedia;
    });

    currentPage = 1;
    renderTableData();
}

// ==========================================
// TABLE RENDERING & PAGINATION
// ==========================================

function renderTableHeaders() {
    const headerRow = document.getElementById('tableHeaderRow');
    headerRow.innerHTML = '';

    if (allInventoryData.length === 0) return;

    // Add Action column header
    const actionTh = document.createElement('th');
    actionTh.textContent = 'Action';
    headerRow.appendChild(actionTh);

    const firstRow = allInventoryData[0];
    Object.keys(firstRow).forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        headerRow.appendChild(th);
    });
}

function renderTableData() {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    const foundCountDisplay = document.getElementById('foundCountDisplay');
    foundCountDisplay.textContent = `(Showing ${filteredInventoryData.length} of ${allInventoryData.length} records)`;

    if (filteredInventoryData.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="100" class="no-data">No matching property records found.</td>`;
        tableBody.appendChild(tr);
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }

    // Pagination calculations
    const totalPages = Math.ceil(filteredInventoryData.length / rowsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = filteredInventoryData.slice(startIndex, endIndex);

    paginatedData.forEach((row, index) => {
        const tr = document.createElement('tr');

        // Action Button Cell (Opens modal details)
        const actionTd = document.createElement('td');
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View';
        viewBtn.className = 'export-btn';
        viewBtn.style.padding = '4px 8px';
        viewBtn.style.fontSize = '12px';
        viewBtn.style.marginBottom = '0';
        viewBtn.onclick = () => openPropertyModal(startIndex + index);
        actionTd.appendChild(viewBtn);
        tr.appendChild(actionTd);

        Object.keys(row).forEach(key => {
            const td = document.createElement('td');
            td.textContent = row[key];
            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });

    // Update Pagination UI
    const paginationContainer = document.getElementById('paginationContainer');
    if (totalPages > 1) {
        paginationContainer.style.display = 'flex';
        document.getElementById('pageIndicator').textContent = `Page ${currentPage} of ${totalPages}`;
        document.getElementById('prevPageBtn').disabled = (currentPage === 1);
        document.getElementById('nextPageBtn').disabled = (currentPage === totalPages);
    } else {
        paginationContainer.style.display = 'none';
    }
}

// ==========================================
// MODAL & PROPERTY DETAILS VIEWER
// ==========================================

function openPropertyModal(dataIndex) {
    currentViewingItem = filteredInventoryData[dataIndex];
    const modalFormContainer = document.getElementById('modalFormContainer');
    modalFormContainer.innerHTML = '';

    const modalLayout = document.createElement('div');
    modalLayout.className = 'modal-flex-layout';

    // Fields Side
    const fieldsSide = document.createElement('div');
    fieldsSide.className = 'modal-fields-side';

    Object.keys(currentViewingItem).forEach(key => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'modal-field';

        const label = document.createElement('label');
        label.textContent = key;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentViewingItem[key] || '';
        input.readOnly = true;
        input.dataset.key = key;

        fieldDiv.appendChild(label);
        fieldDiv.appendChild(input);
        fieldsSide.appendChild(fieldDiv);
    });

    // Photo Side
    const photoSide = document.createElement('div');
    photoSide.className = 'modal-photo-side';

    const photoContainer = document.createElement('div');
    photoContainer.className = 'modal-photo-container';

    // Extract photos (comma separated or single link)
    const rawPhotos = currentViewingItem['Photos'] || currentViewingItem['PHOTOS'] || currentViewingItem['Image'] || '';
    currentPhotosList = rawPhotos.split(',').map(p => p.trim()).filter(p => p !== '' && p.toLowerCase() !== 'n/a');
    currentPhotoIndex = 0;

    const imgElem = document.createElement('img');
    imgElem.id = 'modalActivePhoto';
    imgElem.alt = 'Property Image Preview';

    const captionElem = document.createElement('div');
    captionElem.className = 'photo-caption';
    captionElem.id = 'photoCaption';

    if (currentPhotosList.length > 0) {
        imgElem.src = currentPhotosList[0];
        captionElem.textContent = `Photo 1 of ${currentPhotosList.length}`;
    } else {
        imgElem.src = '';
        captionElem.textContent = 'No photos available';
        imgElem.style.display = 'none';
    }

    photoContainer.appendChild(imgElem);

    // Navigation arrows if multiple photos
    if (currentPhotosList.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'photo-nav-btn photo-prev-btn';
        prevBtn.innerHTML = '&#10094;';
        prevBtn.onclick = () => changeModalPhoto(-1);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'photo-nav-btn photo-next-btn';
        nextBtn.innerHTML = '&#10095;';
        nextBtn.onclick = () => changeModalPhoto(1);

        photoContainer.appendChild(prevBtn);
        photoContainer.appendChild(nextBtn);
    }

    photoSide.appendChild(photoContainer);
    photoSide.appendChild(captionElem);

    modalLayout.appendChild(fieldsSide);
    modalLayout.appendChild(photoSide);
    modalFormContainer.appendChild(modalLayout);

    document.getElementById('editModal').style.display = 'flex';
}

function changeModalPhoto(direction) {
    if (currentPhotosList.length === 0) return;
    currentPhotoIndex += direction;
    if (currentPhotoIndex < 0) currentPhotoIndex = currentPhotosList.length - 1;
    if (currentPhotoIndex >= currentPhotosList.length) currentPhotoIndex = 0;

    const imgElem = document.getElementById('modalActivePhoto');
    const captionElem = document.getElementById('photoCaption');
    imgElem.style.display = 'block';
    imgElem.src = currentPhotosList[currentPhotoIndex];
    captionElem.textContent = `Photo ${currentPhotoIndex + 1} of ${currentPhotosList.length}`;
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

function exportTableData(dataToExport, filename) {
    if (!dataToExport || dataToExport.length === 0) {
        alert("No data available to export.");
        return;
    }
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// EVENT LISTENERS & SETUP
// ==========================================

function setupSystemEventHandlers() {
    // Search input & button
    document.getElementById('searchButton').onclick = applyFilters;
    document.getElementById('searchInput').onkeyup = function(e) {
        if (e.key === 'Enter') applyFilters();
    };

    // Filter change events
    document.getElementById('remarksFilter').onchange = applyFilters;
    document.getElementById('typeFilter').onchange = applyFilters;
    document.getElementById('photoFilter').onchange = applyFilters;

    // Export buttons
    document.getElementById('exportButton').onclick = () => exportTableData(allInventoryData, 'real_estate_inventory_all.csv');
    document.getElementById('exportFilteredButton').onclick = () => exportTableData(filteredInventoryData, 'real_estate_inventory_searched.csv');

    // Modal Close handlers
    const closeModal = () => { document.getElementById('editModal').style.display = 'none'; };
    document.getElementById('modalCloseBtn').onclick = closeModal;
    document.getElementById('modalCloseX').onclick = closeModal;
    document.getElementById('editModal').onclick = (e) => {
        if (e.target === document.getElementById('editModal')) closeModal();
    };

    // Pagination buttons
    document.getElementById('prevPageBtn').onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderTableData();
            window.scrollTo({ top: 400, behavior: 'smooth' });
        }
    };
    document.getElementById('nextPageBtn').onclick = () => {
        const totalPages = Math.ceil(filteredInventoryData.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTableData();
            window.scrollTo({ top: 400, behavior: 'smooth' });
        }
    };

    // Back to top & scroll visibility
    const backToTopBtn = document.getElementById('backToTopBtn');
    window.onscroll = () => {
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            backToTopBtn.style.visibility = 'visible';
            backToTopBtn.style.opacity = '1';
        } else {
            backToTopBtn.style.visibility = 'hidden';
            backToTopBtn.style.opacity = '0';
        }
    };
    backToTopBtn.onclick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}
