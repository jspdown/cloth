import "./main.css"

import * as vec3 from "./math/vector3"

import {Cloth} from "./physic/cloth"
import {Camera} from "./camera"
import {Renderer} from "./renderer"
import * as cpuSolver from "./physic/solver_cpu";
import {monitor} from "./monitor";
import {Controller} from "./controller";
import {buildPlaneGeometry} from "./geometry";

interface Solver {
    paused: boolean
    config: any

    solve(cloth: Cloth): void
}

// App is the application.
export class App {
    public cloth: Cloth
    public solver: Solver

    private readonly device: GPUDevice
    private readonly canvas: HTMLCanvasElement
    private readonly camera: Camera
    private readonly renderer: Renderer

    private stopped: boolean

    constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
        this.canvas = canvas
        this.device = device
        this.stopped = false

        this.camera = new Camera(canvas, device, {
            width: canvas.width,
            height: canvas.height,
        })

        this.renderer = new Renderer(canvas, device)
        this.solver = new cpuSolver.Solver({
            deltaTime: 1/60,
            subSteps: 15,
            relaxation: 1,
            method: cpuSolver.Method.GaussSeidel,
        })

         const geometry = buildPlaneGeometry(this.device, 10, 10, 30, 30)

        this.cloth = new Cloth(this.device, geometry, {
            stretchCompliance: 0,
            bendCompliance: 0.3,
        }, vec3.create(-5, 0, 0))
    }

    // run runs the application.
    public async run(): Promise<void> {
        this.stopped = false

        const tickTimer = monitor.createTimer("tick")
        const physicTimer = monitor.createTimer("physic")

        let lastTickTimestamp = 0
        return new Promise((resolve, _) => {
            const tick = (timestamp: number) => {
                if (this.stopped) {
                    resolve()
                    return
                }

                lastTickTimestamp = timestamp

                tickTimer.start()

                physicTimer.start()
                this.solver.solve(this.cloth)
                physicTimer.end()

                const pipeline = this.cloth.getRenderPipeline(this.camera)

                if (pipeline) {
                    this.renderer.render(this.cloth.geometry, pipeline, [
                        this.camera.uniformBindGroup,
                        this.cloth.uniformBindGroup,
                    ])
                }

                tickTimer.end()

                window.requestAnimationFrame(tick)
            }

            window.requestAnimationFrame(tick)
        })
    }

    // stop stops the application.
    public stop(): void {
        this.stopped = true
    }
}

