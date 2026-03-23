import { motion } from "framer-motion";
import { Mail, Linkedin, Github, Twitter, MapPin, Phone } from "lucide-react";
import { COLORS, ANIMATIONS } from "../../constants/theme";

/**
 * FooterLinkGroup Component
 * Organized footer link section
 */
const FooterLinkGroup = ({ title, links }) => {
  return (
    <motion.div variants={ANIMATIONS.staggerItem}>
      <h4
        style={{
          fontSize: "0.95rem",
          fontWeight: 700,
          color: COLORS.textDark,
          marginBottom: "16px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {title}
      </h4>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {links.map((link, idx) => (
          <li key={idx} style={{ marginBottom: "10px" }}>
            <motion.a
              href="#"
              style={{
                color: COLORS.textLight,
                textDecoration: "none",
                fontSize: "0.9rem",
                display: "inline-block",
                transition: "all 0.3s ease",
              }}
              whileHover={{ x: 4, color: COLORS.primary }}
            >
              {link}
            </motion.a>
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

/**
 * SocialIcon Component
 * Interactive social media link
 */
const SocialIcon = ({ icon: Icon, href, color, label }) => {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
      }}
      whileHover={{ scale: 1.15, y: -4 }}
      whileTap={{ scale: 0.95 }}
    >
      <Icon style={{ width: 18, height: 18, color: "white" }} />
    </motion.a>
  );
};

const footerLinks = {
  Product: ["Features", "Pricing", "Security", "Roadmap", "API Docs"],
  Company: ["About Us", "Blog", "Careers", "Press", "Contact"],
  Resources: ["Documentation", "Community", "Status", "Support", "Cloud"],
  Legal: [
    "Privacy Policy",
    "Terms of Service",
    "Cookie Policy",
    "Disclaimer",
    "License",
  ],
};

const socialLinks = [
  { icon: Github, href: "#", color: COLORS.primary, label: "GitHub" },
  { icon: Linkedin, href: "#", color: COLORS.secondary, label: "LinkedIn" },
  { icon: Twitter, href: "#", color: COLORS.accent, label: "Twitter" },
];

/**
 * FooterSection Component
 * Complete footer with links, social media, and contact information
 */
export default function FooterSection() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "#0f172a",
        color: COLORS.textLight,
        paddingTop: "80px",
        paddingBottom: 0,
      }}
    >
      <div
        style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 20px 60px" }}
      >
        {/* Main Footer Content */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "40px",
            marginBottom: "60px",
          }}
        >
          {/* Brand Section */}
          <motion.div
            variants={ANIMATIONS.staggerItem}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
          >
            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "white",
                marginBottom: "12px",
              }}
            >
              FloatChat
            </h3>
            <p
              style={{
                color: COLORS.textMuted,
                lineHeight: 1.6,
                marginBottom: "16px",
              }}
            >
              Intelligent oceanographic data exploration platform powered by AI
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {socialLinks.map((social, idx) => (
                <SocialIcon key={idx} {...social} />
              ))}
            </div>
          </motion.div>

          {/* Footer Link Groups */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <FooterLinkGroup key={title} title={title} links={links} />
          ))}
        </div>

        {/* Contact Info */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "30px",
            paddingBottom: "60px",
            borderBottom: `1px solid ${COLORS.border}30`,
            marginBottom: "40px",
          }}
          variants={ANIMATIONS.staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          {/* Email */}
          <motion.div
            variants={ANIMATIONS.staggerItem}
            style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}
          >
            <Mail
              style={{
                width: 20,
                height: 20,
                color: COLORS.primary,
                marginTop: "2px",
                flexShrink: 0,
              }}
            />
            <div>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: COLORS.textMuted,
                  marginBottom: "4px",
                }}
              >
                Email
              </p>
              <a
                href="mailto:contact@floatchat.com"
                style={{
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                contact@floatchat.com
              </a>
            </div>
          </motion.div>

          {/* Phone */}
          <motion.div
            variants={ANIMATIONS.staggerItem}
            style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}
          >
            <Phone
              style={{
                width: 20,
                height: 20,
                color: COLORS.secondary,
                marginTop: "2px",
                flexShrink: 0,
              }}
            />
            <div>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: COLORS.textMuted,
                  marginBottom: "4px",
                }}
              >
                Phone
              </p>
              <a
                href="tel:+1234567890"
                style={{
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                +1 (234) 567-890
              </a>
            </div>
          </motion.div>

          {/* Location */}
          <motion.div
            variants={ANIMATIONS.staggerItem}
            style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}
          >
            <MapPin
              style={{
                width: 20,
                height: 20,
                color: COLORS.primary,
                marginTop: "2px",
                flexShrink: 0,
              }}
            />
            <div>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: COLORS.textMuted,
                  marginBottom: "4px",
                }}
              >
                Location
              </p>
              <p style={{ color: "white", fontWeight: 600 }}>Global</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Bottom Footer */}
        <motion.div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
            paddingBottom: "20px",
            color: COLORS.textMuted,
            fontSize: "0.85rem",
          }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p>© {currentYear} FloatChat. All rights reserved.</p>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <a
              href="#"
              style={{
                color: COLORS.textMuted,
                textDecoration: "none",
                transition: "color 0.3s",
              }}
              onMouseEnter={(e) => (e.target.style.color = "white")}
              onMouseLeave={(e) => (e.target.style.color = COLORS.textMuted)}
            >
              Privacy
            </a>
            <a
              href="#"
              style={{
                color: COLORS.textMuted,
                textDecoration: "none",
                transition: "color 0.3s",
              }}
              onMouseEnter={(e) => (e.target.style.color = "white")}
              onMouseLeave={(e) => (e.target.style.color = COLORS.textMuted)}
            >
              Terms
            </a>
            <a
              href="#"
              style={{
                color: COLORS.textMuted,
                textDecoration: "none",
                transition: "color 0.3s",
              }}
              onMouseEnter={(e) => (e.target.style.color = "white")}
              onMouseLeave={(e) => (e.target.style.color = COLORS.textMuted)}
            >
              Cookies
            </a>
          </div>
        </motion.div>
      </div>

      {/* Decorative Background */}
      <motion.div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "200px",
          background: `linear-gradient(180deg, transparent, ${COLORS.primaryDark}10)`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </footer>
  );
}
