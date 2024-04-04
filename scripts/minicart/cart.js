/* eslint-disable import/no-cycle */
import { store } from './api.js';
import { performMonolithGraphQLQuery } from '../commerce.js';
import {
  getLoggedInFromLocalStorage,
  isCommerceStatePristine,
  updateMagentoCacheSections,
} from '../storage/util.js';
import { getCartFromLocalStorage } from './util.js';

/* Queries */

const cartQueryFragment = `fragment cartQuery on Cart {
  id
  items {
      prices {
          price {
              currency
              value
          }
          total_item_discount {
            value
          }
      }
      product {
          name
          sku
          url_key
          thumbnail {
              url
          }
      }
      ... on ConfigurableCartItem {
          configurable_options {
              option_label
              value_label
          }
          configured_variant {
              thumbnail {
                  url
              }
          }
      }
      ... on BundleCartItem {
        bundle_options {
            label
            values {
                label
                quantity                    
            }
        }
      }
      quantity
      uid
  }
  prices {
      subtotal_excluding_tax {
          currency
          value
      }
  }
  total_quantity
}`;

const getCartQuery = `query getCart($cartId: String!) {
  cart(cart_id: $cartId) {
      ...cartQuery
  }
}
${cartQueryFragment}`;

const createCartMutation = `mutation createSessionCart {
  cartId: createSessionCart
}`;

const removeItemFromCartMutation = `mutation removeItemFromCart($cartId: String!, $uid: ID!) {
  removeItemFromCart(input: { cart_id: $cartId, cart_item_uid: $uid }) {
      cart {
          ...cartQuery
      }
  }
}
${cartQueryFragment}`;

const updateCartItemsMutation = `mutation updateCartItems($cartId: String!, $items: [CartItemUpdateInput!]!) {
  updateCartItems(input: { cart_id: $cartId, cart_items: $items }) {
      cart {
          ...cartQuery
      }
  }
}
${cartQueryFragment}`;

const addProductsToCartMutation = `mutation addProductsToCart($cartId: String!, $cartItems: [CartItemInput!]!) {
  addProductsToCart(cartId: $cartId, cartItems: $cartItems) {
      cart {
          ...cartQuery
      }
      user_errors {
          code
          message
      }
  }
}
${cartQueryFragment}`;

export {
  getCartQuery,
  createCartMutation,
  removeItemFromCartMutation,
  updateCartItemsMutation,
  addProductsToCartMutation,
};

/* Methods */

const handleCartErrors = (errors) => {
  if (!errors) {
    return;
  }

  // Cart cannot be found
  if (errors.some(({ extensions }) => extensions?.category === 'graphql-no-such-entity')) {
    console.error('Cart does not exist, resetting cart');
    store.resetCart();
    return;
  }

  // No access to cart
  if (errors.some(({ extensions }) => extensions?.category === 'graphql-authorization')) {
    console.error('No access to cart, resetting cart');
    store.resetCart();
    return;
  }

  if (errors.some(({ extensions }) => extensions?.category === 'graphql-input')) {
    console.error('Some items in the cart might not be available anymore');
    return;
  }

  // Throw for everything else
  throw new Error(errors);
};

/**
 * Function called when waiting for the cart to return. 
 * TODO: Should be customized with selectors specific to your implementation.
 *
 * @returns void
 */
export function waitForCart() {
  const buttons = document.querySelectorAll('button.nav-cart-button, .minicart-header > .close');
  const wrapper = document.querySelector('.minicart-wrapper');
  wrapper?.classList.add('loading');
  buttons.forEach((button) => { button.disabled = true; });
  return () => {
    wrapper?.classList.remove('loading');
    buttons.forEach((button) => { button.disabled = false; });
  };
}

/**
 * Get the session cart from commerce system and resolve localStorage / sessionStorage state drift.
 *
 * @param {Object | undefined} options session cart options
 * @param {boolean | undefined} options.waitForCart should the "wait for cart" behavior be triggered
 * @param {boolean | undefined} options.force should the "wait for cart" behavior be triggered
 */
export async function resolveSessionCartDrift(options) {
  let sectionsOfInterest = ['cart', 'customer', 'side-by-side'];

  // We will exit and do nothing if there is no sign of a commerce session ever existing.
  if (isCommerceStatePristine() && !options.force) {
    return;
  }

  let done = () => {};
  if (options.waitForCart) {
    done = waitForCart();
  }

  await updateMagentoCacheSections(sectionsOfInterest);

  const loggedIn = getLoggedInFromLocalStorage();

  // This section is for toggling the logged in/out icon/status in your header (if relevant)
  // TODO: update selectors in here to match your account header
  document.querySelectorAll('.account-contact').forEach((item) => {
    item.classList.add(loggedIn ? 'logged-in' : 'logged-out');
    item.classList.remove(loggedIn ? 'logged-out' : 'logged-in');
  });

  localStorage.setItem('loggedIn', loggedIn);

  store.notifySubscribers();

  done();
}

export function updateCartFromLocalStorage(options) {
  let done = () => {};
  if (options.waitForCart) {
    done = waitForCart();
  }

  // Get cart representation from local storage in mage-cache-storage
  const previousLogin = localStorage.getItem('loggedIn') === 'true';

  // Get loggedin status from local storage 'customer'
  const registeredCustomer = getLoggedInFromLocalStorage();

  const storedCart = getCartFromLocalStorage();
  if (!storedCart) {
    // we just return here since we have no cart data, it will display the default empty cart
    return;
  }

  // If the commerce session tells us we are logged in...
  if (registeredCustomer === true) {
    // Update the account section in the header to point to the customer account page
    document.querySelectorAll('.account-contact a').forEach((item) => item.setAttribute('href', '/customer/account'));
    localStorage.setItem('loggedIn', true);
  } else {
    // else we are not logged in so we'll be sure the state reflects this
    if (previousLogin || !storedCart) {
      store.resetCart();
    }
    localStorage.setItem('loggedIn', false);
  }
  store.notifySubscribers();
  done();
}

export async function addToCart(sku, options, quantity) {
  const done = waitForCart();
  try {
    const variables = {
      cartId: store.getCartId(),
      cartItems: [{
        sku,
        quantity,
        selected_options: options,
      }],
    };

    const { data, errors } = await performMonolithGraphQLQuery(
      addProductsToCartMutation,
      variables,
      false,
      true,
    );
    handleCartErrors(errors);

    const { cart, user_errors: userErrors } = data.addProductsToCart;
    if (userErrors && userErrors.length > 0) {
      console.error('User errors while adding item to cart', userErrors);
    }

    cart.items = cart.items.filter((item) => item);

    // Adding a new line item to the cart incorrectly returns the total
    // quantity so we check that and update if necessary
    if (cart.items.length > 0) {
      const lineItemTotalQuantity = cart.items.flatMap(
        (item) => item.quantity,
      ).reduce((partialSum, a) => partialSum + a, 0);
      if (lineItemTotalQuantity !== cart.total_quantity) {
        console.debug('Incorrect total quantity from AC, updating.');
        cart.total_quantity = lineItemTotalQuantity;
      }
    }

    await store.updateCart();

    console.debug('Added items to cart', variables, cart);
  } catch (err) {
    console.error('Could not add item to cart', err);
  } finally {
    done();
  }
}
