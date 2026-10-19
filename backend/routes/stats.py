"""
FastAPI Routes for History / Stats Dashboard & Analytics.
Provides global summaries, country -> importer drill-downs, product repetition tracking,
exporter distribution, and CSV export capabilities.
"""

from fastapi import APIRouter, HTTPException, Query, Response
from typing import Optional, List, Dict, Any
from urllib.parse import unquote
import csv
import io
import re

router = APIRouter(prefix="/api/stats", tags=["stats"])

def get_db():
    from database import db
    return db

def normalize_country(val: Any) -> str:
    if not val:
        return "Unknown"
    s = str(val).strip()
    if not s or s.lower() in ["nan", "none", "null", "n/a", "3004"]:
        return "Unknown"
    return s.title()

def normalize_name(val: Any, default="Unknown") -> str:
    if not val:
        return default
    s = str(val).strip()
    return s if s else default

def extract_row(row: Dict[str, Any]) -> Dict[str, Any]:
    country = row.get("Country") or row.get("COUNTRY") or row.get("DESTINATION_COUNTRY") or row.get("cntry") or row.get("ORIGIN") or "Unknown"
    importer = row.get("Importer") or row.get("IMPORTER") or row.get("BUYER") or row.get("BUYER_NAME") or row.get("Consignee") or "Unknown Importer"
    exporter = row.get("Exporter") or row.get("EXPORTER") or row.get("SELLER") or row.get("SUPPLIER") or row.get("SUPPLIER_NAME") or "Unknown Exporter"
    product = row.get("Item") or row.get("ITEM") or row.get("PRODUCT") or row.get("product_name") or row.get("DESCRIPTION") or "Unknown Product"
    date_val = row.get("Date") or row.get("BE_DATE") or row.get("be_date") or row.get("shipment_date") or row.get("BE_DATE_1") or ""
    invoice_no = row.get("LC_NO") or row.get("BE_LINK") or row.get("BE_NO") or row.get("Invoice") or row.get("INVOICE") or row.get("INVOICE_NO") or row.get("be_no") or row.get("be_link") or row.get("lc_no") or row.get("Bill_No") or "N/A"
    hs_code = row.get("HS_CODE") or row.get("hs_code") or row.get("HSCode") or row.get("hscode") or ""

    fc_val = row.get("Total FC (USD)") or row.get("TOT_FC") or row.get("VAL_USD") or row.get("total_cost_usd") or row.get("AMOUNT") or 0
    try:
        total_val = float(fc_val) if fc_val is not None else 0.0
    except (ValueError, TypeError):
        total_val = 0.0

    qty_val = row.get("QTY") or row.get("qty") or row.get("Qty") or row.get("QUANTITY") or row.get("GROSS") or row.get("NET") or 0
    try:
        quantity = float(qty_val) if qty_val is not None else 0.0
    except (ValueError, TypeError):
        quantity = 0.0

    unit = row.get("UNT") or row.get("unit") or row.get("UNIT") or row.get("UOM") or row.get("qty_unit") or "KG"

    # Normalize date to YYYY-MM-DD string format if possible
    d_str = str(date_val).strip()
    if len(d_str) == 8 and d_str.isdigit(): # e.g. 20230713
        d_str = f"{d_str[:4]}-{d_str[4:6]}-{d_str[6:]}"

    return {
        "country": normalize_country(country),
        "importer": normalize_name(importer, "Unknown Importer"),
        "exporter": normalize_name(exporter, "Unknown Exporter"),
        "product": normalize_name(product, "Unknown Product"),
        "date": d_str,
        "invoice_no": str(invoice_no).strip() if invoice_no else "N/A",
        "hs_code": str(hs_code).strip() if hs_code else "",
        "total_value": total_val,
        "quantity": quantity,
        "unit": str(unit).strip().upper() if unit else "KG",
        "raw_row": row
    }

def get_all_rows(file_id: Optional[str] = None) -> List[Dict[str, Any]]:
    db = get_db()
    rows = []
    if file_id and file_id in db.files:
        rows = db.files[file_id].get("rows", [])
    else:
        for f in db.files.values():
            rows.extend(f.get("rows", []))
    return [extract_row(r) for r in rows]

def filter_by_date(rows: List[Dict[str, Any]], period: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None) -> List[Dict[str, Any]]:
    if not start and not end and not period:
        return rows

    filtered = []
    for r in rows:
        d = r["date"]
        if not d:
            filtered.append(r)
            continue

        if start and d < start:
            continue
        if end and d > end:
            continue
        filtered.append(r)
    return filtered

@router.get("/summary")
async def get_global_stats_summary(file_id: Optional[str] = Query(None)):
    """
    Global Top-Level Summary Cards: Total Records, Total Value, Total Countries, Total Companies.
    """
    rows = get_all_rows(file_id)
    countries = set()
    companies = set()
    total_value = 0.0

    for r in rows:
        if r["country"] and r["country"] != "Unknown":
            countries.add(r["country"])
        if r["importer"] and r["importer"] != "Unknown Importer":
            companies.add(r["importer"])
        total_value += r["total_value"]

    return {
        "total_records": len(rows),
        "total_value": round(total_value, 2),
        "total_countries": len(countries),
        "total_companies": len(companies)
    }

@router.get("/countries")
async def get_stats_countries(file_id: Optional[str] = Query(None)):
    """
    Returns list of all destination countries with counts and total export value.
    """
    rows = get_all_rows(file_id)
    c_map: Dict[str, Dict[str, Any]] = {}

    for r in rows:
        c = r["country"]
        if c not in c_map:
            c_map[c] = {"importers": set(), "total_value": 0.0, "records": 0}
        if r["importer"] and r["importer"] != "Unknown Importer":
            c_map[c]["importers"].add(r["importer"])
        c_map[c]["total_value"] += r["total_value"]
        c_map[c]["records"] += 1

    sorted_keys = sorted(c_map.keys())
    result = [
        {
            "country": c,
            "importers_count": len(c_map[c]["importers"]),
            "total_value": round(c_map[c]["total_value"], 2),
            "records_count": c_map[c]["records"]
        }
        for c in sorted_keys
    ]
    return result

@router.get("/countries/{country}/importers")
async def get_stats_country_importers(country: str, file_id: Optional[str] = Query(None)):
    """
    Returns list of importers for a specific country sorted alphabetically.
    """
    decoded_country = unquote(country).strip().lower()
    rows = get_all_rows(file_id)

    matched = [r for r in rows if r["country"].lower() == decoded_country or decoded_country in r["country"].lower()]

    imp_map: Dict[str, Dict[str, Any]] = {}
    for r in matched:
        imp = r["importer"]
        if imp not in imp_map:
            imp_map[imp] = {"importer": imp, "exporters": set(), "total_value": 0.0, "shipments": 0}
        if r["exporter"] and r["exporter"] != "Unknown Exporter":
            imp_map[imp]["exporters"].add(r["exporter"])
        imp_map[imp]["total_value"] += r["total_value"]
        imp_map[imp]["shipments"] += 1

    sorted_imps = sorted(imp_map.values(), key=lambda x: x["importer"].lower())

    return [
        {
            "importer": item["importer"],
            "exporters_count": len(item["exporters"]),
            "total_value": round(item["total_value"], 2),
            "shipments_count": item["shipments"]
        }
        for item in sorted_imps
    ]

@router.get("/importers/{importer}/summary")
async def get_importer_stats_summary(
    importer: str,
    country: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    file_id: Optional[str] = Query(None)
):
    """
    Summary stats for selected importer (Total Export Value, Total Exporters, Total Shipments).
    """
    decoded_importer = unquote(importer).strip().lower()
    rows = get_all_rows(file_id)

    if country and country != "ALL":
        decoded_country = unquote(country).strip().lower()
        rows = [r for r in rows if r["country"].lower() == decoded_country or decoded_country in r["country"].lower()]

    matched = [r for r in rows if r["importer"].lower() == decoded_importer or decoded_importer in r["importer"].lower()]
    matched = filter_by_date(matched, start=start, end=end)

    exporters = set()
    total_val = 0.0

    for r in matched:
        if r["exporter"] and r["exporter"] != "Unknown Exporter":
            exporters.add(r["exporter"])
        total_val += r["total_value"]

    display_country = matched[0]["country"] if matched else (country or "All Countries")
    display_importer = matched[0]["importer"] if matched else unquote(importer)

    return {
        "country": display_country,
        "importer": display_importer,
        "total_export_value": round(total_val, 2),
        "total_exporters": len(exporters),
        "total_shipments": len(matched)
    }

@router.get("/importers/{importer}/products")
async def get_importer_products(
    importer: str,
    country: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    file_id: Optional[str] = Query(None)
):
    """
    Product breakdown with repetition tracking (how many times each product appears in shipments).
    """
    decoded_importer = unquote(importer).strip().lower()
    rows = get_all_rows(file_id)

    if country and country != "ALL":
        decoded_country = unquote(country).strip().lower()
        rows = [r for r in rows if r["country"].lower() == decoded_country or decoded_country in r["country"].lower()]

    matched = [r for r in rows if r["importer"].lower() == decoded_importer or decoded_importer in r["importer"].lower()]
    matched = filter_by_date(matched, start=start, end=end)

    total_val_all = sum(r["total_value"] for r in matched)

    prod_map: Dict[str, Dict[str, Any]] = {}
    for r in matched:
        p = r["product"]
        if p not in prod_map:
            prod_map[p] = {
                "product": p,
                "quantity": 0.0,
                "unit": r["unit"],
                "shipments": 0,
                "total_value": 0.0
            }
        prod_map[p]["quantity"] += r["quantity"]
        prod_map[p]["shipments"] += 1
        prod_map[p]["total_value"] += r["total_value"]

    result = list(prod_map.values())
    result.sort(key=lambda x: x["total_value"], reverse=True)

    for item in result:
        item["quantity"] = round(item["quantity"], 2)
        item["total_value"] = round(item["total_value"], 2)
        item["percentage"] = round((item["total_value"] / total_val_all * 100), 1) if total_val_all > 0 else 0.0

    return result

@router.get("/importers/{importer}/exporters")
async def get_importer_exporters(
    importer: str,
    country: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    file_id: Optional[str] = Query(None)
):
    """
    Exporter breakdown for this importer (Exporter name, Products count, Shipments count, Total value).
    """
    decoded_importer = unquote(importer).strip().lower()
    rows = get_all_rows(file_id)

    if country and country != "ALL":
        decoded_country = unquote(country).strip().lower()
        rows = [r for r in rows if r["country"].lower() == decoded_country or decoded_country in r["country"].lower()]

    matched = [r for r in rows if r["importer"].lower() == decoded_importer or decoded_importer in r["importer"].lower()]
    matched = filter_by_date(matched, start=start, end=end)

    total_val_all = sum(r["total_value"] for r in matched)

    exp_map: Dict[str, Dict[str, Any]] = {}
    for r in matched:
        e = r["exporter"]
        if e not in exp_map:
            exp_map[e] = {
                "exporter": e,
                "products": set(),
                "shipments": 0,
                "total_value": 0.0
            }
        exp_map[e]["products"].add(r["product"])
        exp_map[e]["shipments"] += 1
        exp_map[e]["total_value"] += r["total_value"]

    result = [
        {
            "exporter": item["exporter"],
            "products_count": len(item["products"]),
            "shipments": item["shipments"],
            "total_value": round(item["total_value"], 2),
            "percentage": round((item["total_value"] / total_val_all * 100), 1) if total_val_all > 0 else 0.0
        }
        for item in exp_map.values()
    ]
    result.sort(key=lambda x: x["total_value"], reverse=True)

    return result

@router.get("/importers/{importer}/shipments")
async def get_importer_shipments(
    importer: str,
    country: Optional[str] = Query(None),
    exporter: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    file_id: Optional[str] = Query(None)
):
    """
    Returns individual shipment invoice records for a selected importer.
    """
    decoded_importer = unquote(importer).strip().lower()
    rows = get_all_rows(file_id)

    if country and country != "ALL":
        decoded_country = unquote(country).strip().lower()
        rows = [r for r in rows if r["country"].lower() == decoded_country or decoded_country in r["country"].lower()]

    matched = [r for r in rows if r["importer"].lower() == decoded_importer or decoded_importer in r["importer"].lower()]

    if exporter:
        dec_exp = unquote(exporter).strip().lower()
        matched = [r for r in matched if r["exporter"].lower() == dec_exp or dec_exp in r["exporter"].lower()]

    if product:
        dec_prod = unquote(product).strip().lower()
        matched = [r for r in matched if r["product"].lower() == dec_prod or dec_prod in r["product"].lower()]

    matched = filter_by_date(matched, start=start, end=end)
    matched.sort(key=lambda x: (x.get("date") or "", x.get("total_value", 0)), reverse=True)

    return matched

@router.get("/importers/{importer}/export")
async def export_importer_stats_report(
    importer: str,
    country: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    file_id: Optional[str] = Query(None)
):
    """
    Exports full statistics report for selected importer as CSV.
    """
    decoded_importer = unquote(importer)
    rows = get_all_rows(file_id)

    if country and country != "ALL":
        decoded_country = unquote(country).strip().lower()
        rows = [r for r in rows if r["country"].lower() == decoded_country or decoded_country in r["country"].lower()]

    matched = [r for r in rows if r["importer"].lower() == decoded_importer.lower() or decoded_importer.lower() in r["importer"].lower()]
    matched = filter_by_date(matched, start=start, end=end)

    output = io.StringIO()
    output.write('\ufeff') # UTF-8 BOM
    writer = csv.writer(output)

    writer.writerow([f"=== PHARMA AI IMPORTER STATS REPORT: {decoded_importer.upper()} ==="])
    if country:
        writer.writerow([f"Country Filter: {country}"])
    if start or end:
        writer.writerow([f"Date Range: {start or 'Beginning'} to {end or 'Present'}"])
    writer.writerow([])

    # Summary
    total_val = sum(r["total_value"] for r in matched)
    exporters_set = set(r["exporter"] for r in matched if r["exporter"] and r["exporter"] != "Unknown Exporter")
    writer.writerow(["--- IMPORTER SUMMARY ---"])
    writer.writerow(["Importer Name", "Total Export Value (USD)", "Total Exporters", "Total Shipments"])
    writer.writerow([decoded_importer, f"${total_val:,.2f}", len(exporters_set), len(matched)])
    writer.writerow([])

    # Products Breakdown
    writer.writerow(["--- PRODUCTS EXPORTED (WITH REPETITION TRACKING) ---"])
    writer.writerow(["Product Name", "Quantity", "Unit", "Shipments (Repetitions)", "Total Value (USD)", "% Share"])

    prod_map: Dict[str, Dict[str, Any]] = {}
    for r in matched:
        p = r["product"]
        if p not in prod_map:
            prod_map[p] = {"qty": 0.0, "unit": r["unit"], "shipments": 0, "val": 0.0}
        prod_map[p]["qty"] += r["quantity"]
        prod_map[p]["shipments"] += 1
        prod_map[p]["val"] += r["total_value"]

    sorted_prods = sorted(prod_map.items(), key=lambda x: x[1]["val"], reverse=True)
    for p_name, data in sorted_prods:
        share = (data["val"] / total_val * 100) if total_val > 0 else 0.0
        writer.writerow([
            p_name,
            f"{data['qty']:,.2f}",
            data["unit"],
            data["shipments"],
            f"${data['val']:,.2f}",
            f"{share:.1f}%"
        ])

    writer.writerow([])

    # Exporters Breakdown
    writer.writerow(["--- EXPORTERS BREAKDOWN ---"])
    writer.writerow(["Exporter Name", "Distinct Products", "Shipments Count", "Total Value (USD)", "% Share"])

    exp_map: Dict[str, Dict[str, Any]] = {}
    for r in matched:
        e = r["exporter"]
        if e not in exp_map:
            exp_map[e] = {"prods": set(), "shipments": 0, "val": 0.0}
        exp_map[e]["prods"].add(r["product"])
        exp_map[e]["shipments"] += 1
        exp_map[e]["val"] += r["total_value"]

    sorted_exps = sorted(exp_map.items(), key=lambda x: x[1]["val"], reverse=True)
    for e_name, data in sorted_exps:
        share = (data["val"] / total_val * 100) if total_val > 0 else 0.0
        writer.writerow([
            e_name,
            len(data["prods"]),
            data["shipments"],
            f"${data['val']:,.2f}",
            f"{share:.1f}%"
        ])

    output.seek(0)
    clean_filename = re.sub(r'[^a-zA-Z0-9_-]', '_', decoded_importer)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=Pharma_Stats_{clean_filename}.csv"}
    )
