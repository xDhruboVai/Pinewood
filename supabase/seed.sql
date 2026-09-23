-- Pine Wood seed data
-- Menu items and prices come from Pine Wood's published menu.
-- Items marked "CONFIRM" below are assumptions the owners should verify in the admin/Table Editor:
--   * seat counts per area, dietary tags (halal/vegetarian), chef specials,
--   * variant price differences (the published menu lists one price per item, so deltas are 0),
--   * sample add-ons and placeholder reviews.

-- ---------------------------------------------------------------------------
-- Seating areas (capacity pools) and tables — CONFIRM seat counts
-- ---------------------------------------------------------------------------
insert into public.areas (slug, name_en, name_bn, description_en, description_bn, sort_order) values
  ('fireplace', 'Fireplace Corner', 'ফায়ারপ্লেস কর্নার',
   'Low armchairs around the hearth. Best for slow evenings and winter dinners.',
   'আগুনের পাশে নিচু আরামকেদারা। ধীর সন্ধ্যা আর শীতের ডিনারের জন্য সেরা।', 1),
  ('study', 'Quiet Study Spots', 'নিরিবিলি স্টাডি কর্নার',
   'Warm desk lamps, power outlets at every seat, and an unhurried hush.',
   'উষ্ণ ডেস্ক ল্যাম্প, প্রতিটি আসনে পাওয়ার আউটলেট, আর শান্ত পরিবেশ।', 2),
  ('timber-hall', 'Timber Hall', 'টিম্বার হল',
   'Our main dining room of pine panels, amber light and acoustic Bangla music.',
   'পাইন কাঠের প্যানেল, অ্যাম্বার আলো আর অ্যাকুস্টিক বাংলা গানে ভরা মূল ডাইনিং রুম।', 3),
  ('rooftop', 'Rooftop & Outdoor', 'রুফটপ ও আউটডোর',
   'Open air under string lights, with potted pines and the Dhanmondi skyline.',
   'খোলা আকাশের নিচে স্ট্রিং লাইট, টবের পাইন গাছ আর ধানমন্ডির স্কাইলাইন।', 4);

insert into public.dining_tables (area_id, label, seats)
select a.id, t.label, t.seats
from (values
  ('fireplace', 'F1', 2), ('fireplace', 'F2', 2), ('fireplace', 'F3', 4), ('fireplace', 'F4', 4),
  ('study', 'S1', 2), ('study', 'S2', 2), ('study', 'S3', 2), ('study', 'S4', 2), ('study', 'S5', 4),
  ('timber-hall', 'H1', 4), ('timber-hall', 'H2', 4), ('timber-hall', 'H3', 4), ('timber-hall', 'H4', 4),
  ('timber-hall', 'H5', 4), ('timber-hall', 'H6', 4), ('timber-hall', 'H7', 6), ('timber-hall', 'H8', 6),
  ('rooftop', 'R1', 4), ('rooftop', 'R2', 4), ('rooftop', 'R3', 4), ('rooftop', 'R4', 4), ('rooftop', 'R5', 4), ('rooftop', 'R6', 4)
) as t(area, label, seats)
join public.areas a on a.slug = t.area;

-- ---------------------------------------------------------------------------
-- Opening hours (0 = Sunday). Friday opens at 11:00.
-- ---------------------------------------------------------------------------
insert into public.opening_hours (weekday, opens_at, closes_at) values
  (0, '10:00', '22:00'),
  (1, '10:00', '22:00'),
  (2, '10:00', '22:00'),
  (3, '10:00', '22:00'),
  (4, '10:00', '22:00'),
  (5, '11:00', '22:00'),
  (6, '10:00', '22:00');

-- ---------------------------------------------------------------------------
-- Menu categories
-- ---------------------------------------------------------------------------
insert into public.menu_categories (slug, section, name_en, name_bn, sort_order) values
  ('finger-foods',     'starters',  'Finger Foods',        'ফিঙ্গার ফুড',          1),
  ('soup',             'starters',  'Soup',                'স্যুপ',                 2),
  ('salad',            'starters',  'Salad',               'সালাদ',                3),
  ('chicken-specials', 'mains',     'Chicken Specials',    'চিকেন স্পেশাল',        10),
  ('pine-sets',        'mains',     'Pine Set Menus',      'পাইন সেট মেনু',        11),
  ('seafood-sets',     'mains',     'Seafood Set Menus',   'সি-ফুড সেট মেনু',       12),
  ('pasta',            'mains',     'Pasta',               'পাস্তা',               13),
  ('chowmein-noodles', 'mains',     'Chowmein & Noodles',  'চাউমিন ও নুডলস',       14),
  ('burgers',          'mains',     'Burgers',             'বার্গার',               15),
  ('sandwiches',       'mains',     'Sandwiches',          'স্যান্ডউইচ',           16),
  ('coffee',           'coffee',    'Coffee',              'কফি',                  20),
  ('hot-drinks',       'coffee',    'Tea & Hot Drinks',    'চা ও গরম পানীয়',       21),
  ('desserts',         'desserts',  'Desserts',            'ডেজার্ট',              30),
  ('freezers',         'beverages', 'Freezers',            'ফ্রিজার্স',            40);

-- ---------------------------------------------------------------------------
-- Menu items — CONFIRM dietary tags and chef specials
-- ---------------------------------------------------------------------------
insert into public.menu_items (category_id, slug, name_en, name_bn, description_en, description_bn, price, tags, is_featured, sort_order)
select c.id, v.slug, v.name_en, v.name_bn, v.d_en, v.d_bn, v.price, v.tags::text[], v.featured, v.ord
from (values
  -- Finger foods
  ('finger-foods', 'buffalo-wings', 'Buffalo Wings', 'বাফেলো উইংস', 'Tossed in house buffalo sauce', 'হাউস বাফেলো সসে মাখানো', 379, '{halal,spicy}', false, 1),
  ('finger-foods', 'fish-cake', 'Fish Cake', 'ফিশ কেক', '4 pieces', '৪ পিস', 449, '{halal,seafood}', false, 2),
  ('finger-foods', 'garlic-mushroom', 'Garlic Mushroom', 'গার্লিক মাশরুম', 'Sautéed with garlic and herbs', 'রসুন ও হার্বসে সতে করা', 389, '{vegetarian}', false, 3),
  ('finger-foods', 'poutine', 'Poutine', 'পুটিন', 'Fries, gravy and melted cheese', 'ফ্রাই, গ্রেভি আর গলানো চিজ', 549, '{halal}', false, 4),
  ('finger-foods', 'prawn-tempura', 'Prawn Tempura', 'প্রন টেম্পুরা', '6 pieces', '৬ পিস', 489, '{halal,seafood}', false, 5),
  ('finger-foods', 'thai-fried-chicken', 'Thai Fried Chicken', 'থাই ফ্রাইড চিকেন', '5 pieces', '৫ পিস', 369, '{halal}', false, 6),
  -- Soup
  ('soup', 'chicken-vegetable-soup', 'Chicken Vegetable Soup', 'চিকেন ভেজিটেবল স্যুপ', null, null, 249, '{halal}', false, 1),
  ('soup', 'cream-of-chicken', 'Cream of Chicken', 'ক্রিম অব চিকেন', null, null, 299, '{halal}', false, 2),
  ('soup', 'cream-of-mushroom', 'Cream of Mushroom', 'ক্রিম অব মাশরুম', null, null, 299, '{halal}', false, 3),
  ('soup', 'seafood-soup', 'Seafood Soup', 'সি-ফুড স্যুপ', null, null, 339, '{halal,seafood}', false, 4),
  ('soup', 'thai-soup', 'Thai Soup', 'থাই স্যুপ', 'Thick or clear', 'থিক অথবা ক্লিয়ার', 249, '{halal,spicy}', false, 5),
  -- Salad
  ('salad', 'chicken-cashew-nut-salad', 'Chicken Cashew Nut Salad', 'চিকেন কাজুবাদাম সালাদ', null, null, 419, '{halal,contains_nuts}', false, 1),
  ('salad', 'grilled-chicken-salad', 'Grilled Chicken Salad', 'গ্রিলড চিকেন সালাদ', null, null, 409, '{halal}', false, 2),
  ('salad', 'seafood-salad', 'Seafood Salad', 'সি-ফুড সালাদ', null, null, 549, '{halal,seafood}', false, 3),
  -- Chicken specials
  ('chicken-specials', 'baby-chicken-thai-steak', 'Baby Chicken Thai Steak', 'বেবি চিকেন থাই স্টেক', 'Served with three sides', 'তিনটি সাইডসহ পরিবেশিত', 599, '{halal}', false, 1),
  ('chicken-specials', 'bbq-chicken', 'BBQ Chicken', 'বিবিকিউ চিকেন', 'Served with three sides', 'তিনটি সাইডসহ পরিবেশিত', 599, '{halal}', false, 2),
  ('chicken-specials', 'chicken-pepper-mushroom', 'Chicken Pepper with Mushroom', 'চিকেন পেপার উইথ মাশরুম', 'Served with three sides', 'তিনটি সাইডসহ পরিবেশিত', 769, '{halal,chef_special}', true, 3),
  ('chicken-specials', 'grilled-cheesy-buffalo-chicken', 'Grilled Cheesy Buffalo Chicken', 'গ্রিলড চিজি বাফেলো চিকেন', 'Served with three sides', 'তিনটি সাইডসহ পরিবেশিত', 649, '{halal,spicy,chef_special}', false, 4),
  ('chicken-specials', 'mexican-chicken', 'Mexican Chicken', 'মেক্সিকান চিকেন', 'Served with three sides', 'তিনটি সাইডসহ পরিবেশিত', 599, '{halal,spicy}', false, 5),
  ('chicken-specials', 'stuffed-chicken', 'Stuffed Chicken', 'স্টাফড চিকেন', 'Served with three sides', 'তিনটি সাইডসহ পরিবেশিত', 649, '{halal}', false, 6),
  -- Pine set menus
  ('pine-sets', 'pine-1', 'Pine 1', 'পাইন ১', 'Fried rice, chicken basil leaf, Thai veg, fried chicken', 'ফ্রাইড রাইস, চিকেন বেসিল লিফ, থাই ভেজ, ফ্রাইড চিকেন', 559, '{halal}', false, 1),
  ('pine-sets', 'pine-2', 'Pine 2', 'পাইন ২', 'Fried rice, beef or chicken chilli, Thai veg, prawn tempura', 'ফ্রাইড রাইস, বিফ অথবা চিকেন চিলি, থাই ভেজ, প্রন টেম্পুরা', 599, '{halal,spicy}', false, 2),
  ('pine-sets', 'pine-3', 'Pine 3', 'পাইন ৩', 'Fried rice, tenderloin steak (100 g), orange chicken, sautéed veg', 'ফ্রাইড রাইস, টেন্ডারলয়েন স্টেক (১০০ গ্রাম), অরেঞ্জ চিকেন, সতে ভেজ', 999, '{halal,chef_special}', true, 3),
  ('pine-sets', 'pine-4', 'Pine 4', 'পাইন ৪', 'Fried rice, masala chicken, Thai veg, fried chicken', 'ফ্রাইড রাইস, মসলা চিকেন, থাই ভেজ, ফ্রাইড চিকেন', 539, '{halal}', false, 4),
  ('pine-sets', 'pine-5', 'Pine 5', 'পাইন ৫', 'Fried rice, teriyaki beef, chicken shashlik, Thai veg', 'ফ্রাইড রাইস, তেরিয়াকি বিফ, চিকেন শাসলিক, থাই ভেজ', 599, '{halal}', false, 5),
  -- Seafood set menus
  ('seafood-sets', 'ocean-one', 'Ocean One', 'ওশান ওয়ান', 'Fish steak, prawn tempura, squid with basil leaf, yellow rice', 'ফিশ স্টেক, প্রন টেম্পুরা, বেসিল পাতায় স্কুইড, ইয়েলো রাইস', 899, '{halal,seafood}', false, 1),
  ('seafood-sets', 'ocean-two', 'Ocean Two', 'ওশান টু', 'Fried dory fish, black pepper fish, grilled prawn, yellow rice', 'ফ্রাইড ডোরি ফিশ, ব্ল্যাক পেপার ফিশ, গ্রিলড প্রন, ইয়েলো রাইস', 949, '{halal,seafood}', false, 2),
  ('seafood-sets', 'ocean-three', 'Ocean Three', 'ওশান থ্রি', 'Grilled king prawn, spaghetti aglio e olio, aromatic potato cubes, yellow rice', 'গ্রিলড কিং প্রন, স্প্যাগেটি আলিও ই অলিও, সুগন্ধি আলুর কিউব, ইয়েলো রাইস', 1449, '{halal,seafood,chef_special}', true, 3),
  ('seafood-sets', 'ocean-four', 'Ocean Four', 'ওশান ফোর', 'Pan-fried dory fish, fried calamari, black pepper fish, yellow rice', 'প্যান-ফ্রাইড ডোরি ফিশ, ফ্রাইড ক্যালামারি, ব্ল্যাক পেপার ফিশ, ইয়েলো রাইস', 799, '{halal,seafood}', false, 4),
  ('seafood-sets', 'seafood-platter', 'Seafood Platter', 'সি-ফুড প্ল্যাটার', 'Garlic rice with prawn, fish balls, grilled prawn & squid, fried dory, garden salad, garlic mayo, tomato salsa', 'প্রনসহ গার্লিক রাইস, ফিশ বল, গ্রিলড প্রন ও স্কুইড, ফ্রাইড ডোরি, গার্ডেন সালাদ, গার্লিক মেয়ো, টমেটো সালসা', 999, '{halal,seafood}', true, 5),
  -- Pasta
  ('pasta', 'american-mac-cheese', 'American Mac & Cheese', 'আমেরিকান ম্যাক অ্যান্ড চিজ', 'Macaroni with cream sauce, chicken & cheddar', 'ক্রিম সস, চিকেন ও চেডার চিজসহ ম্যাকারনি', 499, '{halal}', false, 1),
  ('pasta', 'bbq-grilled-chicken-pasta', 'BBQ Grilled Chicken Pasta', 'বিবিকিউ গ্রিলড চিকেন পাস্তা', 'Penne with BBQ sauce, chicken, onion & capsicum', 'বিবিকিউ সস, চিকেন, পেঁয়াজ ও ক্যাপসিকামসহ পেনে', 399, '{halal}', false, 2),
  ('pasta', 'carbonara', 'Carbonara', 'কার্বোনারা', 'Fettuccine with cream sauce', 'ক্রিম সসে ফেটুচিনি', 649, '{halal,chef_special}', false, 3),
  ('pasta', 'creamy-chicken-pasta', 'Creamy Chicken Pasta', 'ক্রিমি চিকেন পাস্তা', 'Cream sauce, chicken & mushroom', 'ক্রিম সস, চিকেন ও মাশরুম', 419, '{halal}', false, 4),
  ('pasta', 'seafood-pasta', 'Seafood Pasta', 'সি-ফুড পাস্তা', 'Seafood in tomato sauce', 'টমেটো সসে সি-ফুড', 499, '{halal,seafood}', false, 5),
  ('pasta', 'spaghetti-garlic-prawn', 'Spaghetti with Garlic & Prawn', 'গার্লিক প্রন স্প্যাগেটি', 'Olive oil, chilli flakes & herbs', 'অলিভ অয়েল, চিলি ফ্লেক্স ও হার্বস', 419, '{halal,seafood,spicy}', false, 6),
  -- Chowmein & noodles
  ('chowmein-noodles', 'chowmein', 'Chowmein', 'চাউমিন', 'Chicken or prawn', 'চিকেন অথবা প্রন', 349, '{halal}', false, 1),
  ('chowmein-noodles', 'seafood-chowmein', 'Seafood Chowmein', 'সি-ফুড চাউমিন', null, null, 449, '{halal,seafood}', false, 2),
  ('chowmein-noodles', 'thai-noodles', 'Thai Noodles', 'থাই নুডলস', 'Chicken or prawn', 'চিকেন অথবা প্রন', 379, '{halal,spicy}', false, 3),
  -- Burgers
  ('burgers', 'beef-cheese-burger', 'Beef Cheese Burger', 'বিফ চিজ বার্গার', 'Served with fries', 'ফ্রাইসহ পরিবেশিত', 379, '{halal}', false, 1),
  ('burgers', 'chicken-cheese-burger', 'Chicken Cheese Burger', 'চিকেন চিজ বার্গার', 'Served with fries', 'ফ্রাইসহ পরিবেশিত', 309, '{halal}', false, 2),
  -- Sandwiches
  ('sandwiches', 'beef-sandwich', 'Beef Sandwich', 'বিফ স্যান্ডউইচ', 'Served with fries', 'ফ্রাইসহ পরিবেশিত', 369, '{halal}', false, 1),
  ('sandwiches', 'chicken-tikka-sandwich', 'Chicken Tikka Sandwich', 'চিকেন টিক্কা স্যান্ডউইচ', 'Served with fries', 'ফ্রাইসহ পরিবেশিত', 399, '{halal,spicy}', false, 2),
  ('sandwiches', 'club-sandwich', 'Club Sandwich', 'ক্লাব স্যান্ডউইচ', 'Served with fries', 'ফ্রাইসহ পরিবেশিত', 379, '{halal}', false, 3),
  ('sandwiches', 'smoked-chicken-sandwich', 'Smoked Chicken Sandwich', 'স্মোকড চিকেন স্যান্ডউইচ', 'Served with fries', 'ফ্রাইসহ পরিবেশিত', 339, '{halal}', false, 4),
  -- Coffee
  ('coffee', 'americano', 'Americano', 'আমেরিকানো', null, null, 189, '{vegetarian}', false, 1),
  ('coffee', 'cappuccino', 'Cappuccino', 'ক্যাপুচিনো', null, null, 229, '{vegetarian}', true, 2),
  ('coffee', 'latte', 'Latte', 'লাতে', null, null, 249, '{vegetarian}', false, 3),
  ('coffee', 'flavoured-latte', 'Flavoured Latte', 'ফ্লেভার্ড লাতে', 'Vanilla, hazelnut or caramel', 'ভ্যানিলা, হেজেলনাট অথবা ক্যারামেল', 299, '{vegetarian}', false, 4),
  ('coffee', 'espresso-single', 'Espresso — Single', 'এসপ্রেসো — সিঙ্গেল', null, null, 169, '{vegetarian}', false, 5),
  ('coffee', 'espresso-double', 'Espresso — Double', 'এসপ্রেসো — ডাবল', null, null, 249, '{vegetarian}', false, 6),
  ('coffee', 'iced-americano', 'Iced Americano', 'আইস আমেরিকানো', null, null, 219, '{vegetarian}', false, 7),
  ('coffee', 'iced-latte', 'Iced Latte', 'আইস লাতে', 'Vanilla, hazelnut or caramel', 'ভ্যানিলা, হেজেলনাট অথবা ক্যারামেল', 319, '{vegetarian}', false, 8),
  -- Tea & hot drinks
  ('hot-drinks', 'chai-latte', 'Chai Latte', 'চাই লাতে', null, null, 199, '{vegetarian}', false, 1),
  ('hot-drinks', 'flavoured-tea', 'Flavoured Tea', 'ফ্লেভার্ড টি', null, null, 119, '{vegetarian}', false, 2),
  -- Desserts
  ('desserts', 'biscoff-cheesecake', 'Biscoff Cheesecake', 'বিসকফ চিজকেক', null, null, 369, '{vegetarian,chef_special}', true, 1),
  ('desserts', 'blueberry-cheesecake', 'Blueberry Cheesecake', 'ব্লুবেরি চিজকেক', null, null, 369, '{vegetarian}', false, 2),
  ('desserts', 'oreo-cheesecake', 'Oreo Cheesecake', 'ওরিও চিজকেক', null, null, 349, '{vegetarian}', false, 3),
  ('desserts', 'brownie', 'Brownie', 'ব্রাউনি', null, null, 199, '{vegetarian}', false, 4),
  ('desserts', 'ice-cream', 'Ice Cream', 'আইসক্রিম', 'One scoop', 'এক স্কুপ', 169, '{vegetarian}', false, 5),
  -- Freezers
  ('freezers', 'biscoff-milkshake', 'Biscoff Milkshake', 'বিসকফ মিল্কশেক', null, null, 269, '{vegetarian}', false, 1),
  ('freezers', 'milkshake', 'Milkshake', 'মিল্কশেক', 'Chocolate, strawberry, Oreo or KitKat', 'চকলেট, স্ট্রবেরি, ওরিও অথবা কিটক্যাট', 269, '{vegetarian}', false, 2),
  ('freezers', 'coconut-shake', 'Coconut Shake', 'কোকোনাট শেক', null, null, 259, '{vegetarian}', false, 3),
  ('freezers', 'frappe', 'Frappé', 'ফ্রাপে', 'Chocolate or vanilla', 'চকলেট অথবা ভ্যানিলা', 309, '{vegetarian}', false, 4),
  ('freezers', 'mango-yoghurt-smoothie', 'Mango Yoghurt Smoothie', 'ম্যাঙ্গো ইয়োগার্ট স্মুদি', null, null, 309, '{vegetarian}', false, 5),
  ('freezers', 'virgin-mojito', 'Virgin Mojito', 'ভার্জিন মোহিতো', null, null, 229, '{vegetarian}', false, 6),
  ('freezers', 'strawberry-mojito', 'Strawberry Mojito', 'স্ট্রবেরি মোহিতো', null, null, 259, '{vegetarian}', false, 7),
  ('freezers', 'ocean-blue-mojito', 'Ocean Blue Mojito', 'ওশান ব্লু মোহিতো', null, null, 259, '{vegetarian}', false, 8),
  ('freezers', 'italian-soda', 'Italian Soda', 'ইতালিয়ান সোডা', 'Green apple or kiwi', 'গ্রিন অ্যাপল অথবা কিউই', 299, '{vegetarian}', false, 9),
  ('freezers', 'lemonade', 'Lemonade', 'লেমোনেড', null, null, 179, '{vegetarian}', false, 10),
  ('freezers', 'mint-lemonade', 'Mint Lemonade', 'মিন্ট লেমোনেড', null, null, 199, '{vegetarian}', false, 11),
  ('freezers', 'ginger-lemonade', 'Ginger Lemonade', 'জিঞ্জার লেমোনেড', null, null, 199, '{vegetarian}', false, 12),
  ('freezers', 'iced-lemon-tea', 'Iced Lemon Tea', 'আইস লেমন টি', null, null, 199, '{vegetarian}', false, 13),
  ('freezers', 'orange-juice', 'Orange Juice', 'অরেঞ্জ জুস', null, null, 259, '{vegetarian}', false, 14),
  ('freezers', 'seasonal-fresh-juice', 'Seasonal Fresh Juice', 'সিজনাল ফ্রেশ জুস', null, null, 199, '{vegetarian}', false, 15)
) as v(cat, slug, name_en, name_bn, d_en, d_bn, price, tags, featured, ord)
join public.menu_categories c on c.slug = v.cat;

-- ---------------------------------------------------------------------------
-- Variants — CONFIRM price_delta (e.g. double shot surcharge)
-- ---------------------------------------------------------------------------
insert into public.menu_item_variants (item_id, name_en, name_bn, price_delta, is_default, sort_order)
select i.id, v.name_en, v.name_bn, v.delta, v.is_default, v.ord
from (values
  ('americano', 'Single shot', 'সিঙ্গেল শট', 0, true, 1),
  ('americano', 'Double shot', 'ডাবল শট', 0, false, 2),
  ('cappuccino', 'Single shot', 'সিঙ্গেল শট', 0, true, 1),
  ('cappuccino', 'Double shot', 'ডাবল শট', 0, false, 2),
  ('latte', 'Single shot', 'সিঙ্গেল শট', 0, true, 1),
  ('latte', 'Double shot', 'ডাবল শট', 0, false, 2),
  ('flavoured-latte', 'Vanilla', 'ভ্যানিলা', 0, true, 1),
  ('flavoured-latte', 'Hazelnut', 'হেজেলনাট', 0, false, 2),
  ('flavoured-latte', 'Caramel', 'ক্যারামেল', 0, false, 3),
  ('iced-latte', 'Vanilla', 'ভ্যানিলা', 0, true, 1),
  ('iced-latte', 'Hazelnut', 'হেজেলনাট', 0, false, 2),
  ('iced-latte', 'Caramel', 'ক্যারামেল', 0, false, 3),
  ('chowmein', 'Chicken', 'চিকেন', 0, true, 1),
  ('chowmein', 'Prawn', 'প্রন', 0, false, 2),
  ('thai-noodles', 'Chicken', 'চিকেন', 0, true, 1),
  ('thai-noodles', 'Prawn', 'প্রন', 0, false, 2),
  ('thai-soup', 'Thick', 'থিক', 0, true, 1),
  ('thai-soup', 'Clear', 'ক্লিয়ার', 0, false, 2),
  ('creamy-chicken-pasta', 'Penne', 'পেনে', 0, true, 1),
  ('creamy-chicken-pasta', 'Spaghetti', 'স্প্যাগেটি', 0, false, 2),
  ('seafood-pasta', 'Penne', 'পেনে', 0, true, 1),
  ('seafood-pasta', 'Spaghetti', 'স্প্যাগেটি', 0, false, 2),
  ('pine-2', 'Beef chilli', 'বিফ চিলি', 0, true, 1),
  ('pine-2', 'Chicken chilli', 'চিকেন চিলি', 0, false, 2),
  ('milkshake', 'Chocolate', 'চকলেট', 0, true, 1),
  ('milkshake', 'Strawberry', 'স্ট্রবেরি', 0, false, 2),
  ('milkshake', 'Oreo', 'ওরিও', 0, false, 3),
  ('milkshake', 'KitKat', 'কিটক্যাট', 0, false, 4),
  ('frappe', 'Chocolate', 'চকলেট', 0, true, 1),
  ('frappe', 'Vanilla', 'ভ্যানিলা', 0, false, 2),
  ('italian-soda', 'Green apple', 'গ্রিন অ্যাপল', 0, true, 1),
  ('italian-soda', 'Kiwi', 'কিউই', 0, false, 2)
) as v(slug, name_en, name_bn, delta, is_default, ord)
join public.menu_items i on i.slug = v.slug;

-- ---------------------------------------------------------------------------
-- SAMPLE add-ons — CONFIRM or delete before launch
-- ---------------------------------------------------------------------------
insert into public.menu_item_addons (item_id, name_en, name_bn, price, sort_order)
select i.id, v.name_en, v.name_bn, v.price, v.ord
from (values
  ('beef-cheese-burger', 'Extra cheese', 'এক্সট্রা চিজ', 50, 1),
  ('chicken-cheese-burger', 'Extra cheese', 'এক্সট্রা চিজ', 50, 1),
  ('americano', 'Extra espresso shot', 'এক্সট্রা এসপ্রেসো শট', 60, 1),
  ('cappuccino', 'Extra espresso shot', 'এক্সট্রা এসপ্রেসো শট', 60, 1),
  ('latte', 'Extra espresso shot', 'এক্সট্রা এসপ্রেসো শট', 60, 1),
  ('brownie', 'Scoop of ice cream', 'এক স্কুপ আইসক্রিম', 120, 1)
) as v(slug, name_en, name_bn, price, ord)
join public.menu_items i on i.slug = v.slug;

-- ---------------------------------------------------------------------------
-- PLACEHOLDER reviews — replace with real guest reviews before launch
-- ---------------------------------------------------------------------------
insert into public.reviews (author_name, author_context, rating, body_en, body_bn, sort_order) values
  ('Placeholder Guest', 'Replace before launch', 5,
   'Sample review text. Replace this with a real guest quote about the fireplace corner.',
   'নমুনা রিভিউ। ফায়ারপ্লেস কর্নার নিয়ে একজন অতিথির আসল মন্তব্য দিয়ে এটি বদলে দিন।', 1),
  ('Placeholder Guest', 'Replace before launch', 5,
   'Sample review text. Replace this with a real guest quote about studying or working here.',
   'নমুনা রিভিউ। এখানে পড়াশোনা বা কাজ নিয়ে একজন অতিথির আসল মন্তব্য দিয়ে এটি বদলে দিন।', 2),
  ('Placeholder Guest', 'Replace before launch', 5,
   'Sample review text. Replace this with a real guest quote about the rooftop and the food.',
   'নমুনা রিভিউ। রুফটপ ও খাবার নিয়ে একজন অতিথির আসল মন্তব্য দিয়ে এটি বদলে দিন।', 3);
