#!/usr/bin/env python3
"""Stops a commit that would publish a key or a private file.

    python3 tools/check_secrets.py            # checks what is staged (what `git commit` would publish)
    python3 tools/check_secrets.py --all      # checks every file Git tracks, and the whole history

It looks for the things that must never reach GitHub: your config.properties, TMDB keys (the 32-character API key and
the long "eyJ..." read token), the Developer Mode key file, private keys, and any `tmdb_key=` with a value. It reads
git's own file list, so it checks exactly what would be uploaded.
"""
import re
import subprocess
import sys

FORBIDDEN_FILES = re.compile(r'(^|/)(config\.properties|\.lgtv-key\.json|[^/]*\.keystore|[^/]*\.pem|id_rsa[^/]*|\.env)$')
PATTERNS = [
    ('a TMDB read token (eyJ...)', re.compile(r'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}')),
    ('a tmdb_key with a value', re.compile(r'tmdb_key\s*=\s*[A-Za-z0-9._-]{16,}')),
    ('a 32-character hex key', re.compile(r'(?<![0-9a-fA-F])[0-9a-f]{32}(?![0-9a-fA-F])')),
    ('a private key', re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----')),
    ('a client-key', re.compile(r'"client-key"\s*:\s*"[A-Za-z0-9]{20,}"')),
]
# Files that legitimately hold long hex strings (checksums, the pinned commit).
SKIP = re.compile(r'(^|/)(third_party/|assets/|licenses/|docs/screenshot\.png$)')


BINARY = re.compile(r'\.(png|jpe?g|gif|ico|ttf|woff2?|ipk|zip|gz)$', re.I)


def git(*args):
    out = subprocess.run(['git'] + list(args), capture_output=True, check=True).stdout
    return out.decode('utf-8', errors='replace')


def check_text(name, text, problems):
    for label, rx in PATTERNS:
        for m in rx.finditer(text):
            if label == 'a 32-character hex key' and m.group(0) in KNOWN_OK:
                continue
            problems.append('%s: looks like %s' % (name, label))
            break


# Not secrets: commit ids and checksums that happen to be long hex strings.
KNOWN_OK = set()


def main(everything):
    problems = []
    names = git('ls-files').split('\n') if everything else git('diff', '--cached', '--name-only').split('\n')
    for name in [n for n in names if n]:
        if FORBIDDEN_FILES.search(name) and name != 'config.example.properties':
            problems.append('%s: this file must stay on your computer' % name)
            continue
        if SKIP.search(name) or BINARY.search(name):
            continue
        try:
            text = git('show', ':' + name) if not everything else open(name, encoding='utf-8', errors='ignore').read()
        except (subprocess.CalledProcessError, OSError):
            continue
        check_text(name, text, problems)
    if everything:
        # the whole history: every added line of every commit
        history = subprocess.run(['git', 'log', '--all', '-p', '--no-color'], capture_output=True).stdout.decode('utf-8', errors='replace')
        for line in history.split('\n'):
            if not line.startswith('+') or line.startswith('+++'):
                continue
            for label, rx in PATTERNS:
                if label != 'a 32-character hex key' and rx.search(line):
                    problems.append('history: a line looks like %s' % label)
    if problems:
        print('Stopped: this would publish something private.\n  - ' + '\n  - '.join(sorted(set(problems))))
        print('Remove it (and keep config.properties out of Git), then try again.')
        return 1
    print('No keys or private files found.')
    return 0


if __name__ == '__main__':
    sys.exit(main('--all' in sys.argv))
