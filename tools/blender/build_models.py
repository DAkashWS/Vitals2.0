# Builds the simulator's 3D models into public/models/. Run with Blender 4.5 LTS, no window:
#   blender -b --factory-startup -P tools/blender/build_models.py -- [astronaut|exterior|interior|all]
#
# Everything is authored in the simulator's own axes (X right, Y up, Z toward the viewer) and exported
# without axis conversion, so a position here is the same position in src/simulator/components/scene3d.ts.
# Objects that scene3d.ts looks up by name are marked "name:" below; don't rename them without changing both.
#
# Sources (tools/blender/sources/, fetched by fetch_sources.sh, not kept in git):
#   NASA 3D Resources (https://github.com/nasa/NASA-3D-Resources), "free and without copyright",
#   used under NASA's media guidelines (no endorsement implied): emu.glb, iss_b.glb, crew_lock_bag.glb,
#   pistol_grip_tool.glb. The station interior and the task props are modelled here in code.
import bpy, bmesh, math, os, random, sys
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "sources")
OUT = os.path.abspath(os.path.join(ROOT, "..", "..", "public", "models"))
PREVIEW = os.environ.get("VITALS_PREVIEW_DIR", "")  # set to a folder to also write preview renders
TO_SIM = Matrix.Rotation(-math.pi / 2, 4, "X")  # Blender's Z-up import -> the simulator's Y-up
INCH = 0.0254  # NASA's tool and bag models are in inches
rnd = random.Random(61)
MATS = {}


# ----------------------------------------------------------------------------- scene helpers
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    rnd.seed(61)


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def only(objs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


def join(objs, name):
    only(objs)
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    return obj


def transform(obj, m):
    obj.matrix_world = m @ obj.matrix_world
    only([obj])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def empty(name, at=(0, 0, 0), matrix=None):
    e = link(bpy.data.objects.new(name, None))
    e.matrix_world = matrix if matrix is not None else Matrix.Translation(at)
    return e


def adopt(parent, *children):
    """Parents children, keeping where they are."""
    bpy.context.view_layer.update()
    for c in children:
        c.parent = parent
        c.matrix_parent_inverse = parent.matrix_world.inverted()
    return parent


def bounds(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def decimate(obj, target_tris):
    n = tri_count(obj)
    if n <= target_tris:
        return
    only([obj])
    m = obj.modifiers.new("dec", "DECIMATE")
    m.ratio = target_tris / n
    bpy.ops.object.modifier_apply(modifier="dec")


def import_parts(name, scale=1.0):
    """Imports a source model as separate mesh objects in simulator axes (no parents, no animation)."""
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name))
    new = [o for o in bpy.context.scene.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        o.animation_data_clear()
    only(meshes)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    for o in meshes:
        o.matrix_world = Matrix.Scale(scale, 4) @ TO_SIM @ o.matrix_world
    only(meshes)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return meshes


def import_glb(name, scale=1.0):
    """Imports a source model as one mesh object in simulator axes, centred on its own middle."""
    obj = join(import_parts(name, scale), name.split(".")[0])
    lo, hi = bounds(obj)
    obj.data.transform(Matrix.Translation(-(lo + hi) / 2))
    return obj


def export(objs, name, colors=False):
    os.makedirs(OUT, exist_ok=True)
    only(objs)
    path = os.path.join(OUT, name)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=False,  # already in the simulator's axes
        export_apply=True,
        export_animations=False,
        export_image_format="WEBP",
        export_image_quality=82,
        export_vertex_color="ACTIVE" if colors else "NONE",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
    )
    tris = sum(tri_count(o) for o in objs if o.type == "MESH")
    print(f"EXPORTED {name}: {os.path.getsize(path) / 1048576:.2f} MB, {tris} triangles, {len(objs)} objects")


def preview(name, eye, target, up=(0, 1, 0), ortho=None, color="TEXTURE", size=(960, 720), lens=22):
    """A quick Workbench render (only when VITALS_PREVIEW_DIR is set), to check a model without a window."""
    if not PREVIEW:
        return
    sc = bpy.context.scene
    cam_data = bpy.data.cameras.new("pv")
    cam = link(bpy.data.objects.new("pv", cam_data))
    eye, target, up = Vector(eye), Vector(target), Vector(up)
    f = (target - eye).normalized()
    r = f.cross(up).normalized()
    u = r.cross(f)
    cam.matrix_world = Matrix(((r.x, u.x, -f.x, eye.x), (r.y, u.y, -f.y, eye.y), (r.z, u.z, -f.z, eye.z), (0, 0, 0, 1)))
    cam_data.clip_start, cam_data.clip_end = 0.05, 2000
    if ortho:
        cam_data.type, cam_data.ortho_scale = "ORTHO", ortho
    else:
        cam_data.lens = lens
    sc.camera = cam
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = color
    sc.display.shading.show_cavity = True
    sc.render.resolution_x, sc.render.resolution_y = size
    if not sc.world:
        sc.world = bpy.data.worlds.new("w")
    sc.world.color = (0.02, 0.025, 0.04)
    sc.render.filepath = os.path.join(PREVIEW, name + ".png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


# ----------------------------------------------------------------------------- materials
def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


def mat(name, color, rough=0.6, metal=0.0, emit=None, strength=1.0, alpha=1.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    rgb = hexrgb(color)
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*hexrgb(emit), 1)
        b.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "BLENDED"
        if hasattr(m, "blend_method"):
            m.blend_method = "BLEND"
    m.diffuse_color = (*rgb, alpha)  # what the preview shows
    MATS[name] = m
    return m


def set_materials(me, new_mats, index):
    """Replaces a mesh's materials; index maps each old slot to its new one."""
    wanted = [index[p.material_index] for p in me.polygons]  # clearing the slots resets every face to slot 0
    me.materials.clear()
    for m in new_mats:
        me.materials.append(m)
    me.polygons.foreach_set("material_index", wanted)
    me.update()


# ----------------------------------------------------------------------------- shapes
def new_obj(name, bm, m=None, smooth=False, at=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(38))
    if m:
        me.materials.append(m)
    ob = link(bpy.data.objects.new(name, me))
    ob.location = at
    return ob


def box(size, at=(0, 0, 0), m=None, bevel=0.0, name="box", smooth=False, segs=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=min(bevel, min(size) * 0.45), segments=segs, profile=0.5, affect="EDGES")
    return new_obj(name, bm, m, smooth, at)


AXIS = {"y": Matrix.Rotation(-math.pi / 2, 4, "X"), "x": Matrix.Rotation(math.pi / 2, 4, "Y"), "z": Matrix.Identity(4)}


def cyl(r, h, at=(0, 0, 0), m=None, axis="y", segs=18, name="cyl", caps=True, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.transform(bm, matrix=AXIS[axis], verts=bm.verts)
    return new_obj(name, bm, m, True, at)


def ball(r, at=(0, 0, 0), m=None, name="ball", segs=14):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2 + 2, radius=r)
    return new_obj(name, bm, m, True, at)


def disc(r, at=(0, 0, 0), m=None, name="disc", segs=28):
    """A flat disc facing +Z."""
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, cap_tris=False, segments=segs, radius=r)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    return new_obj(name, bm, m, False, at)


def ring(R, r, at=(0, 0, 0), m=None, axis="z", name="ring", segs=28, tube=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=segs, minor_segments=tube, location=(0, 0, 0))
    ob = bpy.context.active_object
    ob.name = name
    ob.data.transform(AXIS[axis])
    for p in ob.data.polygons:
        p.use_smooth = True
    if m:
        ob.data.materials.append(m)
    ob.location = at
    return ob


def refine(obj, max_len=0.55, passes=3):
    """Cuts long edges, so baked shading has enough points to live on."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for _ in range(passes):
        long_edges = [e for e in bm.edges if e.calc_length() > max_len]
        if not long_edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=1, use_grid_fill=True)
    bm.to_mesh(obj.data)
    bm.free()


def bake_ao(objs, distance=1.1, floor=0.4, samples=24):
    """Bakes ambient occlusion into vertex colours (COLOR_0): soft contact shadows at no cost per frame."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    if not sc.world:
        sc.world = bpy.data.worlds.new("w")
    sc.world.light_settings.distance = distance
    for o in objs:
        me = o.data
        col = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        me.color_attributes.active_color = col
        me.color_attributes.render_color_index = me.color_attributes.find("Col")
        only([o])
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
        col = me.color_attributes["Col"]
        n = len(col.data)
        buf = [0.0] * (n * 4)
        col.data.foreach_get("color", buf)
        for i in range(0, n * 4, 4):
            v = floor + (1 - floor) * buf[i]  # never fully black: the station lights fill in
            buf[i] = buf[i + 1] = buf[i + 2] = v
            buf[i + 3] = 1.0
        col.data.foreach_set("color", buf)
    print(f"BAKED ambient occlusion on {len(objs)} objects")


# ----------------------------------------------------------------------------- astronaut (NASA EMU suit)
def build_astronaut():
    reset()
    suit = import_glb("emu.glb")
    decimate(suit, 52000)
    for p in suit.data.polygons:
        p.use_smooth = True
    suit.data.transform(Matrix.Rotation(math.pi, 4, "Y"))  # face the viewer (+Z)
    me = suit.data
    # 25 near-identical materials would be 25 draw calls: plain ones merge by colour, textured ones stay
    area, centre = {}, {}
    for p in me.polygons:
        i = p.material_index
        area[i] = area.get(i, 0) + p.area
        centre[i] = centre.get(i, Vector()) + p.center * p.area
    gold = lambda c: c[0] > c[1] > c[2] and c[0] - c[2] > 0.25
    visor_i, best = None, 0
    for i, m in enumerate(me.materials):
        b = m.node_tree.nodes.get("Principled BSDF")
        c = b.inputs["Base Color"].default_value
        mid = centre[i] / area[i] if area.get(i) else Vector()
        # the visor: the big gold surface on the front of the helmet
        if gold(c) and mid.y > 0.55 and mid.z > 0.05 and area.get(i, 0) > best:
            visor_i, best = i, area[i]
    new_mats, index = [], {}
    for i, m in enumerate(me.materials):
        b = m.node_tree.nodes.get("Principled BSDF")
        c = b.inputs["Base Color"].default_value
        if i == visor_i:
            key = "Visor"  # name: scene3d.ts tints this material
            nm = mat("Visor", "#d9a441", rough=0.18, metal=0.85)
        elif b.inputs["Base Color"].links:
            key, nm = m.name, m
            b.inputs["Roughness"].default_value = 0.85
        else:
            key = tuple(round(v, 1) for v in c[:3])
            nm = MATS.get(key)
            if not nm:
                nm = bpy.data.materials.new("Suit")
                nm.use_nodes = True
                nb = nm.node_tree.nodes["Principled BSDF"]
                nb.inputs["Base Color"].default_value = c[:]
                nb.inputs["Roughness"].default_value = 0.82
                nm.diffuse_color = c[:]
                MATS[key] = nm
        if nm not in new_mats:
            new_mats.append(nm)
        index[i] = new_mats.index(nm)
    set_materials(me, new_mats, index)
    print(f"ASTRONAUT materials {len(index)} -> {len(new_mats)}, visor found: {visor_i is not None} (area {best:.3f})")
    suit.name = "astronaut"  # name
    preview("astronaut_front", (0, 0.2, 4.2), (0, 0, 0), color="MATERIAL")
    preview("astronaut_side", (4.2, 0.2, 0.6), (0, 0, 0), color="TEXTURE")
    export([suit], "astronaut.glb")


# ----------------------------------------------------------------------------- exterior (NASA ISS)
# Station axes -> scene axes: truss along X, zenith up (+Y), the long aft stack receding (-Z); 1 model unit = 2.4 m.
# The translation puts the work site (truss centre, with the lab running toward the viewer) at the origin.
ISS_TO_SCENE = Matrix.Translation((0, 0, -25.85)) @ Matrix(((0, 0, -1, 0), (-1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1))) @ Matrix.Scale(2.4, 4)
ISS_LOOK = {  # the source has no colours: these go by what each material covers
    "lambert7SG": "array", "lambert4SG": "array",
    "soyuz_blinn4SG": "radiator",
    "lambert3SG": "truss", "bendedtruss_blin": "truss", "initialShadingGr": "truss",
    "anisotropic1SG": "moduleLight", "blinn1SG": "module",
    "blinn3SG": "dock", "blinn4SG": "dock", "soyuz_blinn2SG": "soyuz", "soyuz_blinn3SG": "soyuz",
    "apollohorns_blin": "gold", "blinn5SG": "gold",
}


def surface_y(obj, x, z, default=0.0):
    """Height of the top surface at (x, z): a ray straight down from far above."""
    hit, loc, _n, _i = obj.ray_cast(Vector((x, 500, z)), Vector((0, -1, 0)))
    return loc.y if hit else default


def build_exterior():
    reset()
    look = {
        "module": mat("Module", "#dfe3ea", rough=0.55, metal=0.25),
        "moduleLight": mat("ModuleLight", "#eef0f4", rough=0.6, metal=0.15),
        "dock": mat("Dock", "#8f97a6", rough=0.5, metal=0.5),
        "soyuz": mat("Soyuz", "#59645c", rough=0.7, metal=0.2),
        "gold": mat("GoldFoil", "#c9a24a", rough=0.35, metal=0.9),
        "truss": mat("Truss", "#a2a9b6", rough=0.45, metal=0.65),
        "array": mat("SolarArray", "#12234f", rough=0.28, metal=0.6, emit="#0b1a3a", strength=0.6),
        "radiator": mat("Radiator", "#f2f3f5", rough=0.5, metal=0.1),
    }
    keep = []
    for o in import_parts("iss_b.glb"):
        transform(o, ISS_TO_SCENE)
        if bounds(o)[0].z > 60:  # seven stray discs far off the station
            bpy.data.objects.remove(o)
        else:
            keep.append(o)
    iss = join(keep, "station")
    me = iss.data
    new_mats, index = [], {}
    for i, m in enumerate(me.materials):
        nm = look[ISS_LOOK.get(m.name.split(".")[0], "module")]
        if nm not in new_mats:
            new_mats.append(nm)
        index[i] = new_mats.index(nm)
    set_materials(me, new_mats, index)
    decimate(iss, 70000)
    bpy.context.view_layer.update()

    # ---- work site: anchors snapped onto the real surface
    lab_top = surface_y(iss, 0, 4.0, 1.9)
    truss_l = surface_y(iss, -7.0, 0.0, surface_y(iss, -7.0, 0.3, 1.0))
    truss_r = surface_y(iss, 8.0, 0.0, surface_y(iss, 8.0, 0.3, 1.0))
    print(f"SITE lab top y={lab_top:.2f}, truss top left y={truss_l:.2f}, right y={truss_r:.2f}")
    white = mat("EquipWhite", "#e9ecf1", rough=0.5, metal=0.2)
    dark = mat("EquipDark", "#2b303b", rough=0.5, metal=0.5)
    gold = look["gold"]
    lens = mat("Lens", "#0b0d12", rough=0.1, metal=0.9)
    out = [iss]

    # airlock (name: airlock, hatchLamp): the crew lock's outer hatch on top of the lab
    a = Vector((0, lab_top, 5.6))
    body = join([
        cyl(0.95, 0.5, a + Vector((0, 0.25, 0)), white, segs=28),
        cyl(1.05, 0.08, a + Vector((0, 0.04, 0)), dark, segs=28),
        ring(0.78, 0.06, a + Vector((0, 0.5, 0)), gold, axis="y"),
        cyl(0.7, 0.04, a + Vector((0, 0.5, 0)), dark, segs=28),
        ring(1.02, 0.03, a + Vector((0, 0.36, 0)), gold, axis="y"),
        *[box((0.08, 0.16, 0.08), a + Vector((math.cos(t) * 1.02, 0.28, math.sin(t) * 1.02)), gold) for t in (0.6, 2.2, 3.8, 5.4)],
    ], "airlockBody")
    lamp = cyl(0.42, 0.02, a + Vector((0, 0.53, 0)), mat("Lamp", "#5cc8ff", emit="#5cc8ff", strength=2), segs=24, name="hatchLamp")
    out += [adopt(empty("airlock", a), body, lamp), body, lamp]

    # gold handrails from the airlock to the truss, as on the real hull
    rails = []
    for z in (4.2, 3.2, 2.2):
        for x in (-0.7, 0.7):
            y = surface_y(iss, x, z, lab_top)
            rails += [box((0.04, 0.03, 0.55), (x, y + 0.1, z), gold), box((0.04, 0.1, 0.04), (x, y + 0.05, z - 0.25), gold), box((0.04, 0.1, 0.04), (x, y + 0.05, z + 0.25), gold)]
    bag = import_glb("crew_lock_bag.glb", INCH)
    bag.location = a + Vector((1.25, 0.25, 0.3))
    out.append(join(rails, "handrails"))
    out.append(bag)

    # task 1 (name: task1): the camera on the truss
    p = Vector((-7.0, truss_l, 0.0))
    cam = join([
        cyl(0.045, 0.55, p + Vector((0, 0.275, 0)), dark),
        box((0.2, 0.12, 0.2), p + Vector((0, 0.6, 0)), dark, bevel=0.02),
        box((0.26, 0.2, 0.42), p + Vector((0, 0.76, 0.02)), white, bevel=0.03),
        cyl(0.075, 0.12, p + Vector((0, 0.76, 0.28)), lens, axis="z"),
        box((0.3, 0.02, 0.2), p + Vector((0, 0.87, 0.24)), white),
    ], "task1Body")
    out += [adopt(empty("task1", p), cam), cam]

    # task 2 (name: task2): a cable run along the lab with one clamp hanging loose
    p = Vector((0.75, surface_y(iss, 0.75, 2.4, lab_top), 2.4))
    cable = mat("Cable", "#d8d2c4", rough=0.8)
    clamp = join([
        cyl(0.03, 2.2, p + Vector((0, 0.05, 0.2)), cable, axis="z", segs=10),
        cyl(0.03, 2.2, p + Vector((0.09, 0.05, 0.2)), cable, axis="z", segs=10),
        box((0.26, 0.09, 0.09), p + Vector((0.045, 0.06, 0.9)), gold, bevel=0.015),
        box((0.26, 0.09, 0.09), p + Vector((0.045, 0.06, -0.5)), gold, bevel=0.015),
        box((0.26, 0.05, 0.09), p + Vector((0.2, 0.2, 0.2)), gold, bevel=0.015),  # the loose one, lifted and askew
        ring(0.16, 0.03, p + Vector((0.045, 0.16, 0.2)), cable, axis="z", segs=16, tube=6),
    ], "task2Body")
    out += [adopt(empty("task2", p), clamp), clamp]

    # task 3 (name: task3): the open tray of material samples on the truss
    p = Vector((8.0, truss_r, 0.0))
    swatches = ["#c9a24a", "#e9ecf1", "#1b1e25", "#4bb3a4", "#b9482f", "#8f97a6"]
    tray = [box((0.7, 0.06, 0.5), p + Vector((0, 0.05, 0)), dark, bevel=0.015), box((0.7, 0.5, 0.05), p + Vector((0, 0.3, -0.27)), dark, bevel=0.015)]
    for i in range(4):
        for j in range(3):
            c = swatches[(i * 3 + j) % len(swatches)]
            sw = mat("Swatch" + c, c, rough=0.4, metal=0.5 if c in ("#c9a24a", "#8f97a6") else 0.0)
            tray.append(box((0.13, 0.012, 0.11), p + Vector((-0.24 + i * 0.16, 0.086, -0.14 + j * 0.14)), sw))
            tray.append(box((0.13, 0.11, 0.012), p + Vector((-0.24 + i * 0.16, 0.14 + j * 0.14, -0.24)), sw))
    tray = join(tray, "task3Body")
    tool = import_glb("pistol_grip_tool.glb", INCH)
    tool.location = p + Vector((0.6, 0.16, 0.1))
    out += [adopt(empty("task3", p), tray, tool), tray, tool]

    preview("exterior_cam", (-4, 8.5, 17), (0, 2, 0), color="MATERIAL")
    preview("exterior_site", (-2.5, 6.5, 9.5), (0, 2, 2.5), color="MATERIAL", lens=30)
    preview("exterior_far", (-30, 34, 80), (0, 0, -8), color="MATERIAL")
    export(out, "exterior.glb")


# ----------------------------------------------------------------------------- interior (modelled here)
W = 2.3  # one rack bay along the module
BAYS = [-6.0, -3.6, -1.2, 1.2, 3.6, 6.0]


class Face:
    """One long inner face of the module. Local axes: u along the module, v across the face, n into the cabin."""

    def __init__(self, cx, cy, normal, u_sign=1):
        self.N = Vector(normal).normalized()
        self.U = Vector((0, 0, u_sign))
        self.V = self.N.cross(self.U)
        self.c = Vector((cx, cy, 0))
        self.sign = u_sign

    def M(self, z, u=0.0, v=0.0, n=0.0):
        p = self.c + self.U * (z * self.sign + u) + self.V * v + self.N * n
        U, V, N = self.U, self.V, self.N
        return Matrix(((U.x, V.x, N.x, p.x), (U.y, V.y, N.y, p.y), (U.z, V.z, N.z, p.z), (0, 0, 0, 1)))

    def put(self, ob, z, u=0.0, v=0.0, n=0.0):
        ob.matrix_world = self.M(z, u, v, n)
        return ob

    def box(self, z, u, v, size, m, n0=0.0, bevel=0.0, smooth=False, segs=2):
        return self.put(box(size, m=m, bevel=bevel, smooth=smooth, segs=segs), z, u, v, n0 + size[2] / 2)

    def cyl(self, z, u, v, r, h, m, n0=0.0, axis="z", segs=14):
        return self.put(cyl(r, h, m=m, axis=axis, segs=segs), z, u, v, n0 + (h / 2 if axis == "z" else r))

    def handrail(self, z, u, v, length, along="v"):
        rail = MATS["HandrailBlue"]
        post = (0.035, 0.035, 0.09)
        d = length / 2 - 0.05
        ends = [(u, v - d), (u, v + d)] if along == "v" else [(u - d, v), (u + d, v)]
        return [
            self.put(cyl(0.02, length, m=rail, axis="y" if along == "v" else "x", segs=10), z, u, v, 0.115),
            *[self.box(z, eu, ev, post, rail, n0=0.02) for eu, ev in ends],
        ]


def interior_materials():
    return {
        "seam": mat("Seam", "#232831", rough=0.8),
        "panel": mat("PanelWhite", "#e3e6ec", rough=0.55, metal=0.05),
        "panelGrey": mat("PanelGrey", "#b4bbc8", rough=0.5, metal=0.15),
        "dark": mat("DarkMetal", "#333a48", rough=0.45, metal=0.6),
        "metal": mat("Metal", "#9aa4b6", rough=0.35, metal=0.85),
        "rail": mat("HandrailBlue", "#2a63c9", rough=0.35, metal=0.7),
        "yellow": mat("TapeYellow", "#e4b93a", rough=0.6),
        "tapeBlue": mat("TapeBlue", "#3f7fe0", rough=0.6),
        "tapeGreen": mat("TapeGreen", "#3fbf7f", rough=0.6),
        "fabric": mat("FabricWhite", "#ece9e2", rough=0.95),
        "fabricBeige": mat("FabricBeige", "#cfc5b0", rough=0.95),
        "strap": mat("Strap", "#2c313b", rough=0.9),
        "screen": mat("Screen", "#0d1522", rough=0.25, emit="#5cc8ff", strength=2.2),
        "glass": mat("DarkGlass", "#14233d", rough=0.08, metal=0.4, emit="#16345c", strength=0.6),
        "ledGreen": mat("LedGreen", "#0c2a1c", emit="#3ee6a0", strength=3.5),
        "ledCyan": mat("LedCyan", "#0c2230", emit="#5cc8ff", strength=3.5),
        "ledAmber": mat("LedAmber", "#30260c", emit="#ffcc4d", strength=3.5),
        "light": mat("LightStrip", "#ffffff", rough=0.4, emit="#eaf3ff", strength=1.6),  # name: scene3d.ts drives its colour
    }


LEDS = ["ledGreen", "ledGreen", "ledCyan", "ledAmber"]


def rack(face, z, kind, H, M_):
    """The front of one rack bay. H is how far the face runs across (v)."""
    o = []
    add = o.append
    add(face.box(z, 0, 0, (W + 0.1, H, 0.02), M_["seam"]))
    panel = lambda m="panel": add(face.box(z, 0, 0, (W - 0.04, H - 0.06, 0.05), M_[m], n0=0.02, bevel=0.012))

    if kind == "plain":
        panel()
        for u in (-0.62, 0.62):
            add(face.box(z, u, 0, (0.05, H - 0.3, 0.012), M_["dark"], n0=0.07))  # seat tracks
        add(face.box(z, 0.82, H / 2 - 0.24, (0.3, 0.12, 0.006), M_["yellow"], n0=0.07))

    elif kind == "lockers":
        cols, rows = 2, (4 if H > 3 else 3)
        cw, rh = (W - 0.04) / cols, (H - 0.06) / rows
        for c in range(cols):
            for r in range(rows):
                u, v = -W / 2 + 0.02 + cw * (c + 0.5), -H / 2 + 0.03 + rh * (r + 0.5)
                add(face.box(z, u, v, (cw - 0.04, rh - 0.04, 0.06), M_["panel"], n0=0.02, bevel=0.014))
                add(face.box(z, u, v - rh * 0.28, (0.34, 0.035, 0.03), M_["dark"], n0=0.08))
                add(face.box(z, u - cw * 0.3, v + rh * 0.3, (0.14, 0.05, 0.005), M_[rnd.choice(["tapeBlue", "yellow", "tapeGreen"])], n0=0.08))

    elif kind == "avionics":
        panel("panelGrey")
        add(face.box(z, -0.45, H * 0.27, (1.12, 0.52, 0.012), M_["dark"], n0=0.07))
        for i in range(8):
            add(face.box(z, -0.45, H * 0.27 - 0.21 + i * 0.06, (1.02, 0.022, 0.025), M_["metal"], n0=0.08))
        add(face.box(z, 0.64, H * 0.27, (0.62, 0.42, 0.03), M_["dark"], n0=0.07, bevel=0.008))
        add(face.box(z, 0.64, H * 0.27, (0.54, 0.34, 0.006), M_["screen"], n0=0.1))
        for row in range(2):
            for i in range(10):
                add(face.box(z, -0.9 + i * 0.2, -0.04 - row * 0.14, (0.05, 0.05, 0.02), M_[rnd.choice(LEDS)], n0=0.07))
        add(face.box(z, 0, -H * 0.3, (1.9, 0.52, 0.03), M_["panel"], n0=0.07, bevel=0.01))
        for i in range(5):
            add(face.cyl(z, -0.7 + i * 0.35, -H * 0.3, 0.05, 0.05, M_["metal"], n0=0.1))
        o += face.handrail(z, -1.04, 0, min(1.4, H - 0.6)) + face.handrail(z, 1.04, 0, min(1.4, H - 0.6))

    elif kind == "stowage":
        panel()
        v = -H / 2 + 0.12
        while v < H / 2 - 0.5:
            bh = min(rnd.uniform(0.5, 0.75), H / 2 - 0.1 - v)
            u = -W / 2 + 0.1
            while u < W / 2 - 0.45:
                bw = min(rnd.uniform(0.55, 0.95), W / 2 - 0.08 - u)
                dep = rnd.uniform(0.2, 0.36)
                fab = M_[rnd.choice(["fabric", "fabric", "fabricBeige"])]
                add(face.box(z, u + bw / 2, v + bh / 2, (bw - 0.05, bh - 0.05, dep), fab, n0=0.06, bevel=0.06, smooth=True, segs=3))
                for s in (-0.22, 0.22):
                    add(face.box(z, u + bw / 2 + bw * s, v + bh / 2, (0.045, bh - 0.04, dep + 0.012), M_["strap"], n0=0.06))
                add(face.box(z, u + bw / 2, v + bh / 2, (0.14, 0.08, 0.005), M_[rnd.choice(["tapeBlue", "yellow", "tapeGreen"])], n0=0.06 + dep))
                u += bw
            v += bh

    elif kind == "laptop":
        panel("panelGrey")
        for r in range(2):  # two drawers below
            add(face.box(z, 0, -H / 2 + 0.3 + r * 0.5, (W - 0.2, 0.44, 0.05), M_["panel"], n0=0.07, bevel=0.012))
            add(face.box(z, 0, -H / 2 + 0.17 + r * 0.5, (0.4, 0.035, 0.03), M_["dark"], n0=0.12))
        add(face.cyl(z, 0.2, 0.45, 0.025, 0.32, M_["metal"], n0=0.07))
        add(face.box(z, 0.2, 0.55, (0.52, 0.36, 0.02), M_["dark"], n0=0.39, bevel=0.006))
        add(face.box(z, 0.2, 0.55, (0.47, 0.31, 0.004), M_["screen"], n0=0.41))
        add(face.box(z, 0.2, 0.36, (0.52, 0.02, 0.32), M_["dark"], n0=0.39, bevel=0.006))
        add(face.box(z, -0.7, 0.6, (0.5, 0.7, 0.012), M_["yellow"], n0=0.07))  # procedures sheet
        o += face.handrail(z, 0, H / 2 - 0.25, 1.2, along="u")

    elif kind == "glovebox":
        panel()
        add(face.box(z, 0, 0.38, (1.56, 0.96, 0.03), M_["dark"], n0=0.07, bevel=0.01))
        add(face.box(z, 0, 0.38, (1.4, 0.8, 0.012), M_["glass"], n0=0.1))
        for u in (-0.38, 0.38):
            add(face.cyl(z, u, -0.45, 0.18, 0.06, M_["metal"], n0=0.07, segs=20))
            add(face.cyl(z, u, -0.45, 0.135, 0.065, M_["strap"], n0=0.07, segs=20))
        for i in range(6):
            add(face.box(z, -0.5 + i * 0.2, -0.9, (0.05, 0.05, 0.02), M_[rnd.choice(LEDS)], n0=0.07))
        o += face.handrail(z, -1.0, 0.3, 1.0) + face.handrail(z, 1.0, 0.3, 1.0)

    elif kind in ("standoff", "standoffLit", "standoffLow"):
        add(face.box(z, 0, 0, (W - 0.04, H - 0.05, 0.04), M_["panelGrey"], n0=0.02, bevel=0.01))
        add(face.box(z, 0, -H / 2 + 0.1, (W, 0.08, 0.03), M_["dark"], n0=0.06))  # cable tray
        if kind == "standoffLit":
            add(face.box(z, 0, 0.08, (W - 0.5, 0.2, 0.02), M_["light"], n0=0.06))
        elif kind == "standoffLow":
            for i in range(5):
                add(face.box(z, -0.5, -0.08 + i * 0.07, (0.8, 0.025, 0.02), M_["dark"], n0=0.06))  # return-air grille
            add(face.box(z, 0.6, 0.1, (0.5, 0.1, 0.006), M_["yellow"], n0=0.06))
    return o


def wall_with_hole(z, facing, m, cx=0.0, cy=-0.6, r=0.93, hw=2.45, hh=2.55, segs=40):
    """An end wall with a round hatch opening."""
    bm = bmesh.new()
    inner, outer = [], []
    for i in range(segs):
        t = 2 * math.pi * i / segs
        c, s = math.cos(t), math.sin(t)
        k = min((hw - cx) / c if c > 1e-6 else ((-hw - cx) / c if c < -1e-6 else 1e9), (hh - cy) / s if s > 1e-6 else ((-hh - cy) / s if s < -1e-6 else 1e9))
        inner.append(bm.verts.new((cx + r * c, cy + r * s, z)))
        outer.append(bm.verts.new((cx + k * c, cy + k * s, z)))
    for i in range(segs):
        j = (i + 1) % segs
        f = bm.faces.new((inner[i], outer[i], outer[j], inner[j]))
        if facing < 0:
            f.normal_flip()
    return new_obj("wall", bm, m)


def hatch_door(M_, lamp_name=None):
    """A round hatch door facing +Z, centred on its own middle. Returns its parts."""
    door = [
        cyl(0.88, 0.06, (0, 0, 0), M_["panel"], axis="z", segs=36),
        ring(0.82, 0.035, (0, 0, 0.03), M_["metal"]),
        box((1.5, 0.06, 0.03), (0, 0, 0.04), M_["panelGrey"], bevel=0.008),
        box((0.06, 1.5, 0.03), (0, 0, 0.04), M_["panelGrey"], bevel=0.008),
        ring(0.3, 0.035, (0, 0, 0.11), M_["yellow"], segs=20),
        cyl(0.05, 0.12, (0, 0, 0.07), M_["dark"], axis="z"),
        box((0.56, 0.035, 0.03), (0, 0, 0.11), M_["yellow"]),
        box((0.035, 0.56, 0.03), (0, 0, 0.11), M_["yellow"]),
        cyl(0.13, 0.03, (0.45, -0.45, 0.04), M_["dark"], axis="z"),
        cyl(0.1, 0.035, (0.45, -0.45, 0.04), M_["glass"], axis="z"),
    ]
    return door


def build_interior():
    reset()
    M_ = interior_materials()
    HW, HF = 2.3, 2.45  # wall and floor/ceiling distance from the axis
    faces = {
        "right": (Face(HW, 0, (-1, 0, 0), 1), 3.4),
        "left": (Face(-HW, 0, (1, 0, 0), -1), 3.4),
        "floor": (Face(0, -HF, (0, 1, 0), 1), 3.1),
        "ceiling": (Face(0, HF, (0, -1, 0), 1), 3.1),
        "ur": (Face(1.975, 2.075, (-1, -1, 0), 1), 0.98),
        "ul": (Face(-1.975, 2.075, (1, -1, 0), 1), 0.98),
        "lr": (Face(1.975, -2.075, (-1, 1, 0), 1), 0.98),
        "ll": (Face(-1.975, -2.075, (1, 1, 0), 1), 0.98),
    }
    layout = {  # one entry per bay, far end (z = -6) first; "plain" where a prop sits
        "right": ["stowage", "plain", "avionics", "plain", "laptop", "lockers"],
        "left": ["lockers", "plain", "glovebox", "plain", "avionics", "stowage"],
        "floor": ["plain", "lockers", "plain", "plain", "lockers", "plain"],
        "ceiling": ["plain"] * 6,
        "ur": ["standoffLit", "standoff", "standoffLit", "standoff", "standoffLit", "standoffLit"],  # windows in bays 2 and 4
        "ul": ["standoffLit"] * 6,
        "lr": ["standoffLow"] * 6,
        "ll": ["standoffLow"] * 6,
    }
    shell = []
    for name, (face, H) in faces.items():
        for z, kind in zip(BAYS, layout[name]):
            shell += rack(face, z, kind, H, M_)
    ceil = faces["ceiling"][0]
    for z in (-4.8, 0.0, 4.8):  # the big ceiling lights
        shell.append(ceil.box(z, 0, 0, (2.3, 1.3, 0.05), M_["dark"], n0=0.07, bevel=0.01))
        shell.append(ceil.box(z, 0, 0, (2.16, 1.16, 0.02), M_["light"], n0=0.12))
    for name in ("right", "left"):  # blue handrails at the bay seams
        face = faces[name][0]
        for z in (-4.8, 0.0, 4.8):
            shell += face.handrail(z, 0, 0.5, 1.1)
    floor = faces["floor"][0]
    for z in (-2.4, 2.4):  # foot restraints
        shell += floor.handrail(z, 0, 0.6, 0.5, along="u") + floor.handrail(z, 0, -0.6, 0.5, along="u")

    # end walls: the far one has the working hatch, the near one a closed hatch
    shell.append(wall_with_hole(-8.0, 1, M_["panelGrey"]))
    shell.append(box((4.95, 5.15, 0.1), (0, 0, 8.05), M_["panelGrey"]))
    for zz, s in ((-7.97, 1), (7.97, -1)):
        for x in (-1.75, 1.75):
            shell.append(box((0.7, 3.0, 0.05), (x, 0.3, zz), M_["panel"], bevel=0.012))
            shell.append(box((0.035, 1.2, 0.035), (x * 0.83, -0.6, zz + 0.1 * s), M_["rail"]))
            for dy in (-0.55, 0.55):
                shell.append(box((0.035, 0.035, 0.1), (x * 0.83, -0.6 + dy, zz + 0.05 * s), M_["rail"]))
        shell.append(box((2.6, 0.9, 0.05), (0, 1.75, zz), M_["panel"], bevel=0.012))
        shell.append(box((1.1, 0.16, 0.02), (0, 1.75, zz + 0.04 * s), M_["ledGreen"]))  # exit sign bar
    near = [o for o in hatch_door(M_)] + [ring(0.95, 0.12, (0, 0, 0), M_["metal"]), ring(1.1, 0.04, (0, 0, -0.03), M_["dark"])]
    near = join(near, "nearHatch")
    transform(near, Matrix.Translation((0, -0.6, 7.93)) @ Matrix.Rotation(math.pi, 4, "Y"))
    shell.append(near)

    # NASA gear strapped to the walls, for scale and realism
    bag = import_glb("crew_lock_bag.glb", INCH * 1.4)
    transform(bag, Matrix.Translation((-2.12, 0.9, 5.2)) @ Matrix.Rotation(math.pi / 2, 4, "Y"))
    tool = import_glb("pistol_grip_tool.glb", INCH * 1.3)
    transform(tool, Matrix.Translation((2.14, 0.35, 2.75)) @ Matrix.Rotation(-math.pi / 2, 4, "Y") @ Matrix.Rotation(0.4, 4, "X"))
    decor = [bag, tool]

    shell = join(shell, "shell")
    refine(shell)
    out, baked = [shell, *decor], [shell]

    def prop(name, at, body_parts, moving=()):
        """A clickable prop: an empty at its position, one merged body, plus named moving parts."""
        body = join(body_parts, name + "Body")
        refine(body, 0.4, 2)
        baked.append(body)
        root = adopt(empty(name, at), body, *moving)
        out.extend([root, body, *moving])
        return root

    # ---- CO2 scrubber (name: scrubber, scrubberFan, scrubberLed), on the right wall
    p = Vector((2.05, -0.6, 1.2))
    L = lambda x, y, z: p + Vector((x, y, z))
    body = [
        box((0.5, 1.6, 1.0), L(0, 0, 0), mat("ScrubberBody", "#566175", rough=0.45, metal=0.5), bevel=0.035),
        box((0.03, 1.36, 0.84), L(-0.255, 0, 0), M_["panelGrey"], bevel=0.01),
        *[box((0.035, 0.05, 0.7), L(-0.275, 0.56 - i * 0.11, 0), M_["dark"]) for i in range(5)],
        ring(0.28, 0.035, L(-0.275, -0.42, 0), M_["metal"], axis="x", segs=24),
        cyl(0.26, 0.02, L(-0.262, -0.42, 0), M_["dark"], axis="x", segs=24),
        box((0.012, 0.09, 0.84), L(-0.272, 0.02, 0), M_["yellow"]),
        cyl(0.07, 0.5, L(0.05, 1.0, -0.25), M_["metal"], segs=12),
        cyl(0.07, 0.5, L(0.05, 1.0, 0.25), M_["metal"], segs=12),
        box((0.035, 1.0, 0.035), L(-0.33, 0.05, 0.46), M_["rail"]),
        box((0.035, 1.0, 0.035), L(-0.33, 0.05, -0.46), M_["rail"]),
        *[box((0.1, 0.035, 0.035), L(-0.29, y, zz), M_["rail"]) for y in (-0.42, 0.52) for zz in (-0.46, 0.46)],
    ]
    blades = []
    for k in range(3):  # three bars through the hub make six pitched blades; the fan spins about its own X
        b = box((0.02, 0.44, 0.1), (0, 0, 0), M_["metal"])
        b.data.transform(Matrix.Rotation(k * math.pi / 3, 4, "X") @ Matrix.Rotation(0.35, 4, "Y"))
        blades.append(b)
    fan = join([cyl(0.06, 0.06, (0, 0, 0), M_["metal"], axis="x", segs=12), *blades], "scrubberFan")
    fan.location = L(-0.285, -0.42, 0)
    led = ball(0.055, L(-0.275, 0.7, 0.34), mat("ScrubberLed", "#300c0a", emit="#ff3b2f", strength=4), name="scrubberLed", segs=10)
    prop("scrubber", p, body, (fan, led))

    # ---- medical kit (name: medKit), on the right wall
    p = Vector((2.1, 0.85, -3.6))
    red = mat("MedRed", "#cf3a3a", rough=0.9)
    white = mat("MedWhite", "#ffffff", rough=0.7)
    prop("medKit", p, [
        box((0.36, 0.5, 0.66), L(0, 0, 0), red, bevel=0.06, smooth=True, segs=3),
        box((0.02, 0.3, 0.085), L(-0.185, 0, 0), white),
        box((0.02, 0.085, 0.3), L(-0.185, 0, 0), white),
        box((0.375, 0.04, 0.675), L(0, 0.14, 0), M_["strap"]),
        box((0.375, 0.04, 0.675), L(0, -0.14, 0), M_["strap"]),
        box((0.1, 0.07, 0.2), L(-0.17, 0.3, 0), M_["dark"], bevel=0.015),  # carry handle
        box((0.08, 0.62, 0.8), L(0.16, 0, 0), M_["panelGrey"], bevel=0.012),  # wall bracket
    ])

    # ---- water unit (name: waterUnit, water, waterGlass), on the left wall
    p = Vector((-2.0, -0.4, 1.2))
    cap = mat("WaterCap", "#465066", rough=0.4, metal=0.6)
    glass = cyl(0.34, 1.2, L(0, 0, 0), mat("WaterGlass", "#bfe6ff", rough=0.05, alpha=0.22), segs=24, caps=False, name="waterGlass")
    water = cyl(0.3, 1.1, L(0, 0, 0), mat("Water", "#3aa8ff", rough=0.1, emit="#0d4a80", strength=1, alpha=0.85), segs=24, name="water")
    prop("waterUnit", p, [
        cyl(0.37, 0.14, L(0, -0.67, 0), cap, segs=24),
        cyl(0.37, 0.14, L(0, 0.67, 0), cap, segs=24),
        cyl(0.2, 0.06, L(0, 0.77, 0), M_["metal"], segs=16),
        ring(0.355, 0.02, L(0, 0.3, 0), M_["metal"], axis="y", segs=24, tube=6),
        ring(0.355, 0.02, L(0, -0.3, 0), M_["metal"], axis="y", segs=24, tube=6),
        box((0.2, 0.12, 0.18), L(0.33, 0.18, 0), M_["dark"], bevel=0.02),
        cyl(0.022, 0.16, L(0.4, 0.06, 0), M_["metal"], segs=8),
        box((0.1, 1.5, 0.56), L(-0.27, 0, 0), M_["panelGrey"], bevel=0.012),
        box((0.14, 0.1, 0.1), L(-0.2, 0.67, 0), cap),
        box((0.14, 0.1, 0.1), L(-0.2, -0.67, 0), cap),
        box((0.02, 0.2, 0.3), L(-0.21, 0, 0.0), M_["tapeBlue"]),
    ], (glass, water))

    # ---- sleep station (name: bed), on the left wall
    p = Vector((-2.0, -0.2, -3.6))
    bagc = mat("SleepBag", "#5546ad", rough=0.95)
    prop("bed", p, [
        box((0.5, 2.1, 0.8), L(0, 0, 0), bagc, bevel=0.2, smooth=True, segs=4),
        *[box((0.52, 0.05, 0.82), L(0, y, 0), M_["strap"]) for y in (-0.6, 0.0, 0.6)],
        box((0.2, 0.3, 0.5), L(0.12, 1.02, 0), mat("Pillow", "#d3d8e4", rough=0.95), bevel=0.07, smooth=True, segs=3),
        box((0.06, 2.5, 1.2), L(-0.27, 0.1, 0), M_["panelGrey"], bevel=0.012),
        box((0.04, 0.2, 0.3), L(-0.22, 1.2, 0.35), M_["screen"]),  # a photo from home
        box((0.06, 0.08, 0.16), L(-0.2, 1.25, -0.35), mat("ReadingLight", "#fff3d6", emit="#ffd9a0", strength=2.5)),
    ])

    # ---- hatch (name: hatch, hatchDoor, hatchLamp) in the far wall, with the room behind it
    p = Vector((0, -0.6, -7.95))
    frame = [ring(0.95, 0.12, p, M_["metal"], segs=40), ring(1.12, 0.04, p + Vector((0, 0, -0.02)), M_["dark"], segs=40)]
    frame += [cyl(0.035, 0.05, p + Vector((math.cos(t) * 1.12, math.sin(t) * 1.12, 0.02)), M_["metal"], axis="z", segs=8) for t in [i * math.pi / 6 for i in range(12)]]
    door = join(hatch_door(M_), "hatchDoorBody")
    lamp = disc(0.12, (0, 0.55, 0.075), mat("HatchLamp", "#0c2230", emit="#5cc8ff", strength=3), name="hatchLamp", segs=18)
    hinge = empty("hatchDoor", p + Vector((-0.9, 0, 0)))
    door.location = p
    lamp.location = p + Vector((0, 0.55, 0.075))
    adopt(hinge, door, lamp)
    refine(door, 0.4, 2)
    baked.append(door)
    prop("hatch", p, frame, (hinge,))
    out.extend([door, lamp])

    # the room behind the hatch (name: shelter, shelterBags): the storm shelter, or the way to the next module
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((2.6, 2.6, 2.6)), verts=bm.verts)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context="FACES")
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    room = new_obj("shelter", bm, mat("ShelterWall", "#3a4a63", rough=0.8), at=(0, -0.6, -9.33))
    refine(room, 0.5, 3)
    bags = [box((0.62, 0.72, 0.3), (-0.82 + (i % 3) * 0.82, -1.25 + (i // 3) * 0.8, -10.42), mat("WaterBag", "#4b86c6", rough=0.7), bevel=0.08, smooth=True, segs=3) for i in range(9)]
    bags += [box((0.3, 0.72, 0.62), (-1.1, -1.25 + i * 0.8, -9.3 - 0.35 + (i % 2) * 0.7), MATS["WaterBag"], bevel=0.08, smooth=True, segs=3) for i in range(3)]
    bags = join(bags, "shelterBags")
    out += [room, bags]
    baked += [room, bags]

    # ---- windows (name: window1, window2, windowGlass1, windowGlass2, shade) in the upper right standoff
    ur = faces["ur"][0]
    for i, z in enumerate((-3.6, 1.2), start=1):
        m = ur.M(z, 0, 0, 0.045)
        root = empty(f"window{i}", matrix=m)
        fr = join([ring(0.4, 0.05, (0, 0, 0), M_["metal"], segs=28), ring(0.47, 0.02, (0, 0, -0.01), M_["dark"], segs=28), cyl(0.44, 0.03, (0, 0, -0.03), M_["dark"], axis="z", segs=28)], f"window{i}Frame")
        fr.matrix_world = m
        gl = disc(0.37, name=f"windowGlass{i}", m=mat("WindowGlass", "#0a1020", rough=0.05, emit="#9fb6ff", strength=0.4))
        gl.matrix_world = m @ Matrix.Translation((0, 0, 0.012))
        kids = [fr, gl]
        if i == 2:
            sh = disc(0.385, name="shade", m=mat("Shade", "#3b4150", rough=0.9))
            sh.matrix_world = m @ Matrix.Translation((0, 0, 0.03))
            kids.append(sh)
        adopt(root, *kids)
        baked.append(fr)
        out.extend([root, *kids])

    bake_ao(baked)
    bpy.context.scene.render.engine = "BLENDER_WORKBENCH"
    preview("interior_cam", (0.6, 0.6, 6.2), (0, -0.3, -0.5), color="MATERIAL", lens=16)
    preview("interior_ao", (0.6, 0.6, 6.2), (0, -0.3, -0.5), color="VERTEX", lens=16)
    preview("interior_right", (-1.6, 0.2, 2.6), (2.3, -0.3, 0.2), color="MATERIAL", lens=18)
    preview("interior_left", (1.6, 0.2, 2.2), (-2.3, -0.3, -1.2), color="MATERIAL", lens=18)
    preview("interior_hatch", (0.5, 0.2, -3.4), (0, -0.6, -8), color="MATERIAL", lens=18)
    preview("interior_back", (0, 0.2, -5.5), (0, -0.2, 8), color="MATERIAL", lens=16)
    export(out, "interior.glb", colors=True)


if __name__ == "__main__":
    what = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "all"
    if what in ("astronaut", "all"):
        build_astronaut()
    if what in ("exterior", "all"):
        build_exterior()
    if what in ("interior", "all"):
        build_interior()
