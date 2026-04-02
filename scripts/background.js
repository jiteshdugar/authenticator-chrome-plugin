/**
 * Background Service Worker
 * Handles tab capture and QR scanning signals
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scan_qr') {
    // Capture the visible area of the currently active tab
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: 'Failed to capture tab. Make sure you are on a web page.' });
        return;
      }
      
      // We send the image back to the popup to decode because Service Workers
      // don't have easy access to Canvas/DOM for decoding images.
      decodeQR(dataUrl).then(result => {
        sendResponse(result);
      });
    });
    return true; // Keep message channel open for async response
  }
});

/**
 * Offscreen decoding (in V3, we can use an offscreen document if needed, 
 * but for simplicity we'll try to do it in the popup first. 
 * If the popup closes, the scan fails, but usually the popup is open.)
 * 
 * Actually, the popup is calling this, so it's better to let the popup 
 * handle the dataUrl directly.
 */
async function decodeQR(dataUrl) {
  // This function is just a placeholder here. 
  // The actual decoding logic is moved to popup.js for DOM access.
  return { success: true, dataUrl: dataUrl };
}
