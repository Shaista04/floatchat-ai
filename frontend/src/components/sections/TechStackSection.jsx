import { motion } from "framer-motion";
import { COLORS, ANIMATIONS } from "../../constants/theme";

/**
 * TechBadge Component
 * Individual technology logo with animated hover effect
 */
const TechBadge = ({ name, bgColor, iconColor }) => {
  const getLogos = {
    React: "⚛️",
    "Node.js": "🟢",
    Express: "🚂",
    MongoDB: "🍃",
    ChromaDB: "📊",
    Ollama: "🤖",
    "Framer Motion": "✨",
    Vite: "⚡",
    "Tailwind CSS": "🎨",
    WebSocket: "🔄",
  };

  return (
    <motion.div
      whileHover={{ y: -12, scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      style={{
        width: 120,
        height: 120,
        borderRadius: "20px",
        background: bgColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        border: `2px solid ${iconColor}40`,
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 20px 40px ${iconColor}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.08)";
      }}
    >
      {/* Animated background gradient on hover */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${iconColor}10, transparent)`,
          opacity: 0,
        }}
        whileHover={{ opacity: 1 }}
      />

      <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>
        {getLogos[name] || "🔧"}
      </div>
      <span
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: iconColor,
          textAlign: "center",
          zIndex: 1,
        }}
      >
        {name}
      </span>
    </motion.div>
  );
};

const techStack = [
  { name: "React", bgColor: "#f0f9ff", iconColor: COLORS.secondary },
  { name: "Node.js", bgColor: "#f0fdfa", iconColor: COLORS.primary },
  { name: "Express", bgColor: "#f0f9ff", iconColor: COLORS.secondary },
  { name: "MongoDB", bgColor: "#f0fdfa", iconColor: COLORS.primary },
  { name: "ChromaDB", bgColor: "#f0f9ff", iconColor: COLORS.secondary },
  { name: "Ollama", bgColor: "#f0fdfa", iconColor: COLORS.primary },
  { name: "Framer Motion", bgColor: "#f0f9ff", iconColor: COLORS.secondary },
  { name: "Vite", bgColor: "#f0fdfa", iconColor: COLORS.primary },
  { name: "Tailwind CSS", bgColor: "#f0f9ff", iconColor: COLORS.secondary },
  { name: "WebSocket", bgColor: "#f0fdfa", iconColor: COLORS.primary },
];

/**
 * TechStackSection Component
 * Displays technology stack with interactive badges
 */
export default function TechStackSection() {
  return (
    <section style={{ padding: "80px 20px 100px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {/* Section Header */}
        <motion.div
          style={{ textAlign: "center", marginBottom: "60px" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
        >
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              fontWeight: 800,
              color: COLORS.textDark,
              marginBottom: "16px",
              lineHeight: 1.2,
            }}
          >
            Built With Modern{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Technology
            </span>
          </h2>
          <p
            style={{
              fontSize: "1.05rem",
              color: COLORS.textLight,
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            Cutting-edge tools and frameworks to ensure reliability,
            performance, and scalability
          </p>
        </motion.div>

        {/* Tech Stack Grid */}
        <motion.div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "24px",
            padding: "20px",
          }}
          variants={ANIMATIONS.staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          {techStack.map((tech, idx) => (
            <motion.div key={idx} variants={ANIMATIONS.staggerItem}>
              <TechBadge {...tech} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
