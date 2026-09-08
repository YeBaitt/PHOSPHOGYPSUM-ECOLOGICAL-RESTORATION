"""Deterministic engineering terrain meshes for the five restoration stages."""

import math
import random

import bpy


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
            + 0.045 * math.sin(3.0 * angle + 0.6 + phase)
            + 0.028 * math.sin(7.0 * angle - 0.4)
            + 0.014 * math.sin(11.0 * angle + 1.1)
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


def _create_pit_body(collection, seed, stage_id):
    outer = _ring(1.00, 0.10, 0, seed)
    rim_inner = _ring(0.90, 0.10, 1, seed)
    floor_ring = _ring(0.55, -4.10, 2, seed)
    _ring_strip('PitRim', outer, rim_inner, collection)
    _ring_strip('Geomembrane' if stage_id == 'liner' else 'PitSlope',
                rim_inner, floor_ring, collection, smooth=True)
    _disk('LinerFloor' if stage_id == 'liner' else 'PitFloor',
          floor_ring, collection, location_z=-4.10)


def create_site_terrain(stage_id, seed=7639):
    """Create and return one stage collection in the active Blender scene."""
    if stage_id not in STAGE_IDS:
        raise ValueError(f'Unknown stage: {stage_id}')
    collection = _collection_for_stage(stage_id)
    if stage_id in ('pit', 'liner'):
        _create_pit_body(collection, seed, stage_id)
    else:
        _create_stack_body(collection, seed, stage_id)
    return collection

