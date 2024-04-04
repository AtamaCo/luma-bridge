# Atama's Luma Bridge for Edge Delivery Services
This repository contains code examples (some of which can be copy/pasted into the repository wholesale)
for setting up the Luma Bridge to manage user sessions and cart information when choosing to go with
a 'side-by-side' approach for Adobe Commerce and Edge Delivery Services.

## Architecture
The bridge we've created aims to ease the problems created when trying to share a session between the two
systems. The idea is to start and Edge Delivery Services implementation forked from the
[aem-boilerplate-commerce](https://github.com/hlxsites/aem-boilerplate-commerce) repository.
It accomplishes the session sharing through the following changes:
- Managing the cart and user authentication status through local storage in the same way a headful
implementation does. [See commerce docs.](https://developer.adobe.com/commerce/php/development/cache/page/private-content/)
- Adding our own custom Customer Data section called `side-by-side` to manage the PHP session to GraphQL
Bearer token dance.


## Magento Installation
Below you'll find a link to the repository containing the Magento Module required to be installed in your
Magento instance to ensure that the `side-by-side` customer section is available.

[Atama Session Sharing Module](https://github.com/AtamaCo/Atama_Share)


## Edge Delivery Services Installation
Each part of the Luma Bridge code has brief instructions (some as simple as copy/paste) in a README
within the section containing the code. You'll find links to the different sections below.


### Links
[Minicart](/scripts/minicart/README.md)

[Authentication](/scripts/authentication/README.md)

[Local Storage](/scripts/storage/README.md)

[Header](/blocks/header/README.md)
