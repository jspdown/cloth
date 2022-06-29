import * as vec3 from "../math/vector3"

import {Particle} from "./particles"

interface ConstraintIterator { (constraint: ConstraintRef): void }

const maxColors = 50

interface Constraint {
    p1: number
    p2: number
    restValue: number
    compliance: number
}

export class ConstraintRef implements Constraint {
    private readonly data: ConstraintsData
    private readonly offset: number

    constructor(data: ConstraintsData, offset: number) {
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
    public colors: Uint32Array

    private readonly data: ConstraintsData
    private readonly max: number

    public readonly restValueBuffer: GPUBuffer
    public readonly complianceBuffer: GPUBuffer
    public readonly affectedParticleBuffer: GPUBuffer
    public readonly colorBuffer: GPUBuffer

    private readonly device: GPUDevice

    private readonly adjacency: number[][]

    constructor(device: GPUDevice, max: number) {
        this.device = device
        this.data = {
            uploadNeeded: true,
            restValues: new Float32Array(max),
            compliances: new Float32Array(max),
            affectedParticles: new Float32Array(max * 2),
        }

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
    }

    public get uploadNeeded(): boolean {
        return this.data.uploadNeeded
    }

    public upload(): void {
        this.color()

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

        const c = new ConstraintRef(this.data, this.count)

        c.compliance = compliance
        c.restValue = vec3.distance(p1.position, p2.position)
        c.p1 = p1.id
        c.p2 = p2.id

        this.addAdjacency(p1.id, p2.id)
        this.addAdjacency(p2.id, p1.id)

        this.count++
    }

    public get(i: number): ConstraintRef {
        return new ConstraintRef(this.data, i)
    }

    public set(i: number, c: Constraint) {
        if (i < 0 || i >= this.count) {
            throw new Error("out of bound")
        }

        const ref = new ConstraintRef(this.data, i)

        ref.compliance = c.compliance
        ref.restValue = c.restValue
        ref.p1 = c.p1
        ref.p2 = c.p2
    }

    public forEach(cb: ConstraintIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new ConstraintRef(this.data, i))
        }
    }

    private addAdjacency(p1: number, p2: number): void {
        if (p1 > this.adjacency.length - 1) {
            for (let i = this.adjacency.length; i <= p1; i++) {
                this.adjacency.push([])
            }
        }

        this.adjacency[p1].push(p2)
    }

    // Color constraints in such a way that constraints from a group are not
    // sharing a single particle.
    private color(): void {
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
    }
}

function fourBytesAlignment(size: number): number {
    return (size + 3) & ~3
}
