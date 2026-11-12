import re
from io import BytesIO
from urllib.parse import quote

from django.conf import settings
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A5, LETTER
from reportlab.pdfgen import canvas


# Characters a QR code stores in alphanumeric mode (5.5 bits each instead of 8). It has no lowercase.
UPPERCASE_IDENTIFIER = re.compile(r"[0-9A-Z]+")
UPPERCASE_ORIGIN = re.compile(r"HTTPS?://[0-9A-Z.:-]+")


# A URL path segment of "." or ".." is removed when the URL is resolved, so such an identifier can't be in a link.
DOT_SEGMENTS = (".", "..")


def scan_base_url() -> str:
    """The origin that scan URLs in QR codes point at."""
    return settings.APP_URL


def scan_url(item) -> str:
    """The URL of an entry for a QR code: {base URL}/i/{inventory identifier}/{identifier}.

    All uppercase when the whole URL allows it, which makes the QR code smaller.
    """
    inventory_identifier = item.inventory.identifier
    identifier = item.identifier
    base_url = scan_base_url()
    origin = base_url.upper()
    if (
        UPPERCASE_IDENTIFIER.fullmatch(inventory_identifier)
        and UPPERCASE_IDENTIFIER.fullmatch(identifier)
        and UPPERCASE_ORIGIN.fullmatch(origin)
    ):
        return f"{origin}/I/{inventory_identifier}/{identifier}"
    return f"{base_url}/i/{quote(inventory_identifier, safe='')}/{quote(identifier, safe='')}"


def qr_code_value(item, use_urls: bool) -> str:
    """The scan URL, or the identifier alone if there is no base URL or the identifier can't be part of a URL."""
    linkable = item.identifier not in DOT_SEGMENTS and item.inventory.identifier not in DOT_SEGMENTS
    return scan_url(item) if use_urls and scan_base_url() and linkable else item.identifier


def generate_codes_pdf(
    selected_items,
    code_type: str,
    size: str,
    layout: str,
    error_correction: str = "M",
    use_urls: bool = False,
) -> BytesIO:
    page_sizes = {"a4": A4, "a5": A5, "letter": LETTER}
    page_width, page_height = page_sizes[size]
    columns, rows = (2, 4) if layout == "horizontal" else (4, 2)
    cell_width = page_width / columns
    cell_height = page_height / rows
    pdf_buffer = BytesIO()
    pdf = canvas.Canvas(pdf_buffer, pagesize=(page_width, page_height))

    for item_number, (item, object_type) in enumerate(selected_items):
        page_index = item_number % (columns * rows)
        if page_index == 0 and item_number:
            pdf.showPage()
        column = page_index % columns
        row = rows - 1 - page_index // columns
        origin_x = column * cell_width
        origin_y = row * cell_height
        label = getattr(item, "name", getattr(item, "label", str(item)))

        pdf.setStrokeColor(colors.lightgrey)
        pdf.rect(origin_x, origin_y, cell_width, cell_height)
        pdf.setFillColor(colors.black)
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawCentredString(origin_x + cell_width / 2, origin_y + cell_height - 20, str(label)[:32])
        pdf.setFont("Helvetica", 7)
        pdf.drawCentredString(origin_x + cell_width / 2, origin_y + 10, f"{object_type}: {item.identifier}")

        if code_type == "qr":
            code = QrCodeWidget(qr_code_value(item, use_urls), barLevel=error_correction)
            bounds = code.getBounds()
            code_width = bounds[2] - bounds[0]
            code_height = bounds[3] - bounds[1]
            drawing_size = min(cell_width * 0.62, cell_height * 0.62)
            drawing = Drawing(
                drawing_size,
                drawing_size,
                transform=[drawing_size / code_width, 0, 0, drawing_size / code_height, 0, 0],
            )
            drawing.add(code)
            renderPDF.draw(
                drawing,
                pdf,
                origin_x + (cell_width - drawing_size) / 2,
                origin_y + (cell_height - drawing_size) / 2,
            )
        else:
            code = createBarcodeDrawing(
                "Code128",
                value=item.identifier,
                barHeight=cell_height * 0.38,
                barWidth=1.0,
            )
            renderPDF.draw(code, pdf, origin_x + (cell_width - code.width) / 2, origin_y + cell_height * 0.25)

    pdf.save()
    pdf_buffer.seek(0)
    return pdf_buffer
