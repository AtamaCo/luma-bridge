const COMMERCE_CACHE_TIMEOUT_KEY = 'mage-cache-timeout';
const COMMERCE_CACHE_STORAGE_KEY = 'mage-cache-storage';
const COMMERCE_CACHE_INVALIDATION_KEY = 'mage-cache-storage-section-invalidation';
const COMMERCE_CACHE_SESSION_COOKIE = 'mage-cache-sessid';

/**
 * Use the Magento systems cache timeout to determine if it's safe to use the
 * local storage cache or not.
 *
 * @returns {boolean} true if local storage is expired
 */
export function isMagentoLocalStorageExpired() {
  const localMageCacheTimeout = localStorage.getItem(COMMERCE_CACHE_TIMEOUT_KEY);

  // This cookie will expire around when when the Magento PHP session cookie expires
  // see: vendor/magento/module-customer/view/frontend/web/js/customer-data.js:48
  if (document.cookie.indexOf(`${COMMERCE_CACHE_SESSION_COOKIE}=true`) === -1) {
    return true;
  }

  if (!localMageCacheTimeout) {
    return true;
  }
  let cacheTimeoutDate = null;
  try {
    cacheTimeoutDate = JSON.parse(localMageCacheTimeout);
  } catch (e) {
    // if this isn't parsable, it would be unexpected but we'll treat as expired
    return true;
  }

  const returnValue = (new Date(cacheTimeoutDate).getTime() - new Date().getTime()) < 0;

  return returnValue;
}

/**
 * Magento maintains a list of sections that have been updated and should be re-requested
 * upon page load (i.e. minicart display, customer data, etc). The mechanism used is creating
 * and updating an object in local storage. This method will add specified sections into the
 * cache invalidation list to be refreshed on the next Magento page load.
 *
 * @param {string[]} sectionsToAdd an array of the section names to be added
 * @returns {void}
 */
export function addMagentoCacheInvalidations(sectionsToAdd) {
  let invalidations = localStorage.getItem(COMMERCE_CACHE_INVALIDATION_KEY);

  try {
    invalidations = JSON.parse(invalidations);
    invalidations = {
      ...invalidations,
      ...sectionsToAdd.reduce((accumulated, current) => ({ ...accumulated, [current]: true }), {}),
    };
  } catch (e) {
    // noop
    return;
  }

  localStorage.setItem(COMMERCE_CACHE_INVALIDATION_KEY, JSON.stringify(invalidations));
}

/**
 * Removed the invalidated sections specified from the list of commerce section invalidations.
 *
 * @param {*} invalidatedSections
 * @returns {void}
 */
function removeMagentoCacheInvalidations(invalidatedSections) {
  // update invalidation to remove the cart and customer
  let invalidations = localStorage.getItem(COMMERCE_CACHE_INVALIDATION_KEY);

  try {
    invalidations = JSON.parse(invalidations);
  } catch (e) {
    // noop
    return;
  }

  const result = Object.fromEntries(Object.entries(invalidations).filter(([key]) => {
    if (invalidatedSections.includes(key)) {
      return false;
    }
    return true;
  }));
  localStorage.setItem(COMMERCE_CACHE_INVALIDATION_KEY, JSON.stringify(result));
}

/**
 * Checks if Magento has set a "dirty" flag on any cache stores that we
 * are particularly interested in. This indicates that the cache in these sections
 * should not be used and need to be refreshed.
 *
 * @param {string[]} sections the sections that should be updated
 * @returns {boolean} true if local storage is expired
 */
export function isMagentoCacheInvalidated(sections) {
  const localMageCacheInvalidations = localStorage.getItem(COMMERCE_CACHE_INVALIDATION_KEY);

  if (!localMageCacheInvalidations) {
    return false;
  }

  let invalidatedCaches = {};
  try {
    invalidatedCaches = JSON.parse(localMageCacheInvalidations);
  } catch {
    return false;
  }

  const foundMatch = Object.entries(invalidatedCaches)
    .find(([key, value]) => value === true && sections.includes(key));

  return foundMatch !== undefined;
}

/**
 * Get the Magento cache. Note that this takes into account the timeout set by the
 * commerce system.
 *
 * @returns {*} object representing the current Magento cache
 */
export function getMagentoCache() {
  const magentoCache = localStorage.getItem(COMMERCE_CACHE_STORAGE_KEY);
  if (!magentoCache || isMagentoLocalStorageExpired()) {
    return {};
  }
  try {
    return JSON.parse(magentoCache);
  } catch (error) {
    // this should never happen but if it does we won't break the page functionality
    // as it could be recovered on the commerce side
    return {};
  }
}

/**
 * Get the users authentication status, if they are logged in via the commerce
 * system or not.
 *
 * @returns {boolean} true if user is logged in based on cache status
 */
export function getLoggedInFromLocalStorage() {
  const magentoCache = getMagentoCache();
  const registeredCustomer = magentoCache.customer?.firstname !== undefined;
  return registeredCustomer;
}

/**
 * Basic helper to determine if there is any sign of a commerce session having been initiated.
 *
 * @returns {boolean} true if no commerce state is present
 */
export function isCommerceStatePristine() {
  return !localStorage.getItem(COMMERCE_CACHE_INVALIDATION_KEY)
    && !localStorage.getItem(COMMERCE_CACHE_STORAGE_KEY)
    && !localStorage.getItem(COMMERCE_CACHE_TIMEOUT_KEY)
    && (document.cookie.indexOf(`${COMMERCE_CACHE_SESSION_COOKIE}`) === -1);
}

/**
 * Updates only the Magento cart and customer cache sections.
 *
 * @param {string[]} the sections that should be updated
 * @return {void}
 */
export async function updateMagentoCacheSections(sections) {
  let result = {};
  let updatedSections = null;
  try {
    const loginAbortController = new AbortController();
    setTimeout(() => loginAbortController.abort('Section data took too long to respond.'), 10000);
    result = await fetch(`/customer/section/load/?sections=${encodeURIComponent(sections.join(','))}&force_new_section_timestamp=false`, {
      signal: loginAbortController.signal,
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
    });

    if (result?.ok) {
      updatedSections = await result.json();
    }
  } catch (error) {
    updatedSections = null;
    return;
  }

  if (updatedSections === null) {
    return;
  }

  // We are going to conservatively set the mage-cache-sessid cookie to likely be
  // always fresher than the Magento session timeout. This ideally would be set
  // to the lifetime of the PHPSESSID but it's unknown here. This could be improved.
  const minutesToTimeout = 25;
  document.cookie = `${COMMERCE_CACHE_SESSION_COOKIE}=true; path=/; expires=${(new Date(new Date().getTime() + minutesToTimeout * 60000)).toUTCString()}; SameSite=Lax; ${window.location.protocol === 'http:' ? '' : 'Secure'}`;
  let magentoCache = localStorage.getItem(COMMERCE_CACHE_STORAGE_KEY);

  try {
    magentoCache = JSON.parse(magentoCache) || {};
  } catch (e) {
    magentoCache = {};
  }

  Object.entries(updatedSections).forEach(([key, value]) => {
    magentoCache[key] = value;
  });

  if (isMagentoCacheInvalidated(sections)) {
    removeMagentoCacheInvalidations(sections);
  }
  const minutesToExpire = 30;
  localStorage.setItem(COMMERCE_CACHE_STORAGE_KEY, JSON.stringify(magentoCache));
  localStorage.setItem(
    COMMERCE_CACHE_TIMEOUT_KEY,
    JSON.stringify((new Date(new Date().getTime() + minutesToExpire * 60000)).toISOString()),
  );
  window.dispatchEvent(new StorageEvent('storage', { key: COMMERCE_CACHE_STORAGE_KEY }));
}

/**
 * A helper to set up a listener with a callback function only called when the correct
 * portion of local storage (i.e. mage-cache-storage) is updated.
 *
 * @param {function} callback the method to be called with the results of the event
 */
export function addMagentoCacheListener(callback) {
  window.addEventListener('storage', (event) => {
    if (event.key === COMMERCE_CACHE_STORAGE_KEY) {
      callback(event);
    }
  });
}
