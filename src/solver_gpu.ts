import solverShaderCode from "./shaders/solver.compute.wgsl"

import {Vector3} from "@math.gl/core";

const maxParticles = 100000
const particleSizeBytes = 9


// SolverConfig holds the configuration of the solver.
interface SolverConfig {
    subSteps: number
}

// Solver is a XPBD physic solver.
export class Solver {
    private readonly config: SolverConfig
    private readonly device: GPUDevice

    private readonly particlesBindGroup: GPUBindGroup
    private readonly configBindGroup: GPUBindGroup
    private readonly pipeline: GPUComputePipeline

    private readonly configBuffer: GPUBuffer
    private readonly gpuInputParticlesBuffer: GPUBuffer
    private readonly gpuOutputParticlesBuffer: GPUBuffer

    constructor(device: GPUDevice, config: SolverConfig) {
        this.config = config
        this.device = device

        const shaderModule = device.createShaderModule({ code: solverShaderCode })

        this.configBuffer = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.gpuInputParticlesBuffer = device.createBuffer({
            size: fourBytesAlignment(maxParticles * particleSizeBytes),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.gpuOutputParticlesBuffer = device.createBuffer({
            size: fourBytesAlignment(maxParticles * particleSizeBytes),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        this.pipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: shaderModule,
                entryPoint: "main"
            },
        });

        this.particlesBindGroup = device.createBindGroup({
            label: "particles-bind-group",
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.gpuInputParticlesBuffer } },
                { binding: 1, resource: { buffer: this.gpuOutputParticlesBuffer } },
            ]
        });

        this.configBindGroup = device.createBindGroup({
            label: "config-bind-group",
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [
                { binding: 0, resource: { buffer: this.configBuffer } },
            ],
        })
    }

    // solve solves a simulation step.
    public solve(deltaTime: number, particles: Float32Array): void {
        const deltaTimeStep = deltaTime / this.config.subSteps

        const particlesCount = particles.length / particleSizeBytes
        const config = new Float32Array([particlesCount])

        this.device.queue.writeBuffer(this.gpuInputParticlesBuffer, 0, particles, 0, particles.length)
        this.device.queue.writeBuffer(this.configBuffer, 0, config, 0, config.length)

        const encoder = this.device.createCommandEncoder()

        for (let subStep = 0; subStep < this.config.subSteps; subStep++) {

            this.semiExplicitEuler(encoder, deltaTimeStep, particlesCount)
            this.applyConstraints(deltaTimeStep)
            this.updatePositionsAndVelocities(deltaTimeStep)
        }

        const readLength = fourBytesAlignment(4 * particles.length)
        const gpuReadBuffer = this.device.createBuffer({
          size: readLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        })

        encoder.copyBufferToBuffer(this.gpuOutputParticlesBuffer, 0, gpuReadBuffer, 0, readLength)

        const gpuCommands = encoder.finish()
        this.device.queue.submit([gpuCommands])

        gpuReadBuffer.mapAsync(GPUMapMode.READ)
            .then(() =>{
                const arrayBuffer = gpuReadBuffer.getMappedRange()
                const plop = new Float32Array(arrayBuffer)

                console.table(plop)
                for (let i = 0; i < plop.length/9; i++) {
                    const idx = i * 8

                    console.log(`${i} ${idx} - (${plop[idx]}, ${plop[idx+1]}, ${plop[idx+2]})`)
                }
            })
    }

    // semiExplicitEuler estimates the position of the particles based on their
    // current velocity and other external forces.
    private semiExplicitEuler(encoder: GPUCommandEncoder, deltaTime: number, particlesCount: number): void {
        const passEncoder = encoder.beginComputePass()

        passEncoder.setPipeline(this.pipeline)
        passEncoder.setBindGroup(0, this.particlesBindGroup)
        passEncoder.setBindGroup(1, this.configBindGroup)
        passEncoder.dispatchWorkgroups(particlesCount, 1)
        passEncoder.end()
    }

    // applyConstraints tries to enforce each constraints on its associated
    // particles. Constrains are applied in a Jacobi fashion to maximize parallelism.
    private applyConstraints(deltaTime: number): void {}

    // updatePositionsAndVelocities updates particle positions and velocities using the
    // estimated position refined by the constraints.
    private updatePositionsAndVelocities(deltaTime: number): void {}
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
