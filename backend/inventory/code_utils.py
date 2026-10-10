from io import BytesIO

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A5, LETTER
from reportlab.pdfgen import canvas


def generate_codes_pdf(selected_items, code_type: str, size: str, layout: str) -> BytesIO:
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
            code = QrCodeWidget(item.identifier)
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
