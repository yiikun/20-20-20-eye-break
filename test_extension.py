#!/usr/bin/env python3
"""
20-20-20 Eye Break 插件测试脚本
用法：
    python3 test_extension.py

会读取 extension/manifest.json、js/background.js、js/content.js 并打印校验结果。
"""

import os
import re
import json
import sys
import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXTENSION_DIR = os.path.join(BASE_DIR, "extension")


def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def check_manifest():
    manifest_path = os.path.join(EXTENSION_DIR, "manifest.json")
    print("== manifest.json ==")
    text = read_file(manifest_path)
    manifest = json.loads(text)

    checks = []
    checks.append(("manifest_version == 3", manifest.get("manifest_version") == 3))
    checks.append(("version is semver", bool(re.match(r"^\d+\.\d+\.\d+$", manifest.get("version", "")))))
    checks.append(("has storage permission", "storage" in manifest.get("permissions", [])))
    checks.append(("has alarms permission", "alarms" in manifest.get("permissions", [])))
    checks.append(("has notifications permission", "notifications" in manifest.get("permissions", [])))
    checks.append(("has scripting permission", "scripting" in manifest.get("permissions", [])))
    checks.append(("has host_permissions all_urls", "<all_urls>" in manifest.get("host_permissions", [])))
    checks.append(("content_scripts has js/content.js", any("js/content.js" in cs.get("js", []) for cs in manifest.get("content_scripts", []))))

    for desc, ok in checks:
        print(f"  {'✓' if ok else '✗'} {desc}")

    return all(ok for _, ok in checks)


def check_background_js():
    bg_path = os.path.join(EXTENSION_DIR, "js", "background.js")
    print("\n== js/background.js ==")
    text = read_file(bg_path)

    checks = []
    checks.append(("calls showOverlayToAllTabs", "showOverlayToAllTabs()" in text))
    checks.append(("calls chrome.tabs.query", "chrome.tabs.query" in text))
    checks.append(("calls chrome.tabs.sendMessage", "chrome.tabs.sendMessage" in text))
    checks.append(("calls chrome.scripting.executeScript", "chrome.scripting.executeScript" in text))
    checks.append(("calls startRestTimer", "startRestTimer" in text))
    checks.append(("calls startWorkTimer", "startWorkTimer" in text))
    checks.append(("has trackEvent", "trackEvent" in text))
    checks.append(("has saveStateSync", "saveStateSync" in text))
    checks.append(("has storePhase", "storePhase" in text))

    # 简单花括号配对检查（可能因模板字符串误报）
    open_count = text.count("{")
    close_count = text.count("}")
    checks.append((f"braces balanced ({open_count}/{close_count})", open_count == close_count))

    for desc, ok in checks:
        print(f"  {'✓' if ok else '✗'} {desc}")

    return all(ok for _, ok in checks)


def check_content_js():
    content_path = os.path.join(EXTENSION_DIR, "js", "content.js")
    print("\n== js/content.js ==")
    text = read_file(content_path)

    checks = []
    checks.append(("has showOverlay function", "function showOverlay" in text))
    checks.append(("registers SHOW_OVERLAY listener", "SHOW_OVERLAY" in text and "onMessage" in text))
    checks.append(("reads timer_state", "timer_state" in text))
    checks.append(("uses EYE_TIPS", "EYE_TIPS" in text))
    checks.append(("has isContextValid", "isContextValid" in text))

    # 花括号配对检查
    open_count = text.count("{")
    close_count = text.count("}")
    checks.append((f"braces balanced ({open_count}/{close_count})", open_count == close_count))

    for desc, ok in checks:
        print(f"  {'✓' if ok else '✗'} {desc}")

    return all(ok for _, ok in checks)


def main():
    print(f"Testing extension at: {EXTENSION_DIR}\n")

    m_ok = check_manifest()
    b_ok = check_background_js()
    c_ok = check_content_js()

    print("\n== Summary ==")
    for label, ok in [
        ("manifest.json", m_ok),
        ("js/background.js", b_ok),
        ("js/content.js", c_ok),
    ]:
        print(f"  {'PASS' if ok else 'FAIL'}  {label}")

    sys.exit(0 if (m_ok and b_ok and c_ok) else 1)


if __name__ == "__main__":
    main()
