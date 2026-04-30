/**
 * uploader.js - Handles drag/drop, camera intake, and real uploads to the backend.
 */

const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("file-input");
const mobileCameraInput = document.getElementById("mobile-camera-input");
const photoList = document.getElementById("photo-list");
const btnNext = document.getElementById("btn-next");
const uploadCounter = document.getElementById("upload-counter");

let uploadedFiles = window.ImpeccableApp.getUploadQueue();

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  uploadZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(event) {
  event.preventDefault();
  event.stopPropagation();
}

["dragenter", "dragover"].forEach((eventName) => {
  uploadZone.addEventListener(
    eventName,
    function () {
      uploadZone.classList.add("dragover");
    },
    false
  );
});

["dragleave", "drop"].forEach((eventName) => {
  uploadZone.addEventListener(
    eventName,
    function () {
      uploadZone.classList.remove("dragover");
    },
    false
  );
});

uploadZone.addEventListener("drop", function (event) {
  handleFiles(event.dataTransfer.files);
});

fileInput.addEventListener("change", function () {
  handleFiles(this.files);
  this.value = "";
});

mobileCameraInput.addEventListener("change", function () {
  handleFiles(this.files);
  this.value = "";
});

window.addFileToQueue = function (file) {
  handleFiles([file]);
};

window.removeFile = function (id) {
  uploadedFiles = uploadedFiles.filter(function (item) {
    return item.id !== id;
  });
  persistQueue();
  renderPhotoList();
};

window.continueToStyle = function () {
  const validFiles = uploadedFiles.filter(function (item) {
    return item.status === "success";
  });

  if (validFiles.length < 1 || validFiles.length > 5) {
    alert("请先上传 1 到 5 张可用照片。");
    return;
  }

  persistQueue();
  window.location.href = "style.html";
};

renderPhotoList();

async function handleFiles(files) {
  const incomingFiles = Array.from(files || []).filter(function (file) {
    return file.type && file.type.startsWith("image/");
  });

  if (incomingFiles.length === 0) {
    return;
  }

  const remainingSlots = 5 - uploadedFiles.length;
  if (remainingSlots <= 0) {
    alert("最多只能上传 5 张照片。");
    return;
  }

  const acceptedFiles = incomingFiles.slice(0, remainingSlots);
  const pendingItems = acceptedFiles.map(function (file) {
    return {
      id: "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      name: file.name,
      status: "uploading",
      url: URL.createObjectURL(file),
      file: file,
      errorMsg: ""
    };
  });

  uploadedFiles = uploadedFiles.concat(pendingItems);
  renderPhotoList();

  const formData = new FormData();
  acceptedFiles.forEach(function (file) {
    formData.append("files", file);
  });

  try {
    const response = await window.ImpeccableApp.apiFetch("/api/uploads", {
      method: "POST",
      body: formData
    });

    pendingItems.forEach(function (item, index) {
      const remoteFile = response.uploads[index];
      if (!remoteFile) {
        item.status = "error";
        item.errorMsg = "上传没有完成，请重新尝试。";
        return;
      }

      item.id = remoteFile.id;
      item.name = remoteFile.name;
      item.status = "success";
      item.url = remoteFile.previewUrl;
      item.errorMsg = "";
      delete item.file;
    });

    persistQueue();
    renderPhotoList();
  } catch (error) {
    pendingItems.forEach(function (item) {
      item.status = "error";
      item.errorMsg = error.message || "上传失败，请稍后重试。";
    });
    renderPhotoList();
  }
}

function persistQueue() {
  const persistedItems = uploadedFiles
    .filter(function (item) {
      return item.status === "success";
    })
    .map(function (item) {
      return {
        id: item.id,
        name: item.name,
        status: item.status,
        url: item.url
      };
    });

  window.ImpeccableApp.setUploadQueue(persistedItems);
}

function renderPhotoList() {
  photoList.innerHTML = "";
  let validCount = 0;

  uploadedFiles.forEach(function (fileObj) {
    const itemDom = document.createElement("div");
    let borderColor = "var(--color-border-subtle)";
    let statusBadge = '<span class="badge">上传中...</span>';
    let errorBlock = "";

    if (fileObj.status === "success") {
      statusBadge = '<span class="badge badge-success">已上传 - 可使用</span>';
      validCount += 1;
    } else if (fileObj.status === "error") {
      borderColor = "var(--color-status-error)";
      statusBadge =
        '<span class="badge" style="background-color: var(--color-status-error); color: white;">上传失败</span>';
      errorBlock =
        '<div class="error-text" style="grid-column: 1 / -1; margin-left: 80px;">❌ ' +
        escapeHtml(fileObj.errorMsg) +
        "</div>";
    }

    itemDom.className = "photo-item";
    itemDom.style.borderColor = borderColor;
    itemDom.style.flexWrap = "wrap";
    itemDom.innerHTML = `
      <img class="photo-thumb" src="${escapeAttribute(fileObj.url)}">
      <div class="flex-col" style="flex:1;">
        <div style="font-size: var(--text-small); font-weight: var(--weight-medium); color: var(--color-text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(fileObj.name || "未命名图片")}</div>
        <div style="margin-top: 4px;">${statusBadge}</div>
      </div>
      <div class="flex-row gap-sm">
        <button class="btn btn-ghost" style="padding:4px 8px; font-size:var(--text-small);" onclick="removeFile('${escapeAttribute(fileObj.id)}')">删除</button>
      </div>
      ${errorBlock}
    `;

    photoList.appendChild(itemDom);
  });

  uploadCounter.innerText = "已添加 " + uploadedFiles.length + " 张照片";

  if (validCount >= 1 && validCount <= 5) {
    btnNext.removeAttribute("disabled");
  } else {
    btnNext.setAttribute("disabled", "true");
  }

  const addMoreZone = document.getElementById("add-more-zone");
  if (uploadedFiles.length > 0) {
    uploadZone.style.display = "none";
    if (addMoreZone) {
      addMoreZone.style.display = "block";
    }
  } else {
    uploadZone.style.display = "flex";
    if (addMoreZone) {
      addMoreZone.style.display = "none";
    }
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
