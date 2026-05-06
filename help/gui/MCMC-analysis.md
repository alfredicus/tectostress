# MCMC & Monte Carlo Stress Inversion: Analysis Guide

## Table of Contents
1. [MCMC vs Monte Carlo](#mcmc-vs-monte-carlo)
2. [Why Best-Fit and Posterior Mean Differ](#why-values-differ)
3. [Chain Diagnostics (MCMC only)](#chain-diagnostics)
4. [Tuning Parameters](#tuning-parameters)
5. [Stress Ratio Bimodality](#stress-ratio-bimodality)
6. [Stress Axis Orientations](#stress-axis-orientations)
7. [How to Read the Statistics](#how-to-read-stats)
8. [How to Read the Histograms](#how-to-read-histograms)

---

## MCMC vs Monte Carlo

### When to Use Each Method

**MCMC (Markov Chain Monte Carlo):**
- **Best for:** Efficient exploration of high-dimensional parameter spaces
- **Advantage:** Focuses sampling on high-probability regions
- **Typical use:** Standard stress inversions with moderate data counts
- **Output:** Weighted posterior samples from converged chains

**Monte Carlo:**
- **Best for:** Simple, unbiased sampling when parameter space is well-behaved
- **Advantage:** No tuning required, no convergence issues
- **Typical use:** Quick exploratory runs or when MCMC convergence is problematic
- **Output:** Uniform random samples filtered by acceptance threshold

### Key Differences in Output

**MCMC shows:**
- Chain diagnostics (convergence metrics)
- Tuning parameters (proposal widths)
- Acceptance rate (optimal: ~23%)

**Monte Carlo shows:**
- Total samples generated
- Accepted fraction
- Acceptance threshold used (e.g., "50% CI")
- **Best-fit vs Mean comparison** (important for detecting non-Gaussian posteriors)

---

## Why Values Differ {#why-values-differ}

**Euler Angles (below eigenvectors)** = angles extracted from the single best-fit stress tensor (the one solution with lowest misfit).

**Posterior Euler Angles** = angles extracted from every accepted sample (thousands of rotation matrices), then averaged. These represent the mean of the posterior distribution, not the best-fit point.

### They differ because:
- The **best-fit** is one specific point (the MAP estimate)
- The **posterior mean** averages over all accepted samples, which may center slightly differently
- Euler angles can have wrapping issues (e.g., φ jumping between -180° and +180°), which can shift the mean
- If the posterior is **non-Gaussian** (skewed or multimodal), best-fit ≠ mean

**Same for R (stress ratio):** the top card shows the best-fit R, while the posterior shows mean ± std across all samples.

### ⚠️ Large Differences = Important Signal

In **Monte Carlo** results, if best-fit and posterior mean differ significantly (e.g., |Δ| > 0.1 for R), this indicates:
- The posterior is **not Gaussian** (skewed or multimodal)
- You should **report both values** separately
- The histogram shape is critical for interpretation

---

## Chain Diagnostics (MCMC only) {#chain-diagnostics}

MCMC uses multiple independent chains to ensure robust sampling. The chain diagnostics panel shows whether your chains have converged.

### Gelman-Rubin R̂ (Convergence Statistic)

**What it measures:** Whether independent chains have converged to the same distribution.

**Formula:** Compares within-chain variance to between-chain variance.

**Interpretation:**
- **R̂ < 1.01** ✓ **Converged** — Chains agree, results are reliable
- **1.01 ≤ R̂ < 1.05** ⚠️ **Marginal** — Borderline, consider running longer
- **R̂ ≥ 1.05** ✗ **Not converged** — Chains disagree, results unreliable

**If R̂ is too high:**
1. Increase burn-in period (discard more initial samples)
2. Run chains longer
3. Check tuning parameters (acceptance rate should be ~23%)
4. Consider starting chains from more dispersed initial positions

### Effective Sample Size (N_eff)

**What it measures:** The number of independent samples, accounting for autocorrelation.

**Why it matters:** MCMC samples are correlated. If τ (autocorrelation time) = 10, then 10,000 raw samples ≈ 1,000 independent samples.

**Interpretation:**
- **N_eff > 1000** ✓ **Sufficient** — Good statistical precision
- **500 < N_eff < 1000** ⚠️ **Low** — Acceptable but marginal
- **N_eff < 500** ✗ **Too low** — Increase chain length or thinning

**Formula:** N_eff ≈ (total samples) / τ

**If N_eff is too low:**
1. Run longer chains (more samples)
2. Increase thinning interval (keep every k-th sample)
3. Run more independent chains

### Autocorrelation Time (τ)

**What it measures:** How many steps it takes for samples to become approximately independent.

**Interpretation:**
- **τ ≈ 1–5:** Very efficient sampling, low correlation
- **τ ≈ 10–50:** Typical for stress inversion problems
- **τ > 100:** Poor mixing, consider adjusting tuning parameters

**Relationship to thinning:** Set thinning interval ≈ τ to get nearly independent samples.

### Chain Setup Info

- **Chains:** Number of independent chains run (recommended: 4–8)
- **Burn-in:** Initial samples discarded (~20% of total)
- **Thinning:** Keep every k-th sample (e.g., 1:10 = keep every 10th)

---

## Tuning Parameters {#tuning-parameters}

These control how MCMC explores the parameter space.

### σ_rot (Rotation Proposal Width)

**What it controls:** How much the rotation matrix changes at each MCMC step.

**Units:** Radians

**Typical values:** 0.02–0.5 radians (1°–30°)

**Effect:**
- **Too small:** Chains move slowly, high autocorrelation (τ ↑)
- **Too large:** Many proposals rejected, acceptance rate drops
- **Optimal:** Adjust to achieve ~23% acceptance rate

### σ_R (Stress Ratio Proposal Width)

**What it controls:** How much R changes at each MCMC step.

**Typical values:** 0.01–0.2

**Effect:**
- **Too small:** Slow exploration of R space
- **Too large:** Frequent rejection, inefficient sampling

### σ_noise (Angular Noise)

**What it represents:** Expected angular measurement uncertainty per datum.

**Default:** 10° (π/18 radians)

**Effect:**
- **Smaller σ_noise:** Sharper posteriors, assumes high-quality data
- **Larger σ_noise:** Broader posteriors, accounts for data uncertainty

**Not a tuning parameter per se** — this should reflect your actual measurement precision.

### Target Acceptance Rate: 23%

**Why 23%?** Theoretical optimum for Metropolis-Hastings algorithm in multi-dimensional spaces.

**Interpretation:**
- **18%–28%** ✓ **Optimal range** — Efficient sampling
- **<15% or >35%** — Adjust σ_rot and σ_R

**If acceptance rate is too low (<15%):**
- Decrease σ_rot and/or σ_R (smaller proposal steps)

**If acceptance rate is too high (>35%):**
- Increase σ_rot and/or σ_R (larger proposal steps, but may increase τ)

---

## Stress Ratio Bimodality {#stress-ratio-bimodality}

### ⚠️ What is a Bimodal R Distribution?

When you see the **orange warning box** with two peaks, your stress ratio (R) distribution shows peaks near **R ≈ 0 and R ≈ 1** with a trough in between.

**This is NOT a numerical error.** It reflects genuine **physical degeneracy** in your data.

### Physical Meaning of the Two Peaks

**R ≈ 0 (first peak):**
- Stress ellipsoid is **prolate** (cigar-shaped)
- σ₂ ≈ σ₃ (intermediate and minimum principal stresses are equal)
- Axially symmetric around σ₁
- Any rotation mixing σ₂ and σ₃ produces the **same stress tensor**
- The data **cannot distinguish** these rotations

**R ≈ 1 (second peak):**
- Stress ellipsoid is **oblate** (pancake-shaped)
- σ₁ ≈ σ₂ (maximum and intermediate principal stresses are equal)
- Axially symmetric around σ₃
- Any rotation mixing σ₁ and σ₂ is equally valid

### Why Do Degenerate States Show Up as Peaks?

In both cases, a **larger number** of distinct orientations produce equally good fits to the data. This directly translates to higher counts in those R bins in the histogram.

**The data genuinely support both solutions equally well.**

### How to Interpret and Report Bimodal Results

1. **✓ DO report the bimodal distribution as-is** — it is the correct answer
2. **✓ DO examine stress axis orientations** for each peak separately (they may point in similar or different directions)
3. **✓ DO note both mode locations** (e.g., "R ≈ 0.05 and R ≈ 0.92")
4. **✗ DO NOT average the two peaks** — the mean R ≈ 0.5 would correspond to a tensor that is **not** a solution
5. **✓ DO understand the symmetry:** A solution at R ≈ 0 with axes (σ₁, σ₂, σ₃) is physically related to a solution at R ≈ 1 with axes obtained by permuting σ₁ ↔ σ₃

### When R is Completely Unconstrained

If the R histogram is **flat** or **uniformly distributed**, the data place **no constraint whatsoever** on the shape of the stress ellipsoid.

**This is still valid!** The stress axis orientations may be well constrained even if R is not. Shape and orientation are independent pieces of information.

---

## Stress Axis Orientations {#stress-axis-orientations}

### Understanding the Orientation Table

The table shows the mean orientation of each principal stress axis:

| Column | Meaning |
|--------|---------|
| **Trend** | Azimuth in degrees [0°, 360°), measured clockwise from North |
| **Plunge** | Inclination in degrees [0°, 90°], where 0° = horizontal, 90° = vertical |
| **R̄** | Mean resultant length, measures dispersion [0, 1] |
| **Fisher 95°** | 95% confidence cone half-angle |
| **Fisher 68°** | 68% confidence cone (≈ 1σ equivalent) |

### σ₁, σ₂, σ₃ Convention

- **σ₁** = Maximum principal stress (most compressive)
- **σ₂** = Intermediate principal stress
- **σ₃** = Minimum principal stress (least compressive / most tensile)

**Always:** σ₁ ≥ σ₂ ≥ σ₃

### Mean Resultant Length (R̄)

**What it measures:** How tightly clustered the axis orientations are across all accepted samples.

**Interpretation:**
- **R̄ ≈ 1.0** — Perfect clustering, all samples point in nearly the same direction → **well-constrained axis**
- **R̄ ≈ 0.5–0.9** — Moderate dispersion, some uncertainty in orientation
- **R̄ ≈ 0** — Uniform dispersion, axis direction is **completely unconstrained**

**Formula (Fisher statistics):**
$$\bar{R} = \frac{1}{N} \left| \sum_{i=1}^{N} \hat{\mathbf{e}}_i \right|$$

where $\hat{\mathbf{e}}_i$ is the unit vector for sample $i$.

### Fisher Confidence Cones

**What they represent:** There is a 95% (or 68%) probability that the **true stress axis** lies within a cone of half-angle δ around the mean direction.

**Formula:**
$$\delta_p = \arccos\left(1 - \frac{1-\bar{R}}{\bar{R}} \ln\frac{1}{1-p/100}\right)$$

**Interpretation:**
- **Small cone (e.g., 5°–15°)** — Axis is well constrained
- **Large cone (e.g., 30°–60°)** — High uncertainty, axis poorly constrained
- **Very large cone (>70°)** or **NaN** — Axis essentially unconstrained (R̄ too low)

**95% vs 68% cones:**
- **Fisher 95°** — Conservative, standard for publication
- **Fisher 68°** — Narrower, approximately 1 standard deviation equivalent

### When an Axis is Unconstrained

If R̄ is very low (<0.3) or Fisher cones are very large, the axis orientation is poorly constrained. This commonly happens when:
- R ≈ 0: σ₂ and σ₃ axes are **interchangeable** (prolate degeneracy)
- R ≈ 1: σ₁ and σ₂ axes are **interchangeable** (oblate degeneracy)
- Insufficient or low-quality data

**This is valuable information!** It tells you what your data can and cannot resolve.

---

## How to Read the Stats {#how-to-read-stats}

### Example: φ (Phi): 45.2° ± 12.3° and 90% CI: [25.1°, 68.7°]

**Breaking it down:**
- **45.2°** = Posterior mean value across all accepted samples
- **± 12.3°** = Standard deviation (spread/uncertainty)
- **90% CI: [25.1°, 68.7°]** = 90% of samples fall between these bounds — this is your **credible interval**

**Interpretation:**
- **Smaller std / tighter CI** = better constrained parameter
- **Larger std / wider CI** = higher uncertainty

### Understanding Credible Intervals (CI)

**What is a credible interval?**
In Bayesian statistics, a 90% credible interval means: "There is a 90% probability that the true parameter value lies within this interval, given the data."

**50% vs 95% CI:**
- **50% CI** — The probable range (inner 50% of samples)
- **95% CI** — The conservative range (outer 95% of samples)

**The slider** lets you adjust the CI level dynamically from 50% to 99%.

**Why report both?**
- **50% CI** gives the most likely range
- **95% CI** gives a conservative uncertainty estimate for publication

### Stress Ratio Statistics

The enhanced stress ratio display shows:
- **Mean ± Std** — Central tendency and spread
- **50% CI** — [Q25, Q75] — Inner half of distribution
- **95% CI** — [Q5, Q95] — Outer 95% of distribution

**If bimodal:**
- Orange warning box appears
- Two mode locations shown (e.g., R ≈ 0.05, R ≈ 0.92)
- **DO NOT use the mean** — report both modes separately

## How to Read the Histograms {#how-to-read-histograms}

### Histogram Components

Each histogram shows the **posterior distribution** of a parameter:

**Visual Elements:**
- **X-axis:** Parameter value (min to max labeled at bottom)
- **Y-axis:** Frequency (count) — how many samples fell in each bin
- **Bars (colored):** Distribution of sample values
- **Shaded band:** Credible interval (CI) — adjustable via slider
- **Green vertical line:** Best-fit value (lowest misfit)
- **Red dashed line:** Posterior mean (μ)
- **Orange diamond:** Mode (peak of distribution)
- **Dashed boundaries:** CI edges (e.g., Q5 and Q95 for 90% CI)

### What to Look For

**1. Shape — Overall Distribution:**
- **Single sharp peak** → Well-constrained parameter, confident inversion
- **Wide, flat distribution** → Poorly constrained, high uncertainty
- **Two clear peaks (bimodal)** → Data supports multiple solutions (especially R)
- **Skewed distribution** → Mean and mode will differ

**2. Markers — Best-fit vs Mean vs Mode:**
- **Green line (best-fit):** Single optimal solution (MAP estimate)
- **Red line (mean):** Average across all samples (Bayesian estimate)
- **Orange diamond (mode):** Peak of distribution (most frequent value)

**Key question:** "How tight is the distribution around these markers?"

**Ideal case:**
- All three markers (green, red, orange) align closely
- Distribution is a narrow peak
- **Interpretation:** Robust, well-constrained result

**Problematic cases:**
- Green and red lines **far apart** → Non-Gaussian posterior
- Distribution is **wide/flat** → Poor constraint, report large uncertainty
- **Multiple peaks** → See bimodality section above

**3. Width — Credible Interval:**
The shaded band shows your uncertainty:
- **Narrow band** → High precision
- **Wide band** → Low precision, parameter weakly constrained

Adjust the CI slider (50%–99%) to see how uncertainty changes.

### Example Interpretations

**Stress Ratio Histogram:**
- **Narrow peak at R ≈ 0.7:** Data strongly prefer this stress ratio
- **Two peaks at R ≈ 0 and R ≈ 1:** Physical degeneracy (see Bimodality section)
- **Flat distribution:** R is completely unconstrained by the data

**Euler Angle Histograms:**
- **Narrow peak:** Rotation is well-constrained
- **Wide distribution:** Large rotational uncertainty
- **Note:** Euler angles have periodicity (wrapping at ±180°), which can cause artifacts

### Hover for Details

Hover your mouse over any bar to see:
- Bin range (e.g., "12.5° – 15.0°")
- Sample count in that bin
- Percentage of total samples

---

## Troubleshooting Common Issues

### Problem: R̂ > 1.05 (Chains Not Converged)

**Possible causes:**
- Burn-in too short
- Tuning parameters not optimal (acceptance rate far from 23%)
- Chains started from too similar positions

**Solutions:**
1. Increase burn-in samples (~20% of total chain length)
2. Run chains longer (increase total samples)
3. Adjust σ_rot and σ_R to achieve ~23% acceptance
4. Run from more dispersed initial conditions

### Problem: N_eff < 500 (Low Effective Sample Size)

**Possible causes:**
- High autocorrelation (τ is large)
- Insufficient thinning

**Solutions:**
1. Increase thinning interval (set thinning ≈ τ)
2. Run longer chains to collect more samples
3. Adjust tuning parameters to improve mixing

### Problem: Acceptance Rate Far from 23%

**If acceptance rate < 15%:**
- Proposals too large, most are rejected
- **Solution:** Decrease σ_rot and σ_R

**If acceptance rate > 35%:**
- Proposals too small, chains move inefficiently
- **Solution:** Increase σ_rot and σ_R
- **Note:** High acceptance with high τ means you're taking tiny steps

### Problem: Bimodal R Distribution

**This is NOT a problem!** It's valid physics. See [Stress Ratio Bimodality](#stress-ratio-bimodality) above.

**What to do:**
1. Report both modes separately
2. Do NOT average them
3. Examine stress axes for each mode
4. Understand that your data support both prolate and oblate ellipsoids

### Problem: Large Fisher Cones (>60°) or NaN

**Cause:** Stress axis direction is poorly constrained (low R̄)

**Possible reasons:**
- Insufficient data
- Data quality too low
- Physical degeneracy (e.g., R ≈ 0 means σ₂ and σ₃ are interchangeable)

**What to do:**
1. Check if this is expected (degeneracy at R ≈ 0 or R ≈ 1)
2. Collect more/better data if possible
3. Report the large uncertainty honestly — it's valuable information!

---

## Summary: Quick Reference

| Metric | Good | Marginal | Problem |
|--------|------|----------|---------|
| **R̂** | <1.01 | 1.01–1.05 | >1.05 |
| **N_eff** | >1000 | 500–1000 | <500 |
| **Acceptance rate** | 18%–28% | 15%–35% | <15% or >35% |
| **Fisher cone** | <20° | 20°–45° | >60° |
| **R̄** (axis dispersion) | >0.9 | 0.5–0.9 | <0.5 |

---

## Additional Resources

For more technical details, see:
- MCMC stress inversion methodology paper
- Monte Carlo sampling documentation
- Fisher statistics for directional data

**Need help interpreting your results?** Check the console output for diagnostic messages and warnings.