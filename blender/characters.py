"""Player and worker characters built from rigid limbs (no skinning).
Hierarchy: <name> (root at feet) > _hips > _torso > _head, _arm_L/_arm_R (> _fore_*), _leg_L/_leg_R (> _shin_*)
Characters face -Y in Blender (= +Z in three.js). Pivots at the joints."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, math
from mathutils import Matrix
from lib import *

reset()

SKIN = mat('Skin', (0.85, 0.62, 0.48), rough=0.6)
SKIN2 = mat('Skin2', (0.55, 0.36, 0.25), rough=0.6)


def person(name, c):
    root = empty(name)
    hips_h = 0.95
    h = Builder()
    h.box((0, 0, 0), (0.36, 0.22, 0.18), c['pants'])
    hips = h.obj(name + '_hips', loc=(0, 0, hips_h), parent=root)

    t = Builder()
    t.box((0, 0, 0.27), (0.42, 0.24, 0.5), c['shirt'])
    t.box((0, 0, 0.55), (0.12, 0.12, 0.08), c['skin'])                       # neck
    if c.get('vest'):
        t.box((0, -0.005, 0.25), (0.44, 0.255, 0.42), c['vest'])
        for z in (0.16, 0.30):
            t.box((0, -0.13, z), (0.445, 0.01, 0.04), mat('Reflective', (0.9, 0.9, 0.9), metal=0.6, rough=0.2, emit=(0.4, 0.4, 0.4), strength=0.3))
    if c.get('logo'):
        t.box((0.09, -0.125, 0.38), (0.1, 0.01, 0.06), c['logo'])
    torso = t.obj(name + '_torso', loc=(0, 0, 0.09), parent=hips)

    hd = Builder()
    hd.box((0, 0, 0.13), (0.22, 0.24, 0.26), c['skin'])
    hd.box((0, 0.02, 0.27), (0.24, 0.26, 0.06), c['hair'])
    hd.box((0, 0.11, 0.18), (0.235, 0.05, 0.18), c['hair'])
    for sx in (-0.05, 0.05):
        hd.box((sx, -0.121, 0.15), (0.035, 0.01, 0.03), mat('Eye', (0.05, 0.05, 0.06), rough=0.3))
    hd.box((0, -0.125, 0.08), (0.06, 0.01, 0.015), mat('Mouth', (0.45, 0.2, 0.18), rough=0.6))
    if c.get('helmet'):
        hd.sphere((0, 0.0, 0.26), 0.16, c['helmet'], segs=14, rings=8, scale=(1, 1.1, 0.75))
        hd.box((0, -0.15, 0.24), (0.26, 0.08, 0.02), c['helmet'])
    if c.get('glasses'):
        hd.box((0, -0.125, 0.15), (0.2, 0.012, 0.045), c['glasses'])
    head = hd.obj(name + '_head', loc=(0, 0, 0.6), parent=torso)

    for side, sx in (('L', 1), ('R', -1)):
        a = Builder()
        a.box((0, 0, -0.15), (0.12, 0.13, 0.32), c['sleeve'])
        arm = a.obj('%s_arm_%s' % (name, side), loc=(sx * 0.27, 0, 0.47), parent=torso)
        f = Builder()
        f.box((0, 0, -0.13), (0.1, 0.11, 0.26), c['sleeve2'])
        f.box((0, 0, -0.30), (0.09, 0.1, 0.1), c['glove'] if c.get('glove') else c['skin'])
        f.obj('%s_fore_%s' % (name, side), loc=(0, 0, -0.31), parent=arm)

        l = Builder()
        l.box((0, 0, -0.22), (0.15, 0.17, 0.45), c['pants'])
        leg = l.obj('%s_leg_%s' % (name, side), loc=(sx * 0.1, 0, -0.06), parent=hips)
        s = Builder()
        s.box((0, 0, -0.2), (0.13, 0.15, 0.4), c['pants'])
        s.box((0, -0.04, -0.42), (0.14, 0.26, 0.09), c['shoes'])
        s.obj('%s_shin_%s' % (name, side), loc=(0, 0, -0.44), parent=leg)
    return root


person('player', dict(
    skin=SKIN, hair=mat('HairDark', (0.08, 0.05, 0.03), rough=0.8),
    shirt=mat('Jacket', (0.06, 0.18, 0.38), rough=0.6), sleeve=mat('Jacket', (0, 0, 0)), sleeve2=mat('Jacket', (0, 0, 0)),
    pants=mat('Jeans', (0.1, 0.12, 0.18), rough=0.8), shoes=mat('Sneakers', (0.9, 0.9, 0.9), rough=0.5),
    logo=mat('LogoCyan', (0.0, 0.7, 1.0), emit=(0.0, 0.6, 1.0), strength=1.0)))

person('worker', dict(
    skin=SKIN2, hair=mat('HairBrown', (0.2, 0.12, 0.06), rough=0.8),
    shirt=mat('Overall', (0.12, 0.2, 0.32), rough=0.7), sleeve=mat('Overall', (0, 0, 0)), sleeve2=mat('Overall', (0, 0, 0)),
    pants=mat('Overall', (0, 0, 0)), shoes=mat('Boots', (0.12, 0.09, 0.06), rough=0.7),
    vest=mat('HiVis', (1.0, 0.45, 0.02), rough=0.5, emit=(0.4, 0.15, 0.0), strength=0.2),
    helmet=mat('Helmet', (0.95, 0.95, 0.95), rough=0.3), glove=mat('Glove', (0.75, 0.6, 0.1), rough=0.8),
    glasses=mat('SafetyGlasses', (0.1, 0.1, 0.1), rough=0.1)))

export('characters.glb')
if '--preview' in sys.argv:
    bpy.data.objects['worker'].location.x = 0.8
    preview(os.path.join(ROOT, 'blender', 'preview', 'characters.png'), (0.4, -4.0, 1.3), (0.4, 0, 0.9), lens=50, size=(600, 600))
