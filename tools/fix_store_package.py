#!/usr/bin/env python3
"""Gives the store service's `state` folder inside an .ipk the owner and mode Developer Mode shares with its services.

    python3 tools/fix_store_package.py dist/com.gathin.tvhome_1.6.0_all.ipk

The store service keeps its Developer Mode SSH key in .../com.gathin.tvhome.store/state/key.pem. The computer puts it there
through the SSH session (user "prisoner") and the service reads it (group "jailer"): the folder has to be owned by
prisoner:jailer with mode 0770, as the Home helper does for its own state folders (scripts/fix-package-data.py there, which
this follows). Rewrites the archive in Python, so it also works where `ar` is the macOS one.
"""
import io
import pathlib
import sys
import tarfile

STATE = '/com.gathin.tvhome.store/state'


def read_ar(b):
    assert b[:8] == b'!<arch>\n', 'not an ar archive'
    i, members = 8, []
    while i < len(b):
        h = b[i:i + 60]
        size = int(h[48:58])
        members.append([h[:16].decode().strip().rstrip('/'), h, b[i + 60:i + 60 + size]])
        i += 60 + size + (size & 1)
    return members


def write_ar(members):
    out = bytearray(b'!<arch>\n')
    for name, h, data in members:
        out += h[:48] + str(len(data)).ljust(10).encode() + h[58:] + data + (b'\n' if len(data) & 1 else b'')
    return bytes(out)


def main(path):
    p = pathlib.Path(path).resolve()
    members = read_ar(p.read_bytes())
    data = next(m for m in members if m[0] == 'data.tar.gz')
    out, changed = io.BytesIO(), []
    with tarfile.open(fileobj=io.BytesIO(data[2]), mode='r:gz') as src, tarfile.open(fileobj=out, mode='w:gz') as dst:
        for entry in src:
            if entry.name.rstrip('/').endswith(STATE):
                assert entry.isdir()
                entry.uid, entry.gid, entry.uname, entry.gname, entry.mode = 5999, 5000, 'prisoner', 'jailer', 0o770
                changed.append(entry.name)
            dst.addfile(entry, src.extractfile(entry) if entry.isfile() else None)
    if len(changed) != 1:
        sys.exit('fix_store_package.py: expected one store state folder in %s, found %r' % (p.name, changed))
    data[2] = out.getvalue()
    p.write_bytes(write_ar(members))
    print('Store service state folder: owner prisoner:jailer, mode 0770 (%s)' % changed[0])


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
