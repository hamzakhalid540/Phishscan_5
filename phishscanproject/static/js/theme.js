// ===============================
// Safe utilities & fallbacks
// ===============================
function hasAnime() { return typeof window.anime === 'function'; }
function hasThree() { return typeof window.THREE !== 'undefined'; }

function fadeOutEl(el, duration = 800, onDone = () => {}) {
  if (hasAnime() && localStorage.getItem('animations-enabled') !== 'false') {
    anime({
      targets: el,
      opacity: 0,
      duration,
      easing: 'easeOutQuad',
      complete: () => {
        el.style.display = 'none';
        onDone();
      }
    });
  } else {
    el.style.transition = `opacity ${duration}ms ease-out`;
    el.style.opacity = '0';
    setTimeout(() => {
      el.style.display = 'none';
      onDone();
    }, duration);
  }
}

function animeSafe(opts) {
  if (hasAnime() && localStorage.getItem('animations-enabled') !== 'false') return anime(opts);
}

// ===============================
// Three.js Loading Animation (defensive)
// ===============================
function initThreeJSLoader() {
  const container = document.getElementById('loading-screen');
  if (!container || !hasThree() || localStorage.getItem('animations-enabled') === 'false') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const mountTarget = document.querySelector('.threejs-loader') || container;
  mountTarget.appendChild(renderer.domElement);

  // Particles
  const particlesCount = 500;
  const posArray = new Float32Array(particlesCount * 3);
  const colorArray = new Float32Array(particlesCount * 3);

  for (let i = 0; i < particlesCount * 3; i += 3) {
    posArray[i] = (Math.random() - 0.5) * 20;
    posArray[i + 1] = (Math.random() - 0.5) * 20;
    posArray[i + 2] = (Math.random() - 0.5) * 20;

    colorArray[i] = Math.random();
    colorArray[i + 1] = Math.random();
    colorArray[i + 2] = Math.random();
  }

  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
  });

  const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particlesMesh);

  // Protective shield
  const shieldGeometry = new THREE.SphereGeometry(3, 32, 32);
  const shieldMaterial = new THREE.MeshPhongMaterial({
    color: 0x3498db,
    transparent: true,
    opacity: 0.2,
    wireframe: true
  });
  const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
  scene.add(shield);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const pointLight = new THREE.PointLight(0x3498db, 1, 100);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);

  let time = 0;
  let rafId;

  function animate() {
    rafId = requestAnimationFrame(animate);

    time += 0.01;

    particlesMesh.rotation.x += 0.001;
    particlesMesh.rotation.y += 0.002;

    shield.scale.setScalar(1 + Math.sin(time) * 0.1);
    shield.rotation.x += 0.005;
    shield.rotation.y += 0.003;

    const positions = particlesGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += Math.sin(time + i) * 0.01;
      positions[i + 1] += Math.cos(time + i) * 0.01;
    }
    particlesGeometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();

  return () => { cancelAnimationFrame(rafId); renderer.dispose(); };
}

// ===============================
// Loading Screen (fixed 5 seconds, single bar)
// ===============================
const LOADING_DURATION_MS = 5000;

function initLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (!loadingScreen) return;

  loadingScreen.style.display = 'flex';
  loadingScreen.style.opacity = '1';

  if (localStorage.getItem('animations-enabled') !== 'false') {
    initThreeJSLoader();
  }

  // Use existing HTML loading bar
  const progressFill = document.querySelector('.loading-bar');
  if (!progressFill) return;

  const start = performance.now();
  let rafId;

  function tick(now) {
    const elapsed = now - start;
    const pct = Math.min(100, (elapsed / LOADING_DURATION_MS) * 100);
    progressFill.style.width = `${pct}%`;

    if (elapsed >= LOADING_DURATION_MS) {
      cancelAnimationFrame(rafId);
      fadeOutEl(loadingScreen, 800);
      return;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
}

// ===============================
// Theme & particles (with safe anime)
// ===============================
function createParticles() {
  if (localStorage.getItem('animations-enabled') === 'false') return;

  const container = document.body;
  const particleCount = 50;

  document.querySelectorAll('.particle').forEach(p => p.remove());

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');

    const size = Math.random() * 4 + 2;
    const posX = Math.random() * 100;
    const posY = Math.random() * 100;
    const delay = Math.random() * 5;
    const duration = Math.random() * 15 + 10;
    const colors = ['#3498db', '#2980b9', '#2c3e50', '#1a2530'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${posX}%`;
    particle.style.top = `${posY}%`;
    particle.style.animationDelay = `${delay}s`;
    particle.style.animationDuration = `${duration}s`;
    particle.style.opacity = (Math.random() * 0.6 + 0.1).toString();
    particle.style.background = color;
    particle.style.boxShadow = `0 0 ${size * 2}px ${size}px ${color}20`;

    container.appendChild(particle);
  }
}

// ===============================
// Navigation effects (safe anime)
// ===============================
function initNavigationEffects() {
  if (localStorage.getItem('animations-enabled') === 'false') return;

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('mouseenter', function () {
      animeSafe({
        targets: this,
        translateY: -3,
        duration: 300,
        easing: 'easeOutQuad'
      });
    });
    item.addEventListener('mouseleave', function () {
      animeSafe({
        targets: this,
        translateY: 0,
        duration: 300,
        easing: 'easeOutQuad'
      });
    });
  });
}

// ===============================
// Settings page functionality
// ===============================
function initSettingsPage() {
  // Theme toggle functionality
  const themeToggle = document.getElementById('theme-toggle-settings');
  const mainThemeToggle = document.getElementById('theme-toggle');
  
  // Set initial state based on current theme
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  if (themeToggle) themeToggle.checked = currentTheme === 'dark';
  
  // Sync with main theme toggle if it exists
  if (mainThemeToggle) {
    mainThemeToggle.checked = currentTheme === 'dark';
  }
  
  // Theme toggle event
  if (themeToggle) {
    themeToggle.addEventListener('change', function() {
      const newTheme = this.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      // Sync with main theme toggle
      if (mainThemeToggle) {
        mainThemeToggle.checked = this.checked;
      }
      
      // Send to server
      fetch('/api/theme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ theme: newTheme })
      }).catch(error => console.error('Error setting theme:', error));
      
      // Update particles based on theme
      if (newTheme === 'dark') {
        createParticles();
      } else {
        document.querySelectorAll('.particle').forEach(p => p.remove());
      }
    });
  }
  
  // Animations toggle
  const animationsToggle = document.getElementById('animations-toggle');
  const animationsEnabled = localStorage.getItem('animations-enabled') !== 'false';
  if (animationsToggle) animationsToggle.checked = animationsEnabled;
  
  // Apply initial animation state
  if (!animationsEnabled) {
    document.documentElement.style.setProperty('--transition', 'none');
    document.querySelectorAll('*').forEach(el => {
      el.style.animation = 'none';
    });
  }
  
  if (animationsToggle) {
    animationsToggle.addEventListener('change', function() {
      if (this.checked) {
        document.documentElement.style.setProperty('--transition', 'all 0.3s ease');
        document.querySelectorAll('*').forEach(el => {
          el.style.animation = '';
        });
        localStorage.setItem('animations-enabled', 'true');
        
        // Re-initialize animations
        createParticles();
        initNavigationEffects();
      } else {
        document.documentElement.style.setProperty('--transition', 'none');
        document.querySelectorAll('*').forEach(el => {
          el.style.animation = 'none';
        });
        localStorage.setItem('animations-enabled', 'false');
        
        // Remove particles
        document.querySelectorAll('.particle').forEach(p => p.remove());
      }
    });
  }
  
  // Clear history button
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to clear all scan history? This action cannot be undone.')) {
        fetch('/api/clear-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Network response was not ok.');
        })
        .then(data => {
          if (data.status === 'success') {
            showNotification('Scan history cleared successfully', 'success');
            // Update the stats after clearing history
            updateStats();
          }
        })
        .catch(error => {
          console.error('Error clearing history:', error);
          showNotification('Error clearing history', 'error');
        });
      }
    });
  }
  
  // Function to update stats after clearing history
  function updateStats() {
    fetch('/api/stats')
    .then(response => response.json())
    .then(data => {
      // Update the stats in the UI if we're on a page that displays them
      const statElements = document.querySelectorAll('.stat-value');
      if (statElements.length >= 3) {
        statElements[1].textContent = data.total_scans || 0;
        statElements[2].textContent = data.threats_blocked ? Math.round((data.threats_blocked / data.total_scans) * 100) + '%' : '0%';
      }
    })
    .catch(error => console.error('Error fetching stats:', error));
  }
  
  // Show notification function
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: var(--card-bg);
      color: var(--text-color);
      border-radius: 8px;
      box-shadow: var(--shadow-hover);
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      border-left: 4px solid ${
        type === 'success' ? 'var(--success-color)' : 
        type === 'warning' ? 'var(--warning-color)' : 
        type === 'error' ? 'var(--danger-color)' : 'var(--primary-color)'
      };
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// ===============================
// Boot (with toggle synchronization)
// ===============================
document.addEventListener('DOMContentLoaded', function () {
  const themeToggle = document.getElementById('theme-toggle'); // navbar
  const settingsToggle = document.getElementById('theme-toggle-settings'); // settings
  const body = document.body;

  initLoadingScreen();

  const savedTheme = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  body.setAttribute('data-theme', savedTheme);
  if (themeToggle) themeToggle.checked = savedTheme === 'dark';
  if (settingsToggle) settingsToggle.checked = savedTheme === 'dark';

  function applyTheme(newTheme, fromToggle = null) {
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    if (themeToggle && fromToggle !== themeToggle) {
      themeToggle.checked = newTheme === 'dark';
    }
    if (settingsToggle && fromToggle !== settingsToggle) {
      settingsToggle.checked = newTheme === 'dark';
    }

    try {
      fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme })
      });
    } catch (_) {}

    if (newTheme === 'dark') {
      createParticles();
    } else {
      document.querySelectorAll('.particle').forEach(p => p.remove());
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('change', function () {
      const newTheme = this.checked ? 'dark' : 'light';
      applyTheme(newTheme, themeToggle);
    });
  }

  if (settingsToggle) {
    settingsToggle.addEventListener('change', function () {
      const newTheme = this.checked ? 'dark' : 'light';
      applyTheme(newTheme, settingsToggle);
    });
  }

  if (savedTheme === 'dark') createParticles();

  const gridBg = document.createElement('div');
  gridBg.className = 'grid-bg';
  document.body.appendChild(gridBg);

  initNavigationEffects();
  initSettingsPage();
});

window.addEventListener('beforeunload', function () {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) loadingScreen.style.display = 'flex';
});