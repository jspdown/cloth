import semiExplicitEulerComputeShaderCode from "./shaders/semi_explicit_euler.compute.wgsl"
import applyConstraintComputeShaderCode from "./shaders/apply_constraint.compute.wgsl"
import updatePositionComputeShaderCode from "./shaders/update_position.compute.wgsl"
import updateNormalComputeShaderCode from "./shaders/update_normal.compute.wgsl"

import * as vec3 from "../math/vector3"
import {Vector3} from "../math/vector3"

import {Cloth} from "./cloth"

const u32Size = 4

export interface SolverConfig {
    deltaTime?: number,
    subSteps?: number,
    gravity?: Vector3,
    relaxation?: number,
}

interface PhysicObject {
    cloth: Cloth

    eulerBindGroup: GPUBindGroup
    constraintBindGroup: GPUBindGroup
    positionBindGroup: GPUBindGroup
    normalBindGroup: GPUBindGroup
    colorBindGroup: GPUBindGroup
}

export class Solver {
    private config: SolverConfig
    private readonly device: GPUDevice

    private readonly objects: PhysicObject[]

    private readonly configBuffer: GPUBuffer
    private readonly configBindGroup: GPUBindGroup

    private readonly colorBindGroupLayout: GPUBindGroupLayout

    private readonly applyConstraintPipeline: GPUComputePipeline
    private readonly semiExplicitEulerPipeline: GPUComputePipeline
    private readonly updatePositionPipeline: GPUComputePipeline
    private readonly updateNormalPipeline: GPUComputePipeline

    constructor(config: SolverConfig, device: GPUDevice) {
        this.device = device
        this.config = {
            deltaTime: 1/60,
            subSteps: 10,
            gravity: vec3.create(0, -9.8, 0),
            relaxation: 1,

            ...config,
        }
        this.objects = []

        const configData = new Float32Array([
            this.config.gravity.x, this.config.gravity.y, this.config.gravity.z,
            this.config.deltaTime / this.config.subSteps,
        ])
        this.configBuffer = this.device.createBuffer({
            label: "config",
            size: fourBytesAlignment(configData.byteLength),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        const configLayout = device.createBindGroupLayout({
            label: "config",
            entries: [
                {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
            ],
        })
        this.configBindGroup = this.device.createBindGroup({
            label: "config",
            layout: configLayout,
            entries: [
                { binding: 0, resource: { buffer: this.configBuffer } },
            ],
        })
        this.writeAllBuffer(this.configBuffer, configData)

        this.colorBindGroupLayout = device.createBindGroupLayout({
            label: "current-color",
            entries: [
                {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform", hasDynamicOffset: true } },
            ],
        })

        const applyConstraintShaderModule = device.createShaderModule({ code: applyConstraintComputeShaderCode })
        const semiExplicitEulerShaderModule = device.createShaderModule({ code: semiExplicitEulerComputeShaderCode })
        const updatePositionShaderModule = device.createShaderModule({ code: updatePositionComputeShaderCode })
        const updateNormalShaderModule = device.createShaderModule({ code: updateNormalComputeShaderCode })

        this.semiExplicitEulerPipeline = device.createComputePipeline({
            label: "semi-explicit-euler",
            layout: device.createPipelineLayout({
                label: "semi-explicit-euler",
                bindGroupLayouts: [
                    device.createBindGroupLayout({
                        label: "semi-explicit-euler",
                        entries: [
                            {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                            {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                            {binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                        ],
                    }),
                    configLayout,
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
                    device.createBindGroupLayout({
                        label: "apply-constraint",
                        entries: [
                            {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                            {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                        ],
                    }),
                    configLayout,
                    this.colorBindGroupLayout,
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
                    device.createBindGroupLayout({
                        label: "update-position",
                        entries: [
                            {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                            {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                        ],
                    }),
                    configLayout,
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
                    device.createBindGroupLayout({
                        label: "update-normal",
                        entries: [
                            {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                        ],
                    }),
                ],
            }),
            compute: {
                module: updateNormalShaderModule,
                entryPoint: "update_normal",
            },
        })
    }

    public async solve(): Promise<void> {
        for (let object of this.objects) {
            const encoder = this.device.createCommandEncoder()

            encoder.clearBuffer(object.cloth.geometry.normalBuffer)

            for (let subStep = 0; subStep < this.config.subSteps; subStep++) {
                this.semiExplicitEuler(encoder, object)
                this.applyConstraints(encoder, object)
                this.updatePositions(encoder, object)
            }

            this.updateNormals(encoder, object)

            this.device.queue.submit([encoder.finish()])

            await this.device.queue.onSubmittedWorkDone()
        }
    }

    private semiExplicitEuler(encoder: GPUCommandEncoder, object: PhysicObject) {
        const passEncoder = encoder.beginComputePass()

        passEncoder.setPipeline(this.semiExplicitEulerPipeline)
        passEncoder.setBindGroup(0, object.eulerBindGroup)
        passEncoder.setBindGroup(1, this.configBindGroup)

        const dispatch = Math.sqrt(object.cloth.particles.count)
        const dispatchX = Math.ceil(dispatch/16)
        const dispatchY = Math.ceil(dispatch/16)

        passEncoder.dispatchWorkgroups(dispatchX, dispatchY)

        passEncoder.end()
    }

    private applyConstraints(encoder: GPUCommandEncoder, object: PhysicObject) {
        const passEncoder = encoder.beginComputePass()

        passEncoder.setPipeline(this.applyConstraintPipeline)
        passEncoder.setBindGroup(0, object.constraintBindGroup)
        passEncoder.setBindGroup(1, this.configBindGroup)

        for (let i = 0; i < object.cloth.constraints.colorCount; i++) {
            passEncoder.setBindGroup(2, object.colorBindGroup, [i*256])

            const dispatch = Math.sqrt(object.cloth.constraints.colors[i*64+1])
            const dispatchX = Math.ceil(dispatch/16)
            const dispatchY = Math.ceil(dispatch/16)

            passEncoder.dispatchWorkgroups(dispatchX, dispatchY)
        }

        passEncoder.end()
    }

    private updatePositions(encoder: GPUCommandEncoder, object: PhysicObject) {
        const passEncoder = encoder.beginComputePass()

        passEncoder.setPipeline(this.updatePositionPipeline)
        passEncoder.setBindGroup(0, object.positionBindGroup)
        passEncoder.setBindGroup(1, this.configBindGroup)

        const dispatch = Math.sqrt(object.cloth.particles.count)
        const dispatchX = Math.ceil(dispatch/16)
        const dispatchY = Math.ceil(dispatch/16)

        passEncoder.dispatchWorkgroups(dispatchX, dispatchY)

        passEncoder.end()
    }

    private updateNormals(encoder: GPUCommandEncoder, object: PhysicObject) {
        let passEncoder = encoder.beginComputePass()

        passEncoder.setPipeline(this.updateNormalPipeline)
        passEncoder.setBindGroup(0, object.normalBindGroup)

        let dispatch = Math.sqrt(object.cloth.geometry.indexes.length/3)
        let dispatchX = Math.ceil(dispatch/16)
        let dispatchY = Math.ceil(dispatch/16)

        passEncoder.dispatchWorkgroups(dispatchX, dispatchY)
        passEncoder.end()
    }

    public add(cloth: Cloth): void {
        cloth.particles.upload()
        cloth.constraints.upload()

        const eulerBindGroup = this.device.createBindGroup({
            layout: this.semiExplicitEulerPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: cloth.geometry.positionBuffer } },
                { binding: 1, resource: { buffer: cloth.particles.estimatedPositionBuffer } },
                { binding: 2, resource: { buffer: cloth.particles.velocityBuffer } },
                { binding: 3, resource: { buffer: cloth.particles.inverseMassBuffer } },
            ],
        })
        const constraintBindGroup = this.device.createBindGroup({
            layout: this.applyConstraintPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: cloth.particles.estimatedPositionBuffer } },
                { binding: 1, resource: { buffer: cloth.particles.inverseMassBuffer } },
                { binding: 2, resource: { buffer: cloth.constraints.restValueBuffer } },
                { binding: 3, resource: { buffer: cloth.constraints.complianceBuffer } },
                { binding: 4, resource: { buffer: cloth.constraints.affectedParticleBuffer } },
            ],
        })
        const positionBindGroup = this.device.createBindGroup({
            layout: this.updatePositionPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: cloth.geometry.positionBuffer } },
                { binding: 1, resource: { buffer: cloth.particles.estimatedPositionBuffer } },
                { binding: 2, resource: { buffer: cloth.particles.velocityBuffer } },
            ],
        })
        const normalBindGroup = this.device.createBindGroup({
            layout: this.updateNormalPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: cloth.geometry.positionBuffer } },
                { binding: 1, resource: { buffer: cloth.geometry.indexBuffer } },
                { binding: 2, resource: { buffer: cloth.geometry.normalBuffer } },
            ],
        })
        const colorBindGroup = this.device.createBindGroup({
            layout: this.colorBindGroupLayout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: cloth.constraints.colorBuffer,
                    size: 8,
                    offset: 0
                }
            }],
        })

        this.objects.push({
            cloth,

            eulerBindGroup,
            constraintBindGroup,
            positionBindGroup,
            normalBindGroup,
            colorBindGroup,
        })
    }

    writeAllBuffer(buffer: GPUBuffer, data: Float32Array|Uint32Array): void {
        this.device.queue.writeBuffer(buffer, 0, data, 0, data.length)
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
