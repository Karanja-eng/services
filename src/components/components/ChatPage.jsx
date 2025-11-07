import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  MessageSquare,
  Paperclip,
  Image,
  FileText,
  X,
  HammerIcon,
} from "lucide-react";

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Start and stop timer
  const startTimer = () => {
    const start = performance.now();
    timerRef.current = setInterval(() => {
      setElapsed(((performance.now() - start) / 1000).toFixed(1));
    }, 100);
  };
  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Animated dots for "thinking..."
  const LoadingDots = () => {
    const [dots, setDots] = useState("");
    useEffect(() => {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length < 3 ? prev + "." : ""));
      }, 400);
      return () => clearInterval(interval);
    }, []);
    return <span>{dots}</span>;
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage = {
      text: input.trim(),
      user: true,
      attachments,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setLoading(true);
    setElapsed(0);
    startTimer();

    try {
      const startTime = performance.now();
     const formData = new FormData();
formData.append("prompt", input);
if (attachments.length > 0) {
  formData.append("image", attachments[0].file); // only one image supported
}

const res = await axios.post("http://127.0.0.1:8000/generate", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      stopTimer();
      setLoading(false);

      const aiMessage = {
        text: res.data.response,
        user: false,
        timestamp: new Date().toISOString(),
        responseTime: duration,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error("Backend error:", err);
      stopTimer();
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          text: "⚠️ Error connecting to AI backend.",
          user: false,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = null;
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith("image/")) return Image;
    return FileText;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare size={64} className="mx-auto mb-4 text-gray-400" />
              <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Karibu Fundi{" "}
                <HammerIcon className="inline-block w-6 h-6 ml-2 text-black" />
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Start a conversation with AI assistant
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.user ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-lg ${
                  msg.user
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                } rounded-lg overflow-hidden`}
              >
                {msg.text && <div className="p-4">{msg.text}</div>}
                {msg.responseTime && (
                  <div className="px-4 pb-2 text-xs text-gray-500 dark:text-gray-400">
                    ⏱ {msg.responseTime}s response
                  </div>
                )}
                {msg.attachments?.length > 0 && (
                  <div className="border-t border-white/20 dark:border-gray-600">
                    {msg.attachments.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        {file.type.startsWith("image/") ? (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full"
                          >
                            <img
                              src={file.url}
                              alt={file.name}
                              className="max-w-[200px] max-h-[150px] rounded object-cover mx-auto"
                            />
                          </a>
                        ) : (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm"
                          >
                            <FileText className="w-4 h-4" />
                            <span className="underline">{file.name}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center text-gray-500 dark:text-gray-400 mt-2 gap-2">
            <div className="loader-dot" />
            <p>
              Thinking
              <LoadingDots /> ⏱ {elapsed}s
            </p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="group relative flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-2 pr-8"
              >
                {React.createElement(getFileIcon(file.type), {
                  className: "w-4 h-4 text-gray-500 dark:text-gray-400",
                })}
                <span className="text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                  {file.name}
                </span>
                <button
                  onClick={() => removeAttachment(file.id)}
                  className="absolute right-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            multiple
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            onClick={handleSend}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Loader animation styles */}
      <style>{`
        .loader-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #3b82f6;
          animation: pulse 1s infinite alternate;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ChatPage;
