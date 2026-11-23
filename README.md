# 보라카이 가족 가이드 (2026.11.24–28)

헤난 가든 리조트 중심의 모바일 여행 가이드. 정적 HTML 한 페이지 + JSON 2개.

## 구조
- `src/shell.html` + `src/app.js` → `scripts/assemble.py` → `site/index.html` (아티팩트 형식, 스크립트 인라인)
- 실시간 기능(채팅·위치·사진)은 아티팩트 `db`/`user`/`assets` 기능 사용. 컬렉션: `chat`, `people/<uid>`, `photos`, `expenses`
- `site/data.json`, `site/map.json` — `scripts/build.py`가 생성
- `scripts/places.py` — **장소 데이터의 단일 출처** (가격·영업시간·출처)
- `scripts/build.py` — OSM 원본 → 지도 도형 + 도보/트라이크 경로 계산
- `data/` — OSM 원본, 웹 조사 결과
- `test/` — Playwright 화면·기능 테스트

## 수정 방법
1. `scripts/places.py`에서 장소·가격 수정 (환율은 `FX`)
2. `python3 scripts/build.py && python3 scripts/venues.py && python3 scripts/assemble.py`
   - `scripts/venues.py`: 식당·카페·환전소·과일가게 통합 목록(venues.json·menus.json·extra.json), `scripts/hours.py`: 영업시간 해석
3. `python3 test/wrap.py && (cd site && python3 -m http.server 8765 &) && node test/func.js && node test/live.js` (live.js는 모의 db 사용) + `node test/eat.js && node test/feat.js`
4. 아티팩트 다시 게시 (site/index.html + data.json + map.json)

지도 데이터 © OpenStreetMap contributors (ODbL).
