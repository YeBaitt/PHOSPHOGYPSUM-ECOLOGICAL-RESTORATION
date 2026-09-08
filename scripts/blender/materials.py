"""Local procedural PBR materials used by generated stage assets."""

import bpy


MATERIAL_SPECS = {
    'gypsum': ((0.28, 0.285, 0.28, 1.0), 0.94, 0.13),
    'gypsum_light': ((0.36, 0.355, 0.34, 1.0), 0.91, 0.09),
    'gypsum_shadow': ((0.27, 0.275, 0.27, 1.0), 0.97, 0.16),
    'liner': ((0.022, 0.029, 0.033, 1.0), 0.78, 0.07),
    'rock_soil': ((0.16, 0.10, 0.065, 1.0), 0.96, 0.15),
    'cover': ((0.36, 0.31, 0.24, 1.0), 0.94, 0.13),
    'road': ((0.07, 0.075, 0.075, 1.0), 0.99, 0.12),
    'drain': ((0.16, 0.18, 0.18, 1.0), 0.90, 0.08),
    'track': ((0.22, 0.20, 0.17, 1.0), 1.00, 0.09),
    'grass': ((0.20, 0.29, 0.12, 1.0), 0.97, 0.09),
    'shrub': ((0.12, 0.23, 0.07, 1.0), 0.96, 0.08),
    'tree': ((0.10, 0.20, 0.055, 1.0), 0.95, 0.07),
    'trunk': ((0.20, 0.13, 0.07, 1.0), 1.00, 0.04),
}


def _material(key):
    name = f'PG_{key}'
    existing = bpy.data.materials.get(name)
    color, roughness, bump_strength = MATERIAL_SPECS[key]
    material = existing or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get('Principled BSDF')
    if principled is None:
        nodes.clear()
        principled = nodes.new('ShaderNodeBsdfPrincipled')
        principled.name = 'Principled BSDF'
        output = nodes.new('ShaderNodeOutputMaterial')
        links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    for node in list(nodes):
        if node.name in {'Fine Surface Grain', 'Subtle Compacted Grain'}:
            nodes.remove(node)
    principled.inputs['Base Color'].default_value = color
    principled.inputs['Roughness'].default_value = roughness
    noise = nodes.new('ShaderNodeTexNoise')
    noise.name = 'Fine Surface Grain'
    noise.inputs['Scale'].default_value = 7.5
    noise.inputs['Detail'].default_value = 2.2
    noise.inputs['Roughness'].default_value = 0.68
    bump = nodes.new('ShaderNodeBump')
    bump.name = 'Subtle Compacted Grain'
    bump.inputs['Strength'].default_value = bump_strength
    bump.inputs['Distance'].default_value = 0.08
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], principled.inputs['Normal'])
    return material


def create_stage_materials(stage_id):
    body_key = {
        'pit': 'rock_soil',
        'liner': 'liner',
        'stack': 'gypsum',
        'cover': 'cover',
        'restoration': 'grass',
    }[stage_id]
    keys = {
        body_key, 'rock_soil', 'road', 'drain', 'track', 'gypsum_light', 'gypsum_shadow',
        'grass', 'shrub', 'tree', 'trunk',
    }
    return {'body': _material(body_key), **{key: _material(key) for key in keys}}


def assign_material(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)
