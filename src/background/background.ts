chrome.runtime.onInstalled.addListener(() => {
    console.log('Voice Assistant Extension installed')
  })
  //@ts-ignore
  chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
    chrome.action.openPopup()
  })
  chrome.runtime.onMessage.addListener(
    //@ts-ignore
    (request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
      if (request.action === 'background-task') {
        console.log('Background task:', request)
      }
      return true
    }
  )