/**
 * Initializes name/SKU autocomplete search forms.
 */
export function initProductSearchForms() {
  const searchForms = [...document.querySelectorAll('[data-product-search]')];

  searchForms.forEach((searchForm) => {
    if (!(searchForm instanceof HTMLElement) || searchForm.dataset.productSearchInitialized === 'true') return;
    searchForm.dataset.productSearchInitialized = 'true';

    const input = searchForm.querySelector('[data-product-search-input]');
    const results = searchForm.querySelector('[data-product-search-results]');
    const dataScript = searchForm.querySelector('[data-product-search-data]');

    if (!(input instanceof HTMLInputElement) || !(results instanceof HTMLElement) || !dataScript?.textContent) return;

    const isHeaderSearch = searchForm.closest('[data-header-product-search]') !== null;

    /** @type {{ title: string; price: string; image: string; url: string; terms: string[] }[]} */
    let products = [];

    try {
      products = JSON.parse(dataScript.textContent);
    } catch {
      products = [];
    }

    const normalizedProducts = products
      .map((product) => ({
        ...product,
        normalizedTerms: product.terms
          .map((term) => {
            const label = String(term).trim();
            return label ? { label, normalized: label.toLowerCase() } : null;
          })
          .filter(Boolean),
      }))
      .filter((product) => product.title && product.url && product.normalizedTerms.length > 0);

    const closeResults = () => {
      results.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      results.replaceChildren();
    };

    const navigateToProduct = (url) => {
      if (!url) return;
      window.location.href = url;
    };

    const renderResults = () => {
      const query = input.value.trim().toLowerCase();
      results.replaceChildren();

      if (query.length < 1) {
        closeResults();
        return;
      }

      const matches = normalizedProducts
        .map((product) => {
          const matchedTerm = product.normalizedTerms.find((term) => term.normalized.includes(query));
          return matchedTerm
            ? {
                product,
                matchedTerm: matchedTerm.label,
                startsWithQuery: matchedTerm.normalized.startsWith(query),
              }
            : null;
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.startsWithQuery) - Number(a.startsWithQuery))
        .slice(0, 8);

      if (matches.length === 0) {
        if (isHeaderSearch) {
          const emptyMessage = document.createElement('p');
          emptyMessage.className = 'header-product-search__empty';
          emptyMessage.setAttribute('role', 'status');
          emptyMessage.textContent = 'No matching products';
          results.append(emptyMessage);
          results.hidden = false;
          input.setAttribute('aria-expanded', 'true');
          return;
        }

        closeResults();
        return;
      }

      matches.forEach(({ product, matchedTerm }, index) => {
        const button = document.createElement('button');
        const imageWrap = document.createElement('span');
        const content = document.createElement('span');
        const title = document.createElement('span');
        const meta = document.createElement('span');
        const match = document.createElement('span');
        const price = document.createElement('span');

        button.type = 'button';
        button.className = 'header-product-search__option';
        button.setAttribute('role', 'option');
        button.dataset.url = product.url;
        imageWrap.className = 'header-product-search__option-image';

        if (product.image) {
          const image = document.createElement('img');
          image.src = product.image;
          image.alt = product.title || '';
          image.loading = 'lazy';
          image.decoding = 'async';
          imageWrap.append(image);
        }

        content.className = 'header-product-search__option-content';
        title.className = 'header-product-search__option-title';
        title.textContent = product.title;
        meta.className = 'header-product-search__option-meta';
        match.className = 'header-product-search__option-match';
        match.textContent = matchedTerm;
        price.className = 'header-product-search__option-price';
        price.textContent = product.price;
        meta.append(match, price);
        content.append(title, meta);
        button.append(imageWrap, content);

        if (index === 0) button.classList.add('is-active');

        button.addEventListener('mousedown', (event) => {
          event.preventDefault();
          navigateToProduct(product.url);
        });

        results.append(button);
      });

      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };

    input.addEventListener('input', renderResults);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeResults();
        input.blur();
        return;
      }

      if (event.key !== 'Enter') return;

      if (isHeaderSearch && window.matchMedia('(max-width: 749px)').matches) {
        event.preventDefault();
        input.blur();
        return;
      }

      const activeOption = results.querySelector('.header-product-search__option.is-active');
      if (!(activeOption instanceof HTMLElement)) return;

      event.preventDefault();
      navigateToProduct(activeOption.dataset.url);
    });
    input.addEventListener('blur', () => {
      if (isHeaderSearch && window.matchMedia('(max-width: 749px)').matches) return;
      window.setTimeout(closeResults, 120);
    });
  });
}

initProductSearchForms();
window.addEventListener('collection:facets-rendered', initProductSearchForms);
document.addEventListener('shopify:section:load', initProductSearchForms);
