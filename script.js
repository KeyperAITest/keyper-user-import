// ===== DOM Elements =====
const fileInput = document.getElementById("fileInput");
const statusMessage = document.getElementById("statusMessage");

let rawData = [];
let headers = [];

// ===== Event Listeners =====
fileInput.addEventListener("change", handleFileUpload);

// ===== File Upload Handler =====
function handleFileUpload(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    clearStatus();
    setStatus(`Loading file: ${file.name}`);

    const fileExtension = file.name.split(".").pop().toLowerCase();

    if (fileExtension === "csv") {
        readCsvFile(file);
    } else if (fileExtension === "xls" || fileExtension === "xlsx") {
        readExcelFile(file);
    } else {
        setError("Unsupported file type. Please upload a CSV or Excel file.");
    }
}

// ===== CSV Parsing =====
function readCsvFile(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        const text = e.target.result;
        parseCsv(text);
    };

    reader.onerror = function () {
        setError("Failed to read CSV file.");
    };

    reader.readAsText(file);
}

function parseCsv(text) {
    const rows = text.split(/\r?\n/).filter(row => row.trim() !== "");

    if (rows.length < 2) {
        setError("CSV file appears to be empty or missing data.");
        return;
    }

    headers = rows[0].split(",").map(h => h.trim());
    rawData = rows.slice(1).map(row => {
        const values = row.split(",");
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index]?.trim() || "";
        });
        return obj;
    });

    setSuccess(`Loaded ${rawData.length} rows from CSV file.`);
    console.log("Headers:", headers);
    console.log("Data:", rawData);
}

// ===== Excel Parsing (XLS / XLSX) =====
function readExcelFile(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });

            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                defval: ""
            });

            if (jsonData.length === 0) {
                setError("Excel file contains no data.");
                return;
            }

            headers = Object.keys(jsonData[0]);
            rawData = jsonData;

            setSuccess(`Loaded ${rawData.length} rows from Excel file.`);
            console.log("Headers:", headers);
            console.log("Data:", rawData);

        } catch (error) {
            console.error(error);
            setError("Failed to parse Excel file.");
        }
    };

    reader.onerror = function () {
        setError("Failed to read Excel file.");
    };

    reader.readAsArrayBuffer(file);
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
