#!/usr/bin/env python3
"""Print the first free TCP port at or above the requested start port."""

from __future__ import annotations

import argparse
import errno
import socket
import sys


def is_free(port: int, host: str) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            # Some sandboxed environments disallow bind() entirely. In that
            # case, fall back to connect probing so the script remains useful.
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                probe.settimeout(0.2)
                result = probe.connect_ex((host, port))
                return result in {
                    errno.ECONNREFUSED,
                    errno.EHOSTUNREACH,
                    errno.ENETUNREACH,
                    errno.EPERM,
                    errno.EACCES,
                }
    return True


def find_free_port(start: int, host: str, limit: int) -> int:
    for port in range(start, limit + 1):
        if is_free(port, host):
            return port
    raise SystemExit(f"No free port found between {start} and {limit}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("start", type=int, help="Starting port")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--limit", type=int, default=65535)
    args = parser.parse_args()
    if args.start < 1 or args.start > 65535:
        parser.error("start must be between 1 and 65535")
    if args.limit < args.start or args.limit > 65535:
        parser.error("limit must be between start and 65535")
    print(find_free_port(args.start, args.host, args.limit))
    return 0


if __name__ == "__main__":
    sys.exit(main())
