import { addMagentoCacheListener, getLoggedInFromLocalStorage, getMagentoCache } from '../storage/util.js';
import { getConfigValue } from '../configs.js';

export const authApi = {
  /**
   * An authentication helper method to check if the user is
   * logged in based on data in local storage.
   *
   * @returns Whether the current user is logged in
   */
  isLoggedIn: () => getLoggedInFromLocalStorage(),

  /**
   * Login with the existing Magento implementation.
   *
   * @param {*} input required input
   * @param {Object} input.formFields the form fields
   * @returns void
   */
  login: async (input) => {
    const { formFields: loginData } = input;
    loginData.captcha_form_id = 'user_login';
    loginData.context = 'checkout';

    // We'll use an abort controller to make sure we don't hang for too long blocking the user.
    const loginAbortController = new AbortController();
    setTimeout(() => loginAbortController.abort('Too long.'), 6000);

    const response = await fetch('/customer/ajax/login/', {
      signal: loginAbortController.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Store: await getConfigValue('commerce-store-code'),
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
      body: JSON.stringify(loginData),
    });
    const result = await response.json();

    return result;
  },

  /**
   * Triggers the display updates the account section.
   * Can be extended to update other areas of the nav (i.e. 'reward points')
   */
  updateAuthenticationDisplays: () => {
    const registeredCustomer = getLoggedInFromLocalStorage();

    // updating account display
    document.querySelectorAll('.account-contact').forEach((item) => {
      item.classList.add(registeredCustomer ? 'logged-in' : 'logged-out');
      item.classList.remove(registeredCustomer ? 'logged-out' : 'logged-in');
    });
  },

  /**
   * Setting up a listener to update the display for all authentication-specific
   * displays when the local storage cache is updated.
   */
  listenForAuthUpdates: () => {
    addMagentoCacheListener(() => {
      authApi.updateAuthenticationDisplays();
    });
  },
};
