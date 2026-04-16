import Reveal from "../components/Reveal.jsx";
import {
  FacebookIcon,
  InstagramIcon,
  PawIcon,
  WhatsAppIcon,
} from "../components/Icons.jsx";
import HomepageSlider from "../components/HomepageSlider.jsx";
import WhySlider from "../components/WhySlider.jsx";
import { Link } from "react-router-dom";
import pawganicLogo from "../../imgs/PawganicLogo.jpg";
import ingredientsImage from "../../imgs/Ingredients/ing01.jpeg";

const WHATSAPP_NUMBER = "96181243040";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}`;

const socials = {
  instagram: "https://www.instagram.com/pawganicfood/",
  facebook: "https://www.facebook.com/pawganicfood",
};

function Container({ className = "", children }) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-5 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <div className="text-xs font-semibold tracking-[0.18em] text-forest/70">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="mt-3 font-serif text-3xl leading-tight text-slate-900 sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-slate-700 sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/70 px-4 py-2 text-sm text-slate-700 shadow-soft backdrop-blur">
      <span className="text-forest">
        <PawIcon className="h-4 w-4" />
      </span>
      {children}
    </span>
  );
}

function PrimaryButton({ href, children }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-forest/95 focus:outline-none focus:ring-4 focus:ring-forest/20"
    >
      <span className="text-cream">
        <WhatsAppIcon className="h-5 w-5" />
      </span>
      {children}
    </a>
  );
}

function SoftButton({ href, icon: Icon, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-soft transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-forest/15"
    >
      <Icon className="h-5 w-5 text-forest" />
      {children}
    </a>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-forest/10 bg-cream/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <a href="#top" className="group inline-flex items-center gap-2">
          <img
            src={pawganicLogo}
            alt="Pawganic"
            className="h-10 w-auto object-contain"
          />
          <span className="hidden rounded-full bg-carrot/15 px-2 py-1 text-xs font-semibold text-carrot sm:inline">
            Homemade Organic
          </span>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-700 md:flex">
          <a className="hover:text-forest" href="#benefits">
            Benefits
          </a>
          <a className="hover:text-forest" href="#ingredients">
            Ingredients
          </a>
          <a className="hover:text-forest" href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            Order Now
          </a>
          <Link className="text-forest/70 hover:text-forest" to="/login">
            Team login
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={socials.instagram}
            aria-label="Instagram"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest/10 bg-white/70 text-slate-800 shadow-soft transition hover:bg-white"
          >
            <InstagramIcon />
          </a>
          <a
            href={socials.facebook}
            aria-label="Facebook"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest/10 bg-white/70 text-slate-800 shadow-soft transition hover:bg-white"
          >
            <FacebookIcon />
          </a>
        </div>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section className="pawganic-grain relative overflow-hidden pb-14 pt-12 sm:pb-20 sm:pt-16">
      <Container className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Reveal>
              <div className="flex flex-wrap gap-2">
                <Pill>Organic, fresh, and trustworthy</Pill>
                <Pill>Small-batch • Made with care</Pill>
              </div>
            </Reveal>

            <Reveal delayMs={80}>
              <h1 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
                Fresh, Homemade Organic Meals for Your Best Friend.
              </h1>
            </Reveal>

            <Reveal delayMs={140}>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-700 sm:text-lg">
                No preservatives. No fillers. Just high-quality meats, fresh
                vegetables, and Omega-3 for a healthier, happier dog.
              </p>
            </Reveal>

            <Reveal delayMs={200}>
              <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <PrimaryButton href={WHATSAPP_LINK}>Order on WhatsApp</PrimaryButton>
                <div className="text-sm text-slate-600">
                  Fast replies • Custom portions • Weekly pickup/delivery
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delayMs={180}>
            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-forest/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-3xl border border-forest/10 bg-white shadow-soft">
                <div className="p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">
                      <span className="h-2 w-2 rounded-full bg-forest" />
                      Today’s batch
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      100% human-grade
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {[
                      { name: "Fresh Chicken", note: "Lean protein" },
                      { name: "Carrots", note: "Vitamin A boost" },
                      { name: "Spinach", note: "Iron + antioxidants" },
                      { name: "Omega-3 Oils", note: "Coat + joints" },
                    ].map((item) => (
                      <div
                        key={item.name}
                        className="rounded-2xl border border-slate-200 bg-cream px-4 py-4"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {item.name}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {item.note}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-2xl border border-carrot/20 bg-carrot/10 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Simple ingredients. Visible results.
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      Designed for better digestion, brighter energy, and
                      shinier coats.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function Benefits() {
  const benefits = [
    {
      title: "Human-Grade Ingredients",
      text: "Only real meats and fresh vegetables you’d recognize—carefully sourced and gently cooked for quality you can trust.",
    },
    {
      title: "Tailored Nutrition",
      text: "Balanced for all breeds with mindful sodium levels and a macro profile that supports everyday health and longevity.",
    },
    {
      title: "Visible Results",
      text: "Many owners notice shinier coats, steadier energy, and happier mealtimes thanks to clean, nutrient-rich recipes.",
    },
  ];

  return (
    <section id="benefits" className="py-14 sm:py-20">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-stretch lg:gap-12">
          <div className="min-w-0">
            <Reveal>
              <SectionHeading
                eyebrow="Why Pawganic"
                title="Good food is the foundation of a great life."
                description="Pawganic is built around simple, organic-minded recipes that prioritize digestion, skin & coat health, and feel-good energy."
              />
            </Reveal>

            <Reveal delayMs={80}>
              <div className="mx-auto mt-8 w-full max-w-[90%] sm:max-w-[520px] lg:hidden">
                <WhySlider />
              </div>
            </Reveal>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {benefits.slice(0, 2).map((b, i) => (
                <Reveal key={b.title} delayMs={120 + i * 80}>
                  <div className="h-full rounded-3xl border border-forest/10 bg-white p-6 shadow-soft">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/10 text-forest">
                      <PawIcon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 font-serif text-xl text-slate-900">
                      {b.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-700">
                      {b.text}
                    </p>
                  </div>
                </Reveal>
              ))}

              <Reveal delayMs={280}>
                <div className="sm:col-span-2 rounded-3xl border border-forest/10 bg-white p-6 shadow-soft">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/10 text-forest">
                    <PawIcon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-serif text-xl text-slate-900">
                    {benefits[2].title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {benefits[2].text}
                  </p>
                </div>
              </Reveal>
            </div>
          </div>

          <Reveal delayMs={120}>
            <div className="hidden w-full lg:block lg:self-stretch">
              <WhySlider fill />
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function Ingredients() {
  const groups = [
    {
      title: "Protein sources",
      items: ["Meat", "Chicken", "Fish"],
      accent: "bg-forest/10 text-forest",
    },
    {
      title: "Vegetables & carbs",
      items: [
        "Carrots",
        "Zucchini",
        "Green peas",
        "Sweet potatoes",
        "Potatoes",
        "Rice",
      ],
      accent: "bg-carrot/15 text-carrot",
    },
    {
      title: "Supplements",
      items: ["Omega-3 oil"],
      accent: "bg-forest/10 text-forest",
    },
  ];

  return (
    <section id="ingredients" className="py-14 sm:py-20">
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
          <div className="min-w-0">
            <Reveal>
              <SectionHeading
                eyebrow="Ingredients"
                title="Real ingredients, real nutrition."
                description="A balanced mix of high-quality proteins and fresh vegetables, carefully prepared to support your dog’s health, energy, and wellbeing."
              />

              <div className="mt-7 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-soft">
                  No preservatives
                </span>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-soft">
                  No fillers
                </span>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-soft">
                  Gentle cooking
                </span>
              </div>
            </Reveal>

            <Reveal delayMs={80}>
              <div className="mx-auto mt-7 w-full max-w-[90%] overflow-hidden rounded-3xl border border-forest/10 bg-white p-3 shadow-soft sm:max-w-[440px] lg:hidden">
                <div className="aspect-square overflow-hidden rounded-2xl bg-cream">
                  <img
                    src={ingredientsImage}
                    alt="Fresh Pawganic ingredients"
                    className="h-full w-full object-cover object-center"
                    loading="lazy"
                  />
                </div>
              </div>
            </Reveal>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {groups.map((group, i) => (
                <Reveal key={group.title} delayMs={140 + i * 80}>
                  <div className="rounded-3xl border border-forest/10 bg-white p-6 shadow-soft">
                    <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${group.accent}`}>
                      Key ingredient
                    </div>
                    <div className="mt-4">
                      <div className="font-serif text-2xl text-slate-900">
                        {group.title}
                      </div>
                      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-700">
                        {group.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-forest/70" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delayMs={80}>
            <div className="hidden w-full lg:block lg:self-start lg:justify-self-end">
              <div className="w-full max-w-[420px] overflow-hidden rounded-3xl border border-forest/10 bg-white p-3 shadow-soft">
                <div className="aspect-square overflow-hidden rounded-2xl bg-cream">
                  <img
                    src={ingredientsImage}
                    alt="Fresh Pawganic ingredients"
                    className="h-full w-full object-cover object-center"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-forest/10 bg-white/60 py-12">
      <Container>
        <div className="grid gap-10 md:grid-cols-3 md:items-start">
          <div>
            <div className="inline-flex items-center gap-2">
              <img
                src={pawganicLogo}
                alt="Pawganic"
                className="h-10 w-auto object-contain"
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Homemade organic-inspired meals, crafted with real ingredients and
              real care.
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">Contact</div>
            <div className="mt-3 text-sm text-slate-700">
              WhatsApp: <span className="font-semibold">+961 81 243 040</span>
            </div>
            <div className="mt-4">
              <a
                href={WHATSAPP_LINK}
                className="text-sm font-semibold text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest"
              >
                Message us on WhatsApp
              </a>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">Quick links</div>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <a className="text-slate-700 hover:text-forest" href="#benefits">
                Benefits
              </a>
              <a className="text-slate-700 hover:text-forest" href="#ingredients">
                Ingredients
              </a>
              <a className="text-slate-700 hover:text-forest" href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                Order Now
              </a>
              <Link className="text-slate-700 hover:text-forest" to="/login">
                Team login
              </Link>
              <div className="mt-3 flex items-center gap-3">
                <a
                  href={socials.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-slate-700 hover:text-forest"
                >
                  <InstagramIcon className="h-5 w-5" />
                  Instagram
                </a>
                <a
                  href={socials.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-slate-700 hover:text-forest"
                >
                  <FacebookIcon className="h-5 w-5" />
                  Facebook
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-xs text-slate-500">
          © {new Date().getFullYear()} Pawganic. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}

function FloatingWhatsApp() {
  return (
    <a
      href={WHATSAPP_LINK}
      aria-label="Order on WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-forest text-cream shadow-soft transition hover:bg-forest/95 focus:outline-none focus:ring-4 focus:ring-forest/20"
    >
      <WhatsAppIcon className="h-6 w-6" />
    </a>
  );
}

export default function MarketingSite() {
  return (
    <div id="top" className="min-h-screen bg-cream">
      <Nav />
      <main>
        <HomepageSlider />
        <Hero />
        <Benefits />
        <Ingredients />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}
