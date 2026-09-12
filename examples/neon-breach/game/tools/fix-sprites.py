import re

src = open("js/sprites.js").read()

# ---------------- SERVER 32x32 ----------------
server_rows = []
server_rows.append("." * 32)
server_rows.append("." + "F" * 30 + ".")
server_rows.append("." + "r" * 30 + ".")
for y in range(3, 16):
    inner = "F" + "." * 28 + "F"
    if y == 5:
        inner = "F" + ".........swwwwwwwwws........" + "F"
    elif y == 6:
        inner = "F" + ".........swCCwwwwCws........" + "F"
    elif y == 7:
        inner = "F" + ".........swwCCwwCCww........" + "F"
    elif y == 8:
        inner = "F" + ".........swCCwwwwCws........" + "F"
    elif y == 9:
        inner = "F" + ".........swwwwwwwwws........" + "F"
    elif y == 12 or y == 13:
        base = ["."] * 28
        for x in range(2, 26, 4):
            base[x] = "l"
        inner = "F" + "".join(base) + "F"
    server_rows.append("." + inner + ".")
server_rows[15] = "." + "r" * 30 + "."
for y in range(16, 30):
    base = ["."] * 28
    if (y - 16) % 2 == 1:
        for x in range(7, 21, 2):
            base[x] = "c"
    server_rows.append("." + "F" + "".join(base) + "F" + ".")
server_rows.append("." + "F" * 30 + ".")
server_rows.append("." * 32)
assert len(server_rows) == 32 and all(len(r) == 32 for r in server_rows), (
    len(server_rows), [ (i, len(r)) for i, r in enumerate(server_rows) if len(r) != 32 ])
SERVER_NEW = "const SERVER = [\n" + ",\n".join('  "' + r + '"' for r in server_rows) + ",\n];"

# ---------------- TERMINAL 24x24 ----------------
def r24(s):
    assert len(s) == 24, (s, len(s))
    return s

def termrow(diamond_pts):
    s = list("c" * 16)
    for x, ch in diamond_pts:
        s[x] = ch
    return r24("..gF" + "".join(s) + "Fg..")

D = "D"; C = "C"
term = []
term.append(r24("." * 24))
term.append(r24(".." + "g" * 20 + ".."))
term.append(r24("..g" + "F" * 18 + "g.."))
term.append(r24("..gF" + "c" * 16 + "Fg.."))
term.append(termrow([(6, D), (7, D), (8, D), (9, D)]))
term.append(termrow([(5, D), (6, D), (7, D), (8, D), (9, D), (10, D)]))
term.append(termrow([(4, D), (5, C), (6, C), (7, C), (8, C), (9, C), (10, C), (11, D)]))
term.append(termrow([(4, D), (5, C), (6, C), (7, C), (8, C), (9, C), (10, C), (11, D)]))
term.append(termrow([(5, D), (6, D), (7, D), (8, D), (9, D), (10, D)]))
term.append(termrow([(6, D), (7, D), (8, D), (9, D)]))
term.append(r24("..gF" + "c" * 16 + "Fg.."))
term.append(r24("..g" + "F" * 18 + "g.."))
term.append(r24("...." + "g" * 16 + "...."))
term.append(r24("...." + "p" * 16 + "...."))
term.append(r24("...." + "p" * 16 + "...."))
term.append(r24("....pp" + "." * 12 + "pp...."))
term.append(r24("....pp" + "." * 12 + "pp...."))
term.append(r24("....pp" + "." * 12 + "pp...."))
term.append(r24("...ppp" + "." * 12 + "ppp..."))
while len(term) < 24:
    term.append(r24("." * 24))
assert len(term) == 24
TERMINAL_NEW = "const TERMINAL = [\n" + ",\n".join('  "' + r + '"' for r in term) + ",\n];"

# ---------------- DRONE_STUN 16x16 ----------------
drone_stun = [
    "................",
    "..rr........rr..",
    ".rrrr......rrrr.",
    "..rr........rr..",
    ".....mmmm.......",
    "....mmmmmm......",
    "...mmmmmmmm.....",
    "...mmggggmm.....",
    "...mmgeemmm.....",
    "...mmmmmmmm.....",
    "....mmmmmm......",
    ".....mmmm.......",
    "................",
    "................",
    "................",
    "................",
]
assert all(len(r) == 16 for r in drone_stun)
DRONE_STUN_NEW = "const DRONE_STUN = [\n" + ",\n".join('  "' + r + '"' for r in drone_stun) + ",\n];"

# ---------------- DOOR 32x32 ----------------
door = ["h" * 32, "h" * 32]
for i in range(28):
    base = list("P" * 28)
    base[2] = "L"; base[25] = "L"
    base[13] = "f"; base[14] = "f"
    if i == 0:
        base[13] = "R"; base[14] = "R"
        base[1] = "Y"; base[26] = "Y"
    if i == 27:
        base[1] = "Y"; base[26] = "Y"
    door.append("hh" + "".join(base) + "hh")
door += ["h" * 32, "h" * 32]
assert len(door) == 32 and all(len(r) == 32 for r in door)
DOOR_NEW = "const DOOR = [\n" + ",\n".join('  "' + r + '"' for r in door) + ",\n];"
PAL_DOOR_NEW = 'const PAL_DOOR = { h: "#0c1322", P: "#1a2745", L: "#21e6ff", f: "#0a1120", Y: "#ffc233", R: "#ff3355" };'

# ---------------- EXIT 32x32 ----------------
cx = cy = 15.5
def dist(x, y):
    return ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5

exitg = [["."] * 32 for _ in range(32)]
for y in range(32):
    for x in range(32):
        d = dist(x + 0.5, y + 0.5)
        if d <= 14.5 and d >= 11.5:
            exitg[y][x] = "d"
        elif d < 11.5:
            exitg[y][x] = "c"

def put(x, y, ch):
    if 0 <= x < 32 and 0 <= y < 32 and dist(x + 0.5, y + 0.5) < 10.5:
        exitg[y][x] = ch

for i in range(8):
    for t in range(3):
        put(8 + i, 7 + t, "D")
        put(16 - i, 7 + t, "D")
        put(8 + i, 15 + t, "D")
        put(16 - i, 15 + t, "D")
for (xx, yy) in [(15, 12), (16, 12), (15, 13), (16, 13)]:
    put(xx, yy, "E")
EXIT_NEW = "const EXIT = [\n" + ",\n".join('  "' + "".join(r) + '"' for r in exitg) + ",\n];"
PAL_EXIT_NEW = 'const PAL_EXIT = { d: "#0c1322", c: "#0e2a44", D: "#7df9ff", E: "#e8ffff" };'

def replace_block(src, name, new_decl):
    m = re.search(r"const " + name + r" = \[", src)
    start = m.start()
    end = src.index("];", start) + 2
    return src[:start] + new_decl + src[end:]

src = replace_block(src, "SERVER", SERVER_NEW)
src = replace_block(src, "TERMINAL", TERMINAL_NEW)
src = replace_block(src, "DRONE_STUN", DRONE_STUN_NEW)
src = replace_block(src, "DOOR", DOOR_NEW)
src = replace_block(src, "EXIT", EXIT_NEW)
src = re.sub(r"const PAL_DOOR = \{[^}]*\};", PAL_DOOR_NEW, src)
src = re.sub(r"const PAL_EXIT = \{[^}]*\};", PAL_EXIT_NEW, src)

open("js/sprites.js", "w").write(src)
print("sprites.js rewritten OK")
