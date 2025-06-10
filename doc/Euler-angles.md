# ZXZ Euler Angle Convention
The ZXZ convention is one of the twelve possible ways to represent 3D rotations using three successive rotations about coordinate axes. It's also known as the "classical Euler angles" or "proper Euler angles".
Definition
In the ZXZ convention, a rotation is decomposed into three successive rotations:

- φ (phi): Rotation around the Z-axis (0° to 360°)
- θ (theta): Rotation around the X-axis (0° to 180°)
- ψ (psi): Rotation around the Z-axis again (0° to 360°)

## Mathematical Representation
The combined rotation matrix is:
R = R_z(ψ) × R_x(θ) × R_z(φ)

Where:

- φ = azimuth angle (rotation about initial Z-axis)
- θ = inclination/polar angle (rotation about intermediate X-axis)
- ψ = rotation about final Z-axis

## Why ZXZ for Stress Analysis?
In structural geology and stress analysis, the ZXZ convention is particularly useful because:

- φ (azimuth): Describes the horizontal orientation of the principal stress direction
- θ (inclination): Describes how much the stress axis is tilted from vertical
- ψ (rotation): Describes rotation around the stress axis itself

This maps well to geological coordinate systems where:

- Z-axis = vertical (up/down)
- X,Y-axes = horizontal (north-south, east-west)

## Advantages and Disadvantages
### Advantages:

- Natural for many physical systems (especially those with a preferred vertical axis)
- Widely used in crystallography, geology, and astronomy
- θ directly gives the inclination from vertical

### Disadvantages:

- Gimbal lock occurs when θ = 0° or 180° (φ and ψ become indeterminate)
- Less intuitive than Tait-Bryan angles for some applications

## Key References
### Academic Papers & Books:

- Goldstein, H., Poole, C., & Safko, J. (2002)
"Classical Mechanics" (3rd Edition)
Addison-Wesley, Chapter 4: "The Kinematics of Rigid Body Motion"
→ Standard reference for Euler angle conventions

- Diebel, J. (2006)
"Representing Attitude: Euler Angles, Unit Quaternions, and Rotation Vectors"
Stanford University Technical Report
→ Excellent comparison of different rotation representations

- Shepperd, S.W. (1978)
"Quaternion from rotation matrix"
Journal of Guidance and Control, Vol. 1, No. 3, pp. 223-224
→ Classic paper on rotation conversions

### Geological/Stress Analysis References:

- Allmendinger, R.W., Cardozo, N., & Fisher, D.M. (2011)
"Structural Geology Algorithms: Vectors and Tensors"
Cambridge University Press
→ Excellent for stress tensor analysis in geology

- Ramsay, J.G. & Huber, M.I. (1987)
"The Techniques of Modern Structural Geology, Volume 2: Folds and Fractures"
Academic Press
→ Classic text on structural geology stress analysis

- Angelier, J. (1994)
"Fault slip analysis and paleostress reconstruction"
Continental Deformation, Pergamon Press
→ Fundamental reference for stress inversion methods

### Online Resources:

- Wikipedia: "Euler angles"
https://en.wikipedia.org/wiki/Euler_angles
→ Good overview with visual representations

- MathWorld: "Euler Angles"
https://mathworld.wolfram.com/EulerAngles.html
→ Mathematical definitions and formulas

- NASA Technical Publication (2008)
"Euler Angles, Quaternions, and Transformation Matrices"
NASA-TM-2008-215482
→ Practical guide with aerospace applications

## Alternative Conventions
For comparison, other common conventions include:

- ZYZ: Z-Y-Z (also proper Euler angles)
- XYZ: X-Y-Z (Tait-Bryan angles, "roll-pitch-yaw")
- ZYX: Z-Y-X (aerospace "yaw-pitch-roll")

## Implementation Note
In our stress analysis code, we use ZXZ because:

- It's natural for geological data (vertical reference)
- Widely used in crystallography and structural geology
- φ directly gives strike/azimuth information
- θ gives dip/inclination information

The choice of convention should always be clearly documented since the same physical rotation has different angle values in different conventions!
