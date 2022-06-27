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
    const device = await adapter.requestDevice()

    printLimits(adapter.limits)

    const canvas = document.getElementById("app") as HTMLCanvasElement

    canvas.width = 1000
    canvas.height = 512

    const app = new App(canvas, device)
    const controller = new Controller(app, device)

    logger.attach(document.getElementById("logger"))
    monitor.attach(document.getElementById("monitor"))
    controller.attach(document.getElementById("controller"))

    return app.run()
}

main()
    .then(() => logger.info("done"))
    .catch(err => console.error(err.toString() + "\n" + err.stack))


function printLimits(limits: GPUSupportedLimits) {
    let str = ""
    for (let key in limits as any) {
        str += ` - ${key}: **${(limits as any)[key]}**\n`
    }

    logger.info(`limits:\n ${str}`)
}
