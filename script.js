console.log("✅ SCRIPT LOADED – STRICT ERRORS FIXED");

// ===== DOM Elements =====
const fileInput = document.getElementById("fileInput");
const statusMessage = document.getElementById("statusMessage");
const mappingSection = document.getElementById("mapping-section");
const mappingContainer = document.getElementById("mappingContainer");
const processMappedBtn = document.getElementById("processMappedData");
const downloadBtn = document.getElementById("downloadCsv");
const rowCountEl = document.getElementById("rowCount");

// ===== State =====
let rawData = [];
let headers = [];
let headerMap = {};
let outputData = [];

// ===== Schema =====
const fieldDefinitions = [
  { key: "firstname", label: "FirstName", required: true },
  { key: "lastname", label: "LastName", required: true },
  { key: "description", label: "Description", required: false },
  { key: "pin", label: "PIN", required: true },
  { key: "role", label: "Role", required: true },
  { key: "prox", label: "Prox", required: false },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Phone", required: false }
];

// ===== Helpers =====
function normalizeHeader(h) {
  return h.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

// ===== Events =====
fileInput.addEventListener("change", handleFileUpload);
processMappedBtn.addEventListener("click", processMappedData);
downloadBtn.addEventListener("click", downloadCsv);

hideMapping();

// ===== Upload =====
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  clearStatus();
  hideMapping();
  outputData = [];

  setStatus(`Loading file: ${file.name}`);
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "csv") readCsvFile(file);
  else if (ext === "xls" || ext === "xlsx") readExcelFile(file);
  else setError("Unsupported file type.");
}

// ===== CSV =====
function readCsvFile(file) {
  const reader = new FileReader();
  reader.onload = e => parseCsv(e.target.result);
  reader.readAsText(file);
}

function parseCsv(text) {
  const rows = text.split(/\r?\n/).filter(r => r.trim());
  headers = rows[0].split(",").map(h => h.trim());

  rawData = rows.slice(1).map(row => {
    const values = row.split(",");
    const o = {};
    headers.forEach((h, i) => (o[h] = values[i]?.trim() || ""));
    return o;
  });

  showMappingUI();
}

// ===== Excel =====
function readExcelFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    headers = Object.keys(rawData[0] || {});
    showMappingUI();
  };
  reader.readAsArrayBuffer(file);
}

// ===== Mapping UI =====
function showMappingUI() {
  mappingContainer.innerHTML = "";
  headerMap = {};

  fieldDefinitions.forEach(f => {
    const row = document.createElement("div");

    const label = document.createElement("label");
    label.textContent = f.label + (f.required ? " *" : "");

    const select = document.createElement("select");
    select.dataset.field = f.key;

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
  let missing = [];
  headerMap = {};

  fieldDefinitions.forEach(f => {
    const val = document.querySelector(`select[data-field="${f.key}"]`).value;
    if (!val && f.required) missing.push(f.label);
    headerMap[f.key] = val || "";
  });

  if (missing.length) {
    setError("Missing required fields: " + missing.join(", "));
    return;
  }

  buildOutput();
}

// ===== Build Output (STRICT & CORRECT) =====
function buildOutput() {
  outputData = [];
  let adminEmailRows = [];
  let existingProx = [];

  // collect existing prox
  for (const row of rawData) {
    if (headerMap.prox) {
      const v = row[headerMap.prox];
      if (/^\d+$/.test(v)) existingProx.push(parseInt(v, 10));
    }
  }

  let proxCounter = existingProx.length ? Math.max(...existingProx) + 1 : 1000;

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const csvRow = i + 2;
    const out = {};

    const rawPin = row[headerMap.pin];
    const rawRole = row[headerMap.role];
    const rawEmail = headerMap.email ? row[headerMap.email] : "";

    // ✅ STRICT VALIDATION
    if (!/^\d{4,}$/.test(rawPin)) {
      setError("PIN must be numeric and at least 4 digits.");
      return;
    }

    if (!rawRole || !["user","admin"].includes(rawRole.toLowerCase())) {
      setError("Role must be User or Admin.");
      return;
    }

    const role = rawRole.toLowerCase() === "admin" ? "Admin" : "User";

    if (role === "Admin" && !rawEmail) {
      adminEmailRows.push(csvRow);
    }

    out.FirstName   = row[headerMap.firstname]   || "";
    out.LastName    = row[headerMap.lastname]    || "";
    out.Description= headerMap.description ? row[headerMap.description] || "" : "";
    out.PIN         = rawPin;
    out.Role        = role;
    out.Prox        = headerMap.prox && row[headerMap.prox]
                        ? row[headerMap.prox]
                        : String(proxCounter++);
    out.Email       = rawEmail || "";
    out.Phone       = headerMap.phone ? row[headerMap.phone] || "" : "";

    outputData.push(out);
  }

  // ✅ Admin Email Check AFTER scan
  if (adminEmailRows.length) {
    setError(
      `Admins must have an Email address. Missing Email values on rows: ${adminEmailRows.join(", ")}.`
    );
    return;
  }

  rowCountEl.textContent = `${outputData.length} users ready for import.`;
  setSuccess("Import-ready CSV generated.");
  downloadCsv();
}

// ===== Download =====
function downloadCsv() {
  if (!outputData.length) return;

  const headers = Object.keys(outputData[0]);
  const rows = outputData.map(r => headers.map(h => r[h]).join(","));
  const csv = [headers.join(","), ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "user_import.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ===== Status =====
function setStatus(m){ statusMessage.textContent = m; statusMessage.style.color="#333"; }
function setSuccess(m){ statusMessage.textContent = m; statusMessage.style.color="green"; }
function setError(m){ statusMessage.textContent = m; statusMessage.style.color="red"; }
function clearStatus(){ statusMessage.textContent=""; }
``
