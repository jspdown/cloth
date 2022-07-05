import "./main.css"

import * as vec3 from "./math/vector3"

import {Cloth} from "./cloth"
import {Camera} from "./camera"
import {Renderer} from "./renderer"
import {monitor} from "./monitor"
import {buildPlaneGeometry} from "./geometry"
import {Solver} from "./physic/solver"

// App is the application.
export class App {
    public cloth: Cloth
    public solver: Solver
    public paused: boolean

    private readonly device: GPUDevice
    private readonly canvas: HTMLCanvasElement
    private readonly camera: Camera
    private readonly renderer: Renderer

    private stopped: boolean

    constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
        this.canvas = canvas
        this.device = device
        this.paused = true
        this.stopped = false

        this.camera = new Camera(device, canvas, {
            width: canvas.width,
            height: canvas.height,
        })

        this.renderer = new Renderer(device, canvas)
        this.solver = new Solver(this.device, {
            deltaTime: 1/60,
            subSteps: 15,
            relaxation: 1,
            gravity: vec3.create(0, -9.8, 0),
        })

        const geometry = buildPlaneGeometry(this.device, 10, 10, 10, 10)

        this.cloth = new Cloth(this.device, geometry, {
            unit: 0.01,
            density: 0.270,
            stretchCompliance: 0,
            bendCompliance: 0.3,
            enableBendConstraints: true,
        })
    }

    // run runs the application.
    public async run(): Promise<void> {
        this.stopped = false

        const timer = monitor.createTimer("tick")

        do {
            timer.end()
            await sleep()
            timer.start()

            if (this.cloth.uploadNeeded) {
                await this.cloth.upload()
            }

            const encoder = this.device.createCommandEncoder()

            if (!this.paused) {
                this.solver.solve(encoder, this.cloth)
            }

            this.renderer.render(encoder, this.cloth, this.camera)

            this.device.queue.submit([encoder.finish()])
            await this.device.queue.onSubmittedWorkDone()
        } while (!this.stopped)
    }

    // stop stops the application.
    public stop(): void {
        this.stopped = true
    }
}

function sleep(): Promise<number> {
    return new Promise(window.requestAnimationFrame)
}

