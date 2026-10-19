"""
FastAPI Routes for File Management and Data Pagination.
Handles file retrieval, async parsing, and paginated data queries with limit/offset parameters.
Simplifies currency display by ensuring USD valuation is primary and hiding non-USD columns (AV_FC, AV_PAK).
"""

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from typing import Optional, List, Dict, Any
import asyncio

router = APIRouter(prefix="/api/files", tags=["files"])

# Helper: Detect non-USD currency columns to hide from UI table view
NON_USD_CURRENCY_KEYWORDS = {
    'av_fc', 'av_pak', 'total_fc', 'unit_fc', 'price_fc', 'val_fc',
    'val_pak', 'amt_pak', 'tax_pak', 'duty_fc', 'tot_pak', 'val_pkr',
    'pkr', 'inr', 'eur', 'gbp', 'jpy', 'cad', 'aud', 'chf', 'rub', 'sar', 'aed'
}

def is_non_usd_currency_col(col_name: str) -> bool:
    col_lower = col_name.lower().replace('-', '_')
    if col_lower in NON_USD_CURRENCY_KEYWORDS:
        return True
    if any(col_lower.endswith(suf) for suf in ['_fc', '_pak', '_pkr', '_inr', '_eur', '_gbp', '_jpy']):
        if 'usd' not in col_lower and '$' not in col_lower:
            return True
    return False

COLUMN_MAP = {
    'BE_DATE': 'Date', 'be_date': 'Date', 'shipment_date': 'Date', 'SHIP_DATE': 'Date', 'BE_DATE_1': 'Date',
    'ITEM': 'Item', 'item': 'Item', 'product_name': 'Item', 'Drug_Class': 'Item', 'CAT_NUMBER': 'Item',
    'IMPORTER': 'Importer', 'importer': 'Importer', 'importer_name': 'Importer', 'BUYER_NAME': 'Importer', 'Customer_Name': 'Importer',
    'EXPORTER': 'Exporter', 'exporter': 'Exporter', 'exporter_name': 'Exporter', 'SUPPLIER_NAME': 'Exporter', 'Supplier_Name': 'Exporter',
    'TOT_FC': 'Total FC (USD)', 'tot_fc': 'Total FC (USD)', 'total_cost_usd': 'Total FC (USD)', 'VAL_USD': 'Total FC (USD)', 'Invoice_Value': 'Total FC (USD)',
    'AGENT_NAME': 'Agent', 'agent_name': 'Agent', 'AGENT': 'Agent'
}

def normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(row, dict):
        return {}
    mapped = dict(row)
    for k, v in row.items():
        if k in COLUMN_MAP:
            mapped[COLUMN_MAP[k]] = v
        elif k.upper() in COLUMN_MAP:
            mapped[COLUMN_MAP[k.upper()]] = v
    return mapped

def group_shipment_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Groups raw shipment rows by BE_LINK, LC_NO, BE_NO or composite key.
    Combines ITEM values into a single comma-separated string per group,
    retains Date, Country, Importer, Exporter, and sums/consolidates Total FC (USD).
    """
    groups: Dict[str, Dict[str, Any]] = {}
    
    for row in rows:
        norm_r = normalize_row(row)
        
        # Look for grouping link keys
        group_key = ""
        possible_keys = [
            'BE_LINK', 'be_link', 'LC_NO', 'lc_no', 'BE_NO', 'be_no',
            'INVOICE_NO', 'invoice_no', 'BILL_NO', 'bill_no', 'IGM_NO', 'igm_no',
            'SHIPMENT_ID', 'shipment_id', 'group_link', 'GROUP_LINK'
        ]
        
        for k in possible_keys:
            val = str(row.get(k) or norm_r.get(k) or '').strip()
            if val:
                group_key = val
                break
                
        date_val = str(norm_r.get('Date') or norm_r.get('BE_DATE') or row.get('Date') or '').strip()
        country_val = str(norm_r.get('Country') or norm_r.get('COUNTRY') or row.get('Country') or '').strip()
        importer_val = str(norm_r.get('Importer') or norm_r.get('IMPORTER') or row.get('Importer') or '').strip()
        exporter_val = str(norm_r.get('Exporter') or norm_r.get('EXPORTER') or row.get('Exporter') or '').strip()
        
        if not group_key:
            group_key = f"{date_val}_{country_val}_{importer_val}_{exporter_val}".lower().strip()
            
        if not group_key or group_key == "___":
            group_key = f"row_{id(row)}"
            
        if group_key not in groups:
            groups[group_key] = {
                "sample_row": norm_r,
                "items": [],
                "date": date_val,
                "country": country_val,
                "importer": importer_val,
                "exporter": exporter_val,
                "tot_fc_values": []
            }
            
        group = groups[group_key]
        
        # Collect Item
        item_val = str(norm_r.get('Item') or norm_r.get('ITEM') or row.get('Item') or '').strip()
        if item_val and item_val not in group["items"]:
            group["items"].append(item_val)
            
        # Collect Total FC
        fc_val = norm_r.get('Total FC (USD)') or norm_r.get('TOT_FC') or row.get('Total FC (USD)')
        try:
            if fc_val is not None and str(fc_val).strip() != '':
                num_fc = float(fc_val)
                if num_fc > 0:
                    group["tot_fc_values"].append(num_fc)
        except (ValueError, TypeError):
            pass

    grouped_result = []
    for grp in groups.values():
        combined_items = ", ".join(grp["items"])
        
        tot_fc = 0.0
        if grp["tot_fc_values"]:
            all_same = all(abs(v - grp["tot_fc_values"][0]) < 0.001 for v in grp["tot_fc_values"])
            if all_same:
                tot_fc = grp["tot_fc_values"][0]
            else:
                tot_fc = sum(grp["tot_fc_values"])
                
        res_row = dict(grp["sample_row"])
        res_row["Date"] = grp["date"]
        res_row["Country"] = grp["country"]
        res_row["Importer"] = grp["importer"]
        res_row["Exporter"] = grp["exporter"]
        res_row["Total FC (USD)"] = round(tot_fc, 2)
        res_row["Item"] = combined_items
        
        grouped_result.append(res_row)
        
    return grouped_result

@router.get("")
async def get_all_files():
    """Retrieve list of uploaded files with summary statistics."""
    try:
        from database import db
        return [
            {
                "id": f["id"],
                "name": f["name"],
                "file_type": f["file_type"],
                "size": f["size"],
                "upload_time": f["upload_time"],
                "columns": [c for c in f["columns"] if not is_non_usd_currency_col(c)],
                "total_rows": len(f["rows"]),
                "summary": f["summary"]
            }
            for f in db.files.values()
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_id}")
async def get_file_details(file_id: str):
    """Retrieve full details of a specific file."""
    try:
        from database import db
        file_record = db.get_file_by_id(file_id)
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Filter visible columns (excluding non-USD currency columns like AV_FC, AV_PAK)
        visible_cols = [c for c in file_record["columns"] if not is_non_usd_currency_col(c)]
        mapped_rows = [normalize_row(r) for r in file_record.get("rows", [])]

        return {
            **file_record,
            "rows": mapped_rows,
            "visible_columns": visible_cols
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_id}/data")
async def get_file_data_paginated(
    file_id: str,
    limit: int = Query(50, ge=1, le=500, description="Rows per page limit"),
    offset: int = Query(0, ge=0, description="Row offset for pagination"),
    search: Optional[str] = Query(None, description="Search term across all columns"),
    sort_by: Optional[str] = Query(None, description="Column name to sort by"),
    sort_dir: str = Query("asc", regex="^(asc|desc)$", description="Sort direction"),
    group_shipments: bool = Query(False, description="Group shipment rows by BE_LINK/LC_NO"),
    product: Optional[str] = Query(None, description="Filter by product/item name"),
    country: Optional[str] = Query(None, description="Filter by country"),
    importer: Optional[str] = Query(None, description="Filter by importer"),
    start_date: Optional[str] = Query(None, description="Filter by start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter by end date YYYY-MM-DD")
):
    """
    Optimized Paginated Data Endpoint.
    Supports limit, offset, debounced search, grouping by shipment, and filters for product, country, importer, date range.
    """
    try:
        from database import db
        file_record = db.get_file_by_id(file_id)
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")

        raw_rows = [normalize_row(r) for r in file_record.get("rows", [])]
        all_columns = file_record.get("columns", [])
        visible_columns = [c for c in all_columns if not is_non_usd_currency_col(c)]

        # Apply grouping first if requested
        working_rows = group_shipment_rows(raw_rows) if group_shipments else raw_rows

        # Apply granular filters
        filtered_rows = []
        for r in working_rows:
            # Product filter
            if product and product.strip():
                item_val = str(r.get("Item") or r.get("ITEM") or "").lower()
                if product.lower().strip() not in item_val:
                    continue

            # Country filter
            if country and country.strip():
                country_val = str(r.get("Country") or r.get("COUNTRY") or "").lower()
                if country.lower().strip() != country_val:
                    continue

            # Importer filter
            if importer and importer.strip():
                importer_val = str(r.get("Importer") or r.get("IMPORTER") or "").lower()
                if importer.lower().strip() != importer_val:
                    continue

            # Date Range filter
            date_val = str(r.get("Date") or r.get("BE_DATE") or "").strip()
            if start_date and date_val and date_val < start_date:
                continue
            if end_date and date_val and date_val > end_date:
                continue

            # Search term
            if search:
                search_lower = search.lower().strip()
                if not any(search_lower in str(v).lower() for v in r.values()):
                    continue

            filtered_rows.append(r)

        # Column Sorting
        if sort_by:
            reverse = (sort_dir.lower() == "desc")
            def sort_key(row):
                val = row.get(sort_by)
                if val is None:
                    return ""
                return val
            filtered_rows = sorted(filtered_rows, key=sort_key, reverse=reverse)

        # Slice for limit and offset
        paginated = filtered_rows[offset : offset + limit]

        return {
            "id": file_record.get("id", file_id),
            "file_id": file_id,
            "name": file_record.get("name", "Unknown File"),
            "total_count": len(filtered_rows),
            "total_rows": len(filtered_rows),
            "limit": limit,
            "offset": offset,
            "columns": visible_columns,
            "rows": paginated,
            "data": paginated,
            "has_usd_column": any("usd" in c.lower() or "cost" in c.lower() or "val" in c.lower() for c in visible_columns)
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
