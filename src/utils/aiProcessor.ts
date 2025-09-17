import { GoogleGenerativeAI } from '@google/generative-ai'
import { VoiceCommand } from '../types/index'

const API_KEY = 'API_KEY' // Replace with your actual API key
const genAI = new GoogleGenerativeAI(API_KEY)

export async function processVoiceCommand(transcript: string): Promise<VoiceCommand> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
    
    const prompt = `
    You are a browser automation assistant. Analyze the user's voice command and return a JSON response with the action to take and parameters.

    Available actions:
    - navigate: Go to a specific URL
    - search: Search on current page or search engine
    - click: Click an element
    - scroll: Scroll the page
    - type: Type text into an input field
    - play_youtube: Open YouTube and search for content

    User command: "${transcript}"

    Return only a JSON object with this structure:
    {
      "action": "action_name",
      "parameters": {
        "url": "if needed",
        "query": "if needed",
        "selector": "if needed",
        "text": "if needed",
        "direction": "if needed (up or down)"
      },
      "response": "A friendly response to the user"
    }

    Examples:
    - "open youtube and play karan aujla" → {"action": "play_youtube", "parameters": {"query": "karan aujla"}, "response": "Opening YouTube and searching for Karan Aujla"}
    - "scroll down" → {"action": "scroll", "parameters": {"direction": "down"}, "response": "Scrolling down the page"}

    IMPORTANT:
    - Return ONLY raw JSON (no markdown, no code block, no extra text).
    - If user says "open youtube", treat it as {"action":"navigate","parameters":{"url":"https://youtube.com"}}
    
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    console.log("AI raw response", text)
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as VoiceCommand
      return parsed
    }
    
    throw new Error('Invalid response format')
  } catch (error) {
    console.error('AI processing error:', error)
    return {
      action: 'none',
      parameters: {},
      response: 'Sorry, I could not understand your command.'
    }
  }
}
