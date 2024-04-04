# Minicart

The files in this directory are copied from the
[aem-boilerplate-commerce](https://github.com/hlxsites/aem-boilerplate-commerce/tree/main/scripts/minicart) repository (latest changes as of March 15th).

There are changes within each file, though some are only display related and will need to be changed or
ignored. The main changes can be found in:

- `api.js`
  - Changes to the exported cart API to update cart creation and adding to cart calls, as well as the function
  called when the page is loaded to resolve the possible drift between Magento and Edge Delivery.
- `cart.js`
  - Modified add to cart functionality and changing the functionality away from direct GraphQL requests
  to get the updated cart.
- `util.js`
  - Newly added file to help with retrieval of certain cache items.