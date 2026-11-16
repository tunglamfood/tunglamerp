"""
Builds supabase/seed/20261116_portal_catalogue.sql — the first portal catalogue.

Groups the ERP's separate item codes into products with variants, the way a
dealer thinks about them ("Taufu Keras: 2 pcs · 4 pcs · 10 pcs"). Codes are
never changed. Staff refine this afterwards in ERP → Sales → Dealer portal.

    python scripts/portal-catalogue-seed.py
"""
from pathlib import Path

# (category, brand, name_en, name_ms, name_zh, website_slug, restricted, [variants])
# variant: (item_code, label_en, label_ms, label_zh, website_slug)
def v(code, en, ms=None, zh=None, slug=None):
    return (code, en, ms or en, zh or en, slug)

P = [
    # ── Tofu ───────────────────────────────────────────────────────────────
    ("tofu", "Tung Lam", "TL Egg Tofu", "Tauhu Telur TL", "TL 鸡蛋豆腐", "tl-egg-tofu-120gm", False, [
        v("TL120", "120g", slug="tl-egg-tofu-120gm"),
        v("TL3X1", "3 × 120g", slug="tl-egg-tofu-3-x-120gm"),
        v("TLS130", "130g", slug="tl-egg-tofu-130gm"),
        v("TLS30P", "Bag · 30 × 130g", "Beg · 30 × 130g", "整袋 · 30 × 130g"),
        v("TLS180K", "Carton · 180 × 130g", "Karton · 180 × 130g", "整箱 · 180 × 130g")]),
    ("tofu", "AD", "AD Egg Tofu", "Tauhu Telur AD", "AD 鸡蛋豆腐", "ad-egg-tofu-120gm", False, [
        v("AD120", "120g"), v("AD3X1", "3 × 120g", slug="ad-egg-tofu-3-x-120gm")]),
    ("tofu", "Cili", "Cili Egg Tofu", "Tauhu Telur Cili", "Cili 鸡蛋豆腐", "cili-brand-egg-tofu-120gm", False, [
        v("TC120", "120g"),
        v("TC170K", "Carton · 170 × 120g", "Karton · 170 × 120g", "整箱 · 170 × 120g"),
        v("TC180K", "Carton · 180 × 120g", "Karton · 180 × 120g", "整箱 · 180 × 120g")]),
    ("tofu", "Sakura", "Sakura Egg Tofu", "Tauhu Telur Sakura", "Sakura 鸡蛋豆腐", "sakura-egg-tofu-150gm", False, [
        v("TS150", "150g")]),
    ("tofu", "CF", "CF Egg Tofu", "Tauhu Telur CF", "CF 鸡蛋豆腐", None, True, [v("TCF130", "130g")]),
    ("tofu", "Huat", "Huat Egg Tofu", "Tauhu Telur Huat", "Huat 鸡蛋豆腐", None, True, [v("THU120", "120g")]),
    ("tofu", "Lee", "Lee Egg Tofu", "Tauhu Telur Lee", "Lee 鸡蛋豆腐", None, True, [
        v("LEE30P", "Bag · 30 × 130g", "Beg · 30 × 130g", "整袋 · 30 × 130g"),
        v("LEE180K", "Carton · 180 × 130g", "Karton · 180 × 130g", "整箱 · 180 × 130g")]),
    ("tofu", "Tomato", "Tomato Egg Tofu", "Tauhu Telur Tomato", "Tomato 鸡蛋豆腐", None, True, [v("TTM120", "120g")]),
    ("tofu", "Yew Hing", "Yew Hing Egg Tofu", "Tauhu Telur Yew Hing", "Yew Hing 鸡蛋豆腐", None, True, [v("TYH120", "120g")]),
    ("tofu", "Tung Lam", "TL Silken Tofu", "Tauhu Sutera TL", "TL 嫩豆腐", "tl-silken-tofu-box-300gm", False, [
        v("TB300", "Box · 300g", "Kotak · 300g", "盒装 · 300g", "tl-silken-tofu-box-300gm"),
        v("TU250", "Tube · 250g", "Tiub · 250g", "条装 · 250g", "silken-tofu-tube-250gm")]),
    ("tofu", "Sakura", "Sakura Silken Tofu", "Tauhu Sutera Sakura", "Sakura 嫩豆腐", "sakura-silken-tofu-box-300gm", False, [
        v("SB300", "Box · 300g", "Kotak · 300g", "盒装 · 300g", "sakura-silken-tofu-box-300gm"),
        v("SU250", "Tube · 250g", "Tiub · 250g", "条装 · 250g", "sakura-tofu-tube-250gm"),
        v("SBVP", "Box value pack", "Pek nilai kotak", "盒装超值装")]),
    ("tofu", "Tung Lam", "Tofu Puff (Round)", "Tauhu Goreng Bulat", "圆豆卜", "tofu-goreng-bulat-270gm", False, [
        v("PB10P", "10 pcs", "10 biji", "10粒", "tofu-goreng-bulat-10pcs"),
        v("PB270", "270g", slug="tofu-goreng-bulat-270gm"),
        v("PB800", "800g"), v("PB900", "900g"),
        v("PB1KG", "1kg", slug="tofu-goreng-bulat-1kg")]),
    ("tofu", "Tung Lam", "Tofu Puff (Square)", "Tauhu Goreng Keping", "方豆卜", "tofu-goreng-keping-270gm", False, [
        v("PKG8P", "8 pcs", "8 keping", "8片"),
        v("PKG500", "500g · 20 pcs", "500g · 20 keping", "500g · 20片", "tofu-goreng-keping-500gm")]),
    ("tofu", "Tung Lam", "Tofu Puff (Long)", "Tauhu Goreng Panjang", "长豆卜", "tofu-goreng-panjang-270gm", False, [
        v("PP270", "270g")]),
    ("tofu", "Tung Lam", "Taufu Keras (Firm Tofu)", "Taufu Keras", "硬豆腐", "tl-taufu-keras-4pcs", False, [
        v("TK2P", "2 pcs · 200g", "2 keping · 200g", "2块 · 200g", "tl-taufu-keras-2pcs"),
        v("TK4P", "4 pcs · 400g", "4 keping · 400g", "4块 · 400g", "tl-taufu-keras-4pcs"),
        v("TK6P", "6 pcs · 600g", "6 keping · 600g", "6块 · 600g", "tl-taufu-keras-6pcs"),
        v("TK1KG", "10 pcs · 1kg", "10 keping · 1kg", "10块 · 1kg", "tl-taufu-keras-10pcs")]),
    ("tofu", "Tung Lam", "Fried Taufu Keras", "Taufu Keras Goreng", "炸硬豆腐", None, False, [
        v("TKGP", "Per piece", "Sekeping", "每块")]),
    ("tofu", "Tung Lam", "Teochew Tau Kwa", "Taufu Teochew", "潮州豆干", "taufu-teochew-350gm", False, [
        v("TT2P", "2 pcs", "2 keping", "2块"), v("TT4P", "4 pcs", "4 keping", "4块")]),
    ("tofu", "CF", "CF Japanese Pressed Tofu", "Tauhu Tekan Jepun CF", "CF 日式压豆腐", None, False, [v("JPT330", "330g")]),
    ("tofu", "CF", "CF Fried Tofu", "Taufu Goreng CF", "CF 炸豆腐", None, False, [v("CFTGP", "Per piece", "Sekeping", "每块")]),
    ("tofu", "CF", "CF Puff King", "CF Puff King", "CF 豆卜王", None, False, [v("PKNG270", "270g")]),
    ("tofu", "Losam", "Losam Flavoured Tofu", "Tauhu Berperisa Losam", "Losam 风味豆干", None, False, [
        v("LS-FS160", "Five spice · 160g", "Lima rempah · 160g", "五香 · 160g"),
        v("LS-SW200", "Seaweed · 200g", "Rumpai laut · 200g", "海苔 · 200g")]),
    ("tofu", "Aisy", "Aisy Tempeh", "Tempe Aisy", "Aisy 天贝", None, False, [v("ATP120", "120g")]),
    # ── Steamboat ──────────────────────────────────────────────────────────
    ("steamboat", "Tung Lam", "Peeled Quail Eggs", "Telur Puyuh Kupas", "去壳鹌鹑蛋", "tl-telur-puyuh-kupas-10pcs", False, [
        v("TP10P", "10 pcs", "10 biji", "10粒", "tl-telur-puyuh-kupas-10pcs"),
        v("TP50P", "50 pcs", "50 biji", "50粒", "tl-telur-puyuh-kupas-50pcs")]),
    ("steamboat", "Cili", "Cili Fried Fish Ball (Small)", "Bebola Ikan Goreng Kecil Cili", "Cili 炸鱼丸（小）", "cili-brand-fried-fish-ball-160gm", False, [
        v("CGK160", "160g", slug="cili-brand-fried-fish-ball-160gm"),
        v("CGK1KG", "1kg", slug="tl-bebola-goreng-cecil-1kg")]),
    ("steamboat", "Cili", "Cili Fried Fish Ball (Large)", "Bebola Ikan Goreng Besar Cili", "Cili 炸鱼丸（大）", "tl-bebola-goreng-besar-1kg", False, [
        v("CBGB1KG", "1kg")]),
    ("steamboat", "Cili", "Cili White Fish Ball (Small)", "Bebola Ikan Putih Kecil Cili", "Cili 白鱼丸（小）", "cili-brand-white-fish-ball-160gm", False, [
        v("CPK160", "160g", slug="cili-brand-white-fish-ball-160gm"),
        v("CPK1KG", "1kg", slug="tl-bebola-puteh-kecil-1kg")]),
    ("steamboat", "Cili", "Cili White Fish Ball (Large)", "Bebola Ikan Putih Besar Cili", "Cili 白鱼丸（大）", "tl-bebola-puteh-besar-1kg", False, [
        v("CPB1KG", "1kg")]),
    ("steamboat", "Cili", "Cili Long Fish Cake", "Kek Ikan Panjang Cili", "Cili 长鱼饼", "cili-brand-fish-cake-280gm", False, [
        v("CKIP280", "280g", slug="cili-brand-fish-cake-280gm"),
        v("CKIP1KG", "1kg", slug="tl-kek-ikan-panjang-1kg")]),
    ("steamboat", "Cili", "Cili Lingo Fish Cake", "Kek Ikan Lingo Cili", "Cili Lingo 鱼饼", "tl-lingo-kek-ikan-1kg", False, [
        v("CLG1KG", "1kg")]),
    ("steamboat", "AD", "AD White Fish Ball (Small)", "Bebola Ikan Putih Kecil AD", "AD 白鱼丸（小）", "ad-fish-ball-450gm", False, [
        v("APK450", "450g")]),
    ("steamboat", "AD", "AD Long Fish Cake", "Kek Ikan Panjang AD", "AD 长鱼饼", "ad-fish-cake-450gm", False, [
        v("AKIP450", "450g")]),
    ("steamboat", "Tung Lam", "Fish Paste", "Isi Ikan", "鱼浆", "tl-fish-paste-300gm", False, [
        v("FP300", "300g", slug="tl-fish-paste-300gm"), v("FP500", "500g"),
        v("FP1KG", "1kg", slug="tl-fish-paste-1kg")]),
    ("steamboat", "Tung Lam", "Chicken Paste", "Isi Ayam", "鸡肉浆", None, False, [
        v("AYAM300", "300g"), v("AYAM1KG", "1kg")]),
    ("steamboat", "Berkat", "Berkat Fish Ball & Fish Cake", "Bebola & Kek Ikan Berkat", "Berkat 鱼丸与鱼饼", None, True, [
        v("BPK135", "Fish ball · 135g", "Bebola ikan · 135g", "鱼丸 · 135g"),
        v("BKIP220", "Fish cake · 220g", "Kek ikan · 220g", "鱼饼 · 220g")]),
    # ── Desserts ───────────────────────────────────────────────────────────
    ("dessert", "Tung Lam", "Cincau Manis (Sweetened Grass Jelly)", "Cincau Manis", "甜仙草", "cincau-manis-260gm", False, [
        v("CM260", "260g", slug="cincau-manis-260gm"), v("CM1KG", "1kg", slug="cincau-manis-1kg")]),
    ("dessert", "Tung Lam", "Cincau Tanpa Gula (Unsweetened Grass Jelly)", "Cincau Tanpa Gula", "无糖仙草", "cincau-tawar-480gm", False, [
        v("CT480", "480g", slug="cincau-tawar-480gm"), v("CT700", "700g"), v("CT1KG", "1kg"),
        v("CT2KG", "2kg", slug="tl-cincau-asli-2kg"),
        v("CT1800", "Tin · 18kg", "Tin · 18kg", "罐装 · 18kg")]),
    ("dessert", "Tung Lam", "Warisan Cendol", "Cendol Warisan", "Warisan 煎蕊", "warisan-cendol-500gm", False, [
        v("CD500", "500g", slug="warisan-cendol-500gm"), v("CD1500", "1.5kg", slug="warisan-cendol-1-5kg")]),
    ("dessert", "CF", "CF Flavoured Cincau", "Cincau Berperisa CF", "CF 水果味仙草", None, False, [
        v("CFL250", "Lychee · 250g", "Laici · 250g", "荔枝 · 250g"),
        v("CFM250", "Mango · 250g", "Mangga · 250g", "芒果 · 250g"),
        v("CFS250", "Strawberry · 250g", "Strawberi · 250g", "草莓 · 250g")]),
    ("dessert", "CF", "CF Dessert Toppings", "Topping Pencuci Mulut CF", "CF 甜品配料", None, False, [
        v("CFSAGOH", "Green sago · 250g", "Sagu hijau · 250g", "绿西米 · 250g"),
        v("CFSAGOM", "Red sago · 250g", "Sagu merah · 250g", "红西米 · 250g"),
        v("CFKABO", "Buah kabong · 220g", "Buah kabong · 220g", "亚答子 · 220g")]),
    ("dessert", "Fortune", "Fortune Beancurd Dessert", "Tauhu Fa Fortune", "Fortune 豆花", None, False, [
        v("FT-SBO2X180", "Original · 2 × 180g", "Asli · 2 × 180g", "原味 · 2 × 180g"),
        v("FT-SBA2X180", "Almond · 2 × 180g", "Badam · 2 × 180g", "杏仁 · 2 × 180g"),
        v("FT-SBGM2X200", "Gula Melaka · 2 × 200g", "Gula Melaka · 2 × 200g", "椰糖 · 2 × 200g")]),
    ("dessert", "Fortune", "Fortune Pulut Hitam", "Pulut Hitam Fortune", "Fortune 黑糯米", None, False, [
        v("FT-PH2X190", "2 × 190g")]),
    # ── Grocery (trading) ──────────────────────────────────────────────────
    ("grocery", "Fortune", "Fortune Japanese Udon", "Udon Jepun Fortune", "Fortune 日式乌冬", None, False, [v("FT-UDON", "200g")]),
    ("grocery", "Ken Hin", "Ken Hin Peeled Garlic", "Bawang Putih Kupas Ken Hin", "Ken Hin 去皮蒜头", None, False, [
        v("GA200", "200g"), v("GA500", "500g"), v("GA800", "800g"), v("GA1000", "1kg")]),
    ("grocery", "Ken Hin", "Ken Hin Peeled Onion", "Bawang Kupas Ken Hin", "Ken Hin 去皮洋葱", None, False, [v("ONI500", "500g")]),
    ("grocery", "", "Taugeh (Bean Sprouts)", "Taugeh", "豆芽", None, False, [
        v("TAU300", "300g"), v("TAU400", "400g"), v("TAU1KG", "1kg"), v("TAU3KG", "3kg")]),
    ("grocery", "My Murni", "My Murni Kuey Teow Goreng", "Kuey Teow Goreng My Murni", "My Murni 炒粿条", None, False, [
        v("MMG450", "450g"), v("MMG900", "900g")]),
    ("grocery", "My Murni", "My Murni Kuey Teow Soup", "Kuey Teow Sup My Murni", "My Murni 汤粿条", None, False, [v("MMS450", "450g")]),
    ("grocery", "My Murni", "My Murni Yellow Noodles", "Mee Kuning My Murni", "My Murni 黄面", None, False, [
        v("MMM450", "450g"), v("MMM900", "900g")]),
    ("grocery", "AD", "AD Mee Nipis", "Mee Nipis AD", "AD 细面", None, False, [v("AMN450", "450g")]),
    ("grocery", "Myungga", "Myungga Rice Cake", "Kek Beras Myungga", "Myungga 年糕", None, False, [
        v("RSL500-MYG", "Slice · 500g", "Hirisan · 500g", "片状 · 500g"),
        v("RST500-MYG", "Stick · 500g", "Batang · 500g", "条状 · 500g")]),
    ("grocery", "Myungga", "Myungga Gochujang", "Gochujang Myungga", "Myungga 韩式辣椒酱", None, False, [v("HP500-MYG", "500g")]),
    ("grocery", "Myungga", "Myungga Doenjang", "Doenjang Myungga", "Myungga 韩式大酱", None, False, [v("SB500-MYG", "500g")]),
    ("grocery", "Narichan", "Narichan Kimchi", "Kimchi Narichan", "Narichan 泡菜", None, False, [
        v("NRC-KC150", "150g"), v("NRC-KC300", "300g")]),
    ("grocery", "Narichan", "Narichan Radish", "Lobak Narichan", "Narichan 萝卜泡菜", None, False, [v("NRC-RD300", "300g")]),
    ("grocery", "Mak Kim's", "Mak Kim's Sweet Sour Cabbage", "Kubis Masam Manis Mak Kim", "Mak Kim 酸甜包菜", None, False, [v("MK-SSC180", "180g")]),
    ("grocery", "Cap Pokok", "Cap Pokok Fried Shallots", "Bawang Goreng Cap Pokok", "Cap Pokok 炸葱头", None, False, [v("BG1KG", "1kg")]),
    ("grocery", "HY", "HY Ikan Pucuk (Mini)", "Ikan Pucuk HY (Mini)", "HY 小鱼（迷你）", None, False, [v("IPM350", "350g")]),
]


def q(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"


out = [
    "-- First portal catalogue, generated by scripts/portal-catalogue-seed.py.",
    "-- Safe to re-run: products are matched by English name, variants by item code.",
    "begin;",
]
for i, (cat, brand, en, ms, zh, slug, restricted, variants) in enumerate(P):
    sort = (i + 1) * 10
    out.append(f"""
with p as (
  insert into portal_products (name_en, name_ms, name_zh, category, brand, website_slug, restricted, sort)
  select {q(en)}, {q(ms)}, {q(zh)}, {q(cat)}, {q(brand)}, {q(slug)}, {str(restricted).lower()}, {sort}
  where not exists (select 1 from portal_products where name_en = {q(en)})
  returning id
), pid as (select id from p union all select id from portal_products where name_en = {q(en)} limit 1)
insert into portal_product_variants (item_code, product_id, label_en, label_ms, label_zh, website_slug, sort)
select x.item_code, pid.id, x.label_en, x.label_ms, x.label_zh, x.slug, x.sort
  from pid, (values {", ".join(f"({q(c)}, {q(le)}, {q(lm)}, {q(lz)}, {q(s)}, {(j + 1) * 10})" for j, (c, le, lm, lz, s) in enumerate(variants))})
       as x(item_code, label_en, label_ms, label_zh, slug, sort)
 where exists (select 1 from sales_products sp where sp.item_code = x.item_code)
on conflict (item_code) do nothing;""")
out.append("\ncommit;")

path = Path(__file__).resolve().parent.parent / "supabase" / "seed" / "20261116_portal_catalogue.sql"
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"{len(P)} products, {sum(len(p[7]) for p in P)} variants -> {path}")
