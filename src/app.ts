import "./main.css"

import {PlaneGeometry} from "./geometry"
import {Cloth} from "./cloth"
import {Camera} from "./camera"
import {Renderer} from "./renderer"

class Solver {
    solve(deltaTime: number, cloth: Cloth): void {}
}

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

        const geometry = new PlaneGeometry(device, 4, 4, 4, 4)

        this.cloth = new Cloth(geometry)

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

                this.renderer.render(
                    this.cloth.getRenderPipeline(this.device, this.camera),
                    this.cloth.geometry,
                    this.camera)

                window.requestAnimationFrame(tick)
            }

            window.requestAnimationFrame(tick)
        })
    }

    public stop(): void {
        this.stopped = true
    }
}

