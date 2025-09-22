import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader } from "lucide-react";
import { processVoiceCommand } from "../utils/aiProcessor";
import { VoiceCommand, RecordingState } from "../types/index";
// import { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "dom-speech-recognition"

const VoiceAssistant: React.FC = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [response, setResponse] = useState<string>("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Initialize speech recognition
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onstart = () => {
        setRecordingState("recording");
      };

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript + interimTranscript);

        // Reset silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        silenceTimerRef.current = setTimeout(() => {
          if (finalTranscript.trim()) {
            stopRecording();
            processCommand(finalTranscript);
          }
        }, 2500); // 2.5 seconds of silence
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        setRecordingState("idle");
      };

      recognitionRef.current.onend = () => {
        setRecordingState("idle");
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const startRecording = (): void => {
    if (recognitionRef.current && recordingState === "idle") {
      setTranscript("");
      setResponse("");
      recognitionRef.current.start();
    }
  };

  const stopRecording = (): void => {
    if (recognitionRef.current && recordingState === "recording") {
      recognitionRef.current.stop();
    }
  };

  const processCommand = async (command: string): Promise<void> => {
    setRecordingState("processing");
    try {
      const result: VoiceCommand = await processVoiceCommand(command);
      setResponse(result.response);

      // Send command to content script for execution
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]?.id) {
        try {
          const tab = tabs[0];
          const isNewTab =
            tab.url?.startsWith("chrome://newtab") ||
            tab.url?.startsWith("about:blank") ||
            !tab.url;

          // If it's a navigation command and we're on a new tab, handle it directly
          if (
            isNewTab &&
            (result.action === "navigate" ||
              result.action === "google_search" ||
              result.action === "play_youtube")
          ) {
            let targetUrl = "";
            if (result.action === "navigate") {
              targetUrl = result.parameters.url as string;
            } else if (result.action === "google_search") {
              targetUrl = `https://www.google.com/search?q=${encodeURIComponent(
                result.parameters.query as string
              )}`;
            } else if (result.action === "play_youtube") {
              targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
                result.parameters.query as string
              )}`;
            }

            if (targetUrl) {
              chrome.tabs.update(tab.id, { url: targetUrl });
              return;
            }
          }

          // For non-new tabs or non-navigation commands, use content script
          chrome.tabs.sendMessage(
            tabs[0].id,
            { action: "ping" },
            async (response) => {
              const injectAndExecute = async () => {
                console.log("Injecting content script...");
                await chrome.scripting.executeScript({
                  target: { tabId: tabs[0].id! },
                  files: ["assets/content-script.ts-NchQzKUU.js"],
                });

                // Wait a bit for the content script to initialize
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabs[0].id!, {
                    action: "executeCommand",
                    command: result.action,
                    parameters: result.parameters,
                  });
                }, 500);
              };

              if (chrome.runtime.lastError || !response) {
                await injectAndExecute();
              } else {
                // Content script is ready, send the command
                chrome.tabs.sendMessage(tabs[0].id!, {
                  action: "executeCommand",
                  command: result.action,
                  parameters: result.parameters,
                });
              }
            }
          );
        } catch (error) {
          console.error("Error sending message to content script:", error);
          setResponse("Sorry, I had trouble communicating with the page.");
        }
      }
    } catch (error) {
      console.error("Error processing command:", error);
      setResponse("Sorry, I encountered an error processing your command.");
    } finally {
      setRecordingState("idle");
    }
  };

  const toggleRecording = (): void => {
    if (recordingState === "recording") {
      stopRecording();
    } else if (recordingState === "idle") {
      startRecording();
    }
  };

  const getMicButtonClasses = (): string => {
    const baseClasses =
      "w-16 h-16 rounded-full border-none text-white cursor-pointer flex items-center justify-center transition-all duration-300 shadow-lg hover:scale-105";

    switch (recordingState) {
      case "recording":
        return `${baseClasses} bg-red-500 mic-button-pulse`;
      case "processing":
        return `${baseClasses} bg-yellow-500 cursor-not-allowed`;
      default:
        return `${baseClasses} bg-blue-500 hover:bg-blue-600`;
    }
  };

  return (
    <div className="w-80 min-h-96 p-5 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-5">
        <h2 className="text-xl font-semibold text-gray-800 m-0">
          Voice Assistant
        </h2>
      </div>

      <div className="flex justify-center my-5">
        <button
          className={getMicButtonClasses()}
          onClick={toggleRecording}
          disabled={recordingState === "processing"}
        >
          {recordingState === "processing" ? (
            <Loader className="animate-spin" size={24} />
          ) : recordingState === "recording" ? (
            <MicOff size={24} />
          ) : (
            <Mic size={24} />
          )}
        </button>
      </div>

      {transcript && (
        <div className="bg-gray-50 p-3 rounded-md my-4 border-l-4 border-blue-500">
          <p className="m-0 text-sm">
            <strong className="text-gray-700">You said:</strong>
            <span className="ml-2 text-gray-600">{transcript}</span>
          </p>
        </div>
      )}

      {response && (
        <div className="bg-green-50 p-3 rounded-md my-4 border-l-4 border-green-500">
          <p className="m-0 text-sm">
            <strong className="text-gray-700">Assistant:</strong>
            <span className="ml-2 text-gray-600">{response}</span>
          </p>
        </div>
      )}

      <div className="mt-5 text-xs text-gray-600">
        <p className="my-2">
          Click the microphone and speak your command. I'll stop listening after
          2.5 seconds of silence.
        </p>
        <p className="my-2 font-medium">Examples:</p>
        <ul className="my-2 pl-5 space-y-1">
          <li className="text-gray-500">"Open YouTube and play Karan Aujla"</li>
          <li className="text-gray-500">
            "Navigate to Google and search for weather"
          </li>
          <li className="text-gray-500">"Scroll down the page"</li>
          <li className="text-gray-500">"Click the first link"</li>
        </ul>
      </div>
    </div>
  );
};

export default VoiceAssistant;
