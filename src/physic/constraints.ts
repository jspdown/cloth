import graphColoringComputeShaderCode from "./shaders/graph_coloring.compute.wgsl"

const isDebugging = false

import * as vec3 from "../math/vector3"

import {Particle} from "./particles"
import {monitor} from "../monitor";

interface ConstraintIterator { (constraint: ConstraintRef): void }

const maxColors = 50
const maxDegree = 32
const blindRuns = 5

const graphColoringLayoutDesc: GPUBindGroupLayoutDescriptor = {
    label: "graph-coloring",
    entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
    ],
}

const debugLayoutDesc: GPUBindGroupLayoutDescriptor = {
    label: "debug",
    entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: {type: "storage" } },
    ],
}

interface Constraint {
    id: number
    p1: number
    p2: number
    restValue: number
    compliance: number
}

export class ConstraintRef implements Constraint {
    public readonly id: number

    private readonly data: ConstraintsData
    private readonly offset: number

    constructor(data: ConstraintsData, offset: number, id: number) {
        this.id = id
        this.data = data
        this.offset = offset
    }

    public get p1(): number {
        return this.data.affectedParticles[this.offset*2]
    }
    public set p1(p1: number) {
        this.data.affectedParticles[this.offset*2] = p1

        this.data.uploadNeeded = true
    }

    public get p2(): number {
        return this.data.affectedParticles[this.offset*2+1]
    }
    public set p2(p2: number) {
        this.data.affectedParticles[this.offset*2+1] = p2

        this.data.uploadNeeded = true
    }

    public get restValue(): number {
        return this.data.restValues[this.offset]
    }
    public set restValue(restValue: number) {
        this.data.restValues[this.offset] = restValue

        this.data.uploadNeeded = true
    }

    public get compliance(): number {
        return this.data.compliances[this.offset]
    }
    public set compliance(compliance: number) {
        this.data.compliances[this.offset] = compliance

        this.data.uploadNeeded = true
    }

    public unref(): Constraint {
        return {
            id: this.id,
            p1: this.p1,
            p2: this.p2,
            restValue: this.restValue,
            compliance: this.compliance,
        }
    }
}

interface ConstraintsData {
    uploadNeeded: boolean

    restValues: Float32Array
    compliances: Float32Array
    affectedParticles: Float32Array
}

export class Constraints {
    public count: number
    public colorCount: number

    // CPU side graph coloring buffers
    public particleConstraints: Array<Set<number>>
    public neighbourConstraints: Uint32Array
    public constraintNeighbours: Uint32Array
    public neighbourConstraintCount: number
    public maxConstraintDegree: number

    public colors: Uint32Array

    private readonly data: ConstraintsData
    private readonly max: number

    // GPU side data buffers.
    public readonly restValueBuffer: GPUBuffer
    public readonly complianceBuffer: GPUBuffer
    public readonly affectedParticleBuffer: GPUBuffer
    public readonly colorBuffer: GPUBuffer

    // neighbourConstraintsBuffer stores the index in the constraintNeighboursBuffer
    // at which a constraint can find the list of its constraint neighbours.
    private readonly neighbourConstraintsBuffer: GPUBuffer
    // constraintNeighboursBuffer stores the neighbours of each constraint contiguously. One
    // can find the neighbour of a specific constraint by looking at its id in the
    // neighbourConstraintsBuffer.
    private readonly constraintNeighboursBuffer: GPUBuffer
    // constraintColorPalettesBuffer stores the list of colors that a constraint can pick
    // during the graph coloring step.
    private readonly constraintColorPalettesBuffer: GPUBuffer
    // constraintColorsBuffer stores the color of each constraint.
    public readonly constraintColorsBuffer: GPUBuffer
    // remainingConstraintsToColor are the constraints that remain to be colored.
    public readonly remainingConstraintsToColorBuffer: GPUBuffer
    // configBuffer stores the graph coloring config.
    private readonly configBuffer: GPUBuffer
    // resultBuffer stores a counter of the remaining constraints
    // to be colored.
    private readonly resultBuffer: GPUBuffer
    private readonly resultReadBuffer: GPUBuffer

    private readonly device: GPUDevice
    private readonly initPipeline: GPUComputePipeline
    private readonly pickRandomColorPipeline: GPUComputePipeline
    private readonly resolveConflictPipeline: GPUComputePipeline
    private readonly feedTheHungryPipeline: GPUComputePipeline
    private readonly graphColoringBindGroup: GPUBindGroup

    private readonly adjacency: number[][]

    // DEBUG
    public readonly debugBuffer: GPUBuffer
    public readonly debugBindGroup: GPUBindGroup

    constructor(device: GPUDevice, max: number) {
        this.device = device
        this.data = {
            uploadNeeded: true,
            restValues: new Float32Array(max),
            compliances: new Float32Array(max),
            affectedParticles: new Float32Array(max * 2),
        }

        this.particleConstraints = []
        this.constraintNeighbours = new Uint32Array(max + 1)
        this.neighbourConstraints = new Uint32Array(max * maxDegree)
        this.neighbourConstraintCount = 0
        this.maxConstraintDegree = 0

        this.colors = new Uint32Array(maxColors * 64)
        this.adjacency = []

        this.count = 0
        this.colorCount = 0

        this.max = max

        this.restValueBuffer = this.device.createBuffer({
            label: "rest-values",
            size: fourBytesAlignment(this.data.restValues.byteLength),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        this.complianceBuffer = this.device.createBuffer({
            label: "compliances",
            size: fourBytesAlignment(this.data.compliances.byteLength),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        this.affectedParticleBuffer = this.device.createBuffer({
            label: "affected-particles",
            size: fourBytesAlignment(this.data.affectedParticles.byteLength),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        this.colorBuffer = this.device.createBuffer({
            label: "colors",
            size: fourBytesAlignment(this.colors.byteLength),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        this.constraintNeighboursBuffer = this.device.createBuffer({
            label: "constraint-neighbours",
            size: fourBytesAlignment(this.constraintNeighbours.byteLength),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        this.neighbourConstraintsBuffer = this.device.createBuffer({
            label: "neighbour-constraints",
            size: fourBytesAlignment(this.neighbourConstraints.byteLength),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        this.constraintColorPalettesBuffer = this.device.createBuffer({
            label: "constraint-color-palette",
            size: fourBytesAlignment(4 * max),
            usage: GPUBufferUsage.STORAGE,
        })
        this.constraintColorsBuffer = this.device.createBuffer({
            label: "constraint-colors",
            size: fourBytesAlignment(4 * max),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        this.remainingConstraintsToColorBuffer = this.device.createBuffer({
            label: "remaining-constraints-to-colors",
            size: fourBytesAlignment(4 * max),
            usage: GPUBufferUsage.STORAGE,
        })
        this.configBuffer = this.device.createBuffer({
            label: "config",
            size: 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        this.resultBuffer = this.device.createBuffer({
            label: "result",
            size: 4 * 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        })
        this.resultReadBuffer = this.device.createBuffer({
            label: "result-read",
            size: 4 * 2,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        })

        const graphColoringShaderModule = device.createShaderModule({
            code: graphColoringComputeShaderCode,
        })

        const layout = device.createPipelineLayout({
            label: "init-graph-coloring",
            bindGroupLayouts: [
                device.createBindGroupLayout(graphColoringLayoutDesc),
                device.createBindGroupLayout(debugLayoutDesc),
            ],
        })

        this.initPipeline = device.createComputePipeline({
            label: "init-graph-coloring",
            layout,
            compute: {
                module: graphColoringShaderModule,
                entryPoint: "init",
            },
        })
        this.pickRandomColorPipeline = device.createComputePipeline({
            label: "pick-random-color",
            layout,
            compute: {
                module: graphColoringShaderModule,
                entryPoint: "pickRandomColor",
            },
        })
        this.resolveConflictPipeline = device.createComputePipeline({
            label: "resolve-conflict",
            layout,
            compute: {
                module: graphColoringShaderModule,
                entryPoint: "resolveConflict",
            },
        })
        this.feedTheHungryPipeline = device.createComputePipeline({
            label: "feed-the-hungry",
            layout,
            compute: {
                module: graphColoringShaderModule,
                entryPoint: "feedTheHungry",
            },
        })

        this.graphColoringBindGroup = device.createBindGroup({
            label: "graph-coloring",
            layout: device.createBindGroupLayout(graphColoringLayoutDesc),
            entries: [
                { binding: 0, resource: { buffer: this.constraintColorPalettesBuffer } },
                { binding: 1, resource: { buffer: this.constraintColorsBuffer } },
                { binding: 2, resource: { buffer: this.remainingConstraintsToColorBuffer } },
                { binding: 3, resource: { buffer: this.constraintNeighboursBuffer } },
                { binding: 4, resource: { buffer: this.neighbourConstraintsBuffer } },
                { binding: 5, resource: { buffer: this.configBuffer } },
                { binding: 6, resource: { buffer: this.resultBuffer } },
            ]
        })

        // DEBUG
        this.debugBuffer = this.device.createBuffer({
            label: "debug",
            size: fourBytesAlignment(max * 4),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        })
        this.debugBindGroup = this.device.createBindGroup({
            label: "debug",
            layout: device.createBindGroupLayout(debugLayoutDesc),
            entries: [
                { binding: 0, resource: { buffer: this.debugBuffer } },
            ]
        })
    }

    public get uploadNeeded(): boolean {
        return this.data.uploadNeeded
    }

    public async upload(): Promise<void> {
        // Constraint coloring.
        await this.device.queue.onSubmittedWorkDone()
        const popNeighTimer = monitor.createTimer("Pop Neigh")
        popNeighTimer.start()
        this.populateNeighbourhood()

        this.device.queue.writeBuffer(
            this.constraintNeighboursBuffer, 0,
            this.constraintNeighbours, 0,
            this.constraintNeighbours.length)
        this.device.queue.writeBuffer(
            this.neighbourConstraintsBuffer, 0,
            this.neighbourConstraints, 0,
            this.neighbourConstraints.length)
        popNeighTimer.end()

        const graphColoringTimer = monitor.createTimer("Coloring")
        graphColoringTimer.start()
        await this.color(1.9)
        await this.device.queue.onSubmittedWorkDone()
        graphColoringTimer.end()

        const legacyColorTimer = monitor.createTimer("LegacyColor")

        legacyColorTimer.start()
        this.legacyColor()
        legacyColorTimer.end()

        this.device.queue.writeBuffer(
            this.restValueBuffer, 0,
            this.data.restValues, 0,
            this.count)

        this.device.queue.writeBuffer(
            this.complianceBuffer, 0,
            this.data.compliances, 0,
            this.count)

        this.device.queue.writeBuffer(
            this.affectedParticleBuffer, 0,
            this.data.affectedParticles, 0,
            2 * this.count)

        this.device.queue.writeBuffer(
            this.colorBuffer, 0,
            this.colors, 0,
            64 * this.colorCount)

        this.data.uploadNeeded = false
    }

    public add(p1: Particle, p2: Particle, compliance: number): void {
        if (this.count >= this.max) {
            throw new Error("max number of constraints reached")
        }

        const id = this.count
        const c = new ConstraintRef(this.data, this.count, id)

        c.compliance = compliance
        c.restValue = vec3.distance(p1.position, p2.position)
        c.p1 = p1.id
        c.p2 = p2.id

        // Grow the particleConstraints list if needed.
        for (let i = this.particleConstraints.length; i <= Math.max(p1.id, p2.id); i++) {
            this.particleConstraints.push(new Set<number>())
        }

        this.particleConstraints[p1.id].add(id)
        this.particleConstraints[p2.id].add(id)

        this.count++

        this.addAdjacency(p1.id, p2.id)
        this.addAdjacency(p2.id, p1.id)
    }

    public get(i: number): ConstraintRef {
        return new ConstraintRef(this.data, i, i)
    }

    public set(i: number, c: Constraint) {
        if (i < 0 || i >= this.count) {
            throw new Error("out of bound")
        }

        const ref = new ConstraintRef(this.data, i, i)

        ref.compliance = c.compliance
        ref.restValue = c.restValue
        ref.p1 = c.p1
        ref.p2 = c.p2
    }

    public forEach(cb: ConstraintIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new ConstraintRef(this.data, i, i))
        }
    }

    public async color(shrinkingFactor: number): Promise<void> {
        let encoder = this.device.createCommandEncoder()

        // A constraint with a 0 color is considered not colored.
        encoder.clearBuffer(this.constraintColorsBuffer)

        let colorCount = Math.ceil(this.maxConstraintDegree / shrinkingFactor)
        const colorPalette = computeColorPalette(colorCount)
        let randomSeed = getRandomInt(1, 1000000)
        if (isDebugging) {
            console.log("RANDOM_SEED = ", randomSeed)
            console.log("COLOR COUNT = ", colorCount)
            console.log("COLOR PALETTE = ", colorPalette)
        }

        const config = new Uint32Array([colorPalette, randomSeed, this.count, colorCount])
        this.device.queue.writeBuffer(
            this.configBuffer, 0,
            config, 0,
            config.length)

        const dispatch = Math.sqrt(this.count)
        const dispatchX = Math.ceil(dispatch/16)
        const dispatchY = Math.ceil(dispatch/16)

        let passEncoder = encoder.beginComputePass()

        passEncoder.setBindGroup(0, this.graphColoringBindGroup)
        passEncoder.setBindGroup(1, this.debugBindGroup)

        // Initialize the color palette of each constraint.
        passEncoder.setPipeline(this.initPipeline)
        passEncoder.dispatchWorkgroups(dispatchX, dispatchY)

        let runs = 0
        while (true) {
            for (let i = 0; i < blindRuns; i++) {
                if (isDebugging) {
                    console.log("RUN " + runs + " -------------------------------")
                }
                passEncoder.setBindGroup(0, this.graphColoringBindGroup)
                passEncoder.setBindGroup(1, this.debugBindGroup)

                passEncoder.setPipeline(this.pickRandomColorPipeline)
                passEncoder.dispatchWorkgroups(dispatchX, dispatchY)

                let debugReadBuffer;
                if (isDebugging) {
                    debugReadBuffer = this.device.createBuffer({
                        label: "debug",
                        size: fourBytesAlignment(this.count * 4),
                        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
                    })
                    passEncoder.end()
                    encoder.copyBufferToBuffer(
                        this.debugBuffer,
                        0,
                        debugReadBuffer,
                        0,
                        this.count * 4)
                    this.device.queue.submit([encoder.finish()])
                    await this.device.queue.onSubmittedWorkDone()

                    await debugReadBuffer.mapAsync(GPUMapMode.READ)
                    let debugBuffer = debugReadBuffer.getMappedRange()
                    let debug = new Uint32Array(debugBuffer)
                    console.log("colors")
                    dumpBuffer(debug)
                    debugReadBuffer.unmap()
                    encoder = this.device.createCommandEncoder()
                    passEncoder = encoder.beginComputePass()

                    passEncoder.setBindGroup(0, this.graphColoringBindGroup)
                    passEncoder.setBindGroup(1, this.debugBindGroup)
                }

                passEncoder.setPipeline(this.resolveConflictPipeline)
                passEncoder.dispatchWorkgroups(dispatchX, dispatchY)

                passEncoder.setPipeline(this.feedTheHungryPipeline)
                passEncoder.dispatchWorkgroups(dispatchX, dispatchY)

                if (isDebugging) {
                    passEncoder.end()
                    encoder.copyBufferToBuffer(
                        this.debugBuffer,
                        0,
                        debugReadBuffer,
                        0,
                        this.count * 4)

                    if (i + 1 >= blindRuns) {
                        encoder.copyBufferToBuffer(
                            this.resultBuffer,
                            0,
                            this.resultReadBuffer,
                            0,
                            8)
                    }

                    this.device.queue.submit([encoder.finish()])

                    await debugReadBuffer.mapAsync(GPUMapMode.READ)
                    const debugBuffer = debugReadBuffer.getMappedRange()
                    const debug = new Uint32Array(debugBuffer)
                    console.log("remaining:")
                    dumpBuffer(debug)
                    this.checkCorrectlyColored(debug)
                    debugReadBuffer.unmap()

                    encoder = this.device.createCommandEncoder()
                    passEncoder = encoder.beginComputePass()
                }
                runs++
            }

            if (!isDebugging) {
                passEncoder.end()
                encoder.copyBufferToBuffer(
                    this.resultBuffer,
                    0,
                    this.resultReadBuffer,
                    0,
                    8)

                this.device.queue.submit([encoder.finish()])
            }

            await this.resultReadBuffer.mapAsync(GPUMapMode.READ)
            const remainingCountBuffer = this.resultReadBuffer.getMappedRange()
            const [remainingCount, needMoreColor] = new Uint32Array(remainingCountBuffer)
            this.resultReadBuffer.unmap()

            if (isDebugging) {
                console.log("remaining", remainingCount, "need-more-color", needMoreColor)
            }

            if (remainingCount == 0) {
                console.log("SUCCESS")
                console.log("=====> done in ", runs, "runs")
                console.log("=====> colors: ", colorCount)
                break
            }

            if (runs >= 10000) {
                console.log("!!!!!!!!!!!!!!!!!!!! FAILED!!!!")
                console.log("=====> done in ", runs, "runs")
                console.log("=====> colors: ", colorCount)
                break
            }

            encoder = this.device.createCommandEncoder()
            passEncoder = encoder.beginComputePass()
        }
    }

    private checkCorrectlyColored(constraintColors: Uint32Array) {
        constraintColors.forEach((color: number, i: number) => {
            const neighbourStart = this.constraintNeighbours[i]
            const neighbourEnd = this.constraintNeighbours[i+1]

            if (color >= 1000) {
                return
            }

            // console.log("checking constraint ", i, "(color: " + color + ")")
            for (let j = neighbourStart; j < neighbourEnd; j++) {
                const c = this.neighbourConstraints[j]

                // console.log("   - neighbour", c, "(color: " + constraintColors[c] + ")",  constraintColors[c] === color)
                if (constraintColors[c] === color) {
                    console.log("Error on constraint", i, "conflict with", c, "color", color)
                }
            }
        })
    }

    private addAdjacency(p1: number, p2: number): void {
        if (p1 > this.adjacency.length - 1) {
            for (let i = this.adjacency.length; i <= p1; i++) {
                this.adjacency.push([])
            }
        }

        this.adjacency[p1].push(p2)
    }

    // populateNeighbourhood finds out for each constraint the list of the neighbour
    // constraints. A constraint is linked to another one if they share at least
    // one particle.
    private populateNeighbourhood(): void {
        let maxDegree = 0
        let neighbourIdx = 0

        if (isDebugging) {
            console.log("constraints: ")
            this.forEach((constraint: ConstraintRef) => {
                console.log(`${constraint.id} - (${constraint.p1}, ${constraint.p2})`)
            })

            console.log("neighbours: ")
        }

        this.forEach((constraint: ConstraintRef) => {
            const neighbours = new Set([
                ...this.particleConstraints[constraint.p1],
                ...this.particleConstraints[constraint.p2],
            ])

            this.constraintNeighbours[constraint.id] = neighbourIdx

            const neighboursIds: number[] = []
            neighbours.forEach((constraintId: number) => {
                if (constraintId === constraint.id) {
                    return
                }
                this.neighbourConstraints[neighbourIdx] = constraintId
                if (isDebugging) {
                    neighboursIds.push(constraintId)
                }

                neighbourIdx++
            })
            if (isDebugging) {
                console.log(constraint.id, neighboursIds)
            }

            if (neighbours.size - 1 > maxDegree) {
                maxDegree = neighbours.size - 1
            }
        })

        // Save the position of the last neighbour.
        this.constraintNeighbours[this.count] = neighbourIdx

        this.neighbourConstraintCount = neighbourIdx
        this.maxConstraintDegree = maxDegree
    }

    // legacyColor colors constraints in such a way that constraints from a group are not
    // sharing a single particle.
    private legacyColor(): void {
        this.colorCount = 0

        const indexes: number[] = []
        const markedConstraints = new Array<boolean>(this.count).fill(false)
        const markedParticles = new Array<boolean>(this.adjacency.length).fill(false)

        let remainingUnmarkedConstraints = this.count

        // Assign a color to each constraint and store the index of the constraint
        // ordered by color.
        while (remainingUnmarkedConstraints) {
            if (this.colorCount >= maxColors) {
                throw new Error("max number of colors reached")
            }

            markedParticles.fill(false)

            const colorStart = indexes.length
            for (let i = 0; i < this.count; i++) {
                if (markedConstraints[i]) continue

                const p1 = this.data.affectedParticles[i*2]
                const p2 = this.data.affectedParticles[i*2+1]

                if (markedParticles[p1] || markedParticles[p2]) continue

                indexes.push(i)

                markedConstraints[i] = true
                markedParticles[p1] = true
                markedParticles[p2] = true

                remainingUnmarkedConstraints--
            }

            this.colors[this.colorCount*64] = colorStart
            this.colors[this.colorCount*64+1] = indexes.length - colorStart

            this.colorCount++
        }

        // Re-order constraints following the color indices.
        for (let i = 0; i < this.count; i++) {
            if (indexes[i] === i) continue

            const originalValue = this.get(i).unref()
            let j = i
            let k = indexes[j]

            while (i !== k) {
                this.set(j, this.get(k))
                indexes[j] = j

                j = k
                k = indexes[j]
            }

            this.set(j, originalValue)
            indexes[j] = j
        }

        console.log("legacy: ", this.colorCount)
    }
}

// computeColorPalette generates a color palette where each color occupy one bit
// of the number.
function computeColorPalette(colors: number): number {
    let palette = 0

    for (let i = 0; i < colors; i++) {
        palette |= 1 << i
    }

    return palette
}

// getRandomInt returns a random integer comprise between min and max.
function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}

function dumpBuffer(buffer: Uint32Array): void {
    buffer.forEach((v: number, i: number) => {
        console.log(`${i} - ${v}`)
    })
}

function dumpColors(buffer: Uint32Array): void {
    buffer.forEach((v: number, i: number) => {
        console.log(`${i} - ${v}`)
    })
}
