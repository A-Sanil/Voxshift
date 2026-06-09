"""
Scrapes voice-models.com for RVC model listings.
No public API exists — we parse the server-rendered HTML.
"""
from __future__ import annotations
import re
import asyncio
from urllib.parse import unquote, urlparse, parse_qs
from typing import Optional

import httpx
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# Simple in-memory cache {cache_key: (timestamp, data)}
_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 300  # 5 minutes


def _cache_key(page: int, search: str, sort: str) -> str:
    return f"{sort}:{page}:{search.lower().strip()}"


def _get_cached(key: str) -> Optional[dict]:
    import time
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _set_cache(key: str, data: dict) -> None:
    import time
    _cache[key] = (time.time(), data)
    # Evict old entries
    if len(_cache) > 200:
        oldest = min(_cache, key=lambda k: _cache[k][0])
        del _cache[oldest]


CATEGORY_MAP = [
    (["anime", "touhou", "genshin", "vtuber", "vocaloid", "hatsune",
      "naruto", "bleach", "one piece", "dragon ball", "jujutsu", "demon slayer",
      "attack on titan", "my hero", "fairy tail", "sword art", "re:zero",
      "konosuba", "fate/", "kantai", "azur lane", "arknights"], "Anime"),
    (["singer", "vocalist", "rap", "rapper", "pop star", "music",
      "band", "song", "vocal"], "Singer"),
    (["robot", "cyborg", "android", "ai voice", "tts", "synthetic",
      "machine", "hal ", "glados", "cortana"], "Robotic"),
    (["female", "girl", "woman", "princess", "queen", "lady",
      "sister", "mother", "wife", "girlfriend", "actress"], "Feminine"),
    (["male", " guy", " man ", "lord", "king", "father",
      "brother", "husband", "actor", "prince"], "Masculine"),
]

CATEGORY_EMOJIS = {
    "Anime": "🌸",
    "Singer": "🎤",
    "Robotic": "🤖",
    "Feminine": "🌺",
    "Masculine": "🎙️",
    "Character": "🎭",
    "Game": "🎮",
}


def _categorise(name: str) -> str:
    n = name.lower()
    for keywords, cat in CATEGORY_MAP:
        if any(kw in n for kw in keywords):
            return cat
    # Heuristics for games
    game_words = ["(game)", "league of legends", "overwatch", "minecraft",
                  "valorant", "fortnite", "apex", "pokemon", "zelda",
                  "mario", "sonic", "kirby", "smash", "halo", "doom",
                  "mortal kombat", "street fighter", "final fantasy",
                  "kingdom hearts", "persona ", "fire emblem", "tales of"]
    if any(g in n for g in game_words):
        return "Game"
    return "Character"


def _clean_name(full_name: str) -> str:
    """Strip [RVC v2] [RMVPE] [N Epochs] tags from the display name."""
    cleaned = re.sub(
        r"\s*\[(?:RVC\s*v?\d+(?:\.\d+)?|RMVPE|HARVEST|DIO|PM|CREPE|\d+\s*Epochs?)\]\s*",
        " ", full_name, flags=re.IGNORECASE
    )
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def _parse_download_url(run_href: str) -> tuple[str | None, str]:
    """Decode the easyaivoice.com/run?url=... wrapper to get the real URL."""
    qs = parse_qs(urlparse(run_href).query)
    raw = qs.get("url", [None])[0]
    if not raw:
        return None, "unknown"
    url = unquote(raw)
    if "huggingface.co" in url:
        return url, "huggingface"
    if "drive.google.com" in url:
        return url, "gdrive"
    if "mega.nz" in url:
        return url, "mega"
    if "pixeldrain.com" in url:
        return url, "pixeldrain"
    return url, "direct"


def _parse_row(row) -> dict | None:
    name_link = row.find("a", href=re.compile(r"/model/"))
    if not name_link:
        return None

    m = re.search(r"/model/([^/?#]+)", name_link.get("href", ""))
    if not m:
        return None
    model_id = m.group(1)
    full_name = name_link.get_text(strip=True)

    creator_link = row.find("a", href=re.compile(r"/creator/"))
    creator = creator_link.get_text(strip=True) if creator_link else "Community"

    text = row.get_text()
    size_m = re.search(r"([\d.]+\s*(?:MB|GB|KB))", text, re.IGNORECASE)
    epochs_m = re.search(r"\[(\d+)\s*Epochs?\]", full_name, re.IGNORECASE)
    pitch_m = re.search(r"\[(RMVPE|HARVEST|DIO|PM|CREPE)\]", full_name, re.IGNORECASE)
    rvc_m = re.search(r"\[RVC\s*v?(\d+)\]", full_name, re.IGNORECASE)

    run_link = row.find("a", href=re.compile(r"easyaivoice\.com/run"))
    download_url, download_type = (None, "unknown")
    if run_link:
        download_url, download_type = _parse_download_url(run_link.get("href", ""))

    category = _categorise(full_name)
    clean = _clean_name(full_name)
    emoji = CATEGORY_EMOJIS.get(category, "🎭")

    return {
        "id": model_id,
        "name": clean,
        "full_name": full_name,
        "creator": creator,
        "avatar": emoji,
        "category": category,
        "file_size": size_m.group(1) if size_m else None,
        "epochs": int(epochs_m.group(1)) if epochs_m else None,
        "pitch_algo": pitch_m.group(1).upper() if pitch_m else "RMVPE",
        "rvc_version": rvc_m.group(1) if rvc_m else "2",
        "download_url": download_url,
        "download_type": download_type,
        "model_page_url": f"https://voice-models.com/model/{model_id}",
        # Marketplace display fields
        "downloads": 0,
        "rating": 0.0,
        "preview_url": None,
    }


async def scrape_models(
    page: int = 1,
    search: str = "",
    sort: str = "new",
    category: str = "All",
) -> dict:
    ck = _cache_key(page, search, sort)
    cached = _get_cached(ck)
    if cached:
        models = cached["models"]
        if category and category != "All":
            models = [m for m in models if m["category"] == category]
        return {**cached, "models": models}

    if sort == "top":
        base_url = "https://voice-models.com/top"
    elif sort == "female":
        base_url = "https://voice-models.com/female"
    elif sort == "male":
        base_url = "https://voice-models.com/male"
    else:
        base_url = "https://voice-models.com/"

    params: dict = {"page": page}
    if search:
        params["search"] = search

    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            resp = await client.get(base_url, params=params, headers=headers)
            resp.raise_for_status()
        html = resp.text
    except Exception as e:
        return {"models": [], "page": page, "has_more": False, "error": str(e)}

    soup = BeautifulSoup(html, "html.parser")

    rows: list = []
    for tag in ("tr", "li"):
        candidates = [
            r for r in soup.find_all(tag)
            if r.find("a", href=re.compile(r"/model/"))
        ]
        if candidates:
            rows = candidates
            break

    models = [r for row in rows if (r := _parse_row(row)) is not None]
    result = {"models": models, "page": page, "has_more": len(models) >= 20}
    _set_cache(ck, result)

    if category and category != "All":
        models = [m for m in models if m["category"] == category]
    return {**result, "models": models}
