let allRecords = [];

// Fetch data from GitHub Pages / records.json
async function fetchRecords() {
  const container = document.getElementById('itemsContainer');
  try {
    // Timestamp parameter prevents stale browser cache
    const response = await fetch(`./data/records.json?t=${Date.now()}`);
    if (!response.ok) throw new Error('Could not load database file.');
    
    allRecords = await response.json();
    renderList(allRecords);
  } catch (error) {
    container.innerHTML = `
      <div class="col-12 text-center text-danger py-4">
        Failed to load resources: ${error.message}
      </div>`;
  }
}

// Render cards dynamically
function renderList(records) {
  const container = document.getElementById('itemsContainer');
  
  if (!records || records.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center text-muted py-5">
        No records found.
      </div>`;
    return;
  }

  container.innerHTML = records.map(item => {
    const isZip = item.file_path.endsWith('.zip');
    const badgeColor = isZip ? 'bg-warning text-dark' : 'bg-primary';
    const actionText = isZip ? 'Download Archive' : 'Open / Download';

    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 shadow-sm border-0">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge ${badgeColor}">${item.category}</span>
              <small class="text-muted">${item.size_mb || 0} MB</small>
            </div>
            <h5 class="card-title">${escapeHtml(item.title)}</h5>
            <p class="card-text text-secondary small flex-grow-1">
              ${escapeHtml(item.description || 'No description provided.')}
            </p>
            <div class="d-flex justify-content-between align-items-center pt-3 border-top">
              <small class="text-muted">${item.upload_date}</small>
              <a href="./${item.file_path}" class="btn btn-sm btn-outline-primary" download>
                ${actionText}
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Utility: Prevent basic XSS in titles/descriptions
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

// Search & Filter listeners
function filterRecords() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const category = document.getElementById('categoryFilter').value;

  const filtered = allRecords.filter(item => {
    const matchSearch = item.title.toLowerCase().includes(search) || 
                        (item.description && item.description.toLowerCase().includes(search));
    const matchCategory = (category === 'ALL') || (item.category === category);
    return matchSearch && matchCategory;
  });

  renderList(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
  fetchRecords();
  document.getElementById('searchInput').addEventListener('input', filterRecords);
  document.getElementById('categoryFilter').addEventListener('change', filterRecords);
});
