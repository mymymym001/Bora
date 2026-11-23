# -*- coding: utf-8 -*-
"""영업시간 문자열 → 요일별 구간. 반환: {"w": [[[open,close],...] x7 (월~일)], "conflict": bool, "delivery": bool} 또는 None.
분 단위, close <= open 이면 다음날 새벽까지(+1440)."""
import re

DAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"]
KO_DAYS = {"월": 0, "화": 1, "수": 2, "목": 3, "금": 4, "토": 5, "일": 6}
RNG = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–~]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", re.I)
PLATFORM_DEFAULT = "09:00–21:30 (배달 플랫폼 기준)"

def _m(h, mi, ap):
    h = int(h); mi = int(mi or 0)
    if ap:
        ap = ap.lower()
        if ap == "pm" and h < 12: h += 12
        if ap == "am" and h == 12: h = 0
    return h * 60 + mi

def _ranges(txt):
    out = []
    for m in RNG.finditer(txt):
        if not (m.group(2) or m.group(5) or m.group(3) or m.group(6)): continue  # "7-8명" 같은 숫자 배제
        o = _m(m.group(1), m.group(2), m.group(3)); c = _m(m.group(4), m.group(5), m.group(6))
        if o >= 1440 or c > 1440: continue
        if c <= o: c += 1440
        out.append([o, c])
    return out

def _days(tok):
    tok = tok.lower().replace(" ", "")
    res = set()
    for part in tok.split(","):
        if part == "ph": continue
        if "-" in part:
            a, b = part.split("-")[:2]
            if a in DAYS and b in DAYS:
                i, j = DAYS.index(a), DAYS.index(b)
                k = i
                while True:
                    res.add(k)
                    if k == j: break
                    k = (k + 1) % 7
        elif part in DAYS: res.add(DAYS.index(part))
    return res

def parse(s):
    if not s or not isinstance(s, str): return None
    t = s.strip()
    if t.startswith(PLATFORM_DEFAULT[:11]) and "배달 플랫폼" in t and t.startswith("09:00–21:30"): return None
    low = t.lower()
    if re.search(r"24/7|24시간|24 hours|open 24", low) and not _ranges(t.replace("24/7", "")):
        return dict(w=[[[0, 1440]] for _ in range(7)], conflict=False, delivery=False)
    # OSM 형식: "Mo-Sa 10:00-20:00; Su 10:00-15:00"
    if re.match(r"^(mo|tu|we|th|fr|sa|su)", low):
        w = [[] for _ in range(7)]; ok = False
        for rule in t.split(";"):
            rule = rule.strip()
            m = re.match(r"^([A-Za-z,\- ]+?)\s+(.+)$", rule)
            if not m: continue
            ds = _days(m.group(1)); rs = _ranges(m.group(2))
            if m.group(2).strip().lower() == "off": rs = []
            for d in ds: w[d] = rs; ok = True
        if ok: return dict(w=w, conflict=False, delivery=False)
    rs = _ranges(t)
    if not rs: return None
    conflict = bool(re.search(r"conflict|출처마다|다른 자료|or \d|/ ?\d|자료 간 차이|서로 다름|다를 수", low))
    if conflict: rs = rs[:1]
    else:  # 겹치거나 맞닿은 구간은 합치고, 떨어진 구간(점심·저녁)은 유지
        rs.sort(); merged = []
        for o, c in rs:
            if merged and o <= merged[-1][1]: merged[-1][1] = max(merged[-1][1], c)
            else: merged.append([o, c])
        rs = merged[:3]
    w = [list(rs) for _ in range(7)]
    m = re.search(r"([월화수목금토일])요일\s*휴무", t)
    if m: w[KO_DAYS[m.group(1)]] = []
    if re.search(r"closed (on )?mon", low): w[0] = []
    return dict(w=w, conflict=conflict, delivery="배달" in t)

if __name__ == "__main__":
    for s in ["09:00–21:30 (배달 플랫폼 기준)", "11:30–21:00 (배달 플랫폼 기준)", "Mo-Sa 10:00-20:00; Su 10:00-15:00", "24시간 (OSM)", "12:00–21:00, 월요일 휴무 (Hue 공식)",
              "Lunch 11:00-16:00, Dinner 17:30-24:00 (WAUG)", "Conflicting: 9:30-22:30 or 7:30-23:00", "07:00–04:00 (Primer) · 해피아워 12:00부터", "Mo-Su,PH 08:00-17:30", "미확인", "10:00-01:00",
              "조식뷔페 06:00–10:00 · 단품 10:00–22:00 (공식 사이트)", "Mo-Fr 09:00-16:30"]:
        r = parse(s); print(s, "->", None if not r else (r["w"][0], r["w"][6], r["conflict"], r["delivery"]))
