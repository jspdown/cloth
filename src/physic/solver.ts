import semiExplicitEulerComputeShaderCode from "./shaders/semi_explicit_euler.compute.wgsl"
import applyConstraintComputeShaderCode from "./shaders/apply_constraint.compute.wgsl"
import updatePositionComputeShaderCode from "./shaders/update_position.compute.wgsl"
import updateNormalComputeShaderCode from "./shaders/update_normal.compute.wgsl"

import * as vec3 from "../math/vector3"
import {Vector3} from "../math/vector3"

import {Cloth} from "./cloth"

const f32Size = 4
const u32Size = 4

export interface SolverConfig {
    deltaTime?: number,
    subSteps?: number,
    gravity?: Vector3,
    relaxation?: number,
}

interface PhysicObject {
    cloth: Cloth

    configBuffer: GPUBuffer

    indexBuffer: GPUBuffer
    positionBuffer: GPUBuffer
    normalBuffer: GPUBuffer
    estimatedPositionBuffer: GPUBuffer
    velocityBuffer: GPUBuffer
    inverseMasseBuffer: GPUBuffer
    restValueBuffer: GPUBuffer
    complianceBuffer: GPUBuffer
    affectedParticlesBuffer: GPUBuffer
    colorBuffer: GPUBuffer
    colorWriteBuffer: GPUBuffer

    eulerBindGroup: GPUBindGroup
    constraintBindGroup: GPUBindGroup
    positionBindGroup: GPUBindGroup
    normalBindGroup: GPUBindGroup
    configBindGroup: GPUBindGroup
    colorBindGroup: GPUBindGroup
}

export class Solver {
    private config: SolverConfig
    private readonly device: GPUDevice
    private readonly limits: GPUSupportedLimits

    private readonly objects: PhysicObject[]

    private readonly applyConstraintPipeline: GPUComputePipeline
    private readonly semiExplicitEulerPipeline: GPUComputePipeline
    private readonly updatePositionPipeline: GPUComputePipeline
    private readonly updateNormalPipeline: GPUComputePipeline
    private readonly configLayout: GPUBindGroupLayout

    constructor(config: SolverConfig, device: GPUDevice, limits: GPUSupportedLimits) {
        this.device = device
        this.config = {
            deltaTime: 1/60,
            subSteps: 10,
            gravity: vec3.create(0, -9.8, 0),
            relaxation: 1,

            ...config,
        }
        this.objects = []

        const applyConstraintShaderModule = device.createShaderModule({ code: applyConstraintComputeShaderCode })
        const semiExplicitEulerShaderModule = device.createShaderModule({ code: semiExplicitEulerComputeShaderCode })
        const updatePositionShaderModule = device.createShaderModule({ code: updatePositionComputeShaderCode })
        const updateNormalShaderModule = device.createShaderModule({ code: updateNormalComputeShaderCode })

        this.configLayout = device.createBindGroupLayout({
            label: "config-layout",
            entries: [
                {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
            ],
        })

        this.semiExplicitEulerPipeline = device.createComputePipeline({
            label: "semi-explicit-euler-compute-pipeline",
            layout: device.createPipelineLayout({
                label: "semi-explicit-euler-pipeline-layout",
                bindGroupLayouts: [
                    device.createBindGroupLayout({
                        label: "semi-explicit-euler-data-layout",
                        entries: [
                            {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                            {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                            {binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                        ],
                    }),
                    this.configLayout,
                ],
            }),
            compute: {
                module: semiExplicitEulerShaderModule,
                entryPoint: "main",
            },
        })
        this.applyConstraintPipeline = device.createComputePipeline({
            label: "apply-constraint-compute-pipeline",
            layout: device.createPipelineLayout({
                label: "apply-constraint-pipeline-layout",
                bindGroupLayouts: [
                    device.createBindGroupLayout({
                        label: "apply-constraint-data-layout",
                        entries: [
                            {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                            {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                        ],
                    }),
                    this.configLayout,
                    device.createBindGroupLayout({
                        label: "color-layout",
                        entries: [
                            {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
                        ],
                    }),
                ],
            }),
            compute: {
                module: applyConstraintShaderModule,
                entryPoint: "main",
            },
        })
        this.updatePositionPipeline = device.createComputePipeline({
            label: "update-position-compute-pipeline",
            layout: device.createPipelineLayout({
                label: "update-position-pipeline-layout",
                bindGroupLayouts: [
                    device.createBindGroupLayout({
                        label: "update-position-data-layout",
                        entries: [
                            {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                            {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                            {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                        ],
                    }),
                    this.configLayout,
                ],
            }),
            compute: {
                module: updatePositionShaderModule,
                entryPoint: "main",
            },
        })
        this.updateNormalPipeline = device.createComputePipeline({
            label: "update-normal-compute-pipeline",
            layout: device.createPipelineLayout({
                label: "update-normal-pipeline-layout",
                bindGroupLayouts: [
                    device.createBindGroupLayout({
                        label: "update-normal-data-layout",
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
        passEncoder.setBindGroup(1, object.configBindGroup)

        const dispatch = Math.sqrt(object.cloth.particles.count)
        const dispatchX = Math.ceil(dispatch/16)
        const dispatchY = Math.ceil(dispatch/16)

        passEncoder.dispatchWorkgroups(dispatchX, dispatchY)

        passEncoder.end()
    }

    private applyConstraints(encoder: GPUCommandEncoder, object: PhysicObject) {
        const colors = object.cloth.constraints.colors

        for (let i = 0; i < colors.length/2; i++) {
            encoder.copyBufferToBuffer(object.colorWriteBuffer, i*2*u32Size, object.colorBuffer, 0, 2*u32Size);

            const passEncoder = encoder.beginComputePass()

            passEncoder.setPipeline(this.applyConstraintPipeline)
            passEncoder.setBindGroup(0, object.constraintBindGroup)
            passEncoder.setBindGroup(1, object.configBindGroup)
            passEncoder.setBindGroup(2, object.colorBindGroup)

            const dispatch = Math.sqrt(colors[i*2+1])
            const dispatchX = Math.ceil(dispatch/16)
            const dispatchY = Math.ceil(dispatch/16)

            passEncoder.dispatchWorkgroups(dispatchX, dispatchY)

            passEncoder.end()
        }
    }

    private updatePositions(encoder: GPUCommandEncoder, object: PhysicObject) {
        const passEncoder = encoder.beginComputePass()

        passEncoder.setPipeline(this.updatePositionPipeline)
        passEncoder.setBindGroup(0, object.positionBindGroup)
        passEncoder.setBindGroup(1, object.configBindGroup)

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
        cloth.constraints.color()

        const config = new Float32Array([
            this.config.deltaTime / this.config.subSteps,
            cloth.constraints.count,
            cloth.particles.count,
            0,
            this.config.gravity.x,
            this.config.gravity.y,
            this.config.gravity.z,
        ])

        const configBuffer = this.device.createBuffer({
            label: "config-buffer",
            size: fourBytesAlignment(config.length * f32Size),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        const estimatedPositionBuffer = this.device.createBuffer({
            label: "estimated-position-buffer",
            size: fourBytesAlignment(cloth.particles.estimatedPositions.length * f32Size),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        const velocityBuffer = this.device.createBuffer({
            label: "velocity-buffer",
            size: fourBytesAlignment(cloth.particles.velocities.length * f32Size),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        })
        const inverseMasseBuffer = this.device.createBuffer({
            label: "inverse-masses-buffer",
            size: fourBytesAlignment(cloth.particles.inverseMasses.length * f32Size),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        const restValueBuffer = this.device.createBuffer({
            label: "rest-values-buffer",
            size: fourBytesAlignment(cloth.constraints.restValues.length * f32Size),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        const complianceBuffer = this.device.createBuffer({
            label: "compliances-buffer",
            size: fourBytesAlignment(cloth.constraints.compliances.length * f32Size),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        const affectedParticlesBuffer = this.device.createBuffer({
            label: "affected-particles-buffer",
            size: fourBytesAlignment(cloth.constraints.affectedParticles.length * f32Size),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        const colorBuffer = this.device.createBuffer({
            label: "color-buffer",
            size: fourBytesAlignment(2 * f32Size),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        const colorWriteBuffer = this.device.createBuffer({
            label: "color-write-buffer",
            size: fourBytesAlignment(cloth.constraints.colors.byteLength),
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });

        this.writeAllBuffer(configBuffer, config)
        this.writeAllBuffer(velocityBuffer, cloth.particles.velocities)
        this.writeAllBuffer(inverseMasseBuffer, cloth.particles.inverseMasses)
        this.writeAllBuffer(restValueBuffer, cloth.constraints.restValues)
        this.writeAllBuffer(complianceBuffer, cloth.constraints.compliances)
        this.writeAllBuffer(affectedParticlesBuffer, cloth.constraints.affectedParticles)
        this.writeAllBuffer(colorWriteBuffer, cloth.constraints.colors)

        const eulerBindGroup = this.device.createBindGroup({
            layout: this.semiExplicitEulerPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: cloth.geometry.positionBuffer } },
                { binding: 1, resource: { buffer: estimatedPositionBuffer } },
                { binding: 2, resource: { buffer: velocityBuffer } },
                { binding: 3, resource: { buffer: inverseMasseBuffer } },
            ],
        })
        const constraintBindGroup = this.device.createBindGroup({
            layout: this.applyConstraintPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: estimatedPositionBuffer } },
                { binding: 1, resource: { buffer: inverseMasseBuffer } },
                { binding: 2, resource: { buffer: restValueBuffer } },
                { binding: 3, resource: { buffer: complianceBuffer } },
                { binding: 4, resource: { buffer: affectedParticlesBuffer } },
            ],
        })
        const positionBindGroup = this.device.createBindGroup({
            layout: this.updatePositionPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: cloth.geometry.positionBuffer } },
                { binding: 1, resource: { buffer: estimatedPositionBuffer } },
                { binding: 2, resource: { buffer: velocityBuffer } },
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

        const configBindGroup = this.device.createBindGroup({
            layout: this.configLayout,
            entries: [
                { binding: 0, resource: { buffer: configBuffer } },
            ],
        })

        const colorBindGroup = this.device.createBindGroup({
            layout: this.applyConstraintPipeline.getBindGroupLayout(2),
            entries: [
                { binding: 0, resource: { buffer: colorBuffer } },
            ],
        })

        this.objects.push({
            cloth,

            indexBuffer: cloth.geometry.indexBuffer,
            positionBuffer: cloth.geometry.positionBuffer,
            normalBuffer: cloth.geometry.normalBuffer,

            estimatedPositionBuffer,
            velocityBuffer,
            inverseMasseBuffer,
            restValueBuffer,
            complianceBuffer,
            affectedParticlesBuffer,
            configBuffer,
            colorBuffer,
            colorWriteBuffer,

            eulerBindGroup,
            constraintBindGroup,
            positionBindGroup,
            normalBindGroup,
            configBindGroup,
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
