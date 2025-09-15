// Three.js background for landing page
function initThreeJSBackground() {
    const container = document.getElementById('threejs-background');
    if (!container) return;
    
    // Create scene
    const scene = new THREE.Scene();
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    
    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 1000;
    
    const posArray = new Float32Array(particlesCount * 3);
    const colorArray = new Float32Array(particlesCount * 3);
    const sizeArray = new Float32Array(particlesCount);
    
    for (let i = 0; i < particlesCount * 3; i += 3) {
        // Positions in a sphere
        const radius = 15;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        posArray[i] = radius * Math.sin(phi) * Math.cos(theta);
        posArray[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        posArray[i + 2] = radius * Math.cos(phi);
        
        // Colors based on theme
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const colors = isDark ? 
            [0x3498db, 0x2980b9, 0x2c3e50, 0x1a2530] : 
            [0x3498db, 0x2980b9, 0x87CEEB, 0xB0E0E6];
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        colorArray[i] = (color >> 16 & 255) / 255;
        colorArray[i + 1] = (color >> 8 & 255) / 255;
        colorArray[i + 2] = (color & 255) / 255;
        
        // Sizes
        sizeArray[i / 3] = Math.random() * 0.2 + 0.1;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    particlesGeometry.setAttribute('size', new THREE.BufferAttribute(sizeArray, 1));
    
    // Create particle material
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
    });
    
    // Create particle system
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
    
    // Create connecting lines
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', particlesGeometry.getAttribute('position'));
    
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x3498db,
        transparent: true,
        opacity: 0.1,
        linewidth: 1
    });
    
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(line);
    
    // Create protective sphere
    const sphereGeometry = new THREE.SphereGeometry(8, 32, 32);
    const sphereMaterial = new THREE.MeshPhongMaterial({
        color: 0x3498db,
        transparent: true,
        opacity: 0.05,
        wireframe: true,
        side: THREE.DoubleSide
    });
    
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphere);
    
    // Create lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0x3498db, 1, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);
    
    // Create directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // Mouse movement effect
    let mouseX = 0;
    let mouseY = 0;
    
    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });
    
    // Animation variables
    let time = 0;
    
    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        time += 0.005;
        
        // Rotate particles and sphere
        particlesMesh.rotation.x += 0.0005;
        particlesMesh.rotation.y += 0.001;
        sphere.rotation.x += 0.001;
        sphere.rotation.y += 0.0005;
        
        // Pulsate sphere
        sphere.scale.setScalar(1 + Math.sin(time) * 0.05);
        
        // Move particles based on mouse position
        const positions = particlesGeometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += mouseX * 0.02;
            positions[i + 1] += mouseY * 0.02;
            
            // Add subtle movement
            positions[i] += Math.sin(time + i) * 0.01;
            positions[i + 1] += Math.cos(time + i) * 0.01;
        }
        particlesGeometry.attributes.position.needsUpdate = true;
        
        // Update lines
        lineGeometry.attributes.position.needsUpdate = true;
        
        renderer.render(scene, camera);
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Start animation
    animate();
}

// Initialize Three.js when the page loads
window.addEventListener('load', initThreeJSBackground);