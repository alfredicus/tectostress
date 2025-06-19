# Theoretical Framework

1. Stress Tensor 

Let $\mathrm{\bm \sigma} $ be the stress tensor in the principal reference frame $S = (x_1, x_2, x_3)$ (vectors and tensors are denoted using a bold-face font) (Fig. 1) :

$\bm \sigma = \begin{pmatrix} \sigma_1&0&0 \\ 0&\sigma_3&0 \\ 0&0&\sigma_2 \end{pmatrix} $

$S$ is defined by a right-handed) orthonormal basis $(\bm x_1, \bm x_2, \bm x_3) $

Stress tensor $\mathrm{\bm \sigma} $ is defined in a strike-slip tectonic regime such that :

The compressional axis $\sigma_1 $ points in direction $x_1$

The extensional axis $\sigma_3 $ points in direction $x_2$

The intermediate axis $\sigma_2 $ points in direction $x_3$

For stress calculations we use the sign convention of continuum mechanics such that extensional stresses are positive whereas compressional stresses are negative. Thus, the principal stresses in the crust are in general negative due to lithostatic pressure (i.e., $\sigma_i < 0$, for $i = 1,2,3$).

2. Fault Plane 

A fault plane is defined by the corresponding plane tangent to the unit sphere at point $m$ (Fig. 1).

Let $\bm n$ be the unit vector normal to the fault plane pointing outward :

$\bm n =\begin{pmatrix} n_1 \\ n_2 \\ n_3 \end{pmatrix}$

$\bm n$ is defined as the position vector of point $m$ in the unit sphere.

3. Applied Stress on a Fault Plane

The applied stress $f$ on the fault plane is defined by the multiplication of the stress tensor $\mathrm{\bm \sigma} $ by the column vector $\bm n$ : 

$ \bm f = \sigma n $

$\begin{pmatrix} f_1 \\ f_2 \\ f_3 \end{pmatrix} = \begin{pmatrix} \sigma_1&0&0 \\ 0&\sigma_3&0 \\ 0&0&\sigma_2 \end{pmatrix} \begin{pmatrix} n_1 \\ n_2 \\ n_3 \end{pmatrix} $

$\bm f$ can be decomposed into a normal and a shear component $\bm \sigma_n$ and $\bm \tau$, which are perpendicular and  parallel to the fault plane, repectively.

The normal stress $ \sigma_n$ is defined as the projection of the applied stress $\bm f$ in the normal direction $\bm n$. Thus, its signed value can obtained from the scalar product of the two vectors : 

$ \sigma_n = \bm f \cdot \bm n$


![Sphere stress plane|300](/help/images/theory/Sphere_stress_plane.jpg)

4. Reference System in Spherical Coordinates

The normal vector $\bm n$ perpendicular to the fault plane and pointing upward is defined in spherical ccordinates by two angles :

The azimuthal angle $\phi$ in interval $ [0, 2\pi]$

The polar angle $\theta$ in interval $ [0, \pi / 2]$

<p align="center">
    <img src="./images/Sphere_coord_sys.jpg"
    width="500">
</p>

We define a local orthogonal reference system

$\sum_{i=0}^4a_i \sigma$
  
$\begin{pmatrix} \sigma_1&0&0 \\ 0&\sigma_3&0 \\ 0&0&\sigma_2 \end{pmatrix} $ 
$\begin{pmatrix} n_1 \\ n_2 \\ n_3 \end{pmatrix}$

<p align="center">
    <img src="./images/Sphere_stress_components.jpg"
    width="500">
</p>

### References
- [Polygonal fault systems and channel boudinage: 3D analysis of multidirectional extension in analogue sandbox experiments](https://www.researchgate.net/publication/229182350_Polygonal_fault_systems_and_channel_boudinage_3D_analysis_of_multidirectional_extension_in_analogue_sandbox_experiments)