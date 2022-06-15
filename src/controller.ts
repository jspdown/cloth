import * as cpuSolver from "./physic/solver_cpu"
import * as gpuSolver from "./physic/solver_gpu"
import {buildPlaneGeometry} from "./geometry"
import {logger} from "./logger"
import {App} from "./app"

interface Config {
    paused: boolean
    solverType: SolverType

    cpuSolver: cpuSolver.Config
    gpuSolver: gpuSolver.Config

    cloth: ClothConfig
}

interface ClothConfig {
    width: number
    height: number
    widthDivisions: number
    heightDivisions: number
}

enum SolverType {
    CPU = "cpu",
    GPU = "gpu",
}

export class Controller {
    private readonly app: App
    private readonly device: GPUDevice

    private config: Config
    private renderNeeded: boolean

    private el: HTMLElement

    constructor(device: GPUDevice, app: App) {
        this.app = app
        this.device = device

        this.renderNeeded = true

        this.config = {
            paused: true,
            solverType: SolverType.CPU,
            cpuSolver: {
                deltaTime: 1/60,
                subSteps: 15,
                stretchCompliance: 0,
                bendCompliance: 0.3,
                relaxation: 0.2,
                method: cpuSolver.Method.GaussSeidel,
            },
            gpuSolver: {
                subSteps: 10,
            },
            cloth: {
                width: 10,
                height: 10,
                widthDivisions: 40,
                heightDivisions: 40,
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
                case "KeyW":
                    this.app.cloth.wireframe = !this.app.cloth.wireframe
                    logger.info(`wireframe mode **${this.app.cloth.wireframe ? "enabled" : "disabled"}**`)
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
            console.log("click!")
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

                        <label for="solver-type">
                            <span>solver type</span>
                            <select id="solver-type" name="solver-type">
                                <option ${this.config.solverType === SolverType.CPU ? "selected" : ""} value=${SolverType.CPU}>CPU</option>
                                <option ${this.config.solverType === SolverType.GPU ? "selected" : ""} value=${SolverType.GPU}>GPU</option>
                            </select>
                        </label>
                    </div>

                    ${this.config.solverType === SolverType.CPU
                        ? this.renderCPUSolverForm()
                        : this.renderGPUSolverForm()
                    }
                </div>

                <div class="row">
                    <button id="play">${this.config.paused ? "Play" : "Pause"}</button>
                    <button id="restart">Restart</button>
                    <button id="apply">Apply</button>
                </div>
            </form>
        `
    }

    private renderCPUSolverForm(): string {
        return `
            <div class="column">
                <label for="cpu-method">
                    <span>method</span>
                    <select id="cpu-method" name="cpu-method">
                        <option ${this.config.cpuSolver.method === cpuSolver.Method.Jacobi ? "selected" : ""} value=${cpuSolver.Method.Jacobi}>Jacobi</option>
                        <option ${this.config.cpuSolver.method === cpuSolver.Method.GaussSeidel ? "selected" : ""} value=${cpuSolver.Method.GaussSeidel}>Gauss-Seidel</option>
                    </select>
                </label>
                <label for="cpu-sub-steps">
                    <span>sub-steps</span>
                    <input type="number" id="cpu-sub-steps" name="cpu-sub-steps"
                        value=${this.config.cpuSolver.subSteps}
                        step=1
                        min=1
                        max=500 />
                </label>

                <label for="cpu-stretch-compliance">
                    <span>stretch compliance</span>
                    <input type="number" id="cpu-stretch-compliance" name="cpu-stretch-compliance"
                        value=${this.config.cpuSolver.stretchCompliance}
                        step=0.1
                        min=0
                        max=1 />
                </label>

                <label for="cpu-bend-compliance">
                    <span>bend compliance</span>
                    <input type="number" id="cpu-bend-compliance" name="cpu-bend-compliance"
                        value=${this.config.cpuSolver.bendCompliance}
                        step=0.1
                        min=0
                        max=1 />
                </label>

                <label for="cpu-relaxation">
                    <span>relaxation</span>
                    <input type="number" id="cpu-relaxation" name="cpu-relaxation"
                        value=${this.config.cpuSolver.relaxation}
                        step=0.05
                        min=0
                        max=2 />
                </label>
            </div>
        `
    }

    private renderGPUSolverForm(): string {
        return `
            <div class="column">
                <label for="gpu-sub-steps">
                    <span>sub-steps</span>
                    <input type="number" id="gpu-sub-steps" name="gpu-sub-steps"
                        value=${this.config.gpuSolver.subSteps}
                        step=1
                        min=1
                        max=500 />
                </label>
            </div>
        `
    }

    private updateApp(config: Config, forced: boolean = false) {
        const solverTypeChanged = config.solverType !== this.config.solverType
        const clothConfigChanged = config.cloth.width !== this.config.cloth.width
            || config.cloth.height !== this.config.cloth.height
            || config.cloth.widthDivisions !== this.config.cloth.widthDivisions
            || config.cloth.heightDivisions !== this.config.cloth.heightDivisions

        if (forced || clothConfigChanged) {
            logger.info("resetting the simulation with a new cloth geometry...")

            this.app.cloth.geometry = buildPlaneGeometry(this.device,
                config.cloth.width,
                config.cloth.height,
                config.cloth.widthDivisions,
                config.cloth.heightDivisions)
        }

        if (config.solverType === SolverType.CPU) {
            if (forced || solverTypeChanged) {
                logger.info("switching to CPU solver...")
                this.app.solver = new cpuSolver.Solver(config.cpuSolver)
            } else {
                console.log()
                this.app.solver.config = config.cpuSolver
            }
        } else {
            if (forced || solverTypeChanged) {
                logger.info("switching to GPU solver...")
                this.app.solver = new gpuSolver.Solver(this.device, config.gpuSolver)
            } else {
                this.app.solver.config = config.gpuSolver
            }
        }
    }

    private buildConfiguration(): Config {
        const data = new FormData(this.el.querySelector("form"))

        const config: Config = {
            ...this.config,

            solverType: data.get("solver-type") as SolverType,
            cloth: {
                width: parseFloat(data.get("cloth-width") as string),
                height: parseFloat(data.get("cloth-height") as string),
                widthDivisions: parseInt(data.get("cloth-width-divisions") as string),
                heightDivisions: parseInt(data.get("cloth-height-divisions") as string),
            }
        }

        if (config.solverType === SolverType.CPU) {
            config.cpuSolver = {
                ...this.config.cpuSolver,

                subSteps: parseInt(data.get("cpu-sub-steps") as string),
                stretchCompliance: parseFloat(data.get("cpu-stretch-compliance") as string),
                bendCompliance: parseFloat(data.get("cpu-bend-compliance") as string),
                relaxation: parseFloat(data.get("cpu-relaxation") as string),
                method: data.get("cpu-method") as cpuSolver.Method,
            }
        }

        if (config.solverType === SolverType.GPU) {
            config.gpuSolver = {
                ...this.config.gpuSolver,

                subSteps: parseInt(data.get("gpu-sub-steps") as string),
            }
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
        this.app.cloth.geometry = buildPlaneGeometry(this.device,
            this.config.cloth.width,
            this.config.cloth.height,
            this.config.cloth.widthDivisions,
            this.config.cloth.heightDivisions)
    }

    private togglePlay(): void {
        this.config.paused = !this.config.paused
        this.app.solver.paused = this.config.paused
        this.renderNeeded = true
    }
}
