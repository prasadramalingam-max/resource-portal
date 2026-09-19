const CONFIG = {
  owner: 'prasadramalingam-max', // Replace with your GitHub username
  repo: 'resource-portal',        // Replace with your repository name
  branch: 'main'
};

// Route file to correct subfolder
function determineFolder(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return 'uploads/archives';
  if (['pdf', 'odt', 'docx', 'txt', 'csv'].includes(ext)) return 'uploads/docs';
  if (['jpg', 'jpeg', 'png', 'svg', 'webp'].includes(ext)) return 'uploads/images';
  return 'uploads/others';
}

// Convert File object to Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

// Step 5A: Commit uploaded file to GitHub repository
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
    const errorData = await res.json();
    throw new Error(errorData.message || 'File upload failed');
  }

  const responseJson = await res.json();
  return responseJson.content.path;
}

// Step 5B: Update data/records.json
async function updateRecordsDatabase(newEntry, token) {
  const dbPath = 'data/records.json';
  const endpoint = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${dbPath}?ref=${CONFIG.branch}`;

  // 1. Get current content and SHA
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
    const decodedText = decodeURIComponent(escape(atob(data.content)));
    records = JSON.parse(decodedText);
  }

  // 2. Prepend new record
  records.unshift(newEntry);

  // 3. Re-encode and commit back
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
    const errorData = await putRes.json();
    throw new Error(errorData.message || 'Database update failed');
  }
}

// Step 5C: Handle Form Submission
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

  // GitHub Contents API max file limit
  if (file.size > 25 * 1024 * 1024) {
    alertBox.className = 'alert alert-danger';
    alertBox.textContent = 'Error: GitHub API limits single file uploads to 25 MB.';
    alertBox.classList.remove('d-none');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving file to GitHub...';
  alertBox.classList.add('d-none');

  try {
    // 1. Upload File
    const savedPath = await uploadFileToGitHub(file, token);

    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating database...';

    // 2. Commit Metadata to records.json
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

    await updateRecordsDatabase(recordPayload, token);

    alertBox.className = 'alert alert-success';
    alertBox.textContent = 'File uploaded and database updated successfully!';
    alertBox.classList.remove('d-none');

    // Reset input fields (keep token so admin doesn't need to re-type it)
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
