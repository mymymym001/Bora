# 아티팩트 게시 시 붙는 문서 골격을 흉내 내 로컬 테스트용 HTML 생성
import sys
src=open('site/index.html').read()
open('site/_test.html','w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'+src+'</body></html>')
