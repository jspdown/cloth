import "./main.css"

import {buildPlaneGeometry} from "./geometry"
import {Cloth} from "./cloth"
import {Camera} from "./camera"
import {Renderer} from "./renderer"
import {Vector3} from "@math.gl/core"

class Solver {
    solve(deltaTime: number, cloth: Cloth): void {}
}

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

        const geometry = buildPlaneGeometry(device, 4, 4, 4, 4)

        this.cloth = new Cloth(device, geometry, new Vector3(-2, 0, -2))

        this.camera = new Camera(device, {
            width: canvas.width,
            height: canvas.height,
        })

        this.renderer = new Renderer(canvas, device)
        this.solver = new Solver()
    }

    // run runs the application.
    public async run(): Promise<void> {
        this.stopped = false

        let lastTickTimestamp = Date.now()

        return new Promise((resolve, _) => {
            const tick = (timestamp: number) => {
                if (this.stopped) {
                    resolve()
                    return
                }

                const deltaTime = timestamp - lastTickTimestamp
                lastTickTimestamp = timestamp

                this.solver.solve(deltaTime, this.cloth)

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

    // stop stops the application.
    public stop(): void {
        this.stopped = true
    }
}

