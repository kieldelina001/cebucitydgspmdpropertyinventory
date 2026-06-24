// 🔑 Google Sheets Cloud Gateway Architecture
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrqoIQ1yjd5XiGIPb9FLnxLI2LTgNJFV1ug-klApiKfNScxd_CX07o2nYYk_4lnvTBPw/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

const displayHeaders = ["Article", "Description", "Acquisition Date", "Unit Value", "Remarks", "Type", "Photo 1", "Photo 2", "Map Coordinates", "UPDATED BY", "LAST UPDATE"];
const targetHeadersLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type", "photo 1", "photo 2", "map coordinates", "updated by", "last update"];
const popupOrderLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type"]; 

let inventoryData = []; 
let currentFilteredData = []; 
let rawHeaders = [];       
let headerMapping = {}; 
let activeEditIndex = null; 
let parsedUniqueRemarks = []; 
let isAppInitialized = false;

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

// ... (Rest of your initialization and helper functions remain exactly the same) ...
// (Loading and Modal code excluded here for brevity, keep your existing logic for those)

// EXPORT TO HTML (Visual & Print Optimized)
function exportToHTML(data, title) {
    if(data.length === 0) { alert("No data available to export."); return; }
    
    let tableHTML = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { color: #1e293b; font-size: 28px; }
            .print-btn { display: block; margin: 0 auto 20px; padding: 15px 30px; font-size: 18px; font-weight: bold; background-color: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; }
            
            table { width: 100%; border-collapse: collapse; background-color: white; table-layout: fixed; }
            th, td { border: 1px solid #333; padding: 10px; font-size: 20px; vertical-align: middle; word-wrap: break-word; }
            th { background-color: #e2e8f0; font-weight: bold; }
            
            .photo-cell { text-align: center; }
            img { max-width: 100%; max-height: 250px; object-fit: contain; }
            
            /* Prioritizing width for photos and descriptive columns */
            th:nth-child(1), td:nth-child(1) { width: 6%; }
            th:nth-child(2), td:nth-child(2) { width: 18%; }
            th:nth-child(3), td:nth-child(3) { width: 8%; }
            th:nth-child(4), td:nth-child(4) { width: 7%; }
            th:nth-child(5), td:nth-child(5) { width: 8%; }
            th:nth-child(6), td:nth-child(6) { width: 7%; }
            th:nth-child(7), td:nth-child(7) { width: 13%; }
            th:nth-child(8), td:nth-child(8) { width: 13%; }
            th:nth-child(9), td:nth-child(9) { width: 13%; }
            th:nth-child(10), td:nth-child(10) { width: 4%; }
            th:nth-child(11), td:nth-child(11) { width: 4%; }
            
            @media print { 
                @page { size: landscape; margin: 10mm; }
                .print-btn { display: none; } 
                body { background-color: white; }
            }
        </style>
    </head>
    <body>
        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <div class="header"><h1>${title}</h1></div>
        <table><thead><tr>`;
    
    displayHeaders.forEach(h => { tableHTML += `<th>${h}</th>`; });
    tableHTML += `</tr></thead><tbody>`;
    
    data.forEach(row => {
        tableHTML += `<tr>`;
        targetHeadersLowercase.forEach(tKey => {
            const resolvedKey = headerMapping[tKey];
            const val = resolvedKey ? (row[resolvedKey] || '') : '';
            if (tKey.includes('photo') || tKey.includes('map coordinates')) {
                const imgUrl = getDirectImageUrl(val, 'w1000-h1000') || val;
                if (imgUrl.trim() !== '' && imgUrl.startsWith('http')) {
                    tableHTML += `<td class="photo-cell"><img src="${imgUrl}" /></td>`;
                } else {
                    tableHTML += `<td class="photo-cell">N/A</td>`;
                }
            } else {
                tableHTML += `<td>${val}</td>`;
            }
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table></body></html>`;

    const blob = new Blob([tableHTML], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}_${new Date().getTime()}.html`;
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}
