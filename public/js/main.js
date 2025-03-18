// Global variables
let diapers = [];
let filteredDiapers = [];
let activeBrands = new Set();
let activeSizes = new Set();
let activeRetailers = new Set();

// Pagination variables
let currentPage = 1;
let itemsPerPage = 12; // Default items per page

// DOM elements
const brandFiltersEl = document.getElementById('brand-filters');
const sizeFiltersEl = document.getElementById('size-filters');
const retailerFiltersEl = document.getElementById('retailer-filters');
const diaperResultsEl = document.getElementById('diaper-results');
const sortByEl = document.getElementById('sort-by');
const resetAllFiltersEl = document.getElementById('reset-all-filters');
const resultsCountEl = document.getElementById('results-count');
const paginationEl = document.getElementById('pagination');
const itemsPerPageEl = document.getElementById('items-per-page');

// Default sort option
let currentSortOption = 'price-per-diaper';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Check URL parameters first
  checkUrlParameters();
  
  // Fetch data and initialize the UI
  fetchData();
  
  // Set up event listeners
  sortByEl.addEventListener('change', (event) => {
    currentSortOption = event.target.value;
    sortDiapers();
  });
  
  // Set up reset filters button
  if (resetAllFiltersEl) {
    resetAllFiltersEl.addEventListener('click', resetAllFilters);
  }
  
  // Set up items per page dropdown
  if (itemsPerPageEl) {
    itemsPerPageEl.addEventListener('change', (event) => {
      itemsPerPage = parseInt(event.target.value);
      currentPage = 1; // Reset to first page when changing items per page
      renderDiaperResults();
      updateUrlParameters();
    });
  }
});

// Fetch diaper data from the API
async function fetchData() {
  try {
    const response = await fetch('/.netlify/functions/get-diapers');
    const data = await response.json();
    diapers = data.diapers || [];
    filteredDiapers = [...diapers];
    
    // Fetch filter options
    await Promise.all([
      fetchBrands(),
      fetchSizes(),
      fetchRetailers()
    ]);
    
    // Sort before initial render
    sortDiapers();
  } catch (error) {
    console.error('Error fetching data:', error);
    diaperResultsEl.innerHTML = `
      <div class="error-message">
        <p>Sorry, we couldn't load the diaper data. Please try again later.</p>
      </div>
    `;
  }
}

// Fetch all available brands and create filter buttons
async function fetchBrands() {
  try {
    const response = await fetch('/.netlify/functions/get-brands');
    const data = await response.json();
    const brands = data.brands || [];
    
    const brandHTML = brands.map(brand => `
      <div class="filter-item" data-brand="${brand}" onclick="toggleBrandFilter('${brand}')">
        ${brand}
      </div>
    `).join('');
    
    brandFiltersEl.innerHTML = brandHTML;
    
    // Apply URL parameters after filters are loaded
    if (window.urlFilterParams && window.urlFilterParams.brand) {
      applyUrlParameters();
    }
  } catch (error) {
    console.error('Error fetching brands:', error);
    brandFiltersEl.innerHTML = '<p>Error loading brands</p>';
  }
}

// Fetch all available sizes and create filter buttons
async function fetchSizes() {
  try {
    const response = await fetch('/.netlify/functions/get-sizes');
    const data = await response.json();
    const sizes = data.sizes || [];
    
    const sizeHTML = sizes.map(size => `
      <div class="filter-item" data-size="${size}" onclick="toggleSizeFilter('${size}')">
        ${size}
      </div>
    `).join('');
    
    sizeFiltersEl.innerHTML = sizeHTML;
  } catch (error) {
    console.error('Error fetching sizes:', error);
    sizeFiltersEl.innerHTML = '<p>Error loading sizes</p>';
  }
}

// Fetch all available retailers and create filter buttons
async function fetchRetailers() {
  try {
    const response = await fetch('/.netlify/functions/get-retailers');
    const data = await response.json();
    const retailers = data.retailers || [];
    
    const retailerHTML = retailers.map(retailer => `
      <div class="filter-item" data-retailer="${retailer}" onclick="toggleRetailerFilter('${retailer}')">
        ${retailer}
      </div>
    `).join('');
    
    retailerFiltersEl.innerHTML = retailerHTML;
  } catch (error) {
    console.error('Error fetching retailers:', error);
    retailerFiltersEl.innerHTML = '<p>Error loading retailers</p>';
  }
}

// Toggle brand filter selection
function toggleBrandFilter(brand, skipUpdate = false) {
  const filterElement = document.querySelector(`.filter-item[data-brand="${brand}"]`);
  if (!filterElement) return;
  
  if (activeBrands.has(brand)) {
    activeBrands.delete(brand);
    filterElement.classList.remove('active');
  } else {
    activeBrands.add(brand);
    filterElement.classList.add('active');
  }
  
  if (!skipUpdate) {
    applyFilters();
  }
}

// Toggle size filter selection
function toggleSizeFilter(size, skipUpdate = false) {
  const filterElement = document.querySelector(`.filter-item[data-size="${size}"]`);
  if (!filterElement) return;
  
  if (activeSizes.has(size)) {
    activeSizes.delete(size);
    filterElement.classList.remove('active');
  } else {
    activeSizes.add(size);
    filterElement.classList.add('active');
  }
  
  if (!skipUpdate) {
    applyFilters();
  }
}

// Toggle retailer filter selection
function toggleRetailerFilter(retailer, skipUpdate = false) {
  const filterElement = document.querySelector(`.filter-item[data-retailer="${retailer}"]`);
  if (!filterElement) return;
  
  if (activeRetailers.has(retailer)) {
    activeRetailers.delete(retailer);
    filterElement.classList.remove('active');
  } else {
    activeRetailers.add(retailer);
    filterElement.classList.add('active');
  }
  
  if (!skipUpdate) {
    applyFilters();
  }
}

// Apply selected filters
function applyFilters() {
  filteredDiapers = diapers.filter(diaper => {
    // If no brands are selected, show all brands
    const brandMatch = activeBrands.size === 0 || activeBrands.has(diaper.brand);
    
    // If no sizes are selected, show all sizes
    const sizeMatch = activeSizes.size === 0 || activeSizes.has(diaper.size);
    
    // If no retailers are selected, show all retailers
    const retailerMatch = activeRetailers.size === 0 || activeRetailers.has(diaper.retailer);
    
    return brandMatch && sizeMatch && retailerMatch;
  });
  
  // Reset to first page when filters change
  currentPage = 1;
  
  // Always sort the filtered diapers before rendering
  sortDiapers();
  updateUrlParameters();
  // renderDiaperResults() is called by sortDiapers()
}

// Sort diapers based on selected criteria
function sortDiapers() {
  // Get the current sort option, ensuring we have a valid value
  const sortBy = sortByEl ? sortByEl.value : currentSortOption;
  currentSortOption = sortBy; // Store the current sort option
  
  console.log('Sorting by:', sortBy); // Debug log
  
  filteredDiapers.sort((a, b) => {
    switch (sortBy) {
      case 'price-per-diaper':
        return a.pricePerDiaper - b.pricePerDiaper;
      case 'total-price':
        return a.price - b.price;
      case 'count':
        return b.count - a.count;
      case 'brand':
        return a.brand.localeCompare(b.brand);
      default:
        return a.pricePerDiaper - b.pricePerDiaper;
    }
  });
  
  // Ensure that if we're sorting by price, the lowest price items are first
  if (sortBy === 'price-per-diaper' || sortBy === 'total-price') {
    console.log('First item price per diaper:', filteredDiapers[0]?.pricePerDiaper);
  }
  
  renderDiaperResults();
}

// Reset all filters
function resetAllFilters() {
  // Clear active filters
  activeBrands.clear();
  activeSizes.clear();
  activeRetailers.clear();
  
  // Remove active class from all filter items
  document.querySelectorAll('.filter-item.active').forEach(item => {
    item.classList.remove('active');
  });
  
  // Reset sort to default
  sortByEl.value = 'price-per-diaper';
  
  // Apply filters
  applyFilters();
  
  // Update URL parameters
  updateUrlParameters();
}

// Check URL parameters and pre-select filters
function checkUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Get parameters
  const brandParam = urlParams.get('brand');
  const sizeParam = urlParams.get('size');
  const retailerParam = urlParams.get('retailer');
  const sortParam = urlParams.get('sort');
  const pageParam = urlParams.get('page');
  const limitParam = urlParams.get('limit');
  
  // Get pagination parameters
  if (pageParam) {
    currentPage = parseInt(pageParam) || 1;
  }
  
  if (limitParam && itemsPerPageEl) {
    itemsPerPage = parseInt(limitParam) || 12;
    itemsPerPageEl.value = itemsPerPage.toString();
  }
  
  // Store parameters to be applied after loading filters
  window.urlFilterParams = {
    brand: brandParam,
    size: sizeParam,
    retailer: retailerParam,
    sort: sortParam
  };
}

// Apply URL parameters after filters are loaded
function applyUrlParameters() {
  if (!window.urlFilterParams) return;
  
  const { brand, size, retailer, sort } = window.urlFilterParams;
  
  // Apply brand filter if specified
  if (brand) {
    toggleBrandFilter(brand, true);
  }
  
  // Apply size filter if specified
  if (size) {
    toggleSizeFilter(size, true);
  }
  
  // Apply retailer filter if specified
  if (retailer) {
    toggleRetailerFilter(retailer, true);
  }
  
  // Apply sort if specified
  if (sort && document.querySelector(`option[value="${sort}"]`)) {
    sortByEl.value = sort;
  }
  
  // Clear params after applying
  window.urlFilterParams = null;
}

// Update URL parameters based on active filters
function updateUrlParameters() {
  const urlParams = new URLSearchParams();
  
  // Add brand to URL if only one is selected
  if (activeBrands.size === 1) {
    urlParams.set('brand', Array.from(activeBrands)[0]);
  }
  
  // Add size to URL if only one is selected
  if (activeSizes.size === 1) {
    urlParams.set('size', Array.from(activeSizes)[0]);
  }
  
  // Add retailer to URL if only one is selected
  if (activeRetailers.size === 1) {
    urlParams.set('retailer', Array.from(activeRetailers)[0]);
  }
  
  // Add sort option to URL
  if (sortByEl.value !== 'price-per-diaper') {
    urlParams.set('sort', sortByEl.value);
  }
  
  // Add pagination parameters
  urlParams.set('page', currentPage.toString());
  urlParams.set('limit', itemsPerPage.toString());
  
  // Update the URL without refreshing the page
  const newUrl = urlParams.toString() ? `?${urlParams.toString()}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

// Calculate savings percentage compared to average price
function calculateSavings(diaper) {
  // Get diapers with same brand and size
  const similarDiapers = diapers.filter(d => 
    d.brand === diaper.brand && d.size === diaper.size && d.retailer !== diaper.retailer);
  
  if (similarDiapers.length === 0) return null; // No comparison possible
  
  const avgPrice = similarDiapers.reduce((sum, d) => sum + d.pricePerDiaper, 0) / similarDiapers.length;
  const savings = ((avgPrice - diaper.pricePerDiaper) / avgPrice) * 100;
  
  return savings > 5 ? Math.round(savings) : null; // Only show if savings is more than 5%
}

// Format price with proper decimal places
function formatPrice(price) {
  return price.toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Update results count
function updateResultsCount() {
  if (resultsCountEl) {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredDiapers.length);
    const totalItems = filteredDiapers.length;
    
    if (totalItems === 0) {
      resultsCountEl.innerHTML = `No results found`;
    } else {
      resultsCountEl.innerHTML = `Showing <strong>${startItem}-${endItem}</strong> of <strong>${totalItems}</strong> diaper product${totalItems !== 1 ? 's' : ''}`;
    }
  }
}

// Render the filtered and sorted diaper results
function renderDiaperResults() {
  // Update the results count
  updateResultsCount();
  
  if (filteredDiapers.length === 0) {
    diaperResultsEl.innerHTML = `
      <div class="no-results">
        <i data-feather="search" class="no-results-icon"></i>
        <h3>No diapers match your selected filters</h3>
        <p>Try adjusting your filter criteria or <button class="reset-link" id="reset-results">reset all filters</button></p>
      </div>
    `;
    
    // Hide pagination when no results
    if (paginationEl) {
      paginationEl.style.display = 'none';
    }
    
    // Initialize feather icons
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
    
    // Add event listener to the reset link
    const resetLink = document.getElementById('reset-results');
    if (resetLink) {
      resetLink.addEventListener('click', resetAllFilters);
    }
    
    return;
  }
  
  // Show pagination when we have results
  if (paginationEl) {
    paginationEl.style.display = 'flex';
  }
  
  // Calculate pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredDiapers.length);
  const currentPageItems = filteredDiapers.slice(startIndex, endIndex);
  
  // Render pagination controls
  renderPagination();
  
  const resultsHTML = currentPageItems.map(diaper => {
    // Calculate savings if possible
    const savings = calculateSavings(diaper);
    // Add tooltip explanation via data-tooltip attribute for custom CSS tooltip
    const savingsTooltip = 'This diaper is cheaper compared to the average price of the same brand and size at other retailers';
    const savingsTag = savings ? `<span class="savings-tag" data-tooltip="${savingsTooltip}" aria-label="${savings}% cheaper. ${savingsTooltip}" tabindex="0">${savings}% cheaper <i data-feather="info" class="savings-info-icon"></i></span>` : '';
    
    return `
    <div class="diaper-card">
      <div class="diaper-info">
        <h3>${diaper.brand} ${diaper.type || diaper.name || ''}</h3>
        <div class="diaper-meta">
          <span class="diaper-meta-item">Size ${diaper.size}</span>
          <span class="diaper-meta-item"><strong>${diaper.count}</strong> diapers</span>
        </div>
        <div class="retailer-info">
          <span class="retailer">
            <i data-feather="shopping-bag" class="retailer-icon"></i> 
            ${diaper.retailer}
          </span>
        </div>
      </div>
      <div class="diaper-pricing">
        ${savingsTag}
        <div class="price-container">
          <p class="price">$${formatPrice(diaper.price)}</p>
          <p class="price-per-diaper">$${formatPrice(diaper.pricePerDiaper)} <span>per diaper</span></p>
        </div>
        <a href="${diaper.url}" target="_blank" rel="noopener noreferrer" class="buy-button">View Deal</a>
      </div>
    </div>
    `;
  }).join('');
  
  diaperResultsEl.innerHTML = resultsHTML;
  
  // Initialize feather icons
  if (typeof feather !== 'undefined') {
    feather.replace();
  }
}

// Render pagination controls
function renderPagination() {
  if (!paginationEl) return;
  
  const totalPages = Math.ceil(filteredDiapers.length / itemsPerPage);
  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }
  
  // Calculate page range to display (show max 5 pages at a time)
  const maxPagesToShow = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
  
  // Adjust start page if we're at the end of the range
  if (endPage === totalPages) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }
  
  let paginationHTML = '';
  
  // Previous button
  paginationHTML += `
    <button class="pagination-control" 
      ${currentPage === 1 ? 'disabled' : 'onclick="changePage(${currentPage - 1})"'}>
      <i data-feather="chevron-left"></i>
    </button>
  `;
  
  // First page + ellipsis
  if (startPage > 1) {
    paginationHTML += `
      <button class="pagination-number" onclick="changePage(1)">1</button>
      ${startPage > 2 ? '<span class="pagination-ellipsis">...</span>' : ''}
    `;
  }
  
  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `
      <button class="pagination-number ${i === currentPage ? 'active' : ''}" 
        onclick="changePage(${i})">${i}</button>
    `;
  }
  
  // Last page + ellipsis
  if (endPage < totalPages) {
    paginationHTML += `
      ${endPage < totalPages - 1 ? '<span class="pagination-ellipsis">...</span>' : ''}
      <button class="pagination-number" onclick="changePage(${totalPages})">${totalPages}</button>
    `;
  }
  
  // Next button
  paginationHTML += `
    <button class="pagination-control" 
      ${currentPage === totalPages ? 'disabled' : 'onclick="changePage(${currentPage + 1})"'}>
      <i data-feather="chevron-right"></i>
    </button>
  `;
  
  paginationEl.innerHTML = paginationHTML;
  
  // Initialize feather icons for pagination
  if (typeof feather !== 'undefined') {
    feather.replace();
  }
}

// Change page
function changePage(page) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  currentPage = page;
  renderDiaperResults();
  updateUrlParameters();
}

// Make functions globally available
window.toggleBrandFilter = toggleBrandFilter;
window.toggleSizeFilter = toggleSizeFilter;
window.toggleRetailerFilter = toggleRetailerFilter;
window.changePage = changePage;
