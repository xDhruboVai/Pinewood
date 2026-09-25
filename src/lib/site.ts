export const SITE = {
  name: "Pinewood Cafe + Kitchen",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  timeZone: "Asia/Dhaka",
  /** Used for the Google Maps reviews link (the brand, not one outlet). Addresses live in OUTLETS. */
  mapQuery: "Pinewood Cafe + Kitchen, Dhanmondi, Dhaka",
  /** General Pinewood numbers. Not yet confirmed which outlet each belongs to. */
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

/**
 * Pinewood outlets in Dhaka (Visit us, the booking form and the footer). As of 25 September 2026 there
 * are three: Dhanmondi Road 6, Dhanmondi Road 27 and Banani (Road 12 closed). The Dhanmondi addresses
 * are confirmed by Saalim; the Banani address still needs confirming. Both take bookings: the form asks which outlet and passes it to staff in the booking's notes,
 * because the booking system itself only knows one restaurant (one pool of seats) for now.
 * `confirmed: false` outlets would only show while developing.
 */
export interface Outlet {
  slug: string;
  name: { en: string; bn: string };
  address: { en: string; bn: string };
  landmark?: { en: string; bn: string };
  mapQuery: string;
  phones?: readonly { display: string; tel: string }[];
  confirmed: boolean;
}

export const OUTLETS: Outlet[] = [
  {
    slug: "dhanmondi-6",
    name: { en: "Dhanmondi, Road 6", bn: "ধানমন্ডি, রোড ৬" },
    address: { en: "House 4, Road 6, Dhanmondi, Dhaka", bn: "বাড়ি ৪, রোড ৬, ধানমন্ডি, ঢাকা" },
    mapQuery: "Pinewood Cafe + Kitchen, House 4, Road 6, Dhanmondi, Dhaka",
    confirmed: true,
  },
  {
    slug: "dhanmondi-27",
    name: { en: "Dhanmondi, Road 27", bn: "ধানমন্ডি, রোড ২৭" },
    address: { en: "House 352, Road 27 (new 16), Dhanmondi R/A, Dhaka", bn: "বাড়ি ৩৫২, রোড ২৭ (নতুন ১৬), ধানমন্ডি আ/এ, ঢাকা" },
    mapQuery: "Pinewood Cafe + Kitchen, House 352, Road 27, Dhanmondi, Dhaka",
    confirmed: true,
  },
  {
    // Branch confirmed by Saalim (25 September 2026). The address is from public listings; confirm it.
    slug: "banani",
    name: { en: "Banani", bn: "বনানী" },
    address: { en: "House 48, Road 13C, Banani, Dhaka 1213", bn: "বাড়ি ৪৮, রোড ১৩সি, বনানী, ঢাকা ১২১৩" },
    mapQuery: "Pinewood Cafe + Kitchen, House 48, Road 13C, Banani, Dhaka",
    confirmed: true,
  },
];

/** Outlets to show: confirmed ones, plus unconfirmed ones while developing. */
export const visibleOutlets = () => OUTLETS.filter((o) => o.confirmed || process.env.NODE_ENV !== "production");

export const mapsSearchUrl = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
export const mapsDirectionsUrl = (query: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

/** Dishes (menu slugs) that have a real photo, used by the dish cards. */
export const DISH_PHOTOS: Record<string, PhotoName> = {
  "pine-3": "hero",
  "american-mac-cheese": "macAndCheese",
  "pine-2": "pine2",
  "club-sandwich": "clubSandwich",
  "seafood-platter": "seafoodPlatter",
  "fish-cake": "fishCake",
  "mexican-chicken": "mexicanChicken",
  "grilled-cheesy-buffalo-chicken": "buffaloChickenSet",
  "chicken-cheese-burger": "chickenCheeseBurger",
  "pine-5": "shashlikSet",
  brownie: "brownieReal",
  "oreo-cheesecake": "oreoCheesecakeReal",
  cappuccino: "cappuccino",
};

/**
 * Real photos in /public/images. Captions and alt text live in the dictionaries under `photos`.
 * The cappuccino and cake crops come from the printed menu; the rest were supplied by Pinewood.
 */
export const PHOTOS = {
  hero: { src: "/images/pine3-fish-steak.webp", width: 1500, height: 1000 },
  coffeeCounter: { src: "/images/photos/coffee-counter.webp", width: 1600, height: 1067 },
  muralRoom: { src: "/images/photos/mural-room.webp", width: 1600, height: 1067 },
  windowRoom: { src: "/images/photos/window-room.webp", width: 1600, height: 1067 },
  brickRoom: { src: "/images/photos/brick-room.webp", width: 1600, height: 1067 },
  outdoorBench: { src: "/images/photos/outdoor-bench.webp", width: 1127, height: 1500 },
  swingCorner: { src: "/images/photos/swing-corner.webp", width: 1203, height: 1600 },
  team: { src: "/images/photos/team.webp", width: 1280, height: 673 },
  foodTable: { src: "/images/photos/food-table.webp", width: 1206, height: 1600 },
  chickenPlate: { src: "/images/photos/chicken-plate.webp", width: 1206, height: 1600 },
  penne: { src: "/images/photos/penne.webp", width: 1203, height: 1600 },
  macAndCheese: { src: "/images/photos/mac-and-cheese.webp", width: 1440, height: 1916 },
  soup: { src: "/images/photos/soup.webp", width: 1203, height: 1600 },
  brownie: { src: "/images/photos/brownie.webp", width: 1536, height: 1024 },
  // Added September 2026 from Media/New Media and Media/Online Assets (see CLAUDE.md on where they came from).
  setMenus: { src: "/images/photos/set-menus.webp", width: 680, height: 510 },
  steakPlate: { src: "/images/photos/steak-plate.webp", width: 382, height: 510 },
  coffeeCup: { src: "/images/photos/coffee-cup.webp", width: 630, height: 510 },
  chickenRicePlate: { src: "/images/photos/chicken-rice-plate.webp", width: 680, height: 510 },
  clubSandwich: { src: "/images/photos/club-sandwich.webp", width: 680, height: 497 },
  clubSandwichPlatter: { src: "/images/photos/club-sandwich-platter.webp", width: 395, height: 510 },
  balcony: { src: "/images/photos/balcony.webp", width: 680, height: 510 },
  breakfastPlate: { src: "/images/photos/breakfast-plate.webp", width: 680, height: 510 },
  potatoWedges: { src: "/images/photos/potato-wedges.webp", width: 382, height: 510 },
  brownieReal: { src: "/images/photos/brownie-real.webp", width: 1000, height: 1333 },
  pine2: { src: "/images/photos/pine-2.webp", width: 1000, height: 1333 },
  oreoCheesecakeReal: { src: "/images/photos/oreo-cheesecake-real.webp", width: 1000, height: 1333 },
  artRoom: { src: "/images/photos/art-room.webp", width: 960, height: 540 },
  spaghetti: { src: "/images/photos/spaghetti.webp", width: 1000, height: 1013 },
  seafoodPlatter: { src: "/images/photos/seafood-platter.webp", width: 1080, height: 1080 },
  skewerPlate: { src: "/images/photos/skewer-plate.webp", width: 393, height: 393 },
  // Added 25 September 2026 from Pinewood's own Facebook posts ("25-9-26 new media"). The food shots
  // are cropped out of their designed posters, without the poster text.
  flowerCorner: { src: "/images/photos/flower-corner.webp", width: 1600, height: 1200 },
  fishCake: { src: "/images/photos/fish-cake.webp", width: 642, height: 780 },
  mexicanChicken: { src: "/images/photos/mexican-chicken.webp", width: 654, height: 845 },
  buffaloChickenSet: { src: "/images/photos/buffalo-chicken-set.webp", width: 699, height: 560 },
  chickenCheeseBurger: { src: "/images/photos/chicken-cheese-burger.webp", width: 1014, height: 540 },
  shashlikSet: { src: "/images/photos/shashlik-set.webp", width: 1060, height: 465 },
  steakSet: { src: "/images/photos/steak-set.webp", width: 880, height: 595 },
  alfredoBake: { src: "/images/photos/alfredo-bake.webp", width: 542, height: 735 },
  seafoodPlatterPost: { src: "/images/photos/seafood-platter-post.webp", width: 856, height: 578 },
  cappuccinoPost: { src: "/images/photos/cappuccino-post.webp", width: 554, height: 418 },
  cappuccino: { src: "/images/cappuccino.webp", width: 530, height: 470 },
  oreoCheesecake: { src: "/images/oreo-cheesecake.webp", width: 446, height: 236 },
  redVelvet: { src: "/images/red-velvet.webp", width: 431, height: 260 },
} as const;

export type PhotoName = keyof typeof PHOTOS;
