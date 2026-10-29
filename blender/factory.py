"""GIGAWORKS factory building: hall, skylight roof, facade, lobby, sign, doors,
floor markings, safety fence, lobby furniture and the configurator kiosk.
Reads src/data/layout.json (three.js coords; blender y = -z)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh, math
from mathutils import Vector, Matrix
from lib import *

reset()
L = load_json('src/data/layout.json')
H = L['hall']
X0, X1, Z0, Z1, HT = H['x0'], H['x1'], H['z0'], H['z1'], H['height']


def P(x, z, y=0.0):
    """three.js (x, y, z) -> blender (x, -z, y)"""
    return (x, -z, y)


CLAD = mat('Cladding', (0.20, 0.23, 0.27), metal=0.6, rough=0.45)
CLAD2 = mat('CladdingLight', (0.78, 0.80, 0.82), metal=0.5, rough=0.4)
ACCENT = mat('AccentBlue', (0.0, 0.45, 0.9), metal=0.3, rough=0.35, emit=(0.0, 0.35, 0.9), strength=0.6)
STEEL = mat('SteelBeam', (0.35, 0.37, 0.4), metal=0.85, rough=0.4)
WHITE_STEEL = mat('WhiteSteel', (0.85, 0.86, 0.87), metal=0.4, rough=0.45)
GLASS = mat('FacadeGlass', (0.10, 0.16, 0.20), metal=0.2, rough=0.05, alpha=0.35)
SKY = mat('Skylight', (0.9, 0.95, 1.0), emit=(0.85, 0.92, 1.0), strength=1.6)
FRAME = mat('Mullion', (0.08, 0.08, 0.09), metal=0.7, rough=0.35)
CONC_WALL = mat('InnerWall', (0.62, 0.63, 0.64), rough=0.85)
YELLOW = mat('SafetyYellow', (0.95, 0.72, 0.05), rough=0.5)
WHITEP = mat('FloorWhite', (0.9, 0.9, 0.9), rough=0.6)
SIGN = mat('SignGlow', (1, 1, 1), emit=(0.85, 0.95, 1.0), strength=6.0)
LAMP = mat('LampPanel', (1, 1, 1), emit=(1.0, 0.97, 0.92), strength=4.0)
DESK = mat('DeskWhite', (0.92, 0.92, 0.93), rough=0.3)
WOOD = mat('Wood', (0.45, 0.30, 0.18), rough=0.6)
PLANT = mat('Plant', (0.12, 0.38, 0.12), rough=0.8)
POT = mat('Pot', (0.15, 0.15, 0.16), rough=0.6)
KIOSK = mat('KioskBody', (0.08, 0.09, 0.1), metal=0.6, rough=0.3)
DOORRED = mat('RollupDoor', (0.55, 0.57, 0.6), metal=0.7, rough=0.45)

root = empty('factory')

# ---------------------------------------------------------------- walls
W = Builder()
T = 0.5
ent = L['entrance']
lob = L['lobby']
ru = L['rollup']

# north wall
W.box(P((X0 + X1) / 2, Z0, HT / 2), (X1 - X0, T, HT), CLAD)
# west wall
W.box(P(X0, (Z0 + Z1) / 2, HT / 2), (T, Z1 - Z0, HT), CLAD)
# east wall with roll-up opening
rz0, rz1 = ru['z'] - ru['width'] / 2, ru['z'] + ru['width'] / 2
W.box(P(X1, (Z0 + rz0) / 2, HT / 2), (T, rz0 - Z0, HT), CLAD)
W.box(P(X1, (rz1 + Z1) / 2, HT / 2), (T, Z1 - rz1, HT), CLAD)
W.box(P(X1, ru['z'], (ru['height'] + HT) / 2), (T, ru['width'], HT - ru['height']), CLAD)
# door frame (yellow/black)
for zz in (rz0 - 0.25, rz1 + 0.25):
    W.box(P(X1 + 0.35, zz, ru['height'] / 2), (0.3, 0.5, ru['height']), YELLOW)
W.box(P(X1 + 0.35, ru['z'], ru['height'] + 0.3), (0.3, ru['width'] + 1.0, 0.6), YELLOW)
W.box(P(X1 + 0.1, ru['z'], ru['height'] + 0.9), (0.3, ru['width'] + 1.0, 0.7), FRAME)  # roll housing

# south facade: solid cladding except the lobby glass curtain wall
lx0, lx1 = lob['x0'], lob['x1']
W.box(P((lx1 + X1) / 2, Z1, HT / 2), (X1 - lx1, T, HT), CLAD)
W.box(P((X0 + lx0) / 2, Z1, HT / 2), (lx0 - X0, T, HT), CLAD)
W.box(P((lx0 + lx1) / 2, Z1, (9 + HT) / 2), (lx1 - lx0, T, HT - 9), CLAD)
# horizontal accent band + light top band
W.box(P((X0 + X1) / 2, Z1 + 0.28, 10.2), (X1 - X0 + 0.6, 0.08, 0.35), ACCENT)
W.box(P((X0 + X1) / 2, Z1 + 0.27, 13.3), (X1 - X0 + 0.6, 0.06, 1.4), CLAD2)
W.box(P(X1 + 0.27, (Z0 + Z1) / 2, 10.2), (0.08, Z1 - Z0 + 0.6, 0.35), ACCENT)
# vertical cladding ribs on facades
for x in range(int(X0) + 4, int(X1), 4):
    if lx0 - 1 < x < lx1 + 1:
        continue
    W.box(P(x, Z1 + 0.3, HT / 2), (0.12, 0.12, HT), CLAD2)
for z in range(int(Z0) + 4, int(Z1), 4):
    if rz0 - 1 < z < rz1 + 1:
        continue
    W.box(P(X1 + 0.3, z, HT / 2 + 0.0), (0.12, 0.12, HT), CLAD2)
# parapet
W.box(P((X0 + X1) / 2, Z1, HT + 0.5), (X1 - X0 + 0.5, T + 0.1, 1.0), CLAD2)
W.box(P((X0 + X1) / 2, Z0, HT + 0.5), (X1 - X0 + 0.5, T + 0.1, 1.0), CLAD2)
W.box(P(X0, (Z0 + Z1) / 2, HT + 0.5), (T + 0.1, Z1 - Z0, 1.0), CLAD2)
W.box(P(X1, (Z0 + Z1) / 2, HT + 0.5), (T + 0.1, Z1 - Z0, 1.0), CLAD2)
# entrance canopy
W.box(P(ent['x'], Z1 + 2.6, 4.6), (12, 5.2, 0.35), WHITE_STEEL)
W.box(P(ent['x'], Z1 + 5.2, 4.4), (12.2, 0.15, 0.25), ACCENT)
for xx in (ent['x'] - 5.5, ent['x'] + 5.5):
    W.cyl(P(xx, Z1 + 4.8, 2.3), 0.12, 4.6, WHITE_STEEL, segs=12)
W.obj('walls', parent=root)

# lobby glass curtain wall (with door opening)
G = Builder()
F = Builder()
ex0, ex1 = ent['x'] - ent['width'] / 2, ent['x'] + ent['width'] / 2
for a, b in ((lx0, ex0), (ex1, lx1)):
    G.box(P((a + b) / 2, Z1, 4.5), (b - a, 0.05, 9.0), GLASS)
G.box(P(ent['x'], Z1, (ent['height'] + 9) / 2), (ent['width'], 0.05, 9 - ent['height']), GLASS)
x = lx0
while x <= lx1 + 0.01:
    F.box(P(x, Z1, 4.5), (0.12, 0.25, 9.0), FRAME)
    x += 2.0
for y in (0.05, 3.0, 6.0, 8.95):
    F.box(P((lx0 + lx1) / 2, Z1, y), (lx1 - lx0, 0.25, 0.1), FRAME)
for xx in (ex0, ex1):
    F.box(P(xx, Z1, ent['height'] / 2), (0.18, 0.3, ent['height']), FRAME)
F.box(P(ent['x'], Z1, ent['height']), (ent['width'] + 0.3, 0.32, 0.2), FRAME)
# interior lobby partition (glass) toward the hall with a gate
pz = lob['z0']
for a, b in ((lx0 - 2, lob['gateX0']), (lob['gateX1'], lx1)):
    G.box(P((a + b) / 2, pz, 1.6), (b - a, 0.04, 3.2), GLASS)
    xx = a
    while xx <= b + 0.01:
        F.box(P(xx, pz, 1.6), (0.08, 0.12, 3.2), FRAME)
        xx += 2.0
    F.box(P((a + b) / 2, pz, 3.2), (b - a, 0.12, 0.08), FRAME)
# lobby east side partition
G.box(P(lx1, (pz + Z1) / 2, 1.6), (0.04, Z1 - pz, 3.2), GLASS)
for zz in range(int(pz), int(Z1) + 1, 2):
    F.box(P(lx1, zz, 1.6), (0.12, 0.08, 3.2), FRAME)
F.box(P(lx1, (pz + Z1) / 2, 3.2), (0.12, Z1 - pz, 0.08), FRAME)
G.obj('lobby_glass', parent=root)
F.obj('lobby_frames', parent=root)

# automatic sliding doors (separate, animated in three)
for side, sx in (('L', -1), ('R', 1)):
    d = Builder()
    d.box((0, 0, 0), (ent['width'] / 2, 0.06, ent['height'] - 0.1), GLASS)
    d.box((0, 0, ent['height'] / 2 - 0.1), (ent['width'] / 2, 0.1, 0.1), FRAME)
    d.box((0, 0, -ent['height'] / 2 + 0.05), (ent['width'] / 2, 0.1, 0.1), FRAME)
    d.box((-sx * (ent['width'] / 4 - 0.04), 0, 0), (0.08, 0.1, ent['height'] - 0.1), FRAME)
    d.obj('slide_door_' + side, loc=P(ent['x'] + sx * ent['width'] / 4, Z1 + 0.15, ent['height'] / 2), parent=root)

# roll-up door (slats), origin at top so it can scale up
rd = Builder()
n = 26
for i in range(n):
    rd.box((0, 0, -(i + 0.5) * ru['height'] / n), (0.12, ru['width'], ru['height'] / n * 0.92), DOORRED)
rd.box((0.0, 0, -ru['height'] + 0.08), (0.16, ru['width'], 0.16), YELLOW)
rd.obj('rollup_door', loc=P(X1, ru['z'], ru['height']), parent=root)

# ---------------------------------------------------------------- structure
S = Builder()
cols = list(range(int(X0) + 10, int(X1), 10))
for x in cols:
    for z in (-14.0, 10.0):
        S.box(P(x, z, HT / 2), (0.45, 0.45, HT), WHITE_STEEL)
        S.box(P(x, z, 0.4), (0.7, 0.7, 0.8), YELLOW)  # protective base
    # roof truss along z
    S.box(P(x, (Z0 + Z1) / 2, HT - 0.4), (0.3, Z1 - Z0, 0.6), WHITE_STEEL)
    S.box(P(x, (Z0 + Z1) / 2, HT - 2.0), (0.2, Z1 - Z0, 0.2), WHITE_STEEL)
    zz = Z0
    k = 0
    while zz < Z1 - 0.1:
        z2 = min(zz + 3.0, Z1)
        if k % 2 == 0:
            S.beam(P(x, zz, HT - 2.0), P(x, z2, HT - 0.4), 0.12, WHITE_STEEL)
        else:
            S.beam(P(x, zz, HT - 0.4), P(x, z2, HT - 2.0), 0.12, WHITE_STEEL)
        zz = z2
        k += 1
# purlins along x
for z in range(int(Z0) + 3, int(Z1), 6):
    S.box(P((X0 + X1) / 2, z, HT - 0.15), (X1 - X0, 0.15, 0.3), STEEL)
# crane rails (north storage zone) on brackets
for z in (-20.5, -9.0):
    S.box(P((X0 + X1) / 2, z, 9.0), (X1 - X0 - 1, 0.4, 0.5), YELLOW)
S.obj('structure', parent=root)

# roof with skylight openings between trusses
R = Builder()
sky_w = 4.0
R.box(P((X0 + X1) / 2, Z0 + 2, HT + 0.1), (X1 - X0, 4, 0.2), CLAD)
R.box(P((X0 + X1) / 2, Z1 - 2, HT + 0.1), (X1 - X0, 4, 0.2), CLAD)
xs = [X0] + cols + [X1]
SK = Builder()
for i in range(len(xs) - 1):
    a, b = xs[i], xs[i + 1]
    mid = (a + b) / 2
    # solid roof except a skylight band in the middle of each bay
    R.box(P((a + mid - sky_w / 2) / 2, (Z0 + Z1) / 2, HT + 0.1), (mid - sky_w / 2 - a, Z1 - Z0 - 8, 0.2), CLAD)
    R.box(P((mid + sky_w / 2 + b) / 2, (Z0 + Z1) / 2, HT + 0.1), (b - mid - sky_w / 2, Z1 - Z0 - 8, 0.2), CLAD)
    # raised skylight frame
    for zz in (Z0 + 4, Z1 - 4):
        R.box(P(mid, zz, HT + 0.6), (sky_w, 0.2, 1.0), FRAME)
    for xx in (mid - sky_w / 2, mid + sky_w / 2):
        R.box(P(xx, (Z0 + Z1) / 2, HT + 0.6), (0.2, Z1 - Z0 - 8, 1.0), FRAME)
    zz = Z0 + 4
    while zz < Z1 - 4:
        R.box(P(mid, zz, HT + 1.05), (sky_w, 0.08, 0.08), FRAME)
        zz += 2.5
    SK.box(P(mid, (Z0 + Z1) / 2, HT + 1.1), (sky_w - 0.2, Z1 - Z0 - 8.2, 0.03), SKY)
R.obj('roof', parent=root)
SK.obj('skylights', parent=root)

# hanging LED light rows
LP = Builder()
for x in range(int(X0) + 5, int(X1), 10):
    for z in (-17.0, -9.0, -1.0, 6.0, 15.0):
        LP.box(P(x, z, HT - 2.6), (6.0, 0.35, 0.08), FRAME)
        LP.box(P(x, z, HT - 2.66), (5.8, 0.25, 0.03), LAMP)
        for xx in (x - 2.5, x + 2.5):
            LP.box(P(xx, z, HT - 1.6), (0.02, 0.02, 2.0), FRAME)
LP.obj('lamps', parent=root)

# ---------------------------------------------------------------- floor (UV'd planes; textured in three)
def floor_plane(name, x0, z0, x1, z1, m, y=0.0, uv_scale=1.0):
    bm = bmesh.new()
    vs = [bm.verts.new(P(x, z, y)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
    f = bm.faces.new(vs)
    if f.normal.z < 0:
        f.normal_flip()
    uv = bm.loops.layers.uv.new('UVMap')
    for l in f.loops:
        co = l.vert.co
        l[uv].uv = (co.x / uv_scale, co.y / uv_scale)
    return mesh_obj_from_bm(name, bm, [m], parent=root, smooth=False)


FLOORM = mat('FactoryFloor', (0.55, 0.56, 0.57), rough=0.35)
LOBBYM = mat('LobbyFloor', (0.85, 0.85, 0.86), rough=0.15)
floor_plane('hall_floor', X0, Z0, X1, Z1, FLOORM, 0.0, 8.0)
floor_plane('lobby_floor', lx0, lob['z0'], lx1, Z1, LOBBYM, 0.01, 4.0)

# floor markings: walkway lines, station boxes, hatched zones
M = Builder()
wz0, wz1 = 1.4, 8.6
M.box(P((L['fenceX0'] + X1 - 4) / 2, wz0, 0.012), (X1 - 4 - L['fenceX0'], 0.15, 0.005), YELLOW)
M.box(P((L['fenceX0'] + X1 - 4) / 2, wz1, 0.012), (X1 - 4 - L['fenceX0'], 0.15, 0.005), YELLOW)
for x in range(int(L['fenceX0']) + 2, int(X1) - 4, 3):  # walkway chevrons
    M.box(P(x, (wz0 + wz1) / 2, 0.012), (1.2, 0.12, 0.005), WHITEP, rot=Matrix.Rotation(0.6, 4, 'Z'))
for s in L['slots'][1:7]:
    x = s['x']
    for dz in (-3.2, 3.2):
        M.box(P(x, L['lineZ'] + dz, 0.012), (6.4, 0.12, 0.005), WHITEP)
    for dx in (-3.2, 3.2):
        M.box(P(x + dx, L['lineZ'], 0.012), (0.12, 6.4, 0.005), WHITEP)
# forklift lane
for z in (-12.0, -18.0):
    M.box(P((X0 + X1) / 2, z, 0.012), (X1 - X0 - 4, 0.15, 0.005), YELLOW)
for x in range(int(X0) + 4, int(X1) - 2, 6):
    M.box(P(x, -15.0, 0.012), (2.0, 0.15, 0.005), WHITEP)
# delivery bay hatch
d = L['delivery']
for k in range(-3, 4):
    M.box(P(d['x'] + k * 0.9, d['z'], 0.012), (0.18, 5.0, 0.005), YELLOW, rot=Matrix.Rotation(0.5, 4, 'Z'))
M.box(P(d['x'], d['z'] - 2.6, 0.012), (6.2, 0.15, 0.005), YELLOW)
M.box(P(d['x'], d['z'] + 2.6, 0.012), (6.2, 0.15, 0.005), YELLOW)
M.obj('floor_markings', parent=root)

# ---------------------------------------------------------------- safety fence along the line
FN = Builder()
fz = L['fenceZ']
x = L['fenceX0']
while x < L['fenceX1'] - 0.01:
    x2 = min(x + 2.5, L['fenceX1'])
    FN.box(P(x, fz, 0.55), (0.08, 0.08, 1.1), YELLOW)
    FN.box(P((x + x2) / 2, fz, 1.08), (x2 - x, 0.06, 0.06), YELLOW)
    FN.box(P((x + x2) / 2, fz, 0.6), (x2 - x, 0.04, 0.04), YELLOW)
    FN.box(P((x + x2) / 2, fz, 0.12), (x2 - x, 0.03, 0.18), FRAME)
    x = x2
FN.box(P(x, fz, 0.55), (0.08, 0.08, 1.1), YELLOW)
FN.obj('fence', parent=root)

# ---------------------------------------------------------------- lobby furniture
LB = Builder()
# reception desk
LB.box(P(-53.5, 15.5, 0.55), (0.6, 4.0, 1.1), DESK)
LB.box(P(-53.2, 15.5, 1.12), (1.2, 4.2, 0.06), WOOD)
LB.box(P(-53.85, 15.5, 0.55), (0.04, 3.6, 0.2), ACCENT)
# back wall with logo panel
LB.box(P(-57.7, 15.0, 2.5), (0.2, 8.0, 5.0), CLAD)
# benches + plants
for x in (-39.0, -36.5):
    LB.box(P(x, 18.2, 0.42), (1.8, 0.6, 0.08), WOOD)
    LB.box(P(x, 18.2, 0.2), (1.6, 0.5, 0.36), FRAME)
for (x, z) in ((-57, 11), (-35.5, 11), (-57, 19), (-50, 19.2)):
    LB.cyl(P(x, z, 0.35), 0.35, 0.7, POT, segs=14)
    LB.sphere(P(x, z, 1.2), 0.55, PLANT, segs=10, rings=7, scale=(1, 1, 1.3))
# showcase plinth (display car sits here)
LB.cyl(P(-39.0, 13.6, 0.12), 3.2, 0.24, DESK, segs=48)
LB.cyl(P(-39.0, 13.6, 0.245), 3.0, 0.01, ACCENT, segs=48)
LB.obj('lobby_furniture', parent=root)
text_mesh('lobby_logo', 'GIGAWORKS', 0.9, 0.04, SIGN, loc=P(-57.55, 15.0, 3.2), rot=(math.pi / 2, 0, -math.pi / 2))

# configurator kiosk (screen surface added in three at the kiosk_screen anchor)
K = Builder()
k = L['kiosk']
K.box((0, 0, 0.05), (1.3, 0.8, 0.1), KIOSK)
K.box((0, 0.05, 0.6), (0.35, 0.25, 1.1), KIOSK)
K.box((0, -0.05, 1.45), (1.5, 0.12, 0.95), KIOSK, rot=Matrix.Rotation(-0.25, 4, 'X'))
K.box((0, 0.02, 0.92), (1.0, 0.45, 0.05), KIOSK, rot=Matrix.Rotation(0.3, 4, 'X'))
K.box((0, 0.08, 1.95), (1.5, 0.06, 0.06), ACCENT)
K.obj('kiosk', loc=P(k['x'], k['z'], 0), parent=root)
empty('kiosk_screen', loc=P(k['x'], k['z'] + 0.12, 1.45), parent=root)

# ---------------------------------------------------------------- GIGAWORKS sign
sign_x = -14.0
text_mesh('sign', 'GIGAWORKS', 4.2, 0.25, SIGN, loc=P(sign_x, Z1 + 0.55, 11.6), rot=(math.pi / 2, 0, 0))
SB = Builder()
SB.box(P(sign_x, Z1 + 0.35, 11.6), (34, 0.2, 4.0), FRAME)
SB.box(P(sign_x + 19.5, Z1 + 0.45, 11.6), (3.2, 0.2, 3.2), ACCENT)  # logo square
SB.obj('sign_backing', parent=root)
text_mesh('sign_logo', 'G', 2.6, 0.2, SIGN, loc=P(sign_x + 19.5, Z1 + 0.6, 11.6), rot=(math.pi / 2, 0, 0))
# east facade sign over the roll-up door
text_mesh('sign_east', 'TEST TRACK  >>', 1.4, 0.12, SIGN, loc=P(X1 + 0.5, ru['z'], ru['height'] + 2.4), rot=(math.pi / 2, 0, math.pi / 2))

# entrance pylon at the parking lot
PY = Builder()
PY.box(P(-30, 24.0, 4.0), (1.2, 0.8, 8.0), CLAD)
PY.box(P(-30, 24.0, 8.1), (1.3, 0.9, 0.2), ACCENT)
PY.obj('pylon', parent=root)
text_mesh('pylon_text', 'GIGAWORKS', 0.85, 0.05, SIGN, loc=P(-30, 23.55, 4.5), rot=(math.pi / 2, 0, 0))
text_mesh('pylon_text2', 'GIGAWORKS', 0.85, 0.05, SIGN, loc=P(-30, 24.45, 4.5), rot=(math.pi / 2, 0, math.pi))

export('factory.glb')
if '--preview' in sys.argv:
    out = os.path.join(ROOT, 'blender', 'preview')
    os.makedirs(out, exist_ok=True)
    preview(os.path.join(out, 'factory_out.png'), P(-40, 70, 18), P(-10, 15, 6), lens=28)
    bpy.data.objects['roof'].hide_render = True
    bpy.data.objects['skylights'].hide_render = True
    preview(os.path.join(out, 'factory_top.png'), P(0, 40, 90), P(0, -2, 0), lens=24)
