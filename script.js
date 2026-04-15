console.log("✅ NEW SCRIPT LOADED – MAPPING UI VERSION");

// ===== DOM Elements =====
const fileInput = document.getElementById("fileInput");
const statusMessage = document.getElementById("statusMessage");
const mappingSection = document.getElementById("mapping-section");
const mappingContainer = document.getElementById("mappingContainer");
const processMappedBtn = document.getElementById("processMappedData");

let rawData = [];
let headers = [];
let headerMap = {};

// ===== Field Definitions =====
const fieldDefinitions = [
    { key: "firstname", label: "First Name", required: true },
    { key: "lastname", label: "Last Name", required: true },
    { key: "description", label: "Description", required: false },
    { key: "pin", label: "PIN", required: true },
    { key: "role", label: "Role", required: true },
    { key: "prox", label: "Prox", required: true },
    { key: "email", label: "Email", required: true },
    { key: "phone", label: "Phone", required: true },
    { key: "saml", label: "SAML ID", required: false }
];

// ===== Header Normalization =====
function normalizeHeader(header) {
    return header
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/g, "");
}

// ===== Event Listeners =====
fileInput.addEventListener("change", handleFileUpload);
processMappedBtn.addEventListener("click", processMappedData);

// Ensure mapping UI is hidden on load
hideMapping();

// ===== File Upload Handler =====
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    clearStatus();
    hideMapping();

    setStatus(`Loading file: ${file.name}`);
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv") readCsvFile(file);
    else if (ext === "xls" || ext === "xlsx") readExcelFile(file);
    else setError("Unsupported file type.");
}

// ===== CSV Parsing =====
function readCsvFile(file) {
    const reader = new FileReader();
    reader.onload = e => parseCsv(e.target.result);
    reader.onerror = () => setError("Failed to read CSV file.");
    reader.readAsText(file);
}

function parseCsv(text) {
    const rows = text.split(/\r?\n/).filter(r => r.trim());
    headers = rows[0].split(",").map(h => h.trim());

    rawData = rows.slice(1).map(row => {
        const values = row.split(",");
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i]?.trim() || "");
        return obj;
    });

    postParse("CSV");
}

// ===== Excel Parsing =====
function readExcelFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        headers = Object.keys(rawData[0] || {});
        postParse("Excel");
    };
    reader.readAsArrayBuffer(file);
}

// ===== Post-Parse =====
function postParse(type) {
    setSuccess(`Loaded ${rawData.length} rows from ${type} file.`);
    console.log("Headers:", headers);
    console.log("Data:", rawData);

    if (!checkSchemaMatch()) {
        showMappingUI();
    }
}

// ===== Schema Detection =====
function checkSchemaMatch() {
    const normalized = headers.map(normalizeHeader);
    const missing = fieldDefinitions
        .filter(f => !normalized.includes(f.key))
        .map(f => f.key);

    if (missing.length === 0) {
        setSuccess("File matches User Import schema. No column mapping required.");
        console.log("Schema match confirmed.");
        return true;
    }

    console.warn("Schema mismatch. Missing headers:", missing);
    setStatus("File does not match expected format. Column mapping will be required.");
    return false;
}

// ===== Mapping UI =====
function showMappingUI() {
    mappingContainer.innerHTML = "";
    headerMap = {};

    fieldDefinitions.forEach(field => {
        const row = document.createElement("div");

        const label = document.createElement("label");
        label.textContent = field.label + (field.required ? " *" : "");

        const select = document.createElement("select");
        select.dataset.field = field.key;

        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "-- Select Column --";
        select.appendChild(empty);

        headers.forEach(h => {
            const opt = document.createElement("option");
            opt.value = h;
            opt.textContent = h;
            select.appendChild(opt);
        });

        row.appendChild(label);
        row.appendChild(select);
        mappingContainer.appendChild(row);
    });

    mappingSection.classList.remove("hidden");
}

function hideMapping() {
    mappingSection.classList.add("hidden");
}

// ===== Process Mapping =====
function processMappedData() {
    headerMap = {};
    let missingRequired = [];

    fieldDefinitions.forEach(field => {
        const select = document.querySelector(`select[data-field="${field.key}"]`);
        const value = select.value;

        if (!value && field.required) {
            missingRequired.push(field.label);
        }

        headerMap[field.key] = value || "";
    });

    if (missingRequired.length) {
        setError("Missing required mappings: " + missingRequired.join(", "));
        return;
    }

    setSuccess("Column mapping accepted. Ready to generate import file.");
    console.log("Header Map:", headerMap);
}

// ===== Status Helpers =====
function setStatus(message) {
    statusMessage.textContent = message;
    statusMessage.style.color = "#333";
}

function setSuccess(message) {
    statusMessage.textContent = message;
    statusMessage.style.color = "green";
}

function setError(message) {
    statusMessage.textContent = message;
    statusMessage.style.color = "red";
}

function clearStatus() {
    statusMessage.textContent = "";
}
``
