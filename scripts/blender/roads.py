"""Terrain-following haul roads and compacted construction markings."""

import math

import bpy

from materials import assign_material


def create_ribbon(name, points, width, height_sampler, collection, material,
                  clearance=0.06):
    vertices = []
    faces = []
    for index, (x, y) in enumerate(points):
        previous = points[max(0, index - 1)]
        following = points[min(len(points) - 1, index + 1)]
        tangent_x = following[0] - previous[0]
        tangent_y = following[1] - previous[1]
        length = math.hypot(tangent_x, tangent_y) or 1.0
        normal_x, normal_y = -tangent_y / length, tangent_x / length
        for side in (-0.5, 0.5):
            px = x + normal_x * width * side
            py = y + normal_y * width * side
            vertices.append((px, py, height_sampler(px, py) + clearance))
        if index < len(points) - 1:
            left = index * 2
            faces.append((left, left + 2, left + 3, left + 1))
    mesh = bpy.data.meshes.new(f'{name}Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    assign_material(obj, material)
    return obj


def _interpolate_path(control_points, steps_per_segment=10):
    points = []
    for index in range(len(control_points) - 1):
        start, end = control_points[index], control_points[index + 1]
        for step in range(steps_per_segment):
            t = step / steps_per_segment
            eased = t * t * (3.0 - 2.0 * t)
            points.append((
                start[0] + (end[0] - start[0]) * eased,
                start[1] + (end[1] - start[1]) * eased,
            ))
    points.append(control_points[-1])
    return points


def create_haul_roads(stage_id, height_sampler, collection, materials):
    objects = []
    if stage_id == 'pit':
        path = _interpolate_path([(-50, -19), (-32, -13), (-18, -8), (-7, -3)])
        objects.append(create_ribbon(
            'PitAccessRoad', path, 7.0, height_sampler, collection, materials['road'],
        ))
    elif stage_id in ('stack', 'cover', 'restoration'):
        path = _interpolate_path([
            (-51, -20), (-42, -12), (-36, 5), (-27, 18),
            (-11, 23), (5, 19), (18, 10), (11, 2), (0, 7),
        ], 12)
        objects.append(create_ribbon(
            'HaulRoad' if stage_id == 'stack' else f'{stage_id.title()}HaulRoad',
            path, 5.6, height_sampler, collection, materials['road'], 0.16,
        ))
        bench_path = _interpolate_path([(-29, 2), (-20, 15), (0, 20), (21, 12), (27, 1)], 12)
        objects.append(create_ribbon(
            'BenchRoad' if stage_id == 'stack' else f'{stage_id.title()}BenchRoad',
            bench_path, 3.8, height_sampler, collection, materials['road'], 0.15,
        ))
    return objects


def create_compaction_details(stage_id, height_sampler, collection, materials):
    if stage_id not in ('stack', 'cover'):
        return []
    name = 'CompactionBands' if stage_id == 'stack' else 'CoverTracks'
    combined_vertices = []
    combined_faces = []
    for band in range(-7, 8):
        y = band * 1.25 - 0.8
        points = [(-14.0, y), (0.0, y + 0.35 * math.sin(band)), (14.0, y - 0.2)]
        offset = len(combined_vertices)
        temporary = []
        for x, py in points:
            temporary.extend([
                (x, py - 0.11, height_sampler(x, py) + 0.11),
                (x, py + 0.11, height_sampler(x, py) + 0.11),
            ])
        combined_vertices.extend(temporary)
        combined_faces.extend([
            (offset, offset + 2, offset + 3, offset + 1),
            (offset + 2, offset + 4, offset + 5, offset + 3),
        ])
    mesh = bpy.data.meshes.new(f'{name}Mesh')
    mesh.from_pydata(combined_vertices, [], combined_faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    assign_material(obj, materials['gypsum_shadow'] if stage_id == 'stack' else materials['track'])
    return [obj]


def create_slope_rills(stage_id, height_sampler, collection, materials):
    name = 'SlopeRills' if stage_id == 'stack' else 'CoverSlopeRills'
    vertices = []
    faces = []
    slope_ranges = ((0.89, 0.99), (0.71, 0.81), (0.54, 0.63), (0.38, 0.46))
    for rill_index in range(30):
        angle = math.tau * rill_index / 30.0 + 0.025 * math.sin(rill_index * 2.7)
        angular_half_width = 0.0025
        for outer_scale, inner_scale in slope_ranges:
            offset = len(vertices)
            for scale in (outer_scale, inner_scale):
                for side in (-1.0, 1.0):
                    sample_angle = angle + angular_half_width * side
                    x = 54.0 * scale * math.cos(sample_angle)
                    y = 44.0 * scale * math.sin(sample_angle)
                    vertices.append((x, y, height_sampler(x, y) + 0.13))
            faces.append((offset, offset + 2, offset + 3, offset + 1))
    mesh = bpy.data.meshes.new(f'{name}Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    assign_material(
        obj,
        materials['gypsum_shadow'] if stage_id == 'stack' else materials['track'],
    )
    return obj
