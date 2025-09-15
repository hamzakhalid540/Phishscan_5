// Scanner page functionality
document.addEventListener('DOMContentLoaded', function() {
    const urlInput = document.getElementById('url-input');
    const scanButton = document.querySelector('.scan-btn');
    const progressBar = document.getElementById('progress-bar');
    const resultsContainer = document.getElementById('results-container');
    const statusIndicator = document.getElementById('status-indicator');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const confidenceValue = document.getElementById('confidence-value');
    const featureList = document.getElementById('feature-list');
    const shapContainer = document.getElementById('shap-visualization');
    
    // Initialize chart
    initScanChart();
    
    // Scan button event listener
    scanButton.addEventListener('click', function() {
        const url = urlInput.value.trim();
        
        if (!url) {
            showNotification('Please enter a URL to scan', 'warning');
            return;
        }
        
        // Validate URL format
        if (!isValidUrl(url)) {
            showNotification('Please enter a valid URL (e.g., https://example.com)', 'warning');
            return;
        }
        
        // Show progress bar
        progressBar.style.display = 'block';
        anime({
            targets: progressBar,
            width: '100%',
            duration: 2000,
            easing: 'easeInOutQuad',
            complete: function() {
                progressBar.style.display = 'none';
            }
        });
        
        // Animate scan button
        anime({
            targets: scanButton,
            scale: 0.95,
            duration: 200,
            easing: 'easeInOutQuad',
            complete: function() {
                anime({
                    targets: scanButton,
                    scale: 1,
                    duration: 200,
                    easing: 'easeInOutQuad'
                });
            }
        });
        
        // Send request to backend
        fetch('/api/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url })
        })
        .then(response => response.json())
        .then(data => {
            displayResults(data);
            updateScanChart(data.status);
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('An error occurred while scanning the URL', 'error');
        });
    });
    
    // Validate URL format
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    // Display scan results
    function displayResults(data) {
        // Update status indicator
        statusIndicator.className = 'status-indicator';
        if (data.status === 'safe') {
            statusIndicator.classList.add('status-safe');
            resultTitle.textContent = 'Safe URL';
            resultMessage.textContent = data.message;
            resultMessage.style.color = 'var(--success-color)';
        } else if (data.status === 'suspicious') {
            statusIndicator.classList.add('status-warning');
            resultTitle.textContent = 'Suspicious URL';
            resultMessage.textContent = data.message;
            resultMessage.style.color = 'var(--warning-color)';
        } else {
            statusIndicator.classList.add('status-danger');
            resultTitle.textContent = 'Dangerous URL';
            resultMessage.textContent = data.message;
            resultMessage.style.color = 'var(--danger-color)';
        }
        
        // Update confidence value
        confidenceValue.textContent = (data.confidence * 100).toFixed(2) + '%';
        confidenceValue.style.color = data.status === 'safe' ? 
            'var(--success-color)' : data.status === 'suspicious' ? 
            'var(--warning-color)' : 'var(--danger-color)';
        
        // Update feature list
        featureList.innerHTML = '';
        for (const [key, value] of Object.entries(data.features)) {
            const li = document.createElement('li');
            li.className = 'feature-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'feature-name';
            nameSpan.textContent = key.replace(/_/g, ' ') + ': ';
            
            const valueSpan = document.createElement('span');
            valueSpan.className = 'feature-value';
            valueSpan.textContent = value.toString();
            
            li.appendChild(nameSpan);
            li.appendChild(valueSpan);
            featureList.appendChild(li);
        }
        
        // Create SHAP visualization
        shapContainer.innerHTML = '';
        if (data.shap_values) {
            for (const [feature, value] of Object.entries(data.shap_values)) {
                const barContainer = document.createElement('div');
                barContainer.className = 'shap-bar-container';
                
                const labelDiv = document.createElement('div');
                labelDiv.className = 'shap-label';
                
                const featureName = document.createElement('span');
                featureName.className = 'shap-feature';
                featureName.textContent = feature.replace(/_/g, ' ');
                
                const featureValue = document.createElement('span');
                featureValue.className = 'shap-value';
                featureValue.textContent = value > 0 ? '+' + value.toFixed(2) : value.toFixed(2);
                featureValue.style.color = value > 0 ? 'var(--success-color)' : 'var(--danger-color)';
                
                labelDiv.appendChild(featureName);
                labelDiv.appendChild(featureValue);
                
                const barDiv = document.createElement('div');
                barDiv.className = 'shap-bar';
                barDiv.style.width = `${Math.abs(value) * 100}%`;
                barDiv.style.backgroundColor = value > 0 ? 'var(--success-color)' : 'var(--danger-color)';
                barDiv.style.marginLeft = value > 0 ? '0' : 'auto';
                
                barContainer.appendChild(labelDiv);
                barContainer.appendChild(barDiv);
                shapContainer.appendChild(barContainer);
            }
        }
        
        // Show results with animation
        resultsContainer.style.display = 'block';
        anime({
            targets: resultsContainer,
            opacity: [0, 1],
            translateY: [50, 0],
            duration: 1000,
            easing: 'easeOutQuad'
        });
        
        // Show notification based on result
        showNotification(
            `URL scanned: ${data.status === 'safe' ? 'Safe' : data.status === 'suspicious' ? 'Suspicious' : 'Dangerous'}`,
            data.status
        );
    }
    
    // Initialize scan chart
    function initScanChart() {
        const ctx = document.getElementById('scan-chart').getContext('2d');
        
        // Mock data for demonstration
        window.scanChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Safe', 'Suspicious', 'Dangerous'],
                datasets: [{
                    data: [12, 3, 2],
                    backgroundColor: [
                        'var(--success-color)',
                        'var(--warning-color)',
                        'var(--danger-color)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'var(--text-color)',
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }
    
    // Update scan chart
    function updateScanChart(status) {
        if (window.scanChart) {
            const index = status === 'safe' ? 0 : status === 'suspicious' ? 1 : 2;
            window.scanChart.data.datasets[0].data[index]++;
            window.scanChart.update();
        }
    }
    
    // Show notification
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        // Add styles
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
        
        // Add to document
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Animate out and remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    // Add animation to stats cards on scroll
    const statCards = document.querySelectorAll('.stat-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                anime({
                    targets: entry.target,
                    translateY: [50, 0],
                    opacity: [0, 1],
                    duration: 800,
                    easing: 'easeOutQuad'
                });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });
    
    statCards.forEach(card => {
        observer.observe(card);
    });
});