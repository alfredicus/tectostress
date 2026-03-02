# Explanations about the displayed results after a MCMC inversion

## Why the values differ

Euler Angles (below eigenvectors) = angles extracted from the single best-fit stress tensor (the one solution with lowest misfit).

MCMC Posterior Euler Angles = angles extracted from every sample in the chain (thousands of rotation matrices), then averaged. These represent the mean of the posterior
distribution, not the best-fit point.

They differ because:
- The best-fit is one specific point (the MAP estimate)
- The posterior mean averages over all accepted samples, which may center slightly differently
- Euler angles can also have wrapping issues (e.g., phi jumping between -180° and +180°), which can shift the mean

Same for R (stress ratio): the top card shows the best-fit R, while the posterior shows mean ± std across all chain samples.

## How to read the stats

For example: φ (Phi): 45.2° ± 12.3° and 90% CI: [25.1°, 68.7°]

- 45.2° = mean value across the posterior
- ± 12.3° = standard deviation (spread/uncertainty)
- 90% CI = 90% of samples fall between 25.1° and 68.7° — this is your uncertainty interval

Smaller std / tighter CI = better constrained angle.

## How to read the histograms

Each histogram shows the posterior distribution of that parameter:
- X-axis = parameter value (min to max shown at bottom)
- Y-axis = frequency (how many chain samples fell in that bin)
- A narrow, peaked histogram = well-constrained parameter
- A wide, flat histogram = poorly constrained / high uncertainty
- Multiple peaks = multimodal posterior (the data supports multiple solutions)




## Reading histograms
In **posterior distribution** histograms, you're looking for the peak (mode) — the tallest bar shows the most probable value of that parameter.

But more importantly, you care about the shape:

- Single sharp peak = well-constrained parameter, the inversion is confident
- Wide/flat = poorly constrained, high uncertainty
- Multiple peaks (bimodal) = two competing solutions, the data supports both
                                                                                
You're not looking for a min or max in the traditional optimization sense — the best-fit value (green line) already shows the optimal point. The histogram
shows how certain you can be about it.

So the key question when reading a histogram is: "How tight is the distribution around the markers?"

- If the green (best-fit) and red (mean) lines are both inside a narrow peak, your result is robust
- If they diverge or the distribution is wide/flat, the parameter is poorly constrained by the data