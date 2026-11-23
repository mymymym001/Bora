# -*- coding: utf-8 -*-
"""모든 출처를 하나의 식당·카페 목록으로 합친다 → site/venues.json(목록) + site/menus.json(메뉴판)
출처: scripts/places.py(직접 조사), data/sources/gpt_places.json(사용자 GPT 사이트), data/sources/bd_menus.json(boracay.delivery),
      data/sources/kr_restaurants.json, data/sources/kr_cafes.json(한국인 후기 조사), data/raw/pois.txt(OSM 좌표)"""
import json, os, re, sys, math, statistics
sys.path.insert(0, os.path.dirname(__file__))
from places import PLACES, HOTEL

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, "data", "sources")
LAT0, LON0 = HOTEL["lat"], HOTEL["lon"]
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
def xy(lat, lon): return [round((lon - LON0) * KX), round(-(lat - LAT0) * KY)]
def load(n, d=None):
    p = os.path.join(SRC, n)
    return json.load(open(p)) if os.path.exists(p) else d

def key(s):
    s = (s or "").lower().replace("’", "'").replace("👍 preferred", "")
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"\b(boracay|restaurant|resto|the|and|&|cafe|café|coffee|tea|bar|grill|cuisine|cucina|italiana|d'mall|station \d|snack|fruit shake|greek taverna|japanese|korean)\b", " ", s)
    return re.sub(r"[^a-z0-9]", "", s)

# 수동 별칭: 같은 가게의 다른 이름
ALIAS = {"lemoni": "lemoni", "lemoni": "lemoni", "lemonicafe": "lemoni", "realcoffee": "real", "real": "real",
         "halomango": "halomango", "halomangodmall": "halomango", "smokeresto": "smoke", "smoke": "smoke", "subo": "subo",
         "nonies": "nonies", "nonie's": "nonies", "noniess": "nonies", "gerrys": "gerrys", "gerry's": "gerrys", "gerryss": "gerrys",
         "aria": "aria", "andoks": "andoks", "mangsinasal": "manginasal", "manginasal": "manginasal", "dtalipapa": "talipapa",
         "dtalipapaseafoodmarket": "talipapa", "dosmestizos": "dosmestizos", "epic": "epic", "exit": "exitbar", "cocomama": "cocomama",
         "cocomamadmall": "cocomama", "hobbittavern": "hobbit", "hobbit": "hobbit", "hobbithouse": "hobbit", "laud": "laud", "kubo": "kubo",
         "jonahs": "jonahs", "jonah's": "jonahs", "sunnyside": "sunnyside", "kasbar": "kasbar", "kasbah": "kasbar"}
def canon(name):
    k = key(name); k2 = k.replace("'", "")
    return ALIAS.get(k, ALIAS.get(k2, k2))

pois = {}
for l in open(os.path.join(R, "data", "raw", "pois.txt")):
    f = l.rstrip("\n").split("|")
    if len(f) > 3: pois.setdefault(canon(f[1]), f)

V = {}  # canon -> venue
def V_(name):
    c = canon(name)
    if c not in V: V[c] = dict(key=c, name=name, sources=[], menus={}, photos=[])
    return V[c]

CATK = {"restaurant": "restaurant", "cafe": "cafe", "dessert": "dessert", "bar": "bar", "pub": "bar", "convenience": "convenience", "pharmacy": "pharmacy"}
# 1) 직접 조사 (places.py)
for p in PLACES:
    c0 = canon(p["name"])
    if c0 in V and V[c0].get("placeId"):  # 같은 이름의 다른 지점(예: 7-Eleven 두 곳)
        V[p["id"]] = dict(key=p["id"], name=p["name"], sources=[], menus={}, photos=[]); v = V[p["id"]]
    else: v = V_(p["name"])
    v_ = v; v.update({k: p[k] for k in ("ko", "lat", "lon", "addr", "hours", "status", "pp", "vat", "sc", "groupFit", "groupNote", "desc", "fair", "pricey", "premium", "tips", "coordSrc", "coordConf") if k in p})
    v["cat"] = CATK.get(p["cat"], p["cat"]); v["h24"] = p.get("h24", False); v["sub"] = p.get("sub"); v["placeId"] = p["id"]
    v["links"] = dict(p.get("links") or {})
    if p.get("rating"): v["rating"] = p["rating"]
    if p.get("menu"): v["menus"]["curated"] = [dict(n=m["n"], ko=m["ko"], php=m["php"], src=m["src"] + " · " + m["yr"], note=m.get("note")) for m in p["menu"]]
    v["sources"].append("직접 조사 (2026-11-23)")

# 2) 사용자 GPT 사이트
gpt = load("gpt_places.json", {"places": [], "photos": []})
for p in gpt["places"]:
    v = V_(p["name"].split(" · ")[0])
    v.setdefault("ko", p.get("ko")); v.setdefault("lat", p.get("lat")); v.setdefault("lon", p.get("lon")); v.setdefault("addr", p.get("address")); v.setdefault("hours", p.get("hours"))
    if "cat" not in v: v["cat"] = {"음식점": "restaurant", "카페": "cafe", "펍": "bar", "편의점": "convenience", "약국": "pharmacy"}.get(p["cat"], "restaurant")
    if p.get("menu"): v["menus"]["gpt"] = [dict(n=m[0], ko=m[2] if len(m) > 2 else "", php=m[1], src=p.get("pricing") or "GPT 가이드 출처") for m in p["menu"]]
    if p.get("note"): v["gptNote"] = p["note"]
    if p.get("service") and v.get("sc") is None: v["sc"] = p["service"]
    v["sources"] += [s[1] for s in p.get("sources", []) if s[1].startswith("https://")]

# 2b) GPT 가이드의 사용 허가 사진 (CC 라이선스, 저자 표기) → site/img/
SCENIC = []
for ph in gpt.get("photos", []):
    item = dict(src="img/" + ph["file"], author=ph.get("credit"), license=ph.get("license"), page=ph.get("source"), caption=ph.get("caption"))
    if ph.get("venue") == "White Beach": SCENIC.append(item); continue
    c = canon(ph.get("venue", ""))
    tgt = V.get(c) or next((v for k, v in V.items() if c and (k.startswith(c) or c.startswith(k))), None)
    if tgt is not None: tgt["photos"].append(item)
    else: print("photo venue not matched:", ph.get("venue"))

# 3) 한국인 후기 조사
POP = {"high": 3, "medium": 2, "low": 1}
for fn, defcat in (("kr_restaurants.json", "restaurant"), ("kr_cafes.json", "cafe")):
    arr = load(fn, []) or []
    if isinstance(arr, dict): arr = arr.get("places") or arr.get("restaurants") or []
    for p in arr:
        if not p.get("name"): continue
        v = V_(p["name"])
        v.setdefault("ko", p.get("ko_name"))
        cat = p.get("category") or defcat
        v.setdefault("cat", CATK.get(cat, defcat))
        if p.get("korean_review"): v["krReview"] = p["korean_review"]
        if p.get("korean_popularity"): v["krPop"] = max(v.get("krPop", 0), POP.get(str(p["korean_popularity"]).split()[0].lower(), 0))
        r = p.get("rating")
        if isinstance(r, dict) and r.get("score"):
            if not v.get("rating") or (r.get("site") == "Google"): v["rating"] = dict(site=r.get("site") or "후기", score=r["score"], count=r.get("count"), seen=r.get("seen") or r.get("seen_where"))
        if p.get("typical_pp_php") and not v.get("pp"):
            t = p["typical_pp_php"];
            if isinstance(t, list) and len(t) == 2 and all(isinstance(x, (int, float)) for x in t): v["pp"] = t
        if p.get("menu"):
            v["menus"]["kr"] = [dict(n=m.get("n"), ko=m.get("ko", ""), php=m.get("php"), src=(m.get("src") or "") + (" · " + str(m.get("yr")) if m.get("yr") else "")) for m in p["menu"] if m.get("n")]
        for k_src, k_dst in (("hours", "hours"), ("area", "area"), ("recommended_order_for_7", "recOrder"), ("operating_evidence", "status")):
            if p.get(k_src) and not v.get(k_dst): v[k_dst] = p[k_src] if isinstance(p[k_src], str) else json.dumps(p[k_src], ensure_ascii=False)
        g = p.get("group_of_7") or p.get("seating_group7")
        if g and not v.get("groupNote"): v["groupNote"] = g if isinstance(g, str) else json.dumps(g, ensure_ascii=False)
        if p.get("caveats") and not v.get("tips"): v["tips"] = p["caveats"] if isinstance(p["caveats"], str) else " ".join(p["caveats"])
        if p.get("vat_included") is not None and v.get("vat") is None: v["vat"] = p["vat_included"]
        sc = p.get("service_charge")
        if isinstance(sc, (int, float)) and v.get("sc") is None: v["sc"] = sc
        u = p.get("official_url") or p.get("facebook")
        if isinstance(u, str) and u.startswith("https://"): v.setdefault("links", {}).setdefault("official", u)
        v["sources"] += [s for s in (p.get("sources") or p.get("korean_sources") or []) if isinstance(s, str) and s.startswith("https://")][:6]

# 4) 배달 플랫폼 메뉴 (boracay.delivery)
BDCAT = {"cream2go": "dessert", "aria-gelato-d-talipapa": "dessert", "real-coffee-boracay": "cafe", "lemon-i-cafe": "cafe", "cafe-del-sol": "cafe",
         "house-brew-cafe": "cafe", "gcafe-by-gmarket": "cafe", "cafe-got-soul-boracay": "cafe", "hobbit-tavern": "bar", "two-brown-boys": "bar", "kasbar": "bar"}
CUIS = {"al-fresco-restaurant": "필리핀·양식", "aloha-boracay-island-grill-restaurant": "그릴", "andoks-boracay": "필리핀 통닭", "aria-cucina-restaurant": "이탈리안",
        "aria-gelato-d-talipapa": "젤라또", "bun-bun-boracay": "버거·번", "cafe-del-sol": "카페·브런치", "cafe-got-soul-boracay": "카페", "cathy-s-bistro": "필리핀·양식",
        "cheesus-crust": "피자", "chowking-boracay": "중식 패스트푸드", "cornerstone": "필리핀·양식", "cream2go": "아이스크림·디저트", "cyma-greek-taverna": "그리스",
        "don-vito-boracay": "이탈리안", "dos-mestizos": "스페인·파에야", "eight-by-the-beach": "양식", "gcafe-by-gmarket": "카페·베이커리", "hama-japanese-cuisine": "일식",
        "hobbit-tavern": "펍·양식", "house-brew-cafe": "카페·양식", "island-chicken-inasal": "필리핀 닭구이", "jollibee-boracay": "필리핀 패스트푸드", "jt-s-manukan-grille": "필리핀 닭구이",
        "kaninderia-restaurant": "필리핀 덮밥", "kasbar": "바·모로코풍", "kfc-boracay": "치킨", "king-shrimp-restaurant": "새우·해산물", "koa-bora": "하와이안 포케",
        "kolai-mangyan": "필리핀", "lazy-dog": "펍·양식", "lemon-i-cafe": "카페·브런치", "little-taj-boracay": "인도", "los-indios-bravos": "펍·양식", "malatang": "중식 마라탕",
        "mang-inasal": "필리핀 닭구이", "mcdonald-s-boracay": "패스트푸드", "meze-wrap-boracay": "중동 랩", "mi-dam-jeong-korean-restaurant": "한식", "minute-burger": "버거",
        "muchos-boracay": "멕시칸", "nagisa-japanese-resto": "일식", "nalka-seafood-bar": "해산물", "niu-ohana-lutong-bahay": "필리핀 가정식", "nonies-restaurant": "필리핀 퓨전",
        "ol-restaurant": "스페인·타파스", "real-coffee-boracay": "카페·베이커리", "sensi-the-italian-restaurant": "이탈리안", "smoke-boracay": "필리핀", "tacio-s-boracay": "필리핀·양식",
        "thai-basil-restaurant": "태국", "tita-magz-home-kitchen": "필리핀 가정식", "tres-amigos-boracay": "멕시칸", "true-home-boracay": "필리핀·양식", "two-brown-boys": "바·양식",
        "villa-caemilla": "필리핀·양식"}
BAD_MATCH = {"nalkaseafood", "nalka"}
bd = load("bd_menus.json", {})
for slug, r in bd.items():
    name = r["name"].replace("👍 Preferred", "").strip()
    v = V_(name)
    v.setdefault("cat", BDCAT.get(slug, "restaurant")); v["cuisine"] = v.get("cuisine") or CUIS.get(slug, "")
    items = [p for p in r["products"] if p.get("php")]
    v["menus"]["delivery"] = [dict(n=p["n"], c=p["cat"], d=(p["desc"] or "")[:90], php=p["php"], o=p["opts"][:3], s=p["sold"]) for p in items]
    v["menus"]["deliveryBest"] = [p["n"] for p in sorted(r["products"], key=lambda p: -p.get("sold", 0))[:6] if p.get("sold")]
    v.setdefault("links", {})["delivery"] = "https://boracay.delivery/restaurant/" + slug + "/"
    if r.get("hours") and not v.get("hours"):
        h = r["hours"]; v["hours"] = "%02d:%02d–%02d:%02d (배달 플랫폼 기준)" % (h["open"] // 60, h["open"] % 60, (h["close"] // 60) % 24, h["close"] % 60)
    v["sources"].append("boracay.delivery 메뉴 (2026-11-23 수집)")
    if not v.get("pp") and items:
        mains = [p["php"] for p in items if 150 <= p["php"] <= 1500 and not re.search(r"(?i)drink|beverage|juice|coffee|tea|shake|soda|beer|wine|cocktail|add.?on|extra|side|rice$|dessert|sauce", (p["cat"] or "") + " " + p["n"])]
        if len(mains) >= 4:
            med = statistics.median(mains); v["pp"] = [round(med * 0.9 / 10) * 10, round(med * 1.4 / 10) * 10]; v["ppEst"] = True

# 5) 좌표 (OSM)
MANUAL = {"hobbit": "n14041027768", "nonies": None, "jonahs": "n11522102969", "sunnyside": "w1548036487"}
EXTRA_XY = {"villacaemilla": (11.94979, 121.93132, "OSM way 31781453"), "cocomama": (11.962191, 121.926398, "GPT 가이드 좌표 (Trip.com 게시물 GPS)")}
pid = {}
for l in open(os.path.join(R, "data", "raw", "pois.txt")):
    f = l.rstrip("\n").split("|")
    if len(f) > 3 and re.match(r"^-?\d", f[3].split(",")[0] if "," in f[3] else ""): pid[f[0]] = f
    elif len(f) > 4 and "," in f[4]: pid[f[0]] = [f[0], f[1] + f[2], f[3], f[4], f[5] if len(f) > 5 else ""]
BYNAME = {"Mesa (Henann Regency)": "w1286532528", "I Love Backyard BBQ (I Luv Backyard BBQ)": "n4430661389", "Yellow Cab Pizza Co. (Boracay)": "n9547624541",
          "Shakey's Pizza (Boracay)": "w31781017", "La Fiesta (Mandarin Bay Resort) - dinner buffet": "n4110757083", "Sulu Plaza Thai Restaurant": "n10054905184",
          "Sababi (spelling unverified)": "w31974448", "Sensi the Italian Restaurant": "w31781037", "Tita Magz Home Kitchen": "w31781450", "Niu Ohana Lutong Bahay": "w1546862486",
          "MALATANG": "n14234938102", "GCafe By GMARKET": "n12519335323", "Donenoo Korean BBQ": "n10082153932", "Spicebird": "n11007783988", "The ONE SHOT": "n14234453901"}
BYNAME["Little Taj Boracay"] = "n11006728477"
for nm, oid in BYNAME.items(): MANUAL[canon(nm)] = oid
EXTRA_XY[canon("Henann Garden Resort mango shake (in-hotel)")] = (HOTEL["lat"], HOTEL["lon"], "호텔 안")
EXTRA_XY[canon("Quara Korean Restaurant (꽐라 한식당 / 꽐라식당)")] = (11.95843, 121.92903, "근사 위치: 블로그 설명 '헤난 라군 옆' 기준 (OSM 미등록)")
for c, v in V.items():
    if v.get("lat") and v.get("lon"): continue
    if c in EXTRA_XY: la, lo, s = EXTRA_XY[c]; v.update(lat=la, lon=lo, coordSrc=s, coordConf="low" if "근사" in s else "medium"); continue
    f = None
    if c in MANUAL and MANUAL[c]: f = pid.get(MANUAL[c])
    elif c in pois and c not in BAD_MATCH: f = pois[c]
    if f:
        la, lo = map(float, f[3].split(",")); v.update(lat=la, lon=lo, coordSrc="OSM " + ("node " if f[0][0] == "n" else "way ") + f[0][1:], coordConf="high")
        if f[4] and not v.get("hours"): v["hours"] = f[4] + " (OSM)"

# 5b) 환전소 · 과일가게 (OSM 위치 + 조사 결과)
from hours import parse as parse_hours, PLATFORM_DEFAULT
SHOPS = [  # (OSM id, 이름, 한국어, 분류, 설명)
    ("n11007698090", "V. B. Queen's Money Changer", "브이비 퀸즈 환전소", "money", "디몰 안 환전소"),
    ("n14057998967", "El Chen Money Changer", "엘 첸 환전소", "money", "디몰 북쪽 메인로드 환전소"),
    ("n11006942480", "M Lhuillier (D'Mall)", "엠 륄리에 (디몰)", "money", "전당포 겸 환전·송금 체인"),
    ("n6388425651", "M Lhuillier (Station 3)", "엠 륄리에 (스테이션 3)", "money", "전당포 겸 환전·송금 체인"),
    ("n11011483313", "Cebuana Lhuillier", "세부아나 륄리에", "money", "전당포 겸 환전·송금 체인"),
    ("n11010640771", "Palawan Pawnshop", "팔라완 전당포", "money", "전당포 겸 환전·송금 체인"),
    ("n14241096297", "BPI (D'Mall)", "BPI 은행 (디몰)", "money", "은행·ATM"),
    ("n12901423973", "BDO", "BDO 은행", "money", "은행·ATM (해외카드 1회 ₱250 수수료)"),
    ("n3057138532", "Metrobank (Station 2)", "메트로뱅크", "money", "은행·ATM"),
    ("n10060224407", "Nikko Fruit Store", "니코 과일가게 (디몰)", "fruit", "디몰 시장 쪽 과일가게"),
    ("n11006942483", "Fruitas", "프루타스 (디몰)", "fruit", "과일 주스·쉐이크 체인"),
    ("n11932740294", "El Centro Fruit Shakes", "엘 센트로 과일 쉐이크", "fruit", "해변길 과일 쉐이크 (헤난 가든 가까움)"),
    ("n14157204565", "Jonah's Fruit Shakes (Station 1–2)", "조나스 과일 쉐이크", "fruit", "망고 쉐이크로 유명한 조나스의 지점"),
    ("w31929703", "D'Mall Palengke Market", "디몰 재래시장 (과일 노점)", "fruit", "디몰 안 시장, 과일 노점"),
    ("w316240419", "Talipapa Bukid Market", "탈리파파 부킷 시장 (과일·채소)", "fruit", "현지인 시장, 과일·채소 노점이 모여 있음"),
    ("n10062685399", "Jomer Fruit Stand", "조머 과일 노점", "fruit", "탈리파파 부킷 시장 과일 노점"),
    ("n10099959017", "Sweet Fruit Store", "스위트 과일가게", "fruit", "스테이션 2 안쪽 과일가게"),
    ("n12415986597", "Healthree Foods", "헬스리 푸드 (채소·과일)", "fruit", "채소·과일 상점"),
    ("n14057998962", "Isle Veggies Store", "아일 베지 (채소·과일)", "fruit", "채소·과일 상점"),
    ("n10222738245", "Eleven J Pasalubong (dried fruits)", "일레븐 J 기념품 (말린 망고)", "fruit", "말린 망고 등 기념품 (한국 반입 가능 품목)"),
]
mf = load("money_fruit.json", {}) or {}
def find_r(name, arr):
    k = canon(name).split("dmall")[0][:8]
    for r in arr or []:
        if k and k in canon(r.get("name", "")): return r
    return None
for oid, nm, ko, cat, desc in SHOPS:
    f = pid.get(oid)
    if not f: print("missing osm", oid, nm); continue
    la, lo = map(float, f[3].split(","))
    V["shop-" + oid] = dict(key="shop-" + oid, name=nm, sources=[], menus={}, photos=[]); v = V["shop-" + oid]; v.update(name=nm, ko=ko, cat=cat, desc=desc, lat=la, lon=lo, coordSrc="OSM " + ("node " if oid[0] == "n" else "way ") + oid[1:], coordConf="high")
    if f[4]: v["hours"] = f[4] + " (OSM)"
    r = find_r(nm, mf.get("changers" if cat == "money" else "fruit"))
    if r:
        for a_, b_ in (("hours", "hours"), ("korean_review", "krReview"), ("tips", "tips"), ("rate_notes", "rateNote"), ("usd_rate_notes", "rateNote"), ("sells", "sells"), ("prices", "fruitPrices")):
            val = r.get(a_)
            if val and (b_ != "hours" or not v.get("hours")): v[b_] = val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)
        v["sources"] += [x for x in (r.get("sources") or []) if isinstance(x, str) and x.startswith("https://")][:5]
    v["sources"].append("OpenStreetMap")

# 5c) 영업시간 정리
for c, v in V.items():
    h = v.get("hours")
    if isinstance(h, str) and h.startswith("09:00–21:30") and "배달 플랫폼" in h:
        mm = re.search(r"OSM (node|way) (\d+)", v.get("coordSrc", "")); f = pid.get(mm.group(1)[0] + mm.group(2)) if mm else None
        v["hours"] = (f[4] + " (OSM)") if f and f[4] else "매장 영업시간 미확인 (배달 접수 09:00–21:30)"
    if isinstance(v.get("hours"), str):
        H = parse_hours(v["hours"])
        if H: v["H"] = H

# 6) 출력
GLOSS = {"sisig": "시시그(다진 돼지고기 철판)", "adobo": "아도보(간장·식초 조림)", "sinigang": "시니강(새콤한 국)", "kare-kare": "카레카레(땅콩 스튜)", "kare kare": "카레카레(땅콩 스튜)",
         "lechon": "레촌(통구이 돼지)", "liempo": "리엠포(삼겹살 구이)", "pancit": "판싯(볶음국수)", "lumpia": "룸피아(춘권)", "halo-halo": "할로할로(필리핀 빙수)", "halo halo": "할로할로(필리핀 빙수)",
         "bulalo": "불랄로(소뼈 국)", "tapa": "타파(소고기 육포 구이)", "longganisa": "롱가니사(소시지)", "inasal": "이나살(닭 숯불구이)", "calamansi": "깔라만시", "ube": "우베(보라색 참마)",
         "garlic rice": "마늘밥", "crispy pata": "크리스피 파타(족발 튀김)", "kinilaw": "키닐라우(회 무침)", "bangus": "방우스(밀크피시)", "tocino": "토시노(달콤한 돼지고기)",
         "silog": "실로그(밥+달걀 세트)", "chopsuey": "찹수이(채소볶음)", "chop suey": "찹수이(채소볶음)", "lomi": "로미(걸쭉한 국수)", "palabok": "팔라복(새우소스 국수)", "laing": "라잉(토란잎 코코넛 조림)",
         "gambas": "감바스(마늘 새우)", "paella": "파에야", "gyros": "기로스(그리스 고기 랩)", "souvlaki": "수블라키(꼬치)", "tikka": "티카(인도식 구이)", "biryani": "비리야니(인도 볶음밥)",
         "pad thai": "팟타이", "tom yum": "똠얌", "ramen": "라멘", "katsu": "카츠", "poke": "포케", "burrito": "부리토", "taco": "타코", "quesadilla": "케사디야", "nachos": "나초",
         "bibimbap": "비빔밥", "kimchi": "김치", "samgyeopsal": "삼겹살", "bulgogi": "불고기", "japchae": "잡채", "tteokbokki": "떡볶이", "ramyeon": "라면", "mango": "망고", "shake": "쉐이크",
         "pizza": "피자", "pasta": "파스타", "carbonara": "까르보나라", "lasagna": "라자냐", "risotto": "리조또", "calamares": "깔라마레스(오징어튀김)", "squid": "오징어", "prawn": "새우", "shrimp": "새우",
         "crab": "게", "lobster": "랍스터", "scallop": "가리비", "fish": "생선", "tuna": "참치", "chicken": "닭", "pork": "돼지고기", "beef": "소고기", "lamb": "양고기"}
out, menus = [], {}
for c, v in V.items():
    if not v.get("cat"): continue
    vid = v.get("placeId") or ("v-" + c)[:40]
    m = v.pop("menus")
    if any(m.values()): menus[vid] = m
    v["id"] = vid; v["hasMenu"] = bool(m.get("curated") or m.get("gpt") or m.get("kr") or m.get("delivery"))
    v["menuCount"] = len(m.get("delivery") or []) + len(m.get("curated") or m.get("gpt") or m.get("kr") or [])
    v["best"] = m.get("deliveryBest") or [x["n"] for x in (m.get("curated") or m.get("gpt") or m.get("kr") or [])[:4]]
    if v.get("lat"): v["x"], v["y"] = xy(v["lat"], v["lon"])
    v.setdefault("links", {}).setdefault("gmaps", "https://www.google.com/maps/search/?api=1&query=" + re.sub(r"\s+", "+", (v["name"] + " Boracay")))
    v["sources"] = list(dict.fromkeys(v["sources"]))[:10]
    v.pop("key", None)
    out.append(v)
json.dump(out, open(os.path.join(R, "site", "venues.json"), "w"), ensure_ascii=False, separators=(",", ":"))
# 7) Openverse 사진: 매장 사진(제목에 매장명+Boracay 확인된 것만) + 대표 음식 이미지
OV = load("openverse.json", {"dish": {}, "venue": {}}) or {"dish": {}, "venue": {}}
DISHP = OV.get("dish", {})
DKEYS = sorted(DISHP.keys(), key=len, reverse=True)
CUIS_DISH = [("한식|korean", ["samgyeopsal", "bibimbap", "bulgogi", "kimchi"]), ("일식|japanese", ["sushi", "ramen", "tempura"]), ("이탈리안|피자|italian|pizza", ["pizza", "pasta", "lasagna"]),
             ("그리스|greek|중동|meze", ["gyros", "hummus", "souvlaki"]), ("인도|indian", ["curry", "biryani", "naan"]), ("태국|thai", ["pad thai", "tom yum", "green curry"]),
             ("멕시칸|mexican", ["taco", "burrito", "nachos"]), ("스페인|파에야|타파스", ["paella"]), ("해산물|새우|seafood|crab|shrimp", ["shrimp", "crab", "fish"]), ("버거|burger", ["burger", "fries"]),
             ("치킨|닭|inasal|chicken", ["inasal", "fried chicken"]), ("마라탕|malatang", ["malatang", "noodle"]), ("중식|chowking", ["fried rice", "dumpling", "noodle"]), ("포케|poke", ["poke"]),
             ("필리핀|filipino", ["sisig", "adobo", "lechon", "pancit", "sinigang"]), ("젤라또|아이스크림|ice", ["ice cream", "gelato"]), ("카페|커피|coffee|cafe|브런치|베이커리", ["coffee", "pancake", "muffin", "latte"]),
             ("바|펍|bar|pub", ["cocktail", "beer"]), ("과일|fruit|shake", ["mango shake", "mango", "juice"]), ("양식|그릴|grill", ["steak", "bbq", "burger"])]
def dish_of(text):
    t = (text or "").lower()
    for k in DKEYS:
        if re.search(r"(^|[^a-z])" + re.escape(k) + r"([^a-z]|$)", t): return k
    return None
for v in out:
    vid = v["id"]
    for ph in (OV.get("venue", {}).get(v["name"]) or []):
        if not any(p["src"] == ph["src"] for p in v["photos"]): v["photos"].append(dict(ph, caption=(ph.get("title") or "")[:60]))
    if v["cat"] in ("money", "pharmacy", "convenience"): continue
    key = None
    for n in (v.get("best") or []):
        key = dish_of(n)
        if key: break
    if not key:
        hay = ((v.get("cuisine") or "") + " " + v["name"] + " " + (v.get("ko") or "") + " " + v["cat"]).lower()
        for pat, keys in CUIS_DISH:
            if re.search(pat, hay):
                avail = [k for k in keys if k in DISHP]
                if avail: key = avail[sum(map(ord, vid)) % len(avail)]; break
    if not key and v["cat"] in ("cafe", "dessert") and "coffee" in DISHP: key = "coffee"
    if not key and "buffet" in DISHP: key = "sisig" if "sisig" in DISHP else None
    if key and key in DISHP: v["rep"] = dict(DISHP[key], dish=key)
with open(os.path.join(R, "site", "venues.json"), "w") as fh: json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
print("venues with real photos", sum(1 for v in out if v["photos"]), "with rep", sum(1 for v in out if v.get("rep")), "/ food", sum(1 for v in out if v["cat"] not in ("money", "pharmacy", "convenience")))
EXTRA = dict(scenic=SCENIC,
    changers=[dict(name=c.get("name"), ko=c.get("ko_name"), loc=c.get("location"), rate=c.get("usd_rate_notes"), krw=c.get("takes_krw"), tips=c.get("tips"), kr=c.get("korean_review"))
              for c in (mf.get("changers") or []) if re.search(r"Nikko|Golden|Salamat|Henann", c.get("name") or "")],
    fruitSeason=(mf.get("fruit_season") or {}).get("summary"), quarantine=mf.get("korea_quarantine"),
    fruitTips=[f.get("tips") for f in (mf.get("fruit") or []) if f.get("tips")][:3],
    mangoPrice="D'Mall 과일가게 망고 1kg ₱150–200 (한국 여행사 블로그, 날짜 미상)")
json.dump(EXTRA, open(os.path.join(R, "site", "extra.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(dict(menus=menus, gloss=GLOSS, dishPhotos=DISHP), open(os.path.join(R, "site", "menus.json"), "w"), ensure_ascii=False, separators=(",", ":"))
from collections import Counter
print("hours parsed", sum(1 for v in out if v.get("H")), "/", len(out))
print("venues", len(out), Counter(v["cat"] for v in out), "with xy", sum(1 for v in out if "x" in v), "with menu", sum(1 for v in out if v["hasMenu"]),
      "kr", sum(1 for v in out if v.get("krPop")), "rated", sum(1 for v in out if v.get("rating")))
print("venues.json %d KB, menus.json %d KB" % (os.path.getsize(os.path.join(R, "site", "venues.json")) // 1024, os.path.getsize(os.path.join(R, "site", "menus.json")) // 1024))
print("no xy:", [v["name"] for v in out if "x" not in v])
