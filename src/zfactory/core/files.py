"""Write generated files safely and parse <file path="..."> blocks from model output."""
from __future__ import annotations

import re
from pathlib import Path

FILE_BLOCK = re.compile(r'<file path="([^"]+)">\n?(.*?)</file>', re.DOTALL)


def safe_path(root: Path, rel: str) -> Path:
    root = root.resolve()
    target = (root / rel).resolve()
    if target != root and root not in target.parents:
        raise ValueError(f"Refusing to write outside output dir: {rel}")
    return target


def write_files(root: Path, files: dict[str, str]) -> list[Path]:
    written = []
    for rel, content in files.items():
        path = safe_path(root, rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content if content.endswith("\n") else content + "\n")
        written.append(path)
    return written


def parse_file_blocks(text: str) -> dict[str, str]:
    return {m.group(1).strip(): m.group(2) for m in FILE_BLOCK.finditer(text)}


def read_tree(root: Path, exts: tuple[str, ...] = (".py", ".toml", ".md", ".txt")) -> dict[str, str]:
    out = {}
    for p in sorted(root.rglob("*")):
        if p.is_file() and p.suffix in exts and "__pycache__" not in p.parts:
            out[str(p.relative_to(root))] = p.read_text()
    return out


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "project"
