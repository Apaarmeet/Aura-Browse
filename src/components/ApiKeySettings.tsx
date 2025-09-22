import React, { useState, useEffect } from "react";
import { Settings } from "lucide-react";

const ApiKeySettings: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load the API key when component mounts
    chrome.storage.sync.get(["geminiApiKey"], (result) => {
      if (result.geminiApiKey) {
        setApiKey(result.geminiApiKey);
      }
    });
  }, []);

  const handleSave = () => {
    chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Settings size={20} />
      </button>
    );
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full bg-white p-5 z-10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Settings</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gemini API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API key"
            className="w-full p-2 border rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            Get your API key from{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600"
            >
              Google AI Studio
            </a>
          </p>
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-2 px-4 rounded-md transition-colors ${
            saved
              ? "bg-green-500 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          {saved ? "Saved!" : "Save API Key"}
        </button>
      </div>
    </div>
  );
};

export default ApiKeySettings;
