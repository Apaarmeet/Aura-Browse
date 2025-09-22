chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Voice Assistant Extension installed");
});

// Listen for tab updates to inject content script into new tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url?.startsWith("chrome://newtab")
  ) {
    chrome.scripting
      .executeScript({
        target: { tabId },
        files: ["assets/content-script.ts-hYyCZ8gQ.js"],
      })
      .catch((err) => console.error("Failed to inject content script:", err));
  }
});

// Open popup when extension icon is clicked
// @ts-ignore
chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
  chrome.action.openPopup();
});

// Message listener
chrome.runtime.onMessage.addListener(
  // @ts-ignore
  (
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ) => {
    console.log("📩 Background got message:", request);

    // Handle direct navigation requests
    if (request.action === "navigateTab") {
      const tabId = sender.tab?.id;
      if (!tabId) {
        console.error("No tab ID available for navigation");
        sendResponse({ success: false });
        return true;
      }

      console.log(`🌐 Navigating tab ${tabId} to ${request.url}`);
      chrome.tabs.update(tabId, { url: request.url }, () => {
        if (chrome.runtime.lastError) {
          console.error("Navigation failed:", chrome.runtime.lastError);
          sendResponse({ success: false });
        } else {
          sendResponse({ success: true });
        }
      });
      return true;
    }

    // Case 1: Background-task (your existing code)
    if (request.action === "background-task") {
      console.log("Background task:", request);
    }

    // Case 2: Handle "navigateAndThen"
    if (request.action === "navigateAndThen") {
      const { url, nextCommand } = request;
      const tabId = sender.tab?.id;

      // Ensure content script is injected after navigation
      chrome.tabs.onUpdated.addListener(function listener(
        updatedTabId,
        changeInfo
      ) {
        if (updatedTabId === tabId && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);

          // Inject content script
          chrome.scripting
            .executeScript({
              target: { tabId: updatedTabId },
              files: ["assets/content-script.ts-hYyCZ8gQ.js"],
            })
            .then(() => {
              // Send the command after ensuring content script is loaded
              if (nextCommand) {
                setTimeout(() => {
                  chrome.tabs.sendMessage(updatedTabId, nextCommand, () => {
                    if (chrome.runtime.lastError) {
                      console.error(
                        "Error sending message:",
                        chrome.runtime.lastError
                      );
                    }
                  });
                }, 500); // Small delay to ensure content script is initialized
              }
            });
        }
      });

      if (!tabId) {
        console.warn("⚠️ No tab ID available for navigation");
        sendResponse({ success: false });
        return true;
      }

      console.log(`🌐 Navigating to ${url} and then executing next command`);

      // Step 1: Navigate
      chrome.tabs.update(tabId, { url });

      // Step 2: Wait until the new page is loaded
      const listener = (details: any) => {
        if (details.tabId === tabId && details.frameId === 0) {
          console.log("✅ Navigation complete, injecting content script");

          // Re-inject content script
          chrome.scripting.executeScript(
            {
              target: { tabId },
              files: ["assets/content-script.ts-hYyCZ8gQ.js"], // your built content script
            },
            () => {
              console.log("📩 Sending queued command:", nextCommand);

              // Send the next command
              chrome.tabs.sendMessage(tabId, nextCommand);
            }
          );

          // Remove this listener after it fires once
          chrome.webNavigation.onCompleted.removeListener(listener);
        }
      };

      chrome.webNavigation.onCompleted.addListener(listener);

      sendResponse({ success: true });
    }

    return true; // keep channel open
  }
);
