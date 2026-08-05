#!/usr/bin/env python3
"""Inspect the real Linux assistive-technology tree for rich content."""

import argparse
import sys
import time

import gi

gi.require_version("Atspi", "2.0")
from gi.repository import Atspi  # noqa: E402


def children(node):
    for index in range(node.get_child_count()):
        child = node.get_child_at_index(index)
        if child is not None:
            yield child


def walk(node, depth=0, limit=20_000):
    pending = [(node, depth)]
    visited = 0
    while pending:
        current, current_depth = pending.pop()
        visited += 1
        if visited > limit:
            raise RuntimeError("AT-SPI tree exceeded inspection limit")
        yield current, current_depth
        pending.extend((child, current_depth + 1) for child in reversed(list(children(current))))


def snapshot():
    desktop = Atspi.get_desktop(0)
    return list(walk(desktop))


def role_name(node):
    try:
        return node.get_role_name() or ""
    except Exception:
        return ""


def node_name(node):
    try:
        return node.get_name() or ""
    except Exception:
        return ""


def wait_for_document(timeout=20):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        nodes = snapshot()
        documents = [(node, depth) for node, depth in nodes if "document" in role_name(node).lower()]
        if any("Pagenary Syntax Gallery" in node_name(node) for node, _ in documents):
            return nodes
        time.sleep(0.25)
    raise RuntimeError("Pagenary document did not appear in the AT-SPI tree")


def activate_route(nodes, label):
    for node, _ in nodes:
        if role_name(node).lower() == "push button" and node_name(node).upper() == label:
            action = node.get_action_iface()
            if action is None or action.get_n_actions() < 1 or not action.do_action(0):
                raise RuntimeError(f"Could not activate AT-SPI route button {label}")
            return
    raise RuntimeError(f"AT-SPI route button not found: {label}")


def wait_for(predicate, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        nodes = snapshot()
        entries = [(role_name(node).lower(), node_name(node), depth) for node, depth in nodes]
        if predicate(entries):
            return entries
        time.sleep(0.2)
    return [(role_name(node).lower(), node_name(node), depth) for node, depth in snapshot()]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("math", "diagrams"))
    args = parser.parse_args()
    nodes = wait_for_document()
    activate_route(nodes, "INLINE LATEX" if args.mode == "math" else "DIAGRAMS")
    entries = wait_for(
        (lambda values: sum(1 for role, _, _ in values if role == "math") >= 5)
        if args.mode == "math"
        else (lambda values: sum(1 for role, name, _ in values if role in ("image", "figure") and name) >= 5)
    )
    documents = [(role, name) for role, name, _ in entries if "document" in role]

    if args.mode == "math":
        math_nodes = [(role, name) for role, name, _ in entries if role == "math"]
        headings = [name for role, name, _ in entries if "heading" in role]
        if len(math_nodes) < 5:
            named = [(role, name) for role, name, _ in entries if name][:200]
            raise RuntimeError(f"Expected at least five AT-SPI math nodes, found {len(math_nodes)}; named tree: {named}")
        if not any("Inline LaTeX" in name for _, name in documents):
            raise RuntimeError(f"Inline LaTeX document title is missing from the AT-SPI tree: {documents}")
        print({"mode": "math", "documents": documents, "mathNodes": len(math_nodes), "headings": headings})
    else:
        images = [(role, name) for role, name, _ in entries if role in ("image", "figure") and name]
        if len(images) < 5:
            raise RuntimeError(f"Expected at least five named diagram images, found {len(images)}: {images}")
        print({"mode": "diagrams", "documents": documents, "namedImages": images})


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"AT-SPI rich-content qualification failed: {error}", file=sys.stderr)
        raise
