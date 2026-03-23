import React, { useState } from "react";
import { Plus, MessageSquare, Settings, LogOut, User, ChevronLeft, ChevronRight, MoreHorizontal, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Sidebar = ({ isCollapsed, onToggle, selectedChat, onSelectChat, onNewChat, onDeleteChat, recentChats }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`bg-gray-900 text-white transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"} flex flex-col h-full border-r border-gray-700 overflow-hidden`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 ocean-gradient rounded-lg flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-lg">FloatChat AI</span>
            </div>
          )}
          <button onClick={onToggle} className="p-2 hover:bg-gray-800 rounded-lg transition-colors duration-200">
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="p-4 space-y-2">
        <button onClick={onNewChat} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-cyan-900/40 text-cyan-400 hover:bg-cyan-800/50 hover:text-cyan-300 border border-cyan-800/50 transition-colors duration-200 ${isCollapsed ? "justify-center" : ""}`}>
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-semibold tracking-wide">New Uplink</span>}
        </button>
      </div>

      {/* Recent Chats */}
      {!isCollapsed && (
        <div className="flex-1 px-4 overflow-hidden overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pl-1">
              Active Sessions
            </h3>
            <div className="space-y-1">
              {recentChats.length === 0 ? (
                <p className="text-xs text-gray-500 italic pl-1">No transmission history.</p>
              ) : null}
              {recentChats.map((chat) => (
                <div
                  key={chat._id}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-colors duration-200 border ${selectedChat === chat._id ? "bg-slate-800 border-cyan-500/30" : "hover:bg-gray-800 border-transparent"}`}
                  onClick={() => onSelectChat(chat._id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-medium truncate ${selectedChat === chat._id ? "text-cyan-400" : "text-slate-300"}`}>
                        {chat.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 font-mono">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center ml-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteChat(chat._id); }}
                        className="p-1.5 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Profile */}
      <div className="p-4 border-t border-gray-700 bg-gray-900 z-10">
        <div className="relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-800 transition-colors duration-200">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
              <User className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium tracking-wide">{user?.name || "Operator"}</p>
                  <p className="text-xs text-cyan-400 uppercase tracking-widest font-mono">{user?.role || "GUEST"}</p>
                </div>
                <MoreHorizontal className="w-4 h-4 text-slate-500" />
              </>
            )}
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && !isCollapsed && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 py-2 overflow-hidden">
              <button className="w-full flex items-center space-x-3 px-4 py-3 text-sm hover:bg-gray-700 transition-colors duration-200 text-slate-300 hover:text-white">
                <Settings className="w-4 h-4" />
                <span>System Settings</span>
              </button>
              <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 text-sm hover:bg-red-900/30 transition-colors duration-200 text-red-400 hover:text-red-300">
                <LogOut className="w-4 h-4" />
                <span>End Connection</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
