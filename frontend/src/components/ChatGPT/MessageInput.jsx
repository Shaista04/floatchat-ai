import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Smile, Plus } from "lucide-react";
import { COLORS } from "../../constants/theme";

/**
 * MessageInput Component
 * Input field with voice dictation, emoji support, and auto-resizing textarea
 */
const MessageInput = ({ onSendMessage, isTyping, disabled }) => {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = true;
      recog.lang = "en-US";

      recog.onresult = (event) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setMessage(currentTranscript);
      };

      recog.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recog.onend = () => {
        setIsRecording(false);
      };

      setRecognition(recog);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isTyping) {
      onSendMessage(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e) => {
    setMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  const toggleRecording = () => {
    if (!recognition) {
      alert(
        "Voice recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.",
      );
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      setMessage("");
      recognition.start();
      setIsRecording(true);
    }
  };

  return (
    <div
      style={{
        background: "#f3f4f6",
        borderTop: `1px solid ${COLORS.border}`,
        padding: "16px",
        position: "relative",
        zIndex: 20,
      }}
    >
      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "12px",
          maxWidth: "1280px",
          margin: "0 auto",
        }}
      >
        {/* Text Input */}
        <div style={{ flex: 1, position: "relative" }}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            placeholder="Ask anything about oceanographic data or ARGO floats (Voice mode available)..."
            disabled={disabled}
            style={{
              width: "100%",
              padding: "12px 16px",
              paddingRight: "40px",
              border: `2px solid ${COLORS.border}`,
              borderRadius: "16px",
              resize: "none",
              minHeight: "56px",
              maxHeight: "120px",
              backgroundColor: "white",
              color: COLORS.textDark,
              fontSize: "1rem",
              fontWeight: 500,
              fontFamily: "inherit",
              transition: "all 0.3s ease",
              boxSizing: "border-box",
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? "not-allowed" : "text",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = COLORS.primary;
              e.target.style.boxShadow = `0 0 0 3px ${COLORS.primary}20`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = COLORS.border;
              e.target.style.boxShadow = "none";
            }}
            rows={1}
          />

          {/* Emoji Button */}
          <button
            type="button"
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              padding: "8px",
              color: COLORS.textLight,
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.target.style.color = COLORS.primary)}
            onMouseLeave={(e) => (e.target.style.color = COLORS.textLight)}
          >
            <Smile style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Microphone Button */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={disabled}
            style={{
              padding: "12px",
              borderRadius: "12px",
              border: isRecording ? "none" : `2px solid ${COLORS.border}`,
              background: isRecording ? "#ef4444" : "#ffffff",
              color: isRecording ? "white" : COLORS.textLight,
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
              opacity: disabled ? 0.5 : 1,
              boxShadow: isRecording
                ? "0 4px 12px rgba(239, 68, 68, 0.4)"
                : "none",
            }}
            onMouseEnter={(e) => {
              if (!disabled && !isRecording) {
                e.currentTarget.style.color = COLORS.primary;
                e.currentTarget.style.borderColor = COLORS.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled && !isRecording) {
                e.currentTarget.style.color = COLORS.textLight;
                e.currentTarget.style.borderColor = COLORS.border;
              }
            }}
            title={isRecording ? "Stop Recording" : "Start Voice Dictation"}
          >
            {isRecording ? (
              <MicOff style={{ width: 20, height: 20 }} />
            ) : (
              <Mic style={{ width: 20, height: 20 }} />
            )}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!message.trim() || disabled || isTyping}
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              border: "none",
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
              color: "white",
              cursor:
                !message.trim() || disabled || isTyping
                  ? "not-allowed"
                  : "pointer",
              transition: "all 0.3s ease",
              opacity: !message.trim() || disabled || isTyping ? 0.5 : 1,
              boxShadow: "0 4px 12px rgba(20, 184, 166, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontWeight: 600,
            }}
          >
            {isTyping ? (
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  border: "2px solid white",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                }}
              />
            ) : (
              <Send style={{ width: 18, height: 18 }} />
            )}
          </button>
        </div>
      </form>

      {/* Input Hints */}
      <div
        style={{
          marginTop: "12px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.8rem",
          color: COLORS.textMuted,
          maxWidth: "1280px",
          margin: "12px auto 0",
          paddingLeft: "8px",
        }}
      >
        <div style={{ display: "flex", gap: "20px", fontFamily: "monospace" }}>
          <span>[Enter] to send</span>
          <span>[Shift+Enter] for new line</span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MessageInput;
