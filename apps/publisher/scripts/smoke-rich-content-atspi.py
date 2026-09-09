#!/usr/bin/env python3
"""Inspect the real Linux assistive-technology tree for rich content."""

import argparse
import sys
import time

Atspi = None  # Loaded after argument validation; pure tree helpers remain testable.


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


def find_document(application_pid, document_name):
    """Select exactly one caller-owned application document; never use desktop counts."""
    applications = [node for node in children(Atspi.get_desktop(0))
                    if node.get_process_id() == application_pid]
    matches = []
    for application in applications:
        matches.extend(node for node, _ in walk(application)
                       if "document" in role_name(node).lower()
                       and document_name in node_name(node))
    if len(matches) > 1:
        raise RuntimeError(f"Ambiguous gallery document for application PID {application_pid}")
    return matches[0] if matches else None


def snapshot(application_pid, document_name):
    document = find_document(application_pid, document_name)
    return list(walk(document)) if document is not None else []


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


def wait_for_document(application_pid, document_name, timeout=20):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        nodes = snapshot(application_pid, document_name)
        if nodes:
            return nodes
        time.sleep(0.25)
    raise RuntimeError(f"Gallery document {document_name!r} did not appear for application PID {application_pid}")


def activate_route(application_pid, document_name, label, timeout=20):
    deadline = time.monotonic() + timeout
    observed = []
    while time.monotonic() < deadline:
        observed = []
        for node, _ in snapshot(application_pid, document_name):
            if role_name(node).lower() != "push button":
                continue
            name = node_name(node)
            observed.append(name)
            if name.upper() != label:
                continue
            action = node.get_action_iface()
            if action is not None and action.get_n_actions() > 0 and action.do_action(0):
                return
        time.sleep(0.2)
    raise RuntimeError(f"Could not activate owned AT-SPI route button {label}; observed buttons: {observed}")


def wait_for(predicate, application_pid, document_name, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        nodes = snapshot(application_pid, document_name)
        entries = [(role_name(node).lower(), node_name(node), depth) for node, depth in nodes]
        if predicate(entries):
            return entries
        time.sleep(0.2)
    return [(role_name(node).lower(), node_name(node), depth)
            for node, depth in snapshot(application_pid, document_name)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("math", "diagrams"))
    parser.add_argument("--application-pid", type=int, required=True,
                        help="PID reported by the caller-owned browser AT-SPI application")
    parser.add_argument("--document-name", default="Pagenary Syntax Gallery",
                        help="Unique gallery document title substring within that application")
    args = parser.parse_args()
    if args.application_pid <= 0 or not args.document_name.strip():
        parser.error("application PID must be positive and document name nonempty")
    global Atspi
    import gi
    gi.require_version("Atspi", "2.0")
    from gi.repository import Atspi
    nodes = wait_for_document(args.application_pid, args.document_name)
    activate_route(args.application_pid, args.document_name, "INLINE LATEX" if args.mode == "math" else "DIAGRAMS")
    route_title = "Inline LaTeX" if args.mode == "math" else "Diagrams"
    def route_ready(values):
        titled = any("document" in role and route_title in name for role, name, _ in values)
        if args.mode == "math":
            count = sum(1 for role, _, _ in values if role == "math")
        else:
            count = sum(1 for role, name, _ in values if role in ("image", "figure") and name)
        return titled and count >= 5
    entries = wait_for(route_ready, args.application_pid, args.document_name)
    documents = [(role, name) for role, name, _ in entries if "document" in role]

    if not any(route_title in name for _, name in documents):
        raise RuntimeError(f"Expected {route_title} document title in owned AT-SPI tree: {documents}")
    if args.mode == "math":
        math_nodes = [(role, name) for role, name, _ in entries if role == "math"]
        headings = [name for role, name, _ in entries if "heading" in role]
        if len(math_nodes) < 5:
            named = [(role, name) for role, name, _ in entries if name][:200]
            raise RuntimeError(f"Expected at least five AT-SPI math nodes, found {len(math_nodes)}; named tree: {named}")
        if not any("Inline LaTeX" in name for _, name in documents):
            raise RuntimeError(f"Inline LaTeX document title is missing from the AT-SPI tree: {documents}")
        print({"mode": "math", "applicationPid": args.application_pid, "documents": documents, "mathNodes": len(math_nodes), "headings": headings})
    else:
        images = [(role, name) for role, name, _ in entries if role in ("image", "figure") and name]
        if len(images) < 5:
            raise RuntimeError(f"Expected at least five named diagram images, found {len(images)}: {images}")
        print({"mode": "diagrams", "applicationPid": args.application_pid, "documents": documents, "namedImages": images})


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"AT-SPI rich-content qualification failed: {error}", file=sys.stderr)
        raise
