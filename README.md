## User Import File Formatter

This tool accepts CSV or Excel user files in arbitrary formats and converts them
into a canonical, import‑ready CSV for Keyper user imports.

## Accepted Input

- CSV, XLS, XLSX
- Files may contain extra columns
- Column order does not matter
- Header names do not need to match exactly

## Canonical Output Format

Output columns (in this exact order):

FirstName,
LastName,
Description,
KeyboardPassword(PIN),
Role,
Prox Password,
Email,
PhoneNumber,
SAML ID

## Required Fields

- FirstName
- LastName
- KeyboardPassword (PIN)
- Role
- Prox Password
- Email
- PhoneNumber

## Optional Fields

- Description
- SAML ID

- ## Validation Rules

### PIN (KeyboardPassword)
- Required
- Numeric only
- Minimum 4 digits

### Role
- Required
- Must be exactly: User or Admin
- Case‑sensitive

### Prox Password
- Required (even if Prox is not used)
- Numeric only
- Minimum 4 digits
- Common practice: start at 1000 and increment by 1

### Description
- Optional
- Free‑text

### SAML ID
- Optional
- Passed through as‑is if present

- ## Blocking Conditions

The formatter will block and show errors if:
- Any required field is missing
- PIN is less than 4 digits or non‑numeric
- Prox Password is less than 4 digits or non‑numeric
- Role is not exactly "User" or "Admin"

