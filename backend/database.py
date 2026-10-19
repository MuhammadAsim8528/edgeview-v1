"""
In-Memory & SQLite Persistence Layer for EdgeView Enrichment System.
Supports O(1) indexing, deduplication, multiple contact values, and SQLite contact_cache table persistence.
"""

import os
import re
import json
import sqlite3
from typing import Dict, List, Optional, Any
from datetime import datetime

# Path to SQLite database
DB_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "edgeview.db")


def get_sqlite_db() -> sqlite3.Connection:
    """Connect to SQLite database with Row factory enabled."""
    conn = sqlite3.connect(DB_FILE_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_sqlite_db():
    """Ensure contact_cache table exists in edgeview.db with recovery if database is corrupted."""
    try:
        conn = get_sqlite_db()
        cursor = conn.cursor()
        cursor.execute("PRAGMA quick_check;")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS contact_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_name TEXT UNIQUE,
                address TEXT,
                phone TEXT,
                email TEXT,
                linkedin TEXT,
                industry TEXT,
                website TEXT,
                details_json TEXT,
                fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                source TEXT DEFAULT 'api'
            );
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error initializing SQLite db in database.py ({e}), recreating clean database file...")
        try:
            if os.path.exists(DB_FILE_PATH):
                os.remove(DB_FILE_PATH)
        except Exception:
            pass
        try:
            conn = get_sqlite_db()
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contact_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_name TEXT UNIQUE,
                    address TEXT,
                    phone TEXT,
                    email TEXT,
                    linkedin TEXT,
                    industry TEXT,
                    website TEXT,
                    details_json TEXT,
                    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    source TEXT DEFAULT 'api'
                );
            """)
            conn.commit()
            conn.close()
        except Exception as retry_e:
            print(f"Failed to recreate SQLite db: {retry_e}")


# Initialize SQLite tables on module import
init_sqlite_db()


def normalize_company_name(name: str) -> str:
    """
    Normalize company names for cache lookup so minor capitalization
    and whitespace differences do not create duplicate records.
    """
    if not name or not isinstance(name, str):
        return ""
    return " ".join(name.strip().lower().split())


def is_valid_email(email: str) -> bool:
    """Validate email format."""
    if not email or not isinstance(email, str):
        return False
    e = email.strip()
    if len(e) < 5 or '@' not in e or '.' not in e:
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, e))


def is_valid_phone(phone: str) -> bool:
    """Validate phone/fax number format."""
    if not phone or not isinstance(phone, str):
        return False
    p = phone.strip()
    if len(p) < 6:
        return False
    digits_only = re.sub(r'\D', '', p)
    return len(digits_only) >= 6 and len(set(digits_only)) > 1


def is_valid_url(url: str) -> bool:
    """Validate URL format."""
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    if len(u) < 5:
        return False
    return u.startswith("http://") or u.startswith("https://") or ("." in u and " " not in u)


def get_cached_company(name: str) -> Optional[Dict[str, Any]]:
    """
    Lookup previously enriched company data from contact_cache in SQLite.
    Returns normalized structured data object if found.
    """
    norm_name = normalize_company_name(name)
    if not norm_name:
        return None

    try:
        conn = get_sqlite_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM contact_cache WHERE LOWER(TRIM(company_name)) = ?",
            (norm_name,)
        )
        row = cursor.fetchone()
        conn.close()

        if row:
            row_dict = dict(row)
            details_json = row_dict.get("details_json")
            extra_details = {}
            if details_json:
                try:
                    extra_details = json.loads(details_json)
                except Exception:
                    extra_details = {}

            c_name = row_dict.get("company_name") or extra_details.get("company_name") or name.strip()
            website = row_dict.get("website") or extra_details.get("website") or ""
            address = row_dict.get("address") or extra_details.get("address") or ""
            phone = row_dict.get("phone") or extra_details.get("phone") or ""
            email = row_dict.get("email") or extra_details.get("email") or ""
            linkedin = row_dict.get("linkedin") or extra_details.get("linkedin") or ""
            industry = row_dict.get("industry") or extra_details.get("industry") or ""

            return {
                "id": str(row_dict.get("id", "")),
                "company_name": c_name,
                "website": website,
                "address": address,
                "phone": phone,
                "email": email,
                "linkedin": linkedin,
                "industry": industry,
                "country": extra_details.get("country", ""),
                "fax_numbers": extra_details.get("fax_numbers", []),
                "emails_list": extra_details.get("emails_list") or ([email] if email else []),
                "phones_list": extra_details.get("phones_list") or ([phone] if phone else []),
                "linkedin_urls": extra_details.get("linkedin_urls") or ([linkedin] if linkedin else []),
                "addresses": extra_details.get("addresses") or ([{"address": address}] if address else []),
                "contact_persons": extra_details.get("contact_persons", []),
                "sources": extra_details.get("sources", []),
                "isPartial": extra_details.get("isPartial", False),
                "fetched_at": str(row_dict.get("fetched_at") or ""),
                "source": row_dict.get("source") or "cache"
            }
    except Exception as e:
        print(f"Error querying get_cached_company from SQLite: {e}")

    # Fallback to in-memory index
    try:
        if 'db' in globals() and hasattr(db, 'company_name_index') and norm_name in db.company_name_index:
            return db.company_name_index[norm_name]
    except Exception:
        pass

    return None


def save_enriched_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate, deduplicate, merge, and persist enriched company contact data to SQLite contact_cache.
    Preserves multiple emails, phones, addresses, contacts, and source URLs.
    """
    if not isinstance(data, dict):
        raise ValueError("Enriched data must be a dictionary")

    raw_company_name = data.get("company_name", "") or ""
    clean_company_name = raw_company_name.strip()
    norm_name = normalize_company_name(clean_company_name)

    if not norm_name:
        raise ValueError("Cannot save enriched data without a valid company_name")

    # Fetch existing cached record if present to MERGE new discovery with previous values
    existing = get_cached_company(clean_company_name) or {}

    company_name = clean_company_name or existing.get("company_name") or norm_name
    website = (data.get("website") or existing.get("website") or "").strip()
    industry = (data.get("industry") or existing.get("industry") or "").strip()
    country = (data.get("country") or existing.get("country") or "").strip()

    # --- 1. Deduplicate & Merge Emails ---
    raw_emails = []
    if data.get("emails_list"):
        raw_emails.extend(data["emails_list"])
    if data.get("email"):
        raw_emails.append(data["email"])
    if existing.get("emails_list"):
        raw_emails.extend(existing["emails_list"])
    if existing.get("email"):
        raw_emails.append(existing["email"])

    valid_emails = []
    seen_emails = set()
    for em in raw_emails:
        if em and isinstance(em, str) and is_valid_email(em):
            e_clean = em.strip().lower()
            if e_clean not in seen_emails:
                seen_emails.add(e_clean)
                valid_emails.append(em.strip())

    # --- 2. Deduplicate & Merge Phone Numbers ---
    raw_phones = []
    if data.get("phones_list"):
        raw_phones.extend(data["phones_list"])
    if data.get("phone"):
        raw_phones.append(data["phone"])
    if existing.get("phones_list"):
        raw_phones.extend(existing["phones_list"])
    if existing.get("phone"):
        raw_phones.append(existing["phone"])

    valid_phones = []
    seen_phones = set()
    for ph in raw_phones:
        if ph and isinstance(ph, str) and is_valid_phone(ph):
            p_clean = re.sub(r'\D', '', ph)
            if p_clean not in seen_phones:
                seen_phones.add(p_clean)
                valid_phones.append(ph.strip())

    # --- 3. Deduplicate & Merge Fax Numbers ---
    raw_faxes = []
    if data.get("fax_numbers"):
        raw_faxes.extend(data["fax_numbers"])
    if existing.get("fax_numbers"):
        raw_faxes.extend(existing["fax_numbers"])

    valid_faxes = []
    seen_faxes = set()
    for fx in raw_faxes:
        if fx and isinstance(fx, str) and is_valid_phone(fx):
            f_clean = re.sub(r'\D', '', fx)
            if f_clean not in seen_faxes:
                seen_faxes.add(f_clean)
                valid_faxes.append(fx.strip())

    # --- 4. Deduplicate & Merge LinkedIn URLs ---
    raw_linkedin = []
    if data.get("linkedin_urls"):
        raw_linkedin.extend(data["linkedin_urls"])
    if data.get("linkedin"):
        raw_linkedin.append(data["linkedin"])
    if existing.get("linkedin_urls"):
        raw_linkedin.extend(existing["linkedin_urls"])
    if existing.get("linkedin"):
        raw_linkedin.append(existing["linkedin"])

    valid_linkedin = []
    seen_linkedin = set()
    for lk in raw_linkedin:
        if lk and isinstance(lk, str) and "linkedin.com" in lk.lower():
            l_clean = lk.strip().lower().rstrip('/')
            if l_clean not in seen_linkedin:
                seen_linkedin.add(l_clean)
                valid_linkedin.append(lk.strip())

    # --- 5. Deduplicate & Merge Addresses ---
    raw_addresses = []
    if data.get("addresses") and isinstance(data["addresses"], list):
        raw_addresses.extend(data["addresses"])
    if data.get("address") and isinstance(data["address"], str):
        raw_addresses.append({"address": data["address"]})
    if existing.get("addresses") and isinstance(existing["addresses"], list):
        raw_addresses.extend(existing["addresses"])
    if existing.get("address") and isinstance(existing["address"], str):
        raw_addresses.append({"address": existing["address"]})

    valid_addresses = []
    seen_addresses = set()
    for addr_item in raw_addresses:
        if isinstance(addr_item, str):
            addr_item = {"address": addr_item}
        if isinstance(addr_item, dict):
            addr_str = (addr_item.get("address") or "").strip()
            if len(addr_str) > 5 and addr_str.lower() not in ["n/a", "unknown", "none"]:
                norm_addr = " ".join(addr_str.lower().split())
                if norm_addr not in seen_addresses:
                    seen_addresses.add(norm_addr)
                    valid_addresses.append({
                        "address": addr_str,
                        "type": addr_item.get("type", "Corporate"),
                        "source_url": addr_item.get("source_url", "")
                    })

    # --- 6. Deduplicate & Merge Contact Persons ---
    raw_contacts = []
    if data.get("contact_persons") and isinstance(data["contact_persons"], list):
        raw_contacts.extend(data["contact_persons"])
    if existing.get("contact_persons") and isinstance(existing["contact_persons"], list):
        raw_contacts.extend(existing["contact_persons"])

    valid_contacts = []
    seen_contact_names = set()
    for cp in raw_contacts:
        if isinstance(cp, dict):
            cp_name = (cp.get("name") or "").strip()
            if len(cp_name) > 1 and cp_name.lower() not in ["n/a", "unknown", "none", "ceo"]:
                norm_cp_name = " ".join(cp_name.lower().split())
                if norm_cp_name not in seen_contact_names:
                    seen_contact_names.add(norm_cp_name)
                    cp_email = (cp.get("email") or "").strip()
                    if cp_email and is_valid_email(cp_email) and cp_email.lower() not in seen_emails:
                        seen_emails.add(cp_email.lower())
                        valid_emails.append(cp_email)
                    cp_phone = (cp.get("phone") or "").strip()
                    if cp_phone and is_valid_phone(cp_phone):
                        p_clean = re.sub(r'\D', '', cp_phone)
                        if p_clean not in seen_phones:
                            seen_phones.add(p_clean)
                            valid_phones.append(cp_phone)

                    valid_contacts.append({
                        "name": cp_name,
                        "designation": (cp.get("designation") or "").strip(),
                        "email": cp_email,
                        "phone": cp_phone,
                        "department": (cp.get("department") or "").strip(),
                        "source_url": (cp.get("source_url") or "").strip()
                    })

    # --- 7. Deduplicate & Merge Sources ---
    raw_sources = []
    if data.get("sources") and isinstance(data["sources"], list):
        raw_sources.extend(data["sources"])
    if existing.get("sources") and isinstance(existing["sources"], list):
        raw_sources.extend(existing["sources"])

    valid_sources = []
    seen_sources = set()
    for src in raw_sources:
        if isinstance(src, dict):
            s_url = (src.get("url") or "").strip()
            if is_valid_url(s_url):
                norm_s_url = s_url.lower().rstrip('/')
                if norm_s_url not in seen_sources:
                    seen_sources.add(norm_s_url)
                    valid_sources.append({
                        "url": s_url,
                        "title": (src.get("title") or "").strip(),
                        "source_type": (src.get("source_type") or "web").strip()
                    })

    # --- Primary Scalar Fields ---
    primary_email = valid_emails[0] if valid_emails else ""
    primary_phone = valid_phones[0] if valid_phones else ""
    primary_address = valid_addresses[0]["address"] if valid_addresses else ""
    primary_linkedin = valid_linkedin[0] if valid_linkedin else ""

    is_partial = not (primary_email or primary_phone or primary_address)
    source = data.get("source") or existing.get("source") or "api"

    result_data = {
        "company_name": company_name,
        "website": website,
        "address": primary_address,
        "phone": primary_phone,
        "email": primary_email,
        "linkedin": primary_linkedin,
        "industry": industry,
        "country": country,
        "fax_numbers": valid_faxes,
        "emails_list": valid_emails,
        "phones_list": valid_phones,
        "linkedin_urls": valid_linkedin,
        "addresses": valid_addresses,
        "contact_persons": valid_contacts,
        "sources": valid_sources,
        "isPartial": is_partial,
        "fetched_at": datetime.now().isoformat(),
        "source": source
    }

    details_json_str = json.dumps(result_data, ensure_ascii=False)

    try:
        conn = get_sqlite_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO contact_cache (company_name, website, address, phone, email, linkedin, industry, details_json, fetched_at, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(company_name) DO UPDATE SET
                website=excluded.website,
                address=excluded.address,
                phone=excluded.phone,
                email=excluded.email,
                linkedin=excluded.linkedin,
                industry=excluded.industry,
                details_json=excluded.details_json,
                fetched_at=CURRENT_TIMESTAMP,
                source=excluded.source
        """, (
            company_name,
            website,
            primary_address,
            primary_phone,
            primary_email,
            primary_linkedin,
            industry,
            details_json_str,
            source
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error persisting enriched data to SQLite in save_enriched_data: {e}")

    # Also update in-memory PharmaDatabase if available
    try:
        if 'db' in globals() and hasattr(db, 'contacts'):
            comp_key = normalize_company_name(company_name)
            db.contacts[comp_key] = result_data
            if hasattr(db, 'rebuild_indexes'):
                db.rebuild_indexes()
    except Exception:
        pass

    return result_data


class PharmaDatabase:
    def __init__(self):
        self.files: Dict[str, Dict[str, Any]] = {}
        self.contacts: Dict[str, Dict[str, Any]] = {}
        self.reports: Dict[str, Dict[str, Any]] = {}

        # High-Performance Indexes for O(1) lookups
        self.company_name_index: Dict[str, Dict[str, Any]] = {}
        self.file_id_index: Dict[str, Dict[str, Any]] = {}
        self.status_index: Dict[str, List[Dict[str, Any]]] = {"sent": [], "pending": []}
        self.last_updated_index: Dict[str, str] = {}

        self._seed_sample_data()

    def _seed_sample_data(self):
        """Seed initial dataset with NVL, DBF, CSV sample records."""
        sample_file_id = "file-sample-nvl-001"
        sample_file = {
            "id": sample_file_id,
            "name": "Novartis_Export_NVL_2026.nvl",
            "file_type": "NVL",
            "size": 102450,
            "upload_time": datetime.now().isoformat(),
            "columns": [
                "transaction_id", "exporter_name", "importer_name", "hs_code",
                "product_name", "qty", "VAL_USD", "AV_FC", "AV_PAK", "TOTAL_FC"
            ],
            "rows": [
                {
                    "transaction_id": "TX-2026-901",
                    "exporter_name": "Novartis Pharma AG",
                    "importer_name": "Apex Healthcare Distributors",
                    "hs_code": "3004.90",
                    "product_name": "Amoxicillin Trihydrate 500mg",
                    "qty": 50000,
                    "VAL_USD": 384750.00,
                    "AV_FC": 384750.00,
                    "AV_PAK": 107250000.00,
                    "TOTAL_FC": 384750.00
                },
                {
                    "transaction_id": "TX-2026-902",
                    "exporter_name": "Pfizer Global Supply",
                    "importer_name": "BioCare Logistics Inc.",
                    "hs_code": "3004.20",
                    "product_name": "Lipitor 20mg Film-Coated Tablets",
                    "qty": 25000,
                    "VAL_USD": 210000.00,
                    "AV_FC": 210000.00,
                    "AV_PAK": 58500000.00,
                    "TOTAL_FC": 210000.00
                }
            ],
            "summary": {
                "total_rows": 2,
                "exporters_count": 2,
                "importers_count": 2,
                "total_cost_usd": 594750.00,
                "detected_exporter_col": "exporter_name",
                "detected_importer_col": "importer_name",
                "detected_cost_col": "VAL_USD",
                "exporters_list": ["Novartis Pharma AG", "Pfizer Global Supply"],
                "importers_list": ["Apex Healthcare Distributors", "BioCare Logistics Inc."]
            }
        }
        self.files[sample_file_id] = sample_file
        self.rebuild_indexes()

    def rebuild_indexes(self):
        """Rebuild database indexes for instant performance lookups."""
        self.company_name_index.clear()
        self.file_id_index.clear()
        self.status_index = {"sent": [], "pending": []}
        self.last_updated_index.clear()

        # Index Files
        for f_id, f_data in self.files.items():
            self.file_id_index[f_id] = f_data
            if "upload_time" in f_data:
                self.last_updated_index[f_id] = f_data["upload_time"]

        # Index Contacts
        for c_id, c_data in self.contacts.items():
            comp_name = c_data.get("company_name", "").strip().lower()
            if comp_name:
                self.company_name_index[comp_name] = c_data

            if c_data.get("message_sent"):
                self.status_index["sent"].append(c_data)
            else:
                self.status_index["pending"].append(c_data)

            if "last_updated" in c_data:
                self.last_updated_index[c_id] = c_data["last_updated"]

    def get_file_by_id(self, file_id: Any) -> Optional[Dict[str, Any]]:
        """Flexible lookup by file_id, numeric index, or ID substring."""
        if not file_id:
            return None
        str_id = str(file_id).strip()

        if str_id in self.file_id_index:
            return self.file_id_index[str_id]
        if str_id in self.files:
            return self.files[str_id]

        files_list = list(self.files.values())

        if str_id.isdigit():
            idx = int(str_id)
            if 1 <= idx <= len(files_list):
                return files_list[idx - 1]
            if 0 <= idx < len(files_list):
                return files_list[idx]

        for f_id, f_data in self.files.items():
            if str_id in f_id or f_id in str_id:
                return f_data

        return None

    def get_company_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """O(1) indexed lookup by company_name."""
        norm = normalize_company_name(name)
        cached = get_cached_company(name)
        if cached:
            return cached
        return self.company_name_index.get(norm)

    def get_cached_company(self, name: str) -> Optional[Dict[str, Any]]:
        return get_cached_company(name)

    def save_enriched_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return save_enriched_data(data)


db = PharmaDatabase()
