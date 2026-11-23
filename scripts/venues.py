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
json.dump(dict(menus=menus, gloss=GLOSS), open(os.path.join(R, "site", "menus.json"), "w"), ensure_ascii=False, separators=(",", ":"))
from collections import Counter
print("venues", len(out), Counter(v["cat"] for v in out), "with xy", sum(1 for v in out if "x" in v), "with menu", sum(1 for v in out if v["hasMenu"]),
      "kr", sum(1 for v in out if v.get("krPop")), "rated", sum(1 for v in out if v.get("rating")))
print("venues.json %d KB, menus.json %d KB" % (os.path.getsize(os.path.join(R, "site", "venues.json")) // 1024, os.path.getsize(os.path.join(R, "site", "menus.json")) // 1024))
print("no xy:", [v["name"] for v in out if "x" not in v])
