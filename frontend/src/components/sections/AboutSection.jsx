import { motion } from "framer-motion";
import { CheckCircle, Target, Zap, Users } from "lucide-react";
import { COLORS, ANIMATIONS } from "../../constants/theme";

/**
 * HighlightCard Component
 * Emphasized card highlighting key aspects of the application
 */
const HighlightCard = ({
  icon: Icon,
  title,
  description,
  bgColor,
  iconColor,
}) => {
  return (
    <motion.div
      variants={ANIMATIONS.staggerItem}
      whileHover={{ y: -8, scale: 1.05 }}
      style={{
        background: "white",
        borderRadius: "20px",
        padding: "32px",
        border: `2px solid ${bgColor}40`,
        cursor: "pointer",
        transition: "all 0.3s ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.08)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)")
      }
    >
      <motion.div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
        whileHover={{ rotate: 12 }}
      >
        <Icon style={{ width: 28, height: 28, color: iconColor }} />
      </motion.div>
      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          color: COLORS.textDark,
          marginBottom: 8,
        }}
      >
        {title}
      </h3>
      <p style={{ color: COLORS.textLight, lineHeight: 1.6 }}>{description}</p>
    </motion.div>
  );
};

/**
 * ValuePoint Component
 * Simple value proposition point with icon
 */
const ValuePoint = ({ icon: Icon, text, color }) => {
  return (
    <motion.div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "16px",
      }}
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
    >
      <Icon style={{ width: 20, height: 20, color, flexShrink: 0 }} />
      <span style={{ color: COLORS.textLight, fontSize: "1rem" }}>{text}</span>
    </motion.div>
  );
};

const highlights = [
  {
    icon: Target,
    title: "Our Mission",
    description:
      "To democratize oceanographic research by making ARGO float data accessible, understandable, and actionable for scientists and enthusiasts worldwide.",
    bgColor: "#f0fdfa",
    iconColor: COLORS.primary,
  },
  {
    icon: Zap,
    title: "Real-Time Insights",
    description:
      "Access live data from thousands of ARGO floats with instant analysis, visualizations, and AI-powered pattern recognition capabilities.",
    bgColor: "#f0f9ff",
    iconColor: COLORS.secondary,
  },
  {
    icon: Users,
    title: "Community Driven",
    description:
      "Built by oceanographers for oceanographers. Our platform evolves with researcher feedback and community contributions.",
    bgColor: "#f0fdfa",
    iconColor: COLORS.primary,
  },
];

const valuePoints = [
  "Advanced AI-powered data analysis",
  "Real-time ARGO float tracking",
  "Multiple data export formats",
  "Interactive visualization tools",
  "Natural language data queries",
  "Global oceanographic coverage",
];

/**
 * AboutSection Component
 * Displays information about the application and its mission
 */
export default function AboutSection() {
  return (
    <section style={{ padding: "80px 20px 100px", background: "#fafafa" }}>
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
            About FloatChat
          </h2>
          <p
            style={{
              fontSize: "1.05rem",
              color: COLORS.textLight,
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            Revolutionizing oceanographic research through intelligent data
            exploration and visualization
          </p>
        </motion.div>

        {/* Highlights Grid */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "24px",
            marginBottom: "80px",
          }}
          variants={ANIMATIONS.staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          {highlights.map((highlight) => (
            <HighlightCard key={highlight.title} {...highlight} />
          ))}
        </motion.div>

        {/* Key Features */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "60px",
            alignItems: "center",
          }}
        >
          {/* Left Side: Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
          >
            <h3
              style={{
                fontSize: "1.8rem",
                fontWeight: 700,
                color: COLORS.textDark,
                marginBottom: "24px",
              }}
            >
              Why Choose FloatChat?
            </h3>
            <div>
              {valuePoints.map((point, idx) => (
                <ValuePoint
                  key={idx}
                  icon={CheckCircle}
                  text={point}
                  color={COLORS.primary}
                />
              ))}
            </div>
          </motion.div>

          {/* Right Side: Animated Illustration */}
          <motion.div
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "40px",
              border: `2px solid ${COLORS.accent}20`,
              textAlign: "center",
            }}
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <motion.div
              style={{
                fontSize: "5rem",
                marginBottom: "16px",
              }}
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              🌊
            </motion.div>
            <h4
              style={{
                fontSize: "1.3rem",
                fontWeight: 600,
                color: COLORS.textDark,
                marginBottom: "8px",
              }}
            >
              Explore the Ocean
            </h4>
            <p style={{ color: COLORS.textLight, lineHeight: 1.6 }}>
              Dive deep into oceanographic data with powerful tools designed for
              modern research
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
