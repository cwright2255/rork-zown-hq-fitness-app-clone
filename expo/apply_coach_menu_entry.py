import pathlib

def apply_replacements(file_path, replacements):
    p = pathlib.Path(file_path)
    text = p.read_text()
    for label, old, new, *rest in replacements:
        replace_all = rest[0] if rest else False
        count = text.count(old)
        if replace_all:
            if count == 0:
                raise SystemExit(
                    f"MATCH FAILED in {file_path} on '{label}' (found 0 occurrences, "
                    f"expected at least 1) - file doesn't look like what was expected. "
                    f"Nothing changed in this file. Tell Claude this happened."
                )
            text = text.replace(old, new)
        else:
            if count != 1:
                raise SystemExit(
                    f"MATCH FAILED in {file_path} on '{label}' (found {count} occurrences, "
                    f"expected exactly 1) - file doesn't look like what was expected. "
                    f"Nothing changed in this file. Tell Claude this happened."
                )
            text = text.replace(old, new, 1)
    p.write_text(text)
    print(f"REPLACED OK in {file_path} ({len(replacements)}/{len(replacements)})")


# ============================================================
# app/profile.jsx - add a real nav entry to the AI Coach screen right
# after Body Scan in the Activity group, so it's reachable from the
# main Profile tab instead of only the Help screen's banner.
# ============================================================
old_menu = """      { icon: 'body-outline', label: 'Body Scan', route: '/body-scan/capture' },
    ],
  },"""
new_menu = """      { icon: 'body-outline', label: 'Body Scan', route: '/body-scan/capture' },
      { icon: 'chatbubbles-outline', label: 'AI Coach', route: '/coach' },
    ],
  },"""

apply_replacements('app/profile.jsx', [('add AI Coach entry after Body Scan', old_menu, new_menu)])

print("ALL FILES UPDATED OK")
