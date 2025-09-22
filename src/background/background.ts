// Function to get the content script path
async function getContentScriptPath(): Promise<string> {
  return new Promise((resolve) => {
    // Use chrome.runtime.getPackageDirectoryEntry which is available in MV3
    chrome.runtime.getPackageDirectoryEntry((root) => {
      root.getDirectory("assets", {}, (assetsDir) => {
        assetsDir.createReader().readEntries((entries) => {
          const contentScript = entries.find(
            (entry) =>
              entry.name.startsWith("content-script.ts-") &&
              entry.name.endsWith(".js")
          );
          if (contentScript) {
            resolve(`assets/${contentScript.name}`);
          } else {
            console.error("Could not find content script in assets directory");
            resolve(""); // Return empty string if not found
          }
        });
      });
    });
  });
}

// Keep track of the content script path
let contentScriptPath: string | null = null;

chrome.runtime.onInstalled.addListener(async () => {
  console.log("✅ Voice Assistant Extension installed");
  // Get the content script path when the extension is installed
  contentScriptPath = await getContentScriptPath();
  console.log("Content script path:", contentScriptPath);
});

// Listen for tab updates to inject content script into new tabs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url?.startsWith("chrome://newtab")
  ) {
    if (!contentScriptPath) {
      contentScriptPath = await getContentScriptPath();
    }

    if (contentScriptPath) {
      chrome.scripting
        .executeScript({
          target: { tabId },
          files: [contentScriptPath],
        })
        .catch((err) => console.error("Failed to inject content script:", err));
    } else {
      console.error("No content script path available");
    }
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

    // Handle content script injection request
    if (request.action === "injectContentScript" && request.tabId) {
      (async () => {
        if (!contentScriptPath) {
          contentScriptPath = await getContentScriptPath();
        }

        if (contentScriptPath) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: request.tabId },
              files: [contentScriptPath],
            });
            sendResponse({ success: true });
          } catch (err) {
            console.error("Failed to inject content script:", err);
            sendResponse({ success: false, error:err });
          }
        }
      })();
      return true;
    }

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
          (async () => {
            if (!contentScriptPath) {
              contentScriptPath = await getContentScriptPath();
            }

            if (contentScriptPath) {
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: updatedTabId },
                  files: [contentScriptPath],
                });

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
              } catch (err) {
                console.error("Failed to inject content script:", err);
              }
            }
          })();
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
          (async () => {
            if (!contentScriptPath) {
              contentScriptPath = await getContentScriptPath();
            }

            if (contentScriptPath) {
              try {
                await chrome.scripting.executeScript({
                  target: { tabId },
                  files: [contentScriptPath],
                });

                console.log("📩 Sending queued command:", nextCommand);

                // Send the next command
                chrome.tabs.sendMessage(tabId, nextCommand);
              } catch (err) {
                console.error("Failed to inject content script:", err);
              }
            }
          })();

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
