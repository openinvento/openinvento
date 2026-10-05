// MOve to openinvento/docs

## Data architecture
"inventory" 
    -> "Users" (a user can be assigned to ONE inventory. So an inventory can be accessible by multiple users) Multi inventory per user may follow later
    -> "Areas"
        -> "Shelves"
            -> "Chests"
                -> "Articles"