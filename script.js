// 手势识别变量
let hands;
let videoElement;
let overlayCanvas;
let overlayCtx;
let drawingCanvas;
let drawingCtx;
let isDrawing = false;
let lastPosition = null;
let lineWidth = 4;
let lineColor = '#4d96ff';
let mirrorEnabled = true;

// 初始化手势识别
function initHandRecognition() {
    videoElement = document.getElementById('input_video');
    overlayCanvas = document.getElementById('canvas-overlay');
    overlayCtx = overlayCanvas.getContext('2d');
    drawingCanvas = document.getElementById('drawing-canvas');
    drawingCtx = drawingCanvas.getContext('2d');
    
    // 设置绘制上下文
    drawingCtx.lineCap = 'round';
    drawingCtx.lineJoin = 'round';
    drawingCtx.lineWidth = lineWidth;
    drawingCtx.strokeStyle = lineColor;
    
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    hands.onResults(onHandResults);
    
    // 请求摄像头权限
    document.getElementById('enable-camera').addEventListener('click', function() {
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
            },
            width: 1280,
            height: 720
        });
        camera.start();
        
        // 隐藏权限请求界面
        document.getElementById('camera-permission').style.display = 'none';
    });
    
    // 清除按钮事件
    document.getElementById('clear-btn').addEventListener('click', function() {
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    });
    
    // 线条粗细滑块
    const lineWidthSlider = document.getElementById('line-width-slider');
    const lineWidthValue = document.getElementById('line-width-value');
    lineWidthSlider.addEventListener('input', function() {
        lineWidth = parseInt(this.value);
        lineWidthValue.textContent = this.value;
        drawingCtx.lineWidth = lineWidth;
    });
    
    // 颜色选择器
    const colorPicker = document.getElementById('color-picker');
    colorPicker.addEventListener('input', function() {
        lineColor = this.value;
        drawingCtx.strokeStyle = lineColor;
    });
    
    // 镜像切换按钮
    const mirrorToggle = document.getElementById('mirror-toggle');
    mirrorToggle.addEventListener('click', function() {
        mirrorEnabled = !mirrorEnabled;
        this.innerHTML = mirrorEnabled ? 
            '<span class="btn-icon">🔄</span> 镜像: 开启' : 
            '<span class="btn-icon">🔄</span> 镜像: 关闭';
        videoElement.style.transform = mirrorEnabled ? 'scaleX(-1)' : 'scaleX(1)';
    });
    
    // 保存按钮事件
    document.getElementById('save-btn').addEventListener('click', function() {
        const dataURL = drawingCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'finger-drawing.png';
        link.href = dataURL;
        link.click();
    });
    
    // 窗口大小变化响应
    window.addEventListener('resize', function() {
        resizeCanvases();
    });
    
    // 初始化画布大小
    resizeCanvases();
}

// 调整画布大小
function resizeCanvases() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    drawingCanvas.width = width;
    drawingCanvas.height = height;
}

// 处理手势识别结果
function onHandResults(results) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // 检测手部状态
        const handState = detectHandState(landmarks);
        
        if (handState === 'drawing') {
            // 绘制状态
            // 获取食指指尖位置
            const indexFingerTip = landmarks[8];
            let x, y;
            
            if (mirrorEnabled) {
                // 镜像模式下需要翻转X坐标
                x = (1 - indexFingerTip.x) * overlayCanvas.width;
            } else {
                x = indexFingerTip.x * overlayCanvas.width;
            }
            y = indexFingerTip.y * overlayCanvas.height;
            
            if (!isDrawing) {
                // 开始绘制
                isDrawing = true;
                lastPosition = { x, y }; // 重置起始位置
                document.getElementById('status-text').textContent = '正在书写';
                document.querySelector('.status-indicator').className = 'status-indicator status-drawing';
            }
            
            // 绘制轨迹
            drawOnCanvas(x, y);
            
            // 绘制指尖指示器
            drawFingerIndicator(x, y);
            
        } else if (handState === 'open') {
            // 张开手掌，结束绘制
            if (isDrawing) {
                isDrawing = false;
                lastPosition = null; // 重置位置
                document.getElementById('status-text').textContent = '准备书写';
                document.querySelector('.status-indicator').className = 'status-indicator status-ready';
            }
            
            // 绘制张开手掌指示器
            drawOpenHandIndicator(landmarks);
        }
    } else {
        // 没有检测到手
        if (isDrawing) {
            isDrawing = false;
            lastPosition = null;
            document.getElementById('status-text').textContent = '准备书写';
            document.querySelector('.status-indicator').className = 'status-indicator status-ready';
        }
    }
}

// 检测手部状态
function detectHandState(landmarks) {
    // 获取关键点
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];
    
    // 计算各指尖与手腕的距离
    const thumbDistance = calculateDistance(thumbTip, wrist);
    const indexDistance = calculateDistance(indexTip, wrist);
    const middleDistance = calculateDistance(middleTip, wrist);
    const ringDistance = calculateDistance(ringTip, wrist);
    const pinkyDistance = calculateDistance(pinkyTip, wrist);
    
    // 判断手指是否伸出
    const isThumbExtended = thumbDistance > 0.15;
    const isIndexExtended = indexDistance > 0.2;
    const isMiddleExtended = middleDistance > 0.2;
    const isRingExtended = ringDistance > 0.2;
    const isPinkyExtended = pinkyDistance > 0.2;
    
    // 判断状态
    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return 'drawing'; // 只有食指伸出，绘制状态
    } else if (isThumbExtended && isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
        return 'open'; // 所有手指伸出，张开手掌
    }
    
    return 'other';
}

// 计算两点之间的距离
function calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// 在画布上绘制
function drawOnCanvas(x, y) {
    if (!isDrawing || !lastPosition) return;
    
    // 绘制线条
    drawingCtx.beginPath();
    drawingCtx.moveTo(lastPosition.x, lastPosition.y);
    drawingCtx.lineTo(x, y);
    drawingCtx.stroke();
    
    lastPosition = { x, y };
}

// 绘制指尖指示器
function drawFingerIndicator(x, y) {
    overlayCtx.fillStyle = lineColor;
    overlayCtx.beginPath();
    overlayCtx.arc(x, y, lineWidth * 1.5, 0, Math.PI * 2);
    overlayCtx.fill();
    
    overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    overlayCtx.lineWidth = 2;
    overlayCtx.beginPath();
    overlayCtx.arc(x, y, lineWidth * 1.5, 0, Math.PI * 2);
    overlayCtx.stroke();
}

// 绘制张开手掌指示器
function drawOpenHandIndicator(landmarks) {
    const wrist = landmarks[0];
    let centerX, centerY;
    
    if (mirrorEnabled) {
        centerX = (1 - wrist.x) * overlayCanvas.width;
    } else {
        centerX = wrist.x * overlayCanvas.width;
    }
    centerY = wrist.y * overlayCanvas.height;
    
    overlayCtx.fillStyle = 'rgba(76, 175, 80, 0.5)';
    overlayCtx.beginPath();
    overlayCtx.arc(centerX, centerY, 30, 0, Math.PI * 2);
    overlayCtx.fill();
    
    overlayCtx.fillStyle = 'white';
    overlayCtx.font = '14px Arial';
    overlayCtx.textAlign = 'center';
    overlayCtx.textBaseline = 'middle';
    overlayCtx.fillText('张开手掌', centerX, centerY);
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', function() {
    initHandRecognition();
});
