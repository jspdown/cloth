const movingAverageLength = 5
const renderInterval = 200

class Timer {
    private _start: number

    private readonly deltas: number[]
    private readonly name: string
    private el: HTMLElement

    constructor(name: string, el: HTMLElement) {
        this.name = name
        this.deltas = []
        this.el = el
    }

    public start(): void {
        this._start = window.performance.now()
    }

    public end(): void {
        const delta = window.performance.now() - this._start

        this.deltas.push(delta)
        if (this.deltas.length > movingAverageLength) {
            this.deltas.splice(0, this.deltas.length - movingAverageLength)
        }
    }

    public render(): void {
        const sum = this.deltas.reduce((delta: number, acc: number) => acc + delta, 0)
        const avg = sum / this.deltas.length

        this.el.innerHTML = `
            <span class="timer">
                ${this.name}:
            </span>
            <span class="strong">${avg.toFixed(3)}</span> ms
        `
    }
}

class Monitor {
    private el: HTMLElement
    private timers: Timer[]

    public attach(el: HTMLElement): void {
        const ulEl = document.createElement("ul")

        el.appendChild(ulEl)

        this.el = ulEl

        this.timers = []

        setInterval(() => this.render(), renderInterval)
    }

    public createTimer(name: string): Timer {
        const el = document.createElement("li")
        this.el.appendChild(el)

        const timer = new Timer(name, el)

        this.timers.push(timer)

        return timer
    }

    private render(): void {
        this.timers.forEach(timer => timer.render())
    }
}

export const monitor = new Monitor()
