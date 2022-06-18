import * as vec3 from "../math/vector3"

import {Particle} from "./particle"

interface ConstraintIterator { (constraint: ConstraintRef): void }

interface Constraint {
    p1: number
    p2: number
    restValue: number
    compliance: number
}

export class ConstraintRef implements Constraint {
    private readonly constraints: Constraints
    private readonly offset: number

    constructor(constraints: Constraints, offset: number) {
        this.constraints = constraints
        this.offset = offset
    }

    public get p1(): number {
        return this.constraints.affectedParticles[this.offset*2]
    }
    public set p1(p1: number) {
        this.constraints.affectedParticles[this.offset*2] = p1
    }

    public get p2(): number {
        return this.constraints.affectedParticles[this.offset*2+1]
    }
    public set p2(p2: number) {
        this.constraints.affectedParticles[this.offset*2+1] = p2
    }

    public get restValue(): number {
        return this.constraints.restValues[this.offset]
    }
    public set restValue(restValue: number) {
        this.constraints.restValues[this.offset] = restValue
    }

    public get compliance(): number {
        return this.constraints.compliances[this.offset]
    }
    public set compliance(compliance: number) {
        this.constraints.compliances[this.offset] = compliance
    }

    public unref(): Constraint {
        return {
            p1: this.p1,
            p2: this.p2,
            compliance: this.compliance,
            restValue: this.restValue
        }
    }
}

export class Constraints {
    public count: number

    public restValues: Float32Array
    public compliances: Float32Array
    public affectedParticles: Float32Array

    public colors: Uint32Array

    private readonly adjacency: number[][]
    private readonly max: number

    constructor(maxConstraints: number) {
        this.restValues = new Float32Array(maxConstraints)
        this.compliances = new Float32Array(maxConstraints)
        this.affectedParticles = new Float32Array(maxConstraints*2)
        this.colors = new Uint32Array([0, 0])
        this.adjacency = []

        this.count = 0
        this.max = maxConstraints
    }

    public add(p1: Particle, p2: Particle, compliance: number): void {
        if (this.count+1 > this.max) {
            throw new Error("max number of constraints reached")
        }

        const c = new ConstraintRef(this, this.count)

        c.compliance = compliance
        c.restValue = vec3.distance(p1.position, p2.position)
        c.p1 = p1.id
        c.p2 = p2.id

        p1.constraintCount++
        p2.constraintCount++

        this.addAdjacency(p1.id, p2.id)
        this.addAdjacency(p2.id, p1.id)

        this.colors[this.colors.length-1]++
        this.count++
    }

    public color(): void {
        // Color constraints in such a way that constraints from a group are not
        // sharing a single particle.
        const particlesCount = this.adjacency.length
        const constraintsCount = this.restValues.length

        const constraintColors = []

        const markedConstraints = new Array<boolean>(constraintsCount).fill(false)
        const markedParticles = new Array<boolean>(particlesCount).fill(false)
        let remainingUnmarkedConstraints = constraintsCount

        while (remainingUnmarkedConstraints) {
            const color = []

            markedParticles.fill(false)

            for (let i = 0; i < constraintsCount; i++) {
                if (markedConstraints[i]) continue

                const p1 = this.affectedParticles[i*2]
                const p2 = this.affectedParticles[i*2+1]

                if (markedParticles[p1] || markedParticles[p2]) continue

                color.push(i)
                markedConstraints[i] = true
                remainingUnmarkedConstraints--

                markedParticles[p1] = true
                markedParticles[p2] = true
            }

            constraintColors.push(color)
        }

        // Rearrange constraints by color.
        const coloredConstraints = new Constraints(constraintsCount)
        const colors = new Uint32Array(constraintColors.length * 2)

        let currentIdx = 0
        for (let c = 0; c < constraintColors.length; c++) {
            colors[c*2] = currentIdx

            for (let i = 0; i < constraintColors[c].length; i++) {
                coloredConstraints.set(currentIdx, this.get(constraintColors[c][i]))
                currentIdx++
            }

            colors[c*2+1] = currentIdx - colors[c*2]
        }

        this.restValues = coloredConstraints.restValues
        this.compliances = coloredConstraints.compliances
        this.affectedParticles = coloredConstraints.affectedParticles

        this.colors = colors
    }

    public get(i: number): ConstraintRef {
        return new ConstraintRef(this, i)
    }

    public set(i: number, c: Constraint) {
        const ref = new ConstraintRef(this, i)

        ref.compliance = c.compliance
        ref.restValue = c.restValue
        ref.p1 = c.p1
        ref.p2 = c.p2
    }

    public forEach(cb: ConstraintIterator): void {
        for (let i = 0; i < this.count; i++) {
            cb(new ConstraintRef(this, i))
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
}
