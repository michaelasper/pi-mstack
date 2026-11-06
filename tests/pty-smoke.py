import json
import os
import pty
import select
import signal
import sys
import time

pid, fd = pty.fork()
if pid == 0:
    os.execvpe(sys.argv[1], sys.argv[1:], os.environ)
output = bytearray()
deadline = time.monotonic() + 15
passed = False
try:
    while time.monotonic() < deadline:
        ready, _, _ = select.select([fd], [], [], 0.1)
        if ready:
            try:
                data = os.read(fd, 65536)
            except OSError:
                break
            if not data:
                break
            output.extend(data)
            if b'scripted-complete' in output:
                passed = True
                break
finally:
    try:
        os.write(fd, b'\x03\x03\x04')
        time.sleep(0.2)
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    until = time.monotonic() + 2
    while time.monotonic() < until:
        if os.waitpid(pid, os.WNOHANG)[0]:
            break
        time.sleep(0.05)
    else:
        os.kill(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
    os.close(fd)
try:
    os.kill(pid, 0)
    process_exited = False
except ProcessLookupError:
    process_exited = True
print(json.dumps({'completedOutput': passed, 'processExited': process_exited, 'terminalOutput': output.decode(errors='replace')}))
sys.exit(0 if passed and process_exited else 1)
