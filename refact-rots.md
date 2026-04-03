# Rotation System Refactoring Plan

## 1. Reference Systems and Notation

Three right-handed orthonormal reference systems:

| System | Name | Axes |
|--------|------|------|
| $S$ | Geographic | $X$ = East, $Y$ = North, $Z$ = Up |
| $S'$ | Interactive / intermediate | $X' = \hat{\sigma}_1'$, $Y' = \hat{\sigma}_3'$, $Z' = \hat{\sigma}_2'$ |
| $S''$ | Optimal / numerical | $X'' = \hat{\sigma}_1''$, $Y'' = \hat{\sigma}_3''$, $Z'' = \hat{\sigma}_2''$ |

> **Key convention:** the axes of $S'$ and $S''$ follow the ordering $(\sigma_1, \sigma_3, \sigma_2)$,
> **not** the natural ordering $(\sigma_1, \sigma_2, \sigma_3)$. This $\sigma_2$–$\sigma_3$ swap
> is the root cause of all the bugs described below.

Coordinate transforms:

$$\mathbf{v}' = R_{rot}\,\mathbf{v}, \qquad \mathbf{v}'' = D_{rot}\,\mathbf{v}', \qquad \mathbf{v}'' = W_{rot}\,\mathbf{v}$$

$$W_{rot} = D_{rot} \cdot R_{rot}$$

Stress tensor expressed in $S$:

$$\mathbf{S} = W_{rot}^T \cdot \mathbf{S}'' \cdot W_{rot}$$

where the principal stress tensor in $S''$ is, consistent with the $(\sigma_1,\sigma_3,\sigma_2)$ axis ordering:

$$\mathbf{S}'' = \begin{pmatrix} 1 & 0 & 0 \\ 0 & 0 & 0 \\ 0 & 0 & R \end{pmatrix}, \qquad R = \frac{\sigma_2 - \sigma_3}{\sigma_1 - \sigma_3} \in [0,1]$$

---

## 2. The $\sigma_2$–$\sigma_3$ Swap: Convention Definition

The ZXZ Euler angles $(\varphi, \theta, \psi)$ parameterise the matrix $D_T \equiv D_{rot}^T$.
Reading the library source (`rotationTensorDT`), its columns are:

$$D_T = \bigl[\,\hat{\sigma}_1'' \;\big|\; \hat{\sigma}_3'' \;\big|\; \hat{\sigma}_2''\,\bigr]$$

Explicitly:

$$D_T = \begin{pmatrix}
\cos\varphi\cos\theta & -\sin\varphi\cos\psi + \cos\varphi\sin\theta\sin\psi & \sin\varphi\sin\psi + \cos\varphi\sin\theta\cos\psi \\
\sin\varphi\cos\theta &  \cos\varphi\cos\psi + \sin\varphi\sin\theta\sin\psi & -\cos\varphi\sin\psi + \sin\varphi\sin\theta\cos\psi \\
-\sin\theta           &  \cos\theta\sin\psi                                  & \cos\theta\cos\psi
\end{pmatrix}$$

Column 0 points along $\sigma_1$, column 1 along $\sigma_3$, column 2 along $\sigma_2$.
The $\sigma_2$ and $\sigma_3$ columns are **interchanged** relative to the natural ordering.

Define $\mathbf{E}$ as the matrix whose columns are the eigenvectors in natural order:

$$\mathbf{E} = \bigl[\,\hat{\sigma}_1 \;\big|\; \hat{\sigma}_2 \;\big|\; \hat{\sigma}_3\,\bigr]$$

Then the library convention is:

$$D_T = \mathbf{E} \cdot P_{23}$$

where $P_{23}$ is the permutation matrix that swaps columns 2 and 3:

$$P_{23} = \begin{pmatrix} 1 & 0 & 0 \\ 0 & 0 & 1 \\ 0 & 1 & 0 \end{pmatrix}$$

---

## 3. The Bug in `tensor_analysis.ts`

`decomposeStressTensor` sorts eigenvectors by magnitude and builds:

$$r = \begin{pmatrix} \hat{\sigma}_1^T \\ \hat{\sigma}_2^T \\ \hat{\sigma}_3^T \end{pmatrix} = \mathbf{E}^T$$

It then applies the standard ZXZ extraction formula as if $r = D_T$. But:

$$r = \mathbf{E}^T = (D_T \cdot P_{23}^{-1})^T = P_{23} \cdot D_T^T = P_{23} \cdot W_{rot}$$

This is a fundamentally different matrix. The resulting Euler angles are **incompatible** with
$(\varphi, \theta, \psi)$ as used in `computeMisfitAt` and the landscape visualization.

### Correct extraction from $W_{rot}$

Since $D_T = W_{rot}^T$ (when $R_{rot} = \mathbf{I}$), we can read the Euler angles
directly from $W_{rot}$ using the structure of $D_T$:

$$D_T[2,0] = -\sin\theta \quad\Rightarrow\quad \boxed{\theta = \arcsin\bigl(-W_{rot}[0,2]\bigr)}$$

$$D_T[1,0] = \sin\varphi\cos\theta, \quad D_T[0,0] = \cos\varphi\cos\theta \quad\Rightarrow\quad \boxed{\varphi = \operatorname{atan2}\!\bigl(W_{rot}[0,1],\; W_{rot}[0,0]\bigr)}$$

$$D_T[2,1] = \cos\theta\sin\psi, \quad D_T[2,2] = \cos\theta\cos\psi \quad\Rightarrow\quad \boxed{\psi = \operatorname{atan2}\!\bigl(W_{rot}[1,2],\; W_{rot}[2,2]\bigr)}$$

(indices are $[row, col]$, 0-based; $D_T[i,j] = W_{rot}[j,i]$)

Gimbal lock occurs when $|\cos\theta| < \varepsilon$, i.e. $\theta \approx \pm 90°$; in that
case only $\varphi + \psi$ (or $\varphi - \psi$) is determined.

---

## 4. Impact on the Parameter Space Landscape

### What the landscape plots

The visualization sweeps four parameters $(\varphi, \theta, \psi, R)$ and colours each point by
the mean misfit $\bar{m}(\varphi,\theta,\psi,R)$. The computation path is correct:

$$D_T(\varphi,\theta,\psi) \xrightarrow{\text{transpose}} W_{rot} \xrightarrow{\text{engine}} \bar{m}$$

The **dot** (global minimum) is placed by scanning the entire computed grid, so it is
always at the correct minimum (blue cell). This part is unaffected by the convention bug.

### Where the bug manifests: `centerOnSolution`

The "Center on solution" button should zoom the axis ranges to $\pm\delta$ around the solution
angles. It currently reads `solution.analysis.eulerAnglesDegrees`, which are extracted from
$r = \mathbf{E}^T$ (wrong). So the extracted $(\hat\varphi, \hat\theta, \hat\psi)$ do **not**
correspond to the same $W_{rot}$ that was stored as the solution.

Concretely, the landscape at the true solution angles is:

$$\varphi^* = \operatorname{atan2}(W^*[0,1],\, W^*[0,0]), \quad
\theta^* = \arcsin(-W^*[0,2]), \quad
\psi^*   = \operatorname{atan2}(W^*[1,2],\, W^*[2,2])$$

But `centerOnSolution` centres on angles derived from $P_{23}\,W_{rot}^*$, which differ
from $(\varphi^*, \theta^*, \psi^*)$ by a permutation of two rows — producing angles that
can be far from the actual minimum in the landscape.

### Why some cells are blue and the dot is not centred

The misfit landscape is correct (blue = minimum at the true optimum).
The dot is correctly at the global minimum by construction.
But when `centerOnSolution` is called, the zoomed-in window is centred at the
**wrong** angles, so the minimum (blue region) may lie outside the displayed range,
and cells that happen to be low-misfit within the wrong window appear blue instead.

---

## 5. Required Changes

### Group A — Independent of architecture discussion

#### A1. Fix Euler angle extraction (`src/math/tensor_analysis.ts`)

Replace the extraction from $r = \mathbf{E}^T$ by the formula derived in §3,
applied directly to $W_{rot}$ stored in the solution (see A2).
The function signature changes from accepting a reconstructed rotation matrix
to accepting $W_{rot}$ as a $3\times 3$ array.

#### A2. Store $W_{rot}$ in `StressSolution` (`src/components/types.ts`, `RunComponent.tsx`)

Add `rotationMatrixW: number[][]` to `StressSolution`.
After `inv.run()`, copy `sol.rotationMatrixW` directly into the solution object
and derive the Euler angles via the corrected formula (A1).
This avoids the lossy round-trip through eigendecomposition.

#### A3. Fix `centerOnSolution` (`ParameterSpaceLandscapeComponent.tsx`)

Once A1 and A2 are in place, `solution.analysis.eulerAnglesDegrees` will be correct.
The button logic then works as intended; add only domain clamping:

$$\varphi \in [0°, 360°], \quad \theta \in [0°, 180°], \quad \psi \in [0°, 360°], \quad R \in [0, 1]$$

#### A4. Rebuild `@alfredo-taboada/stress`

The library source already exports `computeMisfitAt` and `HomogeneousEngine`.
Run `npm run build` in `../stress` so the tectostress app can use typed imports
instead of `engine: any`.

---

### Group B — Requires partner discussion (architecture)

#### B1. Compose $W_{rot} = D_{rot} \cdot R_{rot}$ in all search methods

Currently `MonteCarlo`, `MCMC`, `MCMCQuaternion`, `MonteCarloQuaternion` sample
a rotation $D_{rot}$ but set the engine with $W_{rot} = D_{rot}$ (implicitly $R_{rot} = \mathbf{I}$).
The correct composition is:

$$W_{rot} = D_{rot} \cdot R_{rot}$$

`GridSearch` already performs this product; the other methods need the same pattern.
Default: $R_{rot} = \mathbf{I}$ recovers the current behaviour.

#### B2. $R_{rot}$ as persistent app state

$R_{rot}$ is a session-level variable set by the user's interactive initialisation
and passed to every search method via `setInteractiveSolution`. It must survive
across multiple runs and be serialisable as a $3\times 3$ array.

#### B3. Manual axis input UI — case (a)

The user specifies $\sigma_1$ trend/plunge and optionally $\sigma_3$ trend/plunge
plus an initial $R_0$. From geographic coordinates (trend $\alpha$, plunge $\delta$):

$$\hat{\sigma}_1 = \begin{pmatrix} \cos\delta\sin\alpha \\ \cos\delta\cos\alpha \\ -\sin\delta \end{pmatrix}$$

$R_{rot}$ is then the matrix whose columns are $[\hat{\sigma}_1,\, \hat{\sigma}_3,\, \hat{\sigma}_2]$
in $S$, completing a right-handed basis.

#### B4. Sphere-based interactive tool — case (b)

When the user drags principal stress axes on the Wulff sphere, the result is
converted to $R_{rot}$ via the same formula as B3 and stored in app state (B2).

#### B5. Landscape adaptation for $R_{rot} \neq \mathbf{I}$

When an interactive solution is active, the landscape axes become **offset** angles
$(\Delta\varphi, \Delta\theta, \Delta\psi)$ around $R_{rot}$, and the misfit is
computed as:

$$W_{rot}(\Delta\varphi,\Delta\theta,\Delta\psi) = D_{rot}(\Delta\varphi,\Delta\theta,\Delta\psi) \cdot R_{rot}$$

Axis labels should reflect the mode: "Absolute $(\varphi,\theta,\psi)$" vs.
"Offset $(\Delta\varphi,\Delta\theta,\Delta\psi)$ from interactive solution".

---

## 6. Implementation Order

```
A4 (rebuild library)
  │
  ├─ A1 (fix extractEulerAngles from W_rot)
  │    └─ A2 (store rotationMatrixW in StressSolution)
  │         └─ A3 (fix centerOnSolution)
  │
  └─ [independent of B]

B2 (R_rot app state)
  ├─ B1 (search methods: W = D·R)
  ├─ B3 (manual axis input UI)  ─┐
  └─ B4 (sphere tool)           ─┴─ B5 (landscape offset mode)
```

---

## 7. Files Summary

| File | Group | Change |
|------|-------|--------|
| `src/math/tensor_analysis.ts` | A1 | Extract Euler angles from $W_{rot}$ using §3 formulas |
| `src/components/types.ts` | A2 | Add `rotationMatrixW: number[][]` to `StressSolution` |
| `src/components/RunComponent.tsx` | A2 | Populate `rotationMatrixW`; use corrected Euler extraction |
| `src/components/ParameterSpace/ParameterSpaceLandscapeComponent.tsx` | A3, B5 | Fix `centerOnSolution`; add offset mode for $R_{rot} \neq \mathbf{I}$ |
| `../stress` (rebuild) | A4 | `npm run build` |
| `src/App.tsx` | B2 | Add `interactiveRot` ($R_{rot}$) state |
| `../stress/src/lib/search/MonteCarlo.ts` | B1 | Compose $W = D \cdot R_{rot}$ |
| `../stress/src/lib/search/MCMC.ts` | B1 | Same |
| `../stress/src/lib/search/MCMCQuaternion.ts` | B1 | Same (quaternion composition) |
| `../stress/src/lib/search/MonteCarloQuaternion.ts` | B1 | Same |
| `src/math/axesFromTrendPlunge.ts` | B3 | New: trend/plunge $\to$ $R_{rot}$ |
| `src/components/InteractiveSolution/ManualAxisInputComponent.tsx` | B3 | New UI component |
