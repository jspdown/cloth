# Cloth simulation

### Getting Started

- Spawn a WebGPU capable browser:

    ```shell
    google-chrome-unstable \
        --enable-features=Vulkan,UseSkiaRenderer \
        --enable-unsafe-webgpu
    ```
    
    *Tested on Google Chrome (dev) >= Version 104.0.5083.0*


- Start serving the webapp:

    ```shell
    yarn start
    ```

### Next step: GPU graph coloring

This will be done by implementing the algorithm describe in the Vivace paper:
https://pellacini.di.uniroma1.it/publications/vivace16/vivace16-paper.pdf

A -- B
| /  |
C -- D

A - B
A - C

B - A
B - D 
B - C

C - A
C - B
C - D

D - B
D - C

delta = 3

Constraint partitions:
- [A-B, C-D]
- [A-C, B-D]
- [C, B]

Algorithm:
V = all constraints
U = remaining constraints to color
rU = constraints to remove from U
Pv = color palette of a constraint
Cv = color of a constraint
delta = max graph degree
s = shrinking factor (> 0)

U = V
for v in U:
    Pv = [0...delta/s]
while len(U) > 0:
    // Kernel 1: random color
    for v in U:
        Cv = rand(Pv)
    // Kernel 2: conflict resolution
    for v in U:
        S = neighbours_colors(v)
        if Cv not in S:
            set color on v
            remove v from U
            remove Cv from neighbours Pv
    // Kernel 3: Feed the palette if empty
    for v in U:
        if len(Pv) == 0:
            Pv = [max_color+1]


How to build a fast color neighbours lookup?
     c1
   A -- B
c2 | /c5| c3
   C -- D
     c4

c1 [c2, c3, c5]
c2 [c1, c4, c5]
c3 [c1, c4, c5]
c4 [c2, c3, c5]
c5 [c1, c2, c3, c4]

Solutions:

## Continuously stored:

neighbours_indexes: [0, 3, 5]
neighbours_colors: [c1(1), c1(2), c1(3), c2(1), c2(2), c3(1)]

PRO:
- Cache efficient
CON:
- Expensive to rebuild: Needs to be rebuilt each time a new constraint is added

## Linked list fashion:

neighbours_colors: [c1(1), 2, c2(1), MAX_INT, c1(2), MAX_INT]

PRO:
- Don't need to rewrite everything
CON:
- Might need multiple write to update
- Not cache efficient

## Multi-continously stored:


static_neighbours_indexes: [0, 3, 5]
dynamic_neighbours_indexes: [-1, 40, -1]
constraint_neighbours: [1, 2, 3, 6, 7, 4, 5]
constraint_available_colors: [ac1, ac2, ac3, ac4, ac5, ac6, ac7]
constraint_colors: [0, 0, 0, 1, 1, 2, 2, 2]

neighbours_colors: [c1(1), c1(2), c1(3), c2(1), c2(2), c3(1), [40...] c2(3)]

PRO:
- Update only the dynamic constraints
- Cache efficient
- Can be appended on the GPU without sorting!
CON:
- ?

The colors available on a neighbour can be expressed as a binary mask:
- Lookup is easy
- Remove is easy
- All the same size.
It limits the number of colors to the data type size: 32 or 64 colors.
!! But neighbours colors must be atomic uints !!  


# How to compute a random value on the GPU?

https://en.wikipedia.org/wiki/Xorshift might be good enough. It's only used to select a color within a set of delta/s colors.
to get the value from the index we simply need its power of 2.

# TODO:
- Construct neighbour buffer
  - Record max graph degree
  - Implement populateNeighbourhood
    - neighbourIndexes: all initialized with 0 (no color)
    - staticConstraintNeighbours
  

## To be explored
Generate neighbourg map on the GPU:
- For each constraint:
  - c.p1 c.p2


# Solution to improve the graph coloring performances:

- Use IndirectDispatch and let the kernel decide what should be the next dispatch size
  - First step: Simply write 0 when there's no need for more dipatch
    - And check every n cycles if we run it enough
  - Second step: Write in a buffer the constraints that remain to be colored
    - And compute the next dispatch size using these.
