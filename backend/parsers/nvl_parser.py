# nvl_parser.py - High Performance Parser for NVL (Name-Value List & Tab-Separated) files

import re
import json
import sys
from datetime import datetime, timedelta
import pandas as pd


def convert_excel_date(serial) -> str:
    """Convert Excel serial numbers (e.g. 45120 -> 2023-07-13) or YYYYMMDD to YYYY-MM-DD."""
    try:
        if serial is None or serial == '' or pd.isna(serial):
            return ''
        s_str = str(serial).strip()
        if not s_str:
            return ''

        # Handle decimal strings e.g. '45120.0'
        if '.' in s_str:
            try:
                s_num = float(s_str)
                if 1000 <= s_num <= 90000:
                    excel_base = datetime(1899, 12, 30)
                    date = excel_base + timedelta(days=int(s_num))
                    return date.strftime('%Y-%m-%d')
            except Exception:
                pass

        if s_str.isdigit():
            val = int(s_str)
            if len(s_str) == 8 and (s_str.startswith('19') or s_str.startswith('20')):
                return f"{s_str[:4]}-{s_str[4:6]}-{s_str[6:8]}"
            elif 1000 <= val <= 90000:
                excel_base = datetime(1899, 12, 30)
                date = excel_base + timedelta(days=val)
                return date.strftime('%Y-%m-%d')
    except Exception:
        pass
    return str(serial)


# Default 41-column structure for tab-delimited NVL customs import/export data files
DEFAULT_NVL_COLUMNS = [
    "BE_LINK", "BE_DATE", "HS_CODE", "ITEM", "IMPORTER", "NTN",
    "EXPORTER", "AGENT_NAME", "ADD1", "COUNTRY", "QTY", "GROSS",
    "NET", "UNT", "DV_FC", "FC", "DV_PAK", "AV_FC", "AV_PAK",
    "TOT_FC", "LC_NO", "LC_DATE", "BE_TYPE", "SIGN", "PORT",
    "MRK", "GROUP_LINK", "DUTY", "STAX", "ITAX", "AGENT_LINK",
    "INDEX_LINK", "INDEX_DATE", "IGM_LINK", "IGM_DATE", "COMP_LINK",
    "FRET", "ORIGIN", "SUPP", "CITY", "FOB"
]

SIX_NVL_COLUMNS = ['BE_DATE', 'ITEM', 'IMPORTER', 'EXPORTER', 'TOT_FC', 'AGENT_NAME']

REQUIRED_COLUMNS = ['Date', 'Country', 'Importer', 'Exporter', 'Total FC (USD)', 'Item']

COLUMN_MAPPING = {
    'BE_DATE': 'Date',
    'ITEM': 'Item',
    'COUNTRY': 'Country',
    'country': 'Country',
    'ORIGIN': 'Country',
    'origin': 'Country',
    'IMPORTER': 'Importer',
    'EXPORTER': 'Exporter',
    'TOT_FC': 'Total FC (USD)',
    'AGENT_NAME': 'Agent',
    'be_date': 'Date',
    'item': 'Item',
    'importer': 'Importer',
    'exporter': 'Exporter',
    'tot_fc': 'Total FC (USD)',
    'agent_name': 'Agent',
    'shipment_date': 'Date',
    'product_name': 'Item',
    'importer_name': 'Importer',
    'exporter_name': 'Exporter',
    'total_cost_usd': 'Total FC (USD)',
    'SHIP_DATE': 'Date',
    'BUYER_NAME': 'Importer',
    'SUPPLIER_NAME': 'Exporter',
    'VAL_USD': 'Total FC (USD)',
    'Customer_Name': 'Importer',
    'Supplier_Name': 'Exporter',
    'Invoice_Value': 'Total FC (USD)',
    'Drug_Class': 'Item'
}

REVERSE_MAPPING = {
    'Date': 'BE_DATE',
    'Item': 'ITEM',
    'Country': 'COUNTRY',
    'Importer': 'IMPORTER',
    'Exporter': 'EXPORTER',
    'Total FC (USD)': 'TOT_FC',
    'Agent': 'AGENT_NAME'
}


def split_line_into_cells(line: str) -> list[str]:
    """
    Split line by tabs, commas, or multiple spaces.
    """
    line_str = line.strip()
    if not line_str:
        return []

    if "\t" in line_str:
        cells = [c.strip().strip('"').strip("'") for c in line_str.split("\t")]
    elif "," in line_str:
        cells = [c.strip().strip('"').strip("'") for c in line_str.split(",")]
    elif re.search(r'\s{2,}', line_str):
        cells = [c.strip().strip('"').strip("'") for c in re.split(r'\s{2,}', line_str) if c.strip()]
    else:
        cells = [c.strip().strip('"').strip("'") for c in line_str.split() if c.strip()]

    return cells


def apply_column_mapping(df: pd.DataFrame) -> pd.DataFrame:
    """
    Renames raw column names to user-friendly column names and ensures all
    required columns exist in the DataFrame with duplicate keys for compatibility.
    """
    if df is None or df.empty:
        df = pd.DataFrame(columns=REQUIRED_COLUMNS)

    # Populate both raw and user-friendly column names in the DataFrame
    for old, new in COLUMN_MAPPING.items():
        if old in df.columns:
            if new not in df.columns or df[new].replace('', None).isna().all():
                df[new] = df[old]

    for new, old in REVERSE_MAPPING.items():
        if new in df.columns:
            if old not in df.columns or df[old].replace('', None).isna().all():
                df[old] = df[new]

    # Apply Date conversion for Excel serial numbers or YYYYMMDD formats
    date_cols = ['Date', 'BE_DATE', 'be_date', 'shipment_date', 'SHIP_DATE', 'LC_DATE', 'INDEX_DATE', 'IGM_DATE']
    for c in date_cols:
        if c in df.columns:
            df[c] = df[c].apply(convert_excel_date)

    # Ensure all required user-friendly columns exist
    for col in REQUIRED_COLUMNS:
        if col not in df.columns:
            df[col] = ''

    if 'Date' in df.columns:
        df['Date'] = df['Date'].apply(convert_excel_date)

    return df


def parse_dbf_bytes(file_bytes: bytes) -> list[dict]:
    """Parse binary DBF header and records directly from raw bytes."""
    import struct
    if len(file_bytes) < 32:
        return []

    try:
        num_records = struct.unpack('<I', file_bytes[4:8])[0]
        header_len = struct.unpack('<H', file_bytes[8:10])[0]
        record_len = struct.unpack('<H', file_bytes[10:12])[0]

        if header_len <= 0 or record_len <= 0 or header_len >= len(file_bytes):
            return []

        fields = []
        offset = 32
        while offset < header_len - 1 and file_bytes[offset] != 0x0D:
            if offset + 32 > len(file_bytes):
                break
            f_name = file_bytes[offset:offset+11].decode('ascii', errors='ignore').replace('\0', '').strip()
            f_type = chr(file_bytes[offset+11])
            f_len = file_bytes[offset+16]
            if f_name:
                fields.append({'name': f_name, 'type': f_type, 'len': f_len})
            offset += 32

        if not fields:
            return []

        records = []
        rec_offset = header_len
        calc_max = (len(file_bytes) - header_len) // record_len
        total_recs = min(num_records, calc_max) if num_records > 0 else calc_max

        for _ in range(total_recs):
            if rec_offset + record_len > len(file_bytes):
                break
            rec_bytes = file_bytes[rec_offset:rec_offset + record_len]
            rec_offset += record_len

            if rec_bytes[0] == 0x2A: # Deleted record '*'
                continue

            row = {}
            col_offset = 1
            for f in fields:
                v_str = rec_bytes[col_offset:col_offset + f['len']].decode('latin1', errors='ignore').strip()
                col_offset += f['len']

                if f['type'] == 'N':
                    try:
                        row[f['name']] = float(v_str) if '.' in v_str else int(v_str)
                    except ValueError:
                        row[f['name']] = v_str
                else:
                    row[f['name']] = v_str
            records.append(row)

        return records
    except Exception as e:
        print(f"Error reading DBF bytes: {e}")
        return []


def parse_nvl(file_input) -> pd.DataFrame:
    """
    Parse NVL file and return DataFrame with renamed columns.
    Accepts both string content and raw bytes.
    Includes comprehensive debugging print statements, error handling,
    and fallback parsing logic.
    """
    try:
        if isinstance(file_input, bytes):
            print(f"File size: {len(file_input)} bytes")
            # Try DBF binary parse first
            dbf_records = parse_dbf_bytes(file_input)
            if dbf_records:
                print(f"Successfully parsed {len(dbf_records)} records using binary DBF parser")
                df = pd.DataFrame(dbf_records)
                return apply_column_mapping(df)

            content = file_input.decode('latin1', errors='ignore')
            print(f"Decoded content length: {len(content)}")
        else:
            content = str(file_input or '')
            print(f"Content length: {len(content)}")

        if not content.strip():
            print("Warning: Empty content provided")
            df = pd.DataFrame(columns=REQUIRED_COLUMNS)
            return apply_column_mapping(df)

        lines = [line.strip() for line in content.splitlines() if line.strip()]
        print(f"Number of lines: {len(lines)}")

        if not lines:
            print("No non-empty lines found")
            df = pd.DataFrame(columns=REQUIRED_COLUMNS)
            return apply_column_mapping(df)

        first_line_cells = split_line_into_cells(lines[0])
        print(f"First line cells count: {len(first_line_cells)}, values: {first_line_cells[:6]}")

        has_header = any(
            re.search(r"BE_DATE|BE_LINK|ITEM|IMPORTER|EXPORTER|TOT_FC|AGENT_NAME|HS_CODE|Date|Item|Importer|Exporter|Total FC|Agent", p, re.IGNORECASE)
            for p in first_line_cells
        )

        if has_header:
            headers = first_line_cells
            data_lines = lines[1:]
            print(f"Header row detected: {headers}")
        else:
            data_lines = lines
            if len(first_line_cells) <= 10:
                headers = SIX_NVL_COLUMNS
                print(f"No header detected. Using 6-column default NVL headers: {headers}")
            else:
                headers = DEFAULT_NVL_COLUMNS
                print(f"No header detected. Using 41-column default NVL headers ({len(headers)} columns)")

        records = []
        for line in data_lines:
            if line.startswith("#") or line.startswith("//"):
                continue

            cells = split_line_into_cells(line)
            if not cells:
                continue

            # Key-value single line format key=value
            if len(cells) == 1 and "=" in cells[0]:
                parts = cells[0].split("=", 1)
                k = parts[0].strip()
                v = parts[1].strip().strip('"').strip("'")
                records.append({k: v})
                continue

            row_dict = {}
            for idx in range(max(len(headers), len(cells))):
                col_name = headers[idx] if idx < len(headers) else f"Column_{idx + 1}"
                val = cells[idx] if idx < len(cells) else ""
                row_dict[col_name] = val
                # Populate mapped alias directly
                if col_name in COLUMN_MAPPING:
                    row_dict[COLUMN_MAPPING[col_name]] = val

            records.append(row_dict)

        print(f"Number of records extracted: {len(records)}")

        # Merge key=value records if format was multi-line key=value
        if records and all(len(r) <= 2 for r in records) and any("=" in list(r.keys())[0] for r in records if r):
            merged_records = []
            curr = {}
            for r in records:
                k, v = list(r.items())[0]
                if k in curr:
                    merged_records.append(curr)
                    curr = {k: v}
                else:
                    curr[k] = v
            if curr:
                merged_records.append(curr)
            records = merged_records
            print(f"Merged key-value records count: {len(records)}")

        df = pd.DataFrame(records) if records else pd.DataFrame()
        print(f"DataFrame shape before mapping: {df.shape}")
        if not df.empty:
            print(f"DataFrame head before mapping:\n{df.head(2)}")
            print(f"First row dict: {df.iloc[0].to_dict()}")

        df = apply_column_mapping(df)

        print(f"Final DataFrame shape: {df.shape}")
        print(f"Final columns: {df.columns.tolist()}")

        return df

    except Exception as e:
        print(f"Error parsing NVL file: {e}")
        df = pd.DataFrame(columns=REQUIRED_COLUMNS)
        return apply_column_mapping(df)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1], "rb") as f:
            file_bytes = f.read()
            df = parse_nvl(file_bytes)
            print(df.to_json(orient="records", indent=2))
