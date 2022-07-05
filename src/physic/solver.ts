import semiExplicitEulerComputeShaderCode from "./shaders/semi_explicit_euler.compute.wgsl"
import applyConstraintComputeShaderCode from "./shaders/apply_constraint.compute.wgsl"
import updatePositionComputeShaderCode from "./shaders/update_position.compute.wgsl"
import updateNormalComputeShaderCode from "./shaders/update_normal.compute.wgsl"

import * as vec3 from "../math/vector3"
import {Vector3} from "../math/vector3"

import {Particles} from "./particles"
import {Constraints} from "./constraints"
import {Geometry} from "../geometry"

const semiExplicitEulerLayoutDesc: GPUBindGroupLayoutDescriptor = {
    label: "semi-explicit-euler",
    entries: [
        {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        {binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
    ],
}
const applyConstraintLayoutDesc: GPUBindGroupLayoutDescriptor = {
    label: "apply-constraint",
    entries: [
        {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        {binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        {binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
    ],
}
const updatePositionLayoutDesc: GPUBindGroupLayoutDescriptor = {
    label: "update-position",
    entries: [
        {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
    ],
}
const updateNormalLayoutDesc: GPUBindGroupLayoutDescriptor = {
    label: "update-normal",
    entries: [
        {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
    ],
}
const currentColorLayoutDesc: GPUBindGroupLayoutDescriptor = {
    label: "current-color",
    entries: [
        {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform", hasDynamicOffset: true } },
    ],
}
const configLayoutDesc: GPUBindGroupLayoutDescriptor = {
    label: "config",
    entries: [
        {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
    ],
}

export interface SolverConfig {
    deltaTime?: number,
    subSteps?: number,
    gravity?: Vector3,
    relaxation?: number,
}

interface PhysicObject {
    id: string

    geometry: Geometry
    particles: Particles
    constraints: Constraints
}

export class Solver {
    private config: SolverConfig

    private readonly device: GPUDevice
    private readonly objectStates: Record<string, PhysicObjectState>

    private readonly configBuffer: GPUBuffer
    private readonly configBindGroup: GPUBindGroup

    private readonly applyConstraintPipeline: GPUComputePipeline
    private readonly semiExplicitEulerPipeline: GPUComputePipeline
    private readonly updatePositionPipeline: GPUComputePipeline
    private readonly updateNormalPipeline: GPUComputePipeline

    constructor(device: GPUDevice, config: SolverConfig) {
        this.device = device
        this.objectStates = {}
        this.config = {
            deltaTime: 1/60,
            subSteps: 10,
            gravity: vec3.create(0, -9.8, 0),
            relaxation: 1,

            ...config,
        }

        const configData = new Float32Array([
            this.config.gravity.x, this.config.gravity.y, this.config.gravity.z,
            this.config.deltaTime / this.config.subSteps,
        ])
        this.configBuffer = this.device.createBuffer({
            label: "config",
            size: fourBytesAlignment(configData.byteLength),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        this.configBindGroup = this.device.createBindGroup({
            label: "config",
            layout: device.createBindGroupLayout(configLayoutDesc),
            entries: [
                { binding: 0, resource: { buffer: this.configBuffer } },
            ],
        })
        this.device.queue.writeBuffer(
            this.configBuffer, 0,
            configData, 0,
            configData.length)

        const applyConstraintShaderModule = device.createShaderModule({ code: applyConstraintComputeShaderCode })
        const semiExplicitEulerShaderModule = device.createShaderModule({ code: semiExplicitEulerComputeShaderCode })
        const updatePositionShaderModule = device.createShaderModule({ code: updatePositionComputeShaderCode })
        const updateNormalShaderModule = device.createShaderModule({ code: updateNormalComputeShaderCode })

        this.semiExplicitEulerPipeline = device.createComputePipeline({
            label: "semi-explicit-euler",
            layout: device.createPipelineLayout({
                label: "semi-explicit-euler",
                bindGroupLayouts: [
                    device.createBindGroupLayout(semiExplicitEulerLayoutDesc),
                    device.createBindGroupLayout(configLayoutDesc),
                ],
            }),
            compute: {
                module: semiExplicitEulerShaderModule,
                entryPoint: "main",
            },
        })
        this.applyConstraintPipeline = device.createComputePipeline({
            label: "apply-constraint",
            layout: device.createPipelineLayout({
                label: "apply-constraint",
                bindGroupLayouts: [
                    device.createBindGroupLayout(applyConstraintLayoutDesc),
                    device.createBindGroupLayout(configLayoutDesc),
                    device.createBindGroupLayout(currentColorLayoutDesc),
                ],
            }),
            compute: {
                module: applyConstraintShaderModule,
                entryPoint: "main",
            },
        })
        this.updatePositionPipeline = device.createComputePipeline({
            label: "update-position",
            layout: device.createPipelineLayout({
                label: "update-position",
                bindGroupLayouts: [
                    device.createBindGroupLayout(updatePositionLayoutDesc),
                    device.createBindGroupLayout(configLayoutDesc),
                ],
            }),
            compute: {
                module: updatePositionShaderModule,
                entryPoint: "main",
            },
        })
        this.updateNormalPipeline = device.createComputePipeline({
            label: "update-normal",
            layout: device.createPipelineLayout({
                label: "update-normal",
                bindGroupLayouts: [
                    device.createBindGroupLayout(updateNormalLayoutDesc),
                ],
            }),
            compute: {
                module: updateNormalShaderModule,
                entryPoint: "main",
            },
        })
    }

    public solve(encoder: GPUCommandEncoder, object: PhysicObject) {
        let state = this.objectStates[object.id]
        if (!state) {
            state = new PhysicObjectState(this.device, object)
            this.objectStates[object.id] = state
        }

        encoder.clearBuffer(object.geometry.vertices.normalBuffer)

        const passEncoder = encoder.beginComputePass()
        passEncoder.setBindGroup(1, this.configBindGroup)

        for (let subStep = 0; subStep < this.config.subSteps; subStep++) {
            this.semiExplicitEuler(passEncoder, object, state)
            this.applyConstraints(passEncoder, object, state)
            this.updatePositions(passEncoder, object, state)
        }

        this.updateNormals(passEncoder, object, state)

        passEncoder.end()
    }

    private semiExplicitEuler(encoder: GPUComputePassEncoder, object: PhysicObject, state: PhysicObjectState) {
        encoder.setPipeline(this.semiExplicitEulerPipeline)
        encoder.setBindGroup(0, state.semiExplicitEulerBindGroup)

        const dispatch = Math.sqrt(object.particles.count)
        const dispatchX = Math.ceil(dispatch/16)
        const dispatchY = Math.ceil(dispatch/16)

        encoder.dispatchWorkgroups(dispatchX, dispatchY)
    }

    private applyConstraints(encoder: GPUComputePassEncoder, object: PhysicObject, state: PhysicObjectState) {
        encoder.setPipeline(this.applyConstraintPipeline)
        encoder.setBindGroup(0, state.applyConstraintBindGroup)
        encoder.setBindGroup(1, this.configBindGroup)

        for (let i = 0; i < object.constraints.colorCount; i++) {
            encoder.setBindGroup(2, state.currentColorBindGroup, [i*256])

            const dispatch = Math.sqrt(object.constraints.count)
            const dispatchX = Math.ceil(dispatch/16)
            const dispatchY = Math.ceil(dispatch/16)

            encoder.dispatchWorkgroups(dispatchX, dispatchY)
        }
    }

    private updatePositions(encoder: GPUComputePassEncoder, object: PhysicObject, state: PhysicObjectState) {
        encoder.setPipeline(this.updatePositionPipeline)
        encoder.setBindGroup(0, state.updatePositionBindGroup)
        encoder.setBindGroup(1, this.configBindGroup)

        const dispatch = Math.sqrt(object.particles.count)
        const dispatchX = Math.ceil(dispatch/16)
        const dispatchY = Math.ceil(dispatch/16)

        encoder.dispatchWorkgroups(dispatchX, dispatchY)
    }

    private updateNormals(encoder: GPUComputePassEncoder, object: PhysicObject, state: PhysicObjectState) {
        encoder.setPipeline(this.updateNormalPipeline)
        encoder.setBindGroup(0, state.updateNormalBindGroup)

        let dispatch = Math.sqrt(object.geometry.triangles.count)
        let dispatchX = Math.ceil(dispatch/16)
        let dispatchY = Math.ceil(dispatch/16)

        encoder.dispatchWorkgroups(dispatchX, dispatchY)
    }
}

class PhysicObjectState {
    public readonly semiExplicitEulerBindGroup: GPUBindGroup
    public readonly applyConstraintBindGroup: GPUBindGroup
    public readonly updatePositionBindGroup: GPUBindGroup
    public readonly updateNormalBindGroup: GPUBindGroup
    public readonly currentColorBindGroup: GPUBindGroup

    constructor(device: GPUDevice, object: PhysicObject) {
        this.semiExplicitEulerBindGroup = device.createBindGroup({
            label: "semi-explicit-euler",
            layout: device.createBindGroupLayout(semiExplicitEulerLayoutDesc),
            entries: [
                { binding: 0, resource: { buffer: object.geometry.vertices.positionBuffer } },
                { binding: 1, resource: { buffer: object.particles.estimatedPositionBuffer } },
                { binding: 2, resource: { buffer: object.particles.velocityBuffer } },
                { binding: 3, resource: { buffer: object.particles.inverseMassBuffer } },
            ],
        })
        this.applyConstraintBindGroup = device.createBindGroup({
            label: "apply-constraint",
            layout: device.createBindGroupLayout(applyConstraintLayoutDesc),
            entries: [
                { binding: 0, resource: { buffer: object.particles.estimatedPositionBuffer } },
                { binding: 1, resource: { buffer: object.particles.inverseMassBuffer } },
                { binding: 2, resource: { buffer: object.constraints.restValueBuffer } },
                { binding: 3, resource: { buffer: object.constraints.complianceBuffer } },
                { binding: 4, resource: { buffer: object.constraints.affectedParticleBuffer } },
            ],
        })
        this.updatePositionBindGroup = device.createBindGroup({
            label: "update-position",
            layout: device.createBindGroupLayout(updatePositionLayoutDesc),
            entries: [
                { binding: 0, resource: { buffer: object.geometry.vertices.positionBuffer } },
                { binding: 1, resource: { buffer: object.particles.estimatedPositionBuffer } },
                { binding: 2, resource: { buffer: object.particles.velocityBuffer } },
            ],
        })
        this.updateNormalBindGroup = device.createBindGroup({
            label: "update-normal",
            layout: device.createBindGroupLayout(updateNormalLayoutDesc),
            entries: [
                { binding: 0, resource: { buffer: object.geometry.vertices.positionBuffer } },
                { binding: 1, resource: { buffer: object.geometry.triangles.indexBuffer } },
                { binding: 2, resource: { buffer: object.geometry.vertices.normalBuffer } },
            ],
        })
        this.currentColorBindGroup = device.createBindGroup({
            label: "current-color",
            layout: device.createBindGroupLayout(currentColorLayoutDesc),
            entries: [{
                binding: 0,
                resource: {
                    buffer: object.constraints.colorBuffer,
                    size: 8,
                    offset: 0
                }
            }],
        })
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
