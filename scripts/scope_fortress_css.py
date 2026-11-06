#!/usr/bin/env python3
"""Scope docs/site/v2/style.css selectors under :where(.fortress-v2).

Run:
  /home/vector/fortress/portfolio/site/.venv-css/bin/python scripts/scope_fortress_css.py
"""
from pathlib import Path

import tinycss2

ROOT = ":where(.fortress-v2)"
HERE = Path(__file__).resolve().parent
INPUT = (HERE / "../../../docs/site/v2/style.css").resolve()
OUTPUT = HERE.parent / "src/styles/fortress-v2-scoped.css"


def split_top_level_commas(s: str) -> list[str]:
    out: list[str] = []
    cur: list[str] = []
    depth = 0
    quote: str | None = None
    i = 0
    while i < len(s):
        c = s[i]
        if quote:
            cur.append(c)
            if c == "\\" and i + 1 < len(s):
                i += 1
                cur.append(s[i])
            elif c == quote:
                quote = None
            i += 1
            continue
        if c in "\"'":
            quote = c
            cur.append(c)
            i += 1
            continue
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        if c == "," and depth == 0:
            part = "".join(cur).strip()
            if part:
                out.append(part)
            cur = []
            i += 1
            continue
        cur.append(c)
        i += 1
    tail = "".join(cur).strip()
    if tail:
        out.append(tail)
    return out


def prefix_selector(sel: str) -> str:
    s = sel.strip()
    if not s:
        return s
    low = s.lower()
    if low in (":root", "html"):
        return ROOT
    if low == "body":
        return ROOT
    if s == "*":
        return f"{ROOT} *"
    return f"{ROOT} {s}"


def transform_prelude_tokens(prelude: list) -> list:
    text = tinycss2.serialize(prelude).strip()
    if not text:
        return prelude
    parts = split_top_level_commas(text)
    prefixed = ", ".join(prefix_selector(p) for p in parts)
    return tinycss2.parse_component_value_list(prefixed)


def transform_rules(rules: list) -> list:
    acc: list = []
    for rule in rules:
        if rule.type == "qualified-rule":
            acc.append(
                tinycss2.ast.QualifiedRule(
                    rule.source_line,
                    rule.source_column,
                    transform_prelude_tokens(rule.prelude),
                    rule.content,
                )
            )
        elif rule.type == "at-rule":
            kw = rule.lower_at_keyword or ""
            if rule.content is not None and kw in ("media", "supports", "layer"):
                inner_text = tinycss2.serialize(rule.content)
                inner_rules = tinycss2.parse_rule_list(
                    inner_text, skip_comments=True, skip_whitespace=True
                )
                inner_tr = transform_rules(inner_rules)
                body = "".join(tinycss2.serialize([r]) for r in inner_tr)
                prelude_s = tinycss2.serialize(rule.prelude)
                wrapper = f"@{rule.at_keyword}{prelude_s}{{{body}}}"
                reparsed = tinycss2.parse_stylesheet(
                    wrapper, skip_comments=False, skip_whitespace=True
                )
                if reparsed and reparsed[0].type == "at-rule":
                    acc.append(reparsed[0])
                else:
                    acc.append(rule)
            else:
                acc.append(rule)
        else:
            acc.append(rule)
    return acc


def main() -> None:
    css = INPUT.read_text(encoding="utf-8")
    rules = tinycss2.parse_stylesheet(css, skip_comments=False, skip_whitespace=True)
    transformed = transform_rules(rules)
    header = (
        "/* Auto-generated from docs/site/v2/style.css — do not edit by hand */\n"
        "/* Regenerate: .venv-css/bin/python scripts/scope_fortress_css.py */\n"
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(header + tinycss2.serialize(transformed), encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
