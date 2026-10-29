"""Shared helpers for the GIGAWORKS Blender asset scripts.

All geometry is built with bmesh (no edit-mode operators) so the scripts run
headless:  blender --background --factory-startup --python <script>.py
Coordinates: Blender is Z-up; the glTF exporter converts to Y-up
(blender (x, y, z) -> three (x, z, -y)).
"""
import bpy
import bmesh
import json
import math
import os
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')


def load_json(rel):
    with open(os.path.join(ROOT, rel)) as f:
        return json.load(f)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


# ---------------------------------------------------------------- materials
MATS = {}


def mat(name, color, metal=0.0, rough=0.5, emit=None, strength=1.0, alpha=1.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, alpha)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            m.blend_method = 'BLEND'
    MATS[name] = m
    return m


# ---------------------------------------------------------------- bmesh builders
class Builder:
    """Accumulates primitives into one bmesh with per-face material slots."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _tag(self, verts, m, smooth=False):
        idx = self.mi(m)
        faces = set()
        for v in verts:
            faces.update(v.link_faces)
        for f in faces:
            f.material_index = idx
            f.smooth = smooth
        return faces

    def box(self, center, size, m, rot=None, smooth=False):
        mtx = Matrix.Translation(Vector(center))
        if rot is not None:
            mtx = mtx @ rot
        mtx = mtx @ Matrix.Diagonal((*size, 1))
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=mtx)
        self._tag(r['verts'], m, smooth)
        return r['verts']

    def cyl(self, center, radius, depth, m, axis='Z', segs=16, r2=None, smooth=True, rot=None):
        mtx = Matrix.Translation(Vector(center))
        if rot is not None:
            mtx = mtx @ rot
        if axis == 'X':
            mtx = mtx @ Matrix.Rotation(math.pi / 2, 4, 'Y')
        elif axis == 'Y':
            mtx = mtx @ Matrix.Rotation(math.pi / 2, 4, 'X')
        r = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=segs, radius1=radius,
                                  radius2=radius if r2 is None else r2, depth=depth, matrix=mtx)
        self._tag(r['verts'], m, smooth)
        return r['verts']

    def sphere(self, center, radius, m, segs=12, rings=8, scale=(1, 1, 1)):
        mtx = Matrix.Translation(Vector(center)) @ Matrix.Diagonal((*scale, 1))
        r = bmesh.ops.create_uvsphere(self.bm, u_segments=segs, v_segments=rings, radius=radius, matrix=mtx)
        self._tag(r['verts'], m, True)
        return r['verts']

    def beam(self, a, b, thick, m, thick2=None):
        """Box from point a to point b with square-ish cross section."""
        a, b = Vector(a), Vector(b)
        d = b - a
        L = d.length
        z = d.normalized()
        up = Vector((0, 0, 1)) if abs(z.z) < 0.95 else Vector((1, 0, 0))
        x = up.cross(z).normalized()
        y = z.cross(x)
        rot = Matrix((x, y, z)).transposed().to_4x4()
        return self.box((a + b) / 2, (thick, thick2 or thick, L), m, rot=rot)

    def poly_extrude(self, pts2d, y0, y1, m, plane='XZ', smooth=False):
        """Extrude a 2D polygon (in XZ) between y0 and y1 (or in XY between z0/z1)."""
        bm = self.bm
        if plane == 'XZ':
            va = [bm.verts.new((x, y0, z)) for x, z in pts2d]
            vb = [bm.verts.new((x, y1, z)) for x, z in pts2d]
        else:
            va = [bm.verts.new((x, y, y0)) for x, y in pts2d]
            vb = [bm.verts.new((x, y, y1)) for x, y in pts2d]
        n = len(pts2d)
        fs = [bm.faces.new(va), bm.faces.new(list(reversed(vb)))]
        for i in range(n):
            j = (i + 1) % n
            fs.append(bm.faces.new((va[i], va[j], vb[j], vb[i])))
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        self._tag(va + vb, m, smooth)
        return va + vb

    def revolve(self, profile, m, segs=32, center=(0, 0, 0), smooth=True):
        """Revolve a list of (radius, axial) points around the Y axis (closed profile)."""
        bm = self.bm
        cx, cy, cz = center
        rings = []
        for s in range(segs):
            a = 2 * math.pi * s / segs
            ca, sa = math.cos(a), math.sin(a)
            rings.append([bm.verts.new((cx + r * ca, cy + y, cz + r * sa)) for r, y in profile])
        n = len(profile)
        fs = []
        for s in range(segs):
            r0, r1 = rings[s], rings[(s + 1) % segs]
            for i in range(n):
                j = (i + 1) % n
                fs.append(bm.faces.new((r0[i], r0[j], r1[j], r1[i])))
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        allv = [v for r in rings for v in r]
        self._tag(allv, m, smooth)
        return allv

    def obj(self, name, loc=(0, 0, 0), parent=None, origin=None):
        """Finish into an object. `origin` shifts geometry so the pivot is at that point."""
        bm = self.bm
        if origin is not None:
            bmesh.ops.translate(bm, verts=bm.verts, vec=-Vector(origin))
            loc = Vector(origin) + Vector(loc)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m)
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        o.location = loc
        if parent is not None:
            o.parent = parent
        return o


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    if parent is not None:
        o.parent = parent
    return o


def mesh_obj_from_bm(name, bm, mats, origin=None, parent=None, smooth=True):
    if origin is not None:
        bmesh.ops.translate(bm, verts=bm.verts, vec=-Vector(origin))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = smooth
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    if origin is not None:
        o.location = origin
    if parent is not None:
        o.parent = parent
    return o


def apply_modifiers(o):
    """Bake modifiers into the mesh without needing an operator context."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    o.modifiers.clear()
    o.data = me
    return o


def bm_of(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.transform(o.matrix_world)
    return bm


def split(bm, co, no):
    """Split a bmesh by a plane. Returns (positive side, negative side) copies."""
    pos = bm.copy()
    neg = bm.copy()
    g = pos.verts[:] + pos.edges[:] + pos.faces[:]
    bmesh.ops.bisect_plane(pos, geom=g, plane_co=co, plane_no=no, clear_inner=True)
    g = neg.verts[:] + neg.edges[:] + neg.faces[:]
    bmesh.ops.bisect_plane(neg, geom=g, plane_co=co, plane_no=no, clear_outer=True)
    return pos, neg


def join(*bms):
    out = bmesh.new()
    me = bpy.data.meshes.new('_tmp')
    for b in bms:
        b.to_mesh(me)
        out.from_mesh(me)
    bpy.data.meshes.remove(me)
    return out


def text_mesh(name, body, size, extrude, m, loc=(0, 0, 0), rot=(0, 0, 0), align='CENTER'):
    """Text object with Blender's built-in font, converted to a mesh object."""
    cu = bpy.data.curves.new(name + '_curve', 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.space_character = 1.05
    t = bpy.data.objects.new(name + '_txt', cu)
    bpy.context.scene.collection.objects.link(t)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(t.evaluated_get(dg))
    bpy.data.objects.remove(t)
    me.materials.clear()
    me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    return o


def export(filename):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True,
                              export_yup=True, export_animations=False, export_cameras=False,
                              export_lights=False)
    print('EXPORTED', path, os.path.getsize(path))


def preview(png, cam_loc, target, lens=35, size=(900, 560)):
    """Quick workbench render for visual checks of an asset."""
    scn = bpy.context.scene
    cam = bpy.data.objects.new('_cam', bpy.data.cameras.new('_cam'))
    scn.collection.objects.link(cam)
    cam.location = cam_loc
    d = Vector(target) - Vector(cam_loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    cam.data.clip_end = 2000
    scn.camera = cam
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.color_type = 'MATERIAL'
    scn.display.shading.show_shadows = True
    scn.render.resolution_x, scn.render.resolution_y = size
    scn.render.filepath = png
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
