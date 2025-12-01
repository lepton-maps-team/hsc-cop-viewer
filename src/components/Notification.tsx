import React, { useEffect } from "react";
import { useNotificationStore } from "../store/useNotificationStore";

const Notification: React.FC = () => {
  const { notification, setNotification } = useNotificationStore();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [notification, setNotification]);

  if (!notification) return null;

  const { message, subMessage, type } = notification;

  const bgColor =
    type === "lock" ? "rgba(255, 136, 0, 0.95)" : "rgba(255, 0, 0, 0.95)";
  const borderColor = type === "lock" ? "#ffaa00" : "#ff0000";

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: bgColor,
        color: "white",
        padding: "20px 30px",
        borderRadius: "8px",
        border: `2px solid ${borderColor}`,
        fontFamily: "monospace",
        fontSize: "16px",
        fontWeight: "bold",
        zIndex: 2000,
        textAlign: "center",
        boxShadow: `0 0 20px ${borderColor}40`,
      }}
    >
      {message}
      <br />
      <span style={{ fontSize: "14px" }}>{subMessage || ""}</span>
      <br />
      <span style={{ fontSize: "12px", color: "#ffff00" }}>
        Tracking active
      </span>
    </div>
  );
};

export default Notification;
