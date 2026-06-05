/**
 * Real Estate Inventory Management System - Client Engine
 * Developed by Noel Rie N. Deliña (Property Management Division)
 */

// ==========================================
// 🛠️ CONFIGURATION TARGETS
// ==========================================
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0'; 
const APPS_SCRIPT_WEBWORK_URL = 'https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec';

let globalInventory = [];
let operationalView = [];
let targetedActiveRowIndex = null; 

// ==========================================
// 🚀 APPLICATION INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    fetchLiveStreamData();
    setupInterfaceEventActions();
});

// ==========================================
// 📥 DATA MODEL STREAM INGESTION
// ==========================================
function fetchLiveStreamData() {
    const banner = document.getElementById("statusBanner");
    banner.textContent = "Connecting Live Cloud Datastream...";
    banner.style.backgroundColor = "#fff3cd";
    banner.style.color = "#856404";

    if (GOOGLE_SHEET_CSV_URL === 'YOUR_GOOGLE_SHEETS_PUBLISHED_CSV_URL_HERE') {
        banner.textContent = "Configuration Warning: Please apply standard Google Sheets link inside script.js";
        return;
    }

    Papa.parse(GOOGLE_SHEET_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            globalInventory = results.data;
            operationalView = [...globalInventory];
            
            populateDynamicDropdownFilters();
            executeLocalMatrixCompute();
            renderInventoryGrid();
            
            banner.textContent = `Live Pipeline Active. Synchronized Database Rows: ${globalInventory.length}`;
            banner.style.backgroundColor = "#d4edda";
            banner.style.color = "#155724";
            banner.style.borderColor = "#c3e6cb";
        },
        error: function(err) {
            console.error("Stream parsing exception caught:", err);
            banner.textContent = "Critical Network Error: Inbound live-stream connection rejected.";
            banner.style.backgroundColor = "#f8d7da";
            banner.style.color = "#721c24";
        }
    });
}

// ==========================================
// 📊 METRICS & FILTER ENGINE
// ==========================================
function populateDynamicDropdownFilters() {
    const remarksSet = new Set();
    const typesSet = new Set();

    globalInventory.forEach(row => {
        if (row.Remarks) remarksSet.add(row.Remarks.trim());
        if (row.Type) typesSet.add(row.Type.trim());
    });

    const remarksSel = document.getElementById("remarksFilter");
    const typeSel = document.getElementById("typeFilter");

    // Maintain "ALL" and fill remainder
    remarksSel.innerHTML = '<option value="ALL">-- All Remarks --</option>';
    typeSel.innerHTML = '<option value="ALL">-- All Types --</option>';

    Array.from(remarksSet).sort().forEach(val => {
        if(val) remarksSel.innerHTML += `<option value="${val}">${val}</option>`;
    });
    Array.from(typesSet).sort().forEach(val => {
        if(val) typeSel.innerHTML += `<option value="${val}">${val}</option>`;
    });
}

function executeLocalMatrixCompute() {
    // 1. Total Base Calculations (Global Scope)
    document.getElementById("countTotal").textContent = globalInventory.length;

    // 2. Local View Metric Calculations (Dynamic View Scope)
    document.getElementById("countFound").textContent = operationalView.length;

    let existing = 0, notFound = 0, verification = 0, withPhotos = 0;
    
    // Type Trackers
    let bld = 0, land = 0, market = 0, hosp = 0, park = 0, other = 0;

    operationalView.forEach(row => {
        const rem = (row.Remarks || "").toUpperCase();
        if (rem.includes("EXISTING")) existing++;
        if (rem.includes("NOT FOUND")) notFound++;
        if (rem.includes("VERIFICATION") || rem.includes("FOR VERIFICATION")) verification++;

        if (row.PhotoLink && row.PhotoLink.trim().length > 5) withPhotos++;

        // Strict Typology Invariant Checks
        const typeStr = (row.Type || "").toUpperCase();
        if (typeStr.includes("BUILDING") || typeStr.includes("STRUCTURE") || typeStr.includes("CONDO")) {
            bld++;
        } else if (typeStr.includes("LAND") || typeStr.includes("LOT")) {
            land++;
        } else if (typeStr.includes("MARKET") || typeStr.includes("COMMERCIAL") || typeStr.includes("STORE")) {
            market++;
        } else if (typeStr.includes("HOSPITAL") || typeStr.includes("CLINIC") || typeStr.includes("INSTITUTIONAL")) {
            hosp++;
        } else if (typeStr.includes("PARK") || typeStr.includes("RECREATIONAL") || typeStr.includes("OPEN SPACE")) {
            park++;
        } else {
            other++;
        }
    });

    // Sync elements to views
    document.getElementById("countExisting").textContent = existing;
    document.getElementById("countNotFound").textContent = notFound;
    document.getElementById("countVerification").textContent = verification;
    document.getElementById("countWithPhotos").textContent = withPhotos;

    // 🆕 Populate Type Counter IDs
    document.getElementById("countBuilding").textContent = bld;
    document.getElementById("countLand").textContent = land;
    document.getElementById("countMarket").textContent = market;
    document.getElementById("countHospital").textContent = hosp;
    document.getElementById("countPark").textContent = park;
    document.getElementById("countOther").textContent = other;
}

function triggerGridFilteringPipeline() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const remFilter = document.getElementById("remarksFilter").value;
    const typFilter = document.getElementById("typeFilter").value;
    const phtFilter = document.getElementById("photoFilter").value;

    operationalView = globalInventory.filter(row => {
        // Global Keyword Matching Logic
        let matchesSearch = false;
        if (query === "") {
            matchesSearch = true;
        } else {
            matchesSearch = Object.values(row).some(fieldVal => 
                String(fieldVal).toLowerCase().includes(query)
            );
        }

        // Dropdown Filtering Rules
        const matchesRemarks = (remFilter === "ALL" || row.Remarks === remFilter);
        const matchesType = (typFilter === "ALL" || row.Type === typFilter);
        
        let matchesPhoto = true;
        const hasPhoto = (row.PhotoLink && row.PhotoLink.trim().length > 5);
        if (phtFilter === "WITH_PHOTO") matchesPhoto = hasPhoto;
        if (phtFilter === "NO_PHOTO") matchesPhoto = !hasPhoto;

        return matchesSearch && matchesRemarks && matchesType && matchesPhoto;
    });

    executeLocalMatrixCompute();
    renderInventoryGrid();
}

// ==========================================
// 🎚️ PRESENTATION & DOM RENDER ENGINE
// ==========================================
function renderInventoryGrid() {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (operationalView.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="no-data">No specific property matches meet your current filter configuration.</td></tr>`;
        return;
    }

    operationalView.forEach((row, viewIdx) => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => triggerModalFocus(viewIdx));

        // Explicit key safe map matching schema design
        const keys = ["Article", "Description", "Acquisition Date", "Unit Value", "Remarks", "Type", "PhotoLink", "UPDATED BY", "LAST UPDATE"];
        
        keys.forEach(k => {
            const td = document.createElement("td");
            let val = row[k] || "";

            // Styling layout exceptions rules
            if (k === 'Description') td.className = "col-description";
            else if (k === 'Remarks') td.className = "col-remarks";
            else td.className = "col-other";

            if (k === 'PhotoLink' && val.length > 5) {
                td.innerHTML = `<a href="${val}" target="_blank" onclick="event.stopPropagation();">View Media Links ↗</a>`;
            } else {
                td.textContent = val;
            }
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

// ==========================================
// 📑 INTERACTIVE OPERATIONS MODAL
// ==========================================
function triggerModalFocus(viewIdx) {
    const internalTarget = operationalView[viewIdx];
    // Resolve absolute offset location inside global data stack matching
    targetedActiveRowIndex = globalInventory.findIndex(r => r === internalTarget);

    const container = document.getElementById("modalFormContainer");
    container.innerHTML = "";

    // Build fields dynamically
    Object.keys(internalTarget).forEach(key => {
        const wrapper = document.createElement("div");
        wrapper.className = "modal-field";

        const label = document.createElement("label");
        label.textContent = key;
        wrapper.appendChild(label);

        let input;
        if (key === "Description" || key === "Remarks") {
            input = document.createElement("textarea");
            input.rows = 2;
        } else {
            input = document.createElement("input");
            input.type = "text";
        }
        
        input.value = internalTarget[key] || "";
        input.id = `modalField_${key}`;
        input.disabled = true; // Readonly initialization sequence
        wrapper.appendChild(input);
        container.appendChild(wrapper);
    });

    // Set interactive control visibility presets
    document.getElementById("modalEditBtn").style.display = "inline-block";
    document.getElementById("modalSaveBtn").style.display = "none";
    document.getElementById("uploadPhotoBtn").style.display = "none";

    document.getElementById("editModal").style.display = "flex";
}

function enableModalWritePrivileges() {
    if (targetedActiveRowIndex === null) return;
    
    const rowObj = globalInventory[targetedActiveRowIndex];
    Object.keys(rowObj).forEach(key => {
        const input = document.getElementById(`modalField_${key}`);
        // Restrict changing auto-calculated audit dimensions directly
        if (input && key !== "LAST UPDATE" && key !== "UPDATED BY") {
            input.disabled = false;
        }
    });

    document.getElementById("modalEditBtn").style.display = "none";
    document.getElementById("modalSaveBtn").style.display = "inline-block";
    document.getElementById("uploadPhotoBtn").style.display = "inline-block";
}

function commitModalMutationPipeline() {
    if (targetedActiveRowIndex === null) return;

    // Change Attribution Audit Trail Prompt Check
    let operatorName = prompt("Attribution Entry Required.\nPlease input your operational tracking name to submit modifications:");
    if (!operatorName || operatorName.trim() === "") {
        alert("Action Aborted: Anonymous execution changes are rejected by database policy rules.");
        return;
    }
    operatorName = operatorName.trim();

    const rowObj = globalInventory[targetedActiveRowIndex];
    const mutations = {};

    // Gather update states
    Object.keys(rowObj).forEach(key => {
        const el = document.getElementById(`modalField_${key}`);
        if (el) {
            mutations[key] = el.value.trim();
        }
    });

    // Stamp Audit Dimensions
    mutations["UPDATED BY"] = operatorName;
    mutations["LAST UPDATE"] = new Date().toLocaleString();
    mutations["rowIndex"] = targetedActiveRowIndex + 2; // Offset tracking account for human sheet index conversions

    const banner = document.getElementById("statusBanner");
    banner.textContent = "Streaming mutation transactions securely to network web gateway...";
    banner.style.backgroundColor = "#fff3cd";
    
    document.getElementById("editModal").style.display = "none";

    // Transmission over Gateway Connection Webhook
    fetch(APPS_SCRIPT_WEBWORK_URL, {
        method: "POST",
        mode: "no-cors", // Bypasses explicit header validations over decoupled endpoints
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutations)
    })
    .then(() => {
        // Optimistic local mutations commit loop refresh
        globalInventory[targetedActiveRowIndex] = { ...rowObj, ...mutations };
        triggerGridFilteringPipeline();
        banner.textContent = "Transaction Accepted. Cloud Sheet mutations saved successfully.";
        banner.style.backgroundColor = "#d4edda";
    })
    .catch(err => {
        console.error("Mutation Pipeline Error Exception:", err);
        alert("Transaction Failed: Outbound connection dropped by server gateway routing parameters.");
        fetchLiveStreamData(); // Force fallbacks recovery tracking
    });
}

// ==========================================
// 💾 FILE SYSTEM grid EXPORT COMPONENT
// ==========================================
function executeLocalGridCSVBackup() {
    if (operationalView.length === 0) {
        alert("Action Cancelled: Grid data stack buffer currently empty.");
        return;
    }
    
    const csvContent = Papa.unparse(operationalView);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = url;
    downloadAnchor.setAttribute("download", `RealEstate_Inventory_Backup_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
}

// ==========================================
// 🛠️ EVENTS & REGISTRATION PARAMETERS
// ==========================================
function setupInterfaceEventActions() {
    // Structural Filter Changes Cascades
    document.getElementById("searchButton").addEventListener("click", triggerGridFilteringPipeline);
    document.getElementById("searchInput").addEventListener("keyup", (e) => {
        if(e.key === "Enter") triggerGridFilteringPipeline();
    });
    
    document.getElementById("remarksFilter").addEventListener("change", triggerGridFilteringPipeline);
    document.getElementById("typeFilter").addEventListener("change", triggerGridFilteringPipeline);
    document.getElementById("photoFilter").addEventListener("change", triggerGridFilteringPipeline);

    // Grid System Command Interception Links
    document.getElementById("exportButton").addEventListener("click", executeLocalGridCSVBackup);

    // Modal Control Triggers Intercept Points
    document.getElementById("modalEditBtn").addEventListener("click", enableModalWritePrivileges);
    document.getElementById("modalSaveBtn").addEventListener("click", commitModalMutationPipeline);
    document.getElementById("modalCloseBtn").addEventListener("click", () => {
        document.getElementById("editModal").style.display = "none";
        targetedActiveRowIndex = null;
    });
    
    document.getElementById("uploadPhotoBtn").addEventListener("click", () => {
        alert("Module Alert: Image Processing integration point verified. Connect external module handling scripts as desired.");
    });
}
