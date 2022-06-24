import {App} from "./app"
import {logger} from "./logger"
import {monitor} from "./monitor"
import {Controller} from "./controller"

async function main() {
    const gpu: GPU = navigator.gpu
    if (!gpu) {
        throw new Error("WebGPU is not supported on this browser.")
    }

    const adapter = await gpu.requestAdapter()

    let limits = ""
    for (let key in adapter.limits as any) {
        limits += ` - ${key}: **${(adapter.limits as any)[key]}**\n`
    }
    logger.info(`limits:\n ${limits}`)

    const device = await adapter.requestDevice()

    const canvas = document.getElementById("app") as HTMLCanvasElement

    canvas.width = 1000
    canvas.height = 512

    const app = new App(canvas, device, adapter.limits)
    const controller = new Controller(app, device, adapter.limits)

    logger.attach(document.getElementById("logger"))
    monitor.attach(document.getElementById("monitor"))
    controller.attach(document.getElementById("controller"))

    return app.run()
}

main()
    .then(() => logger.info("done"))
    .catch(err => console.error(err.toString() + "\n" + err.stack))

