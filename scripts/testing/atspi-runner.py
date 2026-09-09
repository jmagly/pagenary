#!/usr/bin/env python3
"""Run rich-content AT-SPI qualification inside an owned D-Bus/Xvfb session."""
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time


def stop_process(child):
    if child is None or child.poll() is not None:
        return
    child.terminate()
    try:
        child.wait(timeout=5)
    except subprocess.TimeoutExpired:
        child.kill()
        child.wait(timeout=5)


def live_group_members(group):
    members = []
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            fields = (entry / 'stat').read_text().rsplit(')', 1)[1].split()
            if int(fields[2]) == group and fields[0] != 'Z':
                members.append(int(entry.name))
        except (OSError, ValueError, IndexError):
            continue
    return members


def stop_owned_group(child):
    for stop_signal in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(child.pid, stop_signal)
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            child.poll()
            if not live_group_members(child.pid):
                child.wait(timeout=5)
                return
            time.sleep(0.05)
    raise RuntimeError(f'Owned isolated process group did not stop: {live_group_members(child.pid)}')


def belongs_to(pid, ancestor):
    """Restrict AT-SPI applications to this launched Firefox process tree."""
    seen = set()
    while pid > 1 and pid not in seen:
        if pid == ancestor:
            return True
        seen.add(pid)
        try:
            # comm may contain spaces or parentheses; remaining fields begin at state.
            fields = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()
            pid = int(fields[1])
        except (OSError, ValueError, IndexError):
            return False
    return False


def accessible_application(browser, timeout=30):
    import gi
    gi.require_version('Atspi', '2.0')
    from gi.repository import Atspi
    deadline = time.monotonic() + timeout
    last = []
    while time.monotonic() < deadline:
        if browser.poll() is not None:
            raise RuntimeError(f'Owned Firefox exited before AT-SPI readiness: {browser.returncode}')
        desktop = Atspi.get_desktop(0)
        last = []
        owned = []
        for index in range(desktop.get_child_count()):
            app = desktop.get_child_at_index(index)
            if app is None:
                continue
            pid = app.get_process_id()
            last.append({'pid': pid, 'name': app.get_name()})
            if belongs_to(pid, browser.pid):
                owned.append(pid)
        if len(set(owned)) == 1:
            return owned[0]
        if len(set(owned)) > 1:
            raise RuntimeError(f'Ambiguous AT-SPI application processes: {owned}')
        time.sleep(0.25)
    raise RuntimeError(f'Owned Firefox application did not register on isolated AT-SPI bus: {last}')


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def session(root, firefox, checker):
    if os.environ.get('PAGENARY_ATSPI_ISOLATED') != '1':
        raise RuntimeError('Internal session mode requires the isolated runner')
    dist = root / 'apps/publisher/dist'
    handler = functools.partial(QuietHandler, directory=str(dist))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    browser = None
    try:
        with tempfile.TemporaryDirectory(prefix='pagenary-atspi-profile-') as directory:
            profile = Path(directory)
            (profile / 'user.js').write_text(
                'user_pref("accessibility.force_disabled", -1);\n'
                'user_pref("browser.shell.checkDefaultBrowser", false);\n'
                'user_pref("browser.startup.homepage_override.mstone", "ignore");\n'
                'user_pref("datareporting.policy.dataSubmissionEnabled", false);\n'
                'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);\n'
            )
            url = f'http://127.0.0.1:{server.server_address[1]}/syntax-gallery/'
            with (profile / 'firefox.log').open('w+') as browser_log:
                browser = subprocess.Popen(
                    [firefox, '--no-remote', '--new-instance', '--profile', str(profile), url],
                    stdin=subprocess.DEVNULL, stdout=browser_log, stderr=subprocess.STDOUT,
                    env={**os.environ, 'MOZ_ENABLE_WAYLAND': '0', 'MOZ_ACCESSIBILITY_ATSPI_ENABLED': '1', 'NO_AT_BRIDGE': '0'},
                )
                try:
                    app_pid = accessible_application(browser)
                    results = []
                    for mode in ('math', 'diagrams'):
                        argv = [sys.executable, str(checker), mode, '--application-pid', str(app_pid)]
                        result = subprocess.run(argv, text=True, capture_output=True, timeout=60)
                        results.append({'mode': mode, 'argv': argv, 'exitCode': result.returncode,
                                        'stdout': result.stdout, 'stderr': result.stderr})
                        if result.returncode != 0:
                            raise RuntimeError(json.dumps({'failedMode': mode, 'results': results}))
                    print(json.dumps({'result': 'PASS', 'boundary': 'real Firefox AT-SPI in isolated D-Bus/Xvfb',
                                      'applicationPid': app_pid, 'url': url, 'modes': results}), flush=True)
                except Exception:
                    browser_log.flush()
                    browser_log.seek(0)
                    print('Owned Firefox diagnostics:\n' + browser_log.read()[-12000:], file=sys.stderr)
                    raise
                finally:
                    stop_process(browser)
    finally:
        try:
            stop_process(browser)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)
            if thread.is_alive():
                raise RuntimeError('Owned static server did not stop')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--checker', type=Path, help='Registered AT-SPI checker path, absolute or relative to --root')
    parser.add_argument('--firefox', default=os.environ.get('PAGENARY_FIREFOX_BIN', '/usr/bin/firefox'))
    parser.add_argument('--session', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    root = args.root.resolve()
    checker = args.checker or Path('apps/publisher/scripts/smoke-rich-content-atspi.py')
    checker = (checker if checker.is_absolute() else root / checker).resolve()
    if not checker.is_file():
        parser.error(f'Registered AT-SPI checker missing: {checker}')
    if not args.session:
        subprocess.run(['node', str(root / 'scripts/testing/fresh-fixture-runner.mjs'),
                        '--fixture', 'syntax-gallery'], cwd=root, check=True, timeout=1150)
    if not (root / 'apps/publisher/dist/syntax-gallery/index.html').is_file():
        parser.error('Built syntax gallery missing: run node scripts/build-tenants.js --registry examples/recipes.tenants.json syntax-gallery from apps/publisher first')
    if args.session:
        return session(root, args.firefox, checker)
    for binary in ('dbus-run-session', 'xvfb-run', args.firefox):
        if shutil.which(binary) is None:
            parser.error(f'Required AT-SPI prerequisite missing: {binary}')
    env = {key: value for key, value in os.environ.items()
           if key not in ('DBUS_SESSION_BUS_ADDRESS', 'AT_SPI_BUS_ADDRESS', 'DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY')}
    env.update(PAGENARY_ATSPI_ISOLATED='1', NO_AT_BRIDGE='0', MOZ_ENABLE_WAYLAND='0')
    argv = ['dbus-run-session', '--', 'xvfb-run', '--auto-servernum',
            '--server-args=-screen 0 1280x900x24', sys.executable, str(Path(__file__).resolve()),
            '--root', str(root), '--firefox', args.firefox, '--checker', str(checker), '--session']
    child = subprocess.Popen(argv, env=env, start_new_session=True)
    try:
        code = child.wait(timeout=180)
        if code != 0:
            raise RuntimeError(f'Isolated AT-SPI session exited {code}')
    finally:
        # The process group belongs exclusively to this new bus/display session.
        stop_owned_group(child)
        print(json.dumps({'cleanup': 'owned isolated process group stopped', 'processGroup': child.pid}), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'AT-SPI orchestration failed: {error}', file=sys.stderr)
        sys.exit(1)
