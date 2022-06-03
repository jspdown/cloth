import "./main.css"

import * as vec3 from "./math/vector3"

import {buildPlaneGeometry} from "./geometry"
import {Cloth} from "./cloth"
import {Camera} from "./camera"
import {Renderer} from "./renderer"
import {Solver} from "./solver_cpu";
import logger from "./logger";

// App is the application.
export class App {
    private readonly canvas: HTMLCanvasElement
    private readonly device: GPUDevice
    private readonly camera: Camera
    private readonly cloth: Cloth

    private renderer: Renderer
    private solver: Solver
    private stopped: boolean

    constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
        this.canvas = canvas
        this.device = device
        this.stopped = false

        const geometry = buildPlaneGeometry(device, 10, 10, 10, 10)

        this.cloth = new Cloth(device, geometry, vec3.create(-5, 0, 0))

        this.camera = new Camera(canvas, device, {
            width: canvas.width,
            height: canvas.height,
        })

        this.renderer = new Renderer(canvas, device)
        this.solver = new Solver({
            subSteps: 15,
        })

        window.addEventListener("keypress", (e: KeyboardEvent) => this.onKeyPressed(e))
    }

    // run runs the application.
    public async run(): Promise<void> {
        this.stopped = false

        let lastTickTimestamp = 0
        return new Promise((resolve, _) => {
            const tick = (timestamp: number) => {
                if (this.stopped) {
                    resolve()
                    return
                }

                const deltaTimeSec = (timestamp - lastTickTimestamp) / 1000
                lastTickTimestamp = timestamp

                this.solver.solve(deltaTimeSec, this.cloth)

                const pipeline = this.cloth.getRenderPipeline(this.camera)

                this.renderer.render(this.cloth.geometry, pipeline, [
                    this.camera.uniformBindGroup,
                    this.cloth.uniformBindGroup,
                ])

                window.requestAnimationFrame(tick)
            }

            window.requestAnimationFrame(tick)
        })
    }

    public onKeyPressed(e: KeyboardEvent): void {
        switch (e.code) {
            case "Space":
                this.solver.paused = !this.solver.paused
                logger.info(`simulation has been **${this.solver.paused ? "paused" : "resumed"}**`)
                break
            case "KeyW":
                this.cloth.wireframe = !this.cloth.wireframe
                logger.info(`wireframe mode **${this.cloth.wireframe ? "enabled" : "disabled"}**`)
                break
        }
    }

    // stop stops the application.
    public stop(): void {
        this.stopped = true
    }
}

