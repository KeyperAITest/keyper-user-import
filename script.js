console.log("✅ NEW SCRIPT LOADED – ADMIN EMAIL REQUIRED");

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

// ===== Canonical Schema =====
const fieldDefinitions = [
  { key: "firstname", label: "FirstName", required: true },
  { key: "lastname", label: "LastName", required: true },
  { key: "description", label: "Description", required: false },
  { key: "pin", label: "PIN", required: true },
  { key: "role", label: "Role", required: true },
  { key: "prox", label: "Prox", required: false },   // auto‑handled
  { key: "email", label: "Email", required: false }, // conditionally required
  { key: "phone", label: "Phone", required: false }
];

// ===== Normalize Headers =====
function normalizeHeader(h) {
  return h.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

// ===== Event Listeners =====
fileInput.addEventListener("change", handleFileUpload);
processMappedBtn.addEventListener("click", processMappedData);
downloadBtn.addEventListener("click", downloadCsv);

hideMapping();

// ===== Upload Handling =====
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
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]?.trim() || "");
    return obj;
  });

  postParse();
}

// ===== Excel =====
function readExcelFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    headers = Object.keys(rawData[0] || {});
    postParse();
  };
  reader.readAsArrayBuffer(file);
}

// ===== Post Parse =====
function postParse() {
  setSuccess(`Loaded ${rawData.length} rows.`);
  if (shouldRequireMapping()) showMappingUI();
  else autoMapSchema();
}

// ===== Schema & Completeness Check =====
function shouldRequireMapping() {
  const normalizedHeaders = headers.map(normalizeHeader);

  // Missing required fields → mapping
  for (const f of fieldDefinitions) {
    if (f.required && !normalizedHeaders.includes(f.key)) {
      return true;
    }
  }

  // Prox partially filled → mapping
  const proxHeader = headers.find(h => normalizeHeader(h) === "prox");
  if (proxHeader) {
    const hasMissingProx = rawData.some(row => !row[proxHeader]);
    if (hasMissingProx) return true;
  }

  return false;
}

// ===== Auto Mapping =====
function autoMapSchema() {
  headerMap = {};
  fieldDefinitions.forEach(f => {
    const match = headers.find(h => normalizeHeader(h) === f.key);
    headerMap[f.key] = match || "";
  });
  buildOutput();
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
  headerMap = {};
  let missing = [];

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

// ===== Build Output (Admin‑Email Enforced, Prox Unique) =====
function buildOutput() {
  outputData = [];

  // Collect existing Prox values
  const existingProx = rawData
    .map(row => {
      const source = headerMap["prox"];
      const v = source ? row[source] : "";
      return /^\d+$/.test(v) ? parseInt(v, 10) : null;
    })
    .filter(v => v !== null);

  let proxCounter = existingProx.length ? Math.max(...existingProx) + 1 : 1000;

  for (const row of rawData) {
    const out = {};

    // Pre-read role/email for cross-field validation
    let roleValue = "";
    let emailValue = "";

    // First pass: normalize role & capture email
    if (headerMap["role"]) {
      roleValue = row[headerMap["role"]] || "";
      roleValue = roleValue.toLowerCase();
      if (roleValue === "user") roleValue = "User";
      if (roleValue === "admin") roleValue = "Admin";
    }

    if (headerMap["email"]) {
      emailValue = row[headerMap["email"]] || "";
    }

    // ✅ Admin‑requires‑Email (HARD STOP)
    if (roleValue === "Admin" && !emailValue) {
      return setError("Admins must have an Email address. One or more Admin users are missing Email values.");
    }

    // Build row
    for (const f of fieldDefinitions) {
      const source = headerMap[f.key];
      let value = source ? row[source] : "";

      if (f.key === "prox" && !value) {
        value = String(proxCounter++);
      }

      if (f.key === "role") {
        value = roleValue;
      }

      if (f.key === "pin" || f.key === "prox") {
        if (!/^\d{4,}$/.test(value)) {
          return setError(`${f.label} must be numeric and at least 4 digits.`);
        }
      }

      out[f.label] = value || "";
    }

    outputData.push(out);
  }

  rowCountEl.textContent = `${outputData.length} users ready for import.`;
  setSuccess("Import‑ready CSV generated.");
  downloadCsv();
}

// ===== Download =====
function downloadCsv() {
  if (!outputData.length) return;

  const headers = fieldDefinitions.map(f => f.label);
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

// ===== Status Helpers =====
function setStatus(m) {
  statusMessage.textContent = m;
  statusMessage.style.color = "#333";
}
function setSuccess(m) {
  statusMessage.textContent = m;
  statusMessage.style.color = "green";
}
function setError(m) {
  statusMessage.textContent = m;
  statusMessage.style.color = "red";
}
function clearStatus() {
  statusMessage.textContent = "";
}
