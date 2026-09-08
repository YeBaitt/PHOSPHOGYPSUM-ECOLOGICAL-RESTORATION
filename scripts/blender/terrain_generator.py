"""Deterministic engineering terrain meshes for the five restoration stages."""

import math
import random

import bpy

from drainage import create_cover_cap, create_drainage, create_restoration_plants
from materials import assign_material, create_stage_materials
from roads import create_compaction_details, create_haul_roads, create_slope_rills


STAGE_IDS = ('pit', 'liner', 'stack', 'cover', 'restoration')
ANGULAR_SEGMENTS = 192
BASE_RADIUS_X = 54.0
BASE_RADIUS_Y = 44.0


def _collection_for_stage(stage_id):
    name = f'Phosphogypsum_{stage_id}'
    existing = bpy.data.collections.get(name)
    if existing:
        bpy.data.collections.remove(existing)
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def _ring(scale, height, ring_index, seed):
    randomizer = random.Random(seed + ring_index * 97)
    phase = randomizer.uniform(-0.18, 0.18)
    center_x = math.sin(ring_index * 1.7) * min(1.3, ring_index * 0.22)
    center_y = math.cos(ring_index * 1.3) * min(0.9, ring_index * 0.16)
    points = []
    for index in range(ANGULAR_SEGMENTS):
        angle = math.tau * index / ANGULAR_SEGMENTS
        radius_noise = (
            1.0
            + 0.075 * math.sin(3.0 * angle + 0.6 + phase)
            + 0.042 * math.sin(7.0 * angle - 0.4)
            + 0.022 * math.sin(11.0 * angle + 1.1)
            + 0.045 * max(0.0, math.cos(angle - 2.35)) ** 4
            - 0.040 * max(0.0, math.cos(angle + 0.72)) ** 6
        )
        x = center_x + BASE_RADIUS_X * scale * radius_noise * math.cos(angle)
        y = center_y + BASE_RADIUS_Y * scale * (
            1.0 + 0.02 * math.sin(5.0 * angle + phase)
        ) * math.sin(angle)
        surface_noise = (
            0.035 * math.sin(angle * 13.0 + ring_index)
            + 0.022 * math.cos(angle * 19.0 - ring_index * 0.7)
        )
        points.append((x, y, height + surface_noise))
    return points


def _mesh_object(name, vertices, faces, collection, smooth=False):
    mesh = bpy.data.meshes.new(f'{name}Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
    return obj


def _ring_strip(name, outer, inner, collection, smooth=False):
    vertices = outer + inner
    faces = []
    count = len(outer)
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    return _mesh_object(name, vertices, faces, collection, smooth)


def _toe_transition(stage_id, collection, seed):
    stage_colors = {
        'stack': (0.28, 0.285, 0.28, 1.0),
        'cover': (0.36, 0.31, 0.24, 1.0),
        'restoration': (0.20, 0.29, 0.12, 1.0),
    }
    soil = (0.145, 0.068, 0.026, 1.0)
    blend_weights = (0.0, 0.90, 1.0, 1.0)
    rings = [_ring(0.96, 0.16, 0, seed)] + [
        _ring(scale, height, 20 + index, seed)
        for index, (scale, height) in enumerate(
            ((1.10, 0.12), (1.20, 0.08), (1.30, 0.04)), start=1
        )
    ]
    vertices = [point for ring in rings for point in ring]
    faces = []
    for ring_index in range(len(rings) - 1):
        offset = ring_index * ANGULAR_SEGMENTS
        following_offset = (ring_index + 1) * ANGULAR_SEGMENTS
        for index in range(ANGULAR_SEGMENTS):
            following = (index + 1) % ANGULAR_SEGMENTS
            faces.append((offset + index, offset + following,
                          following_offset + following, following_offset + index))
    obj = _mesh_object(f'{stage_id.title()}ToeTransition', vertices, faces,
                       collection, smooth=True)
    colors = obj.data.color_attributes.new(
        name='ToeGradient', type='BYTE_COLOR', domain='POINT',
    )
    inner = stage_colors[stage_id]
    for ring_index in range(len(rings)):
        blend = blend_weights[ring_index]
        color = tuple(inner[channel] * (1.0 - blend) + soil[channel] * blend
                      for channel in range(4))
        for index in range(ANGULAR_SEGMENTS):
            colors.data[ring_index * ANGULAR_SEGMENTS + index].color = color
    return obj


def _disk(name, ring, collection, location_z=None):
    average_z = sum(point[2] for point in ring) / len(ring)
    if location_z is None:
        vertices = [(0.0, 0.0, average_z)] + ring
    else:
        vertices = [(0.0, 0.0, 0.0)] + [
            (x, y, z - average_z) for x, y, z in ring
        ]
    faces = []
    for index in range(len(ring)):
        current = index + 1
        following = (index + 1) % len(ring) + 1
        faces.append((0, current, following))
    obj = _mesh_object(name, vertices, faces, collection, smooth=False)
    if location_z is not None:
        obj.location.z = location_z
    return obj


def _create_stack_body(collection, seed, stage_id):
    lift = {'stack': 0.0, 'cover': 0.18, 'restoration': 0.28}[stage_id]
    levels = [
        (1.00, 0.20), (0.88, 2.20), (0.82, 2.20),
        (0.70, 4.30), (0.64, 4.30), (0.53, 6.40),
        (0.47, 6.40), (0.37, 8.40), (0.31, 8.40),
    ]
    rings = [
        _ring(scale, height + lift, index, seed)
        for index, (scale, height) in enumerate(levels)
    ]
    prefix = {'stack': 'Stack', 'cover': 'Cover', 'restoration': 'Restoration'}[stage_id]
    for level in range(4):
        slope_outer = level * 2
        _ring_strip(
            f'{prefix}Slope{level + 1:02d}',
            rings[slope_outer], rings[slope_outer + 1], collection, smooth=True,
        )
        _ring_strip(
            f'{prefix}Bench{level + 1:02d}',
            rings[slope_outer + 1], rings[slope_outer + 2], collection,
        )
    top_name = 'StackTop' if stage_id == 'stack' else f'{prefix}Top'
    _disk(top_name, rings[-1], collection)
    if stage_id == 'stack':
        _create_working_cells(collection, seed, lift)


def _create_working_cell(name, location, radius_x, radius_y, height,
                         collection, seed):
    segments = 64
    lower = []
    upper = []
    randomizer = random.Random(seed)
    phase = randomizer.uniform(-0.3, 0.3)
    for index in range(segments):
        angle = math.tau * index / segments
        noise = 1.0 + 0.07 * math.sin(3 * angle + phase) + 0.035 * math.sin(7 * angle)
        lower.append((radius_x * noise * math.cos(angle),
                      radius_y * noise * math.sin(angle), 0.0))
        upper.append((radius_x * 0.78 * noise * math.cos(angle) + 0.25,
                      radius_y * 0.74 * noise * math.sin(angle) - 0.18, height))
    vertices = lower + upper + [(0.25, -0.18, height + 0.025)]
    faces = []
    for index in range(segments):
        following = (index + 1) % segments
        faces.append((index, following, segments + following, segments + index))
        faces.append((segments * 2, segments + index, segments + following))
    obj = _mesh_object(name, vertices, faces, collection, smooth=False)
    obj.location = location
    return obj


def _create_working_cells(collection, seed, lift):
    _create_working_cell(
        'WorkingCellWest', (-7.2, 1.8, 8.47 + lift),
        8.4, 6.1, 0.62, collection, seed + 170,
    )
    _create_working_cell(
        'WorkingCellEast', (7.0, -2.2, 8.47 + lift),
        6.5, 8.0, 0.44, collection, seed + 290,
    )


def _create_pit_body(collection, seed, stage_id):
    outer = _ring(1.00, 0.10, 0, seed)
    shoulder_outer = _ring(1.18, 0.08, 3, seed)
    floor_ring = _ring(0.55, -4.10, 2, seed)
    _ring_strip('PitShoulder', shoulder_outer, outer, collection, smooth=True)
    _ring_strip('Geomembrane' if stage_id == 'liner' else 'PitSlope',
                outer, floor_ring, collection, smooth=True)
    _disk('LinerFloor' if stage_id == 'liner' else 'PitFloor',
          floor_ring, collection, location_z=-4.10)


def _normalized_distance(x, y):
    return math.hypot(x / BASE_RADIUS_X, y / BASE_RADIUS_Y)


def _stack_height(x, y, lift=0.0):
    distance = _normalized_distance(x, y)
    if distance <= 0.37:
        return 8.40 + lift
    if distance <= 0.47:
        return 8.40 - (distance - 0.37) / 0.10 * 2.00 + lift
    if distance <= 0.53:
        return 6.40 + lift
    if distance <= 0.64:
        return 6.40 - (distance - 0.53) / 0.11 * 2.10 + lift
    if distance <= 0.70:
        return 4.30 + lift
    if distance <= 0.82:
        return 4.30 - (distance - 0.70) / 0.12 * 2.10 + lift
    if distance <= 0.88:
        return 2.20 + lift
    if distance <= 1.0:
        return 2.20 - (distance - 0.88) / 0.12 * 2.00 + lift
    return 0.20 * max(0.0, 1.15 - distance) / 0.15


def _pit_height(x, y):
    distance = _normalized_distance(x, y)
    if distance <= 0.55:
        return -4.10
    if distance <= 0.90:
        return -4.10 + (distance - 0.55) / 0.35 * 4.20
    return 0.10


def create_site_terrain(stage_id, seed=7639):
    """Create and return one stage collection in the active Blender scene."""
    if stage_id not in STAGE_IDS:
        raise ValueError(f'Unknown stage: {stage_id}')
    collection = _collection_for_stage(stage_id)
    if stage_id in ('pit', 'liner'):
        _create_pit_body(collection, seed, stage_id)
        height_sampler = _pit_height
    else:
        _create_stack_body(collection, seed, stage_id)
        _toe_transition(stage_id, collection, seed)
        lift = {'stack': 0.0, 'cover': 0.18, 'restoration': 0.28}[stage_id]
        height_sampler = lambda x, y: _stack_height(x, y, lift)

    materials = create_stage_materials(stage_id)
    for obj in collection.objects:
        if hasattr(obj.data, 'materials'):
            material = materials['body']
            if obj.name == 'PitShoulder':
                material = materials['rock_soil']
            elif obj.name.endswith('ToeTransition'):
                material = materials['toe_gradient']
            if stage_id == 'stack':
                if 'Bench' in obj.name or obj.name == 'StackTop':
                    material = materials['gypsum_light']
                elif 'Slope' in obj.name or 'WorkingCell' in obj.name:
                    material = materials['gypsum_shadow']
            assign_material(obj, material)

    if stage_id == 'stack':
        create_haul_roads(stage_id, height_sampler, collection, materials)
        create_compaction_details(stage_id, height_sampler, collection, materials)
        create_slope_rills(stage_id, height_sampler, collection, materials)
    if stage_id == 'cover':
        create_cover_cap(height_sampler, collection, materials)
    elif stage_id == 'restoration':
        create_restoration_plants(height_sampler, collection, materials, seed)
    return collection
