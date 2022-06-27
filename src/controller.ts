import {logger} from "./logger"
import {buildPlaneGeometry} from "./geometry"
import {Solver, SolverConfig} from "./physic/solver"
import {App} from "./app"
import {Cloth} from "./cloth"

interface Config {
    paused: boolean
    solver: SolverConfig
    cloth: ClothConfig
}

interface ClothConfig {
    unit: number
    density: number
    width: number
    height: number
    widthDivisions: number
    heightDivisions: number
    stretchCompliance: number
    bendCompliance: number
}

export class Controller {
    private readonly app: App
    private readonly device: GPUDevice

    private config: Config
    private renderNeeded: boolean

    private el: HTMLElement

    constructor(app: App, device: GPUDevice) {
        this.app = app
        this.device = device

        this.renderNeeded = true

        this.config = {
            paused: true,
            solver: {
                deltaTime: 1/60,
                subSteps: 10,
                relaxation: 1,
            },
            cloth: {
                unit: 0.01,
                density: 0.270,
                width: 10,
                height: 10,
                widthDivisions: 10,
                heightDivisions: 10,
                stretchCompliance: 0,
                bendCompliance: 0.3,
            },
        }
    }

    public attach(el: HTMLElement): void {
        this.el = el
        this.updateApp(this.config, true)

        setInterval(() => this.run(), 50)

        window.addEventListener("keypress", (e: KeyboardEvent) => {
            switch (e.code) {
                case "Space":
                    this.togglePlay()
                    break
            }
        })
    }

    private run() {
        if (!this.renderNeeded) return
        this.el.innerHTML = this.render()
        this.renderNeeded = false

        const playButton = document.getElementById("play")
        const restartButton = document.getElementById("restart")
        const applyButton = document.getElementById("apply")

        playButton.addEventListener("click", (e) => {
            e.preventDefault()
            this.togglePlay()
        })

        restartButton.addEventListener("click", (e) => {
            e.preventDefault()
            this.restartSimulation()
        })

        applyButton.addEventListener("click", (e) => {
            e.preventDefault()

            this.apply()
        })
    }

    private render(): string {
        return `
            <form>
                <div>
                    <div class="column">
                        <label for="cloth-unit">
                            <span>unit</span>
                            <input type="number" id="cloth-unit" name="cloth-unit"
                                value=${this.config.cloth.unit}
                                step=0.001
                                min=0.000001
                                max=1000 />
                        </label>
                        <label for="cloth-density">
                            <span>density</span>
                            <input type="number" id="cloth-density" name="cloth-density"
                                value=${this.config.cloth.density}
                                step=0.001
                                min=0.000001
                                max=1000 />
                        </label>
                        <label for="cloth-width">
                            <span>width</span>
                            <input type="number" id="cloth-width" name="cloth-width"
                                value=${this.config.cloth.width}
                                step=1
                                min=0
                                max=500 />
                        </label>
                        <label for="cloth-height">
                            <span>height</span>
                            <input type="number" id="cloth-height" name="cloth-height"
                                value=${this.config.cloth.height}
                                step=1
                                min=0
                                max=500 />
                        </label>
                        <label for="cloth-width-divisions">
                            <span>width-division</span>
                            <input type="number" id="cloth-width-divisions" name="cloth-width-divisions"
                                value=${this.config.cloth.widthDivisions}
                                step=1
                                min=0
                                max=500 />
                        </label>

                        <label for="cloth-height-divisions">
                            <span>height-division</span>
                            <input type="number" id="cloth-height-divisions" name="cloth-height-divisions"
                                value=${this.config.cloth.heightDivisions}
                                step=1
                                min=0
                                max=500 />
                        </label>

                        <label for="cloth-stretch-compliance">
                            <span>stretch compliance</span>
                            <input type="number" id="cloth-stretch-compliance" name="cloth-stretch-compliance"
                                value=${this.config.cloth.stretchCompliance}
                                step=0.1
                                min=0
                                max=1 />
                        </label>

                        <label for="cloth-bend-compliance">
                            <span>bend compliance</span>
                            <input type="number" id="cloth-bend-compliance" name="cloth-bend-compliance"
                                value=${this.config.cloth.bendCompliance}
                                step=0.1
                                min=0
                                max=1 />
                        </label>
                    </div>

                    <div class="column">
                        <label for="solver-sub-steps">
                            <span>sub-steps</span>
                            <input type="number" id="solver-sub-steps" name="solver-sub-steps"
                                value=${this.config.solver.subSteps}
                                step=1
                                min=1
                                max=500 />
                        </label>
                    </div>
                </div>

                <div class="row">
                    <button id="play">${this.config.paused ? "Play" : "Pause"}</button>
                    <button id="restart">Restart</button>
                    <button id="apply">Apply</button>
                </div>
            </form>
        `
    }

    private updateApp(config: Config, forced: boolean = false) {
        const clothGeometryChanged = config.cloth.width !== this.config.cloth.width
            || config.cloth.height !== this.config.cloth.height
            || config.cloth.widthDivisions !== this.config.cloth.widthDivisions
            || config.cloth.heightDivisions !== this.config.cloth.heightDivisions
        const clothConfigChanged = config.cloth.stretchCompliance !== this.config.cloth.stretchCompliance
            || config.cloth.bendCompliance !== this.config.cloth.bendCompliance
            || config.cloth.unit !== this.config.cloth.unit
            || config.cloth.density !== this.config.cloth.density
        const solverConfigChanged = config.solver.subSteps !== this.config.solver.subSteps

        if (forced || clothGeometryChanged || clothConfigChanged) {
            logger.info("resetting the simulation with a new cloth geometry")

            const geometry = buildPlaneGeometry(this.device,
                config.cloth.width,
                config.cloth.height,
                config.cloth.widthDivisions,
                config.cloth.heightDivisions)

            this.app.cloth = new Cloth(this.device, geometry, {
                unit: config.cloth.unit,
                density: config.cloth.density,
                stretchCompliance: config.cloth.stretchCompliance,
                bendCompliance: config.cloth.bendCompliance,
            })
        }

        if (forced || solverConfigChanged || clothGeometryChanged || clothConfigChanged) {
            this.app.solver = new Solver(this.device, config.solver)
        }
    }

    private buildConfiguration(): Config {
        const data = new FormData(this.el.querySelector("form"))

        const config: Config = {
            ...this.config,

            cloth: {
                unit: parseFloat(data.get("cloth-unit") as string),
                density: parseFloat(data.get("cloth-density") as string),
                width: parseFloat(data.get("cloth-width") as string),
                height: parseFloat(data.get("cloth-height") as string),
                widthDivisions: parseInt(data.get("cloth-width-divisions") as string),
                heightDivisions: parseInt(data.get("cloth-height-divisions") as string),
                stretchCompliance: parseFloat(data.get("cloth-stretch-compliance") as string),
                bendCompliance: parseFloat(data.get("cloth-bend-compliance") as string),
            },
            solver: {
                ...this.config.solver,

                subSteps: parseInt(data.get("solver-sub-steps") as string),
            },
        }

        this.renderNeeded = true

        return config
    }

    private apply(): void {
        const config = this.buildConfiguration()
        this.updateApp(config)

        this.config = config
    }

    private restartSimulation(): void {
        const geometry = buildPlaneGeometry(this.device,
            this.config.cloth.width,
            this.config.cloth.height,
            this.config.cloth.widthDivisions,
            this.config.cloth.heightDivisions)

        this.app.cloth = new Cloth(this.device, geometry, {
            unit: this.config.cloth.unit,
            density: this.config.cloth.density,
            stretchCompliance: this.config.cloth.stretchCompliance,
            bendCompliance: this.config.cloth.bendCompliance,
        })
    }

    private togglePlay(): void {
        this.config.paused = !this.config.paused
        this.app.paused = this.config.paused

        this.renderNeeded = true
    }
}
