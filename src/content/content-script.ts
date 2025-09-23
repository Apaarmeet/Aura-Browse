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
          sendResponse({ status: "error", error: error });
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

        case "go_back":
          await this.navigateHistory("back");
          break;

        case "go_forward":
          await this.navigateHistory("forward");
          break;

        case "search":
          if (parameters.query) {
            (window as any).__processingNavigation = true;
            await this.performSearch(parameters.query);
          }
          break;

        case "click":
          await this.clickElement(
            parameters.selector,
            parameters.index as number
          );
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

  private async clickElement(selector?: string, index?: number): Promise<void> {
    console.log("Clicking element with selector:", selector, "index:", index);

    // Function to wait for elements
    const waitForElements = async (
      selector: string,
      timeout = 5000
    ): Promise<NodeListOf<HTMLElement> | null> => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const elements = document.querySelectorAll<HTMLElement>(selector);
        if (elements && elements.length > 0) return elements;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return null;
    };

    // Function to scroll to and click an element
    const scrollAndClick = async (element: HTMLElement): Promise<void> => {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        element.click();
        console.log("Successfully clicked element");
      } catch (error) {
        console.error("Failed to click element:", error);
      }
    };

    // Special handling for YouTube videos
    if (window.location.hostname.includes("youtube.com")) {
      console.log("Handling YouTube video click");

      // Modern YouTube selectors for various page layouts
      const videoSelectors = [
        // Search results and home page
        "#contents ytd-video-renderer",
        "ytd-rich-item-renderer",
        // Channel page
        "ytd-grid-video-renderer",
        // Playlist page
        "ytd-playlist-video-renderer",
        // Shorts
        "ytd-reel-video-renderer",
        // General video elements
        "[role='article']",
      ];

      for (const videoSelector of videoSelectors) {
        console.log("Trying YouTube selector:", videoSelector);
        const videos = await waitForElements(videoSelector);
        if (videos && videos.length > 0) {
          const targetIndex = index !== undefined ? index - 1 : 0;
          if (targetIndex >= 0 && targetIndex < videos.length) {
            console.log(
              `Found ${videos.length} videos, clicking index ${targetIndex}`
            );
            const videoElement = videos[targetIndex];

            // Try to find the most specific clickable element
            const clickableSelectors = [
              "a#video-title", // Main video title
              "a.yt-simple-endpoint", // General video links
              "a[href*='/watch']", // Video watch links
              "a[href*='/shorts']", // Shorts links
              "h3 a", // Title links
              "a[title]", // Links with titles
            ];

            for (const selector of clickableSelectors) {
              const clickable =
                videoElement.querySelector<HTMLElement>(selector);
              if (clickable && clickable.offsetParent !== null) {
                // Check if element is visible
                console.log("Found clickable element with selector:", selector);
                await scrollAndClick(clickable);
                return;
              }
            }

            // If no specific clickable element found, try clicking the container
            if (videoElement.offsetParent !== null) {
              console.log("Clicking video container element");
              await scrollAndClick(videoElement);
              return;
            }
          }
        }
      }
    }

    // Special handling for Google search results
    else if (window.location.hostname.includes("google.com")) {
      console.log("Handling Google search result click");
      const searchSelectors = [
        "div.g div.yuRUbf > a", // Main search results
        "div.g h3.r > a", // Alternative search results
        "div.rc div.r > a", // Another variation
        "div[jscontroller] a[ping]", // General search results
        "div.g a[ping]", // Another variation
      ];

      for (const searchSelector of searchSelectors) {
        const links = await waitForElements(searchSelector);
        if (links && links.length > 0) {
          const targetIndex = index !== undefined ? index - 1 : 0;
          if (targetIndex >= 0 && targetIndex < links.length) {
            console.log(
              `Found ${links.length} results, clicking index ${targetIndex}`
            );
            await scrollAndClick(links[targetIndex]);
            return;
          }
        }
      }
    }

    // General link handling
    console.log("Falling back to general link handling");
    const linkSelectors = [
      'a[href]:not([aria-hidden="true"]):not([style*="display: none"])',
      'button:not([disabled]):not([style*="display: none"])',
      '[role="button"]:not([disabled]):not([style*="display: none"])',
      '[role="link"]:not([disabled]):not([style*="display: none"])',
    ];

    // Try custom selector first
    if (selector) {
      console.log("Trying custom selector:", selector);
      const elements = await waitForElements(selector);
      if (elements && elements.length > 0) {
        const targetIndex = index !== undefined ? index - 1 : 0;
        if (targetIndex >= 0 && targetIndex < elements.length) {
          console.log(
            `Found ${elements.length} elements with custom selector, clicking index ${targetIndex}`
          );
          await scrollAndClick(elements[targetIndex]);
          return;
        }
      }
    }

    // Try each selector in order
    for (const generalSelector of linkSelectors) {
      console.log("Trying general selector:", generalSelector);
      const elements = await waitForElements(generalSelector);
      if (elements && elements.length > 0) {
        // Filter out hidden elements
        const visibleElements = Array.from(elements).filter((element) => {
          const style = window.getComputedStyle(element);
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0"
          );
        });

        if (visibleElements.length > 0) {
          const targetIndex = index !== undefined ? index - 1 : 0;
          if (targetIndex >= 0 && targetIndex < visibleElements.length) {
            console.log(
              `Found ${visibleElements.length} visible elements, clicking index ${targetIndex}`
            );
            await scrollAndClick(visibleElements[targetIndex] as HTMLElement);
            return;
          }
        }
      }
    }

    console.log("No clickable element found");
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

  private async handleYouTubePlayback(query: string): Promise<void> {
    console.log("Handling YouTube playback for query:", query);

    // Check if we're on YouTube
    if (window.location.hostname.includes("youtube.com")) {
      console.log("Already on YouTube, searching...");

      // Use the search box if we're already on YouTube
      const searchInput =
        document.querySelector<HTMLInputElement>("input#search");
      if (searchInput) {
        searchInput.focus();
        searchInput.value = query;
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));

        // Find and click the search button
        const searchButton = document.querySelector<HTMLButtonElement>(
          "button#search-icon-legacy"
        );
        if (searchButton) {
          searchButton.click();
        } else {
          // Fallback: press enter in the search box
          searchInput.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
          );
        }
      } else {
        // Fallback: direct navigation to search results
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
          query
        )}`;
        await this.navigateToUrl(searchUrl);
      }
    } else {
      // If not on YouTube, navigate to YouTube search results
      console.log("Navigating to YouTube with search query...");
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`;
      await this.navigateToUrl(searchUrl);
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

  private navigateHistory(direction: "back" | "forward"): Promise<void> {
    return new Promise((resolve) => {
      console.log(`Navigating ${direction} in history`);

      chrome.runtime.sendMessage(
        {
          action: "navigateHistory",
          direction: direction,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              "History navigation failed:",
              chrome.runtime.lastError
            );
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
