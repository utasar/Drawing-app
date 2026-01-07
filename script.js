// ===========================
// Layer Management
// ===========================
let layers = [{ canvas: document.createElement('canvas'), visible: true, name: 'Layer 1' }];
let currentLayerIndex = 0;

// ===========================
// Canvas and Context Setup
// ===========================
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

// Set canvas size
function resizeCanvas() {
    const canvasArea = document.querySelector('.canvas-area');
    const maxWidth = canvasArea.clientWidth - 100;
    const maxHeight = canvasArea.clientHeight - 100;
    const size = Math.min(maxWidth, maxHeight, 800);
    
    // Save current canvas state before resizing
    const imageData = canvas.toDataURL();
    
    canvas.width = size;
    canvas.height = size;
    
    // Update layer canvases to match new size
    layers.forEach(layer => {
        layer.canvas.width = size;
        layer.canvas.height = size;
    });
    
    // Restore the image if we had one
    if (imageData && imageData !== 'data:,') {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
        };
        img.src = imageData;
    }
}
resizeCanvas();
// Don't auto-resize on window resize to prevent data loss
// window.addEventListener('resize', resizeCanvas);

// ===========================
// Drawing State
// ===========================
let size = 10;
let color = "#000000";
let currentTool = "brush";
let isPressed = false;
let x = undefined;
let y = undefined;

function initializeLayers() {
    layers.forEach(layer => {
        layer.canvas.width = canvas.width;
        layer.canvas.height = canvas.height;
    });
}
initializeLayers();

function renderLayers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    layers.forEach(layer => {
        if (layer.visible) {
            ctx.drawImage(layer.canvas, 0, 0);
        }
    });
}

function getCurrentLayerContext() {
    return layers[currentLayerIndex].canvas.getContext('2d');
}

// ===========================
// Undo/Redo System
// ===========================
let history = [];
let historyStep = -1;
const maxHistory = 50;

function saveState() {
    historyStep++;
    if (historyStep < history.length) {
        history.length = historyStep;
    }
    const imageData = canvas.toDataURL();
    history.push(imageData);
    if (history.length > maxHistory) {
        history.shift();
        historyStep--;
    }
    updateAchievements();
}

function undo() {
    if (historyStep > 0) {
        historyStep--;
        restoreState(history[historyStep]);
    }
}

function redo() {
    if (historyStep < history.length - 1) {
        historyStep++;
        restoreState(history[historyStep]);
    }
}

function restoreState(dataURL) {
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = dataURL;
}

// Initialize history
saveState();

// ===========================
// Drawing Functions
// ===========================
function drawBrush(x, y, layerCtx) {
    layerCtx.beginPath();
    layerCtx.arc(x, y, size / 2, 0, Math.PI * 2);
    layerCtx.fillStyle = color;
    layerCtx.fill();
}

function drawPencil(x1, y1, x2, y2, layerCtx) {
    layerCtx.beginPath();
    layerCtx.moveTo(x1, y1);
    layerCtx.lineTo(x2, y2);
    layerCtx.strokeStyle = color;
    layerCtx.lineWidth = Math.max(1, size / 3);
    layerCtx.lineCap = 'round';
    layerCtx.stroke();
}

function drawMarker(x1, y1, x2, y2, layerCtx) {
    layerCtx.beginPath();
    layerCtx.moveTo(x1, y1);
    layerCtx.lineTo(x2, y2);
    layerCtx.strokeStyle = color;
    layerCtx.lineWidth = size;
    layerCtx.lineCap = 'round';
    layerCtx.globalAlpha = 0.5;
    layerCtx.stroke();
    layerCtx.globalAlpha = 1.0;
}

function drawSpray(x, y, layerCtx) {
    const density = size * 2;
    for (let i = 0; i < density; i++) {
        const offsetX = (Math.random() - 0.5) * size * 2;
        const offsetY = (Math.random() - 0.5) * size * 2;
        layerCtx.fillStyle = color;
        layerCtx.fillRect(x + offsetX, y + offsetY, 1, 1);
    }
}

function drawEraser(x, y, layerCtx) {
    layerCtx.globalCompositeOperation = 'destination-out';
    layerCtx.beginPath();
    layerCtx.arc(x, y, size, 0, Math.PI * 2);
    layerCtx.fill();
    layerCtx.globalCompositeOperation = 'source-over';
}

function draw(x2, y2) {
    const layerCtx = getCurrentLayerContext();
    
    switch(currentTool) {
        case 'brush':
            drawBrush(x2, y2, layerCtx);
            if (x !== undefined && y !== undefined) {
                const dx = x2 - x;
                const dy = y2 - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const steps = Math.max(1, Math.floor(dist / 2));
                for (let i = 0; i <= steps; i++) {
                    const px = x + (dx * i / steps);
                    const py = y + (dy * i / steps);
                    drawBrush(px, py, layerCtx);
                }
            }
            break;
        case 'pencil':
            if (x !== undefined && y !== undefined) {
                drawPencil(x, y, x2, y2, layerCtx);
            }
            break;
        case 'marker':
            if (x !== undefined && y !== undefined) {
                drawMarker(x, y, x2, y2, layerCtx);
            }
            break;
        case 'spray':
            drawSpray(x2, y2, layerCtx);
            break;
        case 'eraser':
            drawEraser(x2, y2, layerCtx);
            if (x !== undefined && y !== undefined) {
                const dx = x2 - x;
                const dy = y2 - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const steps = Math.max(1, Math.floor(dist / 2));
                for (let i = 0; i <= steps; i++) {
                    const px = x + (dx * i / steps);
                    const py = y + (dy * i / steps);
                    drawEraser(px, py, layerCtx);
                }
            }
            break;
    }
    
    renderLayers();
}

// ===========================
// Mouse/Touch Events
// ===========================
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

canvas.addEventListener("mousedown", (e) => {
    isPressed = true;
    const pos = getPointerPos(e);
    x = pos.x;
    y = pos.y;
    draw(x, y);
});

canvas.addEventListener("mouseup", () => {
    if (isPressed) {
        isPressed = false;
        x = undefined;
        y = undefined;
        saveState();
    }
});

canvas.addEventListener("mousemove", (e) => {
    if (isPressed) {
        const pos = getPointerPos(e);
        draw(pos.x, pos.y);
        x = pos.x;
        y = pos.y;
    }
});

// Touch support
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    isPressed = true;
    const pos = getPointerPos(e);
    x = pos.x;
    y = pos.y;
    draw(x, y);
});

canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (isPressed) {
        isPressed = false;
        x = undefined;
        y = undefined;
        saveState();
    }
});

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (isPressed) {
        const pos = getPointerPos(e);
        draw(pos.x, pos.y);
        x = pos.x;
        y = pos.y;
    }
});

// ===========================
// Tool Selection
// ===========================
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
    });
});

// ===========================
// Size Controls
// ===========================
const increaseBtn = document.getElementById("increase");
const decreaseBtn = document.getElementById("decrease");
const sizeEl = document.getElementById("size");
const sizeSlider = document.getElementById("sizeSlider");

function updateSizeOnScreen() {
    sizeEl.innerText = size;
    sizeSlider.value = size;
}

increaseBtn.addEventListener("click", () => {
    size = Math.min(50, size + 2);
    updateSizeOnScreen();
});

decreaseBtn.addEventListener("click", () => {
    size = Math.max(1, size - 2);
    updateSizeOnScreen();
});

sizeSlider.addEventListener("input", (e) => {
    size = parseInt(e.target.value);
    updateSizeOnScreen();
});

// ===========================
// Color Controls
// ===========================
const colorEl = document.getElementById("color");

colorEl.addEventListener("change", (e) => {
    color = e.target.value;
});

document.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
        color = btn.dataset.color;
        colorEl.value = color;
    });
});

// ===========================
// Actions
// ===========================
document.getElementById("undo").addEventListener("click", undo);
document.getElementById("redo").addEventListener("click", redo);

document.getElementById("clear").addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the canvas?")) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        layers.forEach(layer => {
            const layerCtx = layer.canvas.getContext('2d');
            layerCtx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        });
        renderLayers();
        saveState();
    }
});

// ===========================
// Import/Export
// ===========================
document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const layerCtx = getCurrentLayerContext();
                layerCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
                renderLayers();
                saveState();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById("exportPNG").addEventListener("click", () => {
    const link = document.createElement('a');
    link.download = `drawing-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

document.getElementById("exportJPG").addEventListener("click", () => {
    const link = document.createElement('a');
    link.download = `drawing-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
});

// ===========================
// Local Storage Gallery
// ===========================
let drawingIdCounter = Date.now();

document.getElementById("saveLocal").addEventListener("click", () => {
    const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');
    const dataURL = canvas.toDataURL();
    drawings.push({
        id: drawingIdCounter++,
        data: dataURL,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('drawings', JSON.stringify(drawings));
    alert('Drawing saved to gallery!');
    loadGallery();
    updateAchievements();
});

function loadGallery() {
    const galleryContent = document.getElementById('galleryContent');
    const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');
    
    if (drawings.length === 0) {
        galleryContent.innerHTML = '<p>No saved drawings yet. Create and save your first masterpiece!</p>';
        return;
    }
    
    galleryContent.innerHTML = '';
    drawings.forEach((drawing, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
            <img src="${drawing.data}" alt="Drawing ${index + 1}">
            <button class="gallery-item-delete material-icons" data-drawing-id="${drawing.id}">delete</button>
        `;
        
        item.querySelector('img').addEventListener('click', () => {
            const img = new Image();
            img.onload = () => {
                // Clear all layers
                layers.forEach(layer => {
                    const layerCtx = layer.canvas.getContext('2d');
                    layerCtx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                });
                
                // Load image to current layer
                const layerCtx = getCurrentLayerContext();
                layerCtx.drawImage(img, 0, 0);
                renderLayers();
                saveState();
            };
            img.src = drawing.data;
        });
        
        item.querySelector('.gallery-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this drawing?')) {
                const drawingId = parseInt(e.target.dataset.drawingId);
                const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');
                const filteredDrawings = drawings.filter(d => d.id !== drawingId);
                localStorage.setItem('drawings', JSON.stringify(filteredDrawings));
                loadGallery();
            }
        });
        
        galleryContent.appendChild(item);
    });
}

// ===========================
// Layer Management UI
// ===========================
document.getElementById("addLayer").addEventListener("click", () => {
    const newLayer = {
        canvas: document.createElement('canvas'),
        visible: true,
        name: `Layer ${layers.length + 1}`
    };
    newLayer.canvas.width = canvas.width;
    newLayer.canvas.height = canvas.height;
    layers.push(newLayer);
    updateLayersList();
});

function updateLayersList() {
    const layersList = document.getElementById('layersList');
    layersList.innerHTML = '';
    
    layers.forEach((layer, index) => {
        const item = document.createElement('div');
        item.className = 'layer-item' + (index === currentLayerIndex ? ' active' : '');
        item.dataset.layer = index;
        item.innerHTML = `
            <span>${layer.name}</span>
            <div class="layer-controls">
                <button class="layer-visible" title="Toggle visibility">
                    <span class="material-icons">${layer.visible ? 'visibility' : 'visibility_off'}</span>
                </button>
            </div>
        `;
        
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.layer-visible')) {
                currentLayerIndex = index;
                updateLayersList();
            }
        });
        
        item.querySelector('.layer-visible').addEventListener('click', (e) => {
            e.stopPropagation();
            layer.visible = !layer.visible;
            renderLayers();
            updateLayersList();
        });
        
        layersList.appendChild(item);
    });
}

updateLayersList();

// ===========================
// AI-Powered Inspiration
// ===========================
const inspirationTopics = [
    {
        category: "Marvel Universe",
        title: "Spider-Man in Action",
        description: "Draw Spider-Man swinging through New York City with detailed web-slinging action."
    },
    {
        category: "Nature",
        title: "Enchanted Forest",
        description: "Create a mystical forest scene with glowing mushrooms and magical creatures."
    },
    {
        category: "Motivational",
        title: "Rising Phoenix",
        description: "Draw a phoenix rising from ashes, symbolizing rebirth and resilience."
    },
    {
        category: "Pop Culture",
        title: "Retro Gaming",
        description: "Pixel art inspired by classic 80s and 90s video games."
    },
    {
        category: "Environmental",
        title: "Ocean Conservation",
        description: "Create artwork showing marine life and the importance of ocean preservation."
    },
    {
        category: "Fantasy",
        title: "Dragon Guardian",
        description: "Design a majestic dragon protecting an ancient castle."
    },
    {
        category: "Cultural",
        title: "Festival Celebration",
        description: "Illustrate a vibrant cultural festival with traditional costumes and decorations."
    },
    {
        category: "Sci-Fi",
        title: "Space Explorer",
        description: "Draw an astronaut discovering a new alien planet with unique landscapes."
    },
    {
        category: "Abstract",
        title: "Emotional Colors",
        description: "Express emotions through abstract shapes and bold color combinations."
    },
    {
        category: "Historical",
        title: "Ancient Civilization",
        description: "Recreate scenes from ancient Egypt, Rome, or Greece with historical accuracy."
    }
];

document.getElementById("inspirationBtn").addEventListener("click", () => {
    const content = document.getElementById('inspirationContent');
    const randomTopics = [];
    const shuffled = [...inspirationTopics].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < 3; i++) {
        randomTopics.push(shuffled[i]);
    }
    
    content.innerHTML = randomTopics.map(topic => `
        <div class="suggestion-item">
            <div class="suggestion-category">${topic.category}</div>
            <div class="suggestion-title">${topic.title}</div>
            <div class="suggestion-description">${topic.description}</div>
        </div>
    `).join('');
    
    updateAchievements();
});

// ===========================
// Tutorials
// ===========================
const tutorials = [
    {
        level: "Beginner",
        title: "Getting Started with Basic Shapes",
        description: "Learn to draw circles, squares, and triangles using the brush tool.",
        steps: "1. Select the brush tool\n2. Choose a color\n3. Adjust brush size\n4. Practice drawing basic shapes"
    },
    {
        level: "Beginner",
        title: "Understanding Colors",
        description: "Master the color palette and create beautiful color combinations.",
        steps: "1. Experiment with the color picker\n2. Try the preset colors\n3. Learn about complementary colors\n4. Create a color wheel"
    },
    {
        level: "Intermediate",
        title: "Layer Techniques",
        description: "Use layers to create complex compositions without losing your work.",
        steps: "1. Add a new layer\n2. Draw on different layers\n3. Toggle layer visibility\n4. Combine layers for final artwork"
    },
    {
        level: "Intermediate",
        title: "Blending and Shading",
        description: "Create depth using the marker tool for smooth transitions.",
        steps: "1. Use the marker tool\n2. Vary pressure and size\n3. Layer colors for blending\n4. Add highlights and shadows"
    },
    {
        level: "Advanced",
        title: "Digital Painting Techniques",
        description: "Combine multiple tools to create realistic paintings.",
        steps: "1. Sketch with pencil\n2. Add base colors with brush\n3. Blend with marker\n4. Add details and texture"
    },
    {
        level: "Advanced",
        title: "Character Design",
        description: "Learn to design and draw unique characters from imagination.",
        steps: "1. Start with basic shapes\n2. Add facial features\n3. Design clothing and accessories\n4. Refine and add personality"
    }
];

document.getElementById("tutorialsBtn").addEventListener("click", () => {
    const modal = document.getElementById('tutorialsModal');
    const content = document.getElementById('tutorialsContent');
    
    content.innerHTML = tutorials.map(tutorial => `
        <div class="tutorial-item">
            <div class="tutorial-level">${tutorial.level}</div>
            <div class="tutorial-title">${tutorial.title}</div>
            <div class="tutorial-description">${tutorial.description}</div>
            <div class="tutorial-steps">${tutorial.steps}</div>
        </div>
    `).join('');
    
    modal.style.display = 'block';
});

// ===========================
// Achievements System
// ===========================
const achievements = [
    { id: 'first_draw', icon: '🎨', title: 'First Stroke', description: 'Make your first drawing', unlocked: false },
    { id: 'save_one', icon: '💾', title: 'Saver', description: 'Save your first artwork', unlocked: false },
    { id: 'save_five', icon: '🏆', title: 'Collector', description: 'Save 5 artworks', unlocked: false },
    { id: 'inspiration', icon: '💡', title: 'Inspired', description: 'Use AI inspiration feature', unlocked: false },
    { id: 'layer_master', icon: '📚', title: 'Layer Master', description: 'Use multiple layers', unlocked: false },
    { id: 'color_expert', icon: '🌈', title: 'Color Expert', description: 'Use all tools', unlocked: false }
];

function loadAchievements() {
    const saved = localStorage.getItem('achievements');
    if (saved) {
        const savedAchievements = JSON.parse(saved);
        achievements.forEach(achievement => {
            const saved = savedAchievements.find(a => a.id === achievement.id);
            if (saved) achievement.unlocked = saved.unlocked;
        });
    }
}

function saveAchievements() {
    localStorage.setItem('achievements', JSON.stringify(achievements));
}

function updateAchievements() {
    const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');
    
    if (historyStep > 0) {
        unlockAchievement('first_draw');
    }
    
    if (drawings.length >= 1) {
        unlockAchievement('save_one');
    }
    
    if (drawings.length >= 5) {
        unlockAchievement('save_five');
    }
    
    if (layers.length > 1) {
        unlockAchievement('layer_master');
    }
}

function unlockAchievement(id) {
    const achievement = achievements.find(a => a.id === id);
    if (achievement && !achievement.unlocked) {
        achievement.unlocked = true;
        saveAchievements();
        showAchievementNotification(achievement);
    }
}

function showAchievementNotification(achievement) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
        color: #333;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-family: Poppins, sans-serif;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
    `;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 2rem;">${achievement.icon}</span>
            <div>
                <div style="font-size: 0.9rem;">🎉 Achievement Unlocked!</div>
                <div style="font-size: 1.1rem;">${achievement.title}</div>
            </div>
        </div>
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.getElementById("achievementsBtn").addEventListener("click", () => {
    const modal = document.getElementById('achievementsModal');
    const content = document.getElementById('achievementsContent');
    
    content.innerHTML = achievements.map(achievement => `
        <div class="achievement-item ${achievement.unlocked ? 'unlocked' : ''}">
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-title">${achievement.title}</div>
            <div class="achievement-description">${achievement.description}</div>
        </div>
    `).join('');
    
    modal.style.display = 'block';
});

// ===========================
// Modal Controls
// ===========================
document.querySelectorAll('.modal-close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        closeBtn.closest('.modal').style.display = 'none';
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// ===========================
// Initialize
// ===========================
loadAchievements();
loadGallery();

// ===========================
// Service Worker for Offline Support
// ===========================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('ServiceWorker registered'))
            .catch(err => console.log('ServiceWorker registration failed'));
    });
}