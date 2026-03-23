import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import ChatHistory from "./ChatHistory";
import ConversationPanel from "./ConversationPanel";
import MessageInput from "./MessageInput";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, ANIMATIONS } from "../../constants/theme";

const API_URL = "http://localhost:3001/api/chat";

/**
 * ConversationContainer Component
 * Main container for the chat interface with sidebar, conversation panel, and message input
 */
const ConversationContainer = () => {
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  // Load chat history on mount
  useEffect(() => {
    if (user?.id) {
      fetchChatHistory();
    }
  }, [user]);

  const fetchChatHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/history/${user.id}`);
      setChats(res.data);
      if (res.data.length > 0) {
        handleSelectChat(res.data[0]._id);
      } else {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to load history", err);
      handleNewChat();
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleSelectChat = async (chatId) => {
    setSelectedChatId(chatId);
    try {
      const res = await axios.get(`${API_URL}/session/${chatId}`);

      if (res.data.length === 0) {
        setMessages([
          {
            id: "sys_1",
            type: "ai",
            content:
              "🌊 **Indian Ocean Uplink Synchronized.**\n\nI am connected to the ARGO Global Dataset (Indian Ocean Array). Awaiting your telemetry inquiry...",
            timestamp: new Date(),
            hasCode: false,
          },
        ]);
      } else {
        setMessages(
          res.data.map((m) => ({
            ...m,
            id: m._id,
            hasCode: m.hasCode || !!m.code,
            code: m.code || "",
          })),
        );
      }
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await axios.post(`${API_URL}/session`, {
        userId: user.id,
        title: "Indian Ocean Query",
      });
      const newChat = res.data;
      setChats((prev) => [newChat, ...prev]);
      setSelectedChatId(newChat.id || newChat._id);
      setMessages([
        {
          id: "sys_1",
          type: "ai",
          content:
            "🌊 **Indian Ocean Uplink Synchronized.**\n\nI am connected to the ARGO Global Dataset (Indian Ocean Array). Awaiting your telemetry inquiry...",
          timestamp: new Date(),
          hasCode: false,
        },
      ]);
    } catch (err) {
      console.error("Failed to create chat", err);
    }
  };

  const handleDeleteChat = async (chatId) => {
    try {
      await axios.delete(`${API_URL}/session/${chatId}`);
      const filtered = chats.filter((c) => c._id !== chatId);
      setChats(filtered);
      if (selectedChatId === chatId) {
        setMessages([]);
        if (filtered.length > 0) {
          handleSelectChat(filtered[0]._id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  const handleSendMessage = async (messageText) => {
    let activeSessionId = selectedChatId;

    if (!activeSessionId) {
      try {
        const res = await axios.post(`${API_URL}/session`, {
          userId: user.id,
          title: messageText.substring(0, 30) + "...",
        });
        activeSessionId = res.data.id || res.data._id;
        setSelectedChatId(activeSessionId);
        setChats((prev) => [res.data, ...prev]);
      } catch (e) {
        console.error("Critical: Could not auto-create session", e);
        return;
      }
    }

    const optimisticUserMsg = {
      id: Date.now().toString(),
      type: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsTyping(true);

    try {
      const response = await axios.post(API_URL, {
        message: messageText,
        sessionId: activeSessionId,
        userId: user.id,
      });

      const aiResponse = response.data;
      setMessages((prev) => [
        ...prev,
        { ...aiResponse, id: aiResponse._id || Date.now() + 1 },
      ]);

      if (
        chats.find((c) => c._id === activeSessionId || c.id === activeSessionId)
          ?.title === "Indian Ocean Query"
      ) {
        setChats((prev) =>
          prev.map((c) =>
            c._id === activeSessionId || c.id === activeSessionId
              ? { ...c, title: messageText.substring(0, 30) + "..." }
              : c,
          ),
        );
      }
    } catch (error) {
      console.error("Chat API error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          type: "ai",
          content:
            "⚠️ **Terminal Pipeline Error**\n\nThe FloatChat RAG backend dropped connection or Python virtual environment failed securely.",
          hasCode: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        background: COLORS.background,
        overflow: "hidden",
      }}
    >
      <ChatHistory
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
        selectedChat={selectedChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        recentChats={chats}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: "#f9fafb",
          position: "relative",
          zIndex: 10,
        }}
      >
        <ConversationPanel
          messages={messages}
          isTyping={isTyping}
          chatId={selectedChatId}
        />
        <MessageInput
          onSendMessage={handleSendMessage}
          isTyping={isTyping}
          disabled={!user || isTyping}
        />
      </div>
    </motion.div>
  );
};

export default ConversationContainer;
