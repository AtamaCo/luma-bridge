# Header Updates

The `header.js` file in this folder should not replace the `header.js` in your repository, but it contains
the basic structure to show where the elements to be copy/pasted (and updated) should live.

The basic breakdown of the changes are:

- Updating the behavior of the cart button based on screen size (optional).
- Adding the cart display updates. The `resolveDrift` function also handles the `StorageEvent` listening
to update the cart if another tab has updated the cart information.
- Setting up the listener for authentication updates (i.e. show "Sign in" vs "My Account").