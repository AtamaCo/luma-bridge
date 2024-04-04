import { getMagentoCache } from '../storage/util.js';

/**
 * A helper function used to take the cart representation stored in localStorage
 * and turn it into what is supposed to be returned from the GraphQL call.
 *
 * @param {*} localStorageCart The cart object pulled from the mage-cache-storage localStorage
 * @returns A cart response more similar to what is returned from the GraphQL request
 */
export function transformCart(localStorageCart) {
  return {
    id: localStorageCart.data_id,
    items: localStorageCart.items.map((item) => {
      const bundleOptions = item.product_type === 'bundle' && item.options.map((option) => ({
        label: option.label,
        values: option.value,
      }));
      const configurableOptions = item.product_type === 'configurable' && item.options.map((option) => ({
        option_label: option.label,
        value_label: option.value,
      }));
      const transformedItem = {
        prices: {
          price: {
            value: item.product_price_value,
          },
        },
        product: {
          name: item.product_name,
          sku: item.product_sku,
          url: item.product_url,
          thumbnail: {
            url: item.product_image.src,
          },
        },
        quantity: item.qty,
      };

      if (bundleOptions) {
        transformedItem.bundle_options = bundleOptions;
      } else if (configurableOptions) {
        transformedItem.configurable_options = configurableOptions;
      }

      return transformedItem;
    }),
    prices: {
      subtotal_excluding_tax: {
        value: localStorageCart.subtotalAmount,
      },
    },
    total_quantity: localStorageCart.summary_count,
  };
}

/**
 * Returns the cart information from the commerce cache if set. This method
 * will take into account timeout of the cache and there may be times where the cart
 * is not available, e.g. on an initial browsing session.
 *
 * @returns {*|undefined} the commerce cart from local storage if set
 */
export function getCartFromLocalStorage() {
  const magentoCache = getMagentoCache();
  return magentoCache.cart;
}

/**
 * Returns the cart ID stored in the cached section data from Magento
 *
 * @returns {string|undefined} The ID or undefined
 */
export function getCartIdFromLocalStorage() {
  const magentoCache = getMagentoCache();
  return magentoCache['side-by-side']?.cart_id;
}

/**
 * Returns the bearer token used for GraphQL authentication
 * stored in the cached section data from Magento
 *
 * @returns {string|undefined} The token or undefined
 */
export function getTokenFromLocalStorage() {
  const magentoCache = getMagentoCache();
  return magentoCache['side-by-side']?.token;
}
