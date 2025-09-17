import { ChromeMessage, VoiceCommand } from '../types'

console.log("✅ Content script loaded on", window.location.href);
//@ts-ignore
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📩 Got message in content script:", msg);
  sendResponse({ ok: true });
});

class BrowserAutomation {
  constructor() {
    this.setupMessageListener()
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      //@ts-ignore
      (request: ChromeMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
        if (request.action === 'executeCommand' && request.command && request.parameters) {
          this.executeCommand(request.command, request.parameters)
          sendResponse({ success: true })
        }
        return true
      }
    )
  }

  private async executeCommand(action: string, parameters: VoiceCommand['parameters']): Promise<void> {
    try {
      switch (action) {
        case 'navigate':
          if (parameters.url) {
            window.location.href = parameters.url
          }
          break
          
        case 'search':
          if (parameters.query) {
            this.performSearch(parameters.query)
          }
          break
          
        case 'click':
          this.clickElement(parameters.selector)
          break
          
        case 'scroll':
          this.scrollPage(parameters.direction || 'down')
          break
          
        case 'type':
          if (parameters.text) {
            this.typeText(parameters.selector, parameters.text)
          }
          break
          
        case 'play_youtube':
          if (parameters.query) {
            this.playYouTube(parameters.query)
          }
          break
          
        default:
          console.log('Unknown action:', action)
      }
    } catch (error) {
      console.error('Error executing command:', error)
    }
  }

  private performSearch(query: string): void {
    const searchInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="search"], input[name*="search"], input[placeholder*="search" i], #search, .search-input'
    )
    
    if (searchInputs.length > 0) {
      const searchInput = searchInputs[0]
      searchInput.focus()
      searchInput.value = query
      
      const form = searchInput.closest('form')
      if (form) {
        form.submit()
      } else {
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
        searchInput.dispatchEvent(enterEvent)
      }
    } else {
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    }
  }

  private clickElement(selector?: string): void {
    let element: HTMLElement | null = null
    
    if (selector) {
      element = document.querySelector<HTMLElement>(selector)
    } else {
      element = document.querySelector<HTMLElement>('a, button, [role="button"]')
    }
    
    if (element) {
      element.click()
    }
  }

  private scrollPage(direction: 'up' | 'down'): void {
    const scrollAmount = window.innerHeight * 0.8
    
    if (direction === 'down') {
      window.scrollBy(0, scrollAmount)
    } else if (direction === 'up') {
      window.scrollBy(0, -scrollAmount)
    }
  }

  private typeText(selector: string | undefined, text: string): void {
    const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      selector || 'input, textarea'
    )
    
    if (element) {
      element.focus()
      element.value = text
      const inputEvent = new Event('input', { bubbles: true })
      element.dispatchEvent(inputEvent)
    }
  }

  private async playYouTube(query: string): Promise<void> {
    if (!window.location.hostname.includes('youtube.com')) {
      window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
      return
    }

    const searchBox = document.querySelector<HTMLInputElement>('#search, input#search')
    if (searchBox) {
      searchBox.focus()
      searchBox.value = query
      
      const searchButton = document.querySelector<HTMLButtonElement>(
        '#search-icon-legacy, button[aria-label*="Search"]'
      )
      
      if (searchButton) {
        searchButton.click()
      } else {
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
        searchBox.dispatchEvent(enterEvent)
      }
      
      setTimeout(() => {
        const firstVideo = document.querySelector<HTMLAnchorElement>(
          'a#video-title, .ytd-video-renderer a'
        )
        if (firstVideo) {
          firstVideo.click()
        }
      }, 2000)
    }
  }
}

// Initialize the automation system
new BrowserAutomation()