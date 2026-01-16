// app.js - Complete LuminPath Application with Supabase
console.log('LuminPath AR App Initializing...');

// ============================================================================
// GLOBAL STATE
// ============================================================================
const AppState = {
    // Core State
    mode: 'paint', // 'paint', 'follow', 'library'
    isPainting: false,
    currentTrail: [],
    selectedTrail: null,
    
    // Visual Settings
    selectedColor: '#10B981',
    selectedStyle: 'particles',
    colors: ['#10B981', '#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6', '#06B6D4'],
    styles: ['particles', 'line', 'sparks'],
    
    // GPS & Location
    currentPosition: null,
    gpsAccuracy: null,
    gpsWatchId: null,
    
    // Following State
    followingInterval: null,
    currentWaypointIndex: 0,
    isFollowing: false,
    
    // Visual Elements
    trailEntities: [],
    activeVisuals: [],
    userMarker: null,
    
    // Performance
    lastPaintTime: 0,
    paintInterval: 800, // ms between points
    lastFrameTime: 0,
    fps: 60,
    
    // Supabase Connection
    supabaseConnected: false
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const Elements = {
    // Mode buttons
    paintModeBtn: document.getElementById('paintModeBtn'),
    followModeBtn: document.getElementById('followModeBtn'),
    libraryModeBtn: document.getElementById('libraryModeBtn'),
    
    // Control panels
    paintControls: document.getElementById('paintControls'),
    followControls: document.getElementById('followControls'),
    libraryControls: document.getElementById('libraryControls'),
    
    // Paint controls
    startPaintBtn: document.getElementById('startPaintBtn'),
    paintIcon: document.getElementById('paintIcon'),
    paintText: document.getElementById('paintText'),
    saveTrailBtn: document.getElementById('saveTrailBtn'),
    
    // Follow controls
    followBtn: document.getElementById('followBtn'),
    trailList: document.getElementById('trailList'),
    libraryList: document.getElementById('libraryList'),
    
    // Status
    statusText: document.getElementById('statusText'),
    gpsIndicator: document.getElementById('gpsIndicator'),
    connectionStatus: document.getElementById('connectionStatus'),
    
    // AR Elements
    trailContainer: document.getElementById('trailContainer'),
    userPosition: document.getElementById('userPosition'),
    waypointCursor: document.getElementById('waypointCursor'),
    
    // Debug
    pointCount: document.getElementById('pointCount'),
    fpsCounter: document.getElementById('fpsCounter'),
    arStats: document.getElementById('arStats')
};

// ============================================================================
// INITIALIZATION
// ============================================================================
async function init() {
    console.log('🚀 Starting LuminPath initialization...');
    
    try {
        // 1. Check for Supabase connection
        if (!window.supabase) {
            throw new Error('Supabase not initialized. Check supabase-config.js');
        }
        
        // Test Supabase connection
        const { data, error } = await window.supabase.from('trails').select('count', { count: 'exact', head: true });
        
        if (error) {
            console.warn('Supabase connection test failed:', error.message);
            updateStatus('Using offline mode', 'warning');
            AppState.supabaseConnected = false;
        } else {
            console.log('✅ Supabase connected successfully');
            AppState.supabaseConnected = true;
            updateConnectionStatus(true);
        }
        
        // 2. Request permissions and start GPS
        await startGPS();
        
        // 3. Setup event listeners
        setupEventListeners();
        
        // 4. Start performance monitoring
        startPerformanceMonitor();
        
        // 5. Load initial trails
        if (AppState.supabaseConnected) {
            loadTrails();
        }
        
        // 6. Initialize AR scene
        initARScene();
        
        console.log('✅ LuminPath initialized successfully');
        updateStatus('Ready to create magic! ✨', 'success');
        
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        updateStatus('Initialization failed: ' + error.message, 'error');
        
        // Show error in loading screen
        document.getElementById('loadingScreen').innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 48px;">😢</div>
                <h2>Initialization Failed</h2>
                <p>${error.message}</p>
                <button onclick="location.reload()" style="
                    background: #7c3aed;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    margin-top: 20px;
                    cursor: pointer;
                ">Retry</button>
            </div>
        `;
    }
}

// ============================================================================
// GPS & LOCATION
// ============================================================================
async function startGPS() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported by browser'));
            return;
        }
        
        // First, try to get high accuracy position
        navigator.geolocation.getCurrentPosition(
            (position) => {
                onGPSSuccess(position);
                resolve();
            },
            (error) => {
                console.warn('High accuracy GPS failed, trying lower accuracy:', error);
                // Try with lower accuracy
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        onGPSSuccess(position);
                        resolve();
                    },
                    (error) => {
                        onGPSError(error);
                        reject(error);
                    },
                    { enableHighAccuracy: false, timeout: 10000 }
                );
            },
            { 
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 15000 
            }
        );
        
        // Start watching position
        AppState.gpsWatchId = navigator.geolocation.watchPosition(
            onGPSSuccess,
            onGPSError,
            {
                enableHighAccuracy: true,
                maximumAge: 3000,
                timeout: 10000
            }
        );
    });
}

function onGPSSuccess(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    AppState.currentPosition = {
        lat: latitude,
        lng: longitude,
        accuracy: accuracy,
        altitude: position.coords.altitude || 0,
        heading: position.coords.heading || 0,
        speed: position.coords.speed || 0,
        timestamp: position.timestamp
    };
    
    AppState.gpsAccuracy = accuracy;
    
    // Update GPS indicator
    Elements.gpsIndicator.classList.add('active');
    
    // Color code accuracy
    if (accuracy < 10) {
        Elements.gpsIndicator.style.background = '#10B981';
        updateStatus(`GPS: Excellent (${accuracy.toFixed(1)}m)`);
    } else if (accuracy < 30) {
        Elements.gpsIndicator.style.background = '#F59E0B';
        updateStatus(`GPS: Good (${accuracy.toFixed(1)}m)`);
    } else {
        Elements.gpsIndicator.style.background = '#EF4444';
        updateStatus(`GPS: Poor (${accuracy.toFixed(1)}m) - Move outside`);
    }
    
    // Update user position in AR
    updateUserPosition();
    
    // Add trail point if painting
    if (AppState.isPainting) {
        const now = Date.now();
        if (now - AppState.lastPaintTime > AppState.paintInterval) {
            addTrailPoint(latitude, longitude);
            AppState.lastPaintTime = now;
        }
    }
    
    // Update following if active
    if (AppState.isFollowing && AppState.selectedTrail) {
        updateFollowing();
    }
}

function onGPSError(error) {
    console.error('GPS Error:', error);
    
    Elements.gpsIndicator.classList.remove('active');
    Elements.gpsIndicator.style.background = '#EF4444';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            updateStatus('📍 Location permission denied. Enable in browser settings.', 'error');
            break;
        case error.POSITION_UNAVAILABLE:
            updateStatus('📍 Location unavailable. Check GPS is enabled.', 'error');
            break;
        case error.TIMEOUT:
            updateStatus('📍 Location timeout. Try moving outside.', 'error');
            break;
        default:
            updateStatus('📍 Location error: ' + error.message, 'error');
    }
}

function updateUserPosition() {
    if (!Elements.userPosition || !AppState.currentPosition) return;
    
    // In a real implementation, this would convert lat/lng to AR coordinates
    // For this demo, we'll simulate movement
    const time = Date.now() / 1000;
    const x = Math.sin(time * 0.5) * 0.5;
    const z = Math.cos(time * 0.5) * 0.5 - 2;
    
    Elements.userPosition.setAttribute('position', `${x} 0 ${z}`);
}

// ============================================================================
// TRAIL PAINTING
// ============================================================================
function togglePainting() {
    AppState.isPainting = !AppState.isPainting;
    
    if (AppState.isPainting) {
        // Start painting
        Elements.paintIcon.textContent = '⏸';
        Elements.paintText.textContent = 'Stop Painting';
        Elements.startPaintBtn.style.background = 'linear-gradient(135deg, #EF4444, #FCA5A5)';
        
        updateStatus('🎨 Painting trail... Walk to create!', 'success');
        
        // Start with current position
        if (AppState.currentPosition) {
            addTrailPoint(AppState.currentPosition.lat, AppState.currentPosition.lng);
        }
        
        // Play sound if available
        playSound('paint');
        
    } else {
        // Stop painting
        Elements.paintIcon.textContent = '▶';
        Elements.paintText.textContent = 'Start Painting';
        Elements.startPaintBtn.style.background = 'linear-gradient(135deg, #10B981, #34D399)';
        
        updateStatus('Painting stopped. ' + AppState.currentTrail.length + ' points recorded.');
        
        // Enable save button if we have enough points
        if (AppState.currentTrail.length >= 2) {
            Elements.saveTrailBtn.disabled = false;
        }
    }
}

function addTrailPoint(lat, lng) {
    const point = {
        lat: parseFloat(lat.toFixed(7)),
        lng: parseFloat(lng.toFixed(7)),
        timestamp: Date.now(),
        color: AppState.selectedColor,
        style: AppState.selectedStyle
    };
    
    AppState.currentTrail.push(point);
    
    // Create visual representation
    createTrailPointVisual(point, AppState.currentTrail.length - 1);
    
    // Update point counter
    Elements.pointCount.textContent = AppState.currentTrail.length;
    
    // Log for debugging
    if (AppState.currentTrail.length % 5 === 0) {
        console.log(`Trail points: ${AppState.currentTrail.length}`);
    }
}

function createTrailPointVisual(point, index) {
    if (!Elements.trailContainer) return;
    
    let entity;
    const scene = document.querySelector('a-scene');
    
    // Calculate position based on index (simulated for demo)
    const x = (index * 0.3) % 4 - 2;
    const z = -Math.floor(index * 0.3 / 4) * 0.3 - 2;
    
    switch(AppState.selectedStyle) {
        case 'particles':
            entity = document.createElement('a-entity');
            entity.setAttribute('position', `${x} 0 ${z}`);
            entity.setAttribute('geometry', 'primitive: sphere; radius: 0.08');
            entity.setAttribute('material', `color: ${point.color}; emissive: ${point.color}; emissiveIntensity: 0.8`);
            entity.setAttribute('animation', `property: scale; to: 0.2 0.2 0.2; dur: 1500; easing: easeInOutSine; dir: alternate; loop: true`);
            entity.setAttribute('animation__opacity', `property: material.opacity; from: 0.3; to: 1; dur: 2000; dir: alternate; loop: true`);
            break;
            
        case 'line':
            entity = document.createElement('a-entity');
            if (index > 0) {
                // Draw line to previous point
                const prevX = ((index-1) * 0.3) % 4 - 2;
                const prevZ = -Math.floor((index-1) * 0.3 / 4) * 0.3 - 2;
                
                entity.setAttribute('line', {
                    start: { x: prevX, y: 0, z: prevZ },
                    end: { x: x, y: 0, z: z },
                    color: point.color,
                    opacity: 0.7,
                    linewidth: 3
                });
            } else {
                // First point as sphere
                entity.setAttribute('position', `${x} 0 ${z}`);
                entity.setAttribute('geometry', 'primitive: sphere; radius: 0.1');
                entity.setAttribute('material', `color: ${point.color}`);
            }
            break;
            
        case 'sparks':
            entity = document.createElement('a-entity');
            entity.setAttribute('position', `${x} 0 ${z}`);
            entity.innerHTML = `
                <a-entity geometry="primitive: tetrahedron; radius: 0.06" 
                         material="color: ${point.color}; emissive: ${point.color}"
                         animation="property: rotation; to: 360 360 360; dur: 2000; loop: true">
                </a-entity>
                <a-entity geometry="primitive: ring; radiusInner: 0.1; radiusOuter: 0.15"
                         material="color: ${point.color}; transparent: true; opacity: 0.5"
                         animation="property: scale; to: 1.5 1.5 1.5; dur: 1000; dir: alternate; loop: true">
                </a-entity>
            `;
            break;
    }
    
    if (entity) {
        entity.setAttribute('data-trail-point', 'true');
        entity.setAttribute('data-point-index', index);
        Elements.trailContainer.appendChild(entity);
        AppState.trailEntities.push(entity);
    }
}

function clearCurrentTrail() {
    if (!AppState.currentTrail.length && !AppState.trailEntities.length) {
        updateStatus('No trail to clear', 'warning');
        return;
    }
    
    // Clear data
    AppState.currentTrail = [];
    
    // Remove visual elements
    AppState.trailEntities.forEach(entity => {
        if (entity.parentNode) {
            entity.parentNode.removeChild(entity);
        }
    });
    AppState.trailEntities = [];
    
    // Reset UI
    Elements.saveTrailBtn.disabled = true;
    Elements.pointCount.textContent = '0';
    
    updateStatus('Trail cleared', 'success');
    playSound('clear');
}

// ============================================================================
// TRAIL SAVING & LOADING (SUPABASE)
// ============================================================================
async function saveTrail() {
    if (AppState.currentTrail.length < 2) {
        alert('You need at least 2 points to save a trail!');
        return;
    }
    
    const trailName = prompt('Name your magical trail:', 
        `Trail_${new Date().toLocaleDateString().replace(/\//g, '-')}_${Math.floor(Math.random() * 100)}`);
    
    if (!trailName || trailName.trim() === '') {
        updateStatus('Trail save cancelled', 'warning');
        return;
    }
    
    // Calculate trail stats
    const distance = calculateTrailDistance(AppState.currentTrail);
    const duration = AppState.currentTrail.length > 1 ? 
        (AppState.currentTrail[AppState.currentTrail.length-1].timestamp - AppState.currentTrail[0].timestamp) / 1000 : 0;
    
    const trailData = {
        name: trailName.trim(),
        points: AppState.currentTrail,
        color: AppState.selectedColor,
        style: AppState.selectedStyle,
        distance: parseFloat(distance.toFixed(2)),
        point_count: AppState.currentTrail.length,
        duration: parseFloat(duration.toFixed(1)),
        created_by: 'anonymous_user',
        created_at: new Date().toISOString()
    };
    
    updateStatus('Saving trail to cloud...', 'info');
    
    try {
        if (!AppState.supabaseConnected) {
            throw new Error('No internet connection');
        }
        
        const { data, error } = await window.supabase
            .from('trails')
            .insert([trailData])
            .select()
            .single();
        
        if (error) throw error;
        
        updateStatus(`✨ Trail "${trailName}" saved successfully!`, 'success');
        playSound('save');
        
        // Clear current trail
        clearCurrentTrail();
        
        // Refresh trail lists
        loadTrails();
        loadAllTrails();
        
        // Show success message
        showToast('Trail saved to cloud!', 'success');
        
    } catch (error) {
        console.error('Error saving trail:', error);
        
        // Try to save locally as fallback
        saveTrailLocal(trailData);
        
        updateStatus('Saved locally (no internet)', 'warning');
        showToast('Saved locally (offline)', 'warning');
    }
}

function saveTrailLocal(trailData) {
    try {
        // Get existing local trails
        const localTrails = JSON.parse(localStorage.getItem('luminpath_trails') || '[]');
        
        // Add new trail
        trailData.id = 'local_' + Date.now();
        trailData.local = true;
        localTrails.push(trailData);
        
        // Save back to localStorage
        localStorage.setItem('luminpath_trails', JSON.stringify(localTrails));
        
        console.log('Trail saved locally:', trailData.id);
        return true;
    } catch (error) {
        console.error('Error saving locally:', error);
        return false;
    }
}

async function loadTrails() {
    updateStatus('Loading trails...', 'info');
    
    try {
        let trails = [];
        
        if (AppState.supabaseConnected) {
            // Load from Supabase
            const { data, error } = await window.supabase
                .from('trails')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (error) throw error;
            trails = data || [];
        }
        
        // Load local trails
        const localTrails = JSON.parse(localStorage.getItem('luminpath_trails') || '[]');
        trails = [...trails, ...localTrails];
        
        // Display trails
        displayTrails(trails, Elements.trailList, 'follow');
        
        updateStatus(`Loaded ${trails.length} trails`, 'success');
        
    } catch (error) {
        console.error('Error loading trails:', error);
        
        // Try loading only local trails
        const localTrails = JSON.parse(localStorage.getItem('luminpath_trails') || '[]');
        displayTrails(localTrails, Elements.trailList, 'follow');
        
        updateStatus(`Loaded ${localTrails.length} local trails (offline)`, 'warning');
    }
}

async function loadAllTrails() {
    try {
        let allTrails = [];
        
        if (AppState.supabaseConnected) {
            const { data, error } = await window.supabase
                .from('trails')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            allTrails = data || [];
        }
        
        // Add local trails
        const localTrails = JSON.parse(localStorage.getItem('luminpath_trails') || '[]');
        allTrails = [...allTrails, ...localTrails];
        
        displayTrails(allTrails, Elements.libraryList, 'library');
        
    } catch (error) {
        console.error('Error loading all trails:', error);
        const localTrails = JSON.parse(localStorage.getItem('luminpath_trails') || '[]');
        displayTrails(localTrails, Elements.libraryList, 'library');
    }
}

function displayTrails(trails, container, context) {
    if (!trails || trails.length === 0) {
        container.innerHTML = `
            <div class="no-trails">
                <span class="emoji">🌌</span>
                <p>No trails found yet</p>
                <p style="font-size: 13px; opacity: 0.7;">Create the first one!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    trails.forEach((trail, index) => {
        const trailItem = document.createElement('div');
        trailItem.className = 'trail-item';
        trailItem.dataset.trailId = trail.id || 'local_' + index;
        
        // Format distance
        const distance = trail.distance ? 
            trail.distance < 1000 ? 
                `${trail.distance.toFixed(0)}m` : 
                `${(trail.distance / 1000).toFixed(1)}km` : 
            'Unknown';
        
        // Format date
        const date = trail.created_at ? 
            new Date(trail.created_at).toLocaleDateString() : 
            'Recently';
        
        trailItem.innerHTML = `
            <div class="trail-name">
                <span class="trail-color" style="background: ${trail.color || '#10B981'}"></span>
                ${trail.name}
            </div>
            <div class="trail-meta">
                <span>${trail.point_count || trail.points?.length || 0} points</span>
                <span>${distance}</span>
                <span>${date}</span>
            </div>
            ${trail.local ? '<div style="font-size: 11px; color: #F59E0B; margin-top: 4px;">📍 Local</div>' : ''}
        `;
        
        trailItem.onclick = () => selectTrail(trail, context);
        container.appendChild(trailItem);
    });
}

function selectTrail(trail, context) {
    // Deselect all trails
    document.querySelectorAll('.trail-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Select clicked trail
    event.currentTarget.classList.add('selected');
    
    AppState.selectedTrail = trail;
    
    if (context === 'follow') {
        // Enable follow button
        Elements.followBtn.disabled = false;
        updateStatus(`Selected: ${trail.name}`, 'success');
        
        // Visualize the trail
        visualizeTrail(trail);
        
    } else if (context === 'library') {
        // Just visualize for library view
        visualizeTrail(trail);
        updateStatus(`Viewing: ${trail.name}`, 'info');
    }
}

// ============================================================================
// TRAIL FOLLOWING
// ============================================================================
function startFollowing() {
    if (!AppState.selectedTrail) {
        showToast('Select a trail first!', 'error');
        return;
    }
    
    AppState.isFollowing = true;
    AppState.currentWaypointIndex = 0;
    
    Elements.followBtn.disabled = true;
    Elements.followBtn.textContent = '🚶‍♂️ Following...';
    
    // Show waypoint cursor
    Elements.waypointCursor.setAttribute('visible', 'true');
    
    updateStatus(`Following: ${AppState.selectedTrail.name}`, 'success');
    showToast('Started following trail!', 'success');
    
    // Start navigation updates
    if (AppState.followingInterval) {
        clearInterval(AppState.followingInterval);
    }
    
    AppState.followingInterval = setInterval(updateFollowing, 2000);
}

function stopFollowing() {
    AppState.isFollowing = false;
    
    if (AppState.followingInterval) {
        clearInterval(AppState.followingInterval);
        AppState.followingInterval = null;
    }
    
    // Hide waypoint cursor
    Elements.waypointCursor.setAttribute('visible', 'false');
    
    // Reset follow button
    Elements.followBtn.disabled = false;
    Elements.followBtn.textContent = '🚶‍♂️ Start Following';
    
    updateStatus('Stopped following trail', 'info');
    showToast('Stopped following', 'info');
}

function updateFollowing() {
    if (!AppState.isFollowing || !AppState.selectedTrail || !AppState.currentPosition) {
        return;
    }
    
    const trail = AppState.selectedTrail;
    const userPos = AppState.currentPosition;
    
    if (!trail.points || trail.points.length === 0) {
        stopFollowing();
        return;
    }
    
    // Find nearest point
    let nearestIndex = AppState.currentWaypointIndex;
    let minDistance = Infinity;
    
    // Check points around current index
    const searchRange = 5;
    const startIdx = Math.max(0, nearestIndex - searchRange);
    const endIdx = Math.min(trail.points.length - 1, nearestIndex + searchRange);
    
    for (let i = startIdx; i <= endIdx; i++) {
        const point = trail.points[i];
        const distance = haversineDistance(
            userPos.lat, userPos.lng,
            point.lat, point.lng
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = i;
        }
    }
    
    AppState.currentWaypointIndex = nearestIndex;
    
    // Get next waypoint (if not at end)
    if (nearestIndex < trail.points.length - 1) {
        const nextPoint = trail.points[nearestIndex + 1];
        
        // Calculate bearing and distance
        const distanceToNext = haversineDistance(
            userPos.lat, userPos.lng,
            nextPoint.lat, nextPoint.lng
        );
        
        const bearing = calculateBearing(
            userPos.lat, userPos.lng,
            nextPoint.lat, nextPoint.lng
        );
        
        // Update waypoint cursor position
        const angle = (bearing * Math.PI) / 180;
        const x = Math.sin(angle) * 3;
        const z = -Math.cos(angle) * 3 - 1;
        
        Elements.waypointCursor.setAttribute('position', `${x} 0 ${z}`);
        Elements.waypointCursor.setAttribute('material', `color: ${trail.color || '#EC4899'}`);
        
        // Update status
        let statusMsg = `Follow trail → ${distanceToNext.toFixed(0)}m`;
        
        if (distanceToNext < 10) {
            statusMsg += ' 🎯 Almost there!';
        } else if (distanceToNext < 50) {
            statusMsg += ' 👍 Getting close';
        }
        
        updateStatus(statusMsg, 'info');
        
        // Check if reached end
        if (nearestIndex >= trail.points.length - 2 && distanceToNext < 5) {
            updateStatus('🎉 Trail completed!', 'success');
            showToast('Trail completed! Well done!', 'success');
            stopFollowing();
        }
    } else {
        // Reached end of trail
        updateStatus('🎉 Trail completed!', 'success');
        showToast('Trail completed! Well done!', 'success');
        stopFollowing();
    }
}

function visualizeTrail(trail) {
    // Clear previous visualization
    clearAllVisuals();
    
    if (!trail || !trail.points || trail.points.length === 0) {
        return;
    }
    
    const points = trail.points;
    const color = trail.color || '#10B981';
    
    // Create visualization based on style
    if (trail.style === 'line' || !trail.style) {
        // Create connected line
        for (let i = 1; i < points.length; i++) {
            const p1 = points[i-1];
            const p2 = points[i];
            
            // Calculate positions (simulated)
            const x1 = (i-1) * 0.3 % 4 - 2;
            const z1 = -Math.floor((i-1) * 0.3 / 4) * 0.3 - 2;
            const x2 = i * 0.3 % 4 - 2;
            const z2 = -Math.floor(i * 0.3 / 4) * 0.3 - 2;
            
            const entity = document.createElement('a-entity');
            entity.setAttribute('line', {
                start: { x: x1, y: 0, z: z1 },
                end: { x: x2, y: 0, z: z2 },
                color: color,
                opacity: 0.6,
                linewidth: 4
            });
            entity.setAttribute('data-trail-visual', 'true');
            Elements.trailContainer.appendChild(entity);
            AppState.activeVisuals.push(entity);
        }
    } else {
        // Create individual points
        points.forEach((point, index) => {
            const x = (index * 0.3) % 4 - 2;
            const z = -Math.floor(index * 0.3 / 4) * 0.3 - 2;
            
            const entity = document.createElement('a-entity');
            entity.setAttribute('position', `${x} 0 ${z}`);
            
            if (trail.style === 'sparks') {
                entity.setAttribute('geometry', 'primitive: tetrahedron; radius: 0.07');
                entity.setAttribute('material', `color: ${color}; emissive: ${color}`);
                entity.setAttribute('animation', `property: rotation; to: 0 360 0; dur: ${2000 + index * 100}; loop: true`);
            } else {
                entity.setAttribute('geometry', 'primitive: sphere; radius: 0.1');
                entity.setAttribute('material', `color: ${color}`);
                
                if (index % 5 === 0) {
                    entity.setAttribute('animation', `property: scale; to: 0.2 0.2 0.2; dur: 1500; dir: alternate; loop: true`);
                }
            }
            
            entity.setAttribute('data-trail-visual', 'true');
            Elements.trailContainer.appendChild(entity);
            AppState.activeVisuals.push(entity);
        });
    }
    
    // Add start and end markers
    if (points.length > 0) {
        // Start marker
        const startEntity = document.createElement('a-entity');
        startEntity.setAttribute('position', `-2 0 -2`);
        startEntity.setAttribute('geometry', 'primitive: cone; radiusBottom: 0.2; height: 0.4');
        startEntity.setAttribute('material', 'color: #10B981');
        startEntity.setAttribute('data-trail-visual', 'true');
        startEntity.setAttribute('text', `value: START; color: white; align: center; width: 2`);
        Elements.trailContainer.appendChild(startEntity);
        AppState.activeVisuals.push(startEntity);
        
        // End marker
        const endX = ((points.length-1) * 0.3) % 4 - 2;
        const endZ = -Math.floor((points.length-1) * 0.3 / 4) * 0.3 - 2;
        const endEntity = document.createElement('a-entity');
        endEntity.setAttribute('position', `${endX} 0 ${endZ}`);
        endEntity.setAttribute('geometry', 'primitive: cone; radiusBottom: 0.2; height: 0.4');
        endEntity.setAttribute('material', 'color: #EC4899');
        endEntity.setAttribute('rotation', '0 0 180');
        endEntity.setAttribute('data-trail-visual', 'true');
        endEntity.setAttribute('text', `value: END; color: white; align: center; width: 2`);
        Elements.trailContainer.appendChild(endEntity);
        AppState.activeVisuals.push(endEntity);
    }
}

function clearAllVisuals() {
    AppState.activeVisuals.forEach(entity => {
        if (entity.parentNode) {
            entity.parentNode.removeChild(entity);
        }
    });
    AppState.activeVisuals = [];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function calculateTrailDistance(points) {
    if (!points || points.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i-1];
        const p2 = points[i];
        totalDistance += haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    }
    
    return totalDistance;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    
    return (θ * 180 / Math.PI + 360) % 360;
}

// ============================================================================
// UI CONTROLS
// ============================================================================
function switchMode(mode) {
    AppState.mode = mode;
    
    // Update active buttons
    Elements.paintModeBtn.classList.toggle('active', mode === 'paint');
    Elements.followModeBtn.classList.toggle('active', mode === 'follow');
    Elements.libraryModeBtn.classList.toggle('active', mode === 'library');
    
    // Show/hide control panels
    Elements.paintControls.classList.toggle('active', mode === 'paint');
    Elements.followControls.classList.toggle('active', mode === 'follow');
    Elements.libraryControls.classList.toggle('active', mode === 'library');
    
    // Update status
    switch(mode) {
        case 'paint':
            updateStatus('🎨 Paint Mode: Create magical trails', 'info');
            break;
        case 'follow':
            updateStatus('🧭 Follow Mode: Navigate with AR', 'info');
            if (AppState.supabaseConnected) loadTrails();
            break;
        case 'library':
            updateStatus('📚 Library: View all trails', 'info');
            loadAllTrails();
            break;
    }
}

function selectColor(color) {
    AppState.selectedColor = color;
    
    // Update UI
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.toggle('selected', option.style.background === color);
    });
    
    updateStatus(`Color: ${color}`, 'info');
}

function selectStyle(style) {
    AppState.selectedStyle = style;
    
    // Update UI
    document.querySelectorAll('.style-btn').forEach(btn => {
        const btnText = btn.textContent.toLowerCase();
        btn.classList.toggle('selected', 
            (style === 'particles' && btnText.includes('glow')) ||
            (style === 'line' && btnText.includes('line')) ||
            (style === 'sparks' && btnText.includes('sparks'))
        );
    });
    
    updateStatus(`Style: ${style}`, 'info');
}

function updateStatus(message, type = 'info') {
    if (!Elements.statusText) return;
    
    Elements.statusText.textContent = message;
    
    // Add emoji based on type
    let emoji = '';
    if (type === 'error') emoji = '❌ ';
    else if (type === 'success') emoji = '✅ ';
    else if (type === 'warning') emoji = '⚠️ ';
    else if (type === 'info') emoji = 'ℹ️ ';
    
    Elements.statusText.textContent = emoji + message;
    
    // Log to console
    console.log(`Status: ${message}`);
}

function updateConnectionStatus(connected) {
    if (!Elements.connectionStatus) return;
    
    const dot = Elements.connectionStatus.querySelector('.connection-dot');
    const text = Elements.connectionStatus.querySelector('span');
    
    if (connected) {
        dot.className = 'connection-dot connected';
        text.textContent = 'Online';
        Elements.connectionStatus.style.background = 'rgba(16, 185, 129, 0.2)';
        Elements.connectionStatus.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    } else {
        dot.className = 'connection-dot disconnected';
        text.textContent = 'Offline';
        Elements.connectionStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        Elements.connectionStatus.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    }
}

function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#EF4444' : 
                     type === 'success' ? '#10B981' : 
                     type === 'warning' ? '#F59E0B' : '#3B82F6'};
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        z-index: 10000;
        font-weight: 500;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        animation: toastIn 0.3s ease, toastOut 0.3s ease 2.7s;
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'toastOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }
    }, 2700);
}

function playSound(type) {
    // This is a placeholder for sound effects
    // In a real app, you would load and play audio files
    console.log(`Play sound: ${type}`);
}

// ============================================================================
// PERFORMANCE & MONITORING
// ============================================================================
function startPerformanceMonitor() {
    let frameCount = 0;
    let lastTime = performance.now();
    
    function updateFPS() {
        const currentTime = performance.now();
        frameCount++;
        
        if (currentTime >= lastTime + 1000) {
            AppState.fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
            frameCount = 0;
            lastTime = currentTime;
            
            // Update FPS display
            if (Elements.fpsCounter) {
                Elements.fpsCounter.textContent = AppState.fps;
                
                // Show/hide stats based on FPS
                if (AppState.fps < 30) {
                    Elements.arStats.style.display = 'block';
                    Elements.arStats.style.background = 'rgba(239, 68, 68, 0.3)';
                } else if (AppState.fps < 50) {
                    Elements.arStats.style.display = 'block';
                    Elements.arStats.style.background = 'rgba(245, 158, 11, 0.3)';
                } else {
                    Elements.arStats.style.display = 'none';
                }
            }
        }
        
        requestAnimationFrame(updateFPS);
    }
    
    updateFPS();
}

// ============================================================================
// EVENT LISTENERS & AR INIT
// ============================================================================
function setupEventListeners() {
    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Auto-pause when app is hidden
            if (AppState.isPainting) {
                togglePainting();
            }
            if (AppState.isFollowing) {
                stopFollowing();
            }
        }
    });
    
    // Handle beforeunload
    window.addEventListener('beforeunload', () => {
        if (AppState.gpsWatchId !== null) {
            navigator.geolocation.clearWatch(AppState.gpsWatchId);
        }
    });
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            updateStatus('Orientation changed', 'info');
        }, 100);
    });
    
    // Handle clicks on document for debugging
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'BODY' && AppState.mode === 'paint') {
            // Add a test point when clicking on body in paint mode (for testing without GPS)
            if (!AppState.currentPosition && AppState.isPainting) {
                const testLat = 40.7128 + (Math.random() - 0.5) * 0.001;
                const testLng = -74.0060 + (Math.random() - 0.5) * 0.001;
                addTrailPoint(testLat, testLng);
            }
        }
    });
}

function initARScene() {
    const scene = document.querySelector('a-scene');
    
    if (!scene) {
        console.error('AR Scene not found');
        return;
    }
    
    // Add scene event listeners
    scene.addEventListener('enter-vr', () => {
        updateStatus('Entered VR mode', 'info');
    });
    
    scene.addEventListener('exit-vr', () => {
        updateStatus('Exited VR mode', 'info');
    });
    
    // Monitor AR markers (if using marker-based AR)
    scene.addEventListener('markerFound', (event) => {
        console.log('Marker found:', event.target.id);
    });
    
    scene.addEventListener('markerLost', (event) => {
        console.log('Marker lost:', event.target.id);
    });
}

// ============================================================================
// START THE APPLICATION
// ============================================================================
// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Add CSS for toast animations
const style = document.createElement('style');
style.textContent = `
    @keyframes toastIn {
        from { 
            opacity: 0; 
            transform: translateX(-50%) translateY(-20px); 
        }
        to { 
            opacity: 1; 
            transform: translateX(-50%) translateY(0); 
        }
    }
    
    @keyframes toastOut {
        from { 
            opacity: 1; 
            transform: translateX(-50%) translateY(0); 
        }
        to { 
            opacity: 0; 
            transform: translateX(-50%) translateY(-20px); 
        }
    }
    
    .toast-message {
        font-family: 'Segoe UI', system-ui, sans-serif;
    }
`;
document.head.appendChild(style);

// Make functions available globally for debugging
window.AppState = AppState;
window.Elements = Elements;
window.debug = {
    addTestPoint: (lat, lng) => addTrailPoint(lat || 40.7128, lng || -74.0060),
    clearTrail: () => clearCurrentTrail(),
    saveTestTrail: () => saveTrail(),
    loadTrails: () => loadTrails(),
    switchMode: (mode) => switchMode(mode)
};

console.log('LuminPath app.js loaded successfully! 🎨✨');