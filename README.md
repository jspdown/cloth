# Cloth Simulation

This is a cloth simulation project that uses extended position based dynamic (XPBD) and small step techniques. 
The project is implemented using WebGPU and the simulation runs entirely on the GPU.

## Demo

You can see a live demo of this project at [this link](https://jspdown.github.io/cloth/).

## Installation

To run this project locally, follow these steps:

1. Clone the repository to your local machine:

```bash
git clone https://github.com/your-username/cloth-simulation-project.git
```

2. Navigate to the project directory:

```bash
cd cloth-simulation-project
```

3. Install the dependencies:

```bash
yarn install
```

4. Start the development server:

```bash
yarn start
```

5. Open Google Chrome and go to [localhost:3000](localhost:3000) to see the project in action.

If you are on a Linux machine you need to install the latest [google-chrome-unstable version](https://www.ubuntuupdates.org/package/google_chrome/stable/main/base/google-chrome-unstable).
Then, chrome will have to be started using the following parameters:

```bash
google-chrome-unstable \
        --enable-features=Vulkan,UseSkiaRenderer \
        --enable-unsafe-webgpu
```

*Tested on Google Chrome (dev) >= Version 104.0.5083.0*

## Usage

To use the project, you can interact with the cloth simulation by clicking and dragging on the cloth surface. 
You can also adjust various parameters such as the bend and stretch compliance using the control panel on the right side of the screen.

## Implementation

This project is based on the following papers:
- [1] Position-Based Simulation of Compliant Constrained Dynamics (2016) https://matthias-research.github.io/pages/publications/XPBD.pdf (Miles Macklin, Matthias Müller, and Nuttapong Chentanez)
- [2] Small steps in physics simulation (2019) http://mmacklin.com/smallsteps.pdf (Miles Macklin, Kier Storey, Michelle Lu, Pierre Terdiman, Nuttapong Chentanez, Stefan Jeschke, and Matthias Müller)

The simulation runs on the GPU using a parallel Gauss-Seidel (constraint graph coloring).

