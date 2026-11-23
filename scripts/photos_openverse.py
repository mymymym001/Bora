# -*- coding: utf-8 -*-
"""Openverse(CC 라이선스 이미지 검색)에서 대표 음식 사진·매장 사진을 받아 site/img/ov/ 에 저장하고
data/sources/openverse.json 에 저자·라이선스·원본 링크를 기록한다. 실행: python3 -I scripts/photos_openverse.py"""
import json, os, re, sys, time, urllib.request, urllib.parse, io
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, "site", "img", "ov"); META = os.path.join(R, "data", "sources", "openverse.json")
UA = {"User-Agent": "BoracayFamilyGuide/1.0 (personal family trip page)"}
meta = json.load(open(META)) if os.path.exists(META) else {"dish": {}, "venue": {}}
def get(url, tries=3):
    for i in range(tries):
        try: return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
        except Exception as e:
            print("  retry", i, e); time.sleep(6)
    return None
def search(q, n=8):
    for i in range(3):
        b = get("https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(dict(q=q, page_size=n)))
        time.sleep(2.5)
        try: return json.loads(b)["results"]
        except Exception: print("  bad search response, retry"); time.sleep(5)
    return []
def save(r, name):
    fn = name + ".jpg"; p = os.path.join(OUT, fn)
    if not os.path.exists(p):
        b = get("https://api.openverse.org/v1/images/%s/thumb/" % r["id"])
        if not b: return None
        try:
            im = Image.open(io.BytesIO(b)).convert("RGB"); im.thumbnail((640, 640)); im.save(p, "JPEG", quality=72, optimize=True)
        except Exception as e: print("  bad image", e); return None
        time.sleep(0.6)
    return dict(src="img/ov/" + fn, title=r.get("title"), author=r.get("creator"), license=("CC " + r["license"].upper() + " " + (r.get("license_version") or "")).replace("CC CC0", "CC0").replace("CC PDM", "Public Domain").strip(),
                page=r.get("foreign_landing_url"), provider=r.get("source"))
DISH = {"sisig": "sisig", "adobo": "chicken adobo", "sinigang": "sinigang", "kare-kare": "kare-kare", "lechon": "lechon", "liempo": "inihaw liempo",
 "pancit": "pancit", "lumpia": "lumpia", "halo-halo": "halo-halo", "bulalo": "bulalo", "inasal": "chicken inasal", "calamares": "calamares", "garlic rice": "garlic fried rice",
 "tapa": "tapsilog", "longganisa": "longganisa", "crispy pata": "crispy pata", "pizza": "pizza", "pasta": "spaghetti pasta", "carbonara": "carbonara", "lasagna": "lasagna",
 "burger": "hamburger", "fries": "french fries", "salad": "salad", "gyros": "gyros", "souvlaki": "souvlaki", "hummus": "hummus", "curry": "indian curry", "biryani": "biryani",
 "naan": "naan bread", "pad thai": "pad thai", "tom yum": "tom yum soup", "green curry": "thai green curry", "ramen": "ramen", "sushi": "sushi", "sashimi": "sashimi",
 "tempura": "tempura", "katsu": "tonkatsu", "poke": "poke bowl", "burrito": "burrito", "taco": "tacos", "nachos": "nachos", "quesadilla": "quesadilla", "paella": "paella",
 "steak": "steak", "fish": "grilled fish", "shrimp": "garlic butter shrimp", "prawn": "grilled prawns", "crab": "chilli crab", "lobster": "grilled lobster", "squid": "grilled squid",
 "scallop": "scallops", "samgyeopsal": "samgyeopsal", "bibimbap": "bibimbap", "kimchi": "kimchi jjigae", "bulgogi": "bulgogi", "tteokbokki": "tteokbokki", "naengmyeon": "naengmyeon",
 "fried chicken": "fried chicken", "wings": "chicken wings", "noodle": "noodle soup", "fried rice": "fried rice", "dumpling": "dumplings", "soup": "soup bowl", "coffee": "cup of coffee",
 "latte": "latte art", "frappe": "frappuccino", "smoothie": "smoothie bowl", "mango shake": "mango shake", "shake": "fruit shake", "ice cream": "ice cream", "gelato": "gelato",
 "cake": "cake slice", "pancake": "pancakes", "waffle": "waffle", "french toast": "french toast", "omelette": "omelette", "benedict": "eggs benedict", "sandwich": "sandwich",
 "beer": "beer bottle", "cocktail": "cocktail", "juice": "fresh juice", "tea": "iced tea", "muffin": "muffin", "malatang": "malatang", "milk tea": "bubble tea", "mango": "mango fruit",
 "lanzones": "lanzones", "pastry": "pastry", "breakfast": "breakfast plate", "wrap": "wrap sandwich", "spring roll": "spring rolls", "bbq": "barbecue skewers", "buffet": "buffet food"}
def run_dishes():
    for k, q in DISH.items():
        if k in meta["dish"]: continue
        print("dish", k)
        res = search(q)
        res = [r for r in res if (r.get("height") or 1) and not re.search(r"(?i)menu|logo|sign|poster", r.get("title") or "")]
        for r in res[:3]:
            m = save(r, "dish-" + re.sub(r"[^a-z0-9]+", "-", k))
            if m: meta["dish"][k] = m; break
        json.dump(meta, open(META, "w"), ensure_ascii=False, indent=1)
def run_venues(names):
    for nm in names:
        if nm in meta["venue"]: continue
        core = re.sub(r"\s*\(.*?\)", "", nm).replace("’", "'").strip()
        toks = [t for t in re.findall(r"[a-z]{4,}", core.lower()) if t not in ("boracay", "restaurant", "cafe", "café", "korean", "grill", "station", "beach", "house", "shake", "fruit", "snack")]
        print("venue", core, toks)
        res = search(core + " Boracay")
        ok = []
        for r in res:
            txt = ((r.get("title") or "") + " " + " ".join(t["name"] for t in (r.get("tags") or []) if t.get("name"))).lower()
            if "boracay" in txt and toks and all(t in txt for t in toks[:2]): ok.append(r)
        meta["venue"][nm] = []
        for i, r in enumerate(ok[:2]):
            m = save(r, "v-" + re.sub(r"[^a-z0-9]+", "-", core.lower())[:40] + "-" + str(i))
            if m: meta["venue"][nm].append(m)
        print("  ->", len(meta["venue"][nm]))
        json.dump(meta, open(META, "w"), ensure_ascii=False, indent=1)
if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    run_dishes()
    v = json.load(open(os.path.join(R, "site", "venues.json")))
    pri = [x["name"] for x in v if x.get("cat") in ("restaurant", "cafe", "dessert", "bar", "fruit") and (x.get("krPop", 0) >= 2 or x.get("placeId") or x.get("rating"))]
    run_venues(pri)
    print("dish photos", len(meta["dish"]), "venue photos", sum(len(x) for x in meta["venue"].values()))
