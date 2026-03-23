import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { COLORS, ANIMATIONS } from "../../constants/theme";

/**
 * AnimatedCounter Component
 * Displays animated counting effect from 0 to final value
 */
const AnimatedCounter = ({ value, suffix = "", duration = 2 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed = (currentTime - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayValue(Math.floor(value * progress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span>
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
};

/**
 * StatCard Component
 * Individual statistics card with animated counter
 */
const StatCard = ({ icon: Icon, label, value, suffix, bgColor, iconColor }) => {
  return (
    <motion.div
      variants={ANIMATIONS.staggerItem}
      whileHover={{ y: -8, scale: 1.05 }}
      style={{
        background: "white",
        borderRadius: "20px",
        padding: "32px",
        border: `2px solid ${bgColor}40`,
        textAlign: "center",
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
          width: 64,
          height: 64,
          borderRadius: 16,
          background: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
        whileHover={{ rotate: -10, scale: 1.15 }}
      >
        <Icon style={{ width: 32, height: 32, color: iconColor }} />
      </motion.div>

      <motion.h3
        style={{
          fontSize: "2.5rem",
          fontWeight: 800,
          background: `linear-gradient(135deg, ${iconColor}, #14b8a6)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "8px",
          lineHeight: 1.2,
        }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <AnimatedCounter value={value} suffix={suffix} duration={2.5} />
      </motion.h3>

      <p style={{ color: COLORS.textLight, fontSize: "1rem", fontWeight: 500 }}>
        {label}
      </p>
    </motion.div>
  );
};

const stats = [
  {
    icon: require("lucide-react").Database,
    label: "ARGO Floats",
    value: 4000,
    suffix: "+",
    bgColor: "#f0fdfa",
    iconColor: COLORS.primary,
  },
  {
    icon: require("lucide-react").Globe,
    label: "Global Coverage",
    value: 360,
    suffix: "°",
    bgColor: "#f0f9ff",
    iconColor: COLORS.secondary,
  },
  {
    icon: require("lucide-react").BarChart3,
    label: "Profiles Per Day",
    value: 8000,
    suffix: "+",
    bgColor: "#f0fdfa",
    iconColor: COLORS.primaryDark,
  },
  {
    icon: require("lucide-react").Users,
    label: "Active Users",
    value: 500,
    suffix: "+",
    bgColor: "#f0f9ff",
    iconColor: COLORS.secondary,
  },
];

/**
 * StatsSection Component
 * Displays key statistics about the platform with animated counters
 */
export default function StatsSection() {
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
            By The Numbers
          </h2>
          <p
            style={{
              fontSize: "1.05rem",
              color: COLORS.textLight,
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            Trusted by the global oceanographic research community
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
          }}
          variants={ANIMATIONS.staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          {stats.map((stat, idx) => (
            <StatCard key={idx} {...stat} icon={stat.icon} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
