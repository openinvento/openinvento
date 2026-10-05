from inventory.models import Inventory


def create_user_inventory(user):
    inventory = Inventory.objects.create(name=f"{user.username}'s Inventory")
    user.inventories.add(inventory)
    return inventory