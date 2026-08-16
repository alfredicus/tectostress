
/**
 * BufferAttribute class for handling typed arrays in WebGL.
 * 
 * We rewrite it in order to avoid using the THREE.js library if necessary.
 * 
 * @param array - The typed array (Float32Array, Uint16Array, or Uint32Array)
 * @param itemSize - Number of components per item (e.g., 3 for vec3)
 * @param normalized - Whether the attribute is normalized (default: false)
 * @param usage - WebGL usage hint (default: STATIC_DRAW)
 * @param updateRange - Range of items to update (default: entire array)
 * @param version - Version number for tracking changes (default: 0)
 * @param needsUpdate - Whether the attribute needs to be updated (default: false)
 * 
 * Example usage:
 * @example
 * // Create position attribute (3 components per vertex)
 * const positions = new Float32BufferAttribute([
 *   0, 0, 0,    // vertex 0
 *   1, 0, 0,    // vertex 1
 *   0, 1, 0     // vertex 2
 * ], 3);
 *  
 * // Set vertex at index 1
 * positions.set(1, [2, 0, 0]);
 *  
 * // Get vertex at index 0
 * const vertex0 = positions.get(0); // [0, 0, 0]
 *  
 * // Set individual component
 * positions.setComponent(2, 2, 1); // Set z-component of vertex 2 to 1
 *  
 * // Create color attribute (4 components: RGBA)
 * const colors = new Float32BufferAttribute([
 *   1, 0, 0, 1,    // red
 *   0, 1, 0, 1,    // green
 *   0, 0, 1, 1     // blue
 * ], 4);
 *  
 * // Get color of vertex 1
 * const color1 = colors.get(1); // [0, 1, 0, 1]
 *  
 * // Create UV coordinates (2 components per vertex)
 * const uvs = new Float32BufferAttribute([
 *   0, 0,    // vertex 0
 *   1, 0,    // vertex 1
 *   0, 1     // vertex 2
 * ], 2);
 *  
 * // Copy vertex 0 UV to vertex 2
 * uvs.copyAt(2, uvs, 0);
 *  
 * // Apply transformation to all positions
 * positions.forEach((values, index) => {
 *   return [values[0] * 2, values[1] * 2, values[2] * 2]; // Scale by 2
 * });
 */
export class BufferAttribute {
    array: Float32Array | Uint16Array | Uint32Array;
    itemSize: number;
    count: number;
    normalized: boolean;
    usage: number;
    updateRange: { offset: number; count: number };
    version: number;
    needsUpdate: boolean;

    constructor(
        array: Float32Array | Uint16Array | Uint32Array,
        itemSize: number,
        normalized: boolean = false
    ) {
        this.array = array;
        this.itemSize = itemSize;
        this.count = array.length / itemSize;
        this.normalized = normalized;
        this.usage = 35044; // WebGL STATIC_DRAW
        this.updateRange = { offset: 0, count: -1 };
        this.version = 0;
        this.needsUpdate = false;
    }

    /**
     * Set values at a specific index
     * @param index - The index of the item (not the array index)
     * @param values - Array of values, must be of length itemSize
     */
    set(index: number, values: number[]): this {
        if (values.length !== this.itemSize) {
            throw new Error(`Expected ${this.itemSize} values, got ${values.length}`);
        }

        if (index < 0 || index >= this.count) {
            throw new Error(`Index ${index} out of range [0, ${this.count - 1}]`);
        }

        const startIndex = index * this.itemSize;
        for (let i = 0; i < this.itemSize; i++) {
            (this.array as any)[startIndex + i] = values[i];
        }

        this.needsUpdate = true;
        return this;
    }

    /**
     * Get values at a specific index
     * @param index - The index of the item (not the array index)
     * @returns Array of values of length itemSize
     */
    get(index: number): number[] {
        if (index < 0 || index >= this.count) {
            throw new Error(`Index ${index} out of range [0, ${this.count - 1}]`);
        }

        const startIndex = index * this.itemSize;
        const result: number[] = [];

        for (let i = 0; i < this.itemSize; i++) {
            result.push(this.array[startIndex + i]);
        }

        return result;
    }

    /**
     * @brief Get the x component of an item at a specific index.
     * Similar to get(index)[0], but optimized for performance.
     */
    getX(index: number): number {
        if (index < 0 || index >= this.count) {
            throw new Error(`Index ${index} out of range [0, ${this.count - 1}]`);
        }

        return this.array[index * this.itemSize];
    }

    /**
     * @brief Get the y component of an item at a specific index.
     * * Similar to get(index)[1], but optimized for performance.
     */
    getY(index: number): number {
        if (this.itemSize < 2) {
            throw new Error(`Item size is ${this.itemSize}, cannot get Y component`);
        }
        return this.array[index * this.itemSize + 1];
    }

    /**
     * @brief Get the z component of an item at a specific index.
     * * Similar to get(index)[2], but optimized for performance.
     */
    getZ(index: number): number {
        if (this.itemSize < 3) {
            throw new Error(`Item size is ${this.itemSize}, cannot get Z component`);
        }
        return this.array[index * this.itemSize + 2];
    }

    /**
     * Set a single component value at a specific index and component
     * @param index - The index of the item
     * @param component - The component index (0 to itemSize-1)
     * @param value - The value to set
     */
    setComponent(index: number, component: number, value: number): this {
        if (index < 0 || index >= this.count) {
            throw new Error(`Index ${index} out of range [0, ${this.count - 1}]`);
        }

        if (component < 0 || component >= this.itemSize) {
            throw new Error(`Component ${component} out of range [0, ${this.itemSize - 1}]`);
        }

        (this.array as any)[index * this.itemSize + component] = value;
        this.needsUpdate = true;
        return this;
    }

    /**
     * Get a single component value at a specific index and component
     * @param index - The index of the item
     * @param component - The component index (0 to itemSize-1)
     * @returns The component value
     */
    getComponent(index: number, component: number): number {
        if (index < 0 || index >= this.count) {
            throw new Error(`Index ${index} out of range [0, ${this.count - 1}]`);
        }

        if (component < 0 || component >= this.itemSize) {
            throw new Error(`Component ${component} out of range [0, ${this.itemSize - 1}]`);
        }

        return this.array[index * this.itemSize + component];
    }

    /**
     * Copy data from another BufferAttribute
     * @param source - The source BufferAttribute
     */
    copy(source: BufferAttribute): this {
        this.array = source.array.slice();
        this.itemSize = source.itemSize;
        this.count = source.count;
        this.normalized = source.normalized;
        this.usage = source.usage;
        this.updateRange = { ...source.updateRange };
        this.version = source.version;
        this.needsUpdate = source.needsUpdate;
        return this;
    }

    /**
     * Copy an item from another BufferAttribute at different indices
     * @param index1 - Target index in this attribute
     * @param attribute - Source BufferAttribute
     * @param index2 - Source index in the source attribute
     */
    copyAt(index1: number, attribute: BufferAttribute, index2: number): this {
        if (this.itemSize !== attribute.itemSize) {
            throw new Error(`ItemSize mismatch: ${this.itemSize} vs ${attribute.itemSize}`);
        }

        const values = attribute.get(index2);
        this.set(index1, values);
        return this;
    }

    /**
     * Clone this BufferAttribute
     * @returns A new BufferAttribute with the same data
     */
    clone(): BufferAttribute {
        const TypedArrayConstructor = this.array.constructor as any;
        const clonedArray = new TypedArrayConstructor(this.array);
        return new BufferAttribute(clonedArray, this.itemSize, this.normalized);
    }

    /**
     * Set the usage hint for WebGL
     * @param usage - WebGL usage constant
     */
    setUsage(usage: number): this {
        this.usage = usage;
        return this;
    }

    /**
     * Get the size in bytes of the array
     */
    getByteLength(): number {
        return this.array.byteLength;
    }

    /**
     * Apply a function to each item in the attribute
     * @param callback - Function to apply, receives (values, index) and should return new values
     */
    forEach(callback: (values: number[], index: number) => void): BufferAttribute {
        for (let i = 0; i < this.count; i++) {
            const currentValues = this.get(i);
            callback(currentValues, i);
        }
        return this;
    }
}

/**
 * BufferGeometry class for handling multiple BufferAttributes + one for the geometry and one for the indices
 */
export class BufferGeometry {
    private attributes: { [key: string]: BufferAttribute } = {};
    private positions: Float32BufferAttribute | null = null;
    private indices: Uint32BufferAttribute | null = null;

    constructor(positions?: Float32BufferAttribute, indices?: Uint32BufferAttribute) {
        if (positions) {
            this.positions = positions;
        }
        if (indices) {
            this.indices = indices;
        }
    }

    setPositions(positions: Float32BufferAttribute): this {
        this.positions = positions
        return this
    }

    getPositions(): Float32BufferAttribute | null {
        return this.positions
    }

    setIndices(indices: Uint32BufferAttribute): this {
        this.indices = indices;
        return this;
    }

    getIndices(): Uint32BufferAttribute | null {
        return this.indices;
    }

    setAttribute(name: string, attribute: BufferAttribute): this {
        this.attributes[name] = attribute;
        return this;
    }

    getAttribute(name: string): BufferAttribute | undefined {
        return this.attributes[name];
    }

    /**
     * Compute smooth vertex normals for the geometry
     * This method calculates normals by averaging face normals of adjacent triangles
     */
    computeVertexNormals(): this {
        if (!this.positions) {
            console.warn('Cannot compute vertex normals: no position attribute found');
            return this;
        }

        const positionAttribute = this.positions;
        const vertexCount = positionAttribute.count;

        // Initialize normals array with zeros
        const normals = new Float32Array(vertexCount * 3);

        // Create or get the normal attribute
        let normalAttribute = this.getAttribute('normal') as Float32BufferAttribute;
        if (!normalAttribute) {
            normalAttribute = new Float32BufferAttribute(normals, 3);
            this.setAttribute('normal', normalAttribute);
        } else {
            // Reset existing normals to zero
            normals.fill(0);
            normalAttribute.array = normals;
        }

        // Helper vectors for calculations
        const v0 = [0, 0, 0];
        const v1 = [0, 0, 0];
        const v2 = [0, 0, 0];
        const edge1 = [0, 0, 0];
        const edge2 = [0, 0, 0];
        const faceNormal = [0, 0, 0];

        // Function to calculate cross product
        const cross = (a: number[], b: number[], result: number[]): void => {
            result[0] = a[1] * b[2] - a[2] * b[1];
            result[1] = a[2] * b[0] - a[0] * b[2];
            result[2] = a[0] * b[1] - a[1] * b[0];
        };

        // Function to subtract vectors
        const subtract = (a: number[], b: number[], result: number[]): void => {
            result[0] = a[0] - b[0];
            result[1] = a[1] - b[1];
            result[2] = a[2] - b[2];
        };

        // Function to add vectors
        const add = (a: number[], b: number[]): void => {
            a[0] += b[0];
            a[1] += b[1];
            a[2] += b[2];
        };

        if (this.indices) {
            // Indexed geometry - iterate through triangles using indices
            const indexArray = this.indices.array;
            const triangleCount = indexArray.length / 3;

            for (let i = 0; i < triangleCount; i++) {
                const i0 = indexArray[i * 3];
                const i1 = indexArray[i * 3 + 1];
                const i2 = indexArray[i * 3 + 2];

                // Get vertices
                v0[0] = positionAttribute.getComponent(i0, 0);
                v0[1] = positionAttribute.getComponent(i0, 1);
                v0[2] = positionAttribute.getComponent(i0, 2);

                v1[0] = positionAttribute.getComponent(i1, 0);
                v1[1] = positionAttribute.getComponent(i1, 1);
                v1[2] = positionAttribute.getComponent(i1, 2);

                v2[0] = positionAttribute.getComponent(i2, 0);
                v2[1] = positionAttribute.getComponent(i2, 1);
                v2[2] = positionAttribute.getComponent(i2, 2);

                // Calculate edges
                subtract(v1, v0, edge1);
                subtract(v2, v0, edge2);

                // Calculate face normal (cross product)
                cross(edge1, edge2, faceNormal);

                // Add face normal to each vertex normal
                const n0 = [normals[i0 * 3], normals[i0 * 3 + 1], normals[i0 * 3 + 2]];
                const n1 = [normals[i1 * 3], normals[i1 * 3 + 1], normals[i1 * 3 + 2]];
                const n2 = [normals[i2 * 3], normals[i2 * 3 + 1], normals[i2 * 3 + 2]];

                add(n0, faceNormal);
                add(n1, faceNormal);
                add(n2, faceNormal);

                // Store back in array
                normals[i0 * 3] = n0[0];
                normals[i0 * 3 + 1] = n0[1];
                normals[i0 * 3 + 2] = n0[2];

                normals[i1 * 3] = n1[0];
                normals[i1 * 3 + 1] = n1[1];
                normals[i1 * 3 + 2] = n1[2];

                normals[i2 * 3] = n2[0];
                normals[i2 * 3 + 1] = n2[1];
                normals[i2 * 3 + 2] = n2[2];
            }
        } else {
            // Non-indexed geometry - vertices are stored sequentially in triangles
            const triangleCount = vertexCount / 3;

            for (let i = 0; i < triangleCount; i++) {
                const i0 = i * 3;
                const i1 = i * 3 + 1;
                const i2 = i * 3 + 2;

                // Get vertices
                v0[0] = positionAttribute.getComponent(i0, 0);
                v0[1] = positionAttribute.getComponent(i0, 1);
                v0[2] = positionAttribute.getComponent(i0, 2);

                v1[0] = positionAttribute.getComponent(i1, 0);
                v1[1] = positionAttribute.getComponent(i1, 1);
                v1[2] = positionAttribute.getComponent(i1, 2);

                v2[0] = positionAttribute.getComponent(i2, 0);
                v2[1] = positionAttribute.getComponent(i2, 1);
                v2[2] = positionAttribute.getComponent(i2, 2);

                // Calculate edges
                subtract(v1, v0, edge1);
                subtract(v2, v0, edge2);

                // Calculate face normal (cross product)
                cross(edge1, edge2, faceNormal);

                // For non-indexed geometry, each vertex belongs to only one triangle
                // so we can directly assign the face normal
                normals[i0 * 3] = faceNormal[0];
                normals[i0 * 3 + 1] = faceNormal[1];
                normals[i0 * 3 + 2] = faceNormal[2];

                normals[i1 * 3] = faceNormal[0];
                normals[i1 * 3 + 1] = faceNormal[1];
                normals[i1 * 3 + 2] = faceNormal[2];

                normals[i2 * 3] = faceNormal[0];
                normals[i2 * 3 + 1] = faceNormal[1];
                normals[i2 * 3 + 2] = faceNormal[2];
            }
        }

        // Normalize all normal vectors
        for (let i = 0; i < vertexCount; i++) {
            const x = normals[i * 3];
            const y = normals[i * 3 + 1];
            const z = normals[i * 3 + 2];

            const length = Math.sqrt(x * x + y * y + z * z);

            if (length > 0) {
                normals[i * 3] = x / length;
                normals[i * 3 + 1] = y / length;
                normals[i * 3 + 2] = z / length;
            } else {
                // Handle degenerate case (zero-length normal)
                normals[i * 3] = 0;
                normals[i * 3 + 1] = 1;
                normals[i * 3 + 2] = 0;
            }
        }

        // Update the normal attribute
        normalAttribute.needsUpdate = true;

        return this;
    }

}

// Convenience constructors for different types

/**
 * Float32BufferAttribute class for handling Float32Array
 * @param array - The typed array (Float32Array or number[])
 * @param itemSize - Number of components per item (e.g., 3 for vec3)
 * @param normalized - Whether the attribute is normalized (default: false)
 */
export class Float32BufferAttribute extends BufferAttribute {
    constructor(array: number[] | Float32Array, itemSize: number, normalized: boolean = false) {
        const typedArray = array instanceof Float32Array ? array : new Float32Array(array);
        super(typedArray, itemSize, normalized);
    }
}

/**
 * Uint16BufferAttribute class for handling Uint16Array
 * @param array - The typed array (Uint16Array or number[])
 * @param itemSize - Number of components per item (e.g., 3 for vec3)
 * @param normalized - Whether the attribute is normalized (default: false)
 */
export class Uint16BufferAttribute extends BufferAttribute {
    constructor(array: number[] | Uint16Array, itemSize: number, normalized: boolean = false) {
        const typedArray = array instanceof Uint16Array ? array : new Uint16Array(array);
        super(typedArray, itemSize, normalized);
    }
}

/**
 * Uint32BufferAttribute class for handling Uint32Array
 * @param array - The typed array (Uint32Array or number[])
 * @param itemSize - Number of components per item (e.g., 3 for vec3)
 * @param normalized - Whether the attribute is normalized (default: false)
 */
export class Uint32BufferAttribute extends BufferAttribute {
    constructor(array: number[] | Uint32Array, itemSize: number, normalized: boolean = false) {
        const typedArray = array instanceof Uint32Array ? array : new Uint32Array(array);
        super(typedArray, itemSize, normalized);
    }
}
