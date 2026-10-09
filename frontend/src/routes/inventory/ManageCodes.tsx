// Manage Barcodes, QR-Codes, etc for articles and chests.


import { useState } from "react"

import Scanner from "@/components/qr-bar-code/Scanner"
import { Button } from "@/components/ui/button"
import BaseScreen from "@/layouts/BaseScreen"


export default function ManageCodes() {
  const [isScannerOpen, setIsScannerOpen] = useState(false)


  return (
    <BaseScreen fullWidth title="Manage Codes" description="Manage barcodes, QR codes, and other codes for articles and chests.">
        {isScannerOpen ? (
          <Scanner onClose={() => setIsScannerOpen(false)} />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button>Print QR-Codes</Button>
              <Button>Show QR-Codes</Button>
              <Button onClick={() => setIsScannerOpen(true)}>Scan QR/Barcode</Button>
            </div>

            <p className="mt-6 text-muted-foreground">Here are the articles, chests, and other items with their associated codes.</p>
          </>
        )}

    </BaseScreen>
  );
}
