let allRecords = [];

// 1. Fetch data from records.json
async function fetchRecords() {
  const container = document.getElementById('itemsContainer');
  try {
    // ?t= timestamp breaks GitHub Pages aggressive browser caching
    const response = await fetch(`./data/records.json?t=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`records.json not found (HTTP ${response.status})`);
    }

    allRecords = await response.json();
    renderList(allRecords);
  } catch (error) {
    console.error('Fetch error:', error);
    container.innerHTML = `
      <div class="col-12 text-center text-secondary py-5">
        <p class="mb-1 text-danger fw-bold">Unable to load database</p>
        <small class="text-muted">${error.message}. Ensure data/records.json contains valid JSON (e.g. []).</small>
      </div>`;
  }
}

// 2. Render cards to the page
function renderList(records) {
  const container = document.getElementById('itemsContainer');

  if (!records || records.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center text-muted py-5">
        No resources uploaded yet. Click <strong>Admin Portal</strong> to add files.
      </div>`;
    return;
  }

  container.innerHTML = records.map(item => {
    const isZip = item.file_path && item.file_path.endsWith('.zip');
    const badgeColor = isZip ? 'bg-warning text-dark' : 'bg-primary';
    const actionText = isZip ? 'Download Archive (.zip)' : 'Download / View';

    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 shadow-sm border-0">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge ${badgeColor}">${escapeHtml(item.category)}</span>
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

// Utility: Prevent cross-site scripting (XSS)
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

// 3. Search and Category Filtering
function filterRecords() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const category = document.getElementById('categoryFilter').value;

  const filtered = allRecords.filter(item => {
    const titleMatch = (item.title || '').toLowerCase().includes(search);
    const descMatch = (item.description || '').toLowerCase().includes(search);
    const matchesSearch = titleMatch || descMatch;

    const matchesCategory = (category === 'ALL') || (item.category === category);
    return matchesSearch && matchesCategory;
  });

  renderList(filtered);
}

// 4. Initialize listeners on page load
document.addEventListener('DOMContentLoaded', () => {
  fetchRecords();
  document.getElementById('searchInput').addEventListener('input', filterRecords);
  document.getElementById('categoryFilter').addEventListener('change', filterRecords);
});
