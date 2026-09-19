// Pre-configured with your repository details
const CONFIG = {
  owner: 'prasadramalingam-max',
  repo: 'resource-portal',
  branch: 'main'
};

// Route file to correct subfolder
function determineFolder(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return 'uploads/archives';
  if (['pdf', 'odt', 'docx', 'doc', 'txt', 'csv'].includes(ext)) return 'uploads/docs';
  if (['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif'].includes(ext)) return 'uploads/images';
  return 'uploads/others';
}

// Convert binary file to Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Strips "data:*/*;base64," prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

// 1. Upload raw file to GitHub via Contents API
async function uploadFileToGitHub(file, token) {
  const folder = determineFolder(file.name);
  const cleanName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const targetPath = `${folder}/${cleanName}`;
  const base64Data = await fileToBase64(file);

  const endpoint = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${targetPath}`;
  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Upload asset: ${cleanName}`,
      content: base64Data,
      branch: CONFIG.branch
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'File upload failed');
  }

  const responseJson = await res.json();
  return responseJson.content.path;
}

// 2. Read records.json, append new entry, and commit
async function updateRecordsDatabase(newEntry, token) {
  const dbPath = 'data/records.json';
  const endpoint = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${dbPath}?ref=${CONFIG.branch}`;

  // Get current content and SHA
  const getRes = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    }
  });

  let records = [];
  let fileSha = null;

  if (getRes.ok) {
    const data = await getRes.json();
    fileSha = data.sha;
    // Decode UTF-8 Base64 properly
    const decodedText = decodeURIComponent(escape(atob(data.content)));
    records = JSON.parse(decodedText);
  }

  // Prepend latest item to top
  records.unshift(newEntry);

  // Encode back to UTF-8 Base64
  const updatedBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(records, null, 2))));
  const putRes = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Database entry: ${newEntry.title}`,
      content: updatedBase64,
      sha: fileSha,
      branch: CONFIG.branch
    })
  });

  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(err.message || 'Failed to update records.json');
  }
}

// 3. Form submit handler
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = document.getElementById('ghToken').value.trim();
  const title = document.getElementById('itemTitle').value.trim();
  const category = document.getElementById('itemCategory').value;
  const description = document.getElementById('itemDescription').value.trim();
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  const alertBox = document.getElementById('statusAlert');
  const submitBtn = document.getElementById('submitBtn');

  if (!file) return;

  // Enforce GitHub Contents API 25 MB payload limit
  if (file.size > 25 * 1024 * 1024) {
    alertBox.className = 'alert alert-danger';
    alertBox.textContent = 'Error: GitHub API limits direct file uploads to 25 MB.';
    alertBox.classList.remove('d-none');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving file to repository...';
  alertBox.classList.add('d-none');

  try {
    // Step A: Save file inside uploads/ folder
    const savedPath = await uploadFileToGitHub(file, token);

    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating records.json...';

    // Step B: Build record metadata
    const recordPayload = {
      id: `rec_${Date.now()}`,
      title: title,
      category: category,
      description: description,
      file_path: savedPath,
      file_type: file.type || 'application/octet-stream',
      size_mb: parseFloat((file.size / (1024 * 1024)).toFixed(2)),
      upload_date: new Date().toISOString().split('T')[0]
    };

    // Step C: Commit metadata to records.json
    await updateRecordsDatabase(recordPayload, token);

    alertBox.className = 'alert alert-success';
    alertBox.textContent = 'File uploaded and database updated successfully!';
    alertBox.classList.remove('d-none');

    // Reset inputs except token
    document.getElementById('itemTitle').value = '';
    document.getElementById('itemDescription').value = '';
    fileInput.value = '';

  } catch (err) {
    alertBox.className = 'alert alert-danger';
    alertBox.textContent = `Upload failed: ${err.message}`;
    alertBox.classList.remove('d-none');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload & Commit to GitHub';
  }
});
