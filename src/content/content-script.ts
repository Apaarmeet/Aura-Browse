import { VoiceCommand } from "../types";

// Ensure we're not double-initializing
if (!(window as any).__voiceAssistantInitialized) {
  (window as any).__voiceAssistantInitialized = true;
  console.log("✅ Content script loaded on", window.location.href);
}

class BrowserAutomation {
  constructor() {
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    let lastProcessedCommand: string | null = null;

    chrome.runtime.onMessage.addListener(
      //@ts-ignore
      (
        request: any,
        //@ts-ignore
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: any) => void
      ) => {
        // Generate a command ID to prevent duplicate processing
        const commandId = JSON.stringify(request);
        if (commandId === lastProcessedCommand) {
          console.log("Skipping duplicate command");
          sendResponse({ status: "skipped" });
          return true;
        }
        lastProcessedCommand = commandId;

        console.log("📩 Got message in content script:", request);

        try {
          // Handle ping messages
          if (request.action === "ping") {
            sendResponse({ status: "alive" });
            return true;
          }

          // Handle execute command messages
          if (
            request.action === "executeCommand" &&
            request.command &&
            request.parameters
          ) {
            console.log(
              "Executing command:",
              request.command,
              "with parameters:",
              request.parameters
            );

            // Execute command and handle navigation properly
            this.executeCommand(request.command, request.parameters)
              .then(() => {
                sendResponse({ success: true });
              })
              .catch((error) => {
                console.error("Command execution failed:", error);
                sendResponse({ success: false, error: error.message });
              });

            return true; // Keep the message channel open for the async response
          }

          sendResponse({ status: "unknown_command" });
        } catch (error) {
          console.error("Error handling message:", error);
          sendResponse({ status: "error", error: error});
        }

        return true;
      }
    );
  }

  private async executeCommand(
    action: string,
    parameters: VoiceCommand["parameters"]
  ): Promise<void> {
    try {
      // Check if we're already processing a navigation command
      if ((window as any).__processingNavigation) {
        console.log("Navigation already in progress, skipping command");
        return;
      }

      switch (action) {
        case "navigate":
          if (parameters.url) {
            (window as any).__processingNavigation = true;
            await this.navigateToUrl(parameters.url);
          }
          break;

        case "search":
          if (parameters.query) {
            (window as any).__processingNavigation = true;
            await this.performSearch(parameters.query);
          }
          break;

        case "click":
          this.clickElement(parameters.selector);
          break;

        case "scroll":
          this.scrollPage(parameters.direction || "down");
          break;

        case "type":
          if (parameters.text) {
            this.typeText(parameters.selector, parameters.text);
          }
          break;

        case "play_youtube":
          if (parameters.query) {
            this.handleYouTubePlayback(parameters.query);
          }
          break;

        case "google_search":
          if (parameters.query) {
            this.performGoogleSearch(parameters.query);
          }
          break;

        default:
          console.log("❓ Unknown action:", action, parameters);
      }
    } catch (error) {
      console.error("❌ Error executing command:", error);
    }
  }

  private performSearch(query: string): void {
    const searchInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="search"], input[name*="search"], input[placeholder*="search" i], #search, .search-input'
    );

    if (searchInputs.length > 0) {
      const searchInput = searchInputs[0];
      searchInput.focus();
      searchInput.value = query;

      // Fire React-style updates too
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));

      const form = searchInput.closest("form");
      if (form) {
        form.submit();
      } else {
        const enterEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
        });
        searchInput.dispatchEvent(enterEvent);
      }
    } else {
      // fallback: use Google
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(
        query
      )}`;
    }
  }

  private clickElement(selector?: string): void {
    let element: HTMLElement | null = null;

    if (selector) {
      element = document.querySelector<HTMLElement>(selector);
    } else {
      element = document.querySelector<HTMLElement>(
        'a, button, [role="button"]'
      );
    }

    if (element) {
      element.click();
    }
  }

  private scrollPage(direction: "up" | "down"): void {
    const scrollAmount = window.innerHeight * 0.8;

    if (direction === "down") {
      window.scrollBy(0, scrollAmount);
    } else if (direction === "up") {
      window.scrollBy(0, -scrollAmount);
    }
  }

  private typeText(selector: string | undefined, text: string): void {
    const element = document.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(selector || "input, textarea");

    if (element) {
      element.focus();
      element.value = text;
      const inputEvent = new Event("input", { bubbles: true });
      element.dispatchEvent(inputEvent);
    }
  }

  private handleYouTubePlayback(query: string): void {
    // Check if we're on YouTube
    if (window.location.hostname.includes("youtube.com")) {
      // Find and use the YouTube search box
      const searchInput = document.querySelector<HTMLInputElement>(
        "input#search, ytd-searchbox input"
      );
      if (searchInput) {
        searchInput.focus();
        searchInput.value = query;

        // Trigger input events
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        searchInput.dispatchEvent(new Event("change", { bubbles: true }));

        // Find and click the search button
        const searchButton = document.querySelector<HTMLElement>(
          "button#search-icon-legacy, ytd-searchbox button#search-button"
        );
        if (searchButton) {
          searchButton.click();

          // After search, wait for results and click the first video
          setTimeout(() => {
            const firstVideo = document.querySelector<HTMLElement>(
              "ytd-video-renderer #video-title, ytd-video-renderer .title-and-badge a"
            );
            if (firstVideo) {
              firstVideo.click();
            }
          }, 2000); // Wait 2 seconds for results to load
        }
      }
    } else {
      // If not on YouTube, navigate to YouTube with search query
      window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`;
    }
  }

  private performGoogleSearch(query: string): Promise<void> {
    console.log("Performing Google search for:", query);
    return this.navigateToUrl(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`
    );
  }

  private navigateToUrl(url: string): Promise<void> {
    return new Promise((resolve) => {
      // Clean up any previous navigation flags
      (window as any).__processingNavigation = false;

      // Use chrome.tabs API for navigation instead of window.location
      chrome.runtime.sendMessage(
        {
          action: "navigateTab",
          url: url,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error("Navigation failed:", chrome.runtime.lastError);
          }
          resolve();
        }
      );
    });
  }
}

// Initialize the automation system only if not already initialized
if (!(window as any).__automationInitialized) {
  (window as any).__automationInitialized = true;
  new BrowserAutomation();
}
new BrowserAutomation();
