// History page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts
    initHistoryChart();
    initLineChart();
    
    // Animate table rows
    const tableRows = document.querySelectorAll('.history-table tr');
    tableRows.forEach((row, index) => {
        row.style.opacity = 0;
        row.style.transform = 'translateX(-50px)';
        setTimeout(() => {
            anime({
                targets: row,
                opacity: 1,
                translateX: 0,
                duration: 500,
                easing: 'easeOutQuad',
                delay: index * 100
            });
        }, 300);
    });

    // ✅ Bar chart
function initHistoryChart() {
    const ctx = document.getElementById('history-chart');
    if (!ctx) return;

    const statusCounts = { safe: 0, suspicious: 0, dangerous: 0 };
    document.querySelectorAll('.status-badge').forEach(badge => {
        if (badge.classList.contains('badge-safe')) statusCounts.safe++;
        else if (badge.classList.contains('badge-warning')) statusCounts.suspicious++;
        else if (badge.classList.contains('badge-danger')) statusCounts.dangerous++;
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Safe', 'Suspicious', 'Dangerous'],
            datasets: [{
                label: 'Number of Scans',
                data: [statusCounts.safe, statusCounts.suspicious, statusCounts.dangerous],
                backgroundColor: [
                    '#2ecc71', // Bright green
                    '#f1c40f', // Bright yellow
                    '#e74c3c'  // Bright red
                ],
                borderColor: [
                    '#27ae60',
                    '#f39c12',
                    '#c0392b'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#e0e0e0' },
                    ticks: { color: '#2c3e50' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#2c3e50' }
                }
            }
        }
    });
}

// ✅ Line chart
function initLineChart() {
    const ctx = document.getElementById('scan-distribution-chart');
    if (!ctx) return;

    const scanDates = {};
    document.querySelectorAll('.history-table tr').forEach((row, index) => {
        if (index > 0) {
            const dateCell = row.cells[3];
            if (dateCell) {
                const dateStr = dateCell.textContent.trim();
                const date = new Date(dateStr);
                if (!isNaN(date)) {
                    const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    scanDates[dateKey] = (scanDates[dateKey] || 0) + 1;
                }
            }
        }
    });

    const dates = Object.keys(scanDates).length > 0
        ? Object.keys(scanDates)
        : Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

    const counts = Object.keys(scanDates).length > 0
        ? dates.map(date => scanDates[date] || 0)
        : Array.from({ length: 7 }, () => Math.floor(Math.random() * 5) + 1);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Scans per Day',
                data: counts,
                borderColor: '#3498db', // Bright blue line
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderWidth: 3,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#3498db',
                pointRadius: 5,
                pointHoverRadius: 8,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#2c3e50' } } },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#ecf0f1' },
                    ticks: { color: '#2c3e50' }
                },
                x: {
                    grid: { color: '#ecf0f1' },
                    ticks: { color: '#2c3e50' }
                }
            }
        }
    });
}


    // ✅ Notifications (still available for other actions)
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
            top: 20px; right: 20px;
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

        setTimeout(() => notification.style.transform = 'translateX(0)', 10);
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
});
