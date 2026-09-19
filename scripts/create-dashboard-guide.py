from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "virtuapet-dashboard-update-guide.pdf"
PUBLIC = ROOT / "apps" / "web" / "public" / "virtuapet-dashboard-update-guide.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
PUBLIC.parent.mkdir(parents=True, exist_ok=True)

regular = "/System/Library/Fonts/Supplemental/Arial.ttf"
bold = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
pdfmetrics.registerFont(TTFont("VPRegular", regular))
pdfmetrics.registerFont(TTFont("VPBold", bold))

cream = HexColor("#FFF9F5")
muted = HexColor("#C7B8B0")
ember = HexColor("#FF7547")
gold = HexColor("#F6B85F")
panel = HexColor("#211B18")
line = HexColor("#4B3B34")
green = HexColor("#73D7AA")


def background(canvas, _doc):
    canvas.saveState()
    canvas.setFillColor(HexColor("#100D0C"))
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    canvas.setFillColor(ember)
    canvas.rect(0, letter[1] - 0.12 * inch, letter[0], 0.12 * inch, fill=1, stroke=0)
    canvas.restoreState()


title = ParagraphStyle("title", fontName="VPBold", fontSize=24, leading=27, textColor=cream, spaceAfter=7)
eyebrow = ParagraphStyle("eyebrow", fontName="VPBold", fontSize=7.5, leading=9, textColor=gold, tracking=1.5, spaceAfter=8)
intro = ParagraphStyle("intro", fontName="VPRegular", fontSize=10.5, leading=15, textColor=muted, spaceAfter=14)
heading = ParagraphStyle("heading", fontName="VPBold", fontSize=12, leading=14, textColor=cream, spaceAfter=7)
body = ParagraphStyle("body", fontName="VPRegular", fontSize=8.6, leading=12.3, textColor=muted)
step_num = ParagraphStyle("step-num", fontName="VPBold", fontSize=12, leading=14, textColor=HexColor("#26170C"), alignment=TA_CENTER)
step_text = ParagraphStyle("step-text", fontName="VPRegular", fontSize=8.5, leading=11.8, textColor=cream)
small = ParagraphStyle("small", fontName="VPRegular", fontSize=7.2, leading=10, textColor=muted)

doc = SimpleDocTemplate(str(OUTPUT), pagesize=letter, rightMargin=0.55 * inch, leftMargin=0.55 * inch, topMargin=0.46 * inch, bottomMargin=0.42 * inch)
story = [
    Paragraph("VIRTUAPET · DASHBOARD UPDATE", eyebrow),
    Paragraph("A clearer clinical workspace", title),
    Paragraph("The refreshed dashboard puts organization access, today’s work, clinic opening steps, and product maturity in one place. The Denver clinic remains a private simulation with no real patient activity.", intro),
]

cards = [
    [Paragraph("WHAT CHANGED", heading), Paragraph("WHAT STAYED SAFE", heading)],
    [Paragraph("<b>• New warm clinical layout</b><br/>Faster scanning across desktop and mobile.<br/><br/><b>• Denver clinic is easy to find</b><br/>The simulation appears first in the organization selector.<br/><br/><b>• Release states are visible</b><br/>Pilot, prototype, validation, and discovery labels remain attached to each capability.", body),
     Paragraph("<b>• Existing Entra sign-in</b><br/>Your authorized account still controls access.<br/><br/><b>• Organization isolation</b><br/>Use only the organization assigned to your account.<br/><br/><b>• Honest imaging boundaries</b><br/>DICOM is an engineering pipeline. It does not diagnose, triage, or recommend treatment.", body)],
]
card_table = Table(cards, colWidths=[3.18 * inch, 3.18 * inch], rowHeights=[0.3 * inch, 1.92 * inch], hAlign="LEFT")
card_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), panel), ("BOX", (0, 0), (-1, -1), 0.7, line),
    ("INNERGRID", (0, 0), (-1, -1), 0.7, line), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 13), ("RIGHTPADDING", (0, 0), (-1, -1), 13),
    ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
]))
story += [card_table, Spacer(1, 0.18 * inch), Paragraph("USE THE UPDATED DASHBOARD", eyebrow)]

steps = [
    ("1", "<b>Sign in</b><br/>Use your invited Microsoft Entra account."),
    ("2", "<b>Select your organization</b><br/>Choose MyPets Denver for the private clinic simulation."),
    ("3", "<b>Verify access</b><br/>The dashboard checks your active organization membership."),
    ("4", "<b>Follow the checklist</b><br/>Accept invitations before adding fictional pets or rehearsing visits."),
]
step_cells = []
for number, text in steps:
    badge = Table([[Paragraph(number, step_num)]], colWidths=[0.32 * inch], rowHeights=[0.32 * inch])
    badge.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), gold), ("BOX", (0, 0), (-1, -1), 0, gold), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    cell = Table([[badge], [Paragraph(text, step_text)]], colWidths=[1.31 * inch])
    cell.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, 0), 5), ("BOTTOMPADDING", (0, 1), (-1, 1), 0)]))
    step_cells.append(cell)
steps_table = Table([step_cells], colWidths=[1.57 * inch] * 4, hAlign="LEFT")
steps_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), HexColor("#191513")), ("BOX", (0, 0), (-1, -1), 0.7, line), ("INNERGRID", (0, 0), (-1, -1), 0.7, line), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 11), ("TOPPADDING", (0, 0), (-1, -1), 11), ("BOTTOMPADDING", (0, 0), (-1, -1), 11)]))
story += [steps_table, Spacer(1, 0.16 * inch)]

safety = Table([[Paragraph("SIMULATION RULE", heading), Paragraph("Use fictional animals and synthetic or fully de-identified imaging only. Do not use this environment for urgent care, diagnosis, prescriptions, surgery, or real payments. A licensed veterinarian remains responsible for every clinical decision.", body)]], colWidths=[1.42 * inch, 4.92 * inch])
safety.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), HexColor("#302318")), ("BOX", (0, 0), (-1, -1), 0.8, ember), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
story += [safety, Spacer(1, 0.15 * inch), Paragraph("Need help? Open “What changed” from the dashboard at any time. Access problems should be reported with the account used, selected organization, time, and visible error — never include passwords or tokens.", small)]

doc.build(story, onFirstPage=background)
PUBLIC.write_bytes(OUTPUT.read_bytes())
print(OUTPUT)
print(PUBLIC)
