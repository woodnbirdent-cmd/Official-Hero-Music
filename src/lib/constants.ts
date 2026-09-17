export const SITE = {
  name: "Official #Hero Music",
  domain: "officialheromusic.com",
  url: "https://officialheromusic.com",
  artist: "#Hero",
  legalName: "Christopher James Killion",
  location: "Jefferson City, Missouri",
  label: "Yahfamilia / YahFamilia Music",
  genre: "Christian hip-hop (CHH)",
  tagline: "I ain't who I used to be.",
  description:
    "Official #Hero Music — Christian hip-hop from Jefferson City, MO. Raw redemption testimony. Yahfamilia.",
} as const;

export const BIO =
  "Hailing from Jefferson City, Missouri, Christian hip-hop artist #Hero builds his sound entirely on real-life testimony and unyielding faith. Delivered from addiction, prison, and homelessness, he found new life and purpose in Christ. Today, as a dedicated husband and father of two, he operates with a fierce refusal to compromise his morals or spiritual foundation. In under a year of releasing music, #Hero has generated remarkable momentum across the CHH community, using his platform to share a raw, uncompromised message of hope, freedom, and the transforming power of Jesus.";

export const SOCIALS = [
  { name: "X", href: "https://x.com/HeroMusicPage", label: "X / Twitter" },
  {
    name: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61565827945921",
    label: "Facebook",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/herothehero313/",
    label: "Instagram",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/channel/UCWs5_tZF0omLCDNNpdyEPBg",
    label: "YouTube",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@christopherjames313",
    label: "TikTok",
  },
] as const;

export const SPOTIFY_ARTIST_ID = "2RBbpq5Ew0Dys73bn7mdTN";
export const YOUTUBE_CHANNEL_ID = "UCWs5_tZF0omLCDNNpdyEPBg";
export const YOUTUBE_VIDEOS = [
  { id: "1KevZBcEefI", title: "#Hero — Official Video" },
  { id: "YzbdSLIpsmQ", title: "#Hero — Official Video 2" },
] as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/music", label: "Music" },
  { href: "/videos", label: "Videos" },
  { href: "/merch", label: "Merch" },
  { href: "/community", label: "Community" },
  { href: "/support", label: "Support" },
  { href: "/join", label: "Join" },
  { href: "/booking", label: "Booking" },
] as const;

export const SUPPORT_TIERS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    description: "Stay connected. Mailing list updates, new drops, and prayer community.",
    features: [
      "New release alerts",
      "Community prayer wall access",
      "Social follow links",
    ],
    cta: "Join free",
    href: "/join",
    highlighted: false,
    stripePriceEnv: null,
  },
  {
    id: "support",
    name: "Support",
    price: "$7",
    period: "/mo",
    description: "Fuel the mission. Help #Hero keep releasing uncompromised CHH.",
    features: [
      "Everything in Free",
      "Supporter shout-outs",
      "Early listen access (when available)",
      "Exclusive updates",
    ],
    cta: "Become a supporter",
    href: "#stripe-todo",
    highlighted: true,
    stripePriceEnv: "STRIPE_PRICE_SUPPORT",
  },
  {
    id: "inner-circle",
    name: "Inner Circle",
    price: "$25",
    period: "/mo",
    description: "Walk closer. Deeper access for those locked in with the vision.",
    features: [
      "Everything in Support",
      "Inner Circle community access",
      "Behind-the-scenes content",
      "Priority booking / collab consideration",
    ],
    cta: "Join Inner Circle",
    href: "#stripe-todo",
    highlighted: false,
    stripePriceEnv: "STRIPE_PRICE_INNER_CIRCLE",
  },
] as const;
