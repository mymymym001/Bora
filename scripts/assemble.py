# src/shell.html + src/app.js → site/index.html (아티팩트는 외부 JS 파일을 못 불러와서 인라인)
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
shell = open(os.path.join(R, "src", "shell.html")).read()
js = open(os.path.join(R, "src", "app.js")).read()
assert "</script" not in js
open(os.path.join(R, "site", "index.html"), "w").write(shell.rstrip() + "\n\n<script>\n" + js + "\n</script>\n")
print("site/index.html", os.path.getsize(os.path.join(R, "site", "index.html")) // 1024, "KB")
