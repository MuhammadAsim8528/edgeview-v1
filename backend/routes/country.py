"""
FastAPI Routes for Country Dashboard & Analytics.
Provides hierarchical country -> importer -> exporter breakdown.
"""

from fastapi import APIRouter, HTTPException, Query, Response
from typing import Optional, List, Dict, Any
from urllib.parse import unquote
import csv
import io

router = APIRouter(prefix="/api/countries", tags=["countries"])

def get_db():
    from database import db
    return db

def normalize_country(val: Any) -> str:
    if not val:
        return "Unknown"
    s = str(val).strip()
    if not s or s.lower() in ["nan", "none", "null", "n/a", "3004"]:
        return "Unknown"
    # Proper casing e.g. "BANGLADESH" -> "Bangladesh"
    return s.title()

def normalize_name(val: Any, default="Unknown") -> str:
    if not val:
        return default
    s = str(val).strip()
    return s if s else default

def extract_row_fields(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract key fields from a row regardless of column name variations.
    """
    # Country
    country = row.get("Country") or row.get("COUNTRY") or row.get("DESTINATION_COUNTRY") or row.get("cntry") or row.get("ORIGIN") or "Unknown"
    
    # Importer
    importer = row.get("Importer") or row.get("IMPORTER") or row.get("BUYER") or row.get("BUYER_NAME") or row.get("Consignee") or "Unknown"
    
    # Exporter
    exporter = row.get("Exporter") or row.get("EXPORTER") or row.get("SELLER") or row.get("SUPPLIER") or row.get("SUPPLIER_NAME") or "Unknown"
    
    # Product / Item
    product = row.get("Item") or row.get("ITEM") or row.get("PRODUCT") or row.get("product_name") or row.get("DESCRIPTION") or "Unknown Product"
    
    # Total FC USD
    fc_val = row.get("Total FC (USD)") or row.get("TOT_FC") or row.get("VAL_USD") or row.get("total_cost_usd") or row.get("AMOUNT") or 0
    try:
        total_val = float(fc_val) if fc_val is not None else 0.0
    except (ValueError, TypeError):
        total_val = 0.0
        
    # Quantity
    qty_val = row.get("QTY") or row.get("qty") or row.get("Qty") or row.get("QUANTITY") or row.get("GROSS") or row.get("NET") or 0
    try:
        quantity = float(qty_val) if qty_val is not None else 0.0
    except (ValueError, TypeError):
        quantity = 0.0
        
    # Unit
    unit = row.get("UNT") or row.get("unit") or row.get("UNIT") or row.get("UOM") or row.get("qty_unit") or "KG"
    unit_str = str(unit).strip().upper() if unit else "KG"

    return {
        "country": normalize_country(country),
        "importer": normalize_name(importer, "Unknown Importer"),
        "exporter": normalize_name(exporter, "Unknown Exporter"),
        "product": normalize_name(product, "Unknown Product"),
        "total_value": total_val,
        "quantity": quantity,
        "unit": unit_str
    }

def get_all_dataset_rows(file_id: Optional[str] = None) -> List[Dict[str, Any]]:
    db = get_db()
    rows = []
    if file_id and file_id in db.files:
        rows = db.files[file_id].get("rows", [])
    else:
        for f in db.files.values():
            rows.extend(f.get("rows", []))
    return [extract_row_fields(r) for r in rows]

@router.get("")
async def get_countries(file_id: Optional[str] = Query(None)):
    """
    Level 1: Returns a list of all countries found in data, sorted alphabetically (A to Z).
    Each country includes the total count of unique importers.
    """
    rows = get_all_dataset_rows(file_id)
    country_importers: Dict[str, set] = {}
    
    for r in rows:
        c = r["country"]
        imp = r["importer"]
        if c not in country_importers:
            country_importers[c] = set()
        if imp and imp != "Unknown Importer":
            country_importers[c].add(imp)
            
    sorted_countries = sorted(country_importers.keys())
    
    result = [
        {
            "country": c,
            "importers_count": len(country_importers[c])
        }
        for c in sorted_countries
    ]
    return result

@router.get("/{country}/summary")
async def get_country_summary(country: str, file_id: Optional[str] = Query(None)):
    """
    Level 2: Returns summary for a specific country:
    total importers, total export value ($), total unique exporters.
    """
    decoded_country = unquote(country).strip().lower()
    rows = get_all_dataset_rows(file_id)
    
    country_rows = [r for r in rows if r["country"].lower() == decoded_country]
    if not country_rows:
        # Fallback case-insensitive search
        country_rows = [r for r in rows if decoded_country in r["country"].lower()]
        
    importers = set()
    exporters = set()
    total_val = 0.0
    
    for r in country_rows:
        if r["importer"] and r["importer"] != "Unknown Importer":
            importers.add(r["importer"])
        if r["exporter"] and r["exporter"] != "Unknown Exporter":
            exporters.add(r["exporter"])
        total_val += r["total_value"]
        
    # Get original formatted country name
    display_country = country_rows[0]["country"] if country_rows else unquote(country).title()
    
    return {
        "country": display_country,
        "importers_count": len(importers),
        "total_export_value": round(total_val, 2),
        "exporters_count": len(exporters)
    }

@router.get("/{country}/importers")
async def get_country_importers(country: str, file_id: Optional[str] = Query(None)):
    """
    Level 3: Returns all importers from a country sorted alphabetically (A to Z)
    with total export value and number of exporters per importer.
    """
    decoded_country = unquote(country).strip().lower()
    rows = get_all_dataset_rows(file_id)
    
    country_rows = [r for r in rows if r["country"].lower() == decoded_country]
    if not country_rows:
        country_rows = [r for r in rows if decoded_country in r["country"].lower()]
        
    importer_map: Dict[str, Dict[str, Any]] = {}
    
    for r in country_rows:
        imp = r["importer"]
        if imp not in importer_map:
            importer_map[imp] = {
                "importer": imp,
                "total_export_value": 0.0,
                "exporters": set()
            }
        importer_map[imp]["total_export_value"] += r["total_value"]
        if r["exporter"] and r["exporter"] != "Unknown Exporter":
            importer_map[imp]["exporters"].add(r["exporter"])
            
    sorted_importers = sorted(importer_map.values(), key=lambda x: x["importer"].lower())
    
    return [
        {
            "importer": item["importer"],
            "total_export_value": round(item["total_export_value"], 2),
            "exporters_count": len(item["exporters"])
        }
        for item in sorted_importers
    ]

@router.get("/{country}/{importer}/details")
async def get_importer_details(country: str, importer: str, file_id: Optional[str] = Query(None)):
    """
    Level 4: Exporter Breakdown Table for a specific importer in a country.
    Returns: exporter, product, quantity, unit, total_value
    """
    decoded_country = unquote(country).strip().lower()
    decoded_importer = unquote(importer).strip().lower()
    rows = get_all_dataset_rows(file_id)
    
    matched_rows = [
        r for r in rows
        if r["country"].lower() == decoded_country and r["importer"].lower() == decoded_importer
    ]
    if not matched_rows:
        matched_rows = [
            r for r in rows
            if decoded_country in r["country"].lower() and decoded_importer in r["importer"].lower()
        ]
        
    # Aggregate by Exporter + Product + Unit
    aggregated: Dict[tuple, Dict[str, Any]] = {}
    
    for r in matched_rows:
        key = (r["exporter"], r["product"], r["unit"])
        if key not in aggregated:
            aggregated[key] = {
                "exporter": r["exporter"],
                "product": r["product"],
                "quantity": 0.0,
                "unit": r["unit"],
                "total_value": 0.0
            }
        aggregated[key]["quantity"] += r["quantity"]
        aggregated[key]["total_value"] += r["total_value"]
        
    result = list(aggregated.values())
    result.sort(key=lambda x: (x["exporter"].lower(), x["product"].lower()))
    
    for item in result:
        item["quantity"] = round(item["quantity"], 2)
        item["total_value"] = round(item["total_value"], 2)
        
    return result

@router.get("/export/full-report")
async def export_full_report(file_id: Optional[str] = Query(None)):
    """
    Level 5: Exports complete country summary, importer summary, and exporter breakdown report in CSV format.
    """
    rows = get_all_dataset_rows(file_id)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # UTF-8 BOM
    output.write('\ufeff')
    
    writer.writerow(["=== PHARMA AI GLOBAL COUNTRY REPORT ==="])
    writer.writerow([])
    
    # 1. Country Summary Table
    writer.writerow(["--- COUNTRY SUMMARY ---"])
    writer.writerow(["Country", "Total Importers", "Total Exporters", "Total Export Value (USD)"])
    
    country_data: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        c = r["country"]
        if c not in country_data:
            country_data[c] = {"importers": set(), "exporters": set(), "val": 0.0}
        if r["importer"] and r["importer"] != "Unknown Importer":
            country_data[c]["importers"].add(r["importer"])
        if r["exporter"] and r["exporter"] != "Unknown Exporter":
            country_data[c]["exporters"].add(r["exporter"])
        country_data[c]["val"] += r["total_value"]
        
    for c in sorted(country_data.keys()):
        writer.writerow([
            c,
            len(country_data[c]["importers"]),
            len(country_data[c]["exporters"]),
            f"${country_data[c]['val']:,.2f}"
        ])
        
    writer.writerow([])
    
    # 2. Importer Summary Table
    writer.writerow(["--- IMPORTER SUMMARY BY COUNTRY ---"])
    writer.writerow(["Country", "Importer Name", "Exporters Count", "Total Export Value (USD)"])
    
    imp_data: Dict[tuple, Dict[str, Any]] = {}
    for r in rows:
        key = (r["country"], r["importer"])
        if key not in imp_data:
            imp_data[key] = {"exporters": set(), "val": 0.0}
        if r["exporter"] and r["exporter"] != "Unknown Exporter":
            imp_data[key]["exporters"].add(r["exporter"])
        imp_data[key]["val"] += r["total_value"]
        
    for (c, imp) in sorted(imp_data.keys(), key=lambda x: (x[0].lower(), x[1].lower())):
        writer.writerow([
            c,
            imp,
            len(imp_data[(c, imp)]["exporters"]),
            f"${imp_data[(c, imp)]['val']:,.2f}"
        ])
        
    writer.writerow([])
    
    # 3. Exporter Breakdown Details Table
    writer.writerow(["--- EXPORTER BREAKDOWN DETAILS ---"])
    writer.writerow(["Country", "Importer Name", "Exporter Name", "Product / Item", "Quantity", "Unit", "Total Value (USD)"])
    
    detail_data: Dict[tuple, Dict[str, Any]] = {}
    for r in rows:
        key = (r["country"], r["importer"], r["exporter"], r["product"], r["unit"])
        if key not in detail_data:
            detail_data[key] = {"qty": 0.0, "val": 0.0}
        detail_data[key]["qty"] += r["quantity"]
        detail_data[key]["val"] += r["total_value"]
        
    sorted_details = sorted(detail_data.keys(), key=lambda x: (x[0].lower(), x[1].lower(), x[2].lower(), x[3].lower()))
    for (c, imp, exp, prod, unit) in sorted_details:
        writer.writerow([
            c,
            imp,
            exp,
            prod,
            f"{detail_data[(c, imp, exp, prod, unit)]['qty']:,.2f}",
            unit,
            f"${detail_data[(c, imp, exp, prod, unit)]['val']:,.2f}"
        ])
        
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=Pharma_Country_Full_Report.csv"}
    )
