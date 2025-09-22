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
    - click: Click an element
    - scroll: Scroll the page
    - type: Type text into an input field
    - play_youtube: Open YouTube and search for content
    - google_search: Search on Google (use this when user explicitly mentions Google)

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
    - "search about trump on google" → {"action": "google_search", "parameters": {"query": "trump"}, "response": "Searching Google for Trump"}
    - "google who is elon musk" → {"action": "google_search", "parameters": {"query": "who is elon musk"}, "response": "Searching Google for information about Elon Musk"}

    IMPORTANT:
    - Return ONLY raw JSON (no markdown, no code block, no extra text).
    - If user says "open youtube", treat it as {"action":"navigate","parameters":{"url":"https://youtube.com"}}
    
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
