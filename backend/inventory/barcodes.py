"""Barcode types, normalization and check digits.

"Barcode" covers the numbers printed under a product's barcode: EAN/UPC (GTIN), ISBN and the
German PZN for medicines. The umbrella term would be GTIN, but a PZN isn't one, and hardly
anyone knows the word, so the UI and API call them barcodes.
"""

import re

from django.db import models


class BarcodeKind(models.TextChoices):
    EAN = "ean", "EAN / UPC"
    ISBN = "isbn", "ISBN"
    PZN = "pzn", "PZN"
    OTHER = "other", "Other"


GTIN_LENGTHS = (8, 12, 13, 14)
_DIGITS = re.compile(r"\d+")
_ISBN_10 = re.compile(r"\d{9}[\dX]")


def _compact(value: str) -> str:
    """Drop spaces and hyphens, which are only there for reading."""
    return re.sub(r"[\s-]", "", value)


def normalize(kind: str, value: str) -> str:
    value = str(value).strip()
    if kind == BarcodeKind.OTHER:
        return value
    value = _compact(value).upper()
    if kind == BarcodeKind.PZN and value.startswith("PZN"):
        value = value[3:]
    return value


def gtin_is_valid(value: str) -> bool:
    """EAN-8, UPC-A, EAN-13 and GTIN-14 share the same mod 10 check digit."""
    if len(value) not in GTIN_LENGTHS or not _DIGITS.fullmatch(value):
        return False
    digits = [int(digit) for digit in value]
    total = sum(digit * (3 if index % 2 == 0 else 1) for index, digit in enumerate(reversed(digits[:-1])))
    return (10 - total % 10) % 10 == digits[-1]


def isbn_is_valid(value: str) -> bool:
    if len(value) == 13:
        return value[:3] in ("978", "979") and gtin_is_valid(value)
    if not _ISBN_10.fullmatch(value):
        return False
    total = sum((10 - index) * (10 if char == "X" else int(char)) for index, char in enumerate(value))
    return total % 11 == 0


def pzn_is_valid(value: str) -> bool:
    """PZN8, and the older PZN7 that is still printed on some packs. Both use mod 11."""
    if len(value) not in (7, 8) or not _DIGITS.fullmatch(value):
        return False
    first_weight = 1 if len(value) == 8 else 2
    total = sum(int(digit) * weight for weight, digit in enumerate(value[:-1], start=first_weight))
    check = total % 11
    return check != 10 and check == int(value[-1])


VALIDATORS = {
    BarcodeKind.EAN: gtin_is_valid,
    BarcodeKind.ISBN: isbn_is_valid,
    BarcodeKind.PZN: pzn_is_valid,
}


def is_valid(kind: str, value: str) -> bool:
    validator = VALIDATORS.get(kind)
    return bool(value) and (validator is None or validator(value))


def detect_kind(value: str) -> str:
    """Guess the type from the shape of the number. A PZN looks like an EAN-8, so it's never guessed."""
    compact = _compact(str(value).strip()).upper()
    if (len(compact) == 13 and compact[:3] in ("978", "979")) or _ISBN_10.fullmatch(compact):
        return BarcodeKind.ISBN
    if len(compact) in GTIN_LENGTHS and _DIGITS.fullmatch(compact):
        return BarcodeKind.EAN
    return BarcodeKind.OTHER
