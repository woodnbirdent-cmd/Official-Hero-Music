export const SITE = {
  name: "Official #Hero Music",
  domain: "officialheromusic.com",
  url: "https://officialheromusic.com",
  artist: "#Hero",
  legalName: "Christopher James Killion",
  location: "Jefferson City, Missouri",
  label: "Yahfamilia / YahFamilia Music",
  genre: "Christian hip-hop (CHH)",
  tagline: "Praise God I am who I am and not who I was",
  description:
    "Official #Hero Music — Christian hip-hop from Jefferson City, MO. Raw redemption testimony. Yahfamilia.",
} as const;

export const BIO =
  "Hailing from Jefferson City, Missouri, Christian hip-hop artist #Hero builds his sound entirely on real-life testimony and unyielding faith. Delivered from addiction, prison, and homelessness, he found new life and purpose in Christ. Today, as a dedicated husband and father of two, he operates with a fierce refusal to compromise his morals or spiritual foundation. In under a year of releasing music, #Hero has generated remarkable momentum across the CHH community, using his platform to share a raw, uncompromised message of hope, freedom, and the transforming power of Jesus.";

export const SOCIALS = [
  { name: "X", href: "https://x.com/HeroMusicPage", label: "X / Twitter" },
  {
    name: "Facebook",
    href: "https://www.facebook.com/heromusicpage",
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
export const APPLE_MUSIC_ARTIST_ID = "1788835254";
export const YOUTUBE_CHANNEL_ID = "UCWs5_tZF0omLCDNNpdyEPBg";
export const HERO_YOUTUBE_ID = "aw3msUsu1g0";
export const YOUTUBE_VIDEOS = [
  { id: "aw3msUsu1g0", title: "Sumn (Official Video)" },
  { id: "1KevZBcEefI", title: "#Hero — Official Video" },
  { id: "YzbdSLIpsmQ", title: "#Hero — Official Video 2" },
] as const;

export const BANDSINTOWN = {
  artistId: "15652709",
  artistName: "#hero",
  widgetArtist: "id_15652709",
  appId: "officialheromusic.com",
  shortUrl: "https://bnds.us/rsfpvy",
  pageUrl: "https://www.bandsintown.com/a/15652709",
  trackUrl:
    "https://www.bandsintown.com/a/15652709?came_from=257&utm_medium=web&utm_source=officialheromusic&utm_campaign=tour&trigger=track",
} as const;

export const STREAMING = [
  {
    name: "Spotify",
    href: `https://open.spotify.com/artist/${SPOTIFY_ARTIST_ID}`,
  },
  {
    name: "Apple Music",
    href: `https://music.apple.com/us/artist/hero/${APPLE_MUSIC_ARTIST_ID}`,
  },
  {
    name: "YouTube Music",
    href: `https://music.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`,
  },
  {
    name: "YouTube",
    href: `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`,
  },
] as const;

export const SHORT_BIO =
  "Hailing from Jefferson City, Missouri, Christian hip-hop artist #Hero builds his sound entirely on real-life testimony and unyielding faith. Delivered from addiction, prison, and homelessness, he found new life and purpose in Christ.";

export const FYC = {
  title: "GRAMMY® FYC 2027",
  category: "Best New Artist",
  framing:
    "Independent recording artist #Hero presents his official entry for Best New Artist consideration. Defined by a distinctive blend of raw lyricism and cutting-edge production, #Hero brings an authentic, genre-bending voice to contemporary music, capturing the pulse of modern culture through uncompromising testimony.",
  highlights: [
    {
      title: "Uncompromising Integrity & Faith",
      body: "Centered on a steadfast commitment to personal morals, spiritual foundation, and creative autonomy, refusing to dilute the message for commercial shortcuts.",
    },
    {
      title: "Rapid Cultural Impact",
      body: "Generating significant gravity and momentum across the Christian Hip-Hop (CHH) community through a relentless release schedule in under a year.",
    },
    {
      title: "Authentic Underground Roots",
      body: "Building a fiercely organic following driven entirely by raw lyrical transparency and dedication to the lord. While being used as a tool with his testimony.",
    },
  ],
} as const;

export const PRESS_ASSETS = [
  { src: "/logo-hero.png", label: "Wordmark", kind: "logo", width: 840, height: 320 },
  { src: "/logo-full.png", label: "Full logo", kind: "logo", width: 640, height: 240 },
  { src: "/logo-mark.png", label: "Mark", kind: "logo", width: 256, height: 256 },
  { src: "/site-logo.png", label: "Site logo", kind: "logo", width: 512, height: 512 },
  { src: "/photo-1.jpg", label: "Press photo 1", kind: "photo", width: 1600, height: 2000 },
  { src: "/photo-2.jpg", label: "Press photo 2", kind: "photo", width: 1400, height: 1750 },
] as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/music", label: "Music" },
  { href: "/playlist", label: "Playlist" },
  { href: "/reviews", label: "Reviews" },
  { href: "/tour", label: "Tour" },
  { href: "/videos", label: "Videos" },
  { href: "/merch", label: "Merch" },
  { href: "/community", label: "Community" },
  { href: "/join", label: "Join" },
  { href: "/account", label: "Account" },
  { href: "/booking", label: "Booking" },
  { href: "/epk", label: "EPK" },
] as const;

/** #Hero playlist that accepts outside submissions. */
export const FIRE_PLAYLIST = {
  name: "Christian Rap That's Actually Fire",
  /**
   * Public Spotify playlist URL.
   * Still missing: replace this empty string with the open.spotify.com/playlist link.
   */
  spotifyUrl: "",
} as const;

export const PLAYLIST_OPTIONS = [
  {
    id: "listen",
    name: "Listen and decide",
    priceCents: 1500,
    summary:
      "He listens and decides if the track is a good fit. Placement is not guaranteed.",
    checkoutName: "Playlist submission — listen and decide",
  },
  {
    id: "guaranteed",
    name: "Guaranteed placement",
    priceCents: 4000,
    summary: "Guaranteed placement on the playlist.",
    checkoutName: "Playlist submission — guaranteed placement",
  },
] as const;

export type PlaylistOptionId = (typeof PLAYLIST_OPTIONS)[number]["id"];

export function getPlaylistOption(id: string) {
  return PLAYLIST_OPTIONS.find((option) => option.id === id);
}

/** Live-stream review show. The card image is still a placeholder screenshot. */
export const ROLLOUT_HEAVEN = {
  show: "Rollout Heaven",
  image: "/reviews/rollout-heaven-placeholder.png",
  imageAlt: "Placeholder frame for a Rollout Heaven live-stream screenshot",
  watchUrl: "https://rolloutheaven.com/hero",
} as const;
