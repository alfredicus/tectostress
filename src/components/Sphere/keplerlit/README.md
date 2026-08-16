# keplerlit (vendored subset)

Copied verbatim from the `slip-lines` project (`keplerlit/`), which is where the stress sphere's
filled iso-contours come from. Only the files needed to colour a mesh by a scalar field are here:

| file | role |
|---|---|
| `attributes.ts` | minimal `BufferGeometry` / `BufferAttribute` used by the iso-contour code |
| `Color.ts` | colour parsing / interpolation |
| `colorMap.ts` | colour maps (`createLut`, `colorMapNames`) |
| `utils.ts` | `minMax`, `fromValueToColor` |
| `MarchingTriangle.ts` | marching triangles, used by the iso-lines |
| `IsoContoursFilled.ts` | `createIsoContoursFilled` — the filled normal-stress bands |
| `IsoContoursLines.ts` | `createIsoContourLines` — iso-lines from the mesh scalar field |

Nothing here imports three.js or any other package: the whole subset is self-contained, and the
conversion to/from three.js geometry lives in `../SphereComponent.tsx`.

Do not edit these files here — change them upstream in `slip-lines` and re-copy, so the two stay
diffable. The overlay stack (`ColorScale.ts`, `BaseOverlay.ts`, `colorMapAdapter.ts`) was **not**
vendored: the colour-scale legend is drawn as plain HTML in `SphereComponent.tsx` instead, to match
the rest of this application's UI.
