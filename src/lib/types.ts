export type Locale = "en" | "bn";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "rejected"
  | "expired"
  | "no_show";

export type PreOrderStatus = "submitted" | "acknowledged" | "preparing" | "ready" | "served" | "cancelled";

export type MenuSection = "starters" | "mains" | "coffee" | "desserts" | "beverages";

export type MenuTag = "halal" | "vegetarian" | "chef_special" | "spicy" | "seafood" | "contains_nuts";

export type StaffRole = "manager" | "foh";

export interface Area {
  id: string;
  slug: string;
  name_en: string;
  name_bn: string;
  description_en: string | null;
  description_bn: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface DiningTable {
  id: string;
  area_id: string;
  label: string;
  seats: number;
  is_active: boolean;
}

export interface MenuVariant {
  id: string;
  item_id: string;
  name_en: string;
  name_bn: string;
  price_delta: number;
  is_default: boolean;
  sort_order: number;
}

export interface MenuAddon {
  id: string;
  item_id: string;
  name_en: string;
  name_bn: string;
  price: number;
  is_available: boolean;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  slug: string;
  name_en: string;
  name_bn: string;
  description_en: string | null;
  description_bn: string | null;
  price: number;
  image_url: string | null;
  tags: MenuTag[];
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  menu_item_variants: MenuVariant[];
  menu_item_addons: MenuAddon[];
}

export interface MenuCategory {
  id: string;
  slug: string;
  section: MenuSection;
  name_en: string;
  name_bn: string;
  sort_order: number;
  menu_items: MenuItem[];
}

export interface Review {
  id: string;
  author_name: string;
  author_context: string | null;
  rating: number;
  body_en: string;
  body_bn: string | null;
}

export interface AvailabilitySlot {
  slot_start: string;
  slot_end: string;
  area_id: string;
  capacity: number;
  remaining: number;
  available: boolean;
  waitlist_eligible: boolean;
}

export interface ScheduleDay {
  day: string;
  opens: string | null;
  closes: string | null;
  label: string | null;
}

export interface AdminReservation {
  id: string;
  reference: string;
  status: ReservationStatus;
  source: "web" | "waitlist" | "staff";
  starts_at: string;
  ends_at: string;
  party_size: number;
  large_party: boolean;
  customer_name: string;
  phone: string;
  email: string;
  special_requests: string | null;
  locale: Locale;
  expires_at: string | null;
  confirmed_at: string | null;
  cancel_requested_at: string | null;
  cancel_reason: string | null;
  staff_notes: string | null;
  created_at: string;
  area: { id: string; slug: string; name: string };
  tables: { id: string; label: string; seats: number }[];
  history: { bookings: number; visits: number; no_shows: number; cancellations: number };
  pre_order: { id: string; status: PreOrderStatus; total: number; item_count: number } | null;
  last_email: { kind: string; status: string; at: string; error: string | null } | null;
}

export interface AdminPreOrder {
  id: string;
  status: PreOrderStatus;
  notes: string | null;
  total: number;
  submitted_at: string;
  reservation: {
    id: string;
    reference: string;
    status: ReservationStatus;
    customer_name: string;
    phone: string;
    party_size: number;
    starts_at: string;
    area: string;
    tables: string[];
  };
  items: {
    id: string;
    name: string;
    variant: string | null;
    addons: string[];
    quantity: number;
    notes: string | null;
    line_total: number;
  }[];
}

export interface WaitlistEntry {
  id: string;
  area_id: string;
  starts_at: string;
  ends_at: string;
  party_size: number;
  large_party: boolean;
  customer_name: string;
  phone: string;
  email: string;
  status: "waiting" | "promoted" | "cancelled" | "expired";
  created_at: string;
}

export interface Blockout {
  id: string;
  area_id: string | null;
  starts_at: string;
  ends_at: string;
  seats: number | null;
  reason: string;
}

export interface HoursOverride {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
}

export interface OpeningHours {
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
}

export interface StaffProfile {
  user_id: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
}

export interface Analytics {
  daily_covers: { day: string; covers: number; bookings: number }[];
  peak_hours: { hour: number; covers: number }[];
  top_items: { name: string; quantity: number; revenue: number }[];
  totals: { requests: number; confirmed: number; no_shows: number; expired: number; covers: number };
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
