import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import ChatInput from "./ChatInput";
import { useAuth } from "../../contexts/AuthContext";

const API_URL = "http://localhost:3001/api/chat";

const ChatGPTInterface = () => {
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
        // Automatically start a fresh session so typing is never disabled
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to load history", err);
      // Fallback: auto-create if history API actually fails or returns 404
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
        setMessages([{
          id: "sys_1",
          type: "ai",
          content: "🌊 **Indian Ocean Uplink Synchronized.**\n\nI am connected to the ARGO Global Dataset (Indian Ocean Array). Awaiting your telemetry inquiry...",
          timestamp: new Date(),
          hasCode: false
        }]);
      } else {
        setMessages(res.data.map(m => ({
          ...m, 
          id: m._id,
          hasCode: m.hasCode || !!m.code,
          code: m.code || ""
        })));
      }
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await axios.post(`${API_URL}/session`, {
        userId: user.id,
        title: "Indian Ocean Query"
      });
      const newChat = res.data;
      setChats(prev => [newChat, ...prev]);
      setSelectedChatId(newChat.id || newChat._id); // Ensure ID mapping is robust
      setMessages([{
        id: "sys_1",
        type: "ai",
        content: "🌊 **Indian Ocean Uplink Synchronized.**\n\nI am connected to the ARGO Global Dataset (Indian Ocean Array). Awaiting your telemetry inquiry...",
        timestamp: new Date(),
        hasCode: false
      }]);
    } catch (err) {
      console.error("Failed to create chat", err);
    }
  };

  const handleDeleteChat = async (chatId) => {
    try {
      await axios.delete(`${API_URL}/session/${chatId}`);
      const filtered = chats.filter(c => c._id !== chatId);
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
    
    // Safety check: if no session exists, create one immediately
    if (!activeSessionId) {
       try {
         const res = await axios.post(`${API_URL}/session`, { userId: user.id, title: messageText.substring(0, 30) + "..." });
         activeSessionId = res.data.id || res.data._id;
         setSelectedChatId(activeSessionId);
         setChats(prev => [res.data, ...prev]);
       } catch (e) {
         console.error("Critical: Could not auto-create session", e);
         return;
       }
    }

    const optimisticUserMsg = {
      id: Date.now().toString(),
      type: "user",
      content: messageText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, optimisticUserMsg]);
    setIsTyping(true);

    try {
      const response = await axios.post(API_URL, { 
        message: messageText,
        sessionId: activeSessionId,
        userId: user.id
      });
      
      const aiResponse = response.data;
      setMessages(prev => [...prev, {
        ...aiResponse,
        id: aiResponse._id || Date.now() + 1
      }]);
      
      // Dynamically rename the chat in sidebar if it was the default title
      if (chats.find(c => (c._id === activeSessionId || c.id === activeSessionId))?.title === "Indian Ocean Query") {
         setChats(prev => prev.map(c => (c._id === activeSessionId || c.id === activeSessionId) ? { ...c, title: messageText.substring(0, 30) + "..." } : c));
      }
      
    } catch (error) {
       console.error("Chat API error:", error);
       setMessages(prev => [...prev, {
         id: Date.now() + 1,
         type: "ai",
         content: "⚠️ **Terminal Pipeline Error**\n\nThe FloatChat RAG backend dropped connection or Python virtual environment failed securely.",
         hasCode: false,
         timestamp: new Date()
       }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed top-16 left-0 right-0 bottom-0 flex bg-slate-900 overflow-hidden"
    >
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
        selectedChat={selectedChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        recentChats={chats}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative z-10">
        <ChatWindow 
          messages={messages} 
          isTyping={isTyping} 
          chatId={selectedChatId} 
        />
        <ChatInput 
          onSendMessage={handleSendMessage} 
          isTyping={isTyping}
          // Input is enabled if we have a user, regardless of chatId (it will auto-create)
          disabled={!user || isTyping}
        />
      </div>
    </motion.div>
  );
};

export default ChatGPTInterface;
