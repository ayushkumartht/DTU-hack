import Link from "next/link";
import { ThemeToggleButton } from "./ThemeToggleButton";
import styles from "./LandingPage.module.css";

const FEATURES = [
  {
    title: "Local vector search",
    text: "147 quotes from Belur Math, matched to your situation by a local, on-device search index.",
  },
  {
    title: "Groq-generated parables",
    text: "A wisdom story written for your exact struggle, in Hindi or English, turning point drawn from Vivekananda's own words.",
  },
  {
    title: "Scene-by-scene visuals",
    text: "Every story is broken into key moments and illustrated one at a time in Studio Ghibli style.",
  },
];

export function LandingPage() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.wordmark}>learning of vivekanand</span>
        <ThemeToggleButton />
      </nav>

      <main className={styles.hero}>
        <img
          src="/header-banner.webp"
          alt="Pixel-art illustration of an ancient Indian temple complex set among misty mountains"
          className={styles.heroImage}
        />
        <h1 className={styles.title}>learning of vivekanand</h1>
        <div className={styles.divider} />
        <p className={styles.subtitle}>
          Describe your current struggle or situation in <strong>Hindi</strong> or <strong>English</strong>.
          Our local vector search finds matching quotes from Belur Math, and Groq generates a personalized
          story, illustrated scene by scene in Studio Ghibli style.
        </p>
        <Link href="/story-board" className={styles.cta}>
          Open the story board
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </main>

      <section className={styles.features}>
        {FEATURES.map((feature) => (
          <div key={feature.title} className={styles.feature}>
            <span className={styles.featureDot} />
            <h3 className={styles.featureTitle}>{feature.title}</h3>
            <p className={styles.featureText}>{feature.text}</p>
          </div>
        ))}
      </section>

      <footer className={styles.footer}>
        <p>Inspired by the life and teachings of Swami Vivekananda.</p>
      </footer>
    </div>
  );
}
