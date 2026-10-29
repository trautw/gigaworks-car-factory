"""Factory machinery: stamping press, articulated robot arm + tools, conveyor,
paint booth, engine-marriage lift + AGV, QC scan gate, forklift, overhead
crane, info stand, hanging screen, warning beacon, racks, crates, carts.
Every movable piece is its own object with its pivot at the joint."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh, math
from mathutils import Vector, Matrix
from lib import *

reset()

ORANGE = mat('RobotOrange', (0.95, 0.38, 0.03), metal=0.3, rough=0.35)
GREY = mat('MachineGrey', (0.30, 0.32, 0.35), metal=0.7, rough=0.4)
DARK = mat('MachineDark', (0.06, 0.06, 0.07), metal=0.5, rough=0.5)
STEEL = mat('MachineSteel', (0.62, 0.64, 0.66), metal=0.95, rough=0.25)
BLUE = mat('MachineBlue', (0.05, 0.25, 0.6), metal=0.4, rough=0.4)
WHITE = mat('MachineWhite', (0.86, 0.87, 0.88), metal=0.2, rough=0.4)
YELLOW = mat('MachineYellow', (0.95, 0.72, 0.05), metal=0.2, rough=0.45)
BLACKY = mat('HazardBlack', (0.03, 0.03, 0.03), rough=0.5)
GLASS = mat('BoothGlass', (0.25, 0.32, 0.36), rough=0.05, alpha=0.3)
REDL = mat('BeaconLens', (1.0, 0.45, 0.0), emit=(1.0, 0.4, 0.0), strength=2.0, alpha=0.9)
GREENL = mat('StatusGreen', (0.1, 1.0, 0.3), emit=(0.1, 1.0, 0.3), strength=3.0)
CYANL = mat('ScanLight', (0.2, 0.9, 1.0), emit=(0.2, 0.9, 1.0), strength=5.0)
RUBBER = mat('MachineRubber', (0.03, 0.03, 0.03), rough=0.9)
WOODP = mat('PalletWood', (0.55, 0.42, 0.25), rough=0.8)
CARDB = mat('Cardboard', (0.62, 0.47, 0.30), rough=0.85)
CURTAIN = mat('Curtain', (0.75, 0.45, 0.15), rough=0.6, alpha=0.55)


def flip(o):
    return o


# ---------------------------------------------------------------- stamping press (origin floor centre)
pr = empty('press')
f = Builder()
f.box((0, 0, 0.6), (5.2, 4.2, 1.2), GREY)                              # bed base
f.box((0, 0, 1.25), (4.2, 3.2, 0.1), STEEL)                            # bolster
for sx in (-2.3, 2.3):
    for sy in (-1.7, 1.7):
        f.box((sx, sy, 3.8), (0.7, 0.7, 7.6), BLUE)                     # columns
f.box((0, 0, 7.4), (5.4, 4.4, 1.6), BLUE)                              # crown
f.box((0, 0, 8.4), (2.0, 1.4, 0.6), GREY)                              # motor housing
for sx in (-0.6, 0.6):
    f.cyl((sx, 0, 8.9), 0.45, 0.25, DARK, axis='Y', segs=24)            # flywheels
for sx in (-2.66, 2.66):                                               # hazard stripes
    for k in range(6):
        f.box((sx, 0, 0.3 + k * 0.32), (0.02, 4.0, 0.14), YELLOW if k % 2 == 0 else BLACKY)
f.box((0, -2.2, 3.0), (5.2, 0.05, 0.08), YELLOW)                       # light curtain frame
f.box((0, 0, 1.31), (3.0, 2.0, 0.04), DARK)                            # lower die
f.obj('press_frame', parent=pr)
r = Builder()
r.box((0, 0, -0.6), (3.8, 3.0, 1.2), GREY)
r.box((0, 0, -1.3), (3.0, 2.0, 0.25), DARK)                            # upper die
for sx in (-1.0, 1.0):
    r.cyl((sx, 0, 0.6), 0.22, 1.6, STEEL, axis='Z')                   # guide rods
r.obj('press_ram', loc=(0, 0, 6.6), parent=pr)
t = Builder()
t.box((0, 0, 0.45), (2.0, 1.4, 0.9), GREY)
t.box((0, 0, 0.92), (1.9, 1.3, 0.04), STEEL)
t.obj('press_table', parent=None)

# ---------------------------------------------------------------- robot arm (L1 = 1.5, L2 = 1.4)
rb = empty('robot')
b = Builder()
b.cyl((0, 0, 0.05), 0.65, 0.1, DARK, segs=24)
b.cyl((0, 0, 0.32), 0.42, 0.5, ORANGE, segs=24)
b.box((0.0, 0.45, 0.25), (0.35, 0.2, 0.3), DARK)
b.obj('robot_base', parent=rb)
tu = Builder()
tu.cyl((0, 0, 0.1), 0.45, 0.2, ORANGE, segs=24)
tu.box((0, 0, 0.35), (0.55, 0.6, 0.45), ORANGE)
tu.cyl((0, 0.0, 0.5), 0.3, 0.75, DARK, axis='X', segs=20)
tu.box((0.0, 0.35, 0.3), (0.35, 0.25, 0.35), GREY)                       # motor
turret = tu.obj('robot_turret', loc=(0, 0, 0.6), parent=rb)
ua = Builder()
ua.box((0, 0, 0.75), (0.32, 0.38, 1.6), ORANGE)
ua.cyl((0, 0, 1.5), 0.24, 0.42, DARK, axis='X', segs=18)
ua.box((0.0, 0.25, 0.3), (0.25, 0.15, 0.4), GREY)
upper = ua.obj('robot_upper', loc=(0, 0, 0.5), parent=turret)
fa = Builder()
fa.box((0, 0, 0.0), (0.42, 0.42, 0.45), ORANGE)
fa.box((0, 0, 0.55), (0.24, 0.26, 1.0), ORANGE)
fa.cyl((0, 0, 1.1), 0.12, 0.12, DARK, segs=14)
fore = fa.obj('robot_fore', loc=(0, 0, 1.5), parent=upper)
cable = Builder()
cable.beam((0.0, 0.3, 0.1), (0.0, 0.25, 1.2), 0.07, DARK)
cable.obj('robot_cable', parent=upper)

# tools (origin = mount point, extending +Z by ~0.3)
tw = Builder()
tw.box((0, 0, 0.06), (0.22, 0.22, 0.12), DARK)
tw.box((0, 0.0, 0.18), (0.12, 0.3, 0.12), GREY)
tw.beam((0, -0.12, 0.2), (0, -0.12, 0.42), 0.04, STEEL)
tw.beam((0, 0.12, 0.2), (0, 0.04, 0.38), 0.04, STEEL)
tw.obj('tool_weld', parent=None)
tg = Builder()
tg.box((0, 0, 0.05), (0.3, 0.3, 0.1), DARK)
tg.box((0, 0, 0.14), (0.7, 0.12, 0.06), GREY)
for sx in (-0.3, 0.3):
    tg.box((sx, 0, 0.28), (0.05, 0.1, 0.25), STEEL)
    tg.cyl((sx, 0, 0.42), 0.06, 0.04, RUBBER, segs=10)
tg.obj('tool_grip', parent=None)
ts = Builder()
ts.box((0, 0, 0.06), (0.2, 0.2, 0.12), DARK)
ts.cyl((0, 0, 0.22), 0.07, 0.25, WHITE, segs=12)
ts.cyl((0, 0, 0.38), 0.03, 0.08, STEEL, segs=10, r2=0.015)
ts.obj('tool_spray', parent=None)
tn = Builder()
tn.box((0, 0, 0.06), (0.2, 0.2, 0.12), DARK)
tn.cyl((0, 0, 0.22), 0.06, 0.22, BLUE, segs=12)
tn.cyl((0, 0, 0.37), 0.025, 0.1, STEEL, segs=8)
tn.obj('tool_nut', parent=None)

# ---------------------------------------------------------------- conveyor segment (4 m along X, centred)
c = Builder()
for sy in (0.7, -0.7):
    c.box((0, sy, 0.12), (4.0, 0.14, 0.2), GREY)
    c.box((0, sy, 0.235), (4.0, 0.16, 0.03), YELLOW)
for k in range(8):
    x = -1.75 + k * 0.5
    c.cyl((x, 0, 0.19), 0.06, 1.3, STEEL, axis='Y', segs=10)
for x in (-1.9, 1.9):
    for sy in (0.7, -0.7):
        c.box((x, sy, 0.03), (0.2, 0.25, 0.06), DARK)
c.obj('conveyor', parent=None)

# ---------------------------------------------------------------- paint booth (x 0..14 long, z = 8 wide, 5.2 high) origin at centre floor
pb = Builder()
LEN, WID, HGT = 14.0, 8.0, 5.2
hx, hy = LEN / 2, WID / 2
# north wall solid, south wall with window band, roof, end frames with openings
pb.box((0, hy, HGT / 2), (LEN, 0.2, HGT), WHITE)
pb.box((0, -hy, 0.6), (LEN, 0.2, 1.2), WHITE)
pb.box((0, -hy, 4.4), (LEN, 0.2, 1.6), WHITE)
for x in range(-7, 8, 2):
    pb.box((x, -hy, 2.4), (0.15, 0.25, 2.4), GREY)
pb.box((0, 0, HGT + 0.1), (LEN + 0.2, WID + 0.2, 0.2), WHITE)
for sx in (-hx, hx):
    pb.box((sx, 2.75, HGT / 2), (0.3, 2.5, HGT), WHITE)
    pb.box((sx, -2.75, HGT / 2), (0.3, 2.5, HGT), WHITE)
    pb.box((sx, 0, 4.1), (0.3, 3.0, 2.2), WHITE)
    pb.box((sx - math.copysign(0.18, sx) * -1, 0, 3.0), (0.06, 3.0, 0.1), YELLOW)
# roof ducts + filter units
for x in (-4.5, 0, 4.5):
    pb.box((x, 1.5, HGT + 0.9), (2.4, 2.4, 1.6), GREY)
    pb.cyl((x, 1.5, HGT + 2.2), 0.5, 1.2, STEEL, segs=16)
pb.box((0, -1.8, HGT + 0.5), (LEN - 1, 1.0, 0.8), GREY)
# accent band + status lights
pb.box((0, -hy - 0.12, 4.0), (LEN, 0.04, 0.25), mat('BoothAccent', (0.0, 0.45, 0.9), emit=(0.0, 0.35, 0.9), strength=0.6))
# interior lights
for x in (-5, -1.7, 1.7, 5):
    for sy in (2.8, -2.8):
        pb.box((x, sy, HGT - 0.2), (2.6, 0.5, 0.06), mat('BoothLamp', (1, 1, 1), emit=(1, 1, 0.97), strength=5.0))
# floor grating
pb.box((0, 0, 0.02), (LEN - 0.4, WID - 0.4, 0.04), DARK)
pb.obj('paint_booth', parent=None)
gl = Builder()
gl.box((0, -hy, 2.4), (LEN, 0.04, 2.4), GLASS)
gl.obj('paint_booth_glass', parent=None)
cu = Builder()
for sx in (-hx, hx):
    for k in range(10):
        cu.box((sx, -1.35 + k * 0.3, 1.5), (0.02, 0.26, 3.0), CURTAIN)
cu.obj('paint_booth_curtain', parent=None)

# ---------------------------------------------------------------- engine marriage: portal lift + AGV
ml = empty('marriage')
mf = Builder()
for sx in (-2.8, 2.8):
    for sy in (-2.2, 2.2):
        mf.box((sx, sy, 3.0), (0.4, 0.4, 6.0), GREY)
    mf.box((sx, 0, 5.8), (0.4, 4.8, 0.4), GREY)
for sy in (-2.2, 2.2):
    mf.box((0, sy, 5.8), (6.0, 0.4, 0.4), GREY)
    for k in range(10):
        mf.box((-2.8 + 0.2, sy, 0.3 + k * 0.5), (0.02, 0.42, 0.22), YELLOW if k % 2 == 0 else BLACKY)
mf.obj('marriage_frame', parent=ml)
mb = Builder()
for sy in (-1.25, 1.25):
    mb.box((0, sy, 0), (5.2, 0.3, 0.3), ORANGE)
    for sx in (-1.6, 1.6):
        mb.box((sx, sy, -0.55), (0.12, 0.12, 1.1), DARK)
        mb.box((sx, sy * 0.85, -1.1), (0.25, 0.4, 0.08), DARK)
mb.obj('marriage_beam', loc=(0, 0, 2.0), parent=ml)
ag = empty('agv')
ab = Builder()
ab.box((0, 0, 0.18), (3.6, 1.4, 0.3), YELLOW)
ab.box((0, 0, 0.34), (3.4, 1.2, 0.04), DARK)
for sx in (-1.4, 1.4):
    for sy in (-0.6, 0.6):
        ab.cyl((sx, sy, 0.1), 0.1, 0.08, RUBBER, axis='Y', segs=12)
ab.box((1.75, 0, 0.3), (0.06, 0.8, 0.12), mat('AgvLamp', (0.2, 1, 0.4), emit=(0.2, 1, 0.4), strength=2))
ab.obj('agv_base', parent=ag)
at = Builder()
at.box((0, 0, 0.0), (3.2, 1.0, 0.08), GREY)
for sx in (1.42, 0.88, -1.33):
    at.box((sx, 0, 0.12), (0.35, 0.5, 0.18), DARK)
at.obj('agv_table', loc=(0, 0, 0.4), parent=ag)
sc = Builder()  # scissor (scaled in z by three)
for sx in (-1.0, 1.0):
    sc.beam((sx - 0.5, 0, 0), (sx + 0.5, 0, 1), 0.08, STEEL)
    sc.beam((sx + 0.5, 0, 0), (sx - 0.5, 0, 1), 0.08, STEEL)
sc.obj('agv_scissor', loc=(0, 0, 0.36), parent=ag)

# ---------------------------------------------------------------- QC gate (origin floor centre, moves along X)
qg = Builder()
for sy in (-2.3, 2.3):
    qg.box((0, sy, 1.8), (0.5, 0.35, 3.6), WHITE)
    for k in range(7):
        qg.box((0.26, sy - math.copysign(0.0, sy), 0.4 + k * 0.45), (0.04, 0.2, 0.06), CYANL)
qg.box((0, 0, 3.75), (0.6, 5.0, 0.4), WHITE)
for k in range(9):
    qg.box((0.0, -2.0 + k * 0.5, 3.53), (0.45, 0.08, 0.04), CYANL)
qg.box((0, 0, 3.98), (0.62, 5.02, 0.06), mat('QcAccent', (0, 0.45, 0.9), emit=(0, 0.45, 0.9), strength=1.0))
qg.obj('qc_gate', parent=None)
qr = Builder()
for sy in (-2.3, 2.3):
    qr.box((0, sy, 0.04), (7.0, 0.3, 0.08), DARK)
qr.obj('qc_rails', parent=None)

# ---------------------------------------------------------------- forklift (faces +X)
fk = empty('forklift')
fb = Builder()
fb.box((0, 0, 0.55), (1.9, 1.1, 0.6), YELLOW)
fb.box((-0.75, 0, 0.75), (0.5, 1.05, 0.7), DARK)                       # counterweight
fb.box((-0.1, 0, 0.95), (0.6, 0.6, 0.15), DARK)                        # seat
fb.box((-0.25, 0, 1.25), (0.12, 0.6, 0.5), DARK)
for sx in (0.5, -0.65):
    for sy in (0.5, -0.5):
        fb.box((sx + 0.0, sy, 2.0), (0.06, 0.06, 2.0), DARK)            # overhead guard posts
fb.box((-0.07, 0, 3.0), (1.25, 1.1, 0.06), DARK)
for sx in (0.55, -0.6):
    for sy in (0.48, -0.48):
        fb.cyl((sx, sy, 0.28), 0.28, 0.2, RUBBER, axis='Y', segs=16)
for sy in (0.25, -0.25):
    fb.box((1.0, sy, 1.6), (0.1, 0.08, 3.0), GREY)                     # mast
fb.cyl((0.3, 0.0, 1.3), 0.15, 0.04, DARK, axis='X', rot=Matrix.Rotation(-0.6, 4, 'Y'))
fb.obj('forklift_body', parent=fk)
ff = Builder()
ff.box((1.12, 0, 0.5), (0.08, 0.9, 0.6), DARK)
for sy in (0.25, -0.25):
    ff.box((1.65, sy, 0.22), (1.1, 0.1, 0.05), GREY)
ff.obj('forklift_fork', loc=(0, 0, 0.0), parent=fk)
fbe = Builder()
fbe.cyl((0, 0, 0.08), 0.09, 0.16, REDL, segs=12)
fbe.obj('forklift_beacon', loc=(-0.07, 0, 3.05), parent=fk)

# ---------------------------------------------------------------- overhead crane (bridge spans blender Y = three Z)
cr = empty('crane')
cb = Builder()
span = 12.0
for sx in (-0.5, 0.5):
    cb.box((sx, 0, 9.6), (0.35, span, 0.7), YELLOW)
for sy in (-span / 2, span / 2):
    cb.box((0, sy, 9.6), (2.0, 0.6, 0.8), YELLOW)
for k in range(12):
    cb.box((0.69, -span / 2 + 0.5 + k, 9.6), (0.02, 0.25, 0.6), BLACKY)
cb.obj('crane_bridge', parent=cr)
ct = Builder()
ct.box((0, 0, 0), (1.4, 1.0, 0.5), GREY)
ct.cyl((0, 0, -0.15), 0.25, 0.9, DARK, axis='X', segs=14)
ct.obj('crane_trolley', loc=(0, 0, 10.2), parent=cr)
ch = Builder()
ch.box((0, 0, 0), (0.35, 0.25, 0.4), YELLOW)
ch.cyl((0, 0, -0.35), 0.12, 0.05, STEEL, axis='Y', segs=12)
ch.obj('crane_hook', parent=None)
ca = Builder()
ca.box((0, 0, -0.5), (0.03, 0.03, 1.0), DARK)
ca.obj('crane_cable', parent=None)

# ---------------------------------------------------------------- info stand (panel faces -Y blender = +Z three)
ist = Builder()
ist.box((0, 0, 0.05), (0.7, 0.5, 0.1), DARK)
ist.box((0, 0, 0.6), (0.12, 0.12, 1.1), GREY)
ist.box((0, 0.02, 1.35), (1.0, 0.08, 0.7), DARK, rot=Matrix.Rotation(0.35, 4, 'X'))
ist.box((0, -0.04, 1.73), (1.0, 0.06, 0.05), mat('StandAccent', (0, 0.45, 0.9), emit=(0, 0.45, 0.9), strength=1.2), rot=Matrix.Rotation(0.35, 4, 'X'))
ist.obj('info_stand', parent=None)

# ---------------------------------------------------------------- hanging screen frame (6 x 3.4), face -Y
sf = Builder()
sf.box((0, 0.05, 0), (6.3, 0.15, 3.7), DARK)
for sx in (-2.5, 2.5):
    sf.box((sx, 0.05, 3.5), (0.04, 0.04, 3.3), GREY)
sf.obj('screen_frame', parent=None)

# ---------------------------------------------------------------- beacon (base + rotating light)
be = Builder()
be.cyl((0, 0, 0.6), 0.05, 1.2, GREY, segs=10)
be.cyl((0, 0, 1.22), 0.12, 0.06, DARK, segs=14)
be.obj('beacon_pole', parent=None)
bl = Builder()
bl.cyl((0, 0, 0.12), 0.11, 0.22, REDL, segs=14)
bl.box((0.06, 0, 0.12), (0.02, 0.12, 0.16), STEEL)
bl.obj('beacon_light', parent=None)

# ---------------------------------------------------------------- pallet rack with boxes (along X 8 m)
rk = Builder()
for x in (-4, 0, 4):
    for sy in (-0.55, 0.55):
        rk.box((x, sy, 3.0), (0.1, 0.1, 6.0), BLUE)
for z in (0.15, 2.0, 3.9):
    for sy in (-0.55, 0.55):
        rk.box((0, sy, z), (8.1, 0.08, 0.14), ORANGE)
import random
random.seed(7)
for z in (0.3, 2.15, 4.05):
    x = -3.6
    while x < 3.5:
        w = random.uniform(0.7, 1.3)
        h = random.uniform(0.6, 1.4)
        rk.box((x + w / 2, 0, z + 0.07), (w * 0.95, 1.0, 0.12), WOODP)
        rk.box((x + w / 2, 0, z + 0.13 + h / 2), (w * 0.9, 0.95, h), CARDB if random.random() < 0.7 else GREY)
        x += w + 0.1
rk.obj('rack', parent=None)

cr2 = Builder()
cr2.box((0, 0, 0.07), (1.2, 1.0, 0.14), WOODP)
cr2.box((0, 0, 0.6), (1.1, 0.95, 0.9), CARDB)
cr2.box((0, -0.48, 0.6), (1.12, 0.01, 0.12), mat('Tape', (0.85, 0.75, 0.6), rough=0.4))
cr2.obj('crate', parent=None)

# wheel rack / parts cart
wr = Builder()
wr.box((0, 0, 0.45), (2.2, 0.8, 0.06), GREY)
wr.box((0, 0, 1.3), (2.2, 0.8, 0.06), GREY)
for sx in (-1.05, 1.05):
    for sy in (-0.35, 0.35):
        wr.box((sx, sy, 0.8), (0.05, 0.05, 1.6), BLUE)
        wr.cyl((sx, sy, 0.08), 0.08, 0.06, RUBBER, axis='Y', segs=10)
wr.obj('cart', parent=None)

# operator console with screen anchor
oc = Builder()
oc.box((0, 0, 0.5), (0.8, 0.5, 1.0), GREY)
oc.box((0, -0.05, 1.15), (0.8, 0.4, 0.4), DARK, rot=Matrix.Rotation(0.5, 4, 'X'))
oc.box((0.25, -0.28, 0.95), (0.1, 0.02, 0.1), GREENL)
oc.box((-0.25, -0.28, 0.95), (0.12, 0.02, 0.12), mat('StopRed', (0.9, 0.05, 0.05), emit=(0.9, 0.05, 0.02), strength=1.5))
oc.obj('console', parent=None)

# floating "your car is here" marker (downward arrow), origin at the tip
mk = Builder()
MK = mat('MarkerGlow', (0.2, 0.8, 1.0), emit=(0.2, 0.8, 1.0), strength=4.0)
mk.cyl((0, 0, 0.3), 0.32, 0.6, MK, segs=4, r2=0.0, rot=Matrix.Rotation(math.pi, 4, 'X'))
mk.box((0, 0, 0.85), (0.22, 0.22, 0.5), MK)
mk.obj('marker', parent=None)

export('machines.glb')
if '--preview' in sys.argv:
    out = os.path.join(ROOT, 'blender', 'preview')
    # spread objects for a preview
    roots = ['press', 'robot', 'press_table', 'tool_weld', 'tool_grip', 'tool_spray', 'tool_nut', 'conveyor',
             'paint_booth', 'marriage', 'agv', 'qc_gate', 'forklift', 'crane', 'info_stand', 'screen_frame',
             'rack', 'crate', 'cart', 'console', 'beacon_pole']
    for i, n in enumerate(roots):
        bpy.data.objects[n].location.x += (i % 7) * 16
        bpy.data.objects[n].location.y += (i // 7) * 18
    preview(os.path.join(out, 'machines.png'), (48, -60, 40), (48, 18, 2), lens=30, size=(1400, 800))
