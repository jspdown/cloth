import {Cloth} from "./cloth";

export interface Solver {
    add(cloth: Cloth): void
    solve(): Promise<void>
}
