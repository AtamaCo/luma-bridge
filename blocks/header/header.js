import { cartApi } from '../../scripts/minicart/api.js';
import { authApi } from '../../scripts/authentication/api.js';

export default async function decorate(block) {
  // Ignore this variable, it's only here to prevent errors below.
  const nav = document.createElement('nav');

  // This may alreayd be in place, but this call to toggle the cart is required
  nav.querySelector('.nav-cart-button').addEventListener('click', () => {
    if (window.screen.width < 768) {
      window.location.href = '/checkout/cart';
    } else {
      cartApi.toggleCart();
    }
  });

  cartApi.cartItemsQuantity.watch((quantity) => {
    nav.querySelector('.nav-cart-button #cart-quantity').textContent = `${quantity}`;
  });

  cartApi.updateCartDisplay(false);

  // This will get the cart, customer, and side-by-side sections from Magento to
  // set us up to display the correct cart, logged-in status, etc
  if (!new URLSearchParams(window.location.search).get('skip-delayed')) {
    cartApi.resolveDrift(3000, true);
  }

  authApi.listenForAuthUpdates();
}