import { motion } from "framer-motion";
import { Waves, Database, BarChart3, Globe2 } from "lucide-react";

const highlights = [
  { icon: Waves, label: "Ocean Intelligence" },
  { icon: Database, label: "Data Platform" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Globe2, label: "Global Network" },
];

export default function About() {
  return (
    <section
      id="about"
      style={{
        padding: "80px 20px 100px",
        background:
          "linear-gradient(180deg, rgba(240,249,255,0.5) 0%, rgba(224,242,254,0.3) 50%, rgba(240,249,255,0.5) 100%)",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7 }}
        >
          <h2
            style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: 800,
              marginBottom: "24px",
              lineHeight: 1.15,
            }}
          >
            <span style={{ color: "#0f172a" }}>About </span>
            <span
              style={{
                background:
                  "linear-gradient(135deg, #14b8a6, #0ea5e9, #0d9488)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              FloatChat AI
            </span>
          </h2>
          <p
            style={{
              fontSize: "clamp(1rem, 2vw, 1.2rem)",
              color: "#64748b",
              lineHeight: 1.7,
              maxWidth: "700px",
              margin: "0 auto 48px",
            }}
          >
            An AI-powered conversational dashboard for exploring and analyzing
            ARGO float oceanographic data. Discover insights from the world's
            largest ocean observation network.
          </p>
        </motion.div>

        {/* Highlight Icons */}
        <motion.div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "32px",
          }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          {highlights.map((h, i) => (
            <motion.div
              key={h.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
              }}
              whileHover={{ scale: 1.15, y: -8 }}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                delay: 0.1 * i + 0.4,
                type: "spring",
                stiffness: 200,
                damping: 15,
              }}
            >
              <motion.div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  background: "linear-gradient(135deg, #14b8a6, #0284c7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(20, 184, 166, 0.25)",
                }}
                whileHover={{
                  boxShadow: "0 12px 32px rgba(20, 184, 166, 0.5)",
                  rotate: 12,
                }}
              >
                <motion.div
                  whileHover={{ scale: 1.2, rotate: -12 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <h.icon style={{ width: 28, height: 28, color: "white" }} />
                </motion.div>
              </motion.div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>
                {h.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
