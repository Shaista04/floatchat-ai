import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Stats from "../components/Stats";
import Features from "../components/Features";
import TechStack from "../components/TechStack";
import About from "../components/About";
import Footer from "../components/Footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
        <TechStack />
        <About />
      </main>
      <Footer />
    </>
  );
}
