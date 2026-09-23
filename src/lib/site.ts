export const SITE = {
  name: "Pine Wood",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  timeZone: "Asia/Dhaka",
  address: {
    en: "House 19, Road 12 (old 31), Dhanmondi R/A, Dhaka",
    bn: "বাড়ি ১৯, রোড ১২ (পুরাতন ৩১), ধানমন্ডি আ/এ, ঢাকা",
    landmark: {
      en: "Beside the road to Metro Shopping Mall",
      bn: "মেট্রো শপিং মলের রাস্তার পাশে",
    },
  },
  mapQuery: "Pinewood Cafe n' Restaurant, House 19, Road 12, Dhanmondi, Dhaka",
  phones: [
    { display: "01914-426939", tel: "+8801914426939" },
    { display: "01708-524991", tel: "+8801708524991" },
  ],
  social: {
    facebook: "https://www.facebook.com/pinewoodcafebd",
  },
  booking: {
    durations: [60, 90, 120, 180, 240] as const,
    defaultDuration: 90,
    maxOnlineParty: 10,
    holdMinutes: 10,
    preorderCutoffMinutes: 60,
  },
} as const;

export const PHOTOS: Record<string, string | null> = {
  // Drop real photography into /public/images and set the path here, e.g. "/images/fireplace.jpg".
  hero: null,
  fireplace: null,
  study: null,
  rooftop: null,
  timber: null,
  coffee: null,
};
