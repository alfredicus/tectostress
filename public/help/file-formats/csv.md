# CSV Input Format Documentation

## CSV Format Generalities

### File Structure

The input file is a **Comma-Separated or Semicolon-Separated Values (CSV)** file with the following characteristics:

#### Delimiter
- **Primary delimiters:** Semicolon (`;`) and Comma (`,`)
- Do not use tabs or other delimiters
- The application automatically detects which delimiter is used in your file
- You can mix delimiters across multiple files without issues

#### Header Row
- **Required:** The first row must contain column headers
- Header names are **NOT case-sensitive**: `Type`, `type`, and `TYPE` are all recognized identically
- All header names should be in English
- The header row defines the available fields for all subsequent rows
- Headers are matched flexibly using synonym recognition (see section below)

#### Column Header Synonyms

The application recognizes multiple synonyms for column headers, allowing flexibility in naming conventions. You can use any of the recognized synonyms, and they will be interpreted identically.

##### Geometry Field Synonyms

| Primary Name | Accepted Synonyms | Description |
|---|---|---|
| `strike` | `azimuth` | Strike angle of the plane (0-360°) |
| `dip` | `dip angle`, `slope`, `slope angle` | Dip angle of the plane (0-90°) |
| `dip direction` | — | Cardinal direction of dip (N, NE, E, SE, S, SW, W, NW) |
| `strike direction` | — | Direction perpendicular to strike |
| `rake` | — | Rake angle of striation on plane (0-180°) |
| `type of movement` | `type of mouvement`, `sense of movement` | Sense of shear motion |





#### Data Rows
- Each subsequent row represents a single measurement or observation
- Empty cells are allowed and should be left blank (except for mandatory fields)
- Rows are processed sequentially from top to bottom

### Column Order Irrelevance

**Important:** The order of columns in your CSV file is **completely irrelevant**.

The application identifies each column by its **header name**, not by its position. This means:

✓ You can reorder columns in any way  
✓ You can add extra columns (which will be ignored)  
✓ You can omit optional columns  
✓ You can have columns in different orders across multiple files  

**Example:** These two CSV structures are functionally identical:

**Format A (Semicolon-delimited):**
```csv
id;type;strike;dip;Dip direction;Rake
1;Extension Fracture;120;90;NE;
2;Striated plane;75;70;S;0
```

**Format B (Comma-delimited):**
```csv
id,type,strike,dip,Dip direction,Rake
1,Extension Fracture,120,90,NE,
2,Striated plane,75,70,S,0
```

Both files will be processed identically because the application recognizes columns by their header names, not their position or delimiter.

### Handling Missing Data

- **Mandatory fields:** Must never be empty (blank cells will cause data validation errors)
- **Optional fields:** Can be left empty without issues
- Empty cells should be left completely blank (e.g., `;;` with no space between delimiters)
- Do not use `NA`, `N/A`, `null`, or other placeholder values

**Example:**
```csv
id;type;strike;dip;Dip direction;Rake;Strike direction;Type of mouvement
1;Extension Fracture;120;90;NE;;;
11;Striated plane;75;70;S;0;N;right lateral
```

In row 1, the empty fields for `Rake`, `Strike direction`, and `Type of mouvement` are left blank because they are not mandatory for Extension Fractures.

### File Encoding

- **Recommended encoding:** UTF-8
- **Also supported:** ASCII, ISO-8859-1 (Latin-1)
- Special characters (accents, Greek letters) are supported with UTF-8 encoding

### File Size Considerations

- **Minimum:** 1 measurement (though inversion reliability improves with more data)
- **Recommended minimum:** 10-20 measurements for robust results
- **Maximum:** Limited only by available system memory (typically thousands of measurements without issues)
- **Performance note:** Processing time scales linearly with the number of measurements

### Line Endings

- **Windows format:** CR+LF (`\r\n`)
- **Unix/Mac format:** LF (`\n`)
- Both are supported and handled automatically

### Special Considerations

#### Whitespace
- Leading and trailing whitespace in cells is automatically trimmed
- Interior spaces are preserved (e.g., `right lateral` is valid)
- Do not use spaces as delimiters

#### Numeric Precision
- Angles can be provided as integers or decimals
- Decimal separator: Period (`.`) not comma (`,`)
- Examples: `75`, `75.5`, `75.25`, `0.5`

#### Case Insensitivity
- Column headers are **NOT case-sensitive**: `Type`, `type`, and `TYPE` are all recognized
- Header names are matched flexibly to accommodate different conventions
- Data values (like movement types) are also case-insensitive
- Consistency is recommended for clarity, but not required

#### Comments and Metadata
- Comments should not be included in the CSV file itself
- If you need to add comments, use a separate metadata section outside the CSV
- All rows with valid header names will be processed as data

**Example:** These three CSV files are functionally identical:

**Format 1 (Primary names, semicolon-delimited):**
```csv
id;type;strike;dip;dip direction;rake;type of movement
11;Striated plane;75;70;S;0;right-lateral
```

**Format 2 (Using synonyms, comma-delimited):**
```csv
id,type,azimuth,dip angle,dip direction,rake,sense of movement
11,Fault,75,70,S,0,right-lateral
```

**Format 3 (Mixed naming and delimiters):**
```csv
id;type;strike;slope;dip direction;rake;type of mouvement
11;Shear fracture;75;70;S;0;right-lateral
```

All three formats will be processed identically.

### Data Type Synonyms

The application recognizes multiple synonyms for data types, allowing you to use terminology that matches your field conventions or literature sources.

#### Striated Plane / Fault Synonyms

| Primary Name | Accepted Synonyms |
|---|---|
| `Striated plane` | `Fault`, `Shear fracture`, `Brittle shear fracture`, `Brittle fault`, `Striated fault plane` |
| `neoformed striated plane` | (newer fault/shear surface) |

These types require mandatory fields: `strike`, `dip`, `dip direction`, `rake`, `strike direction`, `type of movement`

**Example:**
```csv
id;type;strike;dip;dip direction;rake;strike direction;type of movement
11;Striated plane;75;70;S;0;N;right-lateral
12;Fault;75;70;S;0;N;right-lateral
13;Shear fracture;75;70;S;0;N;right-lateral
14;Brittle fault;75;70;S;0;N;right-lateral
```

All four rows are equivalent.

#### Extension Fracture / Joint Synonyms

| Primary Name | Accepted Synonyms |
|---|---|
| `Extension Fracture` | `Joint`, `Tension fracture`, `Tensile fracture`, `Open fracture`, `Vein`, `Tension gash`, `Dike`, `Dyke` |

These types require mandatory fields: `strike`, `dip`, `dip direction`

**Example:**
```csv
id;type;strike;dip;dip direction
1;Extension Fracture;120;90;NE
2;Joint;120;90;NE
3;Tension fracture;120;90;NE
4;Vein;120;90;NE
5;Dike;120;90;NE
```

All five rows are equivalent.

#### Stylolite Interface Synonyms

| Primary Name | Accepted Synonyms |
|---|---|
| `Stylolite Interface` | `Stylolite`, `Pressure solution seam`, `Pressure solution surface`, `Stylolite plane` |

These types require mandatory fields: `strike`, `dip`, `dip direction`

**Example:**
```csv
id;type;strike;dip;dip direction
3;Stylolite Interface;30;90;NW
4;Stylolite;30;90;NW
5;Pressure solution seam;30;90;NW
6;Pressure solution surface;30;90;NW
```

All four rows are equivalent.

#### Stylolite Teeth and Crystal Fibers

These data types have no primary synonyms and use the documented names directly.

#### Mixed Synonyms Example

Here's a practical example using multiple synonyms in a single dataset with mixed delimiters:

```csv
id;type;azimuth;dip angle;dip direction;rake;strike direction;sense of movement
1;Joint;120;90;NE;;;
2;Tension fracture;300;90;SW;;;
3;Stylolite;30;90;NW;;;
4;Pressure solution seam;210;90;SE;;;
5;Crystal fibers in vein;;;;;;;;30;0
6;Vein;;;;;;;;210;0
7;Stylolite teeth;;;;;;;;120;0
8;Dyke;;;;;;;;300;0
9;Dilation band;120;90;N;;;;;;;
10;Dilation band;300;90;S;;;;;;;
11;Fault;75;70;S;0;N;right-lateral
12;Shear fracture;165;70;N;0;S;left-lateral
13;Brittle fault;30;30;SE;90;N;Inverse
14;Striated fault plane;150;90;N;0;N;left-lateral
15;Brittle shear fracture;90;90;S;0;W;right-lateral
```

This dataset mixes multiple synonyms while remaining valid and fully compatible with the system.

### Benefits of Synonyms

✓ **Flexibility:** Use terminology that matches your convention  
✓ **International collaboration:** Support multiple languages and regional naming conventions  
✓ **Literature compatibility:** Use terms from published papers and field guides  
✓ **Reduced errors:** Less need to memorize exact field names  

---

## Column Descriptions

### Universal Mandatory Fields

These fields are **required for all data types**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | Integer | Unique identifier for the measurement | 1, 2, 3, ... |
| `type` | String | Classification of the measurement type | See Data Types section below |

### Data Type Specific Fields

The mandatory and optional fields vary depending on the `type` value:

#### 1. **Striated Plane** (`Striated plane`, `neoformed striated plane`)

Measurements from fault planes with visible slickensides or striations indicating shear direction.

**Mandatory Fields:**
- `strike` – Strike angle of the plane (0-360°)
- `dip` – Dip angle of the plane (0-90°)
- `Dip direction` – Cardinal direction of dip (NE, SE, SW, NW, N, S, E, W)
- `Rake` – Rake angle of the striation on the plane (0-180°)
- `Strike direction` – Direction perpendicular to strike (N, S, E, W, NE, SE, SW, NW)
- `Type of mouvement` – Sense of shear (right-lateral, left-lateral, Inverse, Normal)

**Optional Fields:**
- `Deformation phase` – Chronological phase identifier
- `Relative weight` – Weight factor for the measurement (default: 1.0)
- `Min friction angle` – Minimum friction angle estimate
- `Max friction angle` – Maximum friction angle estimate
- `Min angle` – Minimum angle constraint
- `Max angle` – Maximum angle constraint

**Example:**
```
11;Striated plane;75;70;S;0;N;;right lateral;;;;;;;;;;;;;;;
```

#### 2. **Extension Fracture** (`Extension Fracture`, synonyms: Joint, Tension fracture, Vein, Dike, etc.)

Mode I fractures (tension joints) perpendicular to the least compressive stress axis.

**Mandatory Fields:**
- `strike` – Strike angle of the fracture plane (0-360°)
- `dip` – Dip angle of the fracture plane (0-90°)
- `Dip direction` – Cardinal direction of dip

**Optional Fields:**
- All fields from Striated Plane (not typically used but available)

**Example:**
```
1;Extension Fracture;120;90;NE;;;;;;;;;;;;;;;;;;;
1,Joint,120,90,NE
```

#### 3. **Stylolite Interface** (`Stylolite Interface`, synonyms: Stylolite, Pressure solution seam, etc.)

Irregular surfaces formed by pressure dissolution, perpendicular to the maximum compressive stress.

**Mandatory Fields:**
- `strike` – Strike angle of the interface (0-360°)
- `dip` – Dip angle of the interface (0-90°)
- `Dip direction` – Cardinal direction of dip

**Optional Fields:**
- Same as Extension Fracture

**Example:**
```
3;Stylolite Interface;30;90;NW;;;;;;;;;;;;;;;;;;;
3,Pressure solution seam,30,90,NW
```

#### 4. **Stylolite Teeth** (`Stylolite teeth`)

Direction of stylolite tooth plunge, indicating principal stress direction.

**Mandatory Fields:**
- `Line trend` – Trend angle of the tooth direction (0-360°)
- `Line plunge` – Plunge angle of the tooth direction (0-90°)

**Optional Fields:**
- Deformation phase, weights, angle constraints

**Example:**
```
7;Stylolite teeth;;;;;;;;120;0;;;;;;;;;;;;;
```

#### 5. **Crystal Fibers in Vein** (`Crystal fibers in vein`)

Growth direction of crystals in veins, indicating principal stress orientation.

**Mandatory Fields:**
- `Line trend` – Trend angle of fiber growth (0-360°)
- `Line plunge` – Plunge angle of fiber growth (0-90°)

**Optional Fields:**
- Same as Stylolite Teeth

**Example:**
```
5;Crystal fibers in vein;;;;;;;;30;0;;;;;;;;;;;;;
```

#### 6. **Dilation Band** (`dilation band`)

Opening-mode fractures bounded by shear fractures, indicating stress direction.

**Mandatory Fields:**
- `strike` – Strike angle of the band (0-360°)
- `dip` – Dip angle of the band (0-90°)
- `Dip direction` – Cardinal direction of dip

**Optional Fields:**
- Same as Extension Fracture

**Example:**
```
9;dilation band;120;90;N;;;;;;;;;;;;;;;;;;;
```

---

## Field Specifications

### Angular Measurements

- **Strike/Dip angles:** 0-360° for strike, 0-90° for dip
- **Rake angle:** 0-180° (measured on the plane)
- **Line trend/plunge:** 0-360° for trend, 0-90° for plunge
- **Cardinal directions:** N, NE, E, SE, S, SW, W, NW

### Movement Sense Options

For striated planes, specify:
- `right-lateral` – Dextral sense
- `left-lateral` – Sinistral sense
- `Inverse` – Reverse/thrust sense
- `Normal` – Extensional sense

### Spatial Coordinates (Optional)

- `x`, `y`, `z` – Optional 3D coordinates for measurement location
- Useful for spatial analysis but not required for stress inversion

---

## Mandatory Field Matrix

| Data Type | id | type | strike | dip | Dip direction | Rake | Strike direction | Type of mouvement | Line trend | Line plunge |
|-----------|:--:|:----:|:------:|:---:|:-------------:|:----:|:----------------:|:-----------------:|:----------:|:-----------:|
| Striated Plane | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Extension Fracture | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | |
| Stylolite Interface | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | |
| Stylolite Teeth | ✓ | ✓ | | | | | | | ✓ | ✓ |
| Crystal Fibers | ✓ | ✓ | | | | | | | ✓ | ✓ |
| Dilation Band | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | |

---

## User Case: Field Study of a Fault Zone

### Scenario

**Dr. Marie Dubois**, a structural geologist, is conducting a field campaign in the Pyrenees. She has identified a major dextral strike-slip fault zone and wants to understand the paleostress regime responsible for its development. In addition to measuring the fault plane itself, she observes several subsidiary structures around the fault zone.

### Field Observations

#### Location 1: Main Fault Plane
Marie measures the primary fault plane with clear slickensides showing right-lateral movement. She records:
- Strike: 75° (NE trending)
- Dip: 70° (toward the SE)
- Rake: 0° (purely horizontal striations)
- Movement: right-lateral

```csv
11;Striated plane;75;70;S;0;N;;right lateral;;;;;;;;;;;;;;;
```

#### Location 2 & 3: Adjacent Fault Splays
Two satellite faults with similar kinematics but different geometries:

```csv
12;Striated plane;165;70;N;0;S;;left-lateral;;;;;;;;;;;;;;;
13;striated plane;30;30;SE;90;N;;Inverse;;;;;;;;;;;;;;;
```

#### Location 4 & 5: Neogenic Fault Plane
A more recent fault overprinting the older structures with left-lateral motion:

```csv
14;neoformed striated plane;150;90;N;0;N;;left-lateral;;;;;;;;;;;;;;;
15;neoformed striated plane;90;90;S;0;W;;right-lateral;;;;;;;;;;;;;;;
```

#### Location 6 & 7: Extension Fractures
Two sets of tension joints near the fault zone, interpreted to be perpendicular to σ₃:

```csv
1;Extension Fracture;120;90;NE;;;;;;;;;;;;;;;;;;;
2;Extension Fracture;300;90;SW;;;;;;;;;;;;;;;;;;;
```

#### Location 8 & 9: Stylolite Interfaces
Pressure-dissolution structures on limestone layers above the fault, perpendicular to σ₁:

```csv
3;Stylolite Interface;30;90;NW;;;;;;;;;;;;;;;;;;;
4;Stylolite Interface;210;90;SE;;;;;;;;;;;;;;;;;;;
```

#### Location 10 & 11: Stylolite Teeth
Teeth plunging to the NE, indicating principal stress direction:

```csv
7;Stylolite teeth;;;;;;;;120;0;;;;;;;;;;;;;
8;Stylolite teeth;;;;;;;;300;0;;;;;;;;;;;;;
```

#### Location 12 & 13: Crystal Fibers in Veins
Calcite fibers in en-échelon vein arrays growing parallel to σ₁:

```csv
5;Crystal fibers in vein;;;;;;;;30;0;;;;;;;;;;;;;
6;Crystal fibers in vein;;;;;;;;210;0;;;;;;;;;;;;;
```

#### Location 14 & 15: Dilation Bands
Mixed-mode fractures showing simultaneous opening and shearing:

```csv
9;dilation band;120;90;N;;;;;;;;;;;;;;;;;;;
10;dilation band;300;90;S;;;;;;;;;;;;;;;;;;;
```

### Complete Dataset

```csv
id;type;strike;dip;Dip direction;Rake;Strike direction;Striation trend;Type of mouvement;Line trend;Line plunge;Deformation phase;Relative weight;Min friction angle;Max friction angle;Min angle;Max angle;Scale;Bedding-plane-strike;Bedding-plane-dip;Bedding-plane-dip-direction;x;y;z
1;Extension Fracture;120;90;NE;;;;;;;;;;;;;;;;;;;
2;Extension Fracture;300;90;SW;;;;;;;;;;;;;;;;;;;
3;Stylolite Interface;30;90;NW;;;;;;;;;;;;;;;;;;;
4;Stylolite Interface;210;90;SE;;;;;;;;;;;;;;;;;;;
5;Crystal fibers in vein;;;;;;;;30;0;;;;;;;;;;;;;
6;Crystal fibers in vein;;;;;;;;210;0;;;;;;;;;;;;;
7;Stylolite teeth;;;;;;;;120;0;;;;;;;;;;;;;
8;Stylolite teeth;;;;;;;;300;0;;;;;;;;;;;;;
9;dilation band;120;90;N;;;;;;;;;;;;;;;;;;;
10;dilation band;300;90;S;;;;;;;;;;;;;;;;;;;
11;Striated plane;75;70;S;0;N;;right lateral;;;;;;;;;;;;;;;
12;Striated plane;165;70;N;0;S;;left-lateral;;;;;;;;;;;;;;;
13;striated plane;30;30;SE;90;N;;Inverse;;;;;;;;;;;;;;;
14;neoformed striated plane;150;90;N;0;N;;left-lateral;;;;;;;;;;;;;;;
15;neoformed striated plane;90;90;S;0;W;;right-lateral;;;;;;;;;;;;;;;
```

### Analysis Workflow

1. **Data Import:** Marie imports her CSV file into the stress inversion software
2. **Method Selection:** She chooses Monte Carlo inversion with 20,000 random trials
3. **Stress Ratio:** Sets an initial stress ratio of 0.5 (R = (σ₂ - σ₃)/(σ₁ - σ₃))
4. **Results:** The inversion reveals:
   - σ₁ oriented NE-SW (sub-horizontal)
   - σ₂ oriented NW-SE (sub-horizontal)
   - σ₃ oriented vertically (or near-vertical)
   - This stress regime explains the observed right-lateral motion on NE-striking planes

### Interpretation

The combination of measurements confirms a horizontal stress regime with sub-equal σ₁ and σ₂ values (stress ratio close to 0.5). This is consistent with a strike-slip fault regime typical of transcurrent tectonics. The diverse subsidiary structures (extension fractures, stylolites, dilation bands) all record the same stress orientation, increasing confidence in the results.

---

## Best Practices

1. **Data Quality:** Ensure accurate angle measurements with clinometer and compass
2. **Redundancy:** Include multiple measurement types to constrain the solution
3. **Uncertainty:** Use optional fields (`Min/Max angle`, `Relative weight`) to indicate measurement uncertainty
4. **Spatial Distribution:** Collect measurements across the study area to test spatial variations
5. **Documentation:** Record deformation phase to separate multi-stage deformation
6. **Validation:** Always cross-check inversion results against field observations
7. **Delimiter Choice:** Use either semicolons or commas consistently within a file (though mixing is allowed across files)
8. **Header Standardization:** Use clear, consistent header names to minimize ambiguity, even though synonyms and case-insensitivity are supported