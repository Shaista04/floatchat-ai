import { motion } from "framer-motion";
import { Waves, Heart, Twitter, Github, Linkedin, Send } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Interactive Maps", href: "#maps" },
    { label: "Data Export", href: "#export" },
    { label: "API Access", href: "#api" },
  ],
  Resources: [
    { label: "Documentation", href: "#docs" },
    { label: "ARGO Network", href: "#argo" },
    { label: "Research Papers", href: "#research" },
    { label: "Blog", href: "#blog" },
  ],
  Company: [
    { label: "About Us", href: "#about" },
    { label: "Careers", href: "#careers" },
    { label: "Privacy Policy", href: "#privacy" },
    { label: "Terms of Service", href: "#terms" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "#" },
  { icon: Github, href: "#" },
  { icon: Linkedin, href: "#" },
];

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(226, 232, 240, 0.8)",
        background: "white",
        padding: "80px 20px 40px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "40px",
            marginBottom: "60px",
          }}
        >
          {/* Brand & Newsletter */}
          <div
            style={{
              gridColumn: "1 / -1",
              maxWidth: "400px",
              marginBottom: "20px",
            }}
            className="md:col-span-2"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: "linear-gradient(135deg, #14b8a6, #0284c7)",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Waves style={{ width: 20, height: 20, color: "white" }} />
              </div>
              <span
                style={{
                  fontWeight: 800,
                  color: "#0f172a",
                  fontSize: 20,
                  letterSpacing: "-0.02em",
                }}
              >
                FloatChat AI
              </span>
            </div>
            <p
              style={{
                color: "#64748b",
                fontSize: 15,
                lineHeight: 1.6,
                marginBottom: "24px",
              }}
            >
              Explore the oceans with AI-powered insights. Interactive RAG
              pipelines for ARGO float data analysis.
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              style={{ display: "flex", gap: "8px" }}
            >
              <motion.input
                type="email"
                placeholder="Subscribe to newsletter"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: "2px solid #e2e8f0",
                  background: "#f8fafc",
                  outline: "none",
                  fontSize: 14,
                  color: "#0f172a",
                  transition: "all 0.3s ease",
                }}
                whileFocus={{
                  borderColor: "#14b8a6",
                  boxShadow: "0 0 0 3px rgba(20, 184, 166, 0.1)",
                }}
              />
              <motion.button
                whileHover={{
                  scale: 1.08,
                  boxShadow: "0 6px 20px rgba(14, 165, 233, 0.4)",
                }}
                whileTap={{ scale: 0.92 }}
                style={{
                  padding: "12px 20px",
                  borderRadius: "12px",
                  background: "#0ea5e9",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  transition: "all 0.3s ease",
                }}
              >
                <Send style={{ width: 18, height: 18 }} />
              </motion.button>
            </form>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4
                style={{
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: "20px",
                  fontSize: 16,
                }}
              >
                {category}
              </h4>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {links.map((link) => (
                  <li key={link.label}>
                    <motion.a
                      href={link.href}
                      style={{
                        color: "#64748b",
                        textDecoration: "none",
                        fontSize: 15,
                        transition: "all 0.2s",
                        display: "inline-block",
                      }}
                      whileHover={{ x: 6, color: "#0ea5e9" }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {link.label}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            paddingTop: "32px",
            borderTop: "1px solid rgba(226, 232, 240, 0.8)",
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Made with{" "}
            <Heart
              style={{
                width: 16,
                height: 16,
                color: "#f43f5e",
                fill: "#f43f5e",
              }}
            />{" "}
            in the Ocean
            <span>© {new Date().getFullYear()} FloatChat AI</span>
          </p>
          <div style={{ display: "flex", gap: "16px" }}>
            {socialLinks.map((social, i) => (
              <motion.a
                key={i}
                href={social.href}
                style={{ color: "#94a3b8", transition: "all 0.3s" }}
                whileHover={{ scale: 1.3, color: "#0ea5e9", rotate: 10 }}
                whileTap={{ scale: 0.9 }}
              >
                <social.icon style={{ width: 20, height: 20 }} />
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
