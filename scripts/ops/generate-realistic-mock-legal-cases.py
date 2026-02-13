#!/usr/bin/env python
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import textwrap
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

PAGE_W, PAGE_H = LETTER
MARGIN = 40

DOC_CATEGORY = {
    "protective_order_notice": "court",
    "family_court_notice": "court",
    "small_claims_complaint": "court",
    "summons_complaint": "court",
    "subpoena_notice": "court",
    "judgment_notice": "court",
    "court_hearing_notice": "court",
    "demand_letter": "civil",
    "eviction_notice": "housing",
    "foreclosure_default_notice": "housing",
    "repossession_notice": "housing",
    "landlord_security_deposit_notice": "housing",
    "lease_violation_notice": "housing",
    "debt_collection_notice": "debt",
    "wage_garnishment_notice": "debt",
    "tax_notice": "debt",
    "unemployment_benefits_denial": "benefits",
    "workers_comp_denial_notice": "benefits",
    "benefits_overpayment_notice": "benefits",
    "insurance_denial_letter": "insurance",
    "insurance_subrogation_notice": "insurance",
    "incident_evidence_photo": "incident",
    "utility_shutoff_notice": "utility",
    "license_suspension_notice": "dmv",
    "citation_ticket": "citation",
    "general_legal_notice": "general",
    "non_legal_or_unclear_image": "receipt",
    "unknown_legal_document": "unknown",
}

PROFILE = {
    "court": {
        "issuer": "Superior Court Administration",
        "office": "Civil and Family Clerk Division",
        "response_days": 14,
        "consequences": [
            "Court action may proceed without your response.",
            "A default order can increase cost and complexity.",
            "Delayed filings can reduce available options.",
        ],
        "records": [
            "Complete notice packet and all envelopes.",
            "Timeline of events and communication log.",
            "Prior filings, orders, and receipts.",
        ],
    },
    "civil": {
        "issuer": "Pre-Litigation Resolution Services",
        "office": "Claims and Compliance Department",
        "response_days": 10,
        "consequences": [
            "The sender may escalate to formal litigation.",
            "Claimed costs can increase with delay.",
            "Negotiation options may narrow over time.",
        ],
        "records": [
            "Letter and all attachments.",
            "Proof of payment or performance.",
            "Dated communication history.",
        ],
    },
    "housing": {
        "issuer": "Metro Housing Compliance Office",
        "office": "Tenant and Property Enforcement Unit",
        "response_days": 7,
        "consequences": [
            "Occupancy or property rights may change quickly.",
            "Fees can increase with service and filing activity.",
            "Missing cure windows can limit remedies.",
        ],
        "records": [
            "Lease or loan records and payment history.",
            "Photos and property condition notes.",
            "Messages with landlord, servicer, or manager.",
        ],
    },
    "debt": {
        "issuer": "Financial Recovery Administration",
        "office": "Collections and Compliance Unit",
        "response_days": 20,
        "consequences": [
            "Collection activity may continue.",
            "Interest, penalties, or fees may accrue.",
            "Some dispute windows may close.",
        ],
        "records": [
            "Statements, balances, and prior notices.",
            "Dispute letters and payment confirmations.",
            "Identity or account correction evidence.",
        ],
    },
    "benefits": {
        "issuer": "State Benefits Adjudication Office",
        "office": "Appeals and Determinations Bureau",
        "response_days": 15,
        "consequences": [
            "Benefit interruption or recoupment may continue.",
            "Appeal rights can narrow after deadlines.",
            "Future eligibility review may be harder.",
        ],
        "records": [
            "Determination letters and claim history.",
            "Employment or medical support records.",
            "Appeal submissions and receipts.",
        ],
    },
    "insurance": {
        "issuer": "Insurance Claims Resolution Center",
        "office": "Coverage and Recovery Team",
        "response_days": 30,
        "consequences": [
            "Coverage disputes may remain unresolved.",
            "Recovery or lien claims may continue.",
            "Missed appeals may reduce remedies.",
        ],
        "records": [
            "Policy terms and denial/subrogation notices.",
            "Invoices, estimates, and claim files.",
            "Timeline of incident and communications.",
        ],
    },
    "incident": {
        "issuer": "Incident Documentation Intake Unit",
        "office": "Evidence Review Desk",
        "response_days": 30,
        "consequences": [
            "Missing context can weaken evidence use.",
            "Unsorted files increase consultation prep time.",
            "Important facts are harder to reconstruct later.",
        ],
        "records": [
            "Original photos and timestamps.",
            "Police, medical, and estimate records.",
            "Witness names and contact details.",
        ],
    },
    "utility": {
        "issuer": "City Utility Revenue Office",
        "office": "Service Continuity and Collections",
        "response_days": 5,
        "consequences": [
            "Disconnection may occur on listed date.",
            "Reconnection may require added fees.",
            "Billing disputes can continue while disconnected.",
        ],
        "records": [
            "Current and prior utility statements.",
            "Payment confirmations and account notes.",
            "Hardship records when relevant.",
        ],
    },
    "dmv": {
        "issuer": "Department of Motor Vehicle Compliance",
        "office": "License Review and Enforcement",
        "response_days": 12,
        "consequences": [
            "Driving restrictions may become effective.",
            "Reinstatement requirements may increase.",
            "Delays may extend suspension timelines.",
        ],
        "records": [
            "Notice, registration, and insurance records.",
            "Prior DMV correspondence.",
            "Proof of completed obligations.",
        ],
    },
    "citation": {
        "issuer": "Traffic and Municipal Violations Bureau",
        "office": "Citation Processing Unit",
        "response_days": 21,
        "consequences": [
            "Penalties may increase over time.",
            "Collection or holds may be initiated.",
            "Additional appearance requirements may apply.",
        ],
        "records": [
            "Citation copy and any correction proof.",
            "Payment receipts if already resolved.",
            "Supporting media or witness notes.",
        ],
    },
    "general": {
        "issuer": "Legal Affairs Administrative Office",
        "office": "Public Notice and Compliance Desk",
        "response_days": 14,
        "consequences": [
            "Review may proceed without clarification.",
            "Follow-up notices may have tighter windows.",
            "Delay can increase coordination time.",
        ],
        "records": [
            "Current notice and referenced exhibits.",
            "Background records tied to the matter.",
            "Simple chronology of events.",
        ],
    },
    "receipt": {
        "issuer": "Valley Market and Pharmacy",
        "office": "Store Register Receipt",
        "response_days": 0,
        "consequences": [
            "This file alone is not a legal notice.",
            "Add legal context to avoid missing signals.",
            "Attach related formal documents when available.",
        ],
        "records": [
            "Receipt and purchase details.",
            "Incident context linking this evidence.",
            "Any notice related to this transaction.",
        ],
    },
    "unknown": {
        "issuer": "Unclassified Legal Correspondence Desk",
        "office": "Manual Review Unit",
        "response_days": 14,
        "consequences": [
            "Unknown context may hide critical deadlines.",
            "Incomplete packets can raise legal prep costs.",
            "Routing delays can defer next steps.",
        ],
        "records": [
            "All available pages from sender.",
            "How and when the document was received.",
            "Related contracts and prior notices.",
        ],
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--run-tag", required=True)
    parser.add_argument("--recipient-name", default="Xavier Smooth")
    parser.add_argument("--recipient-address", default="2458 N Valencia Dr, Phoenix, AZ 85016")
    return parser.parse_args()


def run_date(run_tag: str) -> dt.date:
    digits = "".join(ch for ch in run_tag if ch.isdigit())
    if len(digits) >= 8:
        try:
            return dt.date(int(digits[:4]), int(digits[4:6]), int(digits[6:8]))
        except ValueError:
            return dt.date.today()
    return dt.date.today()


def stable_num(seed: str, mod: int, offset: int = 0) -> int:
    return offset + (int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:12], 16) % mod)


def fmt_date(value: dt.date) -> str:
    return value.strftime("%B %d, %Y")


def wrap_text(text: str, max_chars: int) -> list[str]:
    if not text.strip():
        return [""]
    return textwrap.wrap(text, width=max(20, max_chars), break_long_words=False)


def draw_wrapped(
    c: canvas.Canvas, text: str, x: float, y: float, width: float, font="Helvetica", size=10, leading=13
) -> float:
    c.setFont(font, size)
    max_chars = int(width / (size * 0.53))
    for para in text.split("\n"):
        for line in wrap_text(para, max_chars):
            c.drawString(x, y, line)
            y -= leading
        if not para.strip():
            y -= 4
    return y


def section(c: canvas.Canvas, title: str, y: float) -> float:
    c.setFillColor(colors.HexColor("#E2E8F0"))
    c.rect(MARGIN, y - 14, PAGE_W - (2 * MARGIN), 17, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN + 7, y - 2, title.upper())
    return y - 24


def bullets(c: canvas.Canvas, items: list[str], y: float) -> float:
    for item in items:
        lines = wrap_text(item, int((PAGE_W - (2 * MARGIN) - 20) / 5.4))
        if not lines:
            continue
        c.setFont("Helvetica", 10)
        c.drawString(MARGIN + 8, y, "-")
        c.drawString(MARGIN + 18, y, lines[0])
        y -= 13
        for line in lines[1:]:
            c.drawString(MARGIN + 18, y, line)
            y -= 13
        y -= 1
    return y


def footer(c: canvas.Canvas, page_no: int) -> None:
    c.setStrokeColor(colors.HexColor("#E2E8F0"))
    c.line(MARGIN, 42, PAGE_W - MARGIN, 42)
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#334155"))
    c.drawString(
        MARGIN,
        30,
        "Synthetic QA document for ClearCase testing only. This document is not legal advice.",
    )
    c.drawRightString(PAGE_W - MARGIN, 30, f"Page {page_no}")


def draw_timeline_table(c: canvas.Canvas, y: float, rows: list[tuple[str, str, str]]) -> float:
    row_h = 18
    width = PAGE_W - (2 * MARGIN) - 12
    x = MARGIN + 6
    date_col = 122
    action_col = 124
    total_h = row_h * (len(rows) + 1)
    bottom = y - total_h
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.rect(x, bottom, width, total_h, stroke=1, fill=0)
    c.line(x + date_col, bottom, x + date_col, y)
    c.line(x + date_col + action_col, bottom, x + date_col + action_col, y)
    for i in range(1, len(rows) + 1):
        c.line(x, y - i * row_h, x + width, y - i * row_h)
    c.setFillColor(colors.HexColor("#F8FAFC"))
    c.rect(x, y - row_h, width, row_h, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 6, y - 12, "Date")
    c.drawString(x + date_col + 6, y - 12, "Action")
    c.drawString(x + date_col + action_col + 6, y - 12, "Notes")
    c.setFont("Helvetica", 9)
    for idx, (d, a, n) in enumerate(rows, start=1):
        yy = y - idx * row_h - 12
        c.drawString(x + 6, yy, d[:24])
        c.drawString(x + date_col + 6, yy, a[:26])
        c.drawString(x + date_col + action_col + 6, yy, n[:40])
    return bottom - 14


def render_receipt_fixture(
    c: canvas.Canvas,
    fixture: dict[str, str],
    run_tag: str,
    issue_date: dt.date,
    recipient_name: str,
    case_no: str,
    notice_no: str,
) -> None:
    c.setFont("Courier-Bold", 15)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 52, "VALLEY MARKET AND PHARMACY")
    c.setFont("Courier", 10)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 68, "1880 East Brookline Ave, Phoenix, AZ 85018")
    c.drawCentredString(PAGE_W / 2, PAGE_H - 82, "Tel: (602) 555-0101")
    c.line(MARGIN, PAGE_H - 92, PAGE_W - MARGIN, PAGE_H - 92)

    y = PAGE_H - 116
    c.setFont("Courier", 10)
    c.drawString(MARGIN, y, f"Receipt ID: RCT-{notice_no}")
    c.drawRightString(PAGE_W - MARGIN, y, f"Date: {fmt_date(issue_date)}")
    y -= 16
    c.drawString(MARGIN, y, f"Customer: {recipient_name}")
    c.drawRightString(PAGE_W - MARGIN, y, f"Register: 04  Run: {run_tag}")
    y -= 24

    c.setFont("Courier-Bold", 10)
    c.drawString(MARGIN, y, "ITEM")
    c.drawRightString(PAGE_W - MARGIN - 120, y, "QTY")
    c.drawRightString(PAGE_W - MARGIN - 40, y, "PRICE")
    c.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4)
    y -= 18

    items = [
        ("First aid kit", 1, 18.99),
        ("Notebook and pens", 1, 8.49),
        ("Phone charger", 1, 16.99),
        ("Printed photos (8x10)", 12, 23.88),
        ("Storage binder", 1, 9.79),
    ]
    subtotal = 0.0
    c.setFont("Courier", 10)
    for name, qty, price in items:
        subtotal += price
        c.drawString(MARGIN, y, name)
        c.drawRightString(PAGE_W - MARGIN - 120, y, str(qty))
        c.drawRightString(PAGE_W - MARGIN - 40, y, f"${price:0.2f}")
        y -= 14

    tax = round(subtotal * 0.086, 2)
    total = round(subtotal + tax, 2)
    y -= 8
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    y -= 15
    c.drawRightString(PAGE_W - MARGIN - 120, y, "SUBTOTAL")
    c.drawRightString(PAGE_W - MARGIN - 40, y, f"${subtotal:0.2f}")
    y -= 14
    c.drawRightString(PAGE_W - MARGIN - 120, y, "TAX")
    c.drawRightString(PAGE_W - MARGIN - 40, y, f"${tax:0.2f}")
    y -= 16
    c.setFont("Courier-Bold", 11)
    c.drawRightString(PAGE_W - MARGIN - 120, y, "TOTAL")
    c.drawRightString(PAGE_W - MARGIN - 40, y, f"${total:0.2f}")
    y -= 26

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.drawString(MARGIN, y, "Assessment")
    y -= 14
    c.setFont("Helvetica", 10)
    text = (
        f"{fixture['description']} This receipt alone is not a legal notice. "
        "Attach legal correspondence and event context if this is evidence."
    )
    draw_wrapped(c, text, MARGIN, y, PAGE_W - (2 * MARGIN))
    footer(c, 1)
    c.showPage()

    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, PAGE_H - 58, "Evidence Context Worksheet")
    c.setFont("Helvetica", 9)
    c.drawString(MARGIN, PAGE_H - 74, f"Case {case_no} | Link receipt details to case events.")
    y2 = PAGE_H - 98
    y2 = section(c, "What happened and why this receipt matters", y2)
    for _ in range(12):
        c.line(MARGIN + 6, y2, PAGE_W - MARGIN - 6, y2)
        y2 -= 15
    y2 -= 8
    y2 = section(c, "Related documents to upload next", y2)
    for _ in range(8):
        c.line(MARGIN + 6, y2, PAGE_W - MARGIN - 6, y2)
        y2 -= 15
    footer(c, 2)
    c.showPage()


def render_fixture(
    fixture: dict[str, str],
    output_path: Path,
    run_tag: str,
    issue_date: dt.date,
    recipient_name: str,
    recipient_address: str,
) -> None:
    category = DOC_CATEGORY.get(fixture["documentType"], "general")
    profile = PROFILE[category]
    response_days = int(profile["response_days"])
    due_date = issue_date + dt.timedelta(days=max(response_days, 0))
    seed = f"{run_tag}:{fixture['documentType']}"
    case_no = f"{issue_date.year}-{stable_num(seed + ':case', 900000, 100000)}"
    notice_no = f"NTC-{issue_date.year}-{stable_num(seed + ':notice', 900000, 100000)}"
    docket_no = f"DKT-{stable_num(seed + ':docket', 9000, 1000)}"

    c = canvas.Canvas(str(output_path), pagesize=LETTER)
    c.setTitle(fixture["caseTitle"])
    c.setAuthor("ClearCase QA Fixture Generator")

    if category == "receipt":
        render_receipt_fixture(
            c=c,
            fixture=fixture,
            run_tag=run_tag,
            issue_date=issue_date,
            recipient_name=recipient_name,
            case_no=case_no,
            notice_no=notice_no,
        )
        c.save()
        return

    c.setFillColor(colors.HexColor("#0F172A"))
    c.rect(MARGIN, PAGE_H - 92, PAGE_W - (2 * MARGIN), 52, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(MARGIN + 12, PAGE_H - 62, profile["issuer"])
    c.setFont("Helvetica", 10)
    c.drawString(MARGIN + 12, PAGE_H - 78, profile["office"])
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(PAGE_W - MARGIN - 12, PAGE_H - 62, "OFFICIAL NOTICE")
    c.setFont("Helvetica", 9)
    c.drawRightString(PAGE_W - MARGIN - 12, PAGE_H - 78, f"Run: {run_tag}")

    y = PAGE_H - 108
    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 13)
    c.drawString(MARGIN, y, fixture["caseTitle"].upper())
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#334155"))
    c.drawString(MARGIN, y - 15, f"Type: {fixture['documentType']} | Jurisdiction: AZ")

    meta_x = PAGE_W - MARGIN - 206
    meta_y = PAGE_H - 128
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.rect(meta_x, meta_y - 78, 206, 78, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.drawString(meta_x + 8, meta_y - 12, "NOTICE NUMBER")
    c.drawString(meta_x + 8, meta_y - 30, "CASE NUMBER")
    c.drawString(meta_x + 8, meta_y - 48, "DOCKET")
    c.drawString(meta_x + 8, meta_y - 66, "ISSUE DATE")
    c.setFont("Helvetica", 8)
    c.drawRightString(meta_x + 198, meta_y - 12, notice_no)
    c.drawRightString(meta_x + 198, meta_y - 30, case_no)
    c.drawRightString(meta_x + 198, meta_y - 48, docket_no)
    c.drawRightString(meta_x + 198, meta_y - 66, fmt_date(issue_date))

    box_top = PAGE_H - 215
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.rect(MARGIN, box_top - 66, PAGE_W - (2 * MARGIN), 66, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.drawString(MARGIN + 8, box_top - 14, "TO")
    c.setFont("Helvetica", 10)
    c.drawString(MARGIN + 8, box_top - 30, recipient_name)
    c.drawString(MARGIN + 8, box_top - 44, recipient_address)
    c.drawString(MARGIN + 8, box_top - 58, f"Reference ID: XS-{case_no}")
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(PAGE_W - MARGIN - 8, box_top - 14, "SENT VIA MAIL AND ELECTRONIC COPY")
    c.setFont("Helvetica", 9)
    c.drawRightString(PAGE_W - MARGIN - 8, box_top - 58, f"Suggested response date: {fmt_date(due_date)}")

    y = box_top - 84
    y = section(c, "Notice Summary", y)
    y = draw_wrapped(
        c,
        fixture["description"]
        + " This synthetic sample mirrors common formatting and wording seen in legal or administrative notices.",
        MARGIN + 6,
        y,
        PAGE_W - (2 * MARGIN) - 12,
    )
    y -= 6
    y = section(c, "Important Dates and Actions", y)
    if category == "receipt":
        rows = [
            (fmt_date(issue_date), "Receipt captured", "Store transaction imported"),
            (fmt_date(issue_date + dt.timedelta(days=7)), "Context review", "Attach related legal notice if any"),
            (fmt_date(issue_date + dt.timedelta(days=14)), "Evidence check", "Confirm relevance to case file"),
        ]
    else:
        rows = [
            (fmt_date(issue_date), "Notice issued", "Document served to recipient"),
            (fmt_date(due_date), "Response or filing due", "Timeline may vary by jurisdiction"),
            (fmt_date(due_date + dt.timedelta(days=7)), "Administrative follow-up", "Additional notice may be sent"),
        ]
    y = draw_timeline_table(c, y, rows)
    y = section(c, "Potential Outcomes if Ignored", y)
    y = bullets(c, profile["consequences"], y)
    y -= 4
    y = section(c, "Records Commonly Gathered", y)
    y = bullets(c, profile["records"], y)

    footer(c, 1)
    c.showPage()

    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, PAGE_H - 58, "Consultation Intake Worksheet")
    c.setFont("Helvetica", 9)
    c.drawString(MARGIN, PAGE_H - 74, f"{fixture['caseTitle']} | Case {case_no} | Recipient {recipient_name}")
    y2 = PAGE_H - 98
    y2 = section(c, "Chronology of Events", y2)
    for _ in range(8):
        c.line(MARGIN + 6, y2, PAGE_W - MARGIN - 6, y2)
        y2 -= 15
    y2 -= 8
    y2 = section(c, "People and Organizations Involved", y2)
    for _ in range(5):
        c.line(MARGIN + 6, y2, PAGE_W - MARGIN - 6, y2)
        y2 -= 15
    y2 -= 8
    y2 = section(c, "Documents to Bring", y2)
    checks = [
        "Notice packet and attachments",
        "Prior correspondence and statements",
        "Payment records and receipts",
        "Timeline notes and key names",
        "Questions for first consultation",
    ]
    for row in checks:
        c.rect(MARGIN + 8, y2 - 10, 9, 9, stroke=1, fill=0)
        c.setFont("Helvetica", 9)
        c.drawString(MARGIN + 23, y2 - 8, row)
        y2 -= 16
    y2 -= 6
    y2 = section(c, "Questions for Counsel", y2)
    for _ in range(7):
        c.line(MARGIN + 6, y2, PAGE_W - MARGIN - 6, y2)
        y2 -= 15
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN + 6, y2 - 2, "Estimated preparation time saved when this packet is complete: 45-90 minutes.")

    footer(c, 2)
    c.showPage()
    c.save()


def load_fixtures(path: Path) -> list[dict[str, str]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("Fixture file must be a JSON array.")
    fixtures = []
    for idx, row in enumerate(payload):
        if not isinstance(row, dict):
            raise ValueError(f"Fixture index {idx} must be an object.")
        data = {}
        for field in ("documentType", "caseTitle", "fileName", "description"):
            value = row.get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"Fixture index {idx} missing field '{field}'.")
            data[field] = value.strip()
        fixtures.append(data)
    return fixtures


def main() -> int:
    args = parse_args()
    fixtures = load_fixtures(Path(args.fixtures).resolve())
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    issue = run_date(args.run_tag.strip())
    for fixture in fixtures:
        target = out_dir / fixture["fileName"]
        render_fixture(
            fixture=fixture,
            output_path=target,
            run_tag=args.run_tag.strip(),
            issue_date=issue,
            recipient_name=args.recipient_name.strip() or "Xavier Smooth",
            recipient_address=args.recipient_address.strip() or "2458 N Valencia Dr, Phoenix, AZ 85016",
        )
        print(f"generated {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
