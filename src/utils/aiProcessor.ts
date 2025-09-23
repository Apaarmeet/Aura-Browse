import { GoogleGenerativeAI } from "@google/generative-ai";
import { VoiceCommand } from "../types/index";

async function getApiKey(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["geminiApiKey"], (result) => {
      if (result.geminiApiKey) {
        resolve(result.geminiApiKey);
      } else {
        reject(
          new Error(
            "No API key found. Please add your Gemini API key in the settings."
          )
        );
      }
    });
  });
}

export async function processVoiceCommand(
  transcript: string
): Promise<VoiceCommand> {
  try {
    const apiKey = await getApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
    You are a browser automation assistant. Analyze the user's voice command and return a JSON response with the action to take and parameters.

    Available actions:
    - navigate: Go to a specific URL
    - search: Search on current page or search engine
    - click: Click an element with support for numbered items (e.g., "click the 3rd link" or "click the second video")
    - scroll: Scroll the page
    - type: Type text into an input field
    - play_youtube: Search and play content on YouTube
    - google_search: Search on Google
    
    Special handling:
    YouTube commands:
    - If command contains "open youtube and play X" or "play X on youtube" → use "play_youtube" action
    - If command is just "play X" while already on YouTube → use "play_youtube" action
    - If command is just "open youtube" → use "navigate" action with youtube.com URL

    Numbered selections:
    - For "click the Nth video/link" → use "click" action with index=N
    - Convert ordinal numbers to cardinal (e.g., "third" → 3, "first" → 1)

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
    - "click the third video" → {"action": "click", "parameters": {"index": 3}, "response": "Clicking the third video"}
    - "click the 2nd link" → {"action": "click", "parameters": {"index": 2}, "response": "Clicking the second link"}
    - "play mrwhosetheboss" → {"action": "play_youtube", "parameters": {"query": "mrwhosetheboss"}, "response": "Searching for MrWhoseTheBoss on YouTube"}
    - "open youtube" → {"action": "navigate", "parameters": {"url": "https://youtube.com"}, "response": "Opening YouTube"}
    - "scroll down" → {"action": "scroll", "parameters": {"direction": "down"}, "response": "Scrolling down the page"}
    - "google who is elon musk" → {"action": "google_search", "parameters": {"query": "who is elon musk"}, "response": "Searching Google for information about Elon Musk"}

    IMPORTANT:
    - Return ONLY raw JSON (no markdown, no code block, no extra text)
    - For YouTube commands, check if it's "open and play", "play on youtube", or just "play" when already on YouTube
    - Always include a friendly, descriptive response
    
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log("AI raw response", text);

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as VoiceCommand;
      return parsed;
    }

    throw new Error("Invalid response format");
  } catch (error) {
    console.error("AI processing error:", error);

    // Provide specific message for missing API key
    if (error instanceof Error && error.message.includes("No API key found")) {
      return {
        action: "none",
        parameters: {},
        response:
          "Please add your Gemini API key in the settings (click the gear icon).",
      };
    }

    return {
      action: "none",
      parameters: {},
      response: "Sorry, I could not understand your command.",
    };
  }
}
