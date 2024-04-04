import { addMagentoCacheListener, updateMagentoCacheSections } from '../storage/util.js';
import { getCartFromLocalStorage, getCartIdFromLocalStorage, transformCart } from './util.js';

/* eslint-disable import/no-cycle */
class Store {
  constructor(key = Store.CART_STORE) {
    this.subscribers = [];
    this.key = key;
    this.cartId = null;
    this.type = 'guest';
  }

  static CARTID_STORE = 'M2_VENIA_BROWSER_PERSISTENCE__cartId';

  static CART_STORE = 'COMMERCE_CART_CACHE';

  static COOKIE_SESSION = 'COMMERCE_SESSION';

  static COOKIE_CART_ID = 'COMMERCE_CART_ID';

  static COOKIE_EXPIRATION_DAYS = 30;

  static DEFAULT_CART = {
    items: [],
    id: null,
    total_quantity: 0,
  };

  static getCookie(key) {
    return document.cookie
      .split(';')
      .map((c) => c.trim())
      .filter((cookie) => cookie.startsWith(`${key}=`))
      .map((cookie) => decodeURIComponent(cookie.split('=')[1]))[0] || null;
  }

  static setCookie(key, value) {
    const expires = new Date(Date.now() + Store.COOKIE_EXPIRATION_DAYS * 864e5).toUTCString();
    document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  }

  // eslint-disable-next-line class-methods-use-this
  getCartId() {
    return getCartIdFromLocalStorage();
  }

  getCart() {
    try {
      const storedCart = getCartFromLocalStorage();
      if (storedCart) {
        this.cartId = storedCart.data_id;
        const parsed = transformCart(storedCart) || Store.DEFAULT_CART;
        return parsed;
      }
      return Store.DEFAULT_CART;
    } catch (err) {
      console.error('Failed to parse cart from localStore.');
    }
    return Store.DEFAULT_CART;
  }

  async updateCart() {
    await updateMagentoCacheSections(['cart']);
    this.notifySubscribers();
  }

  // TODO: see if necessary
  resetCart() {
    this.cartId = null;
    this.subscribers.forEach((callback) => {
      callback({});
    });
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    callback(this.getCart());
  }

  notifySubscribers() {
    this.subscribers.forEach((callback) => {
      callback(this.getCart());
    });
  }
}

export const store = new Store();

export const cartApi = {
  addToCart: async (sku, options, quantity) => {
    const { addToCart } = await import('./cart.js');
    const { showCart } = await import('./Minicart.js');
    if (!store.getCartId()) {
      console.debug('Cannot add item to cart, need to create a new cart first.');
      await updateMagentoCacheSections(['cart', 'customer', 'side-by-side']);
    }
    await addToCart(sku, options, quantity);
    showCart();
  },
  toggleCart: async () => {
    const { toggle } = await import('./Minicart.js');
    toggle();
  },

  /**
   * resolve any drift between localStorage/sessionStorage and true commerce session
   *
   * @param {number} delay delay in milliseconds before cart is updated
   * @param {boolean | undefined} waitForCart should the "wait for cart" loading behavior be shown
   */
  resolveDrift: async (delay, waitForCart) => {
    setTimeout(async () => {
      const { resolveSessionCartDrift } = await import('./cart.js');
      resolveSessionCartDrift({
        delay,
        waitForCart,
      });
    }, delay || 0);
  },

  updateCartDisplay: async (waitForCart) => {
    const { updateCartFromLocalStorage } = await import('./cart.js');
    updateCartFromLocalStorage({ waitForCart });
    addMagentoCacheListener(() => {
      updateCartFromLocalStorage({ waitForCart });
    });
  },

  cartItemsQuantity: {
    watch: (callback) => {
      store.subscribe((cart) => {
        callback(cart.total_quantity || 0);
      });
    },
  },
};
