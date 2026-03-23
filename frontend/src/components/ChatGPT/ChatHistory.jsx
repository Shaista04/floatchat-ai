import React, { useState } from "react";
import {
  Plus,
  MessageSquare,
  Settings,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { COLORS, ANIMATIONS } from "../../constants/theme";

/**
 * ChatHistory Component
 * Sidebar with chat history, user profile, and navigation controls
 */
const ChatHistory = ({
  isCollapsed,
  onToggle,
  selectedChat,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  recentChats,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div
      style={{
        background: COLORS.textDark,
        color: "white",
        transition: "all 0.3s ease",
        width: isCollapsed ? "64px" : "256px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRight: `1px solid ${COLORS.border}30`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: `1px solid ${COLORS.border}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {!isCollapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MessageSquare
                style={{ width: 16, height: 16, color: "white" }}
              />
            </div>
            <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>
              FloatChat
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            padding: "8px",
            background: "transparent",
            border: "none",
            color: "white",
            cursor: "pointer",
            borderRadius: "8px",
            transition: "background 0.3s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = `${COLORS.border}30`)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          {isCollapsed ? (
            <ChevronRight style={{ width: 16, height: 16 }} />
          ) : (
            <ChevronLeft style={{ width: 16, height: 16 }} />
          )}
        </button>
      </div>

      {/* New Chat Button */}
      <div style={{ padding: "16px 12px" }}>
        <button
          onClick={onNewChat}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: "12px",
            padding: "10px 12px",
            borderRadius: "12px",
            background: `${COLORS.primary}30`,
            color: COLORS.primary,
            border: `2px solid ${COLORS.primary}50`,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.875rem",
            transition: "all 0.3s ease",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${COLORS.primary}50`;
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${COLORS.primary}30`;
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <Plus style={{ width: 16, height: 16, flexShrink: 0 }} />
          {!isCollapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Recent Chats */}
      {!isCollapsed && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "0 12px",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <h3
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: `${COLORS.textLight}70`,
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "12px",
                paddingLeft: "8px",
              }}
            >
              Recent Sessions
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              {recentChats.length === 0 ? (
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: `${COLORS.textLight}50`,
                    fontStyle: "italic",
                    paddingLeft: "8px",
                  }}
                >
                  No session history
                </p>
              ) : null}
              {recentChats.map((chat) => (
                <div
                  key={chat._id}
                  style={{
                    position: "relative",
                    padding: "12px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    border: `2px solid ${selectedChat === chat._id ? `${COLORS.primary}50` : "transparent"}`,
                    background:
                      selectedChat === chat._id
                        ? `${COLORS.primary}20`
                        : `${COLORS.border}20`,
                    group: {
                      "&:hover": {
                        background: `${COLORS.border}40`,
                      },
                    },
                  }}
                  onClick={() => onSelectChat(chat._id)}
                  onMouseEnter={(e) => {
                    if (selectedChat !== chat._id) {
                      e.currentTarget.style.background = `${COLORS.border}40`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedChat !== chat._id) {
                      e.currentTarget.style.background = `${COLORS.border}20`;
                    }
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          color:
                            selectedChat === chat._id
                              ? COLORS.primary
                              : "white",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {chat.title}
                      </h4>
                      <p
                        style={{
                          fontSize: "0.7rem",
                          color: `${COLORS.textLight}70`,
                          marginTop: "4px",
                          fontFamily: "monospace",
                        }}
                      >
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat._id);
                      }}
                      style={{
                        padding: "6px 8px",
                        background: "transparent",
                        border: "none",
                        color: `${COLORS.textLight}70`,
                        cursor: "pointer",
                        borderRadius: "6px",
                        transition: "all 0.3s ease",
                        opacity: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.background = "#ef444430";
                        e.currentTarget.style.color = "#ef4444";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "0";
                      }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Profile */}
      <div
        style={{
          padding: "16px",
          borderTop: `1px solid ${COLORS.border}30`,
          background: COLORS.textDark,
          position: "relative",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            gap: "12px",
            padding: "8px",
            background: "transparent",
            border: "none",
            color: "white",
            cursor: "pointer",
            borderRadius: "10px",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = `${COLORS.border}30`)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 12px ${COLORS.primary}40`,
              flexShrink: 0,
            }}
          >
            <User style={{ width: 16, height: 16, color: "white" }} />
          </div>
          {!isCollapsed && (
            <>
              <div style={{ flex: 1, textAlign: "left" }}>
                <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  {user?.name || "Operator"}
                </p>
                <p
                  style={{
                    fontSize: "0.7rem",
                    color: COLORS.primary,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginTop: "2px",
                  }}
                >
                  {user?.role || "GUEST"}
                </p>
              </div>
              <ChevronRight style={{ width: 16, height: 16, opacity: 0.6 }} />
            </>
          )}
        </button>

        {/* User Menu Dropdown */}
        {showUserMenu && !isCollapsed && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: "12px",
              right: "12px",
              marginBottom: "8px",
              background: "#1f2937",
              borderRadius: "12px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
              border: `1px solid ${COLORS.border}30`,
              overflow: "hidden",
              zIndex: 100,
            }}
          >
            <button
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "background 0.3s ease",
                textAlign: "left",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = `${COLORS.border}30`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Settings style={{ width: 16, height: 16 }} />
              <span>Settings</span>
            </button>
            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                color: "#ef4444",
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "background 0.3s ease",
                textAlign: "left",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#ef444420")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <LogOut style={{ width: 16, height: 16 }} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
