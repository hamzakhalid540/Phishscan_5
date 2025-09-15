// Background script for PhishScan extension
// Currently minimal as most functionality is in popup

chrome.runtime.onInstalled.addListener(() => {
  console.log('PhishScan extension installed');
});

// Optional: Add context menu item for scanning URLs
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "scan-url",
    title: "Scan with PhishScan",
    contexts: ["page", "link"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "scan-url") {
    if (info.linkUrl) {
      // Scan linked URL
      chrome.tabs.create({ url: `http://localhost:5000/scanner?url=${encodeURIComponent(info.linkUrl)}` });
    } else if (info.pageUrl) {
      // Scan current page URL
      chrome.tabs.create({ url: `http://localhost:5000/scanner?url=${encodeURIComponent(info.pageUrl)}` });
    }
  }
});