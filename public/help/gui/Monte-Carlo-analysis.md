# Monte Carlo Stress Inversion: Analysis Guide

## What is Monte Carlo Stress Inversion?

Monte Carlo uses **uniform random sampling** to explore the entire parameter space:
- Generates N random stress tensors (typically 10⁵–10⁶)
- Evaluates misfit for each
- Accepts models within a threshold (e.g., top 50% or ΔM < 0.5)
- Builds posterior statistics from accepted set

**Key advantage:** Simple, no tuning required, no convergence issues.

**Key disadvantage:** Less efficient than MCMC for high-dimensional problems (samples entire space uniformly, not focused on high-probability regions).

---

## Understanding the Output

### Monte Carlo Sampling Statistics Panel

**Total Samples (N):**
- Number of random stress tensors generated
- **Typical:** 10⁵ for standard runs, 10⁶ for high-resolution posteriors
- **More samples** = smoother histograms, better CI estimates

**Accepted:**
- Number of models that passed the acceptance threshold
- Shows count and percentage (e.g., "25,432 models (25.4% of total)")

**Threshold:**
- Criterion used to define the accepted set
- **50% CI:** Accept the best half of all samples
- **95% CI:** Accept the best 95% of all samples
- **ΔM < X:** Accept models with misfit < (M* + ΔM)

**Interpretation:**
- **High acceptance fraction (>50%):** Data weakly constrain the model
- **Low acceptance fraction (<5%):** Very tight constraints, or threshold too strict

---

## Best-fit vs Posterior Mean Comparison

**This is the most important panel for Monte Carlo results!**

### Why Both Values Matter

Unlike MCMC (which samples proportional to probability), Monte Carlo samples **uniformly**. The best-fit and posterior mean can diverge significantly if the posterior is non-Gaussian.

### Reading the Comparison Panel

**For each parameter:**
- **Best-fit:** The single model with lowest misfit (optimal solution)
- **Mean:** Average across all accepted models (Bayesian central estimate)
- **Δ (Delta):** Absolute difference between them

### Interpreting the Difference

**Small difference (Δ < 0.05 for R, <5° for angles):**
- Posterior is **approximately Gaussian** (symmetric, unimodal)
- Best-fit ≈ Mean ≈ Mode
- **Safe to report the mean** with standard deviation

**Large difference (Δ > 0.1 for R, >10° for angles):**
- Posterior is **non-Gaussian** (skewed or multimodal)
- **⚠️ Warning:** Mean may not represent a physically realistic solution
- **Action required:**
  1. Examine the histogram shape
  2. Report **both** best-fit and mean separately
  3. If bimodal, report the two modes instead of the mean

**Example (Stress Ratio):**
```
Best-fit: 0.92
Mean:     0.48
Δ:        0.44  ← Large difference!
```

**What this means:**
- The distribution is likely **bimodal** (peaks near R ≈ 0 and R ≈ 1)
- The mean R ≈ 0.48 corresponds to an **intermediate ellipsoid** that is NOT a solution
- **Correct interpretation:** Data support both prolate (R ≈ 0) and oblate (R ≈ 1) stress states

---

## Acceptance Threshold Strategies

### 50% CI Threshold (Recommended Default)

**What it does:** Accepts the best half of all models (top 50%)

**Advantages:**
- Focuses on high-probability region
- Good balance between precision and robustness
- Directly yields 50% credible intervals

**When to use:** Standard stress inversions, moderate data quality

### 95% CI Threshold (Conservative)

**What it does:** Accepts the best 95% of all models

**Advantages:**
- Very broad uncertainty estimates
- Conservative for publication

**Disadvantages:**
- Includes many low-probability models
- Posteriors may be artificially broadened

**When to use:** When you need conservative uncertainty bounds, or data are very noisy

### ΔM Threshold (Custom)

**What it does:** Accepts models with misfit M < (M* + ΔM)

**Example:** If M* = 0.12 (best-fit) and ΔM = 0.05, accept all models with M < 0.17

**Advantages:**
- Direct control over misfit tolerance
- Physically meaningful (based on expected data uncertainty)

**When to use:** When you have a specific misfit threshold in mind (e.g., from chi-squared statistics)

---

## Sample Size Recommendations

### Pilot Run: N = 10⁴
**Purpose:** Quick exploratory run
- Check acceptance rates (~10–50% is typical)
- Identify approximate peak locations
- Detect bimodality
- **Time:** Seconds to minutes

### Standard Run: N = 10⁵
**Purpose:** Main analysis for most inversions
- Sufficient for smooth histograms
- Reliable CI estimates
- **Time:** Minutes to tens of minutes

### High-Resolution Run: N = 10⁶
**Purpose:** Publication-quality results
- Very smooth posteriors
- Precise quantile estimates
- Needed when accepted fraction is small (<5%)
- **Time:** Tens of minutes to hours

**Rule of thumb:** Aim for **at least 1,000 accepted samples** for reliable statistics.

---

## Interpreting the Histograms

Monte Carlo histograms show the **marginal posterior distribution** of each parameter.

### Why Counts Are Meaningful

Because the prior is **uniform** (flat):
- On R: uniform over [0, 1]
- On orientations: uniform over SO(3)

**The count in each bin is directly proportional to the posterior probability.**

**No reweighting needed!** A high count at R ≈ 0.7 means many distinct stress tensors compatible with R = 0.7 fit the data well.

### What Histogram Shape Tells You

**Single narrow peak:**
- Parameter is **well constrained**
- Data strongly prefer this value

**Wide, flat distribution:**
- Parameter is **poorly constrained**
- Data provide little information about this parameter

**Two peaks (bimodal):**
- **Physical degeneracy** (see Bimodality section below)
- Both solutions are equally supported by the data
- **Do NOT average** — report both modes

**Skewed distribution:**
- Asymmetric posterior
- Mean ≠ Mode ≠ Best-fit
- Report histogram shape, not just mean ± std

---

## Stress Ratio Bimodality

### Why R Distributions Can Be Bimodal

When data do not strongly constrain the **shape** of the stress ellipsoid, you may see:
- **Peak near R ≈ 0:** Prolate ellipsoid (σ₂ ≈ σ₃)
- **Peak near R ≈ 1:** Oblate ellipsoid (σ₁ ≈ σ₂)
- **Trough in between:** Intermediate shapes fit more poorly

**This is genuine physics, not a bug!**

### Physical Interpretation

**At R = 0 (Prolate):**
- Stress ellipsoid is cigar-shaped
- Any rotation mixing σ₂ and σ₃ produces the same tensor
- **Rotational degeneracy** → many equally good solutions → higher count in histogram

**At R = 1 (Oblate):**
- Stress ellipsoid is pancake-shaped
- Any rotation mixing σ₁ and σ₂ is equally valid
- Same rotational degeneracy

**Key insight:** Degenerate states have **more distinct orientations** that fit equally well, so they accumulate higher counts.

### How to Report Bimodal Results

1. ✓ **Report the bimodal distribution as-is**
2. ✓ **Report both mode locations** (e.g., "R ≈ 0.04 and R ≈ 0.95")
3. ✓ **Examine stress axes** for each mode separately
4. ✗ **Do NOT report mean ± std** (e.g., "R = 0.48 ± 0.42" is misleading)
5. ✓ **Note the symmetry:** R ≈ 0 solution is related to R ≈ 1 solution by permuting σ₁ ↔ σ₃

**In a paper:** "The stress ratio distribution is bimodal, with peaks at R = 0.05 ± 0.03 (prolate) and R = 0.94 ± 0.04 (oblate), indicating the data support both axially symmetric stress states."

---

## Stress Axis Orientations

See [main MCMC guide](./MCMC-analysis.md#stress-axis-orientations) for detailed explanation of:
- Trend and plunge conventions
- Mean resultant length (R̄)
- Fisher confidence cones
- Interpretation of poorly constrained axes

**Note for Monte Carlo:** Axis orientations are computed the same way, but samples are uniformly distributed (not MCMC-weighted).

---

## Monte Carlo vs MCMC: When to Use Which?

| Aspect | Monte Carlo | MCMC |
|--------|-------------|------|
| **Sampling** | Uniform random | Markov chain (adaptive) |
| **Efficiency** | Lower (samples entire space) | Higher (focuses on high-prob regions) |
| **Tuning** | None required | Requires σ_rot, σ_R tuning |
| **Convergence** | Not applicable | Must check R̂, N_eff |
| **Best for** | Simple problems, exploratory runs | High-dimensional, standard inversions |
| **Failure modes** | None (always completes) | Non-convergence if poorly tuned |
| **Output** | Best-fit vs mean comparison | Chain diagnostics |

**Recommendation:**
- Start with **Monte Carlo** (N = 10⁴) for quick exploration
- Use **MCMC** for production runs (more efficient)
- Return to **Monte Carlo** (N = 10⁶) if MCMC convergence is problematic

---

## Common Questions

### Q: Why is my accepted fraction so low (<5%)?

**A:** This can happen when:
1. **Data are very high quality** → Tight constraints → Few models fit well (this is good!)
2. **Threshold is too strict** → Try 50% CI instead of ΔM threshold
3. **Sample size too small** → Increase N to 10⁶

**Solution:** Increase N to ensure you still have >1,000 accepted samples.

### Q: Why do best-fit and mean differ so much?

**A:** Your posterior is **non-Gaussian**. Check the histogram:
- If bimodal: Report both modes
- If skewed: Report median instead of mean, or report full distribution
- Always show the histogram, not just summary statistics

### Q: Should I use 50% CI or 95% CI threshold?

**A:**
- **50% CI:** Standard choice, focuses on most probable models
- **95% CI:** Conservative, use if you need broader uncertainty estimates
- **ΔM:** Use if you have a physically motivated misfit threshold

**Most common:** 50% CI for exploration, then report both 50% and 95% intervals in final results.

### Q: Can I combine Monte Carlo and MCMC results?

**A:** No, they use different sampling schemes. Choose one method per analysis. However:
- You can **validate** MCMC results by running a large Monte Carlo (N = 10⁶) and comparing posteriors
- If they agree, both methods are sampling the same posterior (good!)
- If they differ, investigate MCMC convergence

---

## Summary: Monte Carlo Checklist

Before interpreting Monte Carlo results:

- [ ] Check accepted fraction is reasonable (5%–50%)
- [ ] Ensure ≥1,000 accepted samples for reliable statistics
- [ ] Compare best-fit vs mean — if Δ is large, examine histograms carefully
- [ ] Check for bimodality in R distribution
- [ ] Report both 50% and 95% CI
- [ ] Examine stress axis orientations (trend, plunge, Fisher cones)
- [ ] If bimodal, report modes separately (do NOT average)

---

## Need More Help?

- See [MCMC Analysis Guide](./MCMC-analysis.md) for detailed explanations of:
  - Stress ratio bimodality
  - Stress axis orientations
  - Fisher confidence cones
  - Histogram interpretation
- Check the console for diagnostic messages
- Consult the Monte Carlo methodology paper for mathematical details
