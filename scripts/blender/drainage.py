"""Drainage, liner seams, cover cap and low-cost restoration vegetation."""

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

from materials import assign_material
from roads import create_ribbon


def _new_bmesh_object(name, collection, material, builder):
    mesh = bpy.data.meshes.new(f'{name}Mesh')
    bm = bmesh.new()
    builder(bm)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    assign_material(obj, material)
    return obj


def create_drainage(stage_id, height_sampler, collection, materials):
    objects = []
    if stage_id == 'pit':
        points = [(-44, 24), (-24, 31), (0, 34), (25, 30), (43, 20)]
        objects.append(create_ribbon(
            'ToeDrain', points, 1.2, height_sampler, collection, materials['drain'], 0.045,
        ))
    if stage_id == 'liner':
        seam_vertices = []
        seam_faces = []
        for row, y in enumerate((-17.0, -8.5, 0.0, 8.5, 17.0)):
            offset = len(seam_vertices)
            for x in (-28.0, 0.0, 28.0):
                z = height_sampler(x, y) + 0.07
                seam_vertices.extend([(x, y - 0.10, z), (x, y + 0.10, z)])
            seam_faces.extend([
                (offset, offset + 2, offset + 3, offset + 1),
                (offset + 2, offset + 4, offset + 5, offset + 3),
            ])
        mesh = bpy.data.meshes.new('LinerSeamsMesh')
        mesh.from_pydata(seam_vertices, [], seam_faces)
        mesh.update(calc_edges=True)
        seams = bpy.data.objects.new('LinerSeams', mesh)
        collection.objects.link(seams)
        assign_material(seams, materials['drain'])
        objects.append(seams)

        curve = bpy.data.curves.new('DrainagePipeCurve', type='CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = 0.42
        curve.bevel_resolution = 2
        spline = curve.splines.new('POLY')
        pipe_points = [(-25, -16), (-12, -8), (0, 0), (18, 9), (37, 16)]
        spline.points.add(len(pipe_points) - 1)
        for point, (x, y) in zip(spline.points, pipe_points):
            point.co = (x, y, height_sampler(x, y) + 0.24, 1.0)
        pipe = bpy.data.objects.new('DrainagePipe', curve)
        collection.objects.link(pipe)
        pipe.data.materials.append(materials['drain'])
        objects.append(pipe)
    return objects


def create_cover_cap(height_sampler, collection, materials):
    def build(bm):
        result = bmesh.ops.create_circle(bm, cap_ends=True, segments=96, radius=16.4)
        for vertex in result['verts']:
            vertex.co.z = height_sampler(vertex.co.x, vertex.co.y) + 0.055
    return _new_bmesh_object('CoverSoil', collection, materials['cover'], build)


def _patches(height_sampler, collection, materials, randomizer):
    def build(bm):
        for index in range(22):
            angle = randomizer.random() * math.tau
            radius = 7.0 + randomizer.random() * 31.0
            x, y = math.cos(angle) * radius, math.sin(angle) * radius * 0.76
            scale_x = 2.6 + randomizer.random() * 5.2
            scale_y = 2.0 + randomizer.random() * 3.6
            result = bmesh.ops.create_circle(bm, cap_ends=True, segments=10, radius=1.0)
            for vertex in result['verts']:
                vertex.co.x = vertex.co.x * scale_x + x
                vertex.co.y = vertex.co.y * scale_y + y
                vertex.co.z = height_sampler(vertex.co.x, vertex.co.y) + 0.10
    return _new_bmesh_object('VegetationPatches', collection, materials['grass'], build)


def _clustered_plants(name, count, height_sampler, collection, material,
                      randomizer, tree=False):
    def build(bm):
        placed = 0
        while placed < count:
            x = randomizer.uniform(-39.0, 39.0)
            y = randomizer.uniform(-29.0, 29.0)
            distance = math.hypot(x / 50.0, y / 40.0)
            road_corridor = abs(y - (-10.0 + x * 0.17)) < 3.8
            if distance > 0.82 or road_corridor:
                continue
            z = height_sampler(x, y)
            if tree:
                trunk_height = randomizer.uniform(1.2, 2.0)
                bmesh.ops.create_cone(
                    bm, cap_ends=True, segments=5, radius1=0.15,
                    radius2=0.11, depth=trunk_height,
                    matrix=Matrix.Translation(Vector((x, y, z + trunk_height / 2))),
                )
                bmesh.ops.create_cone(
                    bm, cap_ends=True, segments=6, radius1=randomizer.uniform(0.7, 1.1),
                    radius2=0.10, depth=randomizer.uniform(1.5, 2.2),
                    matrix=Matrix.Translation(Vector((x, y, z + trunk_height + 0.7))),
                )
            else:
                scale = randomizer.uniform(0.45, 0.9)
                bmesh.ops.create_icosphere(
                    bm, subdivisions=1, radius=scale,
                    matrix=Matrix.Translation(Vector((x, y, z + scale * 0.65))),
                )
            placed += 1
    return _new_bmesh_object(name, collection, material, build)


def create_restoration_plants(height_sampler, collection, materials, seed):
    randomizer = random.Random(seed + 4401)
    return [
        _patches(height_sampler, collection, materials, randomizer),
        _clustered_plants('Shrubs', 90, height_sampler, collection,
                          materials['shrub'], randomizer),
        _clustered_plants('YoungTrees', 24, height_sampler, collection,
                          materials['tree'], randomizer, tree=True),
    ]

