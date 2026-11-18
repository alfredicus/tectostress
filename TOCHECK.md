Misfit normalisation and TectoStress outputs: points to decide

  1. The local library and the npm release differ
  - TectoStress currently runs a build of the uncommitted ~/dev/stress working copy. Among other changes, it adds /π to the striated-plane ANGLE cost, so every data type now returns θ/π, between 0 and 1.
  - npm 1.2.1 is different. Fault costs are in radians while fracture and stylolite costs are θ/π, so the mean mixes units. It also cannot create the search methods the app uses, "Monte Carlo (Euler)" and "MCMC (Euler)".
  - So a clean install of TectoStress cannot run an inversion. The local changes need committing and publishing as a new version, which TectoStress then requires.

  2. The normalised cost θ/π stays, but displays must show degrees
  - θ/π is fine for the optimisation.
  - TectoStress converts it inconsistently. The log and Run panel use × 180 (correct), but the results file and the Run tab exports use × 180/π, written for radians. Exported misfits are therefore π times too small (e.g. 1.24° instead of 3.89°).
  - Proposal: never convert the cost into degrees. Compute physical misfits (mean, median, max, by data type) from each datum's angle between measured and predicted. That works for any criterion and any weights. Keep normalized_cost as its own, clearly
    named value.

  3. Weights: the type weighting differs between the two criteria

  ┌──────────────────────────────┬─────────────────┬──────────────────────┐
  │                              │      ANGLE      │         DOT          │
  ├──────────────────────────────┼─────────────────┼──────────────────────┤
  │ Striation (slip sense known) │ θ/180°, max 1   │ (1 − cos θ)/2, max 1 │                                                                                                                                           
  ├──────────────────────────────┼─────────────────┼──────────────────────┤
  │ Striation (sense unknown)    │ max 0.5         │ max 0.5              │
  ├──────────────────────────────┼─────────────────┼──────────────────────┤
  │ Tension fracture, stylolite  │ θ/180°, max 0.5 │ 1 − |cos θ|, max 1   │
  └──────────────────────────────┴─────────────────┴──────────────────────┘

  Changing the criterion also changes how much each data type counts. Is that intended?


  └──────────────────────────────┴─────────────────┴──────────────────────┘

  Changing the criterion also changes how much each data type counts. Is that intended?

  4. Weights and averaging
  Changing the criterion also changes how much each data type counts. Is that intended?

  4. Weights and averaging

  Misfit normalisation and TectoStress outputs: points to decide

  1. The local library and the npm release differ
  - TectoStress currently runs a build of the uncommitted ~/dev/stress working copy. Among other changes, it adds /π to the striated-plane ANGLE cost, so every data type now returns θ/π, between 0 and 1.
  - npm 1.2.1 is different. Fault costs are in radians while fracture and stylolite costs are θ/π, so the mean mixes units. It also cannot create the search methods the app uses, "Monte Carlo (Euler)" and "MCMC (Euler)".
  - So a clean install of TectoStress cannot run an inversion. The local changes need committing and publishing as a new version, which TectoStress then requires.

  2. The normalised cost θ/π stays, but displays must show degrees
  - θ/π is fine for the optimisation.
  - TectoStress converts it inconsistently. The log and Run panel use × 180 (correct), but the results file and the Run tab exports use × 180/π, written for radians. Exported misfits are therefore π times too small (e.g.
    1.24° instead of 3.89°).
  - Proposal: never convert the cost into degrees. Compute physical misfits (mean, median, max, by data type) from each datum's angle between measured and predicted. That works for any criterion and any weights. Keep
    normalized_cost as its own, clearly named value.

  3. Weights: the type weighting differs between the two criteria

  ┌──────────────────────────────┬─────────────────┬──────────────────────┐
  │                              │      ANGLE      │         DOT          │
  ├──────────────────────────────┼─────────────────┼──────────────────────┤
  │ Striation (slip sense known) │ θ/180°, max 1   │ (1 − cos θ)/2, max 1 │
  ├──────────────────────────────┼─────────────────┼──────────────────────┤
  │ Striation (sense unknown)    │ max 0.5         │ max 0.5              │
  ├──────────────────────────────┼─────────────────┼──────────────────────┤
  │ Tension fracture, stylolite  │ θ/180°, max 0.5 │ 1 − |cos θ|, max 1   │
  └──────────────────────────────┴─────────────────┴──────────────────────┘

  Changing the criterion also changes how much each data type counts. Is that intended?

  4. Weights and averaging
  - The search minimises Σ(weight × cost) / N, not / Σ weights. The code itself carries the comment "WARNING TO THE LENGTH vs WEIGHT".
  │ Tension fracture, stylolite  │ θ/180°, max 0.5 │ 1 − |cos θ|, max 1   │
  └──────────────────────────────┴─────────────────┴──────────────────────┘

  Changing the criterion also changes how much each data type counts. Is that intended?

  4. Weights and averaging
  - The search minimises Σ(weight × cost) / N, not / Σ weights. The code itself carries the comment "WARNING TO THE LENGTH vs WEIGHT".
  - The misfit landscape ignores weights entirely.


  Changing the criterion also changes how much each data type counts. Is that intended?

  4. Weights and averaging
  - The search minimises Σ(weight × cost) / N, not / Σ weights. The code itself carries the comment "WARNING TO THE LENGTH vs WEIGHT".
  Changing the criterion also changes how much each data type counts. Is that intended?

  4. Weights and averaging
  - The search minimises Σ(weight × cost) / N, not / Σ weights. The code itself carries the comment "WARNING TO THE LENGTH vs WEIGHT".
  ├──────────────────────────────┼─────────────────┼──────────────────────┤
  │ Striation (sense unknown)    │ max 0.5         │ max 0.5              │
  ├──────────────────────────────┼─────────────────┼──────────────────────┤
  │ Tension fracture, stylolite  │ θ/180°, max 0.5 │ 1 − |cos θ|, max 1   │
  └──────────────────────────────┴─────────────────┴──────────────────────┘

  Changing the criterion also changes how much each data type counts. Is that intended?

  │ Tension fracture, stylolite  │ θ/180°, max 0.5 │ 1 − |cos θ|, max 1   │
  └──────────────────────────────┴─────────────────┴──────────────────────┘

  Changing the criterion also changes how much each data type counts. Is that intended?

  Changing the criterion also changes how much each data type counts. Is that intended?

  Changing the criterion also changes how much each data type counts. Is that intended?

  4. Weights and averaging
  - The search minimises Σ(weight × cost) / N, not / Σ weights. The code itself carries the comment "WARNING TO THE LENGTH vs WEIGHT".
  - The misfit landscape ignores weights entirely.

  5. MCMC temperature
  The temperature (0.05) is in normalised-cost units, so its meaning changed when the fault cost went from radians to θ/π. Its unit should be documented.

  6. Histogram
  Proposal: by default, show angles in degrees, which is the only measure comparable across data types. As an option, show the normalised cost the inversion minimised. Plot data types separately, since
  striations range over 0–180° and fractures and stylolites over 0–90°.

  To decide:
  - the type weighting (point 3);
  - how weights enter the cost (point 4);
  - the names of the results-file fields;
  - whether to keep fit_percentage;
  - the library version to publish.
