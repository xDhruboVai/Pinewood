export type EmailKind = "received" | "waitlist_promoted" | "confirmed" | "cancelled" | "reminder";

export interface ReservationForEmail {
  id: string;
  reference: string;
  status: string;
  starts_at: string;
  ends_at: string;
  party_size: number;
  large_party: boolean;
  customer_name: string;
  phone: string;
  locale: "en" | "bn";
  cancel_reason: string | null;
  area: { name_en: string; name_bn: string } | null;
}

interface Context {
  manageUrl: string;
  siteUrl: string;
  phone: string;
  hasPreOrder: boolean;
}

const C = {
  forest: "#2D4A3E",
  timber: "#5C4033",
  cream: "#F7F4EF",
  paper: "#FFFDF9",
  gold: "#D4AF37",
  ink: "#1F2A24",
  muted: "#6B6A63",
  line: "#E6DFD3",
};

const copy = {
  en: {
    greeting: (n: string) => `Dear ${n},`,
    date: "Date",
    time: "Time",
    guests: "Guests",
    seating: "Seating",
    reference: "Reference",
    largeParty: "10+ guests — our team will arrange seating with you",
    manage: "View or manage your reservation",
    footer: "Pinewood Cafe + Kitchen · Dhanmondi Road 6 · Dhanmondi Road 27 · Banani, Dhaka",
    received: {
      subject: (ref: string) => `We've received your table request · ${ref}`,
      title: "Your request is in",
      body: (phone: string) =>
        `Thank you for choosing Pinewood. Your table is held while our team verifies the booking — we'll call you at ${phone} shortly. Once confirmed, you'll receive an email with a link to pre-order your meal.`,
    },
    waitlist_promoted: {
      subject: (ref: string) => `A table opened up for you · ${ref}`,
      title: "Good news — a table opened up",
      body: (phone: string) =>
        `A table matching your waitlist request is now held for you. Our team will call you at ${phone} to confirm it.`,
    },
    confirmed: {
      subject: (ref: string) => `Your table is confirmed · ${ref}`,
      title: "Your table is confirmed",
      body: "We look forward to welcoming you. If you'd like your food ready when you arrive, you can pre-order from our menu — payment is taken at the restaurant as usual.",
      cta: "Pre-order your meal",
      ctaDone: "View or edit your pre-order",
      cutoff: "Pre-orders close 60 minutes before your reservation.",
    },
    reminder: {
      subject: (ref: string) => `See you soon at Pinewood · ${ref}`,
      title: "See you in about two hours",
      body: "Your table is ready for you. The fireplace is lit and the kettle is on.",
      cta: "Pre-order so it's ready on arrival",
    },
    cancelled: {
      subject: (ref: string) => `Update on your reservation · ${ref}`,
      title: "Your reservation has been cancelled",
      titleExpired: "We couldn't confirm your reservation",
      body: "We're sorry we won't see you this time. You're always welcome to book another table.",
      reason: "Note from our team",
      cta: "Book another table",
    },
  },
  bn: {
    greeting: (n: string) => `প্রিয় ${n},`,
    date: "তারিখ",
    time: "সময়",
    guests: "অতিথি",
    seating: "বসার স্থান",
    reference: "রেফারেন্স",
    largeParty: "১০+ অতিথি — আমাদের টিম আপনার সাথে বসার ব্যবস্থা করবে",
    manage: "আপনার রিজার্ভেশন দেখুন বা পরিচালনা করুন",
    footer: "পাইনউড ক্যাফে + কিচেন · ধানমন্ডি রোড ৬ · ধানমন্ডি রোড ২৭ · বনানী, ঢাকা",
    received: {
      subject: (ref: string) => `আপনার টেবিল অনুরোধ পেয়েছি · ${ref}`,
      title: "আপনার অনুরোধ গ্রহণ করা হয়েছে",
      body: (phone: string) =>
        `পাইনউড বেছে নেওয়ার জন্য ধন্যবাদ। বুকিং যাচাই না হওয়া পর্যন্ত আপনার টেবিলটি রাখা আছে — শীঘ্রই আমরা ${phone} নম্বরে কল করব। নিশ্চিত হলে খাবার আগাম অর্ডারের লিংকসহ একটি ইমেইল পাবেন।`,
    },
    waitlist_promoted: {
      subject: (ref: string) => `আপনার জন্য একটি টেবিল খালি হয়েছে · ${ref}`,
      title: "সুখবর — একটি টেবিল খালি হয়েছে",
      body: (phone: string) =>
        `আপনার ওয়েটলিস্ট অনুরোধ অনুযায়ী একটি টেবিল রাখা হয়েছে। নিশ্চিত করতে আমরা ${phone} নম্বরে কল করব।`,
    },
    confirmed: {
      subject: (ref: string) => `আপনার টেবিল নিশ্চিত হয়েছে · ${ref}`,
      title: "আপনার টেবিল নিশ্চিত",
      body: "আপনাকে স্বাগত জানাতে আমরা অপেক্ষায় আছি। পৌঁছানোর সাথে সাথে খাবার তৈরি পেতে চাইলে মেনু থেকে আগাম অর্ডার করতে পারেন — পেমেন্ট রেস্টুরেন্টেই।",
      cta: "খাবার আগাম অর্ডার করুন",
      ctaDone: "আপনার আগাম অর্ডার দেখুন বা পরিবর্তন করুন",
      cutoff: "রিজার্ভেশনের ৬০ মিনিট আগে আগাম অর্ডার বন্ধ হয়ে যায়।",
    },
    reminder: {
      subject: (ref: string) => `শীঘ্রই দেখা হচ্ছে পাইনউডে · ${ref}`,
      title: "প্রায় দুই ঘণ্টা পর দেখা হচ্ছে",
      body: "আপনার টেবিল প্রস্তুত। ফায়ারপ্লেস জ্বলছে, চায়ের কেটলিও চুলায়।",
      cta: "আগাম অর্ডার করুন, পৌঁছেই খাবার পাবেন",
    },
    cancelled: {
      subject: (ref: string) => `আপনার রিজার্ভেশনের আপডেট · ${ref}`,
      title: "আপনার রিজার্ভেশন বাতিল হয়েছে",
      titleExpired: "আমরা আপনার রিজার্ভেশন নিশ্চিত করতে পারিনি",
      body: "এবার দেখা হচ্ছে না বলে আমরা দুঃখিত। যেকোনো সময় আবার টেবিল বুক করতে পারেন।",
      reason: "আমাদের টিমের নোট",
      cta: "আবার টেবিল বুক করুন",
    },
  },
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function formatWhen(r: ReservationForEmail) {
  const loc = r.locale === "bn" ? "bn-BD" : "en-GB";
  const tz = "Asia/Dhaka";
  const date = new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(r.starts_at));
  const t = new Intl.DateTimeFormat(loc, { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
  return { date, time: `${t.format(new Date(r.starts_at))} – ${t.format(new Date(r.ends_at))}` };
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td style="background:${C.forest};border-radius:2px">
<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:Georgia,serif;font-size:15px;letter-spacing:.04em;color:${C.cream};text-decoration:none">${esc(label)}</a>
</td></tr></table>`;
}

function layout(title: string, inner: string, footer: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:${C.cream};color:${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.paper};border:1px solid ${C.line}">
<tr><td style="padding:28px 36px;border-bottom:1px solid ${C.line}">
<div style="font-family:Georgia,serif;font-size:22px;letter-spacing:.28em;color:${C.forest}">PINE WOOD</div>
<div style="height:1px;width:40px;background:${C.gold};margin-top:10px"></div>
</td></tr>
<tr><td style="padding:32px 36px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${C.ink}">${inner}</td></tr>
<tr><td style="padding:20px 36px;border-top:1px solid ${C.line};font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${C.muted}">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderEmail(kind: EmailKind, r: ReservationForEmail, ctx: Context) {
  const t = copy[r.locale === "bn" ? "bn" : "en"];
  const { date, time } = formatWhen(r);
  const areaName = r.area ? (r.locale === "bn" ? r.area.name_bn : r.area.name_en) : "";
  const guests = r.locale === "bn" ? new Intl.NumberFormat("bn-BD").format(r.party_size) : String(r.party_size);

  const rows: [string, string][] = [
    [t.date, date],
    [t.time, time],
    [t.guests, r.large_party ? `${guests}+` : guests],
    [t.seating, areaName],
    [t.reference, r.reference],
  ];
  const details = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-top:1px solid ${C.line}">
${rows.map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};color:${C.muted};font-size:13px;text-transform:uppercase;letter-spacing:.08em;width:38%">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid ${C.line};font-family:Georgia,serif;font-size:16px">${esc(v)}</td></tr>`).join("")}
</table>${r.large_party ? `<p style="margin:0 0 12px;color:${C.timber};font-size:14px">${esc(t.largeParty)}</p>` : ""}`;

  const heading = (s: string) =>
    `<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.25;color:${C.forest}">${esc(s)}</h1>`;
  const p = (s: string) => `<p style="margin:0 0 14px">${esc(s)}</p>`;
  const manageLink = `<p style="margin:18px 0 0;font-size:13px"><a href="${esc(ctx.manageUrl)}" style="color:${C.timber}">${esc(t.manage)}</a></p>`;

  let subject = "";
  let title = "";
  let inner = "";
  let text = "";

  switch (kind) {
    case "received":
    case "waitlist_promoted": {
      const c = t[kind];
      subject = c.subject(r.reference);
      title = c.title;
      inner = heading(title) + p(t.greeting(r.customer_name)) + p(c.body(r.phone)) + details + manageLink;
      text = `${title}\n\n${t.greeting(r.customer_name)}\n${c.body(r.phone)}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${t.manage}: ${ctx.manageUrl}`;
      break;
    }
    case "confirmed": {
      const c = t.confirmed;
      subject = c.subject(r.reference);
      title = c.title;
      const cta = ctx.hasPreOrder ? c.ctaDone : c.cta;
      inner = heading(title) + p(t.greeting(r.customer_name)) + p(c.body) + details +
        button(ctx.manageUrl, cta) +
        `<p style="margin:0;color:${C.muted};font-size:13px">${esc(c.cutoff)}</p>`;
      text = `${title}\n\n${t.greeting(r.customer_name)}\n${c.body}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${cta}: ${ctx.manageUrl}\n${c.cutoff}`;
      break;
    }
    case "reminder": {
      const c = t.reminder;
      subject = c.subject(r.reference);
      title = c.title;
      inner = heading(title) + p(t.greeting(r.customer_name)) + p(c.body) + details +
        (ctx.hasPreOrder ? manageLink : button(ctx.manageUrl, c.cta));
      text = `${title}\n\n${c.body}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${ctx.manageUrl}`;
      break;
    }
    case "cancelled": {
      const c = t.cancelled;
      subject = c.subject(r.reference);
      title = r.status === "expired" ? c.titleExpired : c.title;
      const reason = r.cancel_reason
        ? `<p style="margin:0 0 14px;padding:12px 16px;background:${C.cream};border-left:2px solid ${C.gold}"><span style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:${C.muted}">${esc(c.reason)}</span><br>${esc(r.cancel_reason)}</p>`
        : "";
      inner = heading(title) + p(t.greeting(r.customer_name)) + p(c.body) + reason + details +
        button(`${ctx.siteUrl}/reserve`, c.cta);
      text = `${title}\n\n${c.body}\n${r.cancel_reason ?? ""}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${ctx.siteUrl}/reserve`;
      break;
    }
  }

  return { subject, html: layout(title, inner, `${t.footer} · ${ctx.phone}`), text };
}
