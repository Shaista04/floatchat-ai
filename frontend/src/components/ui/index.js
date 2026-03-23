import { motion } from "framer-motion";
import { COLORS } from "../../constants/theme";

/**
 * Button Component
 * Reusable button with primary/secondary/outline variants
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  onClick,
  disabled = false,
  isLoading = false,
  ...props
}) {
  const sizeStyles = {
    sm: { padding: "8px 16px", fontSize: "0.875rem" },
    md: { padding: "12px 24px", fontSize: "1rem" },
    lg: { padding: "16px 32px", fontSize: "1.1rem" },
  };

  const variantStyles = {
    primary: {
      background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
      color: "white",
      border: "none",
    },
    secondary: {
      background: COLORS.background,
      color: COLORS.textDark,
      border: `2px solid ${COLORS.primary}`,
    },
    outline: {
      background: "transparent",
      color: COLORS.primary,
      border: `2px solid ${COLORS.primary}`,
    },
  };

  return (
    <motion.button
      style={{
        ...sizeStyles[size],
        ...variantStyles[variant],
        borderRadius: "12px",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.3s ease",
        ...props.style,
      }}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? "Loading..." : children}
    </motion.button>
  );
}

/**
 * Card Component
 * Reusable card container with optional elevation
 */
export function Card({ children, elevated = false, ...props }) {
  return (
    <motion.div
      style={{
        background: "white",
        borderRadius: "16px",
        padding: "24px",
        border: `1px solid ${COLORS.border}`,
        boxShadow: elevated
          ? "0 10px 30px rgba(0,0,0,0.1)"
          : "0 2px 8px rgba(0,0,0,0.05)",
        transition: "all 0.3s ease",
        ...props.style,
      }}
      whileHover={
        elevated ? { boxShadow: "0 20px 40px rgba(0,0,0,0.15)", y: -4 } : {}
      }
    >
      {children}
    </motion.div>
  );
}

/**
 * Input Component
 * Reusable input field with label and error states
 */
export function Input({
  label,
  error,
  type = "text",
  placeholder,
  value,
  onChange,
  disabled = false,
  ...props
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: "0.9rem",
            fontWeight: 600,
            color: COLORS.textDark,
            marginBottom: "8px",
          }}
        >
          {label}
        </label>
      )}
      <motion.input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "10px",
          border: error ? `2px solid #ef4444` : `2px solid ${COLORS.border}`,
          fontSize: "1rem",
          backgroundColor: disabled ? "#f5f5f5" : "white",
          color: COLORS.textDark,
          transition: "all 0.3s ease",
          boxSizing: "border-box",
          ...props.style,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = COLORS.primary;
          e.target.style.boxShadow = `0 0 0 3px ${COLORS.primary}20`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? "#ef4444" : COLORS.border;
          e.target.style.boxShadow = "none";
        }}
      />
      {error && (
        <p style={{ fontSize: "0.85rem", color: "#ef4444", marginTop: "6px" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Badge Component
 * Reusable badge for tags and labels
 */
export function Badge({ children, color = "primary", variant = "default" }) {
  const colorMap = {
    primary: { bg: "#f0fdfa", text: COLORS.primary },
    secondary: { bg: "#f0f9ff", text: COLORS.secondary },
    success: { bg: "#ecfdf5", text: "#10b981" },
    error: { bg: "#fef2f2", text: "#ef4444" },
    warning: { bg: "#fefce8", text: "#eab308" },
  };

  const selected = colorMap[color] || colorMap.primary;

  if (variant === "filled") {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "6px 12px",
          backgroundColor: selected.text,
          color: "white",
          borderRadius: "8px",
          fontSize: "0.8rem",
          fontWeight: 600,
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 12px",
        backgroundColor: selected.bg,
        color: selected.text,
        borderRadius: "8px",
        fontSize: "0.8rem",
        fontWeight: 600,
        border: `1px solid ${selected.text}30`,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Section Component
 * Reusable container for sections
 */
export function Section({ children, id, className }) {
  return (
    <section
      id={id}
      style={{
        padding: "80px 20px",
        maxWidth: "1000px",
        margin: "0 auto",
      }}
      className={className}
    >
      {children}
    </section>
  );
}

/**
 * SectionHeader Component
 * Reusable section title and description
 */
export function SectionHeader({ title, description, subtitle }) {
  return (
    <motion.div
      style={{ textAlign: "center", marginBottom: "60px" }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      {subtitle && (
        <p
          style={{
            color: COLORS.primary,
            fontSize: "0.9rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "12px",
          }}
        >
          {subtitle}
        </p>
      )}
      <h2
        style={{
          fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
          fontWeight: 800,
          color: COLORS.textDark,
          marginBottom: "16px",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
      {description && (
        <p
          style={{
            fontSize: "1.05rem",
            color: COLORS.textLight,
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          {description}
        </p>
      )}
    </motion.div>
  );
}

/**
 * LoadingSpinner Component
 * Animated loading indicator
 */
export function LoadingSpinner({ size = "md", color = COLORS.primary }) {
  const sizeMap = { sm: "20px", md: "40px", lg: "60px" };

  return (
    <motion.div
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        border: `4px solid ${color}20`,
        borderTop: `4px solid ${color}`,
        borderRadius: "50%",
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  );
}

/**
 * Tooltip Component
 * Simple tooltip wrapper
 */
export function Tooltip({ children, text }) {
  return (
    <motion.div
      style={{ position: "relative", display: "inline-block" }}
      initial={{ opacity: 0 }}
      whileHover={{ opacity: 1 }}
    >
      {children}
      <motion.div
        style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          background: COLORS.textDark,
          color: "white",
          padding: "6px 12px",
          borderRadius: "6px",
          fontSize: "0.8rem",
          whiteSpace: "nowrap",
          marginBottom: "8px",
          zIndex: 1000,
        }}
        initial={{ opacity: 0, y: 8 }}
        whileHover={{ opacity: 1, y: 0 }}
      >
        {text}
      </motion.div>
    </motion.div>
  );
}

/**
 * Modal Component
 * Reusable modal dialog
 */
export function Modal({ isOpen, onClose, title, children, size = "md" }) {
  if (!isOpen) return null;

  const sizeMap = { sm: "400px", md: "600px", lg: "800px" };

  return (
    <motion.div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        style={{
          background: "white",
          borderRadius: "16px",
          width: "90%",
          maxWidth: sizeMap[size],
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "24px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 700,
              color: COLORS.textDark,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: COLORS.textLight,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </motion.div>
    </motion.div>
  );
}
