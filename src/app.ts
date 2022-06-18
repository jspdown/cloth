import "./main.css"

import * as vec3 from "./math/vector3"

import {Cloth} from "./physic/cloth"
import {Camera} from "./camera"
import {Renderer} from "./renderer"
import {monitor} from "./monitor";
import {buildPlaneGeometry} from "./geometry";
import {Solver} from "./physic/solver";
import {CPUSolver, CPUSolverMethod} from "./physic/cpu_solver";

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

        this.camera = new Camera(canvas, device, {
            width: canvas.width,
            height: canvas.height,
        })

        this.renderer = new Renderer(canvas, device)
        this.solver = new CPUSolver({
            deltaTime: 1/60,
            subSteps: 15,
            relaxation: 1,
            method: CPUSolverMethod.GaussSeidel,
        })

         const geometry = buildPlaneGeometry(this.device, 10, 10, 30, 30)

        this.cloth = new Cloth(this.device, geometry, {
            stretchCompliance: 0,
            bendCompliance: 0.3,
        }, vec3.create(-5, 0, 0))

        this.solver.add(this.cloth)
    }

    // run runs the application.
    public async run(): Promise<void> {
        this.stopped = false

        const tickTimer = monitor.createTimer("tick")
        const physicTimer = monitor.createTimer("physic")

        do {
            await sleep()

            tickTimer.start()

            if (!this.paused) {
                physicTimer.start()
                await this.solver.solve()
                physicTimer.end()
            }

            const pipeline = this.cloth.getRenderPipeline(this.camera)

            if (pipeline) {
                this.renderer.render(this.cloth.geometry, pipeline, [
                    this.camera.uniformBindGroup,
                    this.cloth.uniformBindGroup,
                ])
            }

            tickTimer.end()
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

