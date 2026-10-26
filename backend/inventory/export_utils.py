import csv
import io
import json
import tempfile
import zipfile
from pathlib import PurePosixPath
from shutil import copyfileobj

from .models import (
    ArticleAttachment,
    ArticleCategory,
    CategoryField,
    InventoryEntry,
)
from .serializers import (
    ArticleAttachmentSerializer,
    ArticleCategorySerializer,
    CategoryFieldSerializer,
    InventoryEntrySerializer,
    InventorySerializer,
)


def generate_inventory_csv_export(inventory):
    """Build a ZIP of public serializer data as CSV tables plus referenced media."""
    archive_file = tempfile.TemporaryFile()
    media_files = set()

    def archive_media(file_field):
        if not file_field:
            return ""
        path = PurePosixPath(file_field.name.replace("\\", "/"))
        if path.is_absolute() or ".." in path.parts:
            return ""
        archive_path = f"files/{path.as_posix()}"
        if archive_path not in media_files:
            with file_field.storage.open(file_field.name, "rb") as source:
                with archive.open(archive_path, "w") as target:
                    copyfileobj(source, target)
            media_files.add(archive_path)
        return archive_path

    def write_table(archive, filename, serializer_class, objects, excluded=(), extras=None):
        serializer = serializer_class(objects, many=True)
        records = serializer.data
        headers = [field for field in serializer.child.fields if field not in excluded]
        extra_fields = list(extras or ())
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(headers + extra_fields)
        for index, record in enumerate(records):
            values = []
            for field in headers:
                value = record.get(field, "")
                if isinstance(value, (dict, list)):
                    value = json.dumps(value, ensure_ascii=False, default=str)
                values.append(value)
            values.extend(extras[field](objects[index], record) for field in extra_fields)
            writer.writerow(values)
        archive.writestr(filename, output.getvalue().encode("utf-8-sig"))

    with zipfile.ZipFile(archive_file, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        inventory_data = InventorySerializer(inventory).data
        output = io.StringIO(newline="")
        writer = csv.DictWriter(output, fieldnames=list(inventory_data.keys()))
        writer.writeheader()
        writer.writerow(inventory_data)
        archive.writestr("inventory.csv", output.getvalue().encode("utf-8-sig"))

        entries = list(InventoryEntry.objects.filter(inventory=inventory).select_related("parent", "category").order_by("created_at"))
        write_table(archive, "entries.csv", InventoryEntrySerializer, entries,
                    extras={"image_archive_file": lambda entry, _record: archive_media(entry.image)})
        write_table(archive, "categories.csv", ArticleCategorySerializer,
                    list(ArticleCategory.objects.filter(inventory=inventory).order_by("created_at")))
        write_table(archive, "category_fields.csv", CategoryFieldSerializer,
                    list(CategoryField.objects.filter(inventory=inventory).select_related("category").order_by("created_at")))

        attachments = list(ArticleAttachment.objects.filter(entry__inventory=inventory)
                           .select_related("entry").order_by("id"))
        write_table(
            archive,
            "attachments.csv",
            ArticleAttachmentSerializer,
            attachments,
            excluded=("id",),
        )

    archive_file.seek(0)
    return archive_file
