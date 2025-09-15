// Settings page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle-settings');
    const mainThemeToggle = document.getElementById('theme-toggle');
    
    // Set initial state based on current theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    themeToggle.checked = currentTheme === 'dark';
    
    // Sync with main theme toggle if it exists
    if (mainThemeToggle) {
        mainThemeToggle.checked = currentTheme === 'dark';
    }
    
    // Theme toggle event
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
    });
    
    // Animations toggle
    const animationsToggle = document.getElementById('animations-toggle');
    const animationsEnabled = localStorage.getItem('animations-enabled') !== 'false';
    animationsToggle.checked = animationsEnabled;
    
    // Apply initial animation state
    if (!animationsEnabled) {
        document.documentElement.style.setProperty('--transition', 'none');
        document.querySelectorAll('*').forEach(el => {
            el.style.animation = 'none';
        });
    }
    
    animationsToggle.addEventListener('change', function() {
        if (this.checked) {
            document.documentElement.style.setProperty('--transition', 'all 0.3s ease');
            document.querySelectorAll('*').forEach(el => {
                el.style.animation = '';
            });
            localStorage.setItem('animations-enabled', 'true');
        } else {
            document.documentElement.style.setProperty('--transition', 'none');
            document.querySelectorAll('*').forEach(el => {
                el.style.animation = 'none';
            });
            localStorage.setItem('animations-enabled', 'false');
        }
    });
    
    // Clear history button
    const clearHistoryBtn = document.getElementById('clear-history-btn');
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
});