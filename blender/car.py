"""GIGAWORKS GT coupe, built from separate parts for piece-by-piece assembly.

The body shell is a lofted, subdivided solid with wheel-arch booleans which is
then cut along panel lines into: body_floor, fender_L/R, quarter_L/R, hood,
trunk, bumper_F/R, door_L/R, roof. The greenhouse is cut into glass_front,
glass_rear, glass_L/R. Plus seats, dashboard, powertrain, lights, 3 wheel
styles, extras (spoiler, roofrack, stripes), the line skid and steel sheets.
Car origin: ground level, centre of the car, +X forward, +Y left.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh, math
from mathutils import Vector, Matrix
from lib import *

reset()

PAINT = mat('Paint', (0.55, 0.57, 0.6), metal=0.5, rough=0.35)
GLASS = mat('Glass', (0.05, 0.07, 0.09), metal=0.0, rough=0.05, alpha=0.45)
BLACK = mat('TrimBlack', (0.02, 0.02, 0.025), rough=0.6)
CHROME = mat('Chrome', (0.9, 0.9, 0.92), metal=1.0, rough=0.12)
RUBBER = mat('Rubber', (0.025, 0.025, 0.028), rough=0.9)
RIM = mat('RimAlloy', (0.75, 0.76, 0.78), metal=1.0, rough=0.25)
RIMDARK = mat('RimDark', (0.08, 0.08, 0.09), metal=0.8, rough=0.3)
HEAD = mat('HeadLight', (0.9, 0.95, 1.0), emit=(0.85, 0.92, 1.0), strength=3.0)
TAIL = mat('TailLight', (0.6, 0.02, 0.02), emit=(1.0, 0.02, 0.01), strength=2.0)
LEATHER = mat('Leather', (0.06, 0.055, 0.05), rough=0.55)
STITCH = mat('SeatAccent', (0.55, 0.08, 0.05), rough=0.6)
DASH = mat('Dash', (0.04, 0.04, 0.045), rough=0.7)
SCREEN = mat('DashScreen', (0.1, 0.4, 0.8), emit=(0.2, 0.6, 1.0), strength=1.5)
ENGINE = mat('EngineAlu', (0.45, 0.46, 0.48), metal=0.9, rough=0.4)
ENGRED = mat('EngineRed', (0.7, 0.05, 0.03), metal=0.3, rough=0.35)
STEEL = mat('Steel', (0.5, 0.52, 0.55), metal=0.9, rough=0.35)
STRIPE = mat('Stripe', (0.95, 0.95, 0.95), metal=0.2, rough=0.3)
SKID = mat('SkidYellow', (0.85, 0.6, 0.05), metal=0.3, rough=0.5)
SKIDDARK = mat('SkidDark', (0.12, 0.12, 0.13), metal=0.6, rough=0.5)

# ------------------------------------------------------------------ body shell
WHEEL_X = (1.38, -1.33)
WHEEL_R = 0.34
TRACK_Y = 0.80


def ring_lower(w, z0, zE, zt, dip):
    right = [(w - 0.12, z0), (w - 0.03, z0 + 0.07), (w, z0 + 0.22), (w - 0.012, zE - 0.12),
             (w - 0.07, zE), (w - 0.14, zE - 0.005), (w - 0.16, zE - 0.02 - dip),
             (0.45 * w, zt - 0.03 - dip)]
    return [(0, z0)] + right + [(0, zt - dip)] + [(-y, z) for (y, z) in reversed(right)]


# (x, half width, bottom, edge top, centre top, cabin dip)
LOWER = [
    (-2.24, 0.78, 0.40, 0.76, 0.80, 0.0),
    (-2.12, 0.87, 0.31, 0.86, 0.91, 0.0),
    (-1.70, 0.91, 0.27, 0.92, 0.97, 0.0),
    (-1.18, 0.92, 0.26, 0.93, 0.98, 0.0),
    (-0.95, 0.92, 0.26, 0.93, 0.98, 0.38),
    (0.00, 0.92, 0.26, 0.92, 0.96, 0.40),
    (0.72, 0.92, 0.26, 0.90, 0.93, 0.36),
    (0.98, 0.92, 0.26, 0.88, 0.92, 0.0),
    (1.50, 0.91, 0.27, 0.80, 0.84, 0.0),
    (2.00, 0.88, 0.30, 0.70, 0.73, 0.0),
    (2.26, 0.76, 0.38, 0.58, 0.60, 0.0),
]


def loft(sections):
    bm = bmesh.new()
    rings = []
    for x, ring in sections:
        rings.append([bm.verts.new((x, y, z)) for (y, z) in ring])
    n = len(rings[0])
    for i in range(len(rings) - 1):
        for j in range(n):
            a, b = rings[i][j], rings[i][(j + 1) % n]
            c, d = rings[i + 1][(j + 1) % n], rings[i + 1][j]
            bm.faces.new((a, b, c, d))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def shell_object(name, bm, levels=2):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    sub = o.modifiers.new('sub', 'SUBSURF')
    sub.levels = levels
    sub.render_levels = levels
    return o


lower = shell_object('_lower', loft([(x, ring_lower(w, z0, zE, zt, dip)) for x, w, z0, zE, zt, dip in LOWER]))
apply_modifiers(lower)

# wheel arches
for wx in WHEEL_X:
    c = Builder()
    c.cyl((wx, 0, WHEEL_R + 0.02), 0.43, 3.0, PAINT, axis='Y', segs=40)
    cutter = c.obj('_cut%.0f' % (wx * 10))
    b = lower.modifiers.new('arch', 'BOOLEAN')
    b.operation = 'DIFFERENCE'
    b.solver = 'EXACT'
    b.object = cutter
    apply_modifiers(lower)
    bpy.data.objects.remove(cutter)

# greenhouse (cabin glass + roof)
def ring_green(wb, zb, wt, zr):
    return [(wb, zb), (wb - 0.06, zb + 0.18), (wt, zr - 0.04), (wt - 0.12, zr), (-(wt - 0.12), zr),
            (-wt, zr - 0.04), (-(wb - 0.06), zb + 0.18), (-wb, zb)]


GREEN = [
    (-1.16, 0.84, 0.90, 0.82, 0.93),
    (-0.95, 0.84, 0.90, 0.74, 1.13),
    (-0.55, 0.84, 0.89, 0.67, 1.33),
    (0.25, 0.84, 0.88, 0.66, 1.36),
    (0.55, 0.84, 0.87, 0.70, 1.24),
    (1.00, 0.84, 0.86, 0.82, 0.89),
]
green = shell_object('_green', loft([(x, ring_green(wb, zb, wt, zr)) for x, wb, zb, wt, zr in GREEN]))
apply_modifiers(green)

LB = bm_of(lower)
GB = bm_of(green)
bpy.data.objects.remove(lower)
bpy.data.objects.remove(green)

X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))

parts = {}

# ---- lower body cuts
front, rest = split(LB, (1.05, 0, 0), X)
mid, rear = split(rest, (-1.12, 0, 0), X)

bumper_F, front_mid = split(front, (1.95, 0, 0), X)
f_top, f_low = split(front_mid, (0, 0, 0.66), Z)
f_topL, f_topR = split(f_top, (0, 0, 0), Y)
fenderTopL, hoodL = split(f_topL, (0, 0.70, 0), Y)
hoodR, fenderTopR = split(f_topR, (0, -0.70, 0), Y)
f_lowL, f_lowR = split(f_low, (0, 0, 0), Y)
parts['hood'] = join(hoodL, hoodR)
parts['fender_L'] = join(fenderTopL, f_lowL)
parts['fender_R'] = join(fenderTopR, f_lowR)
parts['bumper_F'] = bumper_F

rear_mid, bumper_R = split(rear, (-2.00, 0, 0), X)
r_top, r_low = split(rear_mid, (0, 0, 0.72), Z)
r_topL, r_topR = split(r_top, (0, 0, 0), Y)
qTopL, trunkL = split(r_topL, (0, 0.70, 0), Y)
trunkR, qTopR = split(r_topR, (0, -0.70, 0), Y)
r_lowL, r_lowR = split(r_low, (0, 0, 0), Y)
parts['trunk'] = join(trunkL, trunkR)
parts['quarter_L'] = join(qTopL, r_lowL)
parts['quarter_R'] = join(qTopR, r_lowR)
parts['bumper_R'] = bumper_R

# doors: |y| > 0.66, z > 0.36, -0.95 < x < 0.95
floor_pieces = []
outL, inner = split(mid, (0, 0.66, 0), Y)
inner2, outR = split(inner, (0, -0.66, 0), Y)
floor_pieces.append(inner2)
for side, piece in (('L', outL), ('R', outR)):
    up, low = split(piece, (0, 0, 0.36), Z)
    floor_pieces.append(low)
    a, bk = split(up, (0.95, 0, 0), X)
    floor_pieces.append(a)
    door, b2 = split(bk, (-0.95, 0, 0), X)
    floor_pieces.append(b2)
    parts['door_' + side] = door
parts['body_floor'] = join(*floor_pieces)

# ---- greenhouse cuts
roof, glass = split(GB, (0, 0, 1.22), Z)
parts['roof'] = roof
g_front, g_rest = split(glass, (0.42, 0, 0), X)
g_mid, g_rear = split(g_rest, (-0.66, 0, 0), X)
gL, gR = split(g_mid, (0, 0, 0), Y)
parts['glass_front'] = g_front
parts['glass_rear'] = g_rear
parts['glass_L'] = gL
parts['glass_R'] = gR

# racing stripes: shell offset of the top surfaces, two bands around the centre line
def stripe_from(bm_src):
    a, _ = split(bm_src.copy(), (0, -0.30, 0), Y)
    b, _ = split(a, (0, 0.30, 0), -Y)
    keep = [f for f in b.faces if f.normal.z > 0.45]
    drop = [f for f in b.faces if f not in keep]
    bmesh.ops.delete(b, geom=drop, context='FACES')
    loose = [v for v in b.verts if not v.link_faces]
    bmesh.ops.delete(b, geom=loose, context='VERTS')
    for v in b.verts:
        v.co += v.normal * 0.006
    # carve centre gap
    l, rr = split(b, (0, 0.07, 0), Y)
    r2, _ = split(rr, (0, -0.07, 0), -Y)
    return join(l, r2)


stripe_src = join(parts['hood'], parts['roof'], parts['trunk'], parts['bumper_F'], parts['bumper_R'])

DOOR_PIVOT = {'L': (0.95, 0.88, 0.62), 'R': (0.95, -0.88, 0.62)}

root = empty('car')
for name, bm in parts.items():
    m = GLASS if name.startswith('glass') else PAINT
    origin = None
    if name.startswith('door'):
        origin = DOOR_PIVOT[name[-1]]
    o = mesh_obj_from_bm(name, bm, [m], origin=origin, parent=root, smooth=True)

stripes = mesh_obj_from_bm('stripes', stripe_from(stripe_src), [STRIPE], parent=root)

# door glass sits in the doors: the side glass parts are separate; add black trim to doors
for side, sy in (('L', 1), ('R', -1)):
    t = Builder()
    t.box((0.0, sy * 0.86, 0.90), (1.75, 0.03, 0.035), CHROME)
    t.box((0.55, sy * 0.885, 0.70), (0.16, 0.03, 0.035), CHROME)  # handle
    t.obj('trim_' + side, parent=root)

# ------------------------------------------------------------------ lights
for side, sy in (('L', 1), ('R', -1)):
    h = Builder()
    h.box((0, 0, 0), (0.24, 0.38, 0.07), HEAD, rot=Matrix.Rotation(sy * -0.30, 4, 'Z') @ Matrix.Rotation(0.30, 4, 'Y'))
    h.obj('headlight_' + side, loc=(1.96, sy * 0.57, 0.685), parent=root)
    tl = Builder()
    tl.box((0, 0, 0), (0.12, 0.48, 0.08), TAIL, rot=Matrix.Rotation(sy * 0.2, 4, 'Z'))
    tl.obj('taillight_' + side, loc=(-2.17, sy * 0.47, 0.74), parent=root)

# grille + plates go with the bumper look
g = Builder()
g.box((2.22, 0, 0.47), (0.06, 0.95, 0.14), BLACK)
g.box((-2.19, 0, 0.55), (0.04, 0.5, 0.11), BLACK)
for k in range(-4, 5):
    g.box((2.25, k * 0.1, 0.47), (0.02, 0.012, 0.12), CHROME)
g.obj('grille', parent=root)

# mirrors (attach with doors)
for side, sy in (('L', 1), ('R', -1)):
    mm = Builder()
    mm.box((0, sy * 0.09, 0.0), (0.18, 0.16, 0.11), PAINT, smooth=False)
    mm.box((-0.09, sy * 0.09, 0.0), (0.01, 0.13, 0.08), CHROME)
    mm.box((0.02, 0, -0.04), (0.05, 0.08, 0.03), BLACK)
    mm.obj('mirror_' + side, loc=(0.78, sy * 0.86, 0.96), parent=root)

# ------------------------------------------------------------------ interior
for side, sy in (('L', 1), ('R', -1)):
    s = Builder()
    s.box((0, 0, 0.08), (0.52, 0.48, 0.14), LEATHER, smooth=False)
    s.box((0.0, 0, 0.165), (0.40, 0.30, 0.03), STITCH)
    back = Matrix.Rotation(-0.22, 4, 'Y')
    s.box((-0.27, 0, 0.36), (0.12, 0.46, 0.50), LEATHER, rot=back)
    s.box((-0.245, 0, 0.36), (0.10, 0.20, 0.40), STITCH, rot=back)
    s.box((-0.35, 0, 0.68), (0.10, 0.28, 0.15), LEATHER, rot=back)
    s.obj('seat_' + side, loc=(-0.25, sy * 0.40, 0.46), parent=root)

d = Builder()
d.box((0.80, 0, 0.80), (0.42, 1.62, 0.20), DASH)
d.box((0.62, 0, 0.66), (0.10, 1.4, 0.18), DASH)
d.box((0.66, 0, 0.84), (0.02, 0.36, 0.14), SCREEN, rot=Matrix.Rotation(-0.4, 4, 'Y'))
d.box((-0.25, 0, 0.60), (1.1, 0.16, 0.16), DASH)  # centre tunnel
sw = Matrix.Translation((0.52, 0.40, 0.86)) @ Matrix.Rotation(-1.1, 4, 'Y')
ring = bmesh.ops.create_cone(d.bm, cap_ends=False, segments=20, radius1=0.17, radius2=0.17, depth=0.03, matrix=sw)
d._tag(ring['verts'], LEATHER, True)
d.box((0.58, 0.40, 0.84), (0.18, 0.05, 0.05), DASH, rot=Matrix.Rotation(-0.6, 4, 'Y'))
d.obj('dashboard', parent=root)

# ------------------------------------------------------------------ powertrain
p = Builder()
p.box((1.42, 0, 0.47), (0.6, 0.6, 0.36), ENGINE)                         # block
for sy in (0.17, -0.17):
    p.box((1.42, sy, 0.68), (0.56, 0.20, 0.08), ENGRED)                     # valve covers
p.box((1.42, 0, 0.71), (0.40, 0.14, 0.08), ENGINE)                          # intake plenum
p.cyl((1.78, 0, 0.48), 0.09, 0.05, ENGINE, axis='X')                        # pulley
p.box((1.84, 0, 0.52), (0.07, 0.56, 0.28), BLACK)                           # radiator
p.box((0.88, 0, 0.45), (0.55, 0.32, 0.30), ENGINE, smooth=False)            # gearbox
p.cyl((-0.25, 0, 0.36), 0.05, 2.0, STEEL, axis='X')                         # driveshaft
p.box((-1.33, 0, 0.36), (0.32, 0.36, 0.28), ENGINE)                         # diff
for wx in WHEEL_X:
    p.cyl((wx, 0, WHEEL_R), 0.045, 1.42, STEEL, axis='Y')                   # axles
    for sy in (0.62, -0.62):
        p.cyl((wx, sy, WHEEL_R + 0.25), 0.05, 0.35, ENGRED, axis='Z')       # dampers
        p.cyl((wx, sy, WHEEL_R + 0.13), 0.075, 0.18, STEEL, axis='Z', segs=10)
        p.box((wx, sy * 0.85, WHEEL_R - 0.05), (0.42, 0.36, 0.05), STEEL)   # control arms
for sy in (0.28, -0.28):
    p.cyl((-0.5, sy, 0.30), 0.045, 3.4, STEEL, axis='X', segs=10)           # exhaust
    p.cyl((-2.12, sy, 0.30), 0.07, 0.25, CHROME, axis='X', segs=14)
p.box((-1.75, 0, 0.30), (0.55, 0.75, 0.2), STEEL)                           # muffler
p.obj('powertrain', parent=root)

# ------------------------------------------------------------------ wheels (origin = hub)
def tire(b):
    prof = []
    R, r_in, w = WHEEL_R, 0.235, 0.125
    for k in range(9):
        a = -math.pi / 2 + math.pi * k / 8
        prof.append((R - 0.045 + 0.045 * math.cos(a), w * math.sin(a)))
    prof += [(r_in + 0.01, w * 0.95), (r_in, 0.0), (r_in + 0.01, -w * 0.95)]
    prof = list(reversed(prof))
    b.revolve(prof, RUBBER, segs=40)


def wheel_A():  # SPORT: 5 bold spokes
    b = Builder()
    tire(b)
    b.cyl((0, 0.07, 0), 0.24, 0.05, RIM, axis='Y', segs=40, smooth=False)
    b.cyl((0, 0.075, 0), 0.215, 0.06, RIMDARK, axis='Y', segs=40)
    for k in range(5):
        a = 2 * math.pi * k / 5
        rot = Matrix.Rotation(-a, 4, 'Y')
        b.box((0.11 * math.cos(a), 0.10, 0.11 * math.sin(a)), (0.2, 0.035, 0.06), RIM, rot=rot)
    b.cyl((0, 0.11, 0), 0.06, 0.04, RIM, axis='Y', segs=16)
    b.cyl((0, 0.13, 0), 0.025, 0.02, CHROME, axis='Y', segs=12)
    return b


def wheel_B():  # TURBINE: 12 thin twisted spokes
    b = Builder()
    tire(b)
    b.cyl((0, 0.07, 0), 0.24, 0.05, RIMDARK, axis='Y', segs=40, smooth=False)
    for k in range(12):
        a = 2 * math.pi * k / 12
        rot = Matrix.Rotation(-a, 4, 'Y') @ Matrix.Rotation(0.5, 4, 'X')
        b.box((0.125 * math.cos(a), 0.10, 0.125 * math.sin(a)), (0.2, 0.012, 0.035), CHROME, rot=rot)
    b.cyl((0, 0.105, 0), 0.05, 0.05, CHROME, axis='Y', segs=16)
    return b


def wheel_C():  # AERO: closed dish with vents
    b = Builder()
    tire(b)
    b.cyl((0, 0.08, 0), 0.235, 0.06, RIM, axis='Y', segs=40)
    b.cyl((0, 0.10, 0), 0.20, 0.03, mat('AeroWhite', (0.85, 0.86, 0.88), metal=0.4, rough=0.3), axis='Y', segs=40)
    for k in range(6):
        a = 2 * math.pi * k / 6
        b.cyl((0.14 * math.cos(a), 0.112, 0.14 * math.sin(a)), 0.035, 0.01, BLACK, axis='Y', segs=10)
    b.cyl((0, 0.12, 0), 0.04, 0.02, BLACK, axis='Y', segs=12)
    return b


for nm, fn in (('wheel_sport', wheel_A), ('wheel_turbine', wheel_B), ('wheel_aero', wheel_C)):
    fn().obj(nm, loc=(0, 0, 0), parent=root)

# brake discs + calipers (go on with wheels)
bd = Builder()
bd.cyl((0, 0.0, 0), 0.19, 0.025, STEEL, axis='Y', segs=28)
bd.box((0.0, -0.01, 0.17), (0.14, 0.06, 0.08), ENGRED)
bd.obj('brake', parent=root)

# ------------------------------------------------------------------ extras
s = Builder()
for sy in (0.45, -0.45):
    s.box((-1.95, sy, 1.08), (0.10, 0.04, 0.24), BLACK, rot=Matrix.Rotation(0.25, 4, 'Y'))
wing = [(0.0, 0.0), (0.18, 0.045), (0.36, 0.03), (0.40, 0.0), (0.2, -0.015)]
s.poly_extrude([(-2.18 + x, 1.20 + z) for x, z in wing], -0.80, 0.80, PAINT)
for sy in (0.80, -0.80):
    s.box((-1.98, sy, 1.17), (0.48, 0.02, 0.16), BLACK)
s.obj('spoiler', parent=root)

r = Builder()
for sy in (0.55, -0.55):
    r.box((-0.15, sy, 1.43), (1.35, 0.05, 0.04), BLACK)
    for x in (-0.75, 0.45):
        r.box((x, sy, 1.39), (0.08, 0.06, 0.08), BLACK)
for x in (-0.55, -0.05, 0.40):
    r.box((x, 0, 1.46), (0.06, 1.25, 0.035), CHROME)
r.obj('roofrack', parent=root)

# ------------------------------------------------------------------ factory pieces: skid + sheet
k = Builder()
for sy in (0.55, -0.55):
    k.box((0, sy, 0.13), (4.4, 0.12, 0.14), SKID)
for x in (-1.9, -0.7, 0.7, 1.9):
    k.box((x, 0, 0.13), (0.14, 1.25, 0.12), SKID)
for x in (-1.0, 1.0):
    for sy in (0.55, -0.55):
        k.box((x, sy, 0.27), (0.12, 0.12, 0.16), SKIDDARK)
k.box((0, 0, 0.05), (4.0, 0.3, 0.06), SKIDDARK)
k.obj('skid', parent=None)

sh = Builder()
sh.box((0, 0, 0.004), (1.7, 1.1, 0.008), STEEL)
sh.obj('sheet', parent=None)

# ------------------------------------------------------------------ export + preview
export('car.glb')

if '--preview' in sys.argv:
    # place wheels for a preview render
    w = bpy.data.objects['wheel_sport']
    for i, (wx, sy) in enumerate([(WHEEL_X[0], 1), (WHEEL_X[0], -1), (WHEEL_X[1], 1), (WHEEL_X[1], -1)]):
        c = w.copy()
        bpy.context.scene.collection.objects.link(c)
        c.parent = None
        c.location = (wx, sy * TRACK_Y, WHEEL_R)
        if sy < 0:
            c.rotation_euler = (0, 0, math.pi)
    for nm in ('wheel_sport', 'wheel_turbine', 'wheel_aero', 'skid', 'sheet', 'roofrack', 'stripes'):
        bpy.data.objects[nm].hide_render = True
    out = os.path.join(ROOT, 'blender', 'preview')
    os.makedirs(out, exist_ok=True)
    preview(os.path.join(out, 'car_front.png'), (6.0, -5.0, 2.6), (0, 0, 0.6))
    preview(os.path.join(out, 'car_rear.png'), (-6.0, 4.0, 3.0), (0, 0, 0.6))
    bpy.data.objects['brake'].hide_render = True
    preview(os.path.join(out, 'car_nose.png'), (4.6, -1.6, 1.2), (1.6, 0, 0.55), lens=45)
    preview(os.path.join(out, 'car_tail.png'), (-4.6, 1.6, 1.3), (-1.6, 0, 0.6), lens=45)
    preview(os.path.join(out, 'car_side.png'), (0.5, 7.5, 1.4), (0, 0, 0.7), lens=40)
    for nm in ('hood','roof','glass_front','glass_L','door_L','fender_L'):
        bpy.data.objects[nm].hide_render = True
    preview(os.path.join(out, 'car_inside.png'), (3.5, 3.0, 3.0), (0, 0, 0.6), lens=35)
