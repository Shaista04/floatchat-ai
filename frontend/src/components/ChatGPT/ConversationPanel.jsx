import React, { useEffect, useRef } from "react";
import { User, Bot, Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import MessageDisplay from "./MessageDisplay";
import { COLORS } from "../../constants/theme";

/**
 * ConversationPanel Component
 * Main chat conversation display area with messages and auto-scroll
 */
const ConversationPanel = ({ chatId, messages, isTyping }) => {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "--:--";
    }
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
  };

  // Empty state when no chat selected
  if (!chatId) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.background,
          overflow: "hidden",
          paddingTop: 64,
        }}
      >
        <div
          style={{ textAlign: "center", maxWidth: "500px", padding: "24px" }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 32px",
              boxShadow: `0 10px 30px ${COLORS.primary}30`,
            }}
          >
            <Bot style={{ width: 40, height: 40, color: "white" }} />
          </div>
          <h2
            style={{
              fontSize: "1.8rem",
              fontWeight: 700,
              color: COLORS.textDark,
              marginBottom: "16px",
              lineHeight: 1.2,
            }}
          >
            Indian Ocean Intelligence
          </h2>
          <p
            style={{
              color: COLORS.textLight,
              marginBottom: "40px",
              fontSize: "1rem",
              lineHeight: 1.6,
            }}
          >
            Initialize a secure transmission to begin analyzing subsurface
            telemetry and trajectories across the Indian Ocean array.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: `2px solid ${COLORS.border}`,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLORS.primary;
                e.currentTarget.style.boxShadow = `0 8px 20px ${COLORS.primary}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <h3
                style={{
                  fontWeight: 700,
                  color: COLORS.textDark,
                  marginBottom: "8px",
                }}
              >
                Thermal Mapping
              </h3>
              <p style={{ fontSize: "0.85rem", color: COLORS.textLight }}>
                Identify thermocline anomalies
              </p>
            </div>
            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: `2px solid ${COLORS.border}`,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLORS.primary;
                e.currentTarget.style.boxShadow = `0 8px 20px ${COLORS.primary}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <h3
                style={{
                  fontWeight: 700,
                  color: COLORS.textDark,
                  marginBottom: "8px",
                }}
              >
                Salinity Diffusion
              </h3>
              <p style={{ fontSize: "0.85rem", color: COLORS.textLight }}>
                Analyze PSU gradients
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: COLORS.background,
        overflow: "hidden",
        paddingTop: 64,
      }}
    >
      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          padding: "32px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
          overflowY: "auto",
          overflowX: "hidden",
          scrollBehavior: "smooth",
        }}
      >
        {messages.map((message, index) => (
          <div
            key={message.id || index}
            style={{
              display: "flex",
              justifyContent:
                message.type === "user" ? "flex-end" : "flex-start",
              animation: "fadeIn 0.3s ease-in",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
                maxWidth: "800px",
                flexDirection: message.type === "user" ? "row-reverse" : "row",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background:
                    message.type === "user" ? COLORS.textDark : "white",
                  border:
                    message.type === "user"
                      ? "none"
                      : `2px solid ${COLORS.border}`,
                  color: message.type === "user" ? "white" : COLORS.primary,
                  boxShadow:
                    message.type === "user"
                      ? "0 2px 8px rgba(0,0,0,0.1)"
                      : "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                {message.type === "user" ? (
                  <User style={{ width: 20, height: 20 }} />
                ) : (
                  <Bot style={{ width: 20, height: 20 }} />
                )}
              </div>

              {/* Message Content */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems:
                    message.type === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    borderRadius: "16px",
                    padding: "16px 20px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    background:
                      message.type === "user"
                        ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`
                        : "white",
                    color: message.type === "user" ? "white" : COLORS.textDark,
                    border:
                      message.type === "user"
                        ? "none"
                        : `2px solid ${COLORS.border}`,
                  }}
                >
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.6,
                      fontSize: "0.95rem",
                    }}
                  >
                    {message.content}
                  </div>

                  {/* Code Block */}
                  {message.hasCode &&
                    (!message.tool_result ||
                      message.tool_result.type === "data") && (
                      <div
                        style={{
                          marginTop: "20px",
                          background: "#0f172a",
                          borderRadius: "12px",
                          padding: "16px",
                          color: "#06b6d4",
                          fontSize: "0.85rem",
                          fontFamily: "monospace",
                          overflowX: "auto",
                          border: "1px solid #1e293b",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "12px",
                          }}
                        >
                          <span
                            style={{
                              color: "#64748b",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                background: "#10b981",
                                borderRadius: "50%",
                              }}
                            ></span>
                            System Output
                          </span>
                          <button
                            onClick={() => handleCopy(message.code)}
                            style={{
                              padding: "6px 12px",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "#64748b",
                              transition: "color 0.3s ease",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = "#06b6d4")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = "#64748b")
                            }
                          >
                            <Copy style={{ width: 16, height: 16 }} />
                          </button>
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            fontSize: "0.8rem",
                            lineHeight: 1.5,
                          }}
                        >
                          {message.code}
                        </pre>
                      </div>
                    )}
                </div>

                {/* Tool Result Visualization */}
                {message.type === "ai" && message.tool_result && (
                  <div style={{ maxWidth: "100%", marginTop: "12px" }}>
                    <MessageDisplay toolResult={message.tool_result} />
                  </div>
                )}

                {/* Metadata */}
                <div
                  style={{
                    marginTop: "8px",
                    display: "flex",
                    gap: "12px",
                    fontSize: "0.75rem",
                    color: COLORS.textMuted,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <span>{formatTime(message.timestamp)}</span>
                  {message.type === "ai" && message.tool_used && (
                    <span
                      style={{
                        color: COLORS.primary,
                        fontSize: "0.7rem",
                        fontFamily: "monospace",
                      }}
                    >
                      ⚙ {message.tool_used}
                    </span>
                  )}
                  {message.type === "ai" && (
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        opacity: 0,
                        transition: "opacity 0.3s ease",
                        cursor: "pointer",
                      }}
                    >
                      <ThumbsUp style={{ width: 12, height: 12 }} />
                      <ThumbsDown style={{ width: 12, height: 12 }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              animation: "fadeIn 0.3s ease-in",
            }}
          >
            <div
              style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: "white",
                  border: `2px solid ${COLORS.border}`,
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: COLORS.primary,
                }}
              >
                <Bot style={{ width: 20, height: 20 }} />
              </div>
              <div
                style={{
                  background: "white",
                  border: `2px solid ${COLORS.border}`,
                  borderRadius: "16px",
                  padding: "16px 20px",
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    background: COLORS.primary,
                    borderRadius: "50%",
                    animation: "bounce 1s infinite",
                  }}
                ></div>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    background: COLORS.primary,
                    borderRadius: "50%",
                    animation: "bounce 1s infinite 0.2s",
                  }}
                ></div>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    background: COLORS.primary,
                    borderRadius: "50%",
                    animation: "bounce 1s infinite 0.4s",
                  }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bounce {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
};

export default ConversationPanel;
