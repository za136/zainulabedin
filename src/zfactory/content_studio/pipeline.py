"""Content studio: logline + beats -> bible, treatment, screenplay (Fountain), shot list,
storyboard prompts and a shoot schedule grouped by location."""
from __future__ import annotations

import csv
import io
import json
from collections import OrderedDict
from pathlib import Path

from ..core.files import write_files
from ..core.llm import LLM

TREATMENT_SYSTEM = "You are a story development executive. Write a vivid, present-tense prose treatment " \
                   "(800-1500 words) from the project bible and beats. Markdown, no preamble."
SCREENPLAY_SYSTEM = "You are a professional screenwriter. Write the screenplay in Fountain format, one " \
                    "scene per beat in order, using the given locations and characters. Output Fountain only."

DEFAULT_SHOTS = [("WS", "Establishing wide"), ("MS", "Action / blocking"), ("CU", "Key reaction")]


def _scene_heading(beat: dict, i: int) -> str:
    return f"{beat.get('int_ext', 'INT.')} {beat.get('location', 'UNKNOWN').upper()} - {beat.get('time', 'DAY')}"


def bible(spec: dict) -> str:
    f = spec["film"]
    chars = "\n".join(f"- **{c['name']}**: {c.get('description', '')}" for c in spec.get("character", []))
    locs = "\n".join(f"- **{l['name']}**: {l.get('description', '')}" for l in spec.get("location", []))
    return (f"# {f['title']}\n\n*{f.get('genre', '')} · {f.get('format', 'short')} · "
            f"~{f.get('runtime_min', '?')} min*\n\n**Logline:** {f['logline']}\n\n"
            f"## Characters\n\n{chars}\n\n## Locations\n\n{locs}\n\n## Tone & references\n\n"
            f"{f.get('tone', 'TBD')}\n")


def offline_treatment(spec: dict) -> str:
    parts = [f"# Treatment: {spec['film']['title']}\n", spec["film"]["logline"], ""]
    for i, b in enumerate(spec.get("beat", []), 1):
        parts.append(f"## {i}. {b['title']}\n\n{b.get('summary', '')}\n")
    return "\n".join(parts)


def offline_screenplay(spec: dict) -> str:
    f = spec["film"]
    out = [f"Title: {f['title']}", f"Credit: Written by", f"Author: {f.get('author', 'TBD')}", ""]
    for i, b in enumerate(spec.get("beat", []), 1):
        out += [_scene_heading(b, i), "", b.get("summary", ""), ""]
        for c in b.get("characters", []):
            out += [c.upper(), "(TODO: dialogue)", ""]
    return "\n".join(out)


def shot_list(spec: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["scene", "shot", "size", "description", "location", "characters", "notes"])
    for i, b in enumerate(spec.get("beat", []), 1):
        shots = b.get("shots") or [f"{d}: {b['title']}" for _, d in DEFAULT_SHOTS]
        for j, s in enumerate(shots, 1):
            size = DEFAULT_SHOTS[(j - 1) % len(DEFAULT_SHOTS)][0] if not b.get("shots") else ""
            w.writerow([i, f"{i}{chr(64 + j)}", size, s, b.get("location", ""),
                        "; ".join(b.get("characters", [])), ""])
    return buf.getvalue()


def storyboard_prompts(spec: dict) -> str:
    f = spec["film"]
    style = f.get("visual_style", "cinematic, anamorphic, natural light, film grain")
    lines = [f"# Storyboard prompts: {f['title']}\n", f"Global style: {style}\n"]
    for i, b in enumerate(spec.get("beat", []), 1):
        lines.append(f"## Scene {i}: {b['title']}\n\n> {_scene_heading(b, i)}. {b.get('summary', '')} "
                     f"Characters: {', '.join(b.get('characters', [])) or 'none'}. Style: {style}.\n")
    return "\n".join(lines)


def schedule(spec: dict, scenes_per_day: int = 4) -> str:
    by_loc: OrderedDict[str, list[int]] = OrderedDict()
    for i, b in enumerate(spec.get("beat", []), 1):
        by_loc.setdefault(b.get("location", "UNKNOWN"), []).append(i)
    out, day = [f"# Shoot schedule: {spec['film']['title']}\n",
                "Scenes are grouped by location to minimise company moves.\n"], 1
    for loc, scenes in by_loc.items():
        for k in range(0, len(scenes), scenes_per_day):
            chunk = scenes[k:k + scenes_per_day]
            out.append(f"- **Day {day}**: {loc}, scenes {', '.join(map(str, chunk))}")
            day += 1
    return "\n".join(out) + "\n"


def produce(spec: dict, out_dir: Path, llm: LLM | None = None) -> list[Path]:
    b = bible(spec)
    if llm is None:
        treatment, screenplay = offline_treatment(spec), offline_screenplay(spec)
    else:
        ctx = f"{b}\n\nBeats:\n{json.dumps(spec.get('beat', []), indent=2)}"
        treatment = llm.complete(TREATMENT_SYSTEM, ctx)
        screenplay = llm.complete(SCREENPLAY_SYSTEM, f"{ctx}\n\nTreatment:\n{treatment}")
    return write_files(Path(out_dir), {
        "00_bible.md": b,
        "01_treatment.md": treatment,
        "02_screenplay.fountain": screenplay,
        "03_shot_list.csv": shot_list(spec),
        "04_storyboard_prompts.md": storyboard_prompts(spec),
        "05_schedule.md": schedule(spec),
    })
