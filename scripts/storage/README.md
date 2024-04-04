# Storage

This directory contains the file(s) that provide helper methods for other files to access the local
storage items that are treated the same way that Magento handles them - storing the items in
`mage-cache-storage`, tracking their invalidation status in `mage-cache-storage-section-invalidation`,
tracking the cache timeout in `mage-cache-timeout`, etc.

This is also where the actual contact with Magento is happening to refresh the local storage cache and
store the information coming directly from Magento.

**Note: this requires that the endpoint `/customer/section/load` is routed to Magento.**