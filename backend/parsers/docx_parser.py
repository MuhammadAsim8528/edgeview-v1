# docx_parser.py - Parser for DOCX files

import sys
import json
import zipfile
import xml.etree.ElementTree as ET

def parse_docx(filepath: str):
    """
    Parses .docx file structure (paragraphs and xml tables) without heavy binary dependencies.
    """
    try:
        with zipfile.ZipFile(filepath) as z:
            xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            
            # Namespace mapping for Word XML
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            paragraphs = []
            tables = []

            for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                texts = [t.text for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text]
                if texts:
                    paragraphs.append(''.join(texts))

            for tbl in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tbl'):
                tbl_rows = []
                for tr in tbl.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr'):
                    row_cells = []
                    for tc in tr.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc'):
                        texts = [t.text for t in tc.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text]
                        row_cells.append(' '.join(texts).strip())
                    if row_cells:
                        tbl_rows.append(row_cells)
                if tbl_rows:
                    tables.append(tbl_rows)

            return {
                'raw_text': '\n\n'.join(paragraphs),
                'tables': tables
            }
    except Exception as e:
        return {'raw_text': f"Error reading DOCX: {str(e)}", 'tables': []}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        res = parse_docx(sys.argv[1])
        print(json.dumps(res, indent=2))
