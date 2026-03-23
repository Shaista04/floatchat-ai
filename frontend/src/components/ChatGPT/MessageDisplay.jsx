import React from "react";
import ChatMessageRenderer from "./ChatMessageRenderer";

/**
 * MessageDisplay Component
 * Wrapper for ChatMessageRenderer to handle visualization of chat message contents
 * Supports multiple visualization types: plotly, leaflet, metadata_card, data_table, stats_card, export_csv
 */
const MessageDisplay = ({ toolResult }) => {
  return <ChatMessageRenderer toolResult={toolResult} />;
};

export default MessageDisplay;
