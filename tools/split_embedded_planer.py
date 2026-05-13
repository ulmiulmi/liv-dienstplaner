#!/usr/bin/env python3
"""
Teilt die grosse POLYPOINT-Ein-Datei in kleinere Projektdateien auf.

Eingabe:
  index.html mit <script id="embedded-planer-data" type="application/json">...</script>

Ausgabe:
  - bereiche/<bereich>.html
  - data/planer-manifest.json
  - index.html mit kleinem eingebettetem Manifest und Fetch-Loader

Die produktive main-Branch bleibt davon unberuehrt, solange dieser Umbau-Branch
nicht gemerged wird.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
AREAS_DIR = ROOT / "bereiche"
DATA_DIR = ROOT / "data"

DATA_RE = re.compile(
    r'(<script\s+id="embedded-planer-data"\s+type="application/json">)(.*?)(</script>)',
    re.S,
)

OLD_LOADER_RE = re.compile(
    r"const frames = \{};\s*let current = '';\s*function makeFrame\(id\)\{.*?\n\s*window\.addEventListener\('message', ev=>\{\s*const msg = ev && ev\.data;\s*if\(msg && msg\.type === 'loadPlanner'\) show\(msg\.id\);\s*\}\);",
    re.S,
)

NEW_LOADER = r"""const frames = {};
  const contentCache = {};
  let current = '';

  function hasArea(id){
    return !!((DATA.contentPaths && DATA.contentPaths[id]) || (DATA.contents && DATA.contents[id]));
  }

  async function loadAreaHtml(id){
    if(contentCache[id]) return contentCache[id];
    if(DATA.contents && DATA.contents[id]){
      contentCache[id] = DATA.contents[id];
      return contentCache[id];
    }
    const path = (DATA.contentPaths && DATA.contentPaths[id]) || ('bereiche/' + id + '.html');
    const res = await fetch(path, { cache: 'no-store' });
    if(!res.ok) throw new Error('Bereich konnte nicht geladen werden: ' + id + ' (' + res.status + ')');
    contentCache[id] = await res.text();
    return contentCache[id];
  }

  async function makeFrame(id){
    if(frames[id]) return frames[id];
    const html = await loadAreaHtml(id);
    const iframe = document.createElement('iframe');
    iframe.className = 'planner-frame';
    iframe.setAttribute('title', DATA.labels[id] || id);
    iframe.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
    iframe.dataset.planner = id;
    wrap.appendChild(iframe);
    frames[id] = iframe;
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    return iframe;
  }

  async function show(id){
    if(!hasArea(id)) id='overview';
    current = id;
    loader.style.display='flex';
    Object.values(frames).forEach(f=>f.classList.remove('active'));
    try{
      const frame = await makeFrame(id);
      frame.classList.add('active');
      document.querySelectorAll('button[data-planner]').forEach(btn=>btn.classList.toggle('active', btn.dataset.planner===id));
      document.getElementById('activeLabel').textContent = 'geladen: ' + (DATA.labels[id] || id);
      document.title = 'POLYPOINT Adapter · ' + (DATA.labels[id] || id) + ' · V' + DATA.version;
      refreshTopExportState();
      if(exportModal()?.classList.contains('show')) refreshExportButtons();
    }catch(err){
      console.error(err);
      loader.textContent = 'Bereich konnte nicht geladen werden: ' + (DATA.labels[id] || id);
    }finally{
      setTimeout(()=>{ loader.style.display='none'; }, 180);
    }
  }

  window.loadPlannerArea = show;
  document.querySelectorAll('button[data-planner]').forEach(btn=>btn.addEventListener('click',()=>show(btn.dataset.planner)));
  window.addEventListener('message', ev=>{
    const msg = ev && ev.data;
    if(msg && msg.type === 'loadPlanner') show(msg.id);
  });"""


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")
    m = DATA_RE.search(html)
    if not m:
        raise SystemExit("embedded-planer-data nicht gefunden")

    data = json.loads(m.group(2))
    contents = data.get("contents") or {}
    if not isinstance(contents, dict) or not contents:
        raise SystemExit("Keine eingebetteten Bereichsinhalte gefunden")

    AREAS_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)

    content_paths: dict[str, str] = {}
    for key, area_html in contents.items():
        safe_key = re.sub(r"[^a-zA-Z0-9_-]", "_", key)
        path = AREAS_DIR / f"{safe_key}.html"
        path.write_text(area_html, encoding="utf-8")
        content_paths[key] = f"bereiche/{safe_key}.html"

    manifest = dict(data)
    manifest["contents"] = {}
    manifest["contentPaths"] = content_paths
    manifest["splitBuild"] = {
        "enabled": True,
        "note": "Bereichsinhalte liegen extern in bereiche/*.html; Serverdaten bleiben unveraendert.",
    }

    DATA_DIR.joinpath("planer-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    compact_manifest = json.dumps(manifest, ensure_ascii=False, separators=(",", ":"))
    html = html[: m.start(2)] + compact_manifest + html[m.end(2) :]

    html2, count = OLD_LOADER_RE.subn(NEW_LOADER, html, count=1)
    if count != 1:
        raise SystemExit("Loader-Block konnte nicht eindeutig ersetzt werden")

    html2 = html2.replace(
        "const frame = frames[current] || makeFrame(current);\n    return frame && frame.contentWindow;",
        "const frame = frames[current];\n    return frame && frame.contentWindow;",
    )

    INDEX.write_text(html2, encoding="utf-8")
    print(f"Aufgeteilt: {len(contents)} Bereiche -> {AREAS_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
