"""Outdoor world: ground, roads, parking lot, test track (road ribbon with curbs),
start/finish gantry, grandstand, tyre walls, trees, light poles, cones.
Track centreline comes from src/data/track.json (three coords)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh, math, random
from mathutils import Vector, Matrix
from lib import *

reset()
random.seed(42)
L = load_json('src/data/layout.json')
TR = load_json('src/data/track.json')
pts = [Vector((x, -z, 0)) for x, z in TR['points']]
N = len(pts)
HW = TR['width'] / 2


def P(x, z, y=0.0):
    return (x, -z, y)


ASPH = mat('Asphalt', (0.18, 0.18, 0.19), rough=0.85)
GRASS = mat('Grass', (0.22, 0.38, 0.14), rough=0.95)
CURB_R = mat('CurbRed', (0.8, 0.08, 0.06), rough=0.6)
CURB_W = mat('CurbWhite', (0.92, 0.92, 0.92), rough=0.6)
LINEW = mat('LineWhite', (0.95, 0.95, 0.95), rough=0.6)
CONC = mat('Concrete', (0.6, 0.6, 0.58), rough=0.85)
STEEL = mat('PoleSteel', (0.5, 0.52, 0.55), metal=0.8, rough=0.4)
DARK = mat('GantryDark', (0.08, 0.08, 0.09), metal=0.6, rough=0.4)
BLUE = mat('BrandBlue', (0.0, 0.45, 0.9), metal=0.3, rough=0.35, emit=(0, 0.35, 0.9), strength=0.8)
TIRE = mat('TyreWall', (0.04, 0.04, 0.04), rough=0.9)
TRUNK = mat('Trunk', (0.3, 0.2, 0.12), rough=0.9)
LEAF = mat('Leaves', (0.16, 0.36, 0.12), rough=0.85)
LEAF2 = mat('Leaves2', (0.24, 0.42, 0.1), rough=0.85)
SEAT = mat('StandSeat', (0.85, 0.85, 0.87), rough=0.5)
SEATB = mat('StandSeatBlue', (0.05, 0.3, 0.7), rough=0.5)
GLOW = mat('LampGlow', (1, 1, 1), emit=(1, 0.95, 0.85), strength=4)
SIGNW = mat('TrackSign', (1, 1, 1), emit=(0.9, 0.95, 1), strength=3)

root = empty('outdoor')


def uv_plane(name, x0, z0, x1, z1, m, y=0.0, s=10.0):
    bm = bmesh.new()
    vs = [bm.verts.new(P(x, z, y)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
    f = bm.faces.new(vs)
    if f.normal.z < 0:
        f.normal_flip()
    uv = bm.loops.layers.uv.new('UVMap')
    for l in f.loops:
        l[uv].uv = (l.vert.co.x / s, l.vert.co.y / s)
    return mesh_obj_from_bm(name, bm, [m], parent=root, smooth=False)


uv_plane('ground', -400, -400, 500, 400, GRASS, -0.02, 6.0)
pk = L['parking']
uv_plane('parking', pk['x0'], pk['z0'], pk['x1'], pk['z1'], ASPH, 0.005, 6.0)
# apron in front of the facade + road to the east door + access road
uv_plane('apron', -62, 20, 62, 25.5, CONC, 0.006, 4.0)
uv_plane('door_road', 60, -10, 112, 2, ASPH, 0.007, 6.0)
uv_plane('east_apron', 60, -22, 70, 25.5, CONC, 0.006, 4.0)
uv_plane('access_road', -8, 25, 70, 33, ASPH, 0.005, 6.0)

# parking bay lines
PL = Builder()
for row_z in (31.0, 47.0):
    for k in range(13):
        x = pk['x0'] + 3 + k * 3.6
        PL.box(P(x, row_z, 0.012), (0.12, 5.2, 0.005), LINEW)
    PL.box(P((pk['x0'] + pk['x1']) / 2 - 4, row_z - 2.6 if row_z > 40 else row_z + 2.6, 0.012), (46, 0.12, 0.005), LINEW)
# walkway zebra from parking to the entrance
for k in range(8):
    PL.box(P(L['entrance']['x'] - 2.8 + k * 0.8, 23.5, 0.012), (0.45, 3.5, 0.005), LINEW)
for k in range(10):
    PL.box(P(70 + k * 4, -4, 0.014), (2.0, 0.18, 0.005), LINEW)
PL.obj('ground_lines', parent=root)

# ---------------------------------------------------------------- track ribbon
def ribbon(name, offs_in, offs_out, y, m, uvs=True, closed=True, mats_alt=None, seg_len=1):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rows = []
    dist = 0.0
    for i in range(N):
        p = pts[i]
        a, b = pts[i - 1], pts[(i + 1) % N]
        t = (b - a).normalized()
        n = Vector((-t.y, t.x, 0))
        rows.append((bm.verts.new(p + n * offs_in + Vector((0, 0, y))),
                     bm.verts.new(p + n * offs_out + Vector((0, 0, y)))))
    total = 0.0
    vcoord = [0.0]
    for i in range(1, N + 1):
        total += (pts[i % N] - pts[i - 1]).length
        vcoord.append(total)
    mats = [m] if not mats_alt else [m, mats_alt]
    for i in range(N):
        j = (i + 1) % N
        f = bm.faces.new((rows[i][0], rows[i][1], rows[j][1], rows[j][0]))
        if f.normal.z < 0:
            f.normal_flip()
        if mats_alt:
            f.material_index = (i // seg_len) % 2
        for l in f.loops:
            k = i if l.vert in rows[i] else (i + 1)
            side = 0 if (l.vert is rows[i][0] or l.vert is rows[j][0]) else 1
            l[uv].uv = (side * (offs_out - offs_in) / 13.0, vcoord[k] / 13.0)
    return mesh_obj_from_bm(name, bm, mats, parent=root, smooth=False)


ribbon('track', -HW, HW, 0.01, ASPH)
ribbon('curb_L', HW, HW + 1.0, 0.03, CURB_R, mats_alt=CURB_W, seg_len=1)
ribbon('curb_R', -HW - 1.0, -HW, 0.03, CURB_R, mats_alt=CURB_W, seg_len=1)
ribbon('runoff_L', HW + 1.0, HW + 4.0, 0.008, mat('Gravel', (0.55, 0.5, 0.42), rough=1.0))
ribbon('edge_line_L', HW - 0.5, HW - 0.3, 0.015, LINEW)
ribbon('edge_line_R', -HW + 0.3, -HW + 0.5, 0.015, LINEW)

# start / finish line (chequered) at point 0
SF = Builder()
p0, p1 = pts[0], pts[1]
t = (p1 - p0).normalized()
n = Vector((-t.y, t.x, 0))
ang = math.atan2(t.y, t.x)
rot = Matrix.Rotation(ang, 4, 'Z')
for i in range(-6, 7):
    for j in range(2):
        c = CURB_W if (i + j) % 2 == 0 else DARK
        q = p0 + n * (i + 0.5) + t * (j - 1) * 1.0
        SF.box((q.x, q.y, 0.02), (1.0, 1.0, 0.01), c, rot=rot)
# gantry
for s in (-1, 1):
    q = p0 + n * s * (HW + 2.2)
    SF.box((q.x, q.y, 3.4), (0.5, 0.5, 6.8), DARK, rot=rot)
q = p0
SF.box((q.x, q.y, 6.6), (0.8, 2 * HW + 5, 1.4), DARK, rot=rot)
SF.box((q.x - t.x * 0.42, q.y - t.y * 0.42, 6.6), (0.04, 2 * HW + 4.6, 0.25), BLUE, rot=rot)
SF.obj('start_gantry', parent=root)
gt = text_mesh('gantry_text', 'GIGAWORKS  TEST TRACK', 0.8, 0.05, SIGNW)
gt.location = (p0.x - t.x * 0.45, p0.y - t.y * 0.45, 6.7)
gt.rotation_euler = (math.pi / 2, 0, ang - math.pi / 2)
gt.parent = root

# ---------------------------------------------------------------- tyre walls on the outside of corners, grandstand
TW = Builder()
for i in range(0, N, 3):
    p = pts[i]
    a, b = pts[i - 1], pts[(i + 1) % N]
    t = (b - a).normalized()
    c = pts[(i + 6) % N] - 2 * p + pts[i - 6]
    curv = t.x * c.y - t.y * c.x
    if abs(curv) < 0.35:
        continue
    n = Vector((-t.y, t.x, 0))
    side = -1 if curv > 0 else 1
    q = p + n * side * (HW + 5.5)
    for k in range(2):
        TW.cyl((q.x, q.y, 0.15 + k * 0.3), 0.45, 0.3, TIRE, segs=10)
TW.obj('tyre_walls', parent=root)

GS = Builder()
gs_p = pts[0] + Vector((0, 1, 0)) * 0  # main straight, north side of the start
cx, cz = pts[0].x - 8, TR['points'][0][1] - (HW + 9)
for r in range(6):
    GS.box(P(cx, cz - r * 1.0, 0.25 + r * 0.5), (30, 1.0, 0.5 + r * 1.0), CONC)
    for k in range(28):
        GS.box(P(cx - 13.5 + k, cz - r * 1.0 + 0.1, 0.62 + r * 0.5 + r * 0.5), (0.7, 0.5, 0.25), SEATB if (k // 4 + r) % 2 else SEAT)
GS.box(P(cx, cz - 6.5, 3.5), (30.5, 0.4, 7), CONC)
for k in range(-3, 4):
    GS.box(P(cx + k * 5, cz - 6.0, 6.0), (0.25, 0.25, 4.5), STEEL)
GS.box(P(cx, cz - 3, 8.3), (31, 8, 0.25), mat('RoofWhite', (0.9, 0.9, 0.92), metal=0.3, rough=0.4))
GS.obj('grandstand', parent=root)

# ---------------------------------------------------------------- trees (instanced in three)
tr = Builder()
tr.cyl((0, 0, 1.2), 0.18, 2.4, TRUNK, segs=8)
tr.cyl((0, 0, 3.6), 1.7, 3.4, LEAF, segs=9, r2=0.2)
tr.cyl((0, 0, 5.1), 1.2, 2.6, LEAF2, segs=9, r2=0.1)
tr.obj('tree_pine', parent=None)
tb = Builder()
tb.cyl((0, 0, 1.0), 0.2, 2.0, TRUNK, segs=8)
tb.sphere((0, 0, 3.0), 1.7, LEAF2, segs=10, rings=7, scale=(1, 1, 0.9))
tb.sphere((0.6, 0.4, 3.6), 1.0, LEAF, segs=9, rings=6)
tb.obj('tree_round', parent=None)

# light pole
lp = Builder()
lp.cyl((0, 0, 4.5), 0.1, 9.0, STEEL, segs=10)
lp.box((0.6, 0, 9.0), (1.4, 0.15, 0.12), STEEL)
lp.box((1.15, 0, 8.92), (0.6, 0.3, 0.08), GLOW)
lp.obj('light_pole', parent=None)

cone = Builder()
cone.box((0, 0, 0.02), (0.4, 0.4, 0.04), mat('ConeBase', (0.1, 0.1, 0.1)))
cone.cyl((0, 0, 0.36), 0.15, 0.66, mat('ConeOrange', (1.0, 0.35, 0.02), rough=0.5), segs=12, r2=0.03)
cone.cyl((0, 0, 0.42), 0.105, 0.12, LINEW, segs=12, r2=0.09)
cone.obj('cone', parent=None)

# sky-high track sign boards
bd = Builder()
bd.box((0, 0, 2.0), (6, 0.2, 2.0), BLUE)
for sx in (-2.5, 2.5):
    bd.box((sx, 0.2, 1.0), (0.15, 0.15, 2.0), STEEL)
bd.obj('board', parent=None)

export('outdoor.glb')
if '--preview' in sys.argv:
    preview(os.path.join(ROOT, 'blender', 'preview', 'outdoor.png'), P(100, 160, 220), P(140, 20, 0), lens=24)
