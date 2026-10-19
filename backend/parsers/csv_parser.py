# csv_parser.py - Parser for CSV / TSV / Delimited files

import sys
import json
import csv

def parse_csv(filepath: str):
    """
    Parses CSV/TSV file with auto-delimiter detection.
    """
    records = []
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        sample = f.read(2048)
        f.seek(0)
        
        delimiter = ','
        if '\t' in sample and sample.count('\t') > sample.count(','):
            delimiter = '\t'
        elif ';' in sample and sample.count(';') > sample.count(','):
            delimiter = ';'

        reader = csv.DictReader(f, delimiter=delimiter)
        for row in reader:
            cleaned_row = {k.strip() if k else f"Column_{i}": (v.strip() if v else "") for i, (k, v) in enumerate(row.items())}
            records.append(cleaned_row)

    return records

if __name__ == "__main__":
    if len(sys.argv) > 1:
        data = parse_csv(sys.argv[1])
        print(json.dumps(data, indent=2))
