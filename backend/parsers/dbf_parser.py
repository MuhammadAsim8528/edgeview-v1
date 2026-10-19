# dbf_parser.py - Parser for DBF (dBase / FoxPro) files

import sys
import json
import struct

def parse_dbf_bytes(data: bytes):
    """
    Direct binary DBF parser without external dependencies.
    Reads DBF header, field descriptors, and record records.
    """
    if len(data) < 32:
        return []

    # DBF Header: 32 bytes
    version, year, month, day, num_records, header_len, record_len = struct.unpack('<BBBBIHH', data[:12])
    
    # Field descriptors start at offset 32 and are 32 bytes each
    fields = []
    offset = 32
    while offset < header_len - 1 and data[offset] != 0x0D:
        field_bytes = data[offset:offset+32]
        if len(field_bytes) < 32:
            break
        name = field_bytes[:11].replace(b'\x00', b'').decode('ascii', errors='ignore').strip()
        f_type = chr(field_bytes[11])
        f_len = field_bytes[16]
        fields.append({'name': name, 'type': f_type, 'len': f_len})
        offset += 32

    records = []
    rec_offset = header_len

    for _ in range(num_records):
        if rec_offset + record_len > len(data):
            break
        record_data = data[rec_offset:rec_offset + record_len]
        rec_offset += record_len

        # First byte: '*' means deleted, ' ' means active
        if record_data and record_data[0] == 0x2A: # '*'
            continue

        row = {}
        col_offset = 1 # Skip deletion flag byte
        for f in fields:
            val_bytes = record_data[col_offset:col_offset + f['len']]
            val_str = val_bytes.decode('utf-8', errors='ignore').strip()
            col_offset += f['len']

            # Basic type conversion
            if f['type'] == 'N':
                try:
                    if '.' in val_str:
                        row[f['name']] = float(val_str)
                    else:
                        row[f['name']] = int(val_str)
                except ValueError:
                    row[f['name']] = val_str
            else:
                row[f['name']] = val_str

        records.append(row)

    return records

if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1], "rb") as f:
            records = parse_dbf_bytes(f.read())
            print(json.dumps(records, indent=2))
