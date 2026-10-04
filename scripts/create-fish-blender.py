"""Run with Blender --background --python scripts/create-fish-blender.py.

Authors the original koi mesh, deform rig and looping action in Blender, then
samples Blender's evaluated animation for the small offline WebGL player.
"""
import bpy
import bmesh
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets-source' / 'fish'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
bpy.context.preferences.filepaths.save_version = 0
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 24
verts, faces, slots = [], [], []

def point(x, y, z):
    verts.append((x, y, z))
    return len(verts) - 1

def face(indices, material=0):
    faces.append(indices)
    slots.append(material)

# Blender coordinates: +X nose, Y lateral, Z up. Closed, softly faceted body.
xs = [.51, .42, .29, .12, -.06, -.24, -.39, -.51, -.59]
rs = [.018, .09, .145, .168, .154, .117, .071, .033, .018]
rings = []
for x, r in zip(xs, rs):
    rings.append([point(x, math.sin(j * math.tau / 12) * r,
                        math.cos(j * math.tau / 12) * r * .76) for j in range(12)])
for i in range(len(rings) - 1):
    for j in range(12):
        k = (j + 1) % 12
        patch = (i in (1, 2) and j in (0, 1, 2, 11)) or (i in (4, 5) and j in (8, 9, 10, 11))
        face((rings[i][j], rings[i + 1][j], rings[i + 1][k], rings[i][k]), 1 if patch else 0)
face(tuple(reversed(rings[0])))
face(tuple(rings[-1]))
# Broad forked tail, separate rays, pectoral fins and a dorsal sail.
tailroot = point(-.57, 0, 0)
tail = [point(-.92, .235, .014), point(-.88, .10, .006), point(-.79, 0, 0),
        point(-.88, -.10, .006), point(-.92, -.235, .014)]
for a, b in zip(tail, tail[1:]):
    face((tailroot, a, b), 2)
for sign in (-1, 1):
    fin = [point(.13, sign * .10, -.018), point(-.11, sign * .31, -.047),
           point(-.20, sign * .16, -.033)]
    face(tuple(fin if sign == 1 else reversed(fin)), 2)
face((point(.11, 0, .13), point(-.12, 0, .245), point(-.35, 0, .067)), 2)
# Small solid eyes, without textures or external dependencies.
for sign in (-1, 1):
    x, y, z, r = .397, sign * .077, .06, .018
    center = point(x, y, z + r)
    ring = [point(x + math.cos(j * math.tau / 8) * r,
                  y + math.sin(j * math.tau / 8) * r, z) for j in range(8)]
    for j in range(8):
        face((center, ring[j], ring[(j + 1) % 8]), 3)

mesh = bpy.data.meshes.new('Koi_HandBuiltMesh')
mesh.from_pydata(verts, [], faces)
mesh.update()
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
fish = bpy.data.objects.new('Garden_Koi', mesh)
scene.collection.objects.link(fish)
palette = [('Pearl', (.91, .86, .70, 1)), ('Vermilion', (.84, .28, .12, 1)),
           ('Fin_Ivory', (.82, .77, .55, 1)), ('Eye', (.025, .048, .038, 1))]
for name, color in palette:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    bsdf = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = .48
    fish.data.materials.append(mat)
for polygon, slot in zip(mesh.polygons, slots):
    polygon.material_index = slot

# A connected three-bone spine with soft weight transitions across the body.
armature = bpy.data.armatures.new('Koi_Spine')
rig = bpy.data.objects.new('Koi_Swim_Rig', armature)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
parent = None
for name, head, tail in [('Head', .51, .03), ('Body', .03, -.38), ('Tail', -.38, -.94)]:
    bone = armature.edit_bones.new(name)
    bone.head, bone.tail = (head, 0, 0), (tail, 0, 0)
    if parent:
        bone.parent, bone.use_connect = parent, True
    parent = bone
bpy.ops.object.mode_set(mode='OBJECT')
groups = [fish.vertex_groups.new(name=name) for name in ('Head', 'Body', 'Tail')]
for index, (x, y, z) in enumerate(verts):
    if x >= .12:
        weights = (1, 0, 0)
    elif x > -.24:
        t = (.12 - x) / .36
        weights = (1 - t, t, 0)
    elif x > -.58:
        t = (-.24 - x) / .34
        weights = (0, 1 - t, t)
    else:
        weights = (0, 0, 1)
    for group, weight in zip(groups, weights):
        if weight:
            group.add([index], weight, 'REPLACE')
modifier = fish.modifiers.new('Swim_Skin', 'ARMATURE')
modifier.object = rig
fish.parent = rig
rig.show_in_front = True
for frame in range(1, 26):
    phase = (frame - 1) / 24 * math.tau
    for name, amplitude, lag in [('Head', .025, 0), ('Body', .13, -.65), ('Tail', .34, -1.3)]:
        bone = rig.pose.bones[name]
        bone.rotation_mode = 'XYZ'
        bone.rotation_euler[2] = amplitude * math.sin(phase + lag)
        bone.keyframe_insert(data_path='rotation_euler', frame=frame, group=name)
rig.animation_data.action.name = 'Koi_Swim_Loop_1s'
fish['asset_origin'] = 'Original mesh, weighted spine and keyframed action authored in Blender'
fish['runtime_export'] = '24 evaluated poses; indexed topology; positions quantized to 1/10000 model unit'

# Bake the actual evaluated Blender mesh, not a separate web approximation.
mesh.calc_loop_triangles()
indices, materials = [], []
for triangle in mesh.loop_triangles:
    # Swapping Blender Y/Z to the renderer's up axis reverses handedness.
    indices.extend((triangle.vertices[0], triangle.vertices[2], triangle.vertices[1]))
    materials.append(mesh.polygons[triangle.polygon_index].material_index)
poses = []
for frame in range(1, 25):
    scene.frame_set(frame)
    evaluated = fish.evaluated_get(bpy.context.evaluated_depsgraph_get())
    posed = evaluated.to_mesh()
    poses.append([round(component * 10000) for vertex in posed.vertices
                  for component in (vertex.co.x, vertex.co.z, vertex.co.y)])
    evaluated.to_mesh_clear()
assert len(set(tuple(pose) for pose in poses)) == 24
asset = dict(origin='Blender Koi_Swim_Loop_1s', fps=24, scale=10000,
             vertexCount=len(verts), indices=indices, materials=materials, poses=poses)
(ROOT / 'src' / 'fish-asset.js').write_text(
    '// Generated by scripts/create-fish-blender.py from the evaluated Blender rig.\n'
    '(function(root){root.WaterFishAsset=' + json.dumps(asset, separators=(',', ':')) +
    ';if(typeof module!=="undefined"&&module.exports)module.exports=root.WaterFishAsset;'
    '}(typeof window!=="undefined"?window:global));\n', encoding='utf-8')

# Set up an attractive, editable source scene and a neutral asset preview.
scene.frame_set(5)
world = bpy.data.worlds.new('Studio')
scene.world = world
world.use_nodes = True
world.node_tree.nodes.clear()
background = world.node_tree.nodes.new('ShaderNodeBackground')
world_output = world.node_tree.nodes.new('ShaderNodeOutputWorld')
world.node_tree.links.new(background.outputs[0], world_output.inputs['Surface'])
background.inputs[0].default_value = (.07, .14, .13, 1)
background.inputs[1].default_value = .5
bpy.ops.object.camera_add(location=(1.25, -2.5, 3.8))
camera = bpy.context.object
camera.rotation_euler = (Vector((-.18, 0, 0)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 2.05
scene.camera = camera
bpy.ops.object.light_add(type='AREA', location=(0, -2, 4))
bpy.context.object.data.energy = 280
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 4
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x, scene.render.resolution_y = 900, 650
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
bpy.ops.object.select_all(action='DESELECT')
fish.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = fish
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'garden-koi.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'garden-koi.glb'), use_selection=True,
                          export_format='GLB', export_animations=True)
scene.render.filepath = str(OUT / 'garden-koi-preview.png')
bpy.ops.render.render(write_still=True)
print('KOI_EXPORT', json.dumps(dict(vertices=len(verts), triangles=len(materials), frames=len(poses))))
