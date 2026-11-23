# -*- coding: utf-8 -*-
"""수집한 메뉴 가격(배달 앱 + 직접 조사)으로 '대분류 > 예시 메뉴' 적정 가격대 계산 → site/extra.json 의 priceGuide"""
import json, os, re, statistics
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = json.load(open(os.path.join(R, "site", "menus.json")))["menus"]
V = {v["id"]: v for v in json.load(open(os.path.join(R, "site", "venues.json")))}
FAST = re.compile(r"jollibee|mcdonald|kfc|chowking|mang inasal|minute burger|andok|island chicken", re.I)
items = []
for vid, m in M.items():
    v = V.get(vid, {}); fast = bool(FAST.search(v.get("name", "")))
    for x in (m.get("delivery") or []) + (m.get("curated") or []):
        p = x.get("php"); p = p[0] if isinstance(p, list) else p
        if isinstance(p, (int, float)) and 20 <= p <= 6000:
            items.append(dict(n=(x.get("n") or "").lower(), c=(x.get("c") or "").lower(), d=(x.get("d") or x.get("ko") or "").lower(), p=p, fast=fast, cat=v.get("cat"), cu=v.get("cuisine") or ""))
print("items", len(items))
def q(ps, a): s = sorted(ps); return s[min(len(s) - 1, int(a * (len(s) - 1)))]
def r10(x): return int(round(x / 10.0) * 10)
GROUPS = [
 ("패스트푸드", "졸리비·맥도날드·KFC·망이나살 같은 체인", [
   ("치킨 1조각 + 밥", lambda i: i["fast"] and re.search(r"chicken|chickenjoy|inasal|paa|pecho", i["n"]) and re.search(r"rice|1 ?pc|1-pc|meal", i["n"] + i["d"]) and not re.search(r"bucket|family|2 ?pc|6|8", i["n"])),
   ("버거 단품", lambda i: i["fast"] and re.search(r"burger|yumburger|champ", i["n"]) and not re.search(r"meal|fries|combo|bundle", i["n"])),
   ("스파게티", lambda i: i["fast"] and re.search(r"spaghetti", i["n"]) and not re.search(r"bucket|family|meal|bundle|party|platter|pan", i["n"])),
   ("감자튀김", lambda i: i["fast"] and re.search(r"fries", i["n"]) and not re.search(r"burger|meal|combo|bundle|chicken", i["n"]))]),
 ("필리핀 현지식", "시시그·아도보·시니강 등 (현지 식당)", [
   ("시시그", lambda i: not i["fast"] and "sisig" in i["n"] and not re.search(r"rice bowl|silog|meal", i["n"])),
   ("아도보", lambda i: not i["fast"] and "adobo" in i["n"] and not re.search(r"rice bowl|silog|meal", i["n"])),
   ("시니강 (국)", lambda i: not i["fast"] and "sinigang" in i["n"]),
   ("판싯 (볶음국수)", lambda i: not i["fast"] and re.search(r"pancit|canton|bihon", i["n"])),
   ("실로그 아침 세트 (밥+달걀+고기)", lambda i: re.search(r"silog", i["n"])),
   ("마늘밥 1공기", lambda i: re.search(r"^garlic rice|garlic fried rice", i["n"]) and not re.search(r"platter|family", i["n"]))]),
 ("양식", "피자·파스타·버거·스테이크", [
   ("피자 한 판", lambda i: re.search(r"pizza|margherita|pepperoni|quattro", i["n"] + " " + i["c"]) and not re.search(r"slice|panini|bread|dip|famiglia|party", i["n"]) and i["p"] >= 250),
   ("파스타", lambda i: re.search(r"pasta|spaghetti|carbonara|aglio|penne|linguine|fettuccine|bolognese|vongole", i["n"] + " " + i["c"]) and not i["fast"] and not re.search(r"to share|family|platter", i["n"])),
   ("버거 (레스토랑)", lambda i: not i["fast"] and re.search(r"burger", i["n"]) and not re.search(r"slider|kid", i["n"])),
   ("스테이크", lambda i: re.search(r"steak|ribeye|sirloin|tenderloin", i["n"]) and not re.search(r"sandwich|rice|salpicao|bowl|tapa|burger|pasta|salad|fries|wrap|pizza|silog|quesadilla|taco", i["n"]) and i["p"] >= 450),
   ("샐러드", lambda i: re.search(r"salad", i["n"]) and not re.search(r"side|add", i["n"]))]),
 ("해산물", "식당에서 주문 시 (시장 파루토는 아래 kg당 가격 참고)", [
   ("새우 요리", lambda i: re.search(r"shrimp|prawn|gambas|hipon", i["n"]) and not re.search(r"chips|cracker|siomai|dumpling|fried rice|pasta|spaghetti|pizza", i["n"])),
   ("생선구이·생선요리", lambda i: re.search(r"fish|tuna|lapu|bangus|salmon|maya", i["n"]) and not re.search(r"fish ?ball|sauce|chips|sandwich|burger|fillet sandwich|kids", i["n"])),
   ("오징어 튀김·구이 (칼라마레스)", lambda i: re.search(r"calamar|squid|pusit", i["n"])),
   ]),
 ("한식·아시안", "한식당·일식·태국·인도·중식", [
   ("삼겹살·고기구이", lambda i: re.search(r"samgyeop|pork belly bbq|bulgogi|galbi|kbbq|korean bbq", i["n"])),
   ("비빔밥·찌개", lambda i: re.search(r"bibimbap|jjigae|kimchi stew|doenjang|soondubu|sundubu", i["n"])),
   ("라멘", lambda i: re.search(r"ramen", i["n"])),
   ("스시·롤", lambda i: re.search(r"sushi|maki|roll", i["n"]) and re.search(r"japanese|일식", i["cu"] + " " + i["c"])),
   ("팟타이·태국 커리", lambda i: re.search(r"pad thai|green curry|red curry|massaman|tom yum", i["n"])),
   ("인도 커리", lambda i: re.search(r"masala|korma|vindaloo|curry", i["n"]) and re.search(r"인도", i["cu"])),
   ("볶음밥", lambda i: re.search(r"fried rice|yang ?chow", i["n"]) and not re.search(r"platter|family|bilao", i["n"]))]),
 ("카페 음료", "커피·차·스무디", [
   ("아메리카노·브루드 커피", lambda i: re.search(r"americano|brewed coffee|black coffee|drip", i["n"])),
   ("카페라테·카푸치노", lambda i: re.search(r"latte|cappuccino|flat white", i["n"]) and not re.search(r"tea latte|matcha|baileys|kahlua|irish|liqueur|shot|cocktail|martini", i["n"]) and i["p"] <= 350),
   ("아이스티·레모네이드", lambda i: re.search(r"iced tea|lemonade|calamansi juice", i["n"])),
   ("프라페·스무디", lambda i: re.search(r"frappe|frappuccino|smoothie", i["n"]) and not re.search(r"bowl", i["n"]))]),
 ("디저트·쉐이크", "망고 쉐이크·할로할로·아이스크림·케이크", [
   ("망고 쉐이크", lambda i: re.search(r"mango", i["n"]) and re.search(r"shake|smoothie", i["n"])),
   ("과일 쉐이크 (망고 외)", lambda i: re.search(r"shake", i["n"]) and not re.search(r"mango|milkshake|protein", i["n"])),
   ("할로할로 (빙수)", lambda i: re.search(r"halo", i["n"])),
   ("아이스크림·젤라또", lambda i: re.search(r"ice cream|gelato|sundae", i["n"]) and not re.search(r"cake|tub|gallon|liter|pint", i["n"])),
   ("케이크 한 조각·파이", lambda i: re.search(r"cake|cheesecake|pie|brownie", i["n"]) and not re.search(r"whole|pancake|cupcake box|crab cake|fish cake|rice cake", i["n"]) and i["p"] < 600)]),
 ("주류·음료", "맥주·칵테일·탄산·생수 (식당·바)", [
   ("맥주 (산미구엘 등) 1병", lambda i: re.search(r"san miguel|red horse|beer|pale pilsen|light|cerveza", i["n"]) and not re.search(r"bucket|tower|pitcher|battered|root|ginger|chicken|light meal|highlight", i["n"]) and i["p"] < 400),
   ("칵테일", lambda i: re.search(r"mojito|margarita|pina colada|piña colada|daiquiri|cocktail|mai tai|long island|sangria", i["n"]) and not re.search(r"pitcher|bucket|jug|shrimp|prawn", i["n"])),
   ("탄산음료·캔", lambda i: re.search(r"coke|sprite|royal|soda|softdrink|soft drink|pepsi|7up|mountain dew", i["n"]) and not re.search(r"float|1\.5|liter|litre|family|bundle|meal|combo", i["n"])),
   ("생수", lambda i: re.search(r"water", i["n"]) and re.search(r"bottle|mineral|500|purified|^water", i["n"]) and not re.search(r"1\.5|liter|litre|gallon|watermelon|coconut", i["n"]))]),
]
out = []
for g, desc, rows in GROUPS:
    rr = []
    for label, fn in rows:
        ps = [i["p"] for i in items if fn(i)]
        if len(ps) < 8: print("skip", label, len(ps)); continue
        lo, hi, top = q(ps, 0.25), q(ps, 0.75), q(ps, 0.9)
        rr.append(dict(m=label, lo=r10(lo), hi=r10(hi), high=r10(top), n=len(ps)))
        print(f"{g:8} {label:22} n={len(ps):3} 적정 {r10(lo)}–{r10(hi)}  비싼편 {r10(top)}+")
    if rr: out.append(dict(g=g, desc=desc, rows=rr))
p = os.path.join(R, "site", "extra.json"); e = json.load(open(p)); e["priceGuide"] = out
e["priceGuideNote"] = "boracay.delivery 메뉴 %d개 + 직접 조사 가격 (2026-11-23 수집) 기준. 가운데 50%%(하위 25%%~상위 25%% 제외)를 ‘적정’, 상위 10%% 이상을 ‘비싼 편’으로 표시했어요. 배달 앱 가격이라 매장 가격과 조금 다를 수 있어요." % len(items)
json.dump(e, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
