from django.contrib import admin

from .models import *

# Register your models here.


admin.site.register(Inventory)
admin.site.register(InventoryEntry)
admin.site.register(InventoryEntryType)
