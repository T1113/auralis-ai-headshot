/**
 * uploader.js - Handing File Drag/Drop, Input selections, and UI states for files.
 * Adheres to WCAG error presentation and Impeccable states.
 */

const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const mobileCameraInput = document.getElementById('mobile-camera-input');
const photoList = document.getElementById('photo-list');
const btnNext = document.getElementById('btn-next');
const uploadCounter = document.getElementById('upload-counter');

// State
let uploadedFiles = []; // Arrays of file info objects { id, file, status, url, errorMsg, serverId }

// --- Event Listeners for Drag & Drop ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, preventDefaults, false)
});

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

['dragenter', 'dragover'].forEach(eventName => {
    uploadZone.addEventListener(eventName, () => uploadZone.classList.add('dragover'), false)
});

['dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, () => uploadZone.classList.remove('dragover'), false)
});

uploadZone.addEventListener('drop', (e) => {
    let dt = e.dataTransfer;
    let files = dt.files;
    handleFiles(files);
});

// --- Input Change Listners ---
fileInput.addEventListener('change', function() { handleFiles(this.files); });
mobileCameraInput.addEventListener('change', function() { handleFiles(this.files); });

// Global Exposure for camera.js to inject its blob
window.addFileToQueue = function(file) {
    handleFiles([file]);
};

// --- Processing Logic ---

/**
 * 处理用户拖拽、相册选择或相机捕获后传入的图片文件。
 * 对每个文件生成唯一的 ID，模拟异步上传以及质量检测流程。
 * @param {FileList|Array} files - 传入的图片文件数组或 FileList 对象
 */
function getCurrentUserId() {
    return localStorage.getItem('impeccable_user') || 'anonymous';
}

function syncUploadedPhotoIds() {
    const photoIds = uploadedFiles
        .filter(f => f.status === 'success' && f.serverId)
        .map(f => f.serverId);
    localStorage.setItem('impeccable_uploaded_photo_ids', JSON.stringify(photoIds));
}

async function uploadToServer(file, localId) {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('userId', getCurrentUserId());

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        const item = uploadedFiles.find(f => f.id === localId);
        if (!item) return;

        if (!response.ok || !data.success) {
            item.status = 'error';
            item.errorMsg = data.error || '上传失败，请稍后重试。';
        } else {
            item.status = data.photo.status || 'success';
            item.serverId = data.photo.id;
            item.url = data.photo.url;
            item.errorMsg = data.photo.message;
        }
    } catch (error) {
        const item = uploadedFiles.find(f => f.id === localId);
        if (item) {
            item.status = 'error';
            item.errorMsg = '无法连接上传服务，请确认后端服务正在运行。';
        }
    }

    syncUploadedPhotoIds();
    renderPhotoList();
}

function handleFiles(files) {
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    
    newFiles.forEach(file => {
        if (uploadedFiles.length >= 5) {
            return;
        }
        const id = 'f_' + Date.now() + Math.random().toString(36).substr(2, 9);
        const objURL = URL.createObjectURL(file);

        const fileInfo = { id, file, status: 'uploading', url: objURL, errorMsg: null, serverId: null };
        uploadedFiles.push(fileInfo);
        renderPhotoList();
        uploadToServer(file, id);
    });
}

/**
 * 根据文件 ID 移除已加载的照片，并触发重新渲染。
 * @param {string} id - 要删除的文件唯一标识符
 */
function removeFile(id) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== id);
    syncUploadedPhotoIds();
    renderPhotoList();
}

function renderPhotoList() {
    photoList.innerHTML = '';
    let validCount = 0;

    uploadedFiles.forEach(fileObj => {
        const itemDom = document.createElement('div');
        
        // Dynamically style based on status
        let borderColor = 'var(--color-border-subtle)';
        let statusBadge = '<span class="badge">质量检测中...</span>';
        let errorBlock = '';
        
        if (fileObj.status === 'success') {
            statusBadge = '<span class="badge badge-success">质量良好 - 可使用</span>';
            validCount++;
        } else if (fileObj.status === 'uploading') {
            statusBadge = '<span class="badge">正在上传到生成队列...</span>';
        } else if (fileObj.status === 'warning') {
            borderColor = 'var(--color-status-error)'; // Use subtle error for warning layout
            statusBadge = '<span class="badge" style="background-color:oklch(from var(--color-status-error) 0.9 c h); color:var(--color-status-error)">质量建议更换</span>';
            errorBlock = `<div class="error-text" style="grid-column: 1 / -1; margin-left: 80px;">⚠️ ${fileObj.errorMsg}</div>`;
            validCount++; // Allowed to proceed but warned
        } else if (fileObj.status === 'error') {
            borderColor = 'var(--color-status-error)';
            statusBadge = '<span class="badge" style="background-color: var(--color-status-error); color: white;">验证失败</span>';
            errorBlock = `<div class="error-text" style="grid-column: 1 / -1; margin-left: 80px;">❌ ${fileObj.errorMsg}</div>`;
        }

        itemDom.className = 'photo-item';
        itemDom.style.borderColor = borderColor;
        itemDom.style.flexWrap = 'wrap';

        itemDom.innerHTML = `
            <img class="photo-thumb" src="${fileObj.url}" alt="${fileObj.file.name}">
            <div class="flex-col" style="flex:1;">
                <div style="font-size: var(--text-small); font-weight: var(--weight-medium); color: var(--color-text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${fileObj.file.name}</div>
                <div style="margin-top: 4px;">${statusBadge}</div>
            </div>
            <div class="flex-row gap-sm">
                <button class="btn btn-ghost" style="padding:4px 8px; font-size:var(--text-small);" onclick="removeFile('${fileObj.id}')">删除</button>
            </div>
            ${errorBlock}
        `;
        photoList.appendChild(itemDom);
    });

    uploadCounter.innerText = `已添加 ${uploadedFiles.length} 张照片，${validCount} 张可用于生成`;
    
    // 限制必须有1-5张符合规范（非 error 状态）的照片才能点击“下一步”的判定逻辑
    if (validCount >= 1 && validCount <= 5) {
        btnNext.removeAttribute('disabled');
    } else {
        btnNext.setAttribute('disabled', 'true');
    }

    // Task 2 UI Optimization: Hide huge empty state upload zone if we have files
    const addMoreZone = document.getElementById('add-more-zone');
    if (uploadedFiles.length > 0) {
        if (uploadZone) uploadZone.style.display = 'none';
        if (addMoreZone) addMoreZone.style.display = 'block';
    } else {
        if (uploadZone) uploadZone.style.display = 'flex';
        if (addMoreZone) addMoreZone.style.display = 'none';
    }
}
