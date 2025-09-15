document.addEventListener('DOMContentLoaded', function() {
  const urlInput = document.getElementById('urlInput');
  const scanBtn = document.getElementById('scanBtn');
  const resultDiv = document.getElementById('result');
  
  // Try to get current tab URL when popup opens
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].url) {
      const currentUrl = tabs[0].url;
      if (currentUrl.startsWith('http')) {
        urlInput.value = currentUrl;
      }
    }
  });

  scanBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
      showResult('⚠️ Please enter a URL.', 'error');
      return;
    }
    
    // Validate URL format
    if (!isValidUrl(url)) {
      showResult('❌ Please enter a valid URL (e.g., https://example.com)', 'error');
      return;
    }
    
    // Show loading state
    setLoadingState(true);
    showResult('Scanning...', 'loading');
    
    try {
      const response = await fetch('http://localhost:5000/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different status responses
      switch(data.status) {
        case 'safe':
          showResult('✅ This URL appears to be safe', 'safe');
          break;
        case 'suspicious':
          showResult('⚠️ This URL shows suspicious characteristics', 'suspicious');
          break;
        case 'dangerous':
          showResult('🚨 WARNING: This URL is potentially dangerous', 'dangerous');
          break;
        default:
          showResult('❓ Unknown result from server', 'error');
      }
      
      // Store scan result in local storage for history
      storeScanResult(url, data.status);
      
    } catch (err) {
      console.error('Scan error:', err);
      if (err.message.includes('Failed to fetch')) {
        showResult('❌ Could not connect to PhishSCAN backend. Make sure it\'s running on localhost:5000', 'error');
      } else {
        showResult('❌ Error scanning URL: ' + err.message, 'error');
      }
    } finally {
      setLoadingState(false);
    }
  });

  // Enter key to trigger scan
  urlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      scanBtn.click();
    }
  });

  function showResult(message, type) {
    resultDiv.textContent = message;
    resultDiv.className = 'result ' + type;
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      scanBtn.classList.add('is-loading');
      scanBtn.disabled = true;
    } else {
      scanBtn.classList.remove('is-loading');
      scanBtn.disabled = false;
    }
  }

  function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  function storeScanResult(url, status) {
    chrome.storage.local.get(['scanHistory'], function(result) {
      const history = result.scanHistory || [];
      history.unshift({
        url: url,
        status: status,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 50 scans
      const limitedHistory = history.slice(0, 50);
      
      chrome.storage.local.set({scanHistory: limitedHistory});
    });
  }
});