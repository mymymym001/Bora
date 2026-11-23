# -*- coding: utf-8 -*-
"""OSM 원본 → site/map.json (지도 도형) + site/data.json (장소·경로·환율).
실행: python3 scripts/build.py
경로는 OSM 도로망 위 최단거리(다익스트라)로 계산한 '지도 기반 추정'이다."""
import json, math, heapq, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from places import HOTEL, PLACES, LANDMARKS, UNPLACED, FX

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw", "osm.json")
OUT = os.path.join(ROOT, "site")
LAT0, LON0 = HOTEL["lat"], HOTEL["lon"]
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574

def xy(lat, lon):  # 호텔 기준 미터 (x 동쪽+, y 남쪽+)
    return ((lon - LON0) * KX, -(lat - LAT0) * KY)

def dist(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])

def simplify(pts, tol):
    if len(pts) < 3: return pts
    if dist(pts[0], pts[-1]) < 1e-6 and len(pts) > 3:  # 닫힌 고리: 가장 먼 점에서 둘로 나눠 단순화
        k = max(range(len(pts)), key=lambda i: dist(pts[0], pts[i]))
        return simplify(pts[:k + 1], tol)[:-1] + simplify(pts[k:], tol)
    def rec(s, e, out):
        a, b = pts[s], pts[e]; dmax, idx = 0, -1
        L = dist(a, b) or 1e-9
        for i in range(s + 1, e):
            p = pts[i]
            d = abs((b[0]-a[0])*(a[1]-p[1]) - (a[0]-p[0])*(b[1]-a[1])) / L
            if d > dmax: dmax, idx = d, i
        if dmax > tol: rec(s, idx, out); out.append(pts[idx]); rec(idx, e, out)
    out = [pts[0]]; rec(0, len(pts) - 1, out); out.append(pts[-1]); return out

def pack(pts): return [v for p in pts for v in (round(p[0]), round(p[1]))]

els = json.load(open(RAW))["elements"]

# ---------- 해안선 → 육지 폴리곤 ----------
S, W, N, E = 11.93, 121.90, 12.01, 121.98
coast = [[(g["lat"], g["lon"]) for g in e["geometry"]] for e in els if e["tags"].get("natural") == "coastline"]
chains = [c[:] for c in coast]
merged = True
while merged:
    merged = False
    for i in range(len(chains)):
        for j in range(len(chains)):
            if i != j and chains[i][-1] == chains[j][0]:
                chains[i] = chains[i] + chains[j][1:]; chains.pop(j); merged = True; break
        if merged: break

def perim_t(p):  # bbox 둘레 위치(반시계, 위경도 기준)
    lat, lon = min(max(p[0], S), N), min(max(p[1], W), E)
    d = {"b": abs(lat - S), "r": abs(lon - E), "t": abs(lat - N), "l": abs(lon - W)}
    side = min(d, key=d.get); w, h = E - W, N - S
    return {"b": lon - W, "r": w + (lat - S), "t": w + h + (E - lon), "l": 2*w + h + (N - lat)}[side]
CORNERS = [(0, (S, W)), (E - W, (S, E)), ((E - W) + (N - S), (N, E)), (2*(E - W) + (N - S), (N, W))]
PER = 2 * ((E - W) + (N - S))

land = []
for c in chains:
    if c[0] == c[-1]:
        land.append(c)
    else:  # bbox 밖으로 나가는 본섬(파나이) 해안선: 둘레를 따라 반시계로 닫기
        te, ts = perim_t(c[-1]), perim_t(c[0])
        if ts < te: ts += PER
        ring = c[:]
        for k in range(2):
            for t, pt in CORNERS:
                tt = t + k * PER
                if te < tt < ts: ring.append(pt)
        ring.append(c[0]); land.append(ring)

def poly_of(tagfn):
    return [e for e in els if tagfn(e["tags"]) and e["geometry"][0] == e["geometry"][-1]]

layers = {"land": [pack(simplify([xy(*p) for p in r], 2.5)) for r in land]}
def area(tagfn, tol=2.0):
    return [pack(simplify([xy(g["lat"], g["lon"]) for g in e["geometry"]], tol)) for e in poly_of(tagfn)]
layers["green"] = area(lambda t: t.get("natural") in ("wood", "scrub") or t.get("landuse") in ("grass", "forest", "farmland", "greenfield") or t.get("leisure") in ("park", "golf_course"), 3)
layers["beach"] = area(lambda t: t.get("natural") == "beach", 2)
layers["water"] = area(lambda t: t.get("natural") == "water" or t.get("leisure") == "swimming_pool", 1.5)

ROAD_CLASS = {"primary": 1, "secondary": 1, "tertiary": 2, "unclassified": 2, "residential": 3, "service": 4,
              "track": 4, "pedestrian": 5, "footway": 5, "path": 5, "steps": 5}
roads = []
for e in els:
    hw = e["tags"].get("highway")
    if hw in ROAD_CLASS:
        roads.append(dict(c=ROAD_CLASS[hw], n=e["tags"].get("name", ""),
                          p=pack(simplify([xy(g["lat"], g["lon"]) for g in e["geometry"]], 1.5))))
layers["roads"] = roads

# ---------- 라우팅 그래프 ----------
NOTRIKE = {"footway", "path", "steps", "pedestrian", "track"}
coord, gw, gt = {}, {}, {}
for e in els:
    hw = e["tags"].get("highway")
    if hw not in ROAD_CLASS: continue
    ids = e["nodes"]; geo = e["geometry"]
    for nid, g in zip(ids, geo): coord[nid] = xy(g["lat"], g["lon"])
    for a, b in zip(ids, ids[1:]):
        d = dist(coord[a], coord[b])
        for G, ok in ((gw, True), (gt, hw not in NOTRIKE)):
            if ok:
                G.setdefault(a, []).append((b, d)); G.setdefault(b, []).append((a, d))

def nearest(G, p):
    return min(G, key=lambda n: dist(coord[n], p))

def dijkstra(G, src):
    D, P = {src: 0}, {}
    pq = [(0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > D[u]: continue
        for v, w in G[u]:
            nd = d + w
            if nd < D.get(v, 1e18): D[v] = nd; P[v] = u; heapq.heappush(pq, (nd, v))
    return D, P

H = xy(LAT0, LON0)
# 호텔 출입구: 리조트 남쪽 경계의 Station 2 Road(OSM way 31846925) 위 가장 가까운 점
ENTRY_WAY = 31846925
entry_nodes = [n for e in els if e["id"] == ENTRY_WAY for n in e["nodes"]]
hw_node = ht_node = min(entry_nodes, key=lambda n: dist(coord[n], H))
ENTRY = coord[hw_node]
print("hotel walk snap %.0fm, trike snap %.0fm" % (dist(coord[hw_node], H), dist(coord[ht_node], H)))
DW, PW = dijkstra(gw, hw_node); DT, PT = dijkstra(gt, ht_node)

def path_to_hotel(P, start, end):
    out = [start]
    while out[-1] != end: out.append(P[out[-1]])
    return [coord[n] for n in out]

WALK_MPM = 67    # 도보 4 km/h (가족·어르신 기준)
TRIKE_MPM = 250  # e-트라이크 평균 15 km/h (대기 제외)

def route(p):
    P0 = xy(p["lat"], p["lon"])
    nw = nearest(gw, P0); nt = nearest(gt, P0)
    wl = DW.get(nw); tl = DT.get(nt)
    r = {}
    if wl is not None:
        pts = [P0] + path_to_hotel(PW, nw, hw_node)
        L = wl + dist(P0, coord[nw])
        r["walk"] = dict(m=round(L), min=max(1, round(L / WALK_MPM)), p=pack(simplify(pts, 2)))
    if tl is not None:
        pts = [P0] + path_to_hotel(PT, nt, ht_node)
        L = tl + dist(P0, coord[nt])
        r["trike"] = dict(m=round(L), min=max(2, round(L / TRIKE_MPM)), p=pack(simplify(pts, 2)))
    r["air"] = round(dist(P0, H))
    return r

places = []
for p in PLACES:
    q = dict(p); q["x"], q["y"] = [round(v) for v in xy(p["lat"], p["lon"])]
    q["route"] = route(p); places.append(q)
    print("%-16s air %4dm  walk %4dm %2dmin  trike %4dm" % (p["id"], q["route"]["air"], q["route"]["walk"]["m"], q["route"]["walk"]["min"], q["route"]["trike"]["m"]))

lm = [dict(l, **dict(zip(("x", "y"), [round(v) for v in xy(l["lat"], l["lon"])]))) for l in LANDMARKS]
os.makedirs(OUT, exist_ok=True)
json.dump(layers, open(os.path.join(OUT, "map.json"), "w"), separators=(",", ":"))
data = dict(hotel=dict(HOTEL, x=0, y=0, entry=[round(ENTRY[0]), round(ENTRY[1])]), places=places, landmarks=lm, unplaced=UNPLACED, fx=FX,
            built="2026-11-23", speeds=dict(walk_kmh=4, trike_kmh=15))
json.dump(data, open(os.path.join(OUT, "data.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("map.json %.0f KB, data.json %.0f KB" % (os.path.getsize(os.path.join(OUT, "map.json"))/1024, os.path.getsize(os.path.join(OUT, "data.json"))/1024))
