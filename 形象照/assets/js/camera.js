/**
 * camera.js - Handles WebRTC Camera invocation, Permissions, and fallback states.
 * Adheres to 开发要求3.txt requirements for Real-time camera component.
 */

const btnOpenCamera = document.getElementById('btn-open-camera');
const cameraModal = document.getElementById('camera-modal');
const btnCloseCamera = document.getElementById('btn-close-camera');
const btnCancelCameraErr = document.getElementById('btn-cancel-camera-err');

const videoElement = document.getElementById('video-element');
const canvasElement = document.getElementById('canvas-element');
const btnSnap = document.getElementById('btn-snap');

// Preview State elements
const controlsCapture = document.getElementById('controls-capture');
const controlsPreview = document.getElementById('controls-preview');
const cameraPreviewOverlay = document.getElementById('camera-preview-overlay');
const cameraPreviewImg = document.getElementById('camera-preview-img');
const btnRetake = document.getElementById('btn-retake');
const btnConfirmPhoto = document.getElementById('btn-confirm-photo');

// Overlays
const permissionState = document.getElementById('camera-permission-state');
const deniedState = document.getElementById('camera-denied-state');

let currentStream = null;
let snappedBlob = null;

// Capability Check
const isWebRTCSupported = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

btnOpenCamera.addEventListener('click', async () => {
    if (!isWebRTCSupported) {
        // Requirement 6: fallback to system file picker/camera input
        document.getElementById('mobile-camera-input').click();
        return;
    }

    // Show modal & pre-auth state
    cameraModal.classList.add('active');
    permissionState.style.display = 'block';
    deniedState.style.display = 'none';
    
    // reset preview
    showPreviewMode(false);

    try {
        currentStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user", // front camera preferred
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        // Success - hide permission hint, show video
        permissionState.style.display = 'none';
        videoElement.srcObject = currentStream;

    } catch (err) {
        // Requirement 7: handle denied or error
        console.error("Camera access failed", err);
        permissionState.style.display = 'none';
        deniedState.style.display = 'block';
    }
});

/**
 * 中断并关闭摄像头数据流，隐藏 WebRTC 界面
 * 用于取消操作、关闭弹窗、或者完成拍照后释放硬件资源
 */
function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    videoElement.srcObject = null;
    cameraModal.classList.remove('active');
}

// Close and Cancel buttons
btnCloseCamera.addEventListener('click', stopCamera);
btnCancelCameraErr.addEventListener('click', stopCamera);

// Snap Photo
btnSnap.addEventListener('click', () => {
    if (!currentStream) return;
    
    // Draw to canvas
    const context = canvasElement.getContext('2d');
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    // Mirror the draw since video is visually mirrored
    context.translate(canvasElement.width, 0);
    context.scale(-1, 1);
    context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    // Convert to Image blob
    canvasElement.toBlob((blob) => {
        snappedBlob = blob;
        const url = URL.createObjectURL(blob);
        cameraPreviewImg.src = url;
        showPreviewMode(true);
    }, 'image/jpeg', 0.9);
});

// Retake
btnRetake.addEventListener('click', () => {
    snappedBlob = null;
    showPreviewMode(false);
});

// Confirm 
btnConfirmPhoto.addEventListener('click', () => {
    if (snappedBlob && window.addFileToQueue) {
        // Create a File object fake name
        const file = new File([snappedBlob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });
        window.addFileToQueue(file);
    }
    stopCamera();
});

/**
 * 切换实时视频流与拍照后预览冻结界面的显示状态
 * @param {boolean} isPreview - true 为展示刚拍的照片大图，false 为回到摄像头预览模式
 */
function showPreviewMode(isPreview) {
    if (isPreview) {
        cameraPreviewOverlay.style.display = 'flex';
        controlsCapture.style.display = 'none';
        controlsPreview.style.display = 'flex';
    } else {
        cameraPreviewOverlay.style.display = 'none';
        controlsCapture.style.display = 'flex';
        controlsPreview.style.display = 'none';
    }
}
