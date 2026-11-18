"""Write older identifiers in uppercase, so their QR codes get the compact uppercase URL.

Identifiers generated before the switch to Crockford Base32 mix upper- and lowercase letters, which
puts the whole scan URL into QR byte mode. This is a command rather than a migration on purpose:
identifiers are printed on labels, so each instance decides itself whether and when to change them.
Old labels keep working, because the code lookup falls back to a case-insensitive match.

Without --apply, the command only lists what it would change.
"""

import re
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import Inventory, InventoryEntry

# Only plain letters and digits are changed. Identifiers with other characters were chosen by hand
# and can't get the compact URL anyway.
CHANGEABLE = re.compile(r"[0-9A-Za-z]+")


def plan_changes(identifiers):
    """Return ({old: new}, [skipped]) for one set of identifiers that have to stay unique.

    Identifiers that only differ in case (`ab`, `AB`) are all left alone: changing one would make a
    label printed with the other old value ambiguous, or point it at the wrong entry.
    """
    groups = defaultdict(list)
    for identifier in identifiers:
        groups[identifier.upper()].append(identifier)

    changes, skipped = {}, []
    for upper, group in sorted(groups.items()):
        to_change = [identifier for identifier in group if CHANGEABLE.fullmatch(identifier) and identifier != upper]
        if not to_change:
            continue
        if len(group) > 1:
            skipped.extend(sorted(to_change))
        else:
            changes[to_change[0]] = upper
    return changes, skipped


class Command(BaseCommand):
    help = "Write older mixed-case inventory and entry identifiers in uppercase, for smaller QR codes."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Change the identifiers. Without it, only list the changes.")

    def handle(self, *args, apply=False, **options):
        with transaction.atomic():
            changed = self.change_inventories(apply) + self.change_entries(apply)

        if changed == 0:
            self.stdout.write("Nothing to change.")
        elif apply:
            self.stdout.write(self.style.SUCCESS(f"Changed {changed} identifiers."))
        else:
            self.stdout.write(f"{changed} identifiers would change. Run again with --apply to change them.")

    def change_inventories(self, apply):
        changes, skipped = plan_changes(Inventory.objects.values_list("identifier", flat=True))
        self.report("inventory", changes, skipped)
        if apply:
            for old, new in changes.items():
                Inventory.objects.filter(identifier=old).update(identifier=new)
        return len(changes)

    def change_entries(self, apply):
        changed = 0
        for inventory in Inventory.objects.order_by("name"):
            entries = InventoryEntry.objects.filter(inventory=inventory)
            changes, skipped = plan_changes(entries.values_list("identifier", flat=True))
            self.report(f"entry in {inventory.name}", changes, skipped)
            if apply:
                for old, new in changes.items():
                    entries.filter(identifier=old).update(identifier=new)
            changed += len(changes)
        return changed

    def report(self, what, changes, skipped):
        for old, new in changes.items():
            self.stdout.write(f"{what}: {old} -> {new}")
        for identifier in skipped:
            self.stdout.write(self.style.WARNING(
                f"{what}: {identifier} stays, another identifier differs from it only in case"
            ))
