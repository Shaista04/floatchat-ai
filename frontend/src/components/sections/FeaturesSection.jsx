import { motion } from "framer-motion";
import {
  MessageSquareText,
  Map,
  BarChart3,
  Download,
  BrainCircuit,
  Globe2,
} from "lucide-react";
import { COLORS, ANIMATIONS } from "../../constants/theme";

const featuresList = [
  {
    icon: MessageSquareText,
    title: "Natural Language Chat",
    description:
      "Ask questions about oceanographic data in plain English. Get instant insights and visualizations.",
    bgColor: "#f0fdfa",
    iconColor: COLORS.primary,
    borderColor: "#ccfbf1",
  },
  {
    icon: Map,
    title: "Interactive ARGO Float Maps",
    description:
      "Explore real-time ARGO float locations with interactive maps showing trajectories and data coverage.",
    bgColor: "#f0f9ff",
    iconColor: COLORS.secondary,
    borderColor: "#e0f2fe",
  },
  {
    icon: BarChart3,
    title: "Profile Visualizations",
    description:
      "Create stunning temperature and salinity depth profiles with interactive charts and graphs.",
    bgColor: "#f0fdfa",
    iconColor: COLORS.primaryDark,
    borderColor: "#ccfbf1",
  },
  {
    icon: Download,
    title: "Data Downloads",
    description:
      "Export data in multiple formats: NetCDF, CSV, Parquet, and JSON for further analysis.",
    bgColor: "#f0f9ff",
    iconColor: COLORS.secondary,
    borderColor: "#bae6fd",
  },
  {
    icon: BrainCircuit,
    title: "AI-Powered Analysis",
    description:
      "Leverage machine learning algorithms to identify patterns and anomalies in oceanographic data.",
    bgColor: "#f0fdfa",
    iconColor: COLORS.primary,
    borderColor: "#99f6e4",
  },
  {
    icon: Globe2,
    title: "Global Coverage",
    description:
      "Access data from thousands of ARGO floats across all ocean basins worldwide.",
    bgColor: "#f0f9ff",
    iconColor: COLORS.secondary,
    borderColor: "#e0f2fe",
  },
];

/**
 * FeatureCard Component
 * Individual feature display card with icon and description
 */
const FeatureCard = ({ feature }) => {
  const Icon = feature.icon;

  return (
    <motion.div
      variants={ANIMATIONS.staggerItem}
      whileHover={{ y: -8, scale: 1.03 }}
      style={{
        background: "white",
        borderRadius: "20px",
        padding: "28px",
        border: `2px solid ${feature.borderColor}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        cursor: "pointer",
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = "0 16px 50px rgba(0,0,0,0.12)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)")
      }
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "20px" }}>
        <motion.div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: feature.bgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          whileHover={{ rotate: 12, scale: 1.1 }}
        >
          <Icon style={{ width: 24, height: 24, color: feature.iconColor }} />
        </motion.div>
        <div>
          <h3
            style={{
              fontSize: "1.15rem",
              fontWeight: 700,
              color: COLORS.textDark,
              marginBottom: 8,
            }}
          >
            {feature.title}
          </h3>
          <p
            style={{
              color: COLORS.textMuted,
              lineHeight: 1.6,
              fontSize: "0.95rem",
            }}
          >
            {feature.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * FeaturesSection Component
 * Displays all platform features in a grid layout
 */
export default function FeaturesSection() {
  return (
    <section id="features" style={{ padding: "80px 20px 100px" }}>
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
            Powerful Features for{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #0ea5e9, #14b8a6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Ocean Data Exploration
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
            Discover the full potential of ARGO float data with our
            comprehensive suite of tools and visualizations.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "20px",
          }}
          variants={ANIMATIONS.staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          {featuresList.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
