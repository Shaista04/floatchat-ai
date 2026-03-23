import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { COLORS, GRADIENTS, ANIMATIONS } from "../../constants/theme";

const GlobeAnimation = () => (
  <div
    className="absolute top-1/2 left-1/2 -z-10"
    style={{
      width: "800px",
      height: "800px",
      marginLeft: "-400px",
      marginTop: "-440px",
      pointerEvents: "none",
    }}
  >
    <motion.div
      style={{ width: "100%", height: "100%", opacity: 0.8 }}
      animate={{ rotate: 360 }}
      transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
    >
      <svg viewBox="0 0 800 800" fill="none">
        <defs>
          <radialGradient id="globeGrad">
            <stop offset="60%" stopColor="#e0f2fe" stopOpacity="0.4" />
            <stop offset="90%" stopColor="#0ea5e9" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="400" cy="400" r="390" fill="url(#globeGrad)" />
        {[...Array(12)].map((_, i) => (
          <ellipse
            key={i}
            cx="400"
            cy="400"
            rx={300 * Math.sin(((i + 1) * Math.PI) / 12)}
            ry="300"
            stroke="#0284c7"
            strokeOpacity="0.15"
          />
        ))}
        <circle
          cx="400"
          cy="400"
          r="300"
          stroke="#0369a1"
          strokeOpacity="0.2"
          fill="rgba(255,255,255,0.2)"
        />
      </svg>
    </motion.div>
  </div>
);

const FloatingOrb = ({ size, top, left, right, delay, duration }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: size,
      height: size,
      top,
      left,
      right,
      background: `radial-gradient(circle, rgba(20, 184, 166, 0.15), rgba(14, 165, 233, 0.08))`,
      zIndex: 0,
    }}
    animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
    transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
  />
);

/**
 * HeroSection Component
 * Landing page hero with animated background and call-to-action buttons
 */
export default function HeroSection() {
  const floatingOrbs = [
    { size: 120, top: "10%", left: "5%", delay: 0, duration: 6 },
    { size: 80, top: "20%", right: "8%", delay: 1, duration: 7 },
    { size: 60, top: "60%", left: "3%", delay: 2, duration: 5 },
    { size: 100, top: "50%", right: "5%", delay: 0.5, duration: 8 },
    { size: 40, top: "30%", left: "50%", delay: 1.5, duration: 6 },
    { size: 50, top: "75%", right: "15%", delay: 3, duration: 7 },
  ];

  return (
    <section
      className="relative overflow-hidden"
      style={{
        paddingTop: "68px",
        paddingBottom: "80px",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Animated Background */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }}
      >
        <GlobeAnimation />
        {floatingOrbs.map((orb, i) => (
          <FloatingOrb key={i} {...orb} />
        ))}
      </div>

      {/* Content */}
      <motion.div
        variants={ANIMATIONS.staggerContainer}
        initial="hidden"
        animate="show"
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          textAlign: "center",
          zIndex: 10,
          padding: "0 20px",
          position: "relative",
        }}
      >
        {/* Main Heading */}
        <motion.h1
          variants={ANIMATIONS.staggerItem}
          style={{
            fontSize: "clamp(2.2rem, 5vw, 4rem)",
            fontWeight: 800,
            color: COLORS.textDark,
            marginBottom: "24px",
          }}
        >
          Explore the Oceans with{" "}
          <span
            style={{
              background: GRADIENTS.primaryToBlue,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AI-powered Insights
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={ANIMATIONS.staggerItem}
          style={{
            fontSize: "1.1rem",
            color: COLORS.textMuted,
            maxWidth: "700px",
            margin: "0 auto 40px",
          }}
        >
          FloatChat AI transforms raw ARGO float data into interactive
          visualizations and insights.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={ANIMATIONS.staggerItem}
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <motion.a
            href="#features"
            style={{
              padding: "14px 32px",
              color: "white",
              background: GRADIENTS.primary,
              borderRadius: "16px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: "600",
              boxShadow: `0 4px 15px rgba(20, 184, 166, 0.3)`,
              border: "none",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
            whileHover={{
              scale: 1.08,
              boxShadow: `0 6px 25px rgba(20, 184, 166, 0.5)`,
            }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started <ArrowRight size={18} />
          </motion.a>

          <motion.a
            href="#features"
            style={{
              padding: "14px 32px",
              border: `2px solid ${COLORS.borderLight}`,
              borderRadius: "16px",
              textDecoration: "none",
              background: "transparent",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: "600",
              color: COLORS.textSecondary,
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
            whileHover={{
              scale: 1.08,
              borderColor: COLORS.primary,
              color: COLORS.primaryDark,
              backgroundColor: COLORS.bgLight,
            }}
            whileTap={{ scale: 0.95 }}
          >
            <Play size={18} /> Learn More
          </motion.a>
        </motion.div>
      </motion.div>
    </section>
  );
}
