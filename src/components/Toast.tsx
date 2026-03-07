import { useState, useCallback, createContext, useContext, type ReactNode } from "react";

// ============================================================================
// Toast context & provider
// ============================================================================

interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (text: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const toast = useCallback((text: string, type: "success" | "error" | "info" = "info") => {
    const id = nextId++;
    setMessages((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              pointerEvents: "auto",
              animation: "mm-toast-in 0.25s ease-out",
              background:
                m.type === "success" ? "var(--score-a-bg)" :
                m.type === "error" ? "var(--score-d-bg)" :
                "var(--bg-surface)",
              color:
                m.type === "success" ? "var(--score-a-text)" :
                m.type === "error" ? "var(--score-d-text)" :
                "var(--text-main)",
              border: "1px solid var(--border)",
              maxWidth: 360,
            }}
          >
            {m.text}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes mm-toast-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
